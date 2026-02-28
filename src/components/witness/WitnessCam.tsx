/**
 * Module 3: Witness Cam Component
 *
 * Full-screen camera UI per Component Spec:
 * - Black background + film grain SVG overlay
 * - Oversized circular capture buttons with heavy borders
 * - Photo, Audio, Video (15s max, gated by reputation) modes
 * - Real-time audio waveform: white → Emerald when GPS lock achieved
 *
 * Source:
 * - Component Spec: "Witness Cam" UI
 * - UI/UX Strategy §3: Motion & spatial composition
 * - Feature Goal Matrix §"Blow whistle with proofs"
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
    watchPosition,
    generateGeoLabel,
    checkGeoPermission,
    type GeoPosition,
    type GeoPermissionState,
} from '../../lib/media/geoStamp';
import {
    createWaveformAnalyser,
    getWaveformData,
} from '../../lib/media/voiceDisguise';
import '../../styles/witness.css';

/* ───────────────────── Types ───────────────────── */

export type CaptureMode = 'photo' | 'audio' | 'video';

export interface CapturedMedia {
    blob: Blob;
    type: CaptureMode;
    mimeType: string;
    duration?: number; // seconds (audio/video)
}

interface WitnessCamProps {
    onCapture: (media: CapturedMedia) => void;
    onClose: () => void;
}

/* ───────────────────── Constants ───────────────────── */

const MAX_VIDEO_DURATION = 15; // seconds
const WAVEFORM_BARS = 32;
const WAVEFORM_UPDATE_INTERVAL = 50; // ms

/* ───────────────────── Component ───────────────────── */

