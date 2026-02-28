/**
 * CivicVoice — Admin API Worker
 * Module 7: Admin Dashboard & Observability
 *
 * Protected endpoints for platform monitoring and content moderation.
 * All endpoints require `Authorization: Bearer <ADMIN_SECRET>` header.
 *
 * Routes:
 *   GET  /api/admin/stats      → Aggregated platform metrics
 *   GET  /api/admin/moderation  → Pending flagged content
 *   POST /api/admin/moderate    → Approve/reject flagged items
 *   GET  /api/admin/activity    → Recent activity log (last 50)
 *
 * Source: Implementation Plan Module 7, Technical Blueprint §4, Security Protocol §3
 */

/* ─── Types ─── */

export interface AdminEnv {
    DB: D1Database;
    MEDIA_BUCKET?: R2Bucket;
    ADMIN_SECRET?: string;
}

export interface PlatformStats {
    totalReports: number;
    totalUsers: number;
    reportsToday: number;
    flaggedCount: number;
    verifiedCount: number;
    activeReports: number;
    witnessReports: number;
    socialReports: number;
    juniorUsers: number;
    advancedUsers: number;
    rateLimitHitsToday: number;
    storageBytes: number;
}

export interface FlaggedReport {
    reportId: string;
    anonToken: string;
    mediaType: string;
    geoLabel: string;
    contentHash: string;
    verificationStatus: string;
    status: string;
    createdAt: string;
    witnessScore: number;
}

export interface ModerationAction {
    reportId: string;
    action: 'approve' | 'reject' | 'escalate';
}

export interface ActivityEvent {
    eventId: string;
    eventType: string;
    targetId: string;
    geoLabel: string;
    details: string;
    createdAt: string;
}

/* ─── Constants ─── */

const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

const JSON_HEADERS: Record<string, string> = {
    'Content-Type': 'application/json',
    ...CORS_HEADERS,
};

const MAX_ACTIVITY_ENTRIES = 50;

/* ─── Auth Guard ─── */

/**
 * Validates the admin secret token from the Authorization header.
 * Returns true if the token matches the ADMIN_SECRET Worker Secret.
 */
export function validateAdminToken(request: Request, env: AdminEnv): boolean {
    const secret = env.ADMIN_SECRET;
    if (!secret) return false;

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return false;

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) return false;

    // Constant-time comparison to prevent timing attacks
    if (token.length !== secret.length) return false;
    let mismatch = 0;
    for (let i = 0; i < token.length; i++) {
        mismatch |= token.charCodeAt(i) ^ secret.charCodeAt(i);
    }
    return mismatch === 0;
}

/* ─── Utility: Generate UUID ─── */

