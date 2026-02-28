/**
 * Module 5: Reputation Endpoint — /api/reputation
 *
 * CRUD operations for the anonymous reputation system stored in D1.
 * Mirrors the client-side reputationEngine.ts logic but persists to D1.
 *
 * Source: Implementation Plan §Module 5, Feature Goal Matrix §"Option to create an account"
 *         Security Protocol §4.3 (Sybil defense)
 *
 * SECURITY NOTE: POST requests are currently unprotected — any client can
 * call this endpoint. Module 8 will add Turnstile CAPTCHA verification to
 * prevent automated self-award attacks. Until then, reputation events are
 * also triggered server-side from report.ts (which has rate limiting).
 */

/* ─── Types ─── */

export interface Env {
    DB: D1Database;
}

export interface ReputationRecord {
    anonToken: string;
    points: number;
    level: 'junior' | 'advanced';
    verifiedReports: number;
    peerUpvotes: number;
    createdAt: string;
    updatedAt: string;
}

export interface UpdateReputationPayload {
    anonToken: string;
    eventType: 'verified-report' | 'peer-upvote';
    /** Location diversity factor (0.01 – 1.0). Same-tower = 0.01, fully diverse = 1.0 */
    locationDiversityFactor?: number;
}

/* ─── Constants ─── */

const ADVANCED_THRESHOLD = 1000;

/** Base point values (must match client-side reputationEngine.ts) */
const POINT_VALUES: Record<string, number> = {
    'verified-report': 150,
    'peer-upvote': 10,
};

/* ─── Utility Functions ─── */

/**
 * Calculate reputation level from points.
 */
export function calculateLevel(points: number): 'junior' | 'advanced' {
    return points >= ADVANCED_THRESHOLD ? 'advanced' : 'junior';
}

/**
 * Apply Location Diversity weighting for anti-Sybil protection.
 * 100 upvotes from the same cell tower = 1 effective upvote.
 */
export function applyLocationDiversity(
    basePoints: number,
    locationDiversityFactor: number
): number {
    const factor = Math.max(0.01, Math.min(1.0, locationDiversityFactor));
    return Math.floor(basePoints * factor);
}

/**
 * Compute points to award for a reputation event.
 */
export function computePoints(
    eventType: string,
    locationDiversityFactor?: number
): number {
    const base = POINT_VALUES[eventType] ?? 0;
    if (base === 0) return 0;

    if (eventType === 'peer-upvote' && locationDiversityFactor !== undefined) {
        return applyLocationDiversity(base, locationDiversityFactor);
    }

    return base;
}

/* ─── Main Handler ─── */

/**
 * Handle /api/reputation requests
 *
 * GET /api/reputation?token=<anon_token>  → Fetch reputation
 * POST /api/reputation                     → Update reputation (award points)
 */
export async function handleReputation(
    request: Request,
    env: Env
): Promise<Response> {
    const url = new URL(request.url);

    switch (request.method) {
        case 'GET':
            return handleGetReputation(url, env);
        case 'POST':
            return handleUpdateReputation(request, env);
        case 'OPTIONS':
            return new Response(null, {
                status: 204,
                headers: corsHeaders(),
            });
        default:
            return jsonResponse({ error: 'Method not allowed' }, 405);
    }
}

/* ─── GET: Fetch Reputation ─── */

async function handleGetReputation(url: URL, env: Env): Promise<Response> {
    const token = url.searchParams.get('token');

    if (!token || token.length !== 64) {
        return jsonResponse({ error: 'Invalid token: must be a 64-character hex string' }, 400);
    }

    try {
        const row = await env.DB.prepare(
            `SELECT anon_token, points, level, verified_reports, peer_upvotes,
                    created_at, updated_at
             FROM anon_reputation
             WHERE anon_token = ?`
        ).bind(token).first();

        if (!row) {
            // User has no reputation record yet — return default
            return jsonResponse({
                reputation: {
                    anonToken: token,
                    points: 0,
                    level: 'junior',
                    verifiedReports: 0,
                    peerUpvotes: 0,
                    canUploadVideo: false,
                    createdAt: null,
                    updatedAt: null,
                },
            });
        }

        const points = Number(row.points ?? 0);
        const reputation: ReputationRecord & { canUploadVideo: boolean } = {
            anonToken: String(row.anon_token),
            points,
            level: calculateLevel(points),
            verifiedReports: Number(row.verified_reports ?? 0),
            peerUpvotes: Number(row.peer_upvotes ?? 0),
            createdAt: String(row.created_at ?? ''),
            updatedAt: String(row.updated_at ?? ''),
            canUploadVideo: points >= ADVANCED_THRESHOLD,
        };

        return jsonResponse({ reputation });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return jsonResponse({ error: message }, 500);
    }
}

/* ─── POST: Update Reputation ─── */

async function handleUpdateReputation(request: Request, env: Env): Promise<Response> {
    try {
        const payload = await request.json() as UpdateReputationPayload;

        // Validate payload
        if (!payload.anonToken || payload.anonToken.length !== 64) {
            return jsonResponse({ error: 'Invalid anonToken' }, 400);
        }

        if (!payload.eventType || !['verified-report', 'peer-upvote'].includes(payload.eventType)) {
            return jsonResponse({ error: 'Invalid eventType: must be "verified-report" or "peer-upvote"' }, 400);
        }

        // Compute points with Sybil defense
        const pointsToAward = computePoints(payload.eventType, payload.locationDiversityFactor);

        // Reject zero-point awards (e.g., malformed locationDiversityFactor abuse)
        if (pointsToAward <= 0) {
            return jsonResponse({ error: 'No points to award — location diversity factor too low' }, 400);
        }

        // Upsert reputation (create if not exists, update if exists)
        const isReport = payload.eventType === 'verified-report';
        const isUpvote = payload.eventType === 'peer-upvote';

        await env.DB.prepare(
            `INSERT INTO anon_reputation (anon_token, points, level, verified_reports, peer_upvotes)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(anon_token) DO UPDATE SET
                points = points + ?,
                level = CASE WHEN points + ? >= 1000 THEN 'advanced' ELSE 'junior' END,
                verified_reports = verified_reports + ?,
                peer_upvotes = peer_upvotes + ?,
                updated_at = datetime('now')`
        ).bind(
            payload.anonToken,
            pointsToAward,
            calculateLevel(pointsToAward),
            isReport ? 1 : 0,
            isUpvote ? 1 : 0,
            pointsToAward,
            pointsToAward,
            isReport ? 1 : 0,
            isUpvote ? 1 : 0
        ).run();

        // Fetch updated record
        const updated = await env.DB.prepare(
            `SELECT points, level, verified_reports, peer_upvotes
             FROM anon_reputation WHERE anon_token = ?`
        ).bind(payload.anonToken).first();

        const newPoints = Number(updated?.points ?? pointsToAward);

        return jsonResponse({
            success: true,
            pointsAwarded: pointsToAward,
            totalPoints: newPoints,
            level: calculateLevel(newPoints),
            canUploadVideo: newPoints >= ADVANCED_THRESHOLD,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return jsonResponse({ error: message }, 500);
    }
}

/* ─── Response Helpers ─── */

function corsHeaders(): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
}

function jsonResponse(data: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            ...corsHeaders(),
        },
    });
}

export default handleReputation;
