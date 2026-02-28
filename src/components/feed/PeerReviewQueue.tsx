/**
 * Module 6: Peer Review Queue — Community review of flagged submissions
 *
 * From Security Protocol §2.2:
 * Submissions flagged by the Audio Gate (deepfake detection) go to a
 * community peer-review queue where Advanced Witnesses can vote to
 * verify or reject.
 *
 * Source:
 * - Implementation Plan §Module 6
 * - Security Protocol §2.2 "Deepfake & AI Audio Gating"
 */

import { useState, useCallback, useMemo } from 'react';
import './PeerReviewQueue.css';

/* ─── Types ─── */

export type ReviewDecision = 'verify' | 'reject';

export interface FlaggedSubmission {
    /** Unique report ID */
    reportId: string;
    /** Why it was flagged */
    flagReason: string;
    /** Media type: audio, image, or video */
    mediaType: 'audio' | 'image' | 'video';
    /** Media URL (from R2 or local) */
    mediaUrl: string | null;
    /** Anonymized geo-label */
    geoLabel: string;
    /** Content hash (SHA-256) */
    contentHash: string;
    /** Noise floor dB level from audio gate analysis */
    noiseFloorDb: number | null;
    /** Submission timestamp (ISO 8601) */
    createdAt: string;
    /** Current votes */
    votes: ReviewVote[];
}

export interface ReviewVote {
    /** Voter's anon token (hashed) */
    voterToken: string;
    /** Vote decision */
    decision: ReviewDecision;
    /** Vote timestamp */
    votedAt: string;
}

export interface PeerReviewQueueProps {
    /** List of flagged submissions to review */
    submissions: FlaggedSubmission[];
    /** Current user's reputation level */
    userLevel: 'junior' | 'advanced';
    /** Current user's anon token */
    userToken: string;
    /** Callback when user votes on a submission */
    onVote: (reportId: string, decision: ReviewDecision) => void;
    /** Whether the queue is loading */
    isLoading?: boolean;
}

/* ─── Helpers ─── */

/**
 * Check if a user can participate in peer review.
 * Only Advanced Witnesses (1000+ reputation) can vote.
 */
export function canReview(level: 'junior' | 'advanced'): boolean {
    return level === 'advanced';
}

/**
 * Check if a user has already voted on a submission.
 */
export function hasVoted(votes: ReviewVote[], userToken: string): boolean {
    return votes.some(v => v.voterToken === userToken);
}

/**
 * Get vote counts for a submission.
 */
export function getVoteCounts(votes: ReviewVote[]): { verify: number; reject: number; total: number } {
    const verify = votes.filter(v => v.decision === 'verify').length;
    const reject = votes.filter(v => v.decision === 'reject').length;
    return { verify, reject, total: votes.length };
}

/**
 * Format relative time for display.
 */
