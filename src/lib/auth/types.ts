/**
 * Module 2: Zero-Knowledge Auth & Reputation Engine — Shared Types
 *
 * Source: Feature Goal Matrix §"Option to remain anonymous" + §"Option to create an account"
 *         Technical Blueprint §4.2 (anon_reputation table)
 *         Security Protocol §1 (Amnesia standard)
 */

/** Reputation levels — maps to D1 `anon_reputation.level` ENUM */
export type ReputationLevel = 'junior' | 'advanced';

/** Verification status for the Dual-Key system (Module 5 backend) */
export type VerificationStatus = 'witness-verified' | 'remote-verified' | 'pending';

/**
 * Anonymous user session — stored client-side only.
 * No email, phone, NIN, or IP ever stored.
 */
export interface AnonSession {
    /** Deterministic hash derived from device fingerprint (non-reversible) */
    anonToken: string;
    /** Optional persistent handle (e.g., @LekkiWitness) */
    handle: string | null;
    /** Session creation timestamp (ISO 8601) */
    createdAt: string;
    /** Short TTL — session expiry timestamp (ISO 8601) */
    expiresAt: string;
}

/**
 * Reputation profile — persisted in cookie, synced to D1 in Module 5.
 * Until backend exists, this lives entirely client-side.
 */
export interface ReputationProfile {
    anonToken: string;
    /** Total reputation points */
    points: number;
    /** Calculated level: Junior (0-999) → Advanced (1000+) */
    level: ReputationLevel;
    /** Number of verified reports submitted */
    verifiedReports: number;
    /** Number of peer upvotes received */
    peerUpvotes: number;
    /** Can this user upload video? (points >= 1000) */
    canUploadVideo: boolean;
}

/** Score event — used to compute incremental reputation changes */
export interface ScoreEvent {
    type: 'verified-report' | 'peer-upvote' | 'sybil-upvote';
    /** Points to award for this event */
    basePoints: number;
    /** Location diversity factor (0.01 – 1.0). Same-tower = 0.01 */
    locationDiversityFactor?: number;
}

/** Full auth state exposed to the React tree via AuthContext */
export interface AuthState {
    session: AnonSession | null;
    reputation: ReputationProfile | null;
    isLoading: boolean;
    /** Initialize or restore session */
    initSession: () => Promise<void>;
    /** Set or update the crypto handle */
    setHandle: (handle: string) => void;
    /** Award reputation points (offline-first, synced in Module 5) */
    awardPoints: (event: ScoreEvent) => void;
}