function generateEventId(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/* ─── Utility: Log Activity ─── */

export async function logAdminActivity(
    db: D1Database,
    eventType: string,
    targetId: string,
    geoLabel: string = 'System',
    details: string = ''
): Promise<void> {
    try {
        await db.prepare(
            `INSERT INTO admin_activity_log (event_id, event_type, target_id, geo_label, details)
             VALUES (?, ?, ?, ?, ?)`
        ).bind(generateEventId(), eventType, targetId, geoLabel, details).run();
    } catch {
        // Silently fail — activity logging should never block operations
    }
}

/* ─── Handler: GET /api/admin/stats ─── */

async function handleStats(env: AdminEnv): Promise<Response> {
    const db = env.DB;
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString().replace('T', ' ').replace('Z', '');

    try {
        // Parallel D1 queries for all stats
        const [
            totalReportsRes,
            totalUsersRes,
            reportsTodayRes,
            flaggedRes,
            verifiedRes,
            activeRes,
            witnessRes,
            socialRes,
            juniorRes,
            advancedRes,
            rateLimitRes,
        ] = await Promise.all([
            db.prepare('SELECT COUNT(*) as count FROM witness_reports').first<{ count: number }>(),
            db.prepare('SELECT COUNT(*) as count FROM anon_reputation').first<{ count: number }>(),
            db.prepare('SELECT COUNT(*) as count FROM witness_reports WHERE created_at >= ?').bind(todayStr).first<{ count: number }>(),
            db.prepare("SELECT COUNT(*) as count FROM witness_reports WHERE status = 'flagged'").first<{ count: number }>(),
            db.prepare("SELECT COUNT(*) as count FROM witness_reports WHERE verification_status = 'witness-verified'").first<{ count: number }>(),
            db.prepare("SELECT COUNT(*) as count FROM witness_reports WHERE status = 'active'").first<{ count: number }>(),
            db.prepare("SELECT COUNT(*) as count FROM witness_reports WHERE lane = 'witness'").first<{ count: number }>(),
            db.prepare("SELECT COUNT(*) as count FROM witness_reports WHERE lane = 'social'").first<{ count: number }>(),
            db.prepare("SELECT COUNT(*) as count FROM anon_reputation WHERE level = 'junior'").first<{ count: number }>(),
            db.prepare("SELECT COUNT(*) as count FROM anon_reputation WHERE level = 'advanced'").first<{ count: number }>(),
            db.prepare("SELECT COUNT(*) as count FROM admin_activity_log WHERE event_type = 'rate_limit_hit' AND created_at >= ?").bind(todayStr).first<{ count: number }>().catch(() => null),
        ]);

        const stats: PlatformStats = {
            totalReports: totalReportsRes?.count ?? 0,
            totalUsers: totalUsersRes?.count ?? 0,
            reportsToday: reportsTodayRes?.count ?? 0,
            flaggedCount: flaggedRes?.count ?? 0,
            verifiedCount: verifiedRes?.count ?? 0,
            activeReports: activeRes?.count ?? 0,
            witnessReports: witnessRes?.count ?? 0,
            socialReports: socialRes?.count ?? 0,
            juniorUsers: juniorRes?.count ?? 0,
            advancedUsers: advancedRes?.count ?? 0,
            rateLimitHitsToday: rateLimitRes?.count ?? 0,
            storageBytes: 0, // R2 usage — requires R2 API, deferred
        };

        return new Response(JSON.stringify({ stats }), { headers: JSON_HEADERS });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Stats query failed';
        return new Response(JSON.stringify({ error: message, stats: null }), {
            status: 500,
            headers: JSON_HEADERS,
        });
    }
}

/* ─── Handler: GET /api/admin/moderation ─── */

async function handleModerationList(env: AdminEnv): Promise<Response> {
    const db = env.DB;

    const result = await db.prepare(
        `SELECT report_id, anon_token, media_type, geo_label, content_hash,
                verification_status, status, created_at, witness_score
         FROM witness_reports
         WHERE status = 'flagged'
         ORDER BY created_at DESC
         LIMIT 100`
    ).all<{
        report_id: string;
        anon_token: string;
        media_type: string;
        geo_label: string;
        content_hash: string;
        verification_status: string;
        status: string;
        created_at: string;
        witness_score: number;
    }>();

    const reports: FlaggedReport[] = (result.results ?? []).map(r => ({
        reportId: r.report_id,
        anonToken: r.anon_token.substring(0, 8) + '...', // Truncate for privacy
        mediaType: r.media_type,
        geoLabel: r.geo_label,
        contentHash: r.content_hash,
        verificationStatus: r.verification_status,
        status: r.status,
        createdAt: r.created_at,
        witnessScore: r.witness_score,
    }));

    return new Response(JSON.stringify({
        reports,
        totalFlagged: reports.length,
    }), { headers: JSON_HEADERS });
}

/* ─── Handler: POST /api/admin/moderate ─── */

async function handleModerateAction(request: Request, env: AdminEnv): Promise<Response> {
    const db = env.DB;

    let body: ModerationAction;
    try {
        body = await request.json() as ModerationAction;
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: JSON_HEADERS,
        });
    }

    const { reportId, action } = body;

    if (!reportId || !action) {
        return new Response(JSON.stringify({ error: 'Missing reportId or action' }), {
            status: 400,
            headers: JSON_HEADERS,
        });
    }

    if (!['approve', 'reject', 'escalate'].includes(action)) {
        return new Response(JSON.stringify({ error: 'Invalid action. Must be approve, reject, or escalate' }), {
            status: 400,
            headers: JSON_HEADERS,
        });
    }

    // Map action to status
    const statusMap: Record<string, string> = {
        approve: 'active',
        reject: 'removed',
        escalate: 'flagged', // Remains flagged but logged as escalated
    };

    const newStatus = statusMap[action];

    // Update report status in D1
    const result = await db.prepare(
        `UPDATE witness_reports SET status = ?, updated_at = datetime('now') WHERE report_id = ?`
    ).bind(newStatus, reportId).run();

    if (!result.success) {
        return new Response(JSON.stringify({ error: 'Failed to update report' }), {
            status: 500,
            headers: JSON_HEADERS,
        });
    }

    // Fetch geo_label for activity log
    const report = await db.prepare(
        'SELECT geo_label FROM witness_reports WHERE report_id = ?'
    ).bind(reportId).first<{ geo_label: string }>();

    // Map action to event type for activity log
    const eventTypeMap: Record<string, string> = {
        approve: 'report_approved',
        reject: 'report_rejected',
        escalate: 'report_escalated',
    };
    const eventType = eventTypeMap[action];
    await logAdminActivity(
        db,
        eventType,
        reportId,
        report?.geo_label ?? 'Unknown',
        JSON.stringify({ action, previousStatus: 'flagged', newStatus })
    );

    return new Response(JSON.stringify({
        success: true,
        reportId,
        action,
        newStatus,
    }), { headers: JSON_HEADERS });
}

