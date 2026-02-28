/**
 * Module 6: Resumable Upload — IndexedDB-backed upload persistence
 *
 * Handles the "3G Drop-out" scenario (Security Protocol §4.1):
 * Stores in-progress "Proof" in IndexedDB until 200 OK received from Worker.
 * On network drop, saves state; on reconnect, resumes from last checkpoint.
 *
 * Source:
 * - Security Protocol §4.1 "The 3G Drop-out"
 * - Feature Goal Matrix §"Network Reality Constraint"
 */

/* ─── Types ─── */

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';

export interface PendingUpload {
    /** Unique upload ID */
    id: string;
    /** The file data as base64 string for IndexedDB storage */
    fileData: string;
    /** Original filename */
    fileName: string;
    /** MIME type of the file */
    mimeType: string;
    /** File size in bytes */
    fileSize: number;
    /** Report metadata (lane, geoLabel, contentHash, etc.) */
    metadata: UploadMetadata;
    /** Current upload status */
    status: UploadStatus;
    /** Total bytes uploaded so far */
    bytesUploaded: number;
    /** Chunk index for resumption */
    chunkIndex: number;
    /** Timestamp of the upload attempt (ISO 8601) */
    createdAt: string;
    /** Last activity timestamp */
    updatedAt: string;
    /** Number of retry attempts */
    retryCount: number;
    /** Last error message, if any */
    lastError: string | null;
}

export interface UploadMetadata {
    lane: 'witness' | 'social';
    geoLabel: string;
    contentHash: string;
    anonToken: string;
    mediaType: 'image' | 'audio' | 'video';
    deviceCountry: string | null;
    title: string;
    description: string;
}

export interface UploadResult {
    success: boolean;
    uploadId: string;
    error?: string;
}

/* ─── Constants ─── */

const DB_NAME = 'civicvoice_uploads';
const DB_VERSION = 1;
const STORE_NAME = 'pending_uploads';
const MAX_RETRY_ATTEMPTS = 5;
const CHUNK_SIZE = 256 * 1024; // 256KB chunks for resumable upload
const STALE_UPLOAD_AGE_MS = 72 * 60 * 60 * 1000; // 72 hours

/** Max payload sizes from Security Protocol §2.1 */
export const MAX_PAYLOAD_BYTES: Record<string, number> = {
    image: 5 * 1024 * 1024,   // 5MB
    audio: 10 * 1024 * 1024,  // 10MB
    video: 25 * 1024 * 1024,  // 25MB
};

/* ─── IndexedDB Helpers ─── */

/**
 * Open the IndexedDB database for upload persistence.
 * Creates the object store on first use.
 */
export function openUploadDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('status', 'status', { unique: false });
                store.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = () => {
            reject(new Error('Failed to open upload database'));
        };
    });
}

/**
 * Generate a unique upload ID.
 */
export function generateUploadId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `upload_${timestamp}_${random}`;
}

/* ─── Core Upload Functions ─── */

/**
 * Save a pending upload to IndexedDB.
 * Called when starting an upload or when network drops mid-upload.
 */
export async function savePendingUpload(upload: PendingUpload): Promise<void> {
    const db = await openUploadDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(upload);

        // Resolve on tx.oncomplete (data is guaranteed persisted), not request.onsuccess
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => {
            db.close();
            reject(new Error('Failed to save pending upload'));
        };
    });
}

/**
 * Get all pending uploads from IndexedDB.
 */
export async function getPendingUploads(): Promise<PendingUpload[]> {
    const db = await openUploadDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('status');
        const pending: PendingUpload[] = [];

        // Get both 'pending' and 'failed' (for retry)
        const requestPending = index.openCursor(IDBKeyRange.only('pending'));
        requestPending.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                pending.push(cursor.value as PendingUpload);
                cursor.continue();
            }
        };

        const requestFailed = index.openCursor(IDBKeyRange.only('failed'));
        requestFailed.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const upload = cursor.value as PendingUpload;
                if (upload.retryCount < MAX_RETRY_ATTEMPTS) {
                    pending.push(upload);
                }
                cursor.continue();
            }
        };

        tx.oncomplete = () => {
            db.close();
            resolve(pending);
        };
        tx.onerror = () => {
            db.close();
            reject(new Error('Failed to read pending uploads'));
        };
    });
}

