/**
 * Module 6: Mirror Switch — Censorship-resilient endpoint failover
 *
 * Handles "The Sudden Take-down" (Security Protocol §4.2):
 * If the primary domain returns 502/timeout, auto-switch to secondary
 * *.workers.dev mirror endpoint with exponential backoff.
 *
 * Source:
 * - Security Protocol §4.2 "The Sudden Take-down"
 * - Feature Goal Matrix §"Network Reality Constraint"
 */

/* ─── Types ─── */

export type EndpointHealth = 'healthy' | 'degraded' | 'down';

export interface MirrorConfig {
    /** Primary API endpoint (e.g., civicvoice.ng/api) */
    primary: string;
    /** Mirror endpoint (e.g., civicvoice-api.workers.dev) */
    mirrors: string[];
    /** Request timeout in milliseconds */
    timeoutMs: number;
    /** Maximum retry attempts per endpoint */
    maxRetries: number;
    /** Maximum backoff delay in milliseconds */
    maxBackoffMs: number;
    /** Base backoff delay in milliseconds */
    baseBackoffMs: number;
}

export interface EndpointStatus {
    url: string;
    health: EndpointHealth;
    lastChecked: string;
    consecutiveFailures: number;
    lastError: string | null;
}

export interface FetchResult {
    response: Response;
    endpoint: string;
    attempts: number;
    failedEndpoints: string[];
}

/* ─── Constants ─── */

const DEFAULT_CONFIG: MirrorConfig = {
    primary: '/api',
    mirrors: [],
    timeoutMs: 10000,         // 10s timeout
    maxRetries: 3,
    maxBackoffMs: 30000,      // 30s max backoff
    baseBackoffMs: 1000,      // 1s base backoff
};

/** HTTP status codes that trigger failover */
const FAILOVER_STATUS_CODES = new Set([502, 503, 504, 0]);

/* ─── Endpoint Health State ─── */

const endpointHealth: Map<string, EndpointStatus> = new Map();

/**
 * Get or initialize health status for an endpoint.
 */
function getEndpointStatus(url: string): EndpointStatus {
    let status = endpointHealth.get(url);
    if (!status) {
        status = {
            url,
            health: 'healthy',
            lastChecked: new Date().toISOString(),
            consecutiveFailures: 0,
            lastError: null,
        };
        endpointHealth.set(url, status);
    }
    return status;
}

/**
 * Mark an endpoint as failed.
 */
function markEndpointFailed(url: string, error: string): void {
    const status = getEndpointStatus(url);
    status.consecutiveFailures++;
    status.lastError = error;
    status.lastChecked = new Date().toISOString();
    status.health = status.consecutiveFailures >= 3 ? 'down' : 'degraded';
}

/**
 * Mark an endpoint as healthy.
 */
function markEndpointHealthy(url: string): void {
    const status = getEndpointStatus(url);
    status.consecutiveFailures = 0;
    status.lastError = null;
    status.lastChecked = new Date().toISOString();
    status.health = 'healthy';
}

/* ─── Exponential Backoff ─── */

/**
 * Calculate exponential backoff delay.
 * Formula: min(baseMs * 2^attempt, maxMs) + jitter
 *
 * @param attempt - The retry attempt number (0-indexed)
 * @param baseMs - Base delay in milliseconds (default: 1000)
 * @param maxMs - Maximum delay in milliseconds (default: 30000)
 * @returns Delay in milliseconds
 */
export function calculateBackoff(
    attempt: number,
    baseMs: number = DEFAULT_CONFIG.baseBackoffMs,
    maxMs: number = DEFAULT_CONFIG.maxBackoffMs
): number {
    // Exponential: 1s → 2s → 4s → 8s → 16s → 30s (capped)
    const exponentialDelay = baseMs * Math.pow(2, attempt);
    const cappedDelay = Math.min(exponentialDelay, maxMs);
    // Add jitter (±25%) to prevent thundering herd
    const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
    return Math.max(0, Math.floor(cappedDelay + jitter));
}

/**
 * Sleep for the specified duration.
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ─── Core Fetch with Failover ─── */

/**
 * Fetch with timeout.
 * Returns the response or throws on timeout/network error.
 */
async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Determine if a response should trigger failover.
 */
