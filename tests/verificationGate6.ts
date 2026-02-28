/**
 * Verification Gate 6 — Module 6: Edge Cases & Resilience
 *
 * 8 Tests:
 *   6.1  Resumable upload — exports, IndexedDB logic, queue management
 *   6.2  IndexedDB persistence — pending upload structure, status tracking
 *   6.3  Mirror failover — exports, exponential backoff, endpoint switching
 *   6.4  Deepfake flagging — exports, noise floor analysis, flag thresholds
 *   6.5  Sybil protection — Location Diversity (100 same = 1 effective)
 *   6.6  Peer review queue — component exports, reputation gating, vote UI
 *   6.7  Production hardening — payload caps, stale cleanup, CORS preflight
 *   6.8  Double-vote protection — optimistic local state
 *
 * Run: npx tsx tests/verificationGate6.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ───────────────────── Minimal Test Framework ───────────────────── */

interface TestResult {
    name: string;
    passed: boolean;
    message: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(message);
}

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
    try {
        await fn();
        results.push({ name, passed: true, message: '✓ PASS' });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ name, passed: false, message: `✕ FAIL: ${msg}` });
    }
}

function printResults(): void {
    console.log('\n══════════════════════════════════════════════');
    console.log(' VERIFICATION GATE 6 — Edge Cases & Resilience');
    console.log('══════════════════════════════════════════════\n');

    let passed = 0;
    let failed = 0;

    results.forEach((r, i) => {
        const icon = r.passed ? '✓' : '✕';
        const color = r.passed ? '\x1b[32m' : '\x1b[31m';
        console.log(`  ${color}${icon}\x1b[0m Test 6.${i + 1}: ${r.name}`);
        if (!r.passed) console.log(`    → ${r.message}`);
        r.passed ? passed++ : failed++;
    });

    console.log(`\n──────────────────────────────────────────────`);
    console.log(`  \x1b[32m${passed} passed\x1b[0m  |  \x1b[31m${failed} failed\x1b[0m  |  ${results.length} total`);
    console.log('══════════════════════════════════════════════\n');

    if (failed > 0) {
        console.log('❌ VERIFICATION GATE 6 — FAILED');
        process.exit(1);
    } else {
        console.log('✅ VERIFICATION GATE 6 — ALL TESTS PASSED');
        process.exit(0);
    }
}

/* ═══════════════════════════════════════════════
   RUN ALL TESTS
   ═══════════════════════════════════════════════ */

