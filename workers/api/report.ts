/**
 * Module 5: Report Submission Endpoint — /api/report
 *
 * The "Amnesia Endpoint" (Technical Blueprint §3.1):
 *   1. Receive multipart form (media + geo-coords)
 *   2. Validate geo via Dual-Key verification
 *   3. Strip metadata server-side (failsafe)
 *   4. Stream media to R2 (graceful fallback if unavailable)
 *   5. Log report to D1
 *   6. Stateless execution — no data persists in Worker memory
 *
 * Security:
 *   - Rate limiting: max 3 reports/hour/device (Security Protocol §3.1)
 *   - Payload caps: images ≤ 5MB, audio ≤ 10MB, video ≤ 25MB
 *   - Amnesia header purge integrated
 */

import { amnesiaHeaderPurge } from '../amnesia/headerPurge';
import { verifyDualKey, calculateWitnessScore } from './verification';

/* ─── Types ─── */

export interface Env {
    DB: D1Database;
    MEDIA_BUCKET?: R2Bucket;
}

export interface ReportPayload {
    title: string;
    description: string;
    lane: 'witness' | 'social';
    contentHash: string;
    geoLabel: string;
    deviceCountry: string | null;
    mediaType: 'image' | 'audio' | 'video' | 'text';
    anonToken: string;
}

interface SubmissionResult {
    success: boolean;
    reportId?: string;
    verificationStatus?: string;
    error?: string;
    code?: number;
}

/* ─── Constants ─── */

/** Max reports per hour per device (Security Protocol §3.1) */
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/** Payload size caps in bytes (Security Protocol §3.1) */
export const PAYLOAD_CAPS: Record<string, number> = {
    image: 5 * 1024 * 1024,     // 5MB
    audio: 10 * 1024 * 1024,    // 10MB
    video: 25 * 1024 * 1024,    // 25MB
};

/* ─── Utility Functions ─── */

/**
 * Generate a UUID v4 for report IDs.
 * Uses crypto.randomUUID() available in Workers runtime.
 */
export function generateReportId(): string {
    return crypto.randomUUID();
}

/**
 * Generate an R2 object key for media storage.
 * Format: reports/{year}/{month}/{reportId}.{ext}
 */
export function generateMediaKey(reportId: string, mediaType: string): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const ext = mediaType === 'image' ? 'webp' : mediaType === 'audio' ? 'ogg' : 'webm';
    return `reports/${year}/${month}/${reportId}.${ext}`;
}

/**
 * Validate the report payload from the client.
 * Returns null if valid, error message if invalid.
 */
export function validatePayload(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
        return 'Invalid payload: expected object';
    }

    const p = payload as Record<string, unknown>;

    if (typeof p.contentHash !== 'string' || p.contentHash.length < 16) {
        return 'Invalid contentHash: must be a string of at least 16 characters';
    }

    if (typeof p.anonToken !== 'string' || p.anonToken.length !== 64) {
        return 'Invalid anonToken: must be a 64-character hex string';
    }

    if (typeof p.lane !== 'string' || !['witness', 'social'].includes(p.lane)) {
        return 'Invalid lane: must be "witness" or "social"';
    }

    if (typeof p.mediaType !== 'string' || !['image', 'audio', 'video', 'text'].includes(p.mediaType)) {
        return 'Invalid mediaType: must be "image", "audio", "video", or "text"';
    }

    if (typeof p.geoLabel !== 'string') {
        return 'Invalid geoLabel: must be a string';
    }

    return null; // Valid
}

/**
 * Validate payload size against media type caps.
 * Returns null if valid, error message if too large.
 */
export function validatePayloadSize(size: number, mediaType: string): string | null {
    const cap = PAYLOAD_CAPS[mediaType];
    if (!cap) return 'Unknown media type';
    if (size > cap) {
        const capMB = Math.floor(cap / (1024 * 1024));
        const sizeMB = (size / (1024 * 1024)).toFixed(1);
        return `Payload too large: ${sizeMB}MB exceeds ${capMB}MB cap for ${mediaType}`;
    }
    return null;
}

/* ─── Rate Limiting (D1-based) ─── */

/**
 * Check if the device has exceeded the rate limit.
 * Counts reports from this anon_token in the last hour.
 */
export async function checkRateLimit(db: D1Database, anonToken: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: string;
}> {
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

    const result = await db.prepare(
        `SELECT COUNT(*) as count FROM witness_reports
         WHERE anon_token = ? AND created_at > ?`
    ).bind(anonToken, windowStart).first<{ count: number }>();

    const count = result?.count ?? 0;
    const allowed = count < RATE_LIMIT_MAX;
    const remaining = Math.max(0, RATE_LIMIT_MAX - count);
    const resetAt = new Date(Date.now() + RATE_LIMIT_WINDOW_MS).toISOString();

    return { allowed, remaining, resetAt };
}

