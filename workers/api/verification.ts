/**
 * Module 5: Dual-Key Verification Logic
 *
 * Implements Security Protocol §2.1:
 * - Key A (Network): Cloudflare Edge Location (CF-IPCountry)
 * - Key B (Device): Browser Geolocation API country
 *
 * If both match → "witness-verified" (Emerald Badge)
 * If mismatch (VPN) → "remote-verified" (still accepted, transparent)
 *
 * "We verify the Location, not the User."
 */

/* ─── Types ─── */

export type VerificationStatus = 'witness-verified' | 'remote-verified' | 'pending';

export interface VerificationResult {
    /** The final verification status */
    status: VerificationStatus;
    /** Network-level country (from CF-IPCountry via headerPurge) */
    networkCountry: string | null;
    /** Device-level country (from Browser Geolocation, sent by client) */
    deviceCountry: string | null;
    /** Whether both keys matched */
    keysMatch: boolean;
    /** Human-readable reason */
    reason: string;
}

/* ─── Constants ─── */

/** Minimum country code length for valid ISO 3166-1 alpha-2 */
const COUNTRY_CODE_RE = /^[A-Z]{2}$/;

/** Countries that should be flagged for additional review */
const HIGH_RISK_ORIGINS = ['XX', 'T1'] as const;

/* ─── Core Functions ─── */

/**
 * Normalize a country code for comparison.
 * Returns null for invalid/sentinel values.
 */
export function normalizeCountryCode(code: string | null | undefined): string | null {
    if (!code) return null;
    const normalized = code.trim().toUpperCase();

    // Reject Cloudflare sentinel values
    if (HIGH_RISK_ORIGINS.includes(normalized as typeof HIGH_RISK_ORIGINS[number])) {
        return null;
    }

    // Validate ISO 3166-1 alpha-2 format
    if (!COUNTRY_CODE_RE.test(normalized)) {
        return null;
    }

    return normalized;
}

/**
 * Perform Dual-Key Verification.
 *
 * Compares network-level country (from Cloudflare edge) against
 * device-level country (from Browser Geolocation API).
 *
 * @param networkCountry - Country from CF-IPCountry header (Key A)
 * @param deviceCountry  - Country from client-side Geolocation (Key B)
 * @returns VerificationResult with status and reasoning
 */
export function verifyDualKey(
    networkCountry: string | null,
    deviceCountry: string | null
): VerificationResult {
    const normalizedNetwork = normalizeCountryCode(networkCountry);
    const normalizedDevice = normalizeCountryCode(deviceCountry);

    // Case 1: Both keys missing — cannot verify, stay pending
    if (!normalizedNetwork && !normalizedDevice) {
        return {
            status: 'pending',
            networkCountry: normalizedNetwork,
            deviceCountry: normalizedDevice,
            keysMatch: false,
            reason: 'Both network and device location unavailable — verification pending',
        };
    }

    // Case 2: Only one key available — remote verified (partial data)
    if (!normalizedNetwork || !normalizedDevice) {
        return {
            status: 'remote-verified',
            networkCountry: normalizedNetwork,
            deviceCountry: normalizedDevice,
            keysMatch: false,
            reason: normalizedNetwork
                ? 'Device location unavailable — verified via network only'
                : 'Network location unavailable — verified via device only',
        };
    }

    // Case 3: Both keys present — compare
    const keysMatch = normalizedNetwork === normalizedDevice;

    if (keysMatch) {
        return {
            status: 'witness-verified',
            networkCountry: normalizedNetwork,
            deviceCountry: normalizedDevice,
            keysMatch: true,
            reason: `Dual-Key match: both keys report ${normalizedNetwork} — Witness Verified (Emerald Badge)`,
        };
    }

    // Case 4: Keys mismatch (VPN or travel)
    return {
        status: 'remote-verified',
        networkCountry: normalizedNetwork,
        deviceCountry: normalizedDevice,
        keysMatch: false,
        reason: `Dual-Key mismatch: network=${normalizedNetwork}, device=${normalizedDevice} — Remote Verified (VPN detected)`,
    };
}

/**
 * Calculate the witness score based on verification result
 * and user's existing reputation.
 *
 * Witness-verified reports get full score boost.
 * Remote-verified get a reduced boost (still valuable, just less trusted).
 */
export function calculateWitnessScore(
    verificationStatus: VerificationStatus,
    existingReputationPoints: number
): number {
    const baseScore = Math.min(existingReputationPoints, 10000); // Cap at 10k

    switch (verificationStatus) {
        case 'witness-verified':
            // Full trust: reputation + location bonus
            return Math.floor(baseScore * 1.0) + 100;
        case 'remote-verified':
            // Partial trust: reputation only, no location bonus
            return Math.floor(baseScore * 0.5) + 25;
        case 'pending':
            // No trust signal yet
            return 0;
        default:
            return 0;
    }
}

export default verifyDualKey;