function formatRelativeTime(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

/* ─── Component ─── */

/**
 * PeerReviewQueue — UI for community review of flagged submissions.
 *
 * - Displays flagged items with flag reason, media preview, and metadata
 * - Advanced Witnesses can vote: Verify or Reject
 * - Shows vote tally and community consensus
 * - Amber caution theme for flagged items (Editorial Brutalist design)
 */
export function PeerReviewQueue({
    submissions,
    userLevel,
    userToken,
    onVote,
    isLoading = false,
}: PeerReviewQueueProps) {
    const isAdvanced = canReview(userLevel);

    const sortedSubmissions = useMemo(
        () => [...submissions].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
        [submissions]
    );

    if (isLoading) {
        return (
            <div className="peer-review-queue" role="status" aria-label="Loading peer review queue">
                <div className="peer-review-loading">
                    <span className="data-label">SCANNING FLAGGED SUBMISSIONS...</span>
                </div>
            </div>
        );
    }

    return (
        <section className="peer-review-queue" aria-label="Peer Review Queue">
            {/* Header */}
            <div className="peer-review-header">
                <h3 className="peer-review-title">
                    <span className="peer-review-icon" aria-hidden="true">⚠</span>
                    Peer Review Queue
                </h3>
                <span className="peer-review-count data-label">
                    {submissions.length} FLAGGED
                </span>
            </div>

            {/* Access Gate */}
            {!isAdvanced && (
                <div className="peer-review-gate" role="alert">
                    <p className="peer-review-gate-text">
                        <strong>Advanced Witnesses Only</strong> — Reach 1,000 reputation points
                        to participate in peer review.
                    </p>
                </div>
            )}

            {/* Empty State */}
            {submissions.length === 0 && (
                <div className="peer-review-empty">
                    <span className="data-label">NO FLAGGED SUBMISSIONS</span>
                    <p>All submissions have passed automated checks.</p>
                </div>
            )}

            {/* Submission List */}
            <div className="peer-review-list" role="list">
                {sortedSubmissions.map((submission) => (
                    <FlaggedCard
                        key={submission.reportId}
                        submission={submission}
                        canVote={isAdvanced && !hasVoted(submission.votes, userToken)}
                        hasVoted={hasVoted(submission.votes, userToken)}
                        onVote={onVote}
                    />
                ))}
            </div>
        </section>
    );
}

/* ─── Flagged Card Sub-component ─── */

interface FlaggedCardProps {
    submission: FlaggedSubmission;
    canVote: boolean;
    hasVoted: boolean;
    onVote: (reportId: string, decision: ReviewDecision) => void;
}

function FlaggedCard({ submission, canVote, hasVoted: alreadyVoted, onVote }: FlaggedCardProps) {
    const [localVoted, setLocalVoted] = useState(false);
    const voteCounts = getVoteCounts(submission.votes);

    const handleVote = useCallback((decision: ReviewDecision) => {
        // Optimistic: immediately prevent double-voting via local state
        setLocalVoted(true);
        onVote(submission.reportId, decision);
    }, [onVote, submission.reportId]);

    const effectiveVoted = alreadyVoted || localVoted;

    return (
        <article
            className="flagged-card"
            role="listitem"
            aria-label={`Flagged submission ${submission.reportId.substring(0, 8)}`}
        >
            {/* Flag Banner */}
            <div className="flagged-banner">
                <span className="flagged-badge data-label">⚠ FLAGGED</span>
                <span className="flagged-time data-label">
                    {formatRelativeTime(submission.createdAt)}
                </span>
            </div>

            {/* Reason */}
            <p className="flagged-reason">{submission.flagReason}</p>

            {/* Metadata Grid */}
            <div className="flagged-meta">
                <div className="flagged-meta-item">
                    <span className="data-label">GEO</span>
                    <span className="flagged-meta-value">{submission.geoLabel}</span>
                </div>
                <div className="flagged-meta-item">
                    <span className="data-label">TYPE</span>
                    <span className="flagged-meta-value">{submission.mediaType.toUpperCase()}</span>
                </div>
                {submission.noiseFloorDb !== null && (
                    <div className="flagged-meta-item">
                        <span className="data-label">NOISE FLOOR</span>
                        <span className="flagged-meta-value mono">
                            {submission.noiseFloorDb.toFixed(1)}dB
                        </span>
                    </div>
                )}
                <div className="flagged-meta-item">
                    <span className="data-label">HASH</span>
                    <span className="flagged-meta-value data-hash" title={submission.contentHash}>
                        {submission.contentHash.substring(0, 12)}...
                    </span>
                </div>
            </div>

            {/* Vote Tally */}
            <div className="flagged-tally">
                <div className="tally-bar">
                    <div
                        className="tally-verify"
                        style={{
                            width: voteCounts.total > 0
                                ? `${(voteCounts.verify / voteCounts.total) * 100}%`
                                : '0%',
                        }}
                        aria-label={`${voteCounts.verify} verify votes`}
                    />
                    <div
                        className="tally-reject"
                        style={{
                            width: voteCounts.total > 0
                                ? `${(voteCounts.reject / voteCounts.total) * 100}%`
                                : '0%',
                        }}
                        aria-label={`${voteCounts.reject} reject votes`}
                    />
                </div>
                <div className="tally-counts">
                    <span className="tally-count-verify data-label">
                        ✓ {voteCounts.verify}
                    </span>
                    <span className="tally-count-total data-label">
                        {voteCounts.total} VOTES
                    </span>
                    <span className="tally-count-reject data-label">
                        ✕ {voteCounts.reject}
                    </span>
                </div>
            </div>

            {/* Vote Actions */}
            {canVote && !effectiveVoted && (
                <div className="flagged-actions">
                    <button
                        type="button"
                        className="vote-btn vote-verify"
                        onClick={() => handleVote('verify')}
                        disabled={effectiveVoted}
                        aria-label="Vote to verify this submission"
                    >
                        ✓ VERIFY
                    </button>
                    <button
                        type="button"
                        className="vote-btn vote-reject"
                        onClick={() => handleVote('reject')}
                        disabled={effectiveVoted}
                        aria-label="Vote to reject this submission"
                    >
                        ✕ REJECT
                    </button>
                </div>
            )}

            {effectiveVoted && (
                <div className="flagged-voted data-label">
                    ✓ YOU HAVE VOTED
                </div>
            )}
        </article>
    );
}

export default PeerReviewQueue;