/**
 * Delete a completed upload from IndexedDB.
 */
export async function deleteUpload(uploadId: string): Promise<void> {
    const db = await openUploadDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(uploadId);

        // Resolve on tx.oncomplete (data is guaranteed deleted), not request.onsuccess
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => {
            db.close();
            reject(new Error('Failed to delete upload'));
        };
    });
}

/**
 * Convert a File/Blob to base64 string for IndexedDB storage.
 */
export function fileToBase64(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Remove data URL prefix (e.g., "data:image/png;base64,")
            const base64 = result.split(',')[1] ?? result;
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Convert base64 string back to ArrayBuffer for upload.
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/* ─── Upload Lifecycle ─── */

/**
 * Start a resumable upload.
 *
 * 1. Save the file + metadata to IndexedDB immediately
 * 2. Begin uploading to the Worker endpoint
 * 3. On success, mark as completed and clean up
 * 4. On failure, mark as failed for retry
 */
export async function startResumableUpload(
    file: Blob,
    metadata: UploadMetadata,
    endpoint: string
): Promise<UploadResult> {
    // Enforce payload size caps from Security Protocol §2.1
    const maxBytes = MAX_PAYLOAD_BYTES[metadata.mediaType];
    if (maxBytes && file.size > maxBytes) {
        const maxMB = (maxBytes / (1024 * 1024)).toFixed(0);
        return {
            success: false,
            uploadId: '',
            error: `File exceeds ${maxMB}MB limit for ${metadata.mediaType}`,
        };
    }

    const uploadId = generateUploadId();
    const fileData = await fileToBase64(file);

    const upload: PendingUpload = {
        id: uploadId,
        fileData,
        fileName: (file as File).name ?? `upload.${metadata.mediaType}`,
        mimeType: file.type,
        fileSize: file.size,
        metadata,
        status: 'pending',
        bytesUploaded: 0,
        chunkIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        retryCount: 0,
        lastError: null,
    };

    // Step 1: Persist to IndexedDB FIRST (crash-safe)
    await savePendingUpload(upload);

    // Step 2: Attempt upload
    return attemptUpload(upload, endpoint);
}

/**
 * Actually perform the upload to the Worker endpoint.
 * Uses FormData for multipart submission, just like the existing report.ts expects.
 */
async function attemptUpload(
    upload: PendingUpload,
    endpoint: string
): Promise<UploadResult> {
    try {
        // Check network availability first
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            upload.status = 'pending';
            upload.lastError = 'Device is offline — upload queued';
            upload.updatedAt = new Date().toISOString();
            await savePendingUpload(upload);
            return {
                success: false,
                uploadId: upload.id,
                error: 'Offline — upload saved for later',
            };
        }

        // Mark as uploading
        upload.status = 'uploading';
        upload.updatedAt = new Date().toISOString();
        await savePendingUpload(upload);

        // Build FormData matching /api/report expected format
        const arrayBuffer = base64ToArrayBuffer(upload.fileData);
        const blob = new Blob([arrayBuffer], { type: upload.mimeType });
        const formData = new FormData();
        formData.append('media', blob, upload.fileName);
        formData.append('title', upload.metadata.title);
        formData.append('description', upload.metadata.description);
        formData.append('lane', upload.metadata.lane);
        formData.append('contentHash', upload.metadata.contentHash);
        formData.append('geoLabel', upload.metadata.geoLabel);
        formData.append('anonToken', upload.metadata.anonToken);
        formData.append('mediaType', upload.metadata.mediaType);
        if (upload.metadata.deviceCountry) {
            formData.append('deviceCountry', upload.metadata.deviceCountry);
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            // Success — mark as completed
            upload.status = 'completed';
            upload.bytesUploaded = upload.fileSize;
            upload.updatedAt = new Date().toISOString();
            await savePendingUpload(upload);
            return { success: true, uploadId: upload.id };
        } else {
            const errorBody = await response.text().catch(() => 'Unknown error');
            upload.status = 'failed';
            upload.retryCount++;
            upload.lastError = `HTTP ${response.status}: ${errorBody}`;
            upload.updatedAt = new Date().toISOString();
            await savePendingUpload(upload);
            return {
                success: false,
                uploadId: upload.id,
                error: upload.lastError,
            };
        }
    } catch (err) {
        // Network error — save for retry
        upload.status = 'failed';
        upload.retryCount++;
        upload.lastError = err instanceof Error ? err.message : 'Network error';
        upload.updatedAt = new Date().toISOString();
        await savePendingUpload(upload);
        return {
            success: false,
            uploadId: upload.id,
            error: upload.lastError,
        };
    }
}

