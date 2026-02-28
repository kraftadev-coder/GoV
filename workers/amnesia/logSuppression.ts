/**
 * logSuppression.ts — Amnesia Protocol: Log Suppression Configuration
 *
 * Implements Security Protocol §1.1:
 * - Explicitly disable Cloudflare Request Logs for sensitive endpoints
 * - Ensures no PII is persisted in platform logs
 *
 * "You can't give what you don't have."
 */

/* ─── Suppressed Routes ─── */

/**
 * Routes where Cloudflare Request Logs MUST be suppressed.
 * These endpoints handle sensitive whistleblower data.
 */
export const LOG_SUPPRESSED_ROUTES: readonly string[] = [
    '/api/report',
    '/api/whistle',
    '/api/upload',
    '/api/evidence',
] as const;

/* ─── Configuration ─── */

/**
 * Log suppression configuration for Cloudflare Workers.
 *
 * When deploying, set `logpush = false` in wrangler.toml for
 * the routes that handle sensitive data. This config object
 * documents the intended suppression state.
 */
export const LOG_SUPPRESSION_CONFIG = {
    /** Suppress all request logging for sensitive endpoints */
    suppressRequestLogs: true,

    /** Suppress response body logging */
    suppressResponseBody: true,

    /** Suppress header logging (prevents IP leakage in log aggregators) */
    suppressHeaders: true,

    /** Routes that require log suppression */
    routes: LOG_SUPPRESSED_ROUTES,

    /** Worker tail logging — disabled for Amnesia compliance */
    tailConsumers: false,

    /**
     * Wrangler configuration reminder:
     * In wrangler.toml, set:
     *   [observability]
     *   enabled = false
     *
     * This disables Workers Logs (formerly Tail Workers)
     * for the Amnesia endpoint.
     */
    wranglerConfig: {
        observability: { enabled: false },
        logpush: false,
    },
} as const;

/* ─── Path Normalization ─── */

/**
 * Normalize a URL path for safe comparison:
 * - lowercase
 * - strip query params and hash fragments
 * - strip trailing slash (except root "/")
 */
function normalizePath(raw: string): string {
    let path = raw.toLowerCase().split('?')[0].split('#')[0];
    if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
    }
    return path;
}

/* ─── Functions ─── */

/**
 * Check if a given route/path requires log suppression.
 *
 * @param path - The request path (e.g., "/api/report")
 * @returns true if the route matches a suppressed path
 */
export function isLogSuppressedRoute(path: string): boolean {
    const normalizedPath = normalizePath(path);
    return LOG_SUPPRESSED_ROUTES.some(
        (route) => normalizedPath === route || normalizedPath.startsWith(route + '/')
    );
}

/**
 * Get the suppression status for a request.
 * Returns a structured status object for audit/debug purposes.
 *
 * @param path - The request path
 * @returns Suppression status
 */
export function getSuppressionStatus(path: string): {
    suppressed: boolean;
    matchedRoute: string | null;
    reason: string;
} {
    const normalizedPath = normalizePath(path);
    const matched = LOG_SUPPRESSED_ROUTES.find(
        (route) => normalizedPath === route || normalizedPath.startsWith(route + '/')
    );

    if (matched) {
        return {
            suppressed: true,
            matchedRoute: matched,
            reason: 'Amnesia Protocol §1.1 — Sensitive whistleblower endpoint',
        };
    }

    return {
        suppressed: false,
        matchedRoute: null,
        reason: 'Standard route — logging permitted',
    };
}

export default LOG_SUPPRESSION_CONFIG;
