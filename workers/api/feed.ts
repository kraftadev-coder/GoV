/**
 * Module 5: Feed Endpoint — /api/feed
 *
 * Serves reports from D1 for the dual-lane feed display.
 * Supports filtering by lane (Social / Witness) and cursor-based pagination.
 *
 * Source: Implementation Plan §Module 5, Feature Goal Matrix §"Interact and air opinions"
 */

/* ─── Types ─── */

export interface Env {
    DB: D1Database;
    MEDIA_BUCKET?: R2Bucket;
}

export interface FeedReport {
    reportId: string;
    lane: 'witness' | 'social';
    title: string;
    description: string;
    mediaKey: string | null;
    mediaType: string;
    geoLabel: string;
    verificationStatus: string;
    witnessScore: number;
    contentHash: string;
    upvotes: number;
    createdAt: string;
}

export interface FeedResponse {
    reports: FeedReport[];
    nextCursor: string | null;
    hasMore: boolean;
    lane: string;
}

/* ─── Constants ─── */

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

/* ─── Main Handler ─── */

/**
 * Handle GET /api/feed
 *
 * Query params:
 *   - lane: "witness" | "social" (required)
 *   - cursor: ISO timestamp for pagination (optional)
 *   - limit: number of results (default 20, max 50)
 */
export async function handleFeed(
    request: Request,
    env: Env
): Promise<Response> {
    if (request.method !== 'GET') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        const url = new URL(request.url);
        const lane = url.searchParams.get('lane') ?? 'witness';
        const cursor = url.searchParams.get('cursor');
        const limitParam = url.searchParams.get('limit');

        // Validate lane
        if (!['witness', 'social'].includes(lane)) {
            return jsonResponse({ error: 'Invalid lane: must be "witness" or "social"' }, 400);
        }

        // Parse and clamp limit
        let limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_PAGE_SIZE;
        if (isNaN(limit) || limit < 1) limit = DEFAULT_PAGE_SIZE;
        if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;

        // Build query with cursor-based pagination
        let query: string;
        let params: unknown[];

        if (cursor) {
            query = `SELECT report_id, lane, title, description, media_key, media_type,
                            geo_label, verification_status, witness_score, content_hash,
                            upvotes, created_at
                     FROM witness_reports
                     WHERE lane = ? AND status = 'active' AND created_at < ?
                     ORDER BY created_at DESC
                     LIMIT ?`;
            params = [lane, cursor, limit + 1]; // +1 to check if there's a next page
        } else {
            query = `SELECT report_id, lane, title, description, media_key, media_type,
                            geo_label, verification_status, witness_score, content_hash,
                            upvotes, created_at
                     FROM witness_reports
                     WHERE lane = ? AND status = 'active'
                     ORDER BY created_at DESC
                     LIMIT ?`;
            params = [lane, limit + 1];
        }

        const result = await env.DB.prepare(query).bind(...params).all();
        const rows = result.results ?? [];

        // Determine if there's a next page
        const hasNextPage = rows.length > limit;
        const reports = rows.slice(0, limit);

        // Map D1 rows to FeedReport
        const feedReports: FeedReport[] = reports.map((row) => ({
            reportId: String(row.report_id),
            lane: row.lane as 'witness' | 'social',
            title: String(row.title ?? ''),
            description: String(row.description ?? ''),
            mediaKey: row.media_key ? String(row.media_key) : null,
            mediaType: String(row.media_type ?? 'image'),
            geoLabel: String(row.geo_label ?? 'Unknown'),
            verificationStatus: String(row.verification_status ?? 'pending'),
            witnessScore: Number(row.witness_score ?? 0),
            contentHash: String(row.content_hash ?? ''),
            upvotes: Number(row.upvotes ?? 0),
            createdAt: String(row.created_at ?? ''),
        }));

        const response: FeedResponse = {
            reports: feedReports,
            nextCursor: hasNextPage && reports.length > 0
                ? String(reports[reports.length - 1].created_at)
                : null,
            hasMore: hasNextPage,
            lane,
        };

        return jsonResponse(response);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return jsonResponse({ error: message }, 500);
    }
}

/**
 * Resolve a media URL for an R2 object key.
 * Simply returns a path-based URL that the frontend can request.
 * Actual R2 serving happens via R2 public bucket or a separate media worker.
 */
export function resolveMediaUrl(mediaKey: string | null): string | null {
    if (!mediaKey) return null;
    return `/api/media/${encodeURIComponent(mediaKey)}`;
}

/* ─── Response Helper ─── */

function jsonResponse(data: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=30', // 30s cache for feed
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

export default handleFeed;
