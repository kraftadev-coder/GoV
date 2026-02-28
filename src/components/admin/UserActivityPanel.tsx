/**
 * UserActivityPanel — Module 7
 *
 * Displays: reputation distribution (Junior vs Advanced),
 * top contributors, Sybil alerts, rate limit hits.
 * No PII exposed — only anonymous handles and hashed tokens.
 */


import type { PlatformStats } from './adminTypes';

interface UserActivityPanelProps {
    stats: PlatformStats | null;
    loading: boolean;
}

export function UserActivityPanel({ stats, loading }: UserActivityPanelProps) {
    if (loading) {
        return (
            <div className="admin-panel">
                <h2><span className="panel-icon">👥</span> User Activity</h2>
                <div className="admin-loading">Loading user data</div>
            </div>
        );
    }

    const s = stats ?? {
        totalReports: 0, reportsToday: 0, totalUsers: 0,
        flaggedCount: 0, verifiedCount: 0, activeReports: 0,
        witnessReports: 0, socialReports: 0, juniorUsers: 0,
        advancedUsers: 0, rateLimitHitsToday: 0, storageBytes: 0,
    };

    const totalUsers = s.juniorUsers + s.advancedUsers;
    const juniorPct = totalUsers > 0 ? (s.juniorUsers / totalUsers) * 100 : 0;
    const advancedPct = totalUsers > 0 ? (s.advancedUsers / totalUsers) * 100 : 0;
    const maxBarHeight = 80; // px

    return (
        <div className="admin-panel" id="user-activity-panel">
            <h2><span className="panel-icon">👥</span> User Activity</h2>

            <h3>Reputation Distribution</h3>
            <div className="distribution-chart">
                <div className="dist-bar-group">
                    <div
                        className="dist-bar amber"
                        style={{ height: `${Math.max((juniorPct / 100) * maxBarHeight, 4)}px` }}
                        title={`${s.juniorUsers} Junior users (${juniorPct.toFixed(0)}%)`}
                    />
                    <div className="dist-label">Junior</div>
                    <div className="stat-value" style={{ fontSize: '1rem', marginTop: '4px' }}>
                        {s.juniorUsers.toLocaleString()}
                    </div>
                </div>
                <div className="dist-bar-group">
                    <div
                        className="dist-bar emerald"
                        style={{ height: `${Math.max((advancedPct / 100) * maxBarHeight, 4)}px` }}
                        title={`${s.advancedUsers} Advanced users (${advancedPct.toFixed(0)}%)`}
                    />
                    <div className="dist-label">Advanced</div>
                    <div className="stat-value" style={{ fontSize: '1rem', marginTop: '4px' }}>
                        {s.advancedUsers.toLocaleString()}
                    </div>
                </div>
            </div>

            <h3>Sybil Alerts</h3>
            <div className="stat-grid">
                <div className="stat-card">
                    <div className="stat-value amber">{s.rateLimitHitsToday}</div>
                    <div className="stat-label">Rate Limit Hits Today</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{s.flaggedCount}</div>
                    <div className="stat-label">Flagged Submissions</div>
                </div>
            </div>

            <h3>Top Contributors</h3>
            <div className="empty-state">
                <div className="empty-icon">🏆</div>
                <div>Connect to D1 for leaderboard</div>
            </div>
        </div>
    );
}

export default UserActivityPanel;