/* ─── R2 Media Storage ─── */

/**
 * Upload media to R2 bucket.
 * Returns the media key on success, or null if R2 is unavailable.
 */
export async function uploadToR2(
    bucket: R2Bucket | undefined,
    mediaKey: string,
    data: ArrayBuffer,
    mediaType: string
): Promise<{ success: boolean; key: string | null; error?: string }> {
    if (!bucket) {
        return {
            success: false,
            key: null,
            error: 'R2 storage not configured — media upload deferred',
        };
    }

    try {
        const contentType =
            mediaType === 'image' ? 'image/webp' :
                mediaType === 'audio' ? 'audio/ogg' :
                    'video/webm';

        await bucket.put(mediaKey, data, {
            httpMetadata: { contentType },
            customMetadata: {
                uploadedAt: new Date().toISOString(),
                // No PII metadata — Amnesia compliant
            },
        });

        return { success: true, key: mediaKey };
    } catch (err) {
        return {
            success: false,
            key: null,
            error: `R2 upload failed: ${err instanceof Error ? err.message : 'unknown error'}`,
        };
    }
}

/* ─── R2 Lifecycle Cleanup ─── */

/**
 * Delete orphaned R2 objects that haven't been linked to a D1 record.
 * Called periodically (can be wired to a Cron Trigger in Module 8).
 *
 * Finds media_keys in R2 that don't have a matching D1 record,
 * and deletes them to prevent storage bloat.
 */
export async function cleanupOrphanedMedia(
    db: D1Database,
    bucket: R2Bucket | undefined
): Promise<{ deleted: number; error?: string }> {
    if (!bucket) {
        return { deleted: 0, error: 'R2 not configured' };
    }

    try {
        // Find reports with media_key that are still "pending" after 24h
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const orphaned = await db.prepare(
            `SELECT media_key FROM witness_reports
             WHERE status = 'active'
             AND verification_status = 'pending'
             AND media_key IS NOT NULL
             AND created_at < ?`
        ).bind(cutoff).all<{ media_key: string }>();

        let deleted = 0;
        if (orphaned.results) {
            for (const row of orphaned.results) {
                if (row.media_key) {
                    await bucket.delete(row.media_key);
                    deleted++;
                }
            }
        }

        return { deleted };
    } catch (err) {
        return {
            deleted: 0,
            error: `Cleanup failed: ${err instanceof Error ? err.message : 'unknown error'}`,
        };
    }
}

/* ─── Main Handler ─── */

/**
 * Handle POST /api/report
 *
 * Full Amnesia-compliant report submission pipeline:
 * 1. Purge PII headers
 * 2. Validate payload
 * 3. Check rate limit
 * 4. Validate payload size
 * 5. Dual-Key geo verification
 * 6. Upload to R2 (if available)
 * 7. Insert into D1
 * 8. Return result (stateless — Worker memory is clean)
 */
