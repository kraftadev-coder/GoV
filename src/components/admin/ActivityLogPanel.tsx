/**
 * ActivityLogPanel — Module 7
 *
 * Displays the last 50 platform events in chronological order.
 * Each entry: timestamp (JetBrains Mono), event type, geo-label.
 * No PII — references anon_token hashes, never real identities.
 */


import type { ActivityEvent } from './adminTypes';

interface ActivityLogPanelProps {
    events: ActivityEvent[];
    loading: boolean;
}

/**
 * Classify event type for CSS styling.
 */
function getEventCategory(eventType: string): string {
    if (eventType.startsWith('report_')) return 'report';
    if (eventType.includes('approved') || eventType.includes('rejected') || eventType.includes('escalated')) return 'moderation';
    if (eventType.startsWith('user_')) return 'user';
    return 'system';
}

/**
 * Human-readable event labels.
 */
function formatEventType(eventType: string): string {
    const labels: Record<string, string> = {
        'report_submitted': 'NEW REPORT',
        'report_verified': 'VERIFIED',
        'report_flagged': 'FLAGGED',
        'report_approved': 'APPROVED',
        'report_rejected': 'REJECTED',
        'report_escalated': 'ESCALATED',
        'user_registered': 'NEW USER',
        'user_level_up': 'LEVEL UP',
        'rate_limit_hit': 'RATE LIMIT',
    };
    return labels[eventType] ?? eventType.toUpperCase().replace(/_/g, ' ');
}

/**
 * Format timestamp for display.
 */
function formatTimestamp(isoString: string): string {
    try {
        const date = new Date(isoString);
        return date.toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
    } catch {
        return isoString;
    }
}

export function ActivityLogPanel({ events, loading }: ActivityLogPanelProps) {
    if (loading) {
        return (
            <div className="admin-panel panel--wide">
                <h2><span className="panel-icon">📋</span> Activity Log</h2>
                <div className="admin-loading">Loading activity log</div>
            </div>
        );
    }

    return (
        <div className="admin-panel panel--wide" id="activity-log-panel">
            <h2>
                <span className="panel-icon">📋</span> Activity Log
                <span style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--font-data)',
                    fontSize: '0.625rem',
                    color: '#8B949E',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                }}>
                    Last {events.length} events
                </span>
            </h2>

            {events.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📝</div>
                    <div>No activity recorded yet</div>
                </div>
            ) : (
                <ul className="activity-feed" role="log" aria-label="Platform activity log">
                    {events.map((event) => {
                        const category = getEventCategory(event.eventType);
                        return (
                            <li key={event.eventId} className="activity-item">
                                <span className="activity-timestamp">
                                    {formatTimestamp(event.createdAt)}
                                </span>
                                <span className={`activity-type ${category}`}>
                                    {formatEventType(event.eventType)}
                                </span>
                                <span className="activity-detail">
                                    {event.targetId}
                                    <span className="activity-geo">
                                        {event.geoLabel}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export default ActivityLogPanel;
