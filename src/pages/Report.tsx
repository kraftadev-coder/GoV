/**
 * Module 3: Report Page
 *
 * The primary evidence submission page. Embeds the SubmissionFlow
 * component which handles camera capture, media processing, and submission.
 *
 * Replaces the Module 0 placeholder with the actual Witness Cam pipeline.
 *
 * Source:
 * - Implementation Plan §Module 3: "Report page with WitnessCam & SubmissionFlow"
 * - Feature Goal Matrix §"Blow whistle with proofs"
 */

import React, { useCallback } from 'react';
import { Main } from '../components/ui';
import SubmissionFlow, { type SubmissionData } from '../components/witness/SubmissionFlow';

const Report: React.FC = () => {
    const handleSubmit = useCallback((data: SubmissionData) => {
        // Module 5 will wire this to the /api/report Worker endpoint.
        // For now, log the submission data (no server-side storage yet).
        console.log('[Report] Evidence submitted:', {
            type: data.type,
            fileSize: data.file.size,
            geoLabel: data.geoStamp?.geoLabel ?? 'No GPS',
            contentHash: data.contentHash.slice(0, 16) + '...',
            sorSoke: data.sorSokeEnabled,
        });
    }, []);

    return (
        <Main>
            <div style={{ maxWidth: '640px', margin: '0 auto' }}>
                <h1>Report</h1>
                <p style={{ marginTop: 'var(--space-sm)', marginBottom: 'var(--space-xl)' }}>
                    Submit verified evidence of civic issues. Your identity is protected by the Amnesia Protocol.
                </p>

                <SubmissionFlow onSubmit={handleSubmit} />
            </div>
        </Main>
    );
};

export default Report;