function shouldFailover(response: Response): boolean {
    return FAILOVER_STATUS_CODES.has(response.status);
}

/**
 * Try a single endpoint with retries and exponential backoff.
 */
async function tryEndpoint(
    endpoint: string,
    path: string,
    options: RequestInit,
    config: MirrorConfig
): Promise<Response | null> {
    const url = `${endpoint}${path}`;

    for (let attempt = 0; attempt < config.maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                const delay = calculateBackoff(attempt - 1, config.baseBackoffMs, config.maxBackoffMs);
                await sleep(delay);
            }

            const response = await fetchWithTimeout(url, options, config.timeoutMs);

            if (!shouldFailover(response)) {
                markEndpointHealthy(endpoint);
                return response;
            }

            // Failover-triggering status code
            markEndpointFailed(endpoint, `HTTP ${response.status}`);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            markEndpointFailed(endpoint, errorMsg);
        }
    }

    return null; // All retries exhausted for this endpoint
}

/* ─── Public API ─── */

/** Current configuration (mutable for testing) */
let currentConfig: MirrorConfig = { ...DEFAULT_CONFIG };

/**
 * Get the current mirror configuration.
 */
export function getMirrorConfig(): MirrorConfig {
    return { ...currentConfig };
}

/**
 * Set mirror configuration.
 * Call this at app startup with the actual endpoint URLs.
 */
export function setMirrorConfig(config: Partial<MirrorConfig>): void {
    currentConfig = { ...currentConfig, ...config };
}

/**
 * Get the current active (healthiest) endpoint.
 * Prefers primary if healthy, falls back to mirrors.
 */
export function getActiveEndpoint(): string {
    const primaryStatus = getEndpointStatus(currentConfig.primary);
    if (primaryStatus.health !== 'down') {
        return currentConfig.primary;
    }

    // Find first healthy/degraded mirror
    for (const mirror of currentConfig.mirrors) {
        const mirrorStatus = getEndpointStatus(mirror);
        if (mirrorStatus.health !== 'down') {
            return mirror;
        }
    }

    // All down — try primary anyway (it may recover)
    return currentConfig.primary;
}

/**
 * Get health status for all endpoints.
 */
export function getAllEndpointStatus(): EndpointStatus[] {
    const allEndpoints = [currentConfig.primary, ...currentConfig.mirrors];
    return allEndpoints.map(getEndpointStatus);
}

/**
 * Resilient fetch with automatic mirror failover.
 *
 * 1. Try primary endpoint with retries
 * 2. On failure, try each mirror endpoint with retries
 * 3. Returns the first successful response
 * 4. Throws if all endpoints and retries exhausted
 *
 * @param path - API path (e.g., "/report", "/feed")
 * @param options - Standard fetch options
 * @returns FetchResult with the response and metadata
 */
export async function resilientFetch(
    path: string,
    options: RequestInit = {}
): Promise<FetchResult> {
    const config = currentConfig;
    const allEndpoints = [config.primary, ...config.mirrors];
    const failedEndpoints: string[] = [];
    let totalAttempts = 0;

    // Sort endpoints: healthy first, then degraded, then down
    // Spread to avoid mutating the original array on subsequent calls
    const sortedEndpoints = [...allEndpoints].sort((a, b) => {
        const healthOrder: Record<EndpointHealth, number> = { healthy: 0, degraded: 1, down: 2 };
        return healthOrder[getEndpointStatus(a).health] - healthOrder[getEndpointStatus(b).health];
    });

    for (const endpoint of sortedEndpoints) {
        totalAttempts++;
        const response = await tryEndpoint(endpoint, path, options, config);

        if (response) {
            return {
                response,
                endpoint,
                attempts: totalAttempts,
                failedEndpoints,
            };
        }

        failedEndpoints.push(endpoint);
    }

    // All endpoints failed
    throw new Error(
        `All endpoints failed after ${totalAttempts} attempts. ` +
        `Failed: ${failedEndpoints.join(', ')}. ` +
        `Last errors: ${failedEndpoints.map(e => getEndpointStatus(e).lastError).join('; ')}`
    );
}

/**
 * Reset all endpoint health status.
 * Useful for testing or manual recovery.
 */
export function resetEndpointHealth(): void {
    endpointHealth.clear();
}