/* ─── Handler: GET /api/admin/activity ─── */

async function handleActivityLog(env: AdminEnv): Promise<Response> {
    const db = env.DB;

    const result = await db.prepare(
        `SELECT event_id, event_type, target_id, geo_label, details, created_at
         FROM admin_activity_log
         ORDER BY created_at DESC
         LIMIT ?`
    ).bind(MAX_ACTIVITY_ENTRIES).all<{
        event_id: string;
        event_type: string;
        target_id: string;
        geo_label: string;
        details: string;
        created_at: string;
    }>();

    const events: ActivityEvent[] = (result.results ?? []).map(e => ({
        eventId: e.event_id,
        eventType: e.event_type,
        targetId: e.target_id?.substring(0, 8) + '...',  // Truncate IDs — no PII
        geoLabel: e.geo_label,
        details: e.details,
        createdAt: e.created_at,
    }));

    return new Response(JSON.stringify({
        events,
        total: events.length,
    }), { headers: JSON_HEADERS });
}

/* ─── Main Router ─── */

export async function handleAdmin(request: Request, env: AdminEnv): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Auth guard — all admin endpoints require valid token
    if (!validateAdminToken(request, env)) {
        return new Response(JSON.stringify({ error: 'Access denied. Invalid admin token.' }), {
            status: 403,
            headers: JSON_HEADERS,
        });
    }

    const url = new URL(request.url);
    const subpath = url.pathname.replace(/^\/api\/admin\/?/, '').replace(/\/$/, '');

    switch (subpath) {
        case 'stats':
            if (request.method !== 'GET') {
                return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                    status: 405,
                    headers: JSON_HEADERS,
                });
            }
            return handleStats(env);

        case 'moderation':
            if (request.method !== 'GET') {
                return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                    status: 405,
                    headers: JSON_HEADERS,
                });
            }
            return handleModerationList(env);

        case 'moderate':
            if (request.method !== 'POST') {
                return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                    status: 405,
                    headers: JSON_HEADERS,
                });
            }
            return handleModerateAction(request, env);

        case 'activity':
            if (request.method !== 'GET') {
                return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                    status: 405,
                    headers: JSON_HEADERS,
                });
            }
            return handleActivityLog(env);

        default:
            return new Response(JSON.stringify({ error: 'Unknown admin endpoint' }), {
                status: 404,
                headers: JSON_HEADERS,
            });
    }
}
