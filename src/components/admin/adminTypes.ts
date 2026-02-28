/**
 * Admin Types — Module 7
 *
 * Shared types for admin dashboard components.
 * Mirrors the Worker API response shapes.
 */

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

export interface ActivityEvent {
    eventId: string;
    eventType: string;
    targetId: string;
    geoLabel: string;
    details: string;
    createdAt: string;
}

export type ModerationAction = 'approve' | 'reject' | 'escalate';

export interface AdminApiConfig {
    baseUrl: string;
    adminToken: string;
}

/**
 * Build headers for admin API requests.
 */
export function getAdminHeaders(token: string): HeadersInit {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };
}

/**
 * Free tier limits for Cloudflare services.
 */
export const FREE_TIER_LIMITS = {
    d1ReadsPerDay: 5_000_000,
    d1WritesPerDay: 100_000,
    workerInvocationsPerDay: 100_000,
    r2StorageGB: 10,
} as const;
