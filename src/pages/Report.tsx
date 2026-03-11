/**
 * Report Page — Modern Citizen Hub Design
 * File a witness report with camera/audio evidence.
 */

import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import SubmissionFlow, { type SubmissionData } from '../components/witness/SubmissionFlow';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../lib/apiConfig';

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
            const mediaTypeMap: Record<string, string> = { photo: 'image', audio: 'audio', video: 'video' };
            const formData = new FormData();
            formData.append('media', data.file);
            formData.append('title', data.title);
            formData.append('description', data.description);
            formData.append('lane', data.lane);
            formData.append('contentHash', data.contentHash);
            formData.append('geoLabel', data.geoStamp?.geoLabel || 'Unknown');
            formData.append('mediaType', mediaTypeMap[data.type] || 'image');
            formData.append('anonToken', session.anonToken);

            const response = await fetch(`${API_BASE}/api/report`, { method: 'POST', body: formData });
            const result = await response.json();

            if (!response.ok) {
                setSubmitState({ status: 'error', message: result.error || `Submission failed (HTTP ${response.status})` });
                return;
            }

            awardPoints({ type: 'verified-report', basePoints: 150 });
            setSubmitState({ status: 'success', message: 'Report submitted successfully!', reportId: result.reportId });
        } catch (err) {
            setSubmitState({ status: 'error', message: err instanceof Error ? err.message : 'Network error — please try again' });
        }
    }, [session, awardPoints]);

    return (
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
            {/* Page Header */}
            <div className="mb-8">
                <div className="glass-panel mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2">
                    <svg className="h-4 w-4 text-brand" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                    <span className="meta-label">Witness Evidence</span>
                </div>
                <h1 className="text-3xl font-black tracking-tighter text-text-primary sm:text-4xl">
                    File a Witness Report
                </h1>
                <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-text-body">
                    Capture photo or audio evidence of civic issues. Your identity is protected by the <strong className="text-text-primary">Amnesia Protocol</strong>.
                </p>
                <p className="mt-2 text-[13px] text-text-secondary">
                    Want to share a text opinion instead?{' '}
                    <Link to="/" className="font-semibold text-brand hover:text-brand-deep">Post on the Social feed →</Link>
                </p>
            </div>

            {/* Status Messages */}
            {submitState.status === 'submitting' && (
                <div className="modern-card mb-6 flex items-center gap-3 border-brand/20 bg-brand/5 p-4">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
                    <span className="text-sm font-medium text-text-primary">{submitState.message}</span>
                </div>
            )}

            {submitState.status === 'error' && (
                <div className="modern-card mb-6 border-danger/20 bg-danger/5 p-4">
                    <p className="text-sm font-medium text-danger">⚠ {submitState.message}</p>
                </div>
            )}

            {submitState.status === 'success' && (
                <div className="modern-card mb-6 border-success/20 bg-success-light p-4">
                    <p className="text-sm font-medium text-success">✓ {submitState.message}</p>
                    {submitState.reportId && (
                        <p className="mt-1 text-xs text-success/70">Report ID: {submitState.reportId}</p>
                    )}
                </div>
            )}

            {/* Submission Flow */}
            <div className="modern-card overflow-hidden p-0">
                <SubmissionFlow onSubmit={handleSubmit} />
            </div>
        </div>
    );
};

export default Report;
