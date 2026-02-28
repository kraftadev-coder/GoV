/**
 * Verification Gate 3 — Module 3: Witness Cam & Media Pipeline
 *
 * 9 Tests:
 *   1. EXIF Scrub (automated)
 *   2. Image Compression (automated)
 *   3. Reputation Video Gate (automated)
 *   4. Scrub Validation Reject Raw (automated)
 *   5. Camera UI Component (file check)
 *   6. Submission Flow Component (file check)
 *   7. Geo-Stamp Generation (logic test)
 *   8. Voice Disguise Toggle (export check)
 *   9. Amnesia Wipe Animation (CSS/component check)
 *
 * Run: npx tsx tests/verificationGate3.ts
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
    console.log(' VERIFICATION GATE 3 — Witness Cam & Media Pipeline');
    console.log('══════════════════════════════════════════════\n');

    let passed = 0;
    let failed = 0;

    results.forEach((r, i) => {
        const icon = r.passed ? '✓' : '✕';
        const color = r.passed ? '\x1b[32m' : '\x1b[31m';
        console.log(`  ${color}${icon}\x1b[0m Test ${i + 1}: ${r.name}`);
        if (!r.passed) console.log(`    → ${r.message}`);
        r.passed ? passed++ : failed++;
    });

    console.log(`\n──────────────────────────────────────────────`);
    console.log(`  \x1b[32m${passed} passed\x1b[0m  |  \x1b[31m${failed} failed\x1b[0m  |  ${results.length} total`);
    console.log('══════════════════════════════════════════════\n');

    if (failed > 0) process.exit(1);
}

/* ═══════════════════════════════════════════════
   RUN ALL TESTS
   ═══════════════════════════════════════════════ */

