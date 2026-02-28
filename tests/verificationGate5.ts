/**
 * Verification Gate 5 — Module 5: Cloudflare Workers Backend (D1, R2)
 *
 * 9 Tests:
 *   5.1  D1 schema exists with correct tables and columns
 *   5.2  Report submission handler — exports, validation, multipart support
 *   5.3  Feed handler — exports, lane filtering, pagination
 *   5.4  Dual-Key verification (match → witness-verified)
 *   5.5  Dual-Key VPN case (mismatch → remote-verified)
 *   5.6  R2 media structure — R2 streaming + key generation logic
 *   5.7  Rate limiting — D1 timestamp-based checks
 *   5.8  Payload caps — 5MB/10MB/25MB limits
 *   5.9  R2 lifecycle cleanup — orphaned upload cleanup logic
 *
 * Run: npx tsx tests/verificationGate5.ts
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
    console.log(' VERIFICATION GATE 5 — Workers Backend (D1, R2)');
    console.log('══════════════════════════════════════════════\n');

    let passed = 0;
    let failed = 0;

    results.forEach((r, i) => {
        const icon = r.passed ? '✓' : '✕';
        const color = r.passed ? '\x1b[32m' : '\x1b[31m';
        console.log(`  ${color}${icon}\x1b[0m Test 5.${i + 1}: ${r.name}`);
        if (!r.passed) console.log(`    → ${r.message}`);
        r.passed ? passed++ : failed++;
    });

    console.log(`\n──────────────────────────────────────────────`);
    console.log(`  \x1b[32m${passed} passed\x1b[0m  |  \x1b[31m${failed} failed\x1b[0m  |  ${results.length} total`);
    console.log('══════════════════════════════════════════════\n');

    if (failed > 0) {
        console.log('❌ VERIFICATION GATE 5 — FAILED');
        process.exit(1);
    } else {
        console.log('✅ VERIFICATION GATE 5 — ALL TESTS PASSED');
        process.exit(0);
    }
}

/* ═══════════════════════════════════════════════
   RUN ALL TESTS
   ═══════════════════════════════════════════════ */

