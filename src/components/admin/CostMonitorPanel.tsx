/**
 * CostMonitorPanel — Module 7
 *
 * Monitors Cloudflare free tier usage:
 * - R2 storage (current + projected monthly cost)
 * - D1 reads/writes (daily vs 5M/100K limits)
 * - Worker invocations (daily vs 100K/day)
 * - Budget alerts: amber at 70%, red at 90%
 *
 * Source: Security Protocol §3 (Cost Defense)
 */


import type { PlatformStats } from './adminTypes';
import { FREE_TIER_LIMITS } from './adminTypes';

interface CostMonitorPanelProps {
    stats: PlatformStats | null;
    loading: boolean;
}

/**
 * Get budget alert level based on percentage used.
 */
function getBudgetStatus(pct: number): { level: 'safe' | 'warning' | 'critical'; label: string } {
    if (pct >= 90) return { level: 'critical', label: 'CRITICAL' };
    if (pct >= 70) return { level: 'warning', label: 'WARNING' };
    return { level: 'safe', label: 'OK' };
}

export function CostMonitorPanel({ stats, loading }: CostMonitorPanelProps) {
    if (loading) {
        return (
            <div className="admin-panel">
                <h2><span className="panel-icon">💰</span> Cost Monitor</h2>
                <div className="admin-loading">Loading cost data</div>
            </div>
        );
    }

    const s = stats ?? {
        totalReports: 0, reportsToday: 0, totalUsers: 0,
        flaggedCount: 0, verifiedCount: 0, activeReports: 0,
        witnessReports: 0, socialReports: 0, juniorUsers: 0,
        advancedUsers: 0, rateLimitHitsToday: 0, storageBytes: 0,
    };

    // R2 Storage
    const storageGB = s.storageBytes / (1024 * 1024 * 1024);
    const storagePct = (storageGB / FREE_TIER_LIMITS.r2StorageGB) * 100;
    const storageStatus = getBudgetStatus(storagePct);
    const monthlyCost = storageGB * 0.015; // $0.015/GB/month for R2

    // D1 — estimate reads and writes from total queries
    // In production, these would come from Cloudflare analytics API
    const estimatedReads = s.totalReports * 5; // ~5 reads per report (feed queries)
    const estimatedWrites = s.reportsToday * 3; // ~3 writes per report
    const readPct = (estimatedReads / FREE_TIER_LIMITS.d1ReadsPerDay) * 100;
    const writePct = (estimatedWrites / FREE_TIER_LIMITS.d1WritesPerDay) * 100;
    const readStatus = getBudgetStatus(readPct);
    const writeStatus = getBudgetStatus(writePct);

    // Workers
    const estimatedInvocations = (s.reportsToday * 4) + (s.totalUsers * 2); // rough estimate
    const invocationPct = (estimatedInvocations / FREE_TIER_LIMITS.workerInvocationsPerDay) * 100;
    const invocationStatus = getBudgetStatus(invocationPct);

    return (
        <div className="admin-panel" id="cost-monitor-panel">
            <h2><span className="panel-icon">💰</span> Cost Monitor</h2>

            <h3>R2 Storage</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">{storageGB.toFixed(2)} GB / {FREE_TIER_LIMITS.r2StorageGB} GB</span>
                <span className={`budget-alert ${storageStatus.level}`}>
                    {storageStatus.label}
                </span>
            </div>
            <div className="meter-bar">
                <div
                    className={`meter-fill ${storageStatus.level === 'critical' ? 'red' : storageStatus.level === 'warning' ? 'amber' : 'emerald'}`}
                    style={{ width: `${Math.min(storagePct, 100)}%` }}
                />
            </div>
            <div className="meter-label">
                <span>Projected: ${monthlyCost.toFixed(2)}/mo</span>
                <span>{storagePct.toFixed(1)}% used</span>
            </div>

            <h3>D1 Reads / Day</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">
                    {estimatedReads.toLocaleString()} / {(FREE_TIER_LIMITS.d1ReadsPerDay / 1_000_000).toFixed(0)}M
                </span>
                <span className={`budget-alert ${readStatus.level}`}>
                    {readStatus.label}
                </span>
            </div>
            <div className="meter-bar">
                <div
                    className={`meter-fill ${readStatus.level === 'critical' ? 'red' : readStatus.level === 'warning' ? 'amber' : 'emerald'}`}
                    style={{ width: `${Math.min(readPct, 100)}%` }}
                />
            </div>

            <h3>D1 Writes / Day</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">
                    {estimatedWrites.toLocaleString()} / {(FREE_TIER_LIMITS.d1WritesPerDay / 1_000).toFixed(0)}K
                </span>
                <span className={`budget-alert ${writeStatus.level}`}>
                    {writeStatus.label}
                </span>
            </div>
            <div className="meter-bar">
                <div
                    className={`meter-fill ${writeStatus.level === 'critical' ? 'red' : writeStatus.level === 'warning' ? 'amber' : 'emerald'}`}
                    style={{ width: `${Math.min(writePct, 100)}%` }}
                />
            </div>

            <h3>Worker Invocations / Day</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">
                    {estimatedInvocations.toLocaleString()} / {(FREE_TIER_LIMITS.workerInvocationsPerDay / 1_000).toFixed(0)}K
                </span>
                <span className={`budget-alert ${invocationStatus.level}`}>
                    {invocationStatus.label}
                </span>
            </div>
            <div className="meter-bar">
                <div
                    className={`meter-fill ${invocationStatus.level === 'critical' ? 'red' : invocationStatus.level === 'warning' ? 'amber' : 'emerald'}`}
                    style={{ width: `${Math.min(invocationPct, 100)}%` }}
                />
            </div>
        </div>
    );
}

export default CostMonitorPanel;