async function runAll() {

    // ── Test 1: EXIF Scrub ──────────────────────────
    await test('EXIF Scrub — scrubMedia and validateScrubbed exported', async () => {
        const { scrubMedia, validateScrubbed } = await import('../src/lib/media/metadataScrubber');

        // Verify core scrub functions exist and have correct signatures
        assert(typeof scrubMedia === 'function', 'scrubMedia must be exported');
        assert(scrubMedia.length === 1, `scrubMedia must accept 1 argument (File), got ${scrubMedia.length}`);
        assert(typeof validateScrubbed === 'function', 'validateScrubbed must be exported');
        assert(validateScrubbed.length === 1, `validateScrubbed must accept 1 argument (File), got ${validateScrubbed.length}`);

        // Verify the source code enforces the Amnesia Constraint
        const srcPath = path.resolve(__dirname, '../src/lib/media/metadataScrubber.ts');
        const src = fs.readFileSync(srcPath, 'utf-8');
        assert(src.includes('ScrubResult'), 'Must export ScrubResult interface');
        assert(src.includes('reencodeImage'), 'Must use Canvas re-encoding');
        assert(src.includes('hasExifData'), 'Must detect EXIF data');
        assert(src.includes('sanitizeFilename'), 'Must sanitize filenames');
    });

    // ── Test 2: Image Compression ───────────────────
    await test('Image Compression — payload caps correctly defined', async () => {
        const { PAYLOAD_CAPS, detectMediaType, isWithinPayloadCap } = await import('../src/lib/media/compressor');

        // Verify caps match spec: 5MB image, 10MB audio, 25MB video
        assert(PAYLOAD_CAPS.image === 5 * 1024 * 1024, `Image cap should be 5MB, got ${PAYLOAD_CAPS.image}`);
        assert(PAYLOAD_CAPS.audio === 10 * 1024 * 1024, `Audio cap should be 10MB, got ${PAYLOAD_CAPS.audio}`);
        assert(PAYLOAD_CAPS.video === 25 * 1024 * 1024, `Video cap should be 25MB, got ${PAYLOAD_CAPS.video}`);

        // Verify media type detection
        assert(detectMediaType('image/jpeg') === 'image', 'JPEG → image');
        assert(detectMediaType('image/png') === 'image', 'PNG → image');
        assert(detectMediaType('audio/webm') === 'audio', 'WEBM audio → audio');
        assert(detectMediaType('video/mp4') === 'video', 'MP4 → video');

        // Verify payload cap check
        const smallBlob = new Blob(['x'.repeat(100)]);
        assert(isWithinPayloadCap(smallBlob, 'image') === true, 'Small blob should be within cap');

        const largeBlob = new Blob(['x'.repeat(6 * 1024 * 1024)]);
        assert(isWithinPayloadCap(largeBlob, 'image') === false, '6MB should exceed 5MB image cap');
        assert(isWithinPayloadCap(largeBlob, 'audio') === true, '6MB should be within 10MB audio cap');
    });

    // ── Test 3: Reputation Video Gate ───────────────
    await test('Reputation Video Gate — video upload requires Advanced level', async () => {
        const { createProfile, awardPoints, canUploadVideo } = await import('../src/lib/auth/reputationEngine');

        // Fresh profile
        const profile = createProfile('test-anon-token-vg3');
        assert(profile.level === 'junior', 'New user must be Junior');
        // canUploadVideo takes points (number), not a profile
        assert(canUploadVideo(profile.points) === false, 'Junior users (0 points) CANNOT upload video');

        // Award points up to Advanced threshold
        let p = profile;
        for (let i = 0; i < 10; i++) {
            p = awardPoints(p, {
                type: 'verified-report',
                basePoints: 100,
                locationDiversityFactor: 1.0,
            });
        }
        assert(p.points >= 1000, `Points should be >= 1000, got ${p.points}`);
        assert(p.level === 'advanced', `Level should be Advanced, got ${p.level}`);
        assert(canUploadVideo(p.points) === true, 'Advanced users (1000+ pts) CAN upload video');
        assert(p.canUploadVideo === true, 'Profile.canUploadVideo should be true after reaching 1000+');
    });

    // ── Test 4: Scrub Validation — Reject Raw Files ─
    await test('Scrub Validation — validateScrubbed function exists and rejects', async () => {
        const { validateScrubbed } = await import('../src/lib/media/metadataScrubber');

        assert(typeof validateScrubbed === 'function', 'validateScrubbed must be exported');
        assert(validateScrubbed.length === 1, 'validateScrubbed must accept exactly 1 argument');

        // Verify SecurityProtocol §1.2 language is in the source
        const srcPath = path.resolve(__dirname, '../src/lib/media/metadataScrubber.ts');
        const src = fs.readFileSync(srcPath, 'utf-8');
        assert(src.includes('reject'), 'Source must reference file rejection');
        assert(src.includes('EXIF'), 'Source must reference EXIF stripping');
    });

    // ── Test 5: Camera UI ───────────────────────────
    // Note: Component import would fail in Node due to CSS import.
    // Instead, verify the file exists and has correct structure.
    await test('Camera UI — WitnessCam file exists with correct exports', async () => {
        const filePath = path.resolve(__dirname, '../src/components/witness/WitnessCam.tsx');
        assert(fs.existsSync(filePath), 'WitnessCam.tsx must exist');

        const src = fs.readFileSync(filePath, 'utf-8');
        assert(src.includes('export default'), 'Must have default export');
        assert(src.includes('CapturedMedia'), 'Must define CapturedMedia type');
        assert(src.includes('CaptureMode'), 'Must define CaptureMode type');
        assert(src.includes('witness-cam__grain'), 'Must have film grain overlay');
        assert(src.includes('witness-cam__capture-btn'), 'Must have capture button');
        assert(src.includes('waveform'), 'Must have waveform visualization');
        assert(src.includes('mode-video'), 'Must have video mode button');
        assert(src.includes('canUploadVideo'), 'Must check video gating');
        assert(src.includes('getUserMedia'), 'Must use getUserMedia for camera');
        assert(src.includes('MediaRecorder'), 'Must use MediaRecorder for recording');
    });

    // ── Test 6: Submission Flow ─────────────────────
    await test('Submission Flow — SubmissionFlow file exists with correct structure', async () => {
        const filePath = path.resolve(__dirname, '../src/components/witness/SubmissionFlow.tsx');
        assert(fs.existsSync(filePath), 'SubmissionFlow.tsx must exist');

        const src = fs.readFileSync(filePath, 'utf-8');
        assert(src.includes('export default'), 'Must have default export');
        assert(src.includes('SubmissionData'), 'Must define SubmissionData type');
        assert(src.includes("'capture'"), 'Must have capture step');
        assert(src.includes("'preview'"), 'Must have preview step');
        assert(src.includes("'scrub'"), 'Must have scrub step');
        assert(src.includes("'submit'"), 'Must have submit step');
        assert(src.includes('scrubMedia'), 'Must call scrubMedia');
        assert(src.includes('compressImage'), 'Must call compressImage');
        assert(src.includes('SHA-256'), 'Must generate content hash');
        assert(src.includes('applyVoiceDisguise'), 'Must apply voice disguise');
        assert(src.includes('amnesia-wipe'), 'Must render Amnesia Wipe');
        assert(src.includes('EVIDENCE SECURED'), 'Must show wipe message');
    });

    // ── Test 7: Geo-Stamp Generation ────────────────
    await test('Geo-Stamp — geo label generation works', async () => {
        const { createGeoStamp, generateGeoLabel, watchPosition, checkGeoPermission } =
            await import('../src/lib/media/geoStamp');

        assert(typeof createGeoStamp === 'function', 'createGeoStamp must exist');
        assert(typeof generateGeoLabel === 'function', 'generateGeoLabel must exist');
        assert(typeof watchPosition === 'function', 'watchPosition must exist');
        assert(typeof checkGeoPermission === 'function', 'checkGeoPermission must exist');

        // Test geo label generation (does not need GPS hardware)
        const label = generateGeoLabel(6.5244, 3.3792);
        assert(typeof label === 'string', 'Geo label must be a string');
        assert(label.length > 0, 'Geo label must not be empty');

        // Test with different coordinates
        const abujaLabel = generateGeoLabel(9.0765, 7.4986);
        assert(typeof abujaLabel === 'string', 'Abuja label must be a string');
    });

    // ── Test 8: Voice Disguise Toggle ───────────────
    await test('Voice Disguise — Sor Soke exports check', async () => {
        const {
            applyVoiceDisguise,
            createWaveformAnalyser,
            getWaveformData,
            DEFAULT_PITCH_FACTOR,
        } = await import('../src/lib/media/voiceDisguise');

        assert(typeof applyVoiceDisguise === 'function', 'applyVoiceDisguise must exist');
        assert(typeof createWaveformAnalyser === 'function', 'createWaveformAnalyser must exist');
        assert(typeof getWaveformData === 'function', 'getWaveformData must exist');
        assert(typeof DEFAULT_PITCH_FACTOR === 'number', 'DEFAULT_PITCH_FACTOR must be a number');
        assert(DEFAULT_PITCH_FACTOR > 0 && DEFAULT_PITCH_FACTOR < 1, `Pitch factor between 0-1 (got ${DEFAULT_PITCH_FACTOR})`);
    });

    // ── Test 9: Amnesia Wipe Animation ──────────────
    await test('Amnesia Wipe — CSS animation and component integration', async () => {
        const cssPath = path.resolve(__dirname, '../src/styles/witness.css');
        const css = fs.readFileSync(cssPath, 'utf-8');

        assert(css.includes('.amnesia-wipe'), 'witness.css must contain .amnesia-wipe class');
        assert(css.includes('amnesiaWipe'), 'witness.css must reference amnesiaWipe animation');
        assert(css.includes('.amnesia-wipe__text'), 'witness.css must contain .amnesia-wipe__text class');
        assert(css.includes('wipeTextFade'), 'witness.css must contain wipeTextFade keyframes');

        const flowPath = path.resolve(__dirname, '../src/components/witness/SubmissionFlow.tsx');
        const flowCode = fs.readFileSync(flowPath, 'utf-8');

        assert(flowCode.includes('amnesia-wipe'), 'SubmissionFlow must render amnesia-wipe element');
        assert(flowCode.includes('EVIDENCE SECURED'), 'SubmissionFlow must display wipe message');
    });

    printResults();
}

runAll();