const WitnessCam: React.FC<WitnessCamProps> = ({ onCapture, onClose }) => {
    const { reputation } = useAuth();

    // State
    const [mode, setMode] = useState<CaptureMode>('photo');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [hasGpsLock, setHasGpsLock] = useState(false);
    const [geoLabel, setGeoLabel] = useState<string | null>(null);
    const [geoPermission, setGeoPermission] = useState<GeoPermissionState>('prompt');
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [waveformData, setWaveformData] = useState<number[]>(() => Array(WAVEFORM_BARS).fill(0.5));
    const [sorSokeEnabled, setSorSokeEnabled] = useState(false);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const waveformTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const geoCleanupRef = useRef<(() => void) | null>(null);
    const recordingTimeRef = useRef(0); // Use ref to avoid stale closures in timer

    const canUploadVideo = reputation?.canUploadVideo ?? false;

    /* ─── Camera Setup ─── */

    const startCamera = useCallback(async () => {
        try {
            const constraints: MediaStreamConstraints = {
                video: mode !== 'audio' ? { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } : false,
                audio: mode !== 'photo',
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current && mode !== 'audio') {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            // Setup audio waveform analyser
            if (mode !== 'photo') {
                const audioCtx = new AudioContext();
                audioCtxRef.current = audioCtx;
                const source = audioCtx.createMediaStreamSource(stream);
                const analyser = createWaveformAnalyser(audioCtx, source);
                analyserRef.current = analyser;
                startWaveformUpdates();
            }

            setCameraReady(true);
            setCameraError(null);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Camera access failed';
            setCameraError(message);
            setCameraReady(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (audioCtxRef.current?.state !== 'closed') {
            audioCtxRef.current?.close();
        }
        audioCtxRef.current = null;
        analyserRef.current = null;
        stopWaveformUpdates();
        setCameraReady(false);
    }, []);

    /* ─── Waveform Visualization ─── */

    const startWaveformUpdates = useCallback(() => {
        waveformTimerRef.current = setInterval(() => {
            if (analyserRef.current) {
                const data = getWaveformData(analyserRef.current);
                // Sample down to WAVEFORM_BARS bars
                const step = Math.floor(data.length / WAVEFORM_BARS);
                const bars: number[] = [];
                for (let i = 0; i < WAVEFORM_BARS; i++) {
                    bars.push(data[i * step] ?? 0.5);
                }
                setWaveformData(bars);
            }
        }, WAVEFORM_UPDATE_INTERVAL);
    }, []);

    const stopWaveformUpdates = useCallback(() => {
        if (waveformTimerRef.current) {
            clearInterval(waveformTimerRef.current);
            waveformTimerRef.current = null;
        }
    }, []);

    /* ─── Geolocation ─── */

    useEffect(() => {
        checkGeoPermission().then(setGeoPermission);

        const cleanup = watchPosition(
            (pos: GeoPosition) => {
                setHasGpsLock(pos.accuracy < 100);
                setGeoLabel(generateGeoLabel(pos.latitude, pos.longitude));
            },
            () => setHasGpsLock(false)
        );
        geoCleanupRef.current = cleanup;

        return () => {
            cleanup();
            geoCleanupRef.current = null;
        };
    }, []);

    /* ─── Camera lifecycle ─── */

    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, [mode, startCamera, stopCamera]);

    /* ─── Capture Handlers ─── */

    const capturePhoto = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        const canvas = canvasRef.current ?? document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    onCapture({ blob, type: 'photo', mimeType: 'image/jpeg' });
                }
            },
            'image/jpeg',
            0.92
        );
    }, [onCapture]);

    const stopRecording = useCallback(() => {
        recorderRef.current?.stop();
        recorderRef.current = null;
        setIsRecording(false);
        recordingTimeRef.current = 0;

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const startRecording = useCallback(() => {
        if (!streamRef.current) return;

        const mimeType = mode === 'audio'
            ? (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg')
            : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4');

        const recorder = new MediaRecorder(streamRef.current, { mimeType });
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: mimeType });
            onCapture({
                blob,
                type: mode,
                mimeType,
                duration: recordingTimeRef.current,
            });
            chunksRef.current = [];
        };

        recorder.start(100); // 100ms timeslice
        recorderRef.current = recorder;
        setIsRecording(true);
        setRecordingTime(0);
        recordingTimeRef.current = 0;

        // Start recording timer — use ref to avoid stale closure
        timerRef.current = setInterval(() => {
            recordingTimeRef.current += 1;
            setRecordingTime(recordingTimeRef.current);
            // Auto-stop video at MAX_VIDEO_DURATION
            if (mode === 'video' && recordingTimeRef.current >= MAX_VIDEO_DURATION) {
                // Directly stop the recorder instead of calling stopRecording
                // to avoid stale closure issues
                recorderRef.current?.stop();
                recorderRef.current = null;
                setIsRecording(false);
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
            }
        }, 1000);
    }, [mode, onCapture]);

    const handleCapture = useCallback(() => {
        if (mode === 'photo') {
            capturePhoto();
        } else if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [mode, isRecording, capturePhoto, startRecording, stopRecording]);

    /* ─── Cleanup ─── */

    useEffect(() => {
        return () => {
            stopCamera();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [stopCamera]);

    /* ─── Render ─── */

    // Camera error state
    if (cameraError) {
        return (
            <div className="witness-cam" id="witness-cam">
                <div className="witness-cam__viewfinder">
                    <button className="witness-cam__close" onClick={onClose} aria-label="Close camera" type="button">✕</button>
                    <div className="camera-prompt">
                        <div className="camera-prompt__icon">📸</div>
                        <h3 className="camera-prompt__title">Camera Access Required</h3>
                        <p className="camera-prompt__description">
                            {cameraError.includes('denied')
                                ? 'Please allow camera access in your browser settings to use Witness Cam.'
                                : `Camera error: ${cameraError}`
                            }
                        </p>
                        <button
                            className="witness-cam__mode-btn witness-cam__mode-btn--active"
                            onClick={startCamera}
                            type="button"
                            style={{ color: 'var(--truth-emerald)', marginTop: '16px' }}
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="witness-cam" id="witness-cam">
            {/* Viewfinder */}
            <div className="witness-cam__viewfinder">
                {/* Film grain overlay */}
                <div className="witness-cam__grain" aria-hidden="true" />

                {/* Close button */}
                <button className="witness-cam__close" onClick={onClose} aria-label="Close camera" type="button">
                    ✕
                </button>

                {/* GPS indicator */}
                <div className={`witness-cam__gps-indicator ${hasGpsLock ? 'witness-cam__gps-indicator--locked' : ''}`}>
                    <span className={`witness-cam__gps-dot ${hasGpsLock ? 'witness-cam__gps-dot--locked' : ''}`} />
                    {hasGpsLock ? (geoLabel ?? 'GPS locked') : (geoPermission === 'denied' ? 'GPS denied' : 'Acquiring GPS...')}
                </div>

                {/* Camera video preview */}
                {mode !== 'audio' && (
                    <video
                        ref={videoRef}
                        className="witness-cam__video"
                        autoPlay
                        playsInline
                        muted
                    />
                )}

                {/* Audio waveform (for audio mode) */}
                {mode === 'audio' && (
                    <div className="waveform" aria-label="Audio waveform">
                        {waveformData.map((value, i) => (
                            <div
                                key={i}
                                className={`waveform__bar ${hasGpsLock ? 'waveform__bar--locked' : ''}`}
                                style={{ height: `${Math.max(4, value * 48)}px` }}
                            />
                        ))}
                    </div>
                )}

                {/* Hidden canvas for photo capture */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>

            {/* Controls */}
            <div className="witness-cam__controls">
                {/* Recording timer */}
                {isRecording && (
                    <span
                        className="mono"
                        style={{ color: '#DC2626', fontSize: '0.875rem' }}
                        aria-live="polite"
                    >
                        ● {formatTime(recordingTime)}
                        {mode === 'video' && ` / ${formatTime(MAX_VIDEO_DURATION)}`}
                    </span>
                )}

                {/* Audio waveform (for video/audio recording) */}
                {mode !== 'photo' && cameraReady && !isRecording && (
                    <div className="waveform" aria-label="Audio waveform">
                        {waveformData.map((value, i) => (
                            <div
                                key={i}
                                className={`waveform__bar ${hasGpsLock ? 'waveform__bar--locked' : ''}`}
                                style={{ height: `${Math.max(4, value * 48)}px` }}
                            />
                        ))}
                    </div>
                )}

                {/* Sor Soke Toggle */}
                {mode === 'audio' && (
                    <button
                        className={`sor-soke-toggle ${sorSokeEnabled ? 'sor-soke-toggle--active' : ''}`}
                        onClick={() => setSorSokeEnabled(!sorSokeEnabled)}
                        type="button"
                        id="sor-soke-toggle"
                    >
                        🔊 Sor Soke {sorSokeEnabled ? 'ON' : 'OFF'}
                    </button>
                )}

                {/* Capture Button */}
                <div className="witness-cam__capture-ring">
                    <button
                        className={`witness-cam__capture-btn ${isRecording ? 'witness-cam__capture-btn--recording' : ''}`}
                        onClick={handleCapture}
                        aria-label={
                            mode === 'photo'
                                ? 'Take photo'
                                : isRecording
                                    ? 'Stop recording'
                                    : `Start ${mode} recording`
                        }
                        type="button"
                        id="capture-btn"
                        disabled={!cameraReady}
                    />
                </div>

                {/* Mode Selector */}
                <div className="witness-cam__modes">
                    <button
                        className={`witness-cam__mode-btn ${mode === 'photo' ? 'witness-cam__mode-btn--active' : ''}`}
                        onClick={() => { if (!isRecording) setMode('photo'); }}
                        disabled={isRecording}
                        type="button"
                        id="mode-photo"
                    >
                        Photo
                    </button>
                    <button
                        className={`witness-cam__mode-btn ${mode === 'audio' ? 'witness-cam__mode-btn--active' : ''}`}
                        onClick={() => { if (!isRecording) setMode('audio'); }}
                        disabled={isRecording}
                        type="button"
                        id="mode-audio"
                    >
                        Audio
                    </button>
                    <button
                        className={`witness-cam__mode-btn ${mode === 'video' ? 'witness-cam__mode-btn--active' : ''}`}
                        onClick={() => { if (!isRecording) setMode('video'); }}
                        disabled={isRecording || !canUploadVideo}
                        type="button"
                        id="mode-video"
                    >
                        Video
                        {!canUploadVideo && (
                            <span className="video-gate-badge video-gate-badge--locked" style={{ marginLeft: '4px' }}>
                                🔒 Advanced
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ───────────────────── Helpers ───────────────────── */

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default WitnessCam;