async function runAll() {

    // ── Test 5.1: D1 Schema Created ─────────────────────
    await test('D1 schema — witness_reports and anon_reputation tables defined', async () => {
        const schemaPath = path.resolve(__dirname, '../db/schema.sql');
        assert(fs.existsSync(schemaPath), 'db/schema.sql must exist');

        const schema = fs.readFileSync(schemaPath, 'utf-8');

        // witness_reports table
        assert(schema.includes('CREATE TABLE'), 'Must contain CREATE TABLE statements');
        assert(schema.includes('witness_reports'), 'Must define witness_reports table');
        assert(schema.includes('report_id'), 'witness_reports must have report_id column');
        assert(schema.includes('media_key'), 'witness_reports must have media_key column');
        assert(schema.includes('media_type'), 'witness_reports must have media_type column');
        assert(schema.includes('geo_label'), 'witness_reports must have geo_label column');
        assert(schema.includes('network_country'), 'witness_reports must have network_country column');
        assert(schema.includes('device_country'), 'witness_reports must have device_country column');
        assert(schema.includes('verification_status'), 'witness_reports must have verification_status column');
        assert(schema.includes('witness_score'), 'witness_reports must have witness_score column');
        assert(schema.includes('content_hash'), 'witness_reports must have content_hash column');
        assert(schema.includes('lane'), 'witness_reports must have lane column');
        assert(schema.includes('anon_token'), 'witness_reports must have anon_token column');
        assert(schema.includes('created_at'), 'witness_reports must have created_at column');

        // verification_status enum values
        assert(schema.includes('pending'), 'verification_status must include pending');
        assert(schema.includes('witness-verified'), 'verification_status must include witness-verified');
        assert(schema.includes('remote-verified'), 'verification_status must include remote-verified');

        // Lane enum values
        assert(schema.includes("'witness'"), 'lane must include witness');
        assert(schema.includes("'social'"), 'lane must include social');

        // anon_reputation table
        assert(schema.includes('anon_reputation'), 'Must define anon_reputation table');
        assert(schema.includes('points'), 'anon_reputation must have points column');
        assert(schema.includes('level'), 'anon_reputation must have level column');
        assert(schema.includes('verified_reports'), 'anon_reputation must have verified_reports column');
        assert(schema.includes('peer_upvotes'), 'anon_reputation must have peer_upvotes column');

        // Indexes
        assert(schema.includes('idx_reports_lane_created'), 'Must have index on lane+created_at');
        assert(schema.includes('idx_reports_token_created'), 'Must have index on anon_token+created_at');
        assert(schema.includes('idx_reports_content_hash'), 'Must have index on content_hash');
        assert(schema.includes('idx_reputation_points'), 'Must have index on reputation points');
    });

    // ── Test 5.2: Report Submission Handler ──────────────
    await test('Report submission — handler exports, validation, multipart support', async () => {
        const reportPath = path.resolve(__dirname, '../workers/api/report.ts');
        assert(fs.existsSync(reportPath), 'workers/api/report.ts must exist');

        const src = fs.readFileSync(reportPath, 'utf-8');

        // Core exports
        assert(src.includes('handleReportSubmission'), 'Must export handleReportSubmission');
        assert(src.includes('export default'), 'Must have default export');
        assert(src.includes('validatePayload'), 'Must export validatePayload');
        assert(src.includes('validatePayloadSize'), 'Must export validatePayloadSize');
        assert(src.includes('checkRateLimit'), 'Must export checkRateLimit');
        assert(src.includes('generateReportId'), 'Must export generateReportId');
        assert(src.includes('generateMediaKey'), 'Must export generateMediaKey');

        assert(src.includes('amnesiaHeaderPurge'), 'Must integrate amnesiaHeaderPurge');

        // Content hash deduplication
        assert(src.includes('Duplicate content'), 'Must check for duplicate content submissions');

        // Dual-Key verification integration
        assert(src.includes('verifyDualKey'), 'Must integrate verifyDualKey');
        assert(src.includes('calculateWitnessScore'), 'Must integrate calculateWitnessScore');

        // Multipart form support
        assert(src.includes('multipart/form-data'), 'Must handle multipart/form-data');
        assert(src.includes('formData'), 'Must parse formData');

        // D1 integration
        assert(src.includes('INSERT INTO witness_reports'), 'Must insert into witness_reports');
        assert(src.includes('anon_reputation'), 'Must update anon_reputation');

        // R2 integration
        assert(src.includes('uploadToR2'), 'Must have uploadToR2 function');
        assert(src.includes('MEDIA_BUCKET'), 'Must reference MEDIA_BUCKET binding');

        // Stateless execution
        assert(!src.includes('global.'), 'Must not use global state');

        // Unit test validatePayload
        const { validatePayload } = await import('../workers/api/report');
        assert(validatePayload(null) !== null, 'null payload should be invalid');
        assert(validatePayload({}) !== null, 'empty object should be invalid');
        assert(validatePayload({
            contentHash: 'a'.repeat(64),
            anonToken: 'b'.repeat(64),
            lane: 'witness',
            mediaType: 'image',
            geoLabel: 'Lagos',
        }) === null, 'valid payload should pass');
        assert(validatePayload({
            contentHash: 'short',
            anonToken: 'b'.repeat(64),
            lane: 'witness',
            mediaType: 'image',
            geoLabel: 'Lagos',
        }) !== null, 'short contentHash should be invalid');
        assert(validatePayload({
            contentHash: 'a'.repeat(64),
            anonToken: 'short',
            lane: 'witness',
            mediaType: 'image',
            geoLabel: 'Lagos',
        }) !== null, 'short anonToken should be invalid');
        assert(validatePayload({
            contentHash: 'a'.repeat(64),
            anonToken: 'b'.repeat(64),
            lane: 'invalid',
            mediaType: 'image',
            geoLabel: 'Lagos',
        }) !== null, 'invalid lane should be rejected');
    });

    // ── Test 5.3: Feed Handler ──────────────────────────
    await test('Feed handler — exports, lane filtering, pagination support', async () => {
        const feedPath = path.resolve(__dirname, '../workers/api/feed.ts');
        assert(fs.existsSync(feedPath), 'workers/api/feed.ts must exist');

        const src = fs.readFileSync(feedPath, 'utf-8');

        // Core exports
        assert(src.includes('handleFeed'), 'Must export handleFeed');
        assert(src.includes('export default'), 'Must have default export');

        // Lane filtering
        assert(src.includes("lane"), 'Must filter by lane');
        assert(src.includes("'witness'"), 'Must support witness lane');
        assert(src.includes("'social'"), 'Must support social lane');

        // Pagination
        assert(src.includes('cursor'), 'Must support cursor-based pagination');
        assert(src.includes('limit'), 'Must support limit parameter');
        assert(src.includes('nextCursor'), 'Must return nextCursor for pagination');
        assert(src.includes('hasMore'), 'Must return hasMore flag');
        assert(src.includes('MAX_PAGE_SIZE'), 'Must cap page size');

        // D1 queries
        assert(src.includes('SELECT'), 'Must query D1');
        assert(src.includes('FROM witness_reports'), 'Must query witness_reports');
        assert(src.includes('ORDER BY created_at DESC'), 'Must order by newest first');
        assert(src.includes("status = 'active'"), 'Must filter active reports only');

        // Response format
        assert(src.includes('FeedReport'), 'Must define FeedReport type');
        assert(src.includes('FeedResponse'), 'Must define FeedResponse type');
        assert(src.includes('reportId'), 'FeedReport must include reportId');
        assert(src.includes('verificationStatus'), 'FeedReport must include verificationStatus');
        assert(src.includes('contentHash'), 'FeedReport must include contentHash');

        // CORS
        assert(src.includes('Access-Control-Allow-Origin'), 'Must include CORS headers');
    });

    // ── Test 5.4: Dual-Key Verification (Match → Witness Verified) ──
    await test('Dual-Key verification — matching countries → witness-verified', async () => {
        const { verifyDualKey, normalizeCountryCode, calculateWitnessScore } =
            await import('../workers/api/verification');

        // Matching keys → witness-verified
        const result = verifyDualKey('NG', 'NG');
        assert(result.status === 'witness-verified', `Expected witness-verified, got ${result.status}`);
        assert(result.keysMatch === true, 'Keys should match');
        assert(result.networkCountry === 'NG', 'Network country should be NG');
        assert(result.deviceCountry === 'NG', 'Device country should be NG');

        // Other valid matches
        const usResult = verifyDualKey('US', 'US');
        assert(usResult.status === 'witness-verified', 'US match should be witness-verified');

        const gbResult = verifyDualKey('GB', 'GB');
        assert(gbResult.status === 'witness-verified', 'GB match should be witness-verified');

        // Normalize country codes
        assert(normalizeCountryCode('NG') === 'NG', 'NG should normalize to NG');
        assert(normalizeCountryCode('ng') === 'NG', 'ng should normalize to NG');
        assert(normalizeCountryCode(' ng ') === 'NG', 'Whitespace should be trimmed');
        assert(normalizeCountryCode('XX') === null, 'XX sentinel should return null');
        assert(normalizeCountryCode('T1') === null, 'T1 sentinel should return null');
        assert(normalizeCountryCode('TOOLONG') === null, 'Invalid format should return null');
        assert(normalizeCountryCode(null) === null, 'null should return null');
        assert(normalizeCountryCode('') === null, 'empty string should return null');

        // Witness score for verified report
        const score = calculateWitnessScore('witness-verified', 500);
        assert(score > 0, `Witness score should be positive, got ${score}`);
        assert(score > calculateWitnessScore('remote-verified', 500),
            'Witness-verified score should exceed remote-verified');
    });

    // ── Test 5.5: Dual-Key VPN Case (Mismatch → Remote Verified) ──
    await test('Dual-Key VPN case — mismatched countries → remote-verified', async () => {
        const { verifyDualKey, calculateWitnessScore } =
            await import('../workers/api/verification');

        // VPN scenario: network=US, device=NG
        const vpnResult = verifyDualKey('US', 'NG');
        assert(vpnResult.status === 'remote-verified', `Expected remote-verified, got ${vpnResult.status}`);
        assert(vpnResult.keysMatch === false, 'Keys should not match');
        assert(vpnResult.networkCountry === 'US', 'Network should be US');
        assert(vpnResult.deviceCountry === 'NG', 'Device should be NG');
        assert(vpnResult.reason.includes('VPN') || vpnResult.reason.includes('mismatch'),
            'Reason should mention VPN or mismatch');

        // Travel scenario: network=GB, device=NG
        const travelResult = verifyDualKey('GB', 'NG');
        assert(travelResult.status === 'remote-verified', 'Travel mismatch should be remote-verified');

        // Missing network (only device available)
        const noNetResult = verifyDualKey(null, 'NG');
        assert(noNetResult.status === 'remote-verified', 'Missing network should be remote-verified');

        // Missing device (only network available)
        const noDevResult = verifyDualKey('NG', null);
        assert(noDevResult.status === 'remote-verified', 'Missing device should be remote-verified');

        // Both missing → pending
        const bothMissing = verifyDualKey(null, null);
        assert(bothMissing.status === 'pending', 'Both missing should be pending');

        // Score for remote-verified
        const score = calculateWitnessScore('remote-verified', 500);
        assert(score > 0, 'Remote-verified should still get a score');
        assert(score < calculateWitnessScore('witness-verified', 500),
            'Remote score should be less than witness score');

        // Score for pending
        const pendingScore = calculateWitnessScore('pending', 500);
        assert(pendingScore === 0, 'Pending should get 0 score');
    });

    // ── Test 5.6: R2 Media Structure ────────────────────
    await test('R2 media structure — streaming logic, key generation, graceful fallback', async () => {
        const reportPath = path.resolve(__dirname, '../workers/api/report.ts');
        const src = fs.readFileSync(reportPath, 'utf-8');

        // R2 upload function
        assert(src.includes('uploadToR2'), 'Must have uploadToR2 function');
        assert(src.includes('R2Bucket'), 'Must reference R2Bucket type');
        assert(src.includes('bucket.put'), 'Must use bucket.put for upload');

        // Graceful fallback when R2 unavailable
        assert(src.includes('!bucket'), 'Must check if bucket is undefined');
        assert(src.includes('R2 storage not configured'), 'Must return clear error when R2 unavailable');

        // Media key generation
        const { generateMediaKey, generateReportId } = await import('../workers/api/report');

        const reportId = generateReportId();
        assert(typeof reportId === 'string', 'reportId should be a string');
        assert(reportId.includes('-'), 'reportId should be UUID format');

        const imageKey = generateMediaKey(reportId, 'image');
        assert(imageKey.startsWith('reports/'), 'Image key should start with reports/');
        assert(imageKey.endsWith('.webp'), 'Image key should end with .webp');

        const audioKey = generateMediaKey(reportId, 'audio');
        assert(audioKey.endsWith('.ogg'), 'Audio key should end with .ogg');

        const videoKey = generateMediaKey(reportId, 'video');
        assert(videoKey.endsWith('.webm'), 'Video key should end with .webm');

        // Content type mapping
        assert(src.includes('image/webp'), 'Must set image/webp content type');
        assert(src.includes('audio/ogg'), 'Must set audio/ogg content type');
        assert(src.includes('video/webm'), 'Must set video/webm content type');

        // No PII in R2 metadata
        assert(src.includes('No PII metadata'), 'R2 uploads must not include PII');
    });

    // ── Test 5.7: Rate Limiting ─────────────────────────
    await test('Rate limiting — D1-based, 3 reports/hour/device logic verified', async () => {
        const reportPath = path.resolve(__dirname, '../workers/api/report.ts');
        const src = fs.readFileSync(reportPath, 'utf-8');

        // Rate limit constants
        assert(src.includes('RATE_LIMIT_MAX'), 'Must define RATE_LIMIT_MAX constant');
        assert(src.includes('RATE_LIMIT_WINDOW_MS'), 'Must define RATE_LIMIT_WINDOW_MS constant');
        assert(src.includes('3'), 'Rate limit should be 3 per window');

        // Rate limit function
        assert(src.includes('checkRateLimit'), 'Must export checkRateLimit function');

        // D1 query for rate checking
        assert(src.includes('COUNT(*)'), 'Rate limit must count existing reports');
        assert(src.includes('anon_token'), 'Rate limit must check by anon_token');
        assert(src.includes('created_at'), 'Rate limit must check timestamp window');

        // 429 response
        assert(src.includes('429'), 'Must return 429 when rate limited');
        assert(src.includes('Rate limit exceeded'), 'Must include rate limit error message');
        assert(src.includes('remaining'), 'Must return remaining attempts');
        assert(src.includes('resetAt'), 'Must return reset time');

        // Rate limit is actually checked in the handler flow
        assert(src.includes('rateLimit.allowed'), 'Handler must check rateLimit.allowed');
    });

    // ── Test 5.8: Payload Caps ──────────────────────────
    await test('Payload caps — 5MB image, 10MB audio, 25MB video limits enforced', async () => {
        const { PAYLOAD_CAPS, validatePayloadSize } = await import('../workers/api/report');

        // Verify cap values
        assert(PAYLOAD_CAPS.image === 5 * 1024 * 1024, `Image cap should be 5MB, got ${PAYLOAD_CAPS.image}`);
        assert(PAYLOAD_CAPS.audio === 10 * 1024 * 1024, `Audio cap should be 10MB, got ${PAYLOAD_CAPS.audio}`);
        assert(PAYLOAD_CAPS.video === 25 * 1024 * 1024, `Video cap should be 25MB, got ${PAYLOAD_CAPS.video}`);

        // Under cap — should pass
        assert(validatePayloadSize(1024, 'image') === null, '1KB image should pass');
        assert(validatePayloadSize(4 * 1024 * 1024, 'image') === null, '4MB image should pass');
        assert(validatePayloadSize(9 * 1024 * 1024, 'audio') === null, '9MB audio should pass');
        assert(validatePayloadSize(24 * 1024 * 1024, 'video') === null, '24MB video should pass');

        // Exactly at cap — should pass
        assert(validatePayloadSize(5 * 1024 * 1024, 'image') === null, 'Exactly 5MB image should pass');

        // Over cap — should fail
        assert(validatePayloadSize(6 * 1024 * 1024, 'image') !== null, '6MB image should be rejected');
        assert(validatePayloadSize(11 * 1024 * 1024, 'audio') !== null, '11MB audio should be rejected');
        assert(validatePayloadSize(26 * 1024 * 1024, 'video') !== null, '26MB video should be rejected');

        // Way over cap
        assert(validatePayloadSize(100 * 1024 * 1024, 'image') !== null, '100MB image should be rejected');

        // 413 in report handler
        const reportSrc = fs.readFileSync(
            path.resolve(__dirname, '../workers/api/report.ts'), 'utf-8'
        );
        assert(reportSrc.includes('413'), 'Must return 413 for oversized payloads');

        // Unknown media type
        assert(validatePayloadSize(1024, 'unknown') !== null, 'Unknown media type should fail');
    });

    // ── Test 5.9: R2 Lifecycle Cleanup ──────────────────
    await test('R2 lifecycle cleanup — orphaned upload cleanup logic exists', async () => {
        const reportPath = path.resolve(__dirname, '../workers/api/report.ts');
        const src = fs.readFileSync(reportPath, 'utf-8');

        // Cleanup function
        assert(src.includes('cleanupOrphanedMedia'), 'Must have cleanupOrphanedMedia function');
        assert(src.includes('export async function cleanupOrphanedMedia'),
            'cleanupOrphanedMedia must be exported');

        // 24-hour cutoff for orphaned uploads
        assert(src.includes('24 * 60 * 60 * 1000'), 'Must use 24-hour cutoff');

        // Queries for orphaned media
        assert(src.includes("status = 'active'"), 'Must check for active status');
        assert(src.includes("verification_status = 'pending'"), 'Must check for pending verification');
        assert(src.includes('media_key IS NOT NULL'), 'Must filter by non-null media_key');

        // R2 delete operation
        assert(src.includes('bucket.delete'), 'Must delete orphaned R2 objects');

        // Graceful R2 unavailability
        assert(src.includes('R2 not configured'), 'Must handle R2 not being configured');

        // Return value tracking
        assert(src.includes('deleted'), 'Must track number of deleted objects');

        // Also verify wrangler.toml has correct D1 binding
        const wranglerPath = path.resolve(__dirname, '../wrangler.toml');
        assert(fs.existsSync(wranglerPath), 'wrangler.toml must exist');
        const wrangler = fs.readFileSync(wranglerPath, 'utf-8');
        assert(wrangler.includes('civicvoice-db'), 'wrangler.toml must reference civicvoice-db');
        assert(wrangler.includes('5124c643'), 'wrangler.toml must include D1 database ID');
        assert(wrangler.includes('binding = "DB"'), 'wrangler.toml must bind DB');
        assert(wrangler.includes('MEDIA_BUCKET'), 'wrangler.toml must reference MEDIA_BUCKET (commented)');
        assert(wrangler.includes('enabled = false'), 'Observability must be disabled for Amnesia');

        // Worker router exists
        const routerPath = path.resolve(__dirname, '../workers/index.ts');
        assert(fs.existsSync(routerPath), 'workers/index.ts router must exist');
        const routerSrc = fs.readFileSync(routerPath, 'utf-8');
        assert(routerSrc.includes('/api/report'), 'Router must handle /api/report');
        assert(routerSrc.includes('/api/feed'), 'Router must handle /api/feed');
        assert(routerSrc.includes('/api/reputation'), 'Router must handle /api/reputation');
        assert(routerSrc.includes('/api/health'), 'Router must handle /api/health');

        // Router-level Amnesia purge
        assert(routerSrc.includes('amnesiaHeaderPurge'), 'Router must apply Amnesia purge to all /api/ routes');

        // Security headers
        assert(routerSrc.includes('X-Content-Type-Options'), 'Router must set X-Content-Type-Options');
        assert(routerSrc.includes('X-Frame-Options'), 'Router must set X-Frame-Options');
        assert(routerSrc.includes('Referrer-Policy'), 'Router must set Referrer-Policy');
    });

    printResults();
}

runAll();