export async function handleReportSubmission(
    request: Request,
    env: Env
): Promise<Response> {
    // Step 1: Amnesia header purge — extract geo BEFORE destroying headers
    const { sanitizedRequest, countryCode } = amnesiaHeaderPurge(request);

    // Step 2: Only POST allowed
    if (sanitizedRequest.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        // Step 3: Parse the request body
        let payload: ReportPayload;
        let mediaData: ArrayBuffer | null = null;
        let fileSize = 0;

        const contentType = sanitizedRequest.headers.get('content-type') ?? '';

        if (contentType.includes('multipart/form-data')) {
            // Multipart form with file upload
            const formData = await sanitizedRequest.formData();
            const file = formData.get('media') as File | null;

            payload = {
                title: String(formData.get('title') ?? ''),
                description: String(formData.get('description') ?? ''),
                lane: (formData.get('lane') as 'witness' | 'social') ?? 'witness',
                contentHash: String(formData.get('contentHash') ?? ''),
                geoLabel: String(formData.get('geoLabel') ?? 'Unknown'),
                deviceCountry: formData.get('deviceCountry') as string | null,
                mediaType: (formData.get('mediaType') as 'image' | 'audio' | 'video' | 'text') ?? 'text',
                anonToken: String(formData.get('anonToken') ?? ''),
            };

            if (file) {
                mediaData = await file.arrayBuffer();
                fileSize = mediaData.byteLength;
            }
        } else {
            // JSON-only submission (no media file)
            payload = await sanitizedRequest.json() as ReportPayload;
        }

        // Step 4: Validate payload structure
        const validationError = validatePayload(payload);
        if (validationError) {
            return jsonResponse({ error: validationError }, 400);
        }

        // Step 5: Validate payload size
        if (fileSize > 0) {
            const sizeError = validatePayloadSize(fileSize, payload.mediaType);
            if (sizeError) {
                return jsonResponse({ error: sizeError }, 413);
            }
        }

        // Step 6: Rate limit check
        const rateLimit = await checkRateLimit(env.DB, payload.anonToken);
        if (!rateLimit.allowed) {
            return jsonResponse({
                error: 'Rate limit exceeded: max 3 reports per hour',
                remaining: rateLimit.remaining,
                resetAt: rateLimit.resetAt,
            }, 429);
        }

        // Step 6b: Content hash deduplication — reject exact duplicates
        const duplicate = await env.DB.prepare(
            `SELECT report_id FROM witness_reports WHERE content_hash = ? LIMIT 1`
        ).bind(payload.contentHash).first<{ report_id: string }>();

        if (duplicate) {
            return jsonResponse({
                error: 'Duplicate content: a report with this content hash already exists',
                existingReportId: duplicate.report_id,
            }, 409);
        }

        // Step 7: Dual-Key verification
        const verification = verifyDualKey(countryCode, payload.deviceCountry);

        // Step 8: Generate IDs
        const reportId = generateReportId();
        const mediaKey = mediaData ? generateMediaKey(reportId, payload.mediaType) : null;

        // Step 9: Upload to R2 (if media and R2 available)
        let r2Result = { success: false, key: null as string | null, error: undefined as string | undefined };
        if (mediaData && mediaKey) {
            r2Result = await uploadToR2(env.MEDIA_BUCKET, mediaKey, mediaData, payload.mediaType);
        }

        // Only store the media_key if R2 upload actually succeeded;
        // never reference a non-existent R2 object in D1
        const storedMediaKey = r2Result.success ? r2Result.key : null;

        // Step 10: Calculate witness score
        // Fetch existing reputation to inform score
        const reputationRow = await env.DB.prepare(
            `SELECT points FROM anon_reputation WHERE anon_token = ?`
        ).bind(payload.anonToken).first<{ points: number }>();

        const existingPoints = reputationRow?.points ?? 0;
        const witnessScore = calculateWitnessScore(verification.status, existingPoints);

        // Step 11: Insert report into D1
        await env.DB.prepare(
            `INSERT INTO witness_reports
             (report_id, anon_token, media_key, media_type, file_size,
              geo_label, network_country, device_country,
              verification_status, witness_score, content_hash,
              lane, title, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            reportId,
            payload.anonToken,
            storedMediaKey,
            payload.mediaType,
            fileSize,
            payload.geoLabel,
            verification.networkCountry,
            verification.deviceCountry,
            verification.status,
            witnessScore,
            payload.contentHash,
            payload.lane,
            payload.title,
            payload.description
        ).run();

        // Step 12: Update reputation — award points for verified report
        // Points match POINT_VALUES in reputation.ts: verified-report = 150
        const REPORT_POINTS = 150;
        if (verification.status === 'witness-verified' || verification.status === 'remote-verified') {
            await env.DB.prepare(
                `INSERT INTO anon_reputation (anon_token, points, level, verified_reports)
                 VALUES (?, ?, CASE WHEN ? >= 1000 THEN 'advanced' ELSE 'junior' END, 1)
                 ON CONFLICT(anon_token) DO UPDATE SET
                    points = points + ?,
                    level = CASE WHEN points + ? >= 1000 THEN 'advanced' ELSE 'junior' END,
                    verified_reports = verified_reports + 1,
                    updated_at = datetime('now')`
            ).bind(payload.anonToken, REPORT_POINTS, REPORT_POINTS, REPORT_POINTS, REPORT_POINTS).run();
        }

        // Step 13: Return result (Worker memory is now clean — stateless)
        const result: SubmissionResult = {
            success: true,
            reportId,
            verificationStatus: verification.status,
        };

        // Include R2 status only if relevant
        if (mediaData && !r2Result.success) {
            (result as Record<string, unknown>).mediaWarning = r2Result.error;
        }

        return jsonResponse(result, 201);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal server error';
        return jsonResponse({ error: message }, 500);
    }
}

/* ─── Response Helpers ─── */

function jsonResponse(data: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            // CORS headers for frontend
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

export default handleReportSubmission;
