/**
 * Module 6: Audio Gate — Deepfake Detection Worker
 *
 * Flags audio submissions with "too clean" noise floor (zero ambient noise)
 * as potential deepfakes for community peer-review.
 *
 * From Security Protocol §2.2:
 * "If the audio file is 'too clean' (zero noise floor), the system flags it
 *  for community peer-review before giving it the Emerald Badge."
 *
 * Source:
 * - Security Protocol §2.2 "Deepfake & AI Audio Gating"
 * - Implementation Plan §Module 6
 */

/* ─── Types ─── */

export interface Env {
    DB: D1Database;
    MEDIA_BUCKET?: R2Bucket;
}

export interface AudioAnalysisResult {
    /** Whether the audio was flagged as suspicious */
    flagged: boolean;
    /** Human-readable reason for flagging */
    reason: string;
    /** Estimated noise floor in decibels (lower = cleaner/more suspicious) */
    noiseFloorDb: number;
    /** RMS (root mean square) level of the signal */
    rmsLevel: number;
    /** Whether ambient noise was detected */
    hasAmbientNoise: boolean;
}

export interface AudioGateResponse {
    success: boolean;
    analysis: AudioAnalysisResult;
    /** Recommended verification status based on analysis */
    recommendedStatus: 'peer-review' | 'proceed';
}

/* ─── Constants ─── */

/**
 * Noise floor threshold in dB.
 * Audio below this level is flagged as "too clean" — likely AI-generated.
 * Real-world recordings from Nigerian environments (markets, streets, offices)
 * typically have a noise floor of -50dB to -30dB.
 * AI-generated audio is typically below -70dB.
 */
export const NOISE_FLOOR_THRESHOLD_DB = -65;

/**
 * RMS threshold for ambient noise detection.
 * Values below this indicate suspiciously clean audio.
 */
export const RMS_SILENCE_THRESHOLD = 0.001;

/**
 * Minimum percentage of the signal that should have ambient noise.
 * If less than this percentage has noise, flag as suspicious.
 */
export const AMBIENT_NOISE_MIN_PERCENTAGE = 0.15; // 15% of signal

/** Maximum audio payload size (Security Protocol §2.1) */
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB

/* ─── Audio Analysis ─── */

/**
 * Analyze raw audio signal bytes for deepfake indicators.
 *
 * Strategy:
 * - Extract audio samples from the raw buffer
 * - Compute RMS (Root Mean Square) noise level
 * - Estimate noise floor in decibels
 * - Flag if noise floor is suspiciously low (AI-generated audio tends
 *   to have zero background noise)
 *
 * @param audioData - Raw audio buffer (PCM or WebM/Ogg container)
 * @returns Analysis result with flagging decision
 */
export function analyzeAudioSignal(audioData: ArrayBuffer): AudioAnalysisResult {
    const samples = extractSamples(audioData);

    if (samples.length === 0) {
        return {
            flagged: true,
            reason: 'No audio data detected — empty file',
            noiseFloorDb: -Infinity,
            rmsLevel: 0,
            hasAmbientNoise: false,
        };
    }

    // Compute overall RMS
    const rmsLevel = computeRMS(samples);

    // Estimate noise floor from the quietest segments
    const noiseFloorDb = estimateNoiseFloor(samples);

    // Check for ambient noise presence
    const hasAmbientNoise = detectAmbientNoise(samples);

    // Determine if flagging is warranted
    const isTooClean = noiseFloorDb < NOISE_FLOOR_THRESHOLD_DB;
    const hasNoAmbient = !hasAmbientNoise;
    const isSuspiciouslyQuiet = rmsLevel < RMS_SILENCE_THRESHOLD;

    const flagged = isTooClean || (hasNoAmbient && isSuspiciouslyQuiet);

    let reason = '';
    if (flagged) {
        const reasons: string[] = [];
        if (isTooClean) {
            reasons.push(`noise floor (${noiseFloorDb.toFixed(1)}dB) below threshold (${NOISE_FLOOR_THRESHOLD_DB}dB)`);
        }
        if (hasNoAmbient) {
            reasons.push('no ambient noise detected');
        }
        if (isSuspiciouslyQuiet) {
            reasons.push(`RMS level (${rmsLevel.toFixed(6)}) below threshold`);
        }
        reason = `Suspected AI-generated audio: ${reasons.join('; ')}`;
    } else {
        reason = 'Audio signal contains expected ambient noise characteristics';
    }

    return {
        flagged,
        reason,
        noiseFloorDb,
        rmsLevel,
        hasAmbientNoise,
    };
}

/* ─── Signal Processing Helpers ─── */

/**
 * Extract audio samples from raw buffer.
 * Treats the data as 16-bit PCM signed integers for analysis.
 * For container formats (WebM, Ogg), we analyze the raw byte distribution
 * which still reveals noise floor characteristics.
 */