async function runAll() {

    // ── Test 6.1: Resumable Upload ─────────────────────────
    await test('Resumable upload — exports, IndexedDB logic, queue management', async () => {
        const filePath = path.resolve(__dirname, '../src/lib/resilience/resumableUpload.ts');
        assert(fs.existsSync(filePath), 'src/lib/resilience/resumableUpload.ts must exist');

        const src = fs.readFileSync(filePath, 'utf-8');

        // Core exports
        assert(src.includes('startResumableUpload'), 'Must export startResumableUpload');
        assert(src.includes('resumePendingUploads'), 'Must export resumePendingUploads');
        assert(src.includes('clearCompletedUploads'), 'Must export clearCompletedUploads');

        // IndexedDB usage
        assert(src.includes('indexedDB'), 'Must use IndexedDB for persistence');
        assert(src.includes('IDBDatabase'), 'Must reference IDBDatabase type');
        assert(src.includes('objectStore'), 'Must create object store');

        // Upload queue types
        assert(src.includes('PendingUpload'), 'Must define PendingUpload type');
        assert(src.includes('UploadStatus'), 'Must define UploadStatus type');
        assert(src.includes("'pending'"), 'Must include pending status');
        assert(src.includes("'uploading'"), 'Must include uploading status');
        assert(src.includes("'completed'"), 'Must include completed status');
        assert(src.includes("'failed'"), 'Must include failed status');

        // Metadata for report submission compatibility
        assert(src.includes('UploadMetadata'), 'Must define UploadMetadata type');
        assert(src.includes('anonToken'), 'Upload metadata must include anonToken');
        assert(src.includes('contentHash'), 'Upload metadata must include contentHash');
        assert(src.includes('geoLabel'), 'Upload metadata must include geoLabel');

        // Network detection
        assert(src.includes('navigator.onLine'), 'Must check navigator.onLine');
        assert(src.includes("'online'"), 'Must listen for online event');
        assert(src.includes("'offline'"), 'Must listen for offline event');

        // Retry logic
        assert(src.includes('retryCount'), 'Must track retry count');
        assert(src.includes('MAX_RETRY_ATTEMPTS'), 'Must define max retry attempts');

        // File conversion for IndexedDB storage
        assert(src.includes('fileToBase64'), 'Must export fileToBase64 for IndexedDB storage');
        assert(src.includes('base64ToArrayBuffer'), 'Must export base64ToArrayBuffer for upload resumption');

        // FormData construction (must match /api/report expected format)
        assert(src.includes('FormData'), 'Must construct FormData for report endpoint');
        assert(src.includes("'media'"), 'FormData must include media field');
    });

    // ── Test 6.2: IndexedDB Persistence ────────────────────
    await test('IndexedDB persistence — pending upload structure, status tracking, clear completed', async () => {
        const filePath = path.resolve(__dirname, '../src/lib/resilience/resumableUpload.ts');
        const src = fs.readFileSync(filePath, 'utf-8');

        // Database management
        assert(src.includes('openUploadDB'), 'Must export openUploadDB function');
        assert(src.includes('savePendingUpload'), 'Must export savePendingUpload function');
        assert(src.includes('getPendingUploads'), 'Must export getPendingUploads function');
        assert(src.includes('deleteUpload'), 'Must export deleteUpload function');

        // Database name and store
        assert(src.includes('DB_NAME'), 'Must define database name constant');
        assert(src.includes('STORE_NAME'), 'Must define store name constant');

        // PendingUpload structure validation
        assert(src.includes('bytesUploaded'), 'PendingUpload must track bytes uploaded');
        assert(src.includes('chunkIndex'), 'PendingUpload must track chunk index');
        assert(src.includes('createdAt'), 'PendingUpload must track creation time');
        assert(src.includes('updatedAt'), 'PendingUpload must track update time');
        assert(src.includes('lastError'), 'PendingUpload must track last error');

        // Connectivity listener registration
        assert(src.includes('registerConnectivityListeners'), 'Must export registerConnectivityListeners');
        assert(src.includes('addEventListener'), 'Must add event listeners for connectivity');
        assert(src.includes('removeEventListener'), 'Must provide cleanup function');

        // Status index for querying
        assert(src.includes("'status'"), 'Must create index on status field');

        // Clear completed uploads frees IndexedDB space
        assert(src.includes('clearCompletedUploads'), 'Must export clearCompletedUploads');
        assert(src.includes("IDBKeyRange.only('completed')"), 'Must query for completed status to clear');
    });

    // ── Test 6.3: Mirror Failover ──────────────────────────
    await test('Mirror failover — exports, exponential backoff math, endpoint switching', async () => {
        const filePath = path.resolve(__dirname, '../src/lib/resilience/mirrorSwitch.ts');
        assert(fs.existsSync(filePath), 'src/lib/resilience/mirrorSwitch.ts must exist');

        const src = fs.readFileSync(filePath, 'utf-8');

        // Core exports
        assert(src.includes('resilientFetch'), 'Must export resilientFetch');
        assert(src.includes('getMirrorConfig'), 'Must export getMirrorConfig');
        assert(src.includes('getActiveEndpoint'), 'Must export getActiveEndpoint');
        assert(src.includes('setMirrorConfig'), 'Must export setMirrorConfig');
        assert(src.includes('calculateBackoff'), 'Must export calculateBackoff');

        // Endpoint health tracking
        assert(src.includes('EndpointHealth'), 'Must define EndpointHealth type');
        assert(src.includes('EndpointStatus'), 'Must define EndpointStatus type');
        assert(src.includes("'healthy'"), 'Must include healthy status');
        assert(src.includes("'degraded'"), 'Must include degraded status');
        assert(src.includes("'down'"), 'Must include down status');

        // Mirror config
        assert(src.includes('MirrorConfig'), 'Must define MirrorConfig type');
        assert(src.includes('primary'), 'Config must include primary endpoint');
        assert(src.includes('mirrors'), 'Config must include mirror endpoints');
        assert(src.includes('timeoutMs'), 'Config must include timeout');
        assert(src.includes('maxRetries'), 'Config must include max retries');

        // Exponential backoff
        assert(src.includes('Math.pow(2'), 'Must use exponential formula (2^attempt)');
        assert(src.includes('maxBackoffMs'), 'Must cap backoff at max value');
        assert(src.includes('jitter'), 'Must add jitter to prevent thundering herd');

        // Failover logic
        assert(src.includes('502'), 'Must failover on 502');
        assert(src.includes('503'), 'Must failover on 503');
        assert(src.includes('504'), 'Must failover on 504');
        assert(src.includes('AbortController'), 'Must use AbortController for timeout');
        assert(src.includes('shouldFailover'), 'Must have shouldFailover logic');

        // Unit test: calculateBackoff math
        const { calculateBackoff } = await import('../src/lib/resilience/mirrorSwitch');

        // Base case: attempt 0
        const backoff0 = calculateBackoff(0, 1000, 30000);
        assert(backoff0 >= 750 && backoff0 <= 1250,
            `Attempt 0 backoff should be ~1000ms (±25% jitter), got ${backoff0}`);

        // Attempt 1: ~2000ms
        const backoff1 = calculateBackoff(1, 1000, 30000);
        assert(backoff1 >= 1500 && backoff1 <= 2500,
            `Attempt 1 backoff should be ~2000ms (±25% jitter), got ${backoff1}`);

        // Attempt 2: ~4000ms
        const backoff2 = calculateBackoff(2, 1000, 30000);
        assert(backoff2 >= 3000 && backoff2 <= 5000,
            `Attempt 2 backoff should be ~4000ms (±25% jitter), got ${backoff2}`);

        // High attempt: should cap at maxBackoffMs
        const backoff10 = calculateBackoff(10, 1000, 30000);
        assert(backoff10 <= 37500,
            `High attempt backoff should cap at ~30000ms (±25%), got ${backoff10}`);
    });

    // ── Test 6.4: Deepfake Flagging ────────────────────────
    await test('Deepfake flagging — audio analysis, noise floor threshold, flagging logic', async () => {
        const filePath = path.resolve(__dirname, '../workers/api/audioGate.ts');
        assert(fs.existsSync(filePath), 'workers/api/audioGate.ts must exist');

        const src = fs.readFileSync(filePath, 'utf-8');

        // Core exports
        assert(src.includes('analyzeAudioSignal'), 'Must export analyzeAudioSignal');
        assert(src.includes('handleAudioGate'), 'Must export handleAudioGate');
        assert(src.includes('computeRMS'), 'Must export computeRMS');
        assert(src.includes('estimateNoiseFloor'), 'Must export estimateNoiseFloor');
        assert(src.includes('detectAmbientNoise'), 'Must export detectAmbientNoise');

        // Types
        assert(src.includes('AudioAnalysisResult'), 'Must define AudioAnalysisResult type');
        assert(src.includes('AudioGateResponse'), 'Must define AudioGateResponse type');
        assert(src.includes('noiseFloorDb'), 'Result must include noise floor in dB');
        assert(src.includes('rmsLevel'), 'Result must include RMS level');
        assert(src.includes('hasAmbientNoise'), 'Result must include ambient noise flag');

        // Thresholds
        assert(src.includes('NOISE_FLOOR_THRESHOLD_DB'), 'Must define noise floor threshold');
        assert(src.includes('RMS_SILENCE_THRESHOLD'), 'Must define RMS silence threshold');
        assert(src.includes('AMBIENT_NOISE_MIN_PERCENTAGE'), 'Must define ambient noise min percentage');

        // Flagging logic
        assert(src.includes("'peer-review'"), 'Flagged audio should recommend peer-review status');
        assert(src.includes("'proceed'"), 'Normal audio should recommend proceed status');
        assert(src.includes('Suspected AI-generated'), 'Flag reason should mention AI-generated');

        // Unit test: analyzeAudioSignal with "clean" audio (should be flagged)
        const { analyzeAudioSignal, computeRMS, estimateNoiseFloor } =
            await import('../workers/api/audioGate');

        // Create a "suspiciously clean" audio buffer (near-silence)
        const cleanBuffer = new ArrayBuffer(4096);
        const cleanView = new DataView(cleanBuffer);
        // Fill with very low amplitude values (near zero = "too clean")
        for (let i = 0; i < 2048; i++) {
            cleanView.setInt16(i * 2, Math.floor(Math.random() * 2 - 1), true);
        }
        const cleanResult = analyzeAudioSignal(cleanBuffer);
        assert(cleanResult.flagged === true,
            `Near-silent audio should be flagged, got flagged=${cleanResult.flagged}`);

        // Create a "normal" audio buffer with ambient noise
        const noisyBuffer = new ArrayBuffer(4096);
        const noisyView = new DataView(noisyBuffer);
        // Fill with moderate amplitude noise
        for (let i = 0; i < 2048; i++) {
            const sample = Math.floor((Math.random() * 2 - 1) * 8000);
            noisyView.setInt16(i * 2, sample, true);
        }
        const noisyResult = analyzeAudioSignal(noisyBuffer);
        assert(noisyResult.flagged === false,
            `Noisy audio should NOT be flagged, got flagged=${noisyResult.flagged}`);
        assert(noisyResult.hasAmbientNoise === true,
            `Noisy audio should have ambient noise detected`);

        // RMS of silence should be near zero
        const silentSamples = new Float32Array(1024).fill(0);
        assert(computeRMS(silentSamples) === 0, 'RMS of silence should be 0');

        // RMS of uniform signal
        const uniformSamples = new Float32Array(1024).fill(0.5);
        const uniformRMS = computeRMS(uniformSamples);
        assert(Math.abs(uniformRMS - 0.5) < 0.001,
            `RMS of uniform 0.5 signal should be ~0.5, got ${uniformRMS}`);

        // Noise floor of silence should be -Infinity
        const noiseFloor = estimateNoiseFloor(silentSamples);
        assert(noiseFloor === -Infinity, `Noise floor of silence should be -Infinity, got ${noiseFloor}`);

        // Empty buffer handling
        const emptyResult = analyzeAudioSignal(new ArrayBuffer(0));
        assert(emptyResult.flagged === true, 'Empty buffer should be flagged');

        // Worker router integration
        const routerPath = path.resolve(__dirname, '../workers/index.ts');
        const routerSrc = fs.readFileSync(routerPath, 'utf-8');
        assert(routerSrc.includes('/api/audio-gate'), 'Router must handle /api/audio-gate');
        assert(routerSrc.includes('handleAudioGate'), 'Router must import handleAudioGate');
    });

    // ── Test 6.5: Sybil Protection ─────────────────────────
    await test('Sybil protection — 100 same-location upvotes count as 1 effective', async () => {
        const { calculateLocationDiversity, computeSybilWeightedScore, applyLocationDiversity } =
            await import('../src/lib/auth/reputationEngine');

        // Type check: exports exist
        assert(typeof calculateLocationDiversity === 'function',
            'calculateLocationDiversity must be a function');
        assert(typeof computeSybilWeightedScore === 'function',
            'computeSybilWeightedScore must be a function');

        // 100 upvotes from SAME location → diversity factor = 0.01
        const sameLocationUpvotes = Array(100).fill(null).map(() => ({
            locationId: 'tower-1234',
            basePoints: 10,
        }));
        const sameFactor = calculateLocationDiversity(sameLocationUpvotes);
        assert(sameFactor === 0.01,
            `100 same-location → factor should be 0.01, got ${sameFactor}`);

        // 100 same-location upvotes × 10pts × 0.01 = 10 effective points
        const sameScore = computeSybilWeightedScore(sameLocationUpvotes);
        assert(sameScore === 10,
            `100 same × 10pts × 0.01 should be 10, got ${sameScore}`);

        // 100 upvotes from DIFFERENT locations → diversity factor = 1.0
        const diverseUpvotes = Array(100).fill(null).map((_, i) => ({
            locationId: `tower-${i}`,
            basePoints: 10,
        }));
        const diverseFactor = calculateLocationDiversity(diverseUpvotes);
        assert(diverseFactor === 1.0,
            `100 diverse locations → factor should be 1.0, got ${diverseFactor}`);

        // 100 diverse upvotes × 10pts × 1.0 = 1000 effective points
        const diverseScore = computeSybilWeightedScore(diverseUpvotes);
        assert(diverseScore === 1000,
            `100 diverse × 10pts × 1.0 should be 1000, got ${diverseScore}`);

        // Mixed: 50 from same + 50 from different (51 unique) → factor = 0.51
        const mixedUpvotes = [
            ...Array(50).fill(null).map(() => ({ locationId: 'tower-same', basePoints: 10 })),
            ...Array(50).fill(null).map((_, i) => ({ locationId: `tower-unique-${i}`, basePoints: 10 })),
        ];
        const mixedFactor = calculateLocationDiversity(mixedUpvotes);
        assert(mixedFactor === 0.51,
            `51 unique out of 100 → factor should be 0.51, got ${mixedFactor}`);

        // Empty upvotes → factor = 1.0 (no penalty)
        const emptyFactor = calculateLocationDiversity([]);
        assert(emptyFactor === 1.0,
            `Empty upvotes → factor should be 1.0, got ${emptyFactor}`);

        // Empty upvotes → score = 0
        const emptyScore = computeSybilWeightedScore([]);
        assert(emptyScore === 0,
            `Empty upvotes → score should be 0, got ${emptyScore}`);

        // Existing applyLocationDiversity still works (backwards compat)
        assert(typeof applyLocationDiversity === 'function',
            'applyLocationDiversity must still be exported');
        assert(applyLocationDiversity(1000, 0.01) === 10,
            'applyLocationDiversity(1000, 0.01) should return 10');
        assert(applyLocationDiversity(1000, 1.0) === 1000,
            'applyLocationDiversity(1000, 1.0) should return 1000');

        // Source file has Module 6 enhancement docs
        const srcPath = path.resolve(__dirname, '../src/lib/auth/reputationEngine.ts');
        const src = fs.readFileSync(srcPath, 'utf-8');
        assert(src.includes('Module 6'), 'reputationEngine.ts must reference Module 6 enhancements');
        assert(src.includes('LocationUpvote'), 'Must export LocationUpvote type');
        assert(src.includes('calculateLocationDiversity'), 'Must export calculateLocationDiversity');
        assert(src.includes('computeSybilWeightedScore'), 'Must export computeSybilWeightedScore');
    });

    // ── Test 6.6: Peer Review Queue ────────────────────────
    await test('Peer review queue — component exists, reputation gating, vote UI', async () => {
        const componentPath = path.resolve(__dirname, '../src/components/feed/PeerReviewQueue.tsx');
        assert(fs.existsSync(componentPath), 'src/components/feed/PeerReviewQueue.tsx must exist');

        const src = fs.readFileSync(componentPath, 'utf-8');

        // Component exports
        assert(src.includes('PeerReviewQueue'), 'Must export PeerReviewQueue component');
        assert(src.includes('export default'), 'Must have default export');
        assert(src.includes('export function PeerReviewQueue'), 'Must export PeerReviewQueue as named export');

        // Helper exports
        assert(src.includes('canReview'), 'Must export canReview helper');
        assert(src.includes('hasVoted'), 'Must export hasVoted helper');
        assert(src.includes('getVoteCounts'), 'Must export getVoteCounts helper');

        // Types
        assert(src.includes('FlaggedSubmission'), 'Must define FlaggedSubmission type');
        assert(src.includes('ReviewVote'), 'Must define ReviewVote type');
        assert(src.includes('ReviewDecision'), 'Must define ReviewDecision type');
        assert(src.includes("'verify'"), 'ReviewDecision must include verify');
        assert(src.includes("'reject'"), 'ReviewDecision must include reject');

        // Flagged submission fields
        assert(src.includes('reportId'), 'FlaggedSubmission must have reportId');
        assert(src.includes('flagReason'), 'FlaggedSubmission must have flagReason');
        assert(src.includes('mediaType'), 'FlaggedSubmission must have mediaType');
        assert(src.includes('geoLabel'), 'FlaggedSubmission must have geoLabel');
        assert(src.includes('contentHash'), 'FlaggedSubmission must have contentHash');
        assert(src.includes('noiseFloorDb'), 'FlaggedSubmission must have noiseFloorDb');

        // Reputation gating
        assert(src.includes("'advanced'"), 'Must check for advanced level');
        assert(src.includes('Advanced Witnesses Only'), 'Must show access gate for junior users');
        assert(src.includes('1,000'), 'Must mention 1000 point threshold');

        // Vote UI elements
        assert(src.includes('VERIFY'), 'Must have verify button');
        assert(src.includes('REJECT'), 'Must have reject button');
        assert(src.includes('vote-btn'), 'Must have vote button class');
        assert(src.includes('tally-bar'), 'Must have vote tally bar');
        assert(src.includes('tally-verify'), 'Must have verify tally section');
        assert(src.includes('tally-reject'), 'Must have reject tally section');

        // FLAGGED badge
        assert(src.includes('FLAGGED'), 'Must show FLAGGED badge');

        // Accessibility
        assert(src.includes('aria-label'), 'Must have aria-labels for accessibility');
        assert(src.includes('role='), 'Must use ARIA roles');

        // CSS file exists
        const cssPath = path.resolve(__dirname, '../src/components/feed/PeerReviewQueue.css');
        assert(fs.existsSync(cssPath), 'src/components/feed/PeerReviewQueue.css must exist');

        const css = fs.readFileSync(cssPath, 'utf-8');

        // Amber caution theme
        assert(css.includes('--caution-amber'), 'CSS must use caution-amber color');
        assert(css.includes('--caution-amber-light'), 'CSS must use caution-amber-light');
        assert(css.includes('--truth-emerald'), 'CSS must use truth-emerald for verify');
        assert(css.includes('--danger-red'), 'CSS must use danger-red for reject');

        // Brutalist styling
        assert(css.includes('--border-weight'), 'CSS must use border-weight variable');
        assert(css.includes('--font-data'), 'CSS must use data font (JetBrains Mono)');
        assert(css.includes('--font-serif'), 'CSS must use serif font (Fraunces)');
        assert(css.includes('--radius-sm'), 'CSS must use radius-sm (4px)');

        // Responsive
        assert(css.includes('@media'), 'CSS must have responsive breakpoints');
        assert(css.includes('640px'), 'CSS must have mobile breakpoint');
    });

    // ── Test 6.7: Production Hardening — Payload Caps, Stale Cleanup, CORS ──
    await test('Production hardening — payload size enforcement, stale cleanup, CORS preflight', async () => {
        // Resumable upload payload caps
        const uploadPath = path.resolve(__dirname, '../src/lib/resilience/resumableUpload.ts');
        const uploadSrc = fs.readFileSync(uploadPath, 'utf-8');

        assert(uploadSrc.includes('MAX_PAYLOAD_BYTES'), 'Must export MAX_PAYLOAD_BYTES for size enforcement');
        assert(uploadSrc.includes('5 * 1024 * 1024'), 'Must enforce 5MB image limit');
        assert(uploadSrc.includes('10 * 1024 * 1024'), 'Must enforce 10MB audio limit');
        assert(uploadSrc.includes('25 * 1024 * 1024'), 'Must enforce 25MB video limit');
        assert(uploadSrc.includes('file.size > maxBytes'), 'Must check file size before upload');
        assert(uploadSrc.includes('File exceeds'), 'Must return descriptive error for oversized files');

        // Stale upload cleanup (prevents IndexedDB bloat)
        assert(uploadSrc.includes('clearStaleUploads'), 'Must export clearStaleUploads function');
        assert(uploadSrc.includes('STALE_UPLOAD_AGE_MS'), 'Must define stale upload age constant');
        assert(uploadSrc.includes('72 * 60 * 60 * 1000'), 'Stale age must be 72 hours');

        // Transaction safety — must resolve on tx.oncomplete, not request.onsuccess
        assert(!uploadSrc.includes('request.onsuccess = () => resolve()'),
            'Must NOT resolve on request.onsuccess (race condition)');
        assert(uploadSrc.includes('// Resolve on tx.oncomplete'),
            'Must document that tx.oncomplete is used for safety');

        // Audio gate CORS preflight
        const audioPath = path.resolve(__dirname, '../workers/api/audioGate.ts');
        const audioSrc = fs.readFileSync(audioPath, 'utf-8');

        assert(audioSrc.includes("request.method === 'OPTIONS'"), 'Must handle OPTIONS preflight');
        assert(audioSrc.includes('Access-Control-Max-Age'), 'Must set CORS cache duration');
        assert(audioSrc.includes('MAX_AUDIO_BYTES'), 'Must define max audio size constant');
        assert(audioSrc.includes('10 * 1024 * 1024'), 'Audio gate must enforce 10MB limit');
        assert(audioSrc.includes('413'), 'Must return 413 for oversized payloads');

        // Mirror switch array safety
        const mirrorPath = path.resolve(__dirname, '../src/lib/resilience/mirrorSwitch.ts');
        const mirrorSrc = fs.readFileSync(mirrorPath, 'utf-8');
        assert(mirrorSrc.includes('[...allEndpoints].sort'),
            'Must spread allEndpoints before sort to prevent mutation');
    });

    // ── Test 6.8: Double-Vote Protection ──
    await test('Double-vote protection — optimistic local state in PeerReviewQueue', async () => {
        const componentPath = path.resolve(__dirname, '../src/components/feed/PeerReviewQueue.tsx');
        const src = fs.readFileSync(componentPath, 'utf-8');

        // Must use optimistic local state, NOT fragile setTimeout
        assert(!src.includes('setTimeout(() => setVoting(false)'),
            'Must NOT use setTimeout for vote state reset (race condition)');
        assert(src.includes('localVoted'), 'Must use localVoted state for optimistic double-vote prevention');
        assert(src.includes('effectiveVoted'), 'Must derive effectiveVoted from props + local state');
        assert(src.includes('setLocalVoted(true)'),
            'Must set localVoted to true immediately on vote');

        // CSS hash display
        const cssPath = path.resolve(__dirname, '../src/components/feed/PeerReviewQueue.css');
        const css = fs.readFileSync(cssPath, 'utf-8');
        assert(css.includes('.data-hash'), 'CSS must style .data-hash for hash display');
        assert(css.includes('word-break'), 'Hash display must handle overflow with word-break');
    });

    printResults();
}

runAll();
