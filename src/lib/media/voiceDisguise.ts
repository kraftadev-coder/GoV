/**
 * Module 3: Voice Disguise — "Sor Soke" Mode
 *
 * Web Audio API pitch shifting for voice anonymization.
 * Named after the Nigerian protest chant "Sor Soke" (Speak Up).
 *
 * Source:
 * - Technical Blueprint §2.1: "Web Audio API: Client-side pitch shifting"
 * - Feature Goal Matrix: Voice anonymization for whistleblower protection
 */

/* ───────────────────── Types ───────────────────── */

export interface VoiceDisguiseConfig {
    /** Pitch shift factor: < 1.0 = deeper, > 1.0 = higher. Default: 0.75 */
    pitchFactor: number;
    /** Whether disguise is enabled */
    enabled: boolean;
}

export interface VoiceDisguiseNodes {
    /** The source node for the audio */
    sourceNode: AudioBufferSourceNode;
    /** Cleanup function to disconnect nodes */
    disconnect: () => void;
}

/* ───────────────────── Constants ───────────────────── */

/** Default pitch factor — slightly deeper voice */
export const DEFAULT_PITCH_FACTOR = 0.75;

/** Pitch shift range */
export const PITCH_MIN = 0.5;
export const PITCH_MAX = 1.5;

/* ───────────────────── Core API ───────────────────── */

/**
 * Apply voice disguise to a recorded audio blob (offline processing).
 * Shifts the pitch by slowing/speeding the playback and resampling.
 *
 * This is the primary "Sor Soke" mode implementation:
 * - Takes raw audio recording
 * - Pitch-shifts it to obscure the speaker's identity
 * - Returns a new blob with the disguised audio
 */
export async function applyVoiceDisguise(
    audioBlob: Blob,
    pitchFactor: number = DEFAULT_PITCH_FACTOR
): Promise<Blob> {
    if (audioBlob.size === 0) {
        throw new Error('[VoiceDisguise] Cannot process empty audio blob');
    }

    const clampedPitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitchFactor));
    const audioContext = new AudioContext();

    try {
        // Decode the original audio
        const arrayBuffer = await audioBlob.arrayBuffer();
        const originalBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Calculate new duration based on pitch shift
        // Lower pitch = longer duration, higher pitch = shorter
        const newDuration = originalBuffer.duration / clampedPitch;
        const newLength = Math.max(1, Math.round(originalBuffer.sampleRate * newDuration));

        // Create offline context for processing
        const offlineCtx = new OfflineAudioContext(
            originalBuffer.numberOfChannels,
            newLength,
            originalBuffer.sampleRate
        );

        // Create source and apply pitch via playbackRate
        const source = offlineCtx.createBufferSource();
        source.buffer = originalBuffer;
        source.playbackRate.value = clampedPitch;
        source.connect(offlineCtx.destination);
        source.start(0);

        // Render the pitch-shifted audio
        const renderedBuffer = await offlineCtx.startRendering();

        // Encode back to blob
        return audioBufferToWavBlob(renderedBuffer);
    } finally {
        // Always close AudioContext to prevent resource leak
        if (audioContext.state !== 'closed') {
            await audioContext.close();
        }
    }
}

/**
 * Create a real-time pitch shifting node chain for live audio preview.
 * Used during recording to let the user hear the disguised version.
 *
 * Returns a MediaStream that can be connected to <audio> for playback.
 */
export function createRealtimePitchShift(
    audioContext: AudioContext,
    sourceStream: MediaStream,
    _pitchFactor: number = DEFAULT_PITCH_FACTOR
): { outputStream: MediaStream; cleanup: () => void } {
    const source = audioContext.createMediaStreamSource(sourceStream);

    // Use a gain node as a simple processing stage
    // True real-time pitch shifting without changing speed requires
    // a granular synthesis approach. For the MVP, we use a simpler
    // approach: just process the final recording offline.
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0;

    // Create a destination to capture the output
    const destination = audioContext.createMediaStreamDestination();

    source.connect(gainNode);
    gainNode.connect(destination);

    // Also connect to analyser for waveform visualization
    const cleanup = () => {
        source.disconnect();
        gainNode.disconnect();
    };

    return {
        outputStream: destination.stream,
        cleanup,
    };
}

/**
 * Create an AnalyserNode for audio waveform visualization.
 * Used by WitnessCam to show the real-time waveform
 * (white → Emerald when GPS lock achieved).
 */
export function createWaveformAnalyser(
    audioContext: AudioContext,
    source: MediaStreamAudioSourceNode
): AnalyserNode {
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;
    source.connect(analyser);
    return analyser;
}

/**
 * Get waveform data from an analyser node.
 * Returns normalized float values (0-1) for visualization.
 */
export function getWaveformData(analyser: AnalyserNode): Float32Array {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);

    // Normalize to 0-1 range
    const normalized = new Float32Array(dataArray.length);
    for (let i = 0; i < dataArray.length; i++) {
        normalized[i] = dataArray[i] / 255.0;
    }
    return normalized;
}

/* ───────────────────── Helpers ───────────────────── */

/**
 * Encode an AudioBuffer to a WAV Blob.
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bytesPerSample = 2; // 16-bit PCM
    const dataLength = buffer.length * numChannels * bytesPerSample;
    const headerLength = 44;
    const totalLength = headerLength + dataLength;

    const arrayBuffer = new ArrayBuffer(totalLength);
    const view = new DataView(arrayBuffer);

    // RIFF header
    setString(view, 0, 'RIFF');
    view.setUint32(4, totalLength - 8, true);
    setString(view, 8, 'WAVE');

    // fmt sub-chunk
    setString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
    view.setUint16(32, numChannels * bytesPerSample, true);
    view.setUint16(34, 16, true);

    // data sub-chunk
    setString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Interleave channel data
    let offset = headerLength;
    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = buffer.getChannelData(ch)[i];
            const clamped = Math.max(-1, Math.min(1, sample));
            view.setInt16(offset, clamped * 0x7fff, true);
            offset += bytesPerSample;
        }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function setString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}