/**
 * Resume all pending uploads.
 * Called when the app comes back online or on app startup.
 * Returns the number of successfully resumed uploads.
 */
export async function resumePendingUploads(
    endpoint: string
): Promise<{ resumed: number; failed: number; total: number }> {
    const pending = await getPendingUploads();
    let resumed = 0;
    let failed = 0;

    for (const upload of pending) {
        if (upload.retryCount >= MAX_RETRY_ATTEMPTS) {
            failed++;
            continue;
        }

        const result = await attemptUpload(upload, endpoint);
        if (result.success) {
            resumed++;
        } else {
            failed++;
        }
    }

    return { resumed, failed, total: pending.length };
}

/**
 * Clear all completed uploads from IndexedDB.
 * Frees storage space after successful uploads.
 */
export async function clearCompletedUploads(): Promise<number> {
    const db = await openUploadDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('status');
        const request = index.openCursor(IDBKeyRange.only('completed'));
        let cleared = 0;

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                cursor.delete();
                cleared++;
                cursor.continue();
            }
        };

        tx.oncomplete = () => {
            db.close();
            resolve(cleared);
        };
        tx.onerror = () => {
            db.close();
            reject(new Error('Failed to clear completed uploads'));
        };
    });
}

/* ─── Online/Offline Event Handling ─── */

/**
 * Register event listeners for online/offline events.
 * When the device comes back online, automatically resume pending uploads.
 */
export function registerConnectivityListeners(endpoint: string): () => void {
    const handleOnline = () => {
        // Clean up stale uploads first, then resume pending
        clearStaleUploads().catch(() => { });
        resumePendingUploads(endpoint).catch(() => {
            // Silent failure — uploads remain in IndexedDB for next attempt
        });
    };

    const handleOffline = () => {
        // Log offline state — uploads in progress will be saved by attemptUpload's catch
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Return cleanup function
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
}

/* ─── Stale Upload Cleanup ─── */

/**
 * Remove uploads older than 72 hours.
 * Prevents IndexedDB from growing unbounded with abandoned uploads.
 */
export async function clearStaleUploads(): Promise<number> {
    const db = await openUploadDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.openCursor();
        const cutoff = Date.now() - STALE_UPLOAD_AGE_MS;
        let cleared = 0;

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const upload = cursor.value as PendingUpload;
                const uploadTime = new Date(upload.createdAt).getTime();
                if (uploadTime < cutoff) {
                    cursor.delete();
                    cleared++;
                }
                cursor.continue();
            }
        };

        tx.oncomplete = () => {
            db.close();
            resolve(cleared);
        };
        tx.onerror = () => {
            db.close();
            reject(new Error('Failed to clear stale uploads'));
        };
    });
}

/* ─── Constants Export (for testing) ─── */

export { CHUNK_SIZE, MAX_RETRY_ATTEMPTS, DB_NAME, STORE_NAME, STALE_UPLOAD_AGE_MS };
