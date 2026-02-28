/**
 * Module 2: Crypto Handle Component
 *
 * Displays the user's anonymous handle and reputation level badge.
 * Optional persistent handle (e.g., @LekkiWitness) with reputation badge.
 *
 * Source: Implementation Plan §Module 2, Feature Goal Matrix §"Option to create an account"
 */

import React, { useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../ui';
import { getLevelProgress, getPointsToNextLevel } from '../../lib/auth/reputationEngine';
import './CryptoHandle.css';

interface CryptoHandleProps {
    /** Show handle editor inline */
    editable?: boolean;
    /** Show full reputation details */
    showDetails?: boolean;
    className?: string;
}

const CryptoHandleInner: React.FC<CryptoHandleProps> = ({
    editable = false,
    showDetails = false,
    className = '',
}) => {
    const { session, reputation, setHandle } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [handleInput, setHandleInput] = useState('');

    const handleSave = useCallback(() => {
        const trimmed = handleInput.trim();
        if (trimmed.length >= 3) {
            setHandle(trimmed);
            setIsEditing(false);
            setHandleInput('');
        }
    }, [handleInput, setHandle]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setIsEditing(false);
        },
        [handleSave]
    );

    if (!session || !reputation) return null;

    const displayHandle = session.handle ?? '@AnonymousWitness';
    const level = reputation.level;
    const progress = getLevelProgress(reputation.points);
    const toNext = getPointsToNextLevel(reputation.points);

    return (
        <div className={`crypto-handle ${className}`} id="crypto-handle">
            {/* Avatar */}
            <div className="crypto-handle__avatar" aria-hidden="true">
                <span className="crypto-handle__avatar-icon">◈</span>
            </div>

            {/* Handle + Badge */}
            <div className="crypto-handle__info">
                <div className="crypto-handle__row">
                    {isEditing ? (
                        <div className="crypto-handle__edit">
                            <input
                                type="text"
                                value={handleInput}
                                onChange={(e) => setHandleInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="@YourHandle"
                                maxLength={20}
                                className="crypto-handle__input"
                                autoFocus
                                id="handle-input"
                                aria-label="Set your crypto handle"
                            />
                            <button
                                type="button"
                                onClick={handleSave}
                                className="crypto-handle__save-btn"
                                aria-label="Save handle"
                            >
                                ✓
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="crypto-handle__cancel-btn"
                                aria-label="Cancel editing"
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <>
                            <h3 className="crypto-handle__name">{displayHandle}</h3>
                            {editable && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditing(true);
                                        setHandleInput(session.handle?.replace('@', '') ?? '');
                                    }}
                                    className="crypto-handle__edit-btn"
                                    aria-label="Edit handle"
                                >
                                    ✎
                                </button>
                            )}
                        </>
                    )}
                </div>

                <div className="crypto-handle__badges">
                    <Badge variant={level === 'advanced' ? 'emerald' : 'amber'}>
                        {level === 'advanced' ? 'Advanced Witness' : 'Junior Witness'}
                    </Badge>
                    {reputation.canUploadVideo && (
                        <Badge variant="emerald" pulse>
                            Video Enabled
                        </Badge>
                    )}
                </div>

                <p className="crypto-handle__sub data-label">
                    No PII stored — Zero-Knowledge identity
                </p>
            </div>

            {/* Detailed reputation stats */}
            {showDetails && (
                <div className="crypto-handle__details">
                    {/* Score */}
                    <div className="crypto-handle__score">
                        <span className="crypto-handle__score-value">{reputation.points.toLocaleString()}</span>
                        <span className="crypto-handle__score-label data-label">Points</span>
                    </div>

                    {/* Progress bar */}
                    {level === 'junior' && (
                        <div className="crypto-handle__progress">
                            <div className="crypto-handle__progress-bar">
                                <div
                                    className="crypto-handle__progress-fill"
                                    style={{ width: `${Math.round(progress * 100)}%` }}
                                    role="progressbar"
                                    aria-valuenow={reputation.points}
                                    aria-valuemin={0}
                                    aria-valuemax={1000}
                                    aria-label={`Reputation progress: ${reputation.points} of 1000 points`}
                                />
                            </div>
                            <span className="crypto-handle__progress-text data-label">
                                {toNext.toLocaleString()} pts to Advanced
                            </span>
                        </div>
                    )}

                    {/* Stats row */}
                    <div className="crypto-handle__stats">
                        <div className="crypto-handle__stat">
                            <span className="crypto-handle__stat-value">{reputation.verifiedReports}</span>
                            <span className="crypto-handle__stat-label data-label">Reports</span>
                        </div>
                        <div className="crypto-handle__stat">
                            <span className="crypto-handle__stat-value">{reputation.peerUpvotes}</span>
                            <span className="crypto-handle__stat-label data-label">Upvotes</span>
                        </div>
                        <div className="crypto-handle__stat">
                            <span className="crypto-handle__stat-value">
                                {reputation.canUploadVideo ? '✓' : '✕'}
                            </span>
                            <span className="crypto-handle__stat-label data-label">Video</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/** Memoized to prevent re-renders when parent context changes but props are stable */
export const CryptoHandle = React.memo(CryptoHandleInner);
