/**
 * headerPurge.ts — Amnesia Protocol: IP Header Purging Middleware
 *
 * Implements Security Protocol §1.1:
 * - Extracts CF-IPCountry for geo-verification
 * - Deletes x-real-ip, cf-connecting-ip, cf-ipcountry headers
 * - Returns sanitized request + extracted country code
 *
 * The Worker treats IP addresses as "Toxic Waste" — extract what's
 * needed for verification, then destroy the rest immediately.
 */

/* ─── Types ─── */

export interface PurgeResult {
    /** Sanitized request with PII headers removed */
    sanitizedRequest: Request;
    /** Extracted ISO 3166-1 alpha-2 country code (e.g., "NG") — the ONLY data kept */
    countryCode: string | null;
    /** Number of toxic headers that were found and removed */
    purgedCount: number;
}

/**
 * Headers considered PII ("Toxic Waste") that must be purged
 * before any processing occurs.
 *
 * Comprehensive list covering Cloudflare, reverse proxies, and CDNs.
 */
export const TOXIC_HEADERS = [
    'x-real-ip',
    'cf-connecting-ip',
    'x-forwarded-for',
    'true-client-ip',
    'x-client-ip',
    'x-cluster-client-ip',
    'forwarded',
    'x-forwarded',
    'cf-pseudo-ipv4',
] as const;

/**
 * Headers that leak request metadata (non-IP but still fingerprintable).
 * These are purged after TOXIC_HEADERS for defense-in-depth.
 */
export const METADATA_HEADERS = [
    'cf-ray',
    'cf-visitor',
    'cf-worker',
    'cdn-loop',
] as const;

/**
 * Header used for geo-verification (extracted then deleted).
 */
export const GEO_HEADER = 'cf-ipcountry';

/** ISO 3166-1 alpha-2 country code pattern */
const COUNTRY_CODE_RE = /^[A-Z]{2}$/;

/* ─── Core Functions ─── */

/**
 * Extract the country code from CF-IPCountry header.
 * This is the ONLY piece of location data we retain,
 * and only for Dual-Key verification (Security Protocol §2.1).
 *
 * @param request - The incoming Request object
 * @returns ISO 3166-1 alpha-2 country code, or null
 */
export function extractGeoCountry(request: Request): string | null {
    const raw = request.headers.get(GEO_HEADER);
    if (!raw) return null;

    const country = raw.trim().toUpperCase();

    // Reject Cloudflare sentinel values and malformed codes
    if (country === 'XX' || country === 'T1' || !COUNTRY_CODE_RE.test(country)) {
        return null;
    }

    return country;
}

/**
 * Purge all PII-related headers from the request.
 * After this, the request contains ZERO identifying information.
 *
 * @param request - The incoming Request object
 * @returns Object with new Request (clean headers) and count of headers purged
 */
export function purgeHeaders(request: Request): { cleaned: Request; purgedCount: number } {
    // Create mutable copy of headers
    const sanitizedHeaders = new Headers(request.headers);
    let purgedCount = 0;

    // Delete all toxic headers (IP addresses)
    for (const header of TOXIC_HEADERS) {
        if (sanitizedHeaders.has(header)) {
            sanitizedHeaders.delete(header);
            purgedCount++;
        }
    }

    // Delete metadata headers (fingerprinting vectors)
    for (const header of METADATA_HEADERS) {
        if (sanitizedHeaders.has(header)) {
            sanitizedHeaders.delete(header);
            purgedCount++;
        }
    }

    // Delete the geo header (already extracted)
    if (sanitizedHeaders.has(GEO_HEADER)) {
        sanitizedHeaders.delete(GEO_HEADER);
        purgedCount++;
    }

    // Return a new Request with clean headers
    const cleaned = new Request(request.url, {
        method: request.method,
        headers: sanitizedHeaders,
        body: request.body,
        redirect: request.redirect,
    });

    return { cleaned, purgedCount };
}

/**
 * Full Amnesia header processing pipeline:
 * 1. Extract geo-country for verification
 * 2. Purge ALL PII headers
 * 3. Return sanitized request + country code
 *
 * Usage in Worker:
 * ```ts
 * const { sanitizedRequest, countryCode } = amnesiaHeaderPurge(request);
 * // countryCode is "NG" or null
 * // sanitizedRequest has ZERO IP data
 * ```
 */
export function amnesiaHeaderPurge(request: Request): PurgeResult {
    // Step 1: Extract country BEFORE purging (reads cf-ipcountry)
    const countryCode = extractGeoCountry(request);

    // Step 2: Purge ALL identifying headers
    const { cleaned, purgedCount } = purgeHeaders(request);

    return { sanitizedRequest: cleaned, countryCode, purgedCount };
}

/**
 * Verify that a request has been properly purged.
 * Use as a safety check before any downstream processing.
 *
 * @param request - The request to validate
 * @returns true if NO toxic or metadata headers remain
 */
export function verifyPurged(request: Request): boolean {
    for (const header of TOXIC_HEADERS) {
        if (request.headers.has(header)) {
            return false;
        }
    }
    for (const header of METADATA_HEADERS) {
        if (request.headers.has(header)) {
            return false;
        }
    }
    // Also check geo header is gone
    if (request.headers.has(GEO_HEADER)) {
        return false;
    }
    return true;
}

export default amnesiaHeaderPurge;
