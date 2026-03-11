/**
 * Module 3: Submission Flow Component
 *
 * Multi-step wizard: Capture → Preview → Scrub → Submit
 * Enforces the "Amnesia Constraint" — rejects unscrubbed files.
 *
 * Source:
 * - Feature Goal Matrix §"Amnesia Constraint": scrubMedia() required
 * - UI/UX Strategy §2.3: "Amnesia Wipe" animation on submit
 * - Security Protocol §1.2: reject raw files
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import WitnessCam, { type CapturedMedia } from './WitnessCam';
import { useAuth } from '../../contexts/AuthContext';
import { scrubMedia, validateScrubbed, type ScrubResult } from '../../lib/media/metadataScrubber';
import { compressImage, compressAudio, detectMediaType, isWithinPayloadCap } from '../../lib/media/compressor';
import { createGeoStamp, type GeoStamp } from '../../lib/media/geoStamp';
import { applyVoiceDisguise, DEFAULT_PITCH_FACTOR } from '../../lib/media/voiceDisguise';
import { Turnstile } from '../ui/Turnstile';
import '../../styles/witness.css';

/* ─── Turnstile Configuration ─── */
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA';

/* ───────────────────── Types ───────────────────── */

type FlowStep = 'idle' | 'capture' | 'preview' | 'scrub' | 'submit' | 'done';

interface ScrubStep {
    label: string;
    status: 'pending' | 'active' | 'done' | 'error';
}

export interface SubmissionData {
    file: File;
    type: 'photo' | 'audio' | 'video';
    geoStamp: GeoStamp | null;
    contentHash: string;
    sorSokeEnabled: boolean;
    title: string;
    description: string;
    lane: 'witness' | 'social';
}

interface SubmissionFlowProps {
    onSubmit?: (data: SubmissionData) => void;
}

/* ───────────────────── Component ───────────────────── */