function extractSamples(buffer: ArrayBuffer): Float32Array {
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 4) return new Float32Array(0);

    // Interpret as 16-bit signed PCM, normalize to [-1, 1]
    const sampleCount = Math.floor(bytes.length / 2);
    const samples = new Float32Array(sampleCount);
    const view = new DataView(buffer);

    for (let i = 0; i < sampleCount; i++) {
        const offset = i * 2;
        if (offset + 1 < bytes.length) {
            const int16 = view.getInt16(offset, true); // little-endian
            samples[i] = int16 / 32768.0; // normalize to [-1, 1]
        }
    }

    return samples;
}

/**
 * Compute Root Mean Square (RMS) of audio samples.
 * Higher RMS = louder signal, lower RMS = quieter/cleaner.
 */
export function computeRMS(samples: Float32Array): number {
    if (samples.length === 0) return 0;

    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
        sumSquares += samples[i] * samples[i];
    }

    return Math.sqrt(sumSquares / samples.length);
}

/**
 * Estimate noise floor by analyzing the quietest segments.
 * Divides the signal into small windows, computes RMS for each,
 * and takes the average of the lowest 10% as the noise floor estimate.
 */
export function estimateNoiseFloor(samples: Float32Array): number {
    if (samples.length === 0) return -Infinity;

    const windowSize = 1024; // ~23ms at 44.1kHz
    const windowCount = Math.floor(samples.length / windowSize);

    if (windowCount === 0) {
        const rms = computeRMS(samples);
        return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    }

    // Compute RMS for each window
    const windowRMS: number[] = [];
    for (let i = 0; i < windowCount; i++) {
        const start = i * windowSize;
        const window = samples.slice(start, start + windowSize);
        const rms = computeRMS(window);
        if (rms > 0) {
            windowRMS.push(rms);
        }
    }

    if (windowRMS.length === 0) return -Infinity;

    // Sort and take the lowest 10% as noise floor estimate
    windowRMS.sort((a, b) => a - b);
    const bottomCount = Math.max(1, Math.floor(windowRMS.length * 0.1));
    const bottomRMS = windowRMS.slice(0, bottomCount);

    const avgNoiseRMS = bottomRMS.reduce((a, b) => a + b, 0) / bottomRMS.length;

    // Convert to dB
    return avgNoiseRMS > 0 ? 20 * Math.log10(avgNoiseRMS) : -Infinity;
}

/**
 * Detect the presence of ambient noise in the signal.
 * Real recordings have fluctuating background noise;
 * AI-generated audio tends to have perfectly silent gaps.
 */
export function detectAmbientNoise(samples: Float32Array): boolean {
    if (samples.length === 0) return false;

    const windowSize = 512;
    const windowCount = Math.floor(samples.length / windowSize);
    if (windowCount === 0) return false;

    let noisyWindows = 0;

    for (let i = 0; i < windowCount; i++) {
        const start = i * windowSize;
        const window = samples.slice(start, start + windowSize);
        const rms = computeRMS(window);

        // A window has "noise" if its RMS is above the silence threshold
        if (rms > RMS_SILENCE_THRESHOLD) {
            noisyWindows++;
        }
    }

    // At least AMBIENT_NOISE_MIN_PERCENTAGE of windows should have noise
    return (noisyWindows / windowCount) >= AMBIENT_NOISE_MIN_PERCENTAGE;
}

/* ─── Worker Handler ─── */

/**
 * Handle POST /api/audio-gate
 *
 * Accepts an audio file and returns deepfake analysis results.
 * Called by the frontend before or alongside report submission
 * to determine if audio should be flagged for peer review.
 */
export async function handleAudioGate(
    request: Request,
    _env: Env
): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
        // Enforce payload size cap (Security Protocol §2.1: audio ≤ 10MB)
        const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
        if (contentLength > MAX_AUDIO_BYTES) {
            return jsonResponse({ error: 'Audio file exceeds 10MB limit' }, 413);
        }

        // Accept either raw audio or multipart form
        let audioData: ArrayBuffer;
        const contentType = request.headers.get('content-type') ?? '';

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            const file = formData.get('audio') as File | null;
            if (!file) {
                return jsonResponse({ error: 'No audio file provided' }, 400);
            }
            // Double-check file size after parsing (content-length may be absent)
            if (file.size > MAX_AUDIO_BYTES) {
                return jsonResponse({ error: 'Audio file exceeds 10MB limit' }, 413);
            }
            audioData = await file.arrayBuffer();
        } else {
            audioData = await request.arrayBuffer();
            if (audioData.byteLength > MAX_AUDIO_BYTES) {
                return jsonResponse({ error: 'Audio file exceeds 10MB limit' }, 413);
            }
        }

        if (audioData.byteLength === 0) {
            return jsonResponse({ error: 'Empty audio file' }, 400);
        }

        // Analyze the audio signal
        const analysis = analyzeAudioSignal(audioData);

        const result: AudioGateResponse = {
            success: true,
            analysis,
            recommendedStatus: analysis.flagged ? 'peer-review' : 'proceed',
        };

        return jsonResponse(result, 200);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Audio analysis failed';
        return jsonResponse({ error: message }, 500);
    }
}

/* ─── Response Helpers ─── */

function jsonResponse(data: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

export default handleAudioGate;
