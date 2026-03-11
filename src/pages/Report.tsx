/**
 * Module 3+5: Report Page
 *
 * The primary evidence submission page. Embeds the SubmissionFlow
 * component which handles camera capture, media processing, and submission.
 * Now wired to POST to /api/report Worker endpoint.
 *
 * Source:
 * - Implementation Plan §Module 3: "Report page with WitnessCam & SubmissionFlow"
 * - Feature Goal Matrix §"Blow whistle with proofs"
 */

import React, { useCallback, useState } from 'react';
import { Main } from '../components/ui';
import SubmissionFlow, { type SubmissionData } from '../components/witness/SubmissionFlow';
import { useAuth } from '../contexts/AuthContext';
import '../styles/report.css';

/** API base: use env variable for production, fallback to Wrangler dev proxy */
const API_BASE = import.meta.env.VITE_API_BASE || '';

interface SubmitState {
    status: 'idle' | 'submitting' | 'success' | 'error';
    message: string;
    reportId?: string;
}

const Report: React.FC = () => {
    const { session, awardPoints } = useAuth();
    const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle', message: '' });

    const handleSubmit = useCallback(async (data: SubmissionData) => {
        if (!session?.anonToken) {
            setSubmitState({ status: 'error', message: 'No active session. Please refresh the page.' });
            return;
        }

        setSubmitState({ status: 'submitting', message: 'Submitting report...' });

        try {
            // Map SubmissionFlow type to API mediaType
            const mediaTypeMap: Record<string, string> = {
                photo: 'image',
                audio: 'audio',
                video: 'video',
            };

            // Build FormData for multipart upload (includes media file)
            const formData = new FormData();
            formData.append('media', data.file);
            formData.append('title', data.title);
            formData.append('description', data.description);
            formData.append('lane', data.lane);
            formData.append('contentHash', data.contentHash);
            formData.append('geoLabel', data.geoStamp?.geoLabel || 'Unknown');
            formData.append('mediaType', mediaTypeMap[data.type] || 'image');
            formData.append('anonToken', session.anonToken);

            const response = await fetch(`${API_BASE}/api/report`, {
                method: 'POST',
                body: formData,
                // Don't set Content-Type — browser sets it with boundary for multipart
            });

            const result = await response.json();

            if (!response.ok) {
                setSubmitState({
                    status: 'error',
                    message: result.error || `Submission failed (HTTP ${response.status})`,
                });
                return;
            }

            // Success — award reputation points locally
            awardPoints({ type: 'verified-report', basePoints: 150 });

            setSubmitState({
                status: 'success',
                message: 'Report submitted successfully!',
                reportId: result.reportId,
            });

            console.log('[Report] Evidence submitted:', {
                reportId: result.reportId,
                verificationStatus: result.verificationStatus,
                lane: data.lane,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Network error — please try again';
            setSubmitState({ status: 'error', message });
        }
    }, [session, awardPoints]);

    return (
        <Main>
            <div className="report-page">
                {/* Hero header */}
                <section className="report-page__hero">
                    <div className="report-page__badge">📸 WITNESS EVIDENCE</div>
                    <h1 className="report-page__title">File a Witness Report</h1>
                    <p className="report-page__subtitle">
                        Capture photo or audio evidence of civic issues. Your identity is protected by the <strong>Amnesia Protocol</strong>.
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                        💬 Want to share a text opinion instead? <a href="/" style={{ color: 'var(--lavender, #b4a7d6)', fontWeight: 600 }}>Post on the Social feed →</a>
                    </p>
                </section>

                {/* Status Messages */}
                {submitState.status === 'submitting' && (
                    <div style={{
                        padding: 'var(--space-md)',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--text-main)',
                        marginBottom: 'var(--space-lg)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-sm)',
                    }}>
                        <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                        {submitState.message}
                    </div>
                )}

                {submitState.status === 'error' && (
                    <div style={{
                        padding: 'var(--space-md)',
                        background: 'rgba(220, 38, 38, 0.08)',
                        border: '1px solid var(--danger-red, #dc2626)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--danger-red, #dc2626)',
                        marginBottom: 'var(--space-lg)',
                    }}>
                        ⚠ {submitState.message}
                    </div>
                )}

                {submitState.status === 'success' && (
                    <div style={{
                        padding: 'var(--space-md)',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid var(--truth-emerald, #10b981)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--truth-emerald, #10b981)',
                        marginBottom: 'var(--space-lg)',
                    }}>
                        ✓ {submitState.message}
                        {submitState.reportId && (
                            <span style={{ display: 'block', fontSize: '0.75rem', marginTop: 'var(--space-xs)', opacity: 0.7 }}>
                                Report ID: {submitState.reportId}
                            </span>
                        )}
                    </div>
                )}

                {/* Submission flow */}
                <section className="report-page__flow">
                    <SubmissionFlow onSubmit={handleSubmit} />
                </section>
            </div>
        </Main>
    );
};

export default Report;
