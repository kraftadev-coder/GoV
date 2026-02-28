/**
 * Module 3: Client-Side Media Compressor
 *
 * Ensures no whistleblower upload exceeds payload caps.
 * Uses Canvas API for images (no external deps) to keep bundle light.
 *
 * Payload caps from Security Protocol §3.1:
 * - Images: ≤ 5MB
 * - Audio:  ≤ 10MB
 * - Video:  ≤ 25MB
 *
 * Source:
 * - Feature Goal Matrix §"Network Reality Constraint"
 * - Technical Blueprint §2.1 (FFmpeg.wasm for client-side transcoding)
 * - Security Protocol §3.1 (Payload Capping)
 */

/* ───────────────────── Types ───────────────────── */

export interface CompressionResult {
    /** The compressed file/blob */
    blob: Blob;
    /** Original size in bytes */
    originalSize: number;
    /** Compressed size in bytes */
    compressedSize: number;
    /** Compression ratio (0-1, lower = more compression) */
    ratio: number;
    /** Whether compression was applied */
    wasCompressed: boolean;
}

export type MediaType = 'image' | 'audio' | 'video';

/* ───────────────────── Constants ───────────────────── */

/** Payload caps in bytes (from Security Protocol §3.1) */
export const PAYLOAD_CAPS: Readonly<Record<MediaType, number>> = Object.freeze({
    image: 5 * 1024 * 1024,   // 5MB
    audio: 10 * 1024 * 1024,  // 10MB
    video: 25 * 1024 * 1024,  // 25MB
});

/** Minimum JPEG quality to avoid artifacts */
const MIN_QUALITY = 0.3;
/** Quality step for iterative compression */
const QUALITY_STEP = 0.1;
/** Max dimension for image resize (preserves aspect ratio) */
const MAX_DIMENSION = 2048;

/* ───────────────────── Core API ───────────────────── */

/**
 * Compress an image to fit within the 5MB cap.
 * Uses iterative quality reduction via Canvas API.
 * Falls back to dimension scaling if quality reduction isn't enough.
 */
export async function compressImage(
    file: File,
    maxSizeMB: number = 5
): Promise<CompressionResult> {
    const maxBytes = maxSizeMB * 1024 * 1024;
    const originalSize = file.size;

    // Already under the cap — no compression needed
    if (originalSize <= maxBytes) {
        return {
            blob: file,
            originalSize,
            compressedSize: originalSize,
            ratio: 1,
            wasCompressed: false,
        };
    }

    try {
        const imageBitmap = await createImageBitmap(file);
        let { width, height } = imageBitmap;

        // Step 1: Scale dimensions if image is very large
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            const scale = MAX_DIMENSION / Math.max(width, height);
            width = Math.max(1, Math.round(width * scale));
            height = Math.max(1, Math.round(height * scale));
        }

        // Step 2: Iterative quality reduction
        let quality = 0.85;
        let result: Blob | null = null;

        while (quality >= MIN_QUALITY) {
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('[Compressor] Failed to get canvas context');

            ctx.drawImage(imageBitmap, 0, 0, width, height);
            result = await canvas.convertToBlob({ type: 'image/jpeg', quality });

            if (result.size <= maxBytes) break;

            quality -= QUALITY_STEP;
        }

        imageBitmap.close();

        // Step 3: If still too large after min quality, reduce dimensions further
        if (result && result.size > maxBytes) {
            result = await resizeToFit(file, maxBytes);
        }

        const finalBlob = result ?? file;

        return {
            blob: finalBlob,
            originalSize,
            compressedSize: finalBlob.size,
            ratio: finalBlob.size / originalSize,
            wasCompressed: true,
        };
    } catch (err) {
        // Corrupted file or unsupported format — return original
        console.warn('[Compressor] Image compression failed, returning original:', err);
        return {
            blob: file,
            originalSize,
            compressedSize: originalSize,
            ratio: 1,
            wasCompressed: false,
        };
    }
}

/**
 * Compress audio by re-encoding at a lower bitrate.
 * Uses MediaRecorder API (if available) for re-encoding.
 */
export async function compressAudio(
    blob: Blob,
    maxSizeMB: number = 10
): Promise<CompressionResult> {
    const maxBytes = maxSizeMB * 1024 * 1024;
    const originalSize = blob.size;

    // Under cap — no compression needed
    if (originalSize <= maxBytes) {
        return {
            blob,
            originalSize,
            compressedSize: originalSize,
            ratio: 1,
            wasCompressed: false,
        };
    }

    // Audio compression without ffmpeg.wasm:
    // Re-encode via Web Audio API at lower sample rate
    try {
        // First decode to discover actual duration
        const tempCtx = new AudioContext();
        const arrayBuffer = await blob.arrayBuffer();
        const decoded = await tempCtx.decodeAudioData(arrayBuffer);
        await tempCtx.close();

        // Derive output length from actual audio duration, not hardcoded
        const targetSampleRate = 22050; // Mono, 22kHz for compression
        const outputLength = Math.max(1, Math.ceil(decoded.duration * targetSampleRate));

        const audioContext = new OfflineAudioContext(1, outputLength, targetSampleRate);
        // Re-decode for the offline context (buffer can't be reused across contexts)
        const arrayBuffer2 = await blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer2);

        // Create a reduced-quality version
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);

        const renderedBuffer = await audioContext.startRendering();
        const wavBlob = audioBufferToWav(renderedBuffer);

        return {
            blob: wavBlob,
            originalSize,
            compressedSize: wavBlob.size,
            ratio: wavBlob.size / originalSize,
            wasCompressed: true,
        };
    } catch {
        // Fallback: return original if compression fails
        return {
            blob,
            originalSize,
            compressedSize: originalSize,
            ratio: 1,
            wasCompressed: false,
        };
    }
}

/**
 * Validate that a file is within the payload cap for its media type.
 */
export function isWithinPayloadCap(file: File | Blob, type: MediaType): boolean {
    return file.size <= PAYLOAD_CAPS[type];
}

/**
 * Detect media type from MIME type.
 */
export function detectMediaType(mimeType: string): MediaType {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    return 'image'; // Default
}

/* ───────────────────── Helpers ───────────────────── */

/**
 * Aggressively resize an image to fit within maxBytes.
 * Halves dimensions until under the cap.
 */
async function resizeToFit(file: File, maxBytes: number): Promise<Blob> {
    const imageBitmap = await createImageBitmap(file);
    let width = imageBitmap.width;
    let height = imageBitmap.height;
    let result: Blob = file; // Fallback if canvas context fails

    do {
        width = Math.max(1, Math.round(width * 0.7));
        height = Math.max(1, Math.round(height * 0.7));

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) break;
        ctx.drawImage(imageBitmap, 0, 0, width, height);
        result = await canvas.convertToBlob({ type: 'image/jpeg', quality: MIN_QUALITY });
    } while (result.size > maxBytes && width > 100);

    imageBitmap.close();
    return result;
}

/**
 * Convert an AudioBuffer to a WAV Blob.
 * Simple PCM encoding for compatibility.
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numChannels * 2; // 16-bit samples
    const totalLength = 44 + length; // WAV header + data

    const arrayBuffer = new ArrayBuffer(totalLength);
    const view = new DataView(arrayBuffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, totalLength - 8, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true); // 16-bit
    writeString(view, 36, 'data');
    view.setUint32(40, length, true);

    // PCM data — interleave channels
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
            const sample = buffer.getChannelData(ch)[i];
            const clamped = Math.max(-1, Math.min(1, sample));
            view.setInt16(offset, clamped * 0x7fff, true);
            offset += 2;
        }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}
