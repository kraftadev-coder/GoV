/**
 * Module 2 + Module 6: Reputation Engine
 *
 * Computes trust scores for anonymous users. Until Module 5 (D1 backend),
 * reputation is stored client-side in localStorage.
 *
 * Key rules from design docs:
 * - Points for verified reports + peer upvotes
 * - Location Diversity anti-Sybil: 100 same-tower votes = 1 point
 * - Level: Junior (0-999) → Advanced (1000+)
 * - Video upload gated: reputationScore >= 1000
 *
 * Module 6 enhancements:
 * - calculateLocationDiversity(): computes diversity factor from upvote locations
 * - computeSybilWeightedScore(): applies Location Diversity to a batch of upvotes
 * - LocationUpvote type for structured upvote data
 *
 * Source:
 * - Implementation Plan §Module 2 + §Module 6
 * - Feature Goal Matrix §"Video uploads" + §"Option to create an account"
 * - Security Protocol §4.3 (Sybil attack)
 */

import type { ReputationProfile, ReputationLevel, ScoreEvent } from './types';

/* ───────────────────── Constants ───────────────────── */

const STORAGE_KEY = 'cv_reputation';
const ADVANCED_THRESHOLD = 1000;

/** Base point values for different event types */
export const POINT_VALUES: Readonly<Record<string, number>> = Object.freeze({
    'verified-report': 150,
    'peer-upvote': 10,
    'sybil-upvote': 10, // Before diversity weighting
});

/* ───────────────────── Level Calculation ───────────────────── */

/**
 * Calculate reputation level from points.
 * Junior: 0–999, Advanced: 1000+
 */
export function calculateLevel(points: number): ReputationLevel {
    return points >= ADVANCED_THRESHOLD ? 'advanced' : 'junior';
}

/**
 * Check if the user can upload video (reputation-gated feature).
 * Feature Goal Matrix: "Unlocks 15s video proofing for users with high trust scores"
 */
export function canUploadVideo(points: number): boolean {
    return points >= ADVANCED_THRESHOLD;
}

/* ───────────────────── Sybil Defense ───────────────────── */

/**
 * Apply Location Diversity weighting to combat Sybil attacks.
 *
 * From Security Protocol §4.3:
 * "100 upvotes from the same cell tower count as 1 upvote.
 *  100 upvotes from different states count as 100."
 *
 * The `locationDiversityFactor` ranges from 0.01 (same tower) to 1.0 (fully diverse).
 */
export function applyLocationDiversity(
    basePoints: number,
    locationDiversityFactor: number
): number {
    // Clamp factor between 0.01 and 1.0
    const factor = Math.max(0.01, Math.min(1.0, locationDiversityFactor));
    return Math.floor(basePoints * factor);
}

/* ───────────────────── Module 6: Enhanced Location Diversity ───────────────────── */

/**
 * Represents an upvote with its source location.
 * Used for Sybil-weighted score computation.
 */
export interface LocationUpvote {
    /** Location identifier (cell tower ID, district name, or geo hash) */
    locationId: string;
    /** Base points for this upvote */
    basePoints: number;
}

/**
 * Calculate Location Diversity factor from a set of upvotes.
 *
 * From Security Protocol §4.3:
 * "100 upvotes from the same cell tower count as 1 upvote.
 *  100 upvotes from different states count as 100."
 *
 * Algorithm:
 * - Group upvotes by locationId
 * - uniqueLocations / totalUpvotes = diversity factor
 * - Clamped to [0.01, 1.0]
 *
 * Examples:
 * - 100 upvotes from 1 location  → factor = 1/100 = 0.01
 * - 100 upvotes from 50 locations → factor = 50/100 = 0.50
 * - 100 upvotes from 100 locations → factor = 1.0
 *
 * @param upvotes - Array of upvotes with location data
 * @returns Diversity factor between 0.01 and 1.0
 */
export function calculateLocationDiversity(upvotes: LocationUpvote[]): number {
    if (upvotes.length === 0) return 1.0;

    const uniqueLocations = new Set(upvotes.map(u => u.locationId));
    const factor = uniqueLocations.size / upvotes.length;

    // Clamp between 0.01 (same tower) and 1.0 (fully diverse)
    return Math.max(0.01, Math.min(1.0, factor));
}

