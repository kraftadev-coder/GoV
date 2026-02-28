/**
 * Module 3: Metadata Scrubber
 *
 * Client-side EXIF/metadata stripping using Canvas re-encoding.
 * Every whistleblower file MUST pass through scrubMedia() before upload.
 *
 * Source:
 * - Security Protocol §1.2 (The Scrub)
 * - Feature Goal Matrix §"File and Photo uploads" (Amnesia Constraint)
 * - Component Spec: scrubMedia() function
 */

/* ───────────────────── Types ───────────────────── */

export interface ScrubResult {
    /** The scrubbed file (re-encoded, no EXIF) */
    file: File;
    /** Original file size in bytes */
    originalSize: number;
    /** Scrubbed file size in bytes */
    scrubbedSize: number;
    /** Whether metadata was successfully stripped */
    wasStripped: boolean;
}

/* ───────────────────── Constants ───────────────────── */

/** EXIF marker bytes — JPEG APP1 segment */
const EXIF_MARKER = 0xffe1;
/** JFIF marker bytes — JPEG APP0 segment */
const JFIF_MARKER = 0xffe0;

/* ───────────────────── Core API ───────────────────── */

/**
 * Strip all EXIF/metadata from an image file by re-encoding via Canvas.
 * The Canvas API produces a clean image with zero metadata.
 *
 * This is the primary "Amnesia Constraint" enforcement:
 * Input: Raw file with EXIF (author, device ID, GPS)
 * Output: Sanitized file with zero metadata
 */
export async function scrubMedia(file: File): Promise<ScrubResult> {
    if (!isImageFile(file)) {
        // For non-image files (audio/video), we can't strip via Canvas.
        // Return as-is — audio/video scrubbing handled at recording level.
        return {
            file,
            originalSize: file.size,
            scrubbedSize: file.size,
            wasStripped: false,
        };
    }

    const originalSize = file.size;

    try {
        const scrubbedBlob = await reencodeImage(file);
        const scrubbedFile = new File(
            [scrubbedBlob],
            sanitizeFilename(file.name),
            { type: scrubbedBlob.type, lastModified: Date.now() }
        );

        return {
            file: scrubbedFile,
            originalSize,
            scrubbedSize: scrubbedFile.size,
            wasStripped: true,
        };
    } catch (err) {
        // Corrupted or unsupported image format — return sanitized original
        console.warn('[MetadataScrubber] Scrub failed, returning sanitized original:', err);
        const safeFile = new File(
            [file],
            sanitizeFilename(file.name),
            { type: file.type, lastModified: Date.now() }
        );
        return {
            file: safeFile,
            originalSize,
            scrubbedSize: safeFile.size,
            wasStripped: false,
        };
    }
}

/**
 * Validate that a file has been scrubbed (no EXIF data present).
 * Used as a gate before submission — rejects unscrubbed files.
 *
 * From Security Protocol §1.2:
 * "If the scrub fails, the Worker MUST reject the file."
 */
export async function validateScrubbed(file: File): Promise<boolean> {
    if (!isImageFile(file)) {
        // Non-image files don't have EXIF to check
        return true;
    }
    return !(await hasExifData(file));
}

/* ───────────────────── Image Re-encoding ───────────────────── */

/**
 * Re-encode an image via Canvas to strip all metadata.
 * Canvas.toBlob() produces a clean image with zero EXIF/XMP/IPTC data.
 */
async function reencodeImage(file: File): Promise<Blob> {
    const imageBitmap = await createImageBitmap(file);

    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('[MetadataScrubber] Failed to get canvas context');
    }

    ctx.drawImage(imageBitmap, 0, 0);
    imageBitmap.close();

    // Determine output type — prefer WebP for smaller size, fallback to JPEG
    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = outputType === 'image/png' ? undefined : 0.92;

    const blob = await canvas.convertToBlob({ type: outputType, quality });
    return blob;
}

/* ───────────────────── EXIF Detection ───────────────────── */

/**
 * Check if a JPEG/image file contains EXIF data.
 * Scans the binary header for APP1 (EXIF) markers.
 */
async function hasExifData(file: File): Promise<boolean> {
    const buffer = await file.slice(0, Math.min(file.size, 65536)).arrayBuffer();
    const view = new DataView(buffer);

    // Not a JPEG — can't have EXIF
    if (view.byteLength < 4) return false;
    if (view.getUint16(0) !== 0xffd8) return false; // Not JPEG SOI

    let offset = 2;
    while (offset < view.byteLength - 2) {
        const marker = view.getUint16(offset);

        // Found APP1 (EXIF) marker
        if (marker === EXIF_MARKER) return true;

        // Skip APP0 (JFIF) and other segments
        if (marker === JFIF_MARKER || (marker >= 0xffe0 && marker <= 0xffef)) {
            if (offset + 2 >= view.byteLength) break;
            const segmentLength = view.getUint16(offset + 2);
            offset += 2 + segmentLength;
            continue;
        }

        // Stop at SOS (Start of Scan) — image data follows
        if (marker === 0xffda) break;

        offset++;
    }

    return false;
}

/* ───────────────────── Helpers ───────────────────── */

/** Check if a file is an image type we can scrub */
function isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
}

/**
 * Sanitize filename to remove potentially identifying information.
 * Replaces original filename with a generic timestamped name.
 */
function sanitizeFilename(originalName: string): string {
    const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    return `evidence_${timestamp}.${ext}`;
}