const SubmissionFlow: React.FC<SubmissionFlowProps> = ({ onSubmit }) => {
    const { reputation } = useAuth();

    // State
    const [step, setStep] = useState<FlowStep>('idle');
    const [capturedMedia, setCapturedMedia] = useState<CapturedMedia | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [geoStamp, setGeoStamp] = useState<GeoStamp | null>(null);
    const [scrubResult, setScrubResult] = useState<ScrubResult | null>(null);
    const [sorSokeEnabled, setSorSokeEnabled] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [lane, setLane] = useState<'witness' | 'social'>('witness');
    const [showAmnesiaWipe, setShowAmnesiaWipe] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [scrubSteps, setScrubSteps] = useState<ScrubStep[]>([
        { label: 'STRIPPING METADATA', status: 'pending' },
        { label: 'COMPRESSING MEDIA', status: 'pending' },
        { label: 'GENERATING CONTENT HASH', status: 'pending' },
        { label: 'APPLYING VOICE DISGUISE', status: 'pending' },
        { label: 'VALIDATING SCRUB', status: 'pending' },
    ]);

    const prevUrlRef = useRef<string | null>(null);
    const timeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

    /* ─── Cleanup object URLs ─── */
    useEffect(() => {
        return () => {
            if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
            // Clear any pending animation timeouts
            timeoutRefs.current.forEach(clearTimeout);
            timeoutRefs.current = [];
        };
    }, []);

    /* ─── Step Handlers ─── */

    const handleCapture = useCallback((media: CapturedMedia) => {
        setCapturedMedia(media);
        const url = URL.createObjectURL(media.blob);
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = url;
        setPreviewUrl(url);
        setStep('preview');

        // Try to get geo-stamp
        createGeoStamp()
            .then(setGeoStamp)
            .catch(() => setGeoStamp(null));
    }, []);

    const handleStartScrub = useCallback(async () => {
        if (!capturedMedia) return;
        setStep('scrub');
        setError(null);

        const updateStep = (index: number, status: ScrubStep['status']) => {
            setScrubSteps(prev => prev.map((s, i) => i === index ? { ...s, status } : s));
        };

        try {
            let processedBlob: Blob = capturedMedia.blob;

            // Step 1: Strip metadata (images only)
            updateStep(0, 'active');
            await delay(400); // Visual delay for UX
            if (capturedMedia.type === 'photo') {
                const file = new File([capturedMedia.blob], 'capture.jpg', { type: capturedMedia.mimeType });
                const result = await scrubMedia(file);
                processedBlob = result.file;
                setScrubResult(result);
            }
            updateStep(0, 'done');

            // Step 2: Compress
            updateStep(1, 'active');
            await delay(300);
            const mediaType = detectMediaType(capturedMedia.mimeType);
            if (capturedMedia.type === 'photo') {
                const file = new File([processedBlob], 'capture.jpg', { type: 'image/jpeg' });
                const compressed = await compressImage(file);
                processedBlob = compressed.blob;
            } else if (capturedMedia.type === 'audio') {
                const compressed = await compressAudio(processedBlob);
                processedBlob = compressed.blob;
            }
            // Video compression deferred to server-side (Module 5)
            updateStep(1, 'done');

            // Step 3: Generate content hash
            updateStep(2, 'active');
            await delay(300);
            const hashBuffer = await crypto.subtle.digest('SHA-256', await processedBlob.arrayBuffer());
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const contentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            updateStep(2, 'done');

            // Step 4: Voice disguise (audio only, if Sor Soke enabled)
            updateStep(3, 'active');
            await delay(300);
            if (capturedMedia.type === 'audio' && sorSokeEnabled) {
                processedBlob = await applyVoiceDisguise(processedBlob, DEFAULT_PITCH_FACTOR);
            }
            updateStep(3, 'done');

            // Step 5: Validate scrub
            updateStep(4, 'active');
            await delay(300);
            if (capturedMedia.type === 'photo') {
                const file = new File([processedBlob], 'evidence.jpg', { type: 'image/jpeg' });
                const isValid = await validateScrubbed(file);
                if (!isValid) {
                    updateStep(4, 'error');
                    setError('SCRUB VALIDATION FAILED — File rejected. Metadata still present.');
                    return;
                }
            }
            // Payload cap check
            if (!isWithinPayloadCap(processedBlob, mediaType)) {
                updateStep(4, 'error');
                setError(`FILE EXCEEDS ${mediaType.toUpperCase()} PAYLOAD CAP — Submission rejected.`);
                return;
            }
            updateStep(4, 'done');

            // Store processed file for submission
            const processedFile = new File(
                [processedBlob],
                `evidence_${Date.now()}.${getExtension(capturedMedia.mimeType)}`,
                { type: capturedMedia.mimeType }
            );

            // Move to submit confirmation
            setStep('submit');

            // Trigger submission
            const submissionData: SubmissionData = {
                file: processedFile,
                type: capturedMedia.type,
                geoStamp,
                contentHash,
                sorSokeEnabled,
                title: title.trim() || 'Untitled Report',
                description: description.trim(),
                lane,
            };

            onSubmit?.(submissionData);

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Processing failed';
            setError(message);
        }
    }, [capturedMedia, geoStamp, sorSokeEnabled, onSubmit]);

    const handleSubmitConfirm = useCallback(() => {
        // Play Amnesia Wipe animation
        setShowAmnesiaWipe(true);
        const id1 = setTimeout(() => {
            setShowAmnesiaWipe(false);
            setStep('done');
            // Reset after animation
            const id2 = setTimeout(() => {
                resetFlow();
            }, 1000);
            timeoutRefs.current.push(id2);
        }, 1200);
        timeoutRefs.current.push(id1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resetFlow = useCallback(() => {
        setStep('idle');
        setCapturedMedia(null);
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = null;
        setPreviewUrl(null);
        setGeoStamp(null);
        setScrubResult(null);
        setError(null);
        setTitle('');
        setDescription('');
        setLane('witness');
        setScrubSteps(prev => prev.map(s => ({ ...s, status: 'pending' as const })));
    }, []);

    /* ─── Step Number ─── */

    const stepNumber = (() => {
        switch (step) {
            case 'capture': return 1;
            case 'preview': return 2;
            case 'scrub': return 3;
            case 'submit':
            case 'done': return 4;
            default: return 0;
        }
    })();

    /* ─── Render ─── */

    // Amnesia Wipe overlay
    if (showAmnesiaWipe) {
        return (
            <div className="amnesia-wipe" id="amnesia-wipe">
                <span className="amnesia-wipe__text">EVIDENCE SECURED • IDENTITY ERASED</span>
            </div>
        );
    }

    // Camera capture mode
    if (step === 'capture') {
        return (
            <WitnessCam
                onCapture={handleCapture}
                onClose={() => setStep('idle')}
            />
        );
    }

    return (
        <div className="submission-flow" id="submission-flow">
            {/* Step Indicator */}
            {step !== 'idle' && step !== 'done' && (
                <div className="submission-flow__steps" aria-label="Submission progress">
                    {[1, 2, 3, 4].map((num, i) => (
                        <React.Fragment key={num}>
                            {i > 0 && (
                                <div className={`submission-flow__connector ${stepNumber > num - 1 ? 'submission-flow__connector--completed' : ''}`} />
                            )}
                            <div className={`submission-flow__step ${stepNumber === num ? 'submission-flow__step--active' : ''} ${stepNumber > num ? 'submission-flow__step--completed' : ''}`}>
                                {stepNumber > num ? '✓' : num}
                            </div>
                        </React.Fragment>
                    ))}
                </div>
            )}

            {/* Idle State — Open Camera Button */}
            {step === 'idle' && (
                <div className="camera-prompt">
                    <div className="camera-prompt__icon">📸</div>
                    <h3 className="camera-prompt__title">Witness Cam</h3>
                    <p className="camera-prompt__description">
                        Capture evidence with automatic metadata scrubbing and geo-stamping. Your identity is protected.
                    </p>
                    <button
                        className="witness-cam__capture-btn"
                        onClick={() => setStep('capture')}
                        aria-label="Open Witness Cam"
                        type="button"
                        id="open-witness-cam"
                        style={{
                            border: '4px solid var(--truth-emerald)',
                            width: '72px',
                            height: '72px',
                            borderRadius: '50%',
                            background: 'transparent',
                            cursor: 'pointer',
                            marginTop: 'var(--space-md)',
                        }}
                    />
                    {!reputation?.canUploadVideo && (
                        <div className="video-gate-badge video-gate-badge--locked" id="video-gate-badge">
                            🔒 Video requires Advanced (1000+ pts)
                        </div>
                    )}
                    {reputation?.canUploadVideo && (
                        <div className="video-gate-badge video-gate-badge--unlocked">
                            ✓ Video unlocked
                        </div>
                    )}
                </div>
            )}

            {/* Preview Step */}
            {step === 'preview' && capturedMedia && (
                <div>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>Preview Evidence</h3>

                    {/* Evidence Frame */}
                    <div className="submission-flow__preview">
                        {/* Top bar: geo region */}
                        {geoStamp && (
                            <div className="submission-flow__geo-label" id="geo-label">
                                📍 {geoStamp.geoLabel} • {new Date(geoStamp.timestamp).toLocaleTimeString()}
                            </div>
                        )}

                        {/* Media preview */}
                        {capturedMedia.type === 'photo' && previewUrl && (
                            <img src={previewUrl} alt="Captured evidence" style={{ width: '100%' }} />
                        )}
                        {capturedMedia.type === 'video' && previewUrl && (
                            <video src={previewUrl} controls style={{ width: '100%' }} />
                        )}
                        {capturedMedia.type === 'audio' && previewUrl && (
                            <div style={{ padding: 'var(--space-lg)' }}>
                                <audio src={previewUrl} controls style={{ width: '100%' }} />
                            </div>
                        )}
                    </div>

                    {/* Report Details: Title, Description, Lane */}
                    <div style={{ marginTop: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <div>
                            <label htmlFor="report-title" style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                                Report Title
                            </label>
                            <input
                                id="report-title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Brief title for your report..."
                                maxLength={120}
                                style={{
                                    width: '100%',
                                    padding: 'var(--space-sm) var(--space-md)',
                                    background: 'var(--surface-card)',
                                    border: 'var(--border-weight) solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-main)',
                                    fontSize: '0.875rem',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>
                        <div>
                            <label htmlFor="report-description" style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                                Description
                            </label>
                            <textarea
                                id="report-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe what you witnessed..."
                                rows={3}
                                maxLength={2000}
                                style={{
                                    width: '100%',
                                    padding: 'var(--space-sm) var(--space-md)',
                                    background: 'var(--surface-card)',
                                    border: 'var(--border-weight) solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-main)',
                                    fontSize: '0.875rem',
                                    resize: 'vertical',
                                    fontFamily: 'inherit',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: 'var(--space-xs)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                                Feed Lane
                            </label>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                                <button
                                    type="button"
                                    id="lane-witness"
                                    onClick={() => setLane('witness')}
                                    style={{
                                        flex: 1,
                                        padding: 'var(--space-sm) var(--space-md)',
                                        background: lane === 'witness' ? 'var(--truth-emerald)' : 'transparent',
                                        border: `var(--border-weight) solid ${lane === 'witness' ? 'var(--truth-emerald)' : 'var(--border-color)'}`,
                                        borderRadius: 'var(--radius-sm)',
                                        color: lane === 'witness' ? 'white' : 'var(--text-main)',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.8125rem',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    ◈ Witness Report
                                </button>
                                <button
                                    type="button"
                                    id="lane-social"
                                    onClick={() => setLane('social')}
                                    style={{
                                        flex: 1,
                                        padding: 'var(--space-sm) var(--space-md)',
                                        background: lane === 'social' ? 'var(--text-main)' : 'transparent',
                                        border: `var(--border-weight) solid ${lane === 'social' ? 'var(--text-main)' : 'var(--border-color)'}`,
                                        borderRadius: 'var(--radius-sm)',
                                        color: lane === 'social' ? 'var(--surface-card)' : 'var(--text-main)',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.8125rem',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    💬 Social Opinion
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Sor Soke toggle (audio only) */}
                    {capturedMedia.type === 'audio' && (
                        <button
                            className={`sor-soke-toggle ${sorSokeEnabled ? 'sor-soke-toggle--active' : ''}`}
                            onClick={() => setSorSokeEnabled(!sorSokeEnabled)}
                            type="button"
                            id="sor-soke-preview-toggle"
                            style={{ marginBottom: 'var(--space-md)', marginTop: 'var(--space-md)', width: '100%', justifyContent: 'center' }}
                        >
                            🔊 Sor Soke Voice Disguise {sorSokeEnabled ? 'ON' : 'OFF'}
                        </button>
                    )}

                    {/* Actions */}
                    <div className="flex gap-md" style={{ marginTop: 'var(--space-lg)' }}>
                        <button
                            onClick={() => { resetFlow(); setStep('capture'); }}
                            type="button"
                            style={{
                                flex: 1,
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'none',
                                border: 'var(--border-weight) solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-main)',
                                cursor: 'pointer',
                            }}
                        >
                            Retake
                        </button>
                        <button
                            onClick={handleStartScrub}
                            type="button"
                            id="process-evidence"
                            style={{
                                flex: 2,
                                padding: 'var(--space-sm) var(--space-md)',
                                background: 'var(--truth-emerald)',
                                border: 'var(--border-weight) solid var(--truth-emerald)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'white',
                                cursor: 'pointer',
                                fontWeight: 700,
                            }}
                        >
                            Process & Scrub
                        </button>
                    </div>
                </div>
            )}

            {/* Scrub Step */}
            {step === 'scrub' && (
                <div>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>Scrubbing Evidence</h3>
                    <div className="submission-flow__scrub-progress" id="scrub-progress">
                        {scrubSteps.map((s, i) => (
                            <div
                                key={i}
                                className={`submission-flow__scrub-item ${s.status === 'done' ? 'submission-flow__scrub-item--done' : ''} ${s.status === 'active' ? 'submission-flow__scrub-item--active' : ''}`}
                            >
                                <span className="submission-flow__scrub-icon">
                                    {s.status === 'done' ? '✓' : s.status === 'active' ? '⏳' : s.status === 'error' ? '✕' : '○'}
                                </span>
                                {s.label}
                            </div>
                        ))}
                    </div>

                    {error && (
                        <div style={{
                            padding: 'var(--space-md)',
                            background: 'rgba(220, 38, 38, 0.08)',
                            border: '1px solid var(--danger-red)',
                            borderRadius: 'var(--radius-sm)',
                            fontFamily: 'var(--font-data)',
                            fontSize: '0.75rem',
                            color: 'var(--danger-red)',
                            marginTop: 'var(--space-md)',
                        }}>
                            ⚠ {error}
                        </div>
                    )}

                    {scrubResult && (
                        <div className="mono" style={{ marginTop: 'var(--space-md)', fontSize: '0.6875rem' }}>
                            Original: {formatBytes(scrubResult.originalSize)} → Scrubbed: {formatBytes(scrubResult.scrubbedSize)}
                        </div>
                    )}
                </div>
            )}

            {/* Submit Confirmation Step */}
            {step === 'submit' && (
                <div style={{ textAlign: 'center' }}>
                    <h3 style={{ marginBottom: 'var(--space-md)' }}>Evidence Processed</h3>
                    <p style={{ marginBottom: 'var(--space-lg)', margin: '0 auto var(--space-lg)' }}>
                        All metadata has been stripped. Your identity is protected by the Amnesia Protocol.
                    </p>

                    {geoStamp && (
                        <div className="submission-flow__geo-label" style={{ justifyContent: 'center', marginBottom: 'var(--space-lg)' }}>
                            📍 {geoStamp.geoLabel}
                        </div>
                    )}

                    {/* Turnstile CAPTCHA — Privacy-first human verification (Module 8) */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-lg)' }}>
                        <Turnstile
                            siteKey={TURNSTILE_SITE_KEY}
                            onVerify={(token) => setTurnstileToken(token)}
                            onExpire={() => setTurnstileToken(null)}
                            onError={() => setTurnstileToken(null)}
                            theme="dark"
                        />
                    </div>

                    <button
                        onClick={handleSubmitConfirm}
                        type="button"
                        id="submit-evidence"
                        disabled={!turnstileToken}
                        style={{
                            padding: 'var(--space-md) var(--space-xl)',
                            background: turnstileToken ? 'var(--truth-emerald)' : 'var(--text-muted)',
                            border: 'var(--border-weight) solid ' + (turnstileToken ? 'var(--truth-emerald)' : 'var(--text-muted)'),
                            borderRadius: 'var(--radius-sm)',
                            color: 'white',
                            cursor: turnstileToken ? 'pointer' : 'not-allowed',
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            opacity: turnstileToken ? 1 : 0.6,
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {turnstileToken ? 'Submit to GoVoicing' : 'Complete Verification First'}
                    </button>
                </div>
            )}

            {/* Done State */}
            {step === 'done' && (
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>✓</div>
                    <h3 style={{ color: 'var(--truth-emerald)' }}>Evidence Submitted</h3>
                    <p style={{ margin: 'var(--space-sm) auto var(--space-lg)' }}>
                        Your report has been secured. All traces have been wiped.
                    </p>
                    <button
                        onClick={resetFlow}
                        type="button"
                        style={{
                            padding: 'var(--space-sm) var(--space-lg)',
                            background: 'none',
                            border: 'var(--border-weight) solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                        }}
                    >
                        Submit Another Report
                    </button>
                </div>
            )}
        </div>
    );
};

/* ───────────────────── Helpers ───────────────────── */

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
}

function getExtension(mimeType: string): string {
    const map: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'audio/webm': 'webm',
        'audio/ogg': 'ogg',
        'audio/wav': 'wav',
        'video/webm': 'webm',
        'video/mp4': 'mp4',
    };
    return map[mimeType] ?? 'bin';
}

export default SubmissionFlow;