/**
 * Compute Sybil-weighted score from a batch of location-tagged upvotes.
 *
 * Applies Location Diversity weighting to the total upvote points.
 * This is the primary anti-Sybil defense:
 *   - 100 same-tower upvotes × 10pts × 0.01 factor = 10 effective points
 *   - 100 diverse upvotes × 10pts × 1.0 factor = 1000 effective points
 *
 * @param upvotes - Array of upvotes with location data
 * @returns Total points after Sybil weighting
 */
export function computeSybilWeightedScore(upvotes: LocationUpvote[]): number {
    if (upvotes.length === 0) return 0;

    const diversityFactor = calculateLocationDiversity(upvotes);
    const totalBase = upvotes.reduce((sum, u) => sum + u.basePoints, 0);

    return applyLocationDiversity(totalBase, diversityFactor);
}

/* ───────────────────── Score Computation ───────────────────── */

/**
 * Compute points to award for a single score event.
 * Applies Sybil weighting for peer-upvote events.
 */
export function computeEventPoints(event: ScoreEvent): number {
    let points = event.basePoints;

    // Apply location diversity weighting for upvote events
    if (
        (event.type === 'peer-upvote' || event.type === 'sybil-upvote') &&
        event.locationDiversityFactor !== undefined
    ) {
        points = applyLocationDiversity(points, event.locationDiversityFactor);
    }

    return Math.max(0, points);
}

/* ───────────────────── Profile Management (Client-Side) ───────────────────── */

/**
 * Create a fresh reputation profile for a new anonymous user.
 */
export function createProfile(anonToken: string): ReputationProfile {
    const profile: ReputationProfile = {
        anonToken,
        points: 0,
        level: 'junior',
        verifiedReports: 0,
        peerUpvotes: 0,
        canUploadVideo: false,
    };
    saveProfile(profile);
    return profile;
}

/** Runtime type guard for loaded profiles */
function isValidProfile(obj: unknown): obj is ReputationProfile {
    if (!obj || typeof obj !== 'object') return false;
    const p = obj as Record<string, unknown>;
    return (
        typeof p.anonToken === 'string' &&
        typeof p.points === 'number' && Number.isFinite(p.points) && p.points >= 0 &&
        (p.level === 'junior' || p.level === 'advanced') &&
        typeof p.verifiedReports === 'number' &&
        typeof p.peerUpvotes === 'number' &&
        typeof p.canUploadVideo === 'boolean'
    );
}

/**
 * Load reputation profile from localStorage.
 * Returns null if not found, corrupt, or in private browsing mode.
 */
export function loadProfile(anonToken: string): ReputationProfile | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (!isValidProfile(parsed)) return null;
        // Only return if it matches the current session's token
        if (parsed.anonToken !== anonToken) return null;
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Save reputation profile to localStorage.
 * Silently fails in private browsing or when quota is exceeded.
 */
export function saveProfile(profile: ReputationProfile): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
        // Private browsing or quota exceeded — fail gracefully
    }
}

/**
 * Award points to a user's reputation profile.
 * Recalculates level and video gating after.
 */
export function awardPoints(
    profile: ReputationProfile,
    event: ScoreEvent
): ReputationProfile {
    const earned = computeEventPoints(event);

    const updated: ReputationProfile = {
        ...profile,
        points: profile.points + earned,
        verifiedReports:
            event.type === 'verified-report'
                ? profile.verifiedReports + 1
                : profile.verifiedReports,
        peerUpvotes:
            event.type === 'peer-upvote' || event.type === 'sybil-upvote'
                ? profile.peerUpvotes + 1
                : profile.peerUpvotes,
        level: calculateLevel(profile.points + earned),
        canUploadVideo: canUploadVideo(profile.points + earned),
    };

    saveProfile(updated);
    return updated;
}

/**
 * Get progress towards the next level.
 * Returns a value between 0 and 1.
 */
export function getLevelProgress(points: number): number {
    if (points >= ADVANCED_THRESHOLD) return 1;
    return points / ADVANCED_THRESHOLD;
}

/**
 * Get remaining points needed for next level.
 */
export function getPointsToNextLevel(points: number): number {
    if (points >= ADVANCED_THRESHOLD) return 0;
    return ADVANCED_THRESHOLD - points;
}
