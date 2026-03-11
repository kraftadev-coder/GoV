/**
 * OpinionComposer — Text-only post form for the Social lane.
 *
 * Allows any user (including Junior Witnesses with 0 reputation)
 * to share opinions without needing camera/media capture.
 * This is the primary way new users participate on the platform.
 *
 * Source:
 * - Feature Goal Matrix §"Interact and air opinions"
 * - User feedback: Social posts should be text-only, no camera required
 */

import React, { useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './OpinionComposer.css';

/** API base */
const API_BASE = import.meta.env.VITE_API_BASE || '';

/** Simple SHA-256 hash for content deduplication */
async function hashText(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text + Date.now().toString());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

type ComposerStatus = 'idle' | 'submitting' | 'success' | 'error';

interface OpinionComposerProps {
    /** Called after a successful post to refresh the feed */
    onPostSuccess?: () => void;
}

const OpinionComposer: React.FC<OpinionComposerProps> = ({ onPostSuccess }) => {
    const { session, awardPoints } = useAuth();
    const [text, setText] = useState('');
    const [status, setStatus] = useState<ComposerStatus>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const maxLength = 500;
    const canSubmit = text.trim().length >= 10 && text.length <= maxLength && status !== 'submitting';

    const handleSubmit = useCallback(async () => {
        if (!canSubmit || !session?.anonToken) return;

        setStatus('submitting');
        setErrorMsg('');

        try {
            const contentHash = await hashText(text.trim());
            const handle = session.handle || '@AnonymousWitness';

            const response = await fetch(`${API_BASE}/api/report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: '',
                    description: `${handle}: ${text.trim()}`,
                    lane: 'social',
                    contentHash,
                    geoLabel: 'Social',
                    deviceCountry: null,
                    mediaType: 'text',
                    anonToken: session.anonToken,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                setStatus('error');
                setErrorMsg(result.error || `Failed (HTTP ${response.status})`);
                return;
            }

            // Success
            awardPoints({ type: 'verified-report', basePoints: 50 });
            setText('');
            setStatus('success');

            // Reset success state after 3s
            setTimeout(() => setStatus('idle'), 3000);

            // Refresh feed
            onPostSuccess?.();
        } catch (err) {
            setStatus('error');
            setErrorMsg(err instanceof Error ? err.message : 'Network error — try again');
        }
    }, [canSubmit, session, text, awardPoints, onPostSuccess]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canSubmit) {
            handleSubmit();
        }
    }, [canSubmit, handleSubmit]);

    return (
        <div className="opinion-composer">
            <div className="opinion-composer__header">
                <span className="opinion-composer__icon">💬</span>
                <span className="opinion-composer__label">Share Your Opinion</span>
            </div>

            <div className="opinion-composer__body">
                <textarea
                    id="opinion-text-input"
                    className="opinion-composer__textarea"
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                        if (status !== 'idle') setStatus('idle');
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="What's on your mind? Share your thoughts on civic issues..."
                    maxLength={maxLength}
                    rows={3}
                    disabled={status === 'submitting'}
                    aria-label="Write your opinion"
                />

                <div className="opinion-composer__footer">
                    <span className={`opinion-composer__count ${text.length > maxLength * 0.9 ? 'opinion-composer__count--warn' : ''}`}>
                        {text.length}/{maxLength}
                    </span>

                    <div className="opinion-composer__actions">
                        {status === 'success' && (
                            <span className="opinion-composer__success">✓ Posted!</span>
                        )}
                        {status === 'error' && (
                            <span className="opinion-composer__error" title={errorMsg}>⚠ {errorMsg}</span>
                        )}

                        <button
                            type="button"
                            id="post-opinion-btn"
                            className="opinion-composer__submit"
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                        >
                            {status === 'submitting' ? (
                                <span className="opinion-composer__spinner">⏳</span>
                            ) : (
                                'Post Opinion'
                            )}
                        </button>
                    </div>
                </div>

                <p className="opinion-composer__hint">
                    Min 10 characters • Ctrl+Enter to submit • Protected by <strong>Amnesia Protocol</strong>
                </p>
            </div>
        </div>
    );
};

export default OpinionComposer;
