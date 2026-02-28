/**
 * ContentModerationPanel — Module 7
 *
 * Displays flagged reports pending peer review.
 * Provides quick actions: Approve / Reject / Escalate.
 */

import { useState } from 'react';
import type { FlaggedReport, ModerationAction } from './adminTypes';

interface ContentModerationPanelProps {
    reports: FlaggedReport[];
    loading: boolean;
    onModerate: (reportId: string, action: ModerationAction) => Promise<void>;
}

export function ContentModerationPanel({ reports, loading, onModerate }: ContentModerationPanelProps) {
    const [processingId, setProcessingId] = useState<string | null>(null);

    const handleAction = async (reportId: string, action: ModerationAction) => {
        setProcessingId(reportId);
        try {
            await onModerate(reportId, action);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="admin-panel panel--wide">
                <h2><span className="panel-icon">🛡️</span> Content Moderation</h2>
                <div className="admin-loading">Loading moderation queue</div>
            </div>
        );
    }

    return (
        <div className="admin-panel panel--wide" id="content-moderation-panel">
            <h2>
                <span className="panel-icon">🛡️</span> Content Moderation
                {reports.length > 0 && (
                    <span className="budget-alert warning" style={{ marginLeft: 'auto' }}>
                        {reports.length} pending
                    </span>
                )}
            </h2>

            {reports.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">✅</div>
                    <div>No flagged content</div>
                </div>
            ) : (
                <ul className="moderation-list" role="list" aria-label="Flagged reports queue">
                    {reports.map((report) => (
                        <li key={report.reportId} className="moderation-item">
                            <div className="report-info">
                                <div className="report-id" title={report.reportId}>
                                    {report.reportId.substring(0, 8)}...
                                </div>
                                <div className="report-meta">
                                    <span className="flagged-badge">FLAGGED</span>
                                    <span>{report.mediaType.toUpperCase()}</span>
                                    <span> • </span>
                                    <span>{report.geoLabel}</span>
                                    <span> • </span>
                                    <span>{report.verificationStatus}</span>
                                </div>
                                <div className="report-meta" style={{ marginTop: '2px' }}>
                                    <span>Hash: {report.contentHash.substring(0, 16)}...</span>
                                    <span> • </span>
                                    <span>Score: {report.witnessScore}</span>
                                    <span> • </span>
                                    <span>{new Date(report.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="moderation-actions">
                                <button
                                    className="mod-btn approve"
                                    onClick={() => handleAction(report.reportId, 'approve')}
                                    disabled={processingId === report.reportId}
                                    aria-label={`Approve report ${report.reportId.substring(0, 8)}`}
                                >
                                    Approve
                                </button>
                                <button
                                    className="mod-btn reject"
                                    onClick={() => handleAction(report.reportId, 'reject')}
                                    disabled={processingId === report.reportId}
                                    aria-label={`Reject report ${report.reportId.substring(0, 8)}`}
                                >
                                    Reject
                                </button>
                                <button
                                    className="mod-btn escalate"
                                    onClick={() => handleAction(report.reportId, 'escalate')}
                                    disabled={processingId === report.reportId}
                                    aria-label={`Escalate report ${report.reportId.substring(0, 8)}`}
                                >
                                    Escalate
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default ContentModerationPanel;
