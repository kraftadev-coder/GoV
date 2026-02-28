/**
 * Verification Gate 4 — Module 4: Amnesia Protocol & Security Hardening
 *
 * 5 Tests:
 *   1. Headers purged (headerPurge.ts unit test)
 *   2. CSP headers file exists with correct directives
 *   3. Camera restricted to /report via Permissions-Policy
 *   4. Amnesia Audit component renders (file/structure check)
 *   5. No PII in Worker logic (source scan)
 *
 * Run: npx tsx tests/verificationGate4.ts
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
    console.log(' VERIFICATION GATE 4 — Amnesia Protocol & Security');
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

    if (failed > 0) {
        console.log('❌ VERIFICATION GATE 4 — FAILED');
        process.exit(1);
    } else {
        console.log('✅ VERIFICATION GATE 4 — ALL TESTS PASSED');
        process.exit(0);
    }
}

/* ═══════════════════════════════════════════════
   RUN ALL TESTS
   ═══════════════════════════════════════════════ */

async function runAll() {

    // ── Test 4.1: Headers Purged ─────────────────────
    await test('Headers purged — headerPurge strips all toxic + metadata headers', async () => {
        const {
            amnesiaHeaderPurge,
            extractGeoCountry,
            purgeHeaders,
            verifyPurged,
            TOXIC_HEADERS,
            METADATA_HEADERS,
            GEO_HEADER,
        } = await import('../workers/amnesia/headerPurge');

        // Verify exports exist
        assert(typeof amnesiaHeaderPurge === 'function', 'amnesiaHeaderPurge must be exported');
        assert(typeof extractGeoCountry === 'function', 'extractGeoCountry must be exported');
        assert(typeof purgeHeaders === 'function', 'purgeHeaders must be exported');
        assert(typeof verifyPurged === 'function', 'verifyPurged must be exported');
        assert(Array.isArray(TOXIC_HEADERS), 'TOXIC_HEADERS must be an array');
        assert(Array.isArray(METADATA_HEADERS), 'METADATA_HEADERS must be an array');
        assert(typeof GEO_HEADER === 'string', 'GEO_HEADER must be a string');

        // Ensure comprehensive header coverage
        assert(TOXIC_HEADERS.length >= 5, `TOXIC_HEADERS must have ≥5 entries, got ${TOXIC_HEADERS.length}`);
        assert(TOXIC_HEADERS.includes('x-real-ip'), 'Must include x-real-ip');
        assert(TOXIC_HEADERS.includes('cf-connecting-ip'), 'Must include cf-connecting-ip');
        assert(TOXIC_HEADERS.includes('x-forwarded-for'), 'Must include x-forwarded-for');
        assert(TOXIC_HEADERS.includes('forwarded'), 'Must include forwarded (RFC 7239)');
        assert(METADATA_HEADERS.includes('cf-ray'), 'METADATA_HEADERS must include cf-ray');

        // Create a mock request with PII headers
        const mockRequest = new Request('https://civicvoice.pages.dev/api/report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-real-ip': '102.88.34.56',
                'cf-connecting-ip': '102.88.34.56',
                'x-forwarded-for': '102.88.34.56, 172.70.1.2',
                'true-client-ip': '102.88.34.56',
                'forwarded': 'for=102.88.34.56',
                'cf-ipcountry': 'NG',
                'cf-ray': '8a1b2c3d4e5f-LAX',
                'cf-visitor': '{"scheme":"https"}',
                'user-agent': 'Mozilla/5.0',
            },
        });

        // Test geo extraction
        const country = extractGeoCountry(mockRequest);
        assert(country === 'NG', `Country should be "NG", got "${country}"`);

        // Test Cloudflare sentinel values
        const torReq = new Request('https://test.dev', { headers: { 'cf-ipcountry': 'T1' } });
        assert(extractGeoCountry(torReq) === null, 'Tor sentinel T1 should return null');

        const unknownReq = new Request('https://test.dev', { headers: { 'cf-ipcountry': 'XX' } });
        assert(extractGeoCountry(unknownReq) === null, 'Unknown sentinel XX should return null');

        // Test malformed country codes
        const invalidReq = new Request('https://test.dev', { headers: { 'cf-ipcountry': 'TOOLONG' } });
        assert(extractGeoCountry(invalidReq) === null, 'Malformed country code should return null');

        // Test full purge pipeline
        const { sanitizedRequest, countryCode, purgedCount } = amnesiaHeaderPurge(mockRequest);
        assert(countryCode === 'NG', `Country code should be "NG", got "${countryCode}"`);
        assert(purgedCount > 0, `purgedCount must be > 0, got ${purgedCount}`);

        // Verify ALL toxic headers are gone
        assert(!sanitizedRequest.headers.has('x-real-ip'), 'x-real-ip must be deleted');
        assert(!sanitizedRequest.headers.has('cf-connecting-ip'), 'cf-connecting-ip must be deleted');
        assert(!sanitizedRequest.headers.has('x-forwarded-for'), 'x-forwarded-for must be deleted');
        assert(!sanitizedRequest.headers.has('true-client-ip'), 'true-client-ip must be deleted');
        assert(!sanitizedRequest.headers.has('forwarded'), 'forwarded must be deleted');
        assert(!sanitizedRequest.headers.has('cf-ipcountry'), 'cf-ipcountry must be deleted');

        // Verify metadata headers are gone
        assert(!sanitizedRequest.headers.has('cf-ray'), 'cf-ray must be deleted');
        assert(!sanitizedRequest.headers.has('cf-visitor'), 'cf-visitor must be deleted');

        // Non-PII headers should survive
        assert(sanitizedRequest.headers.has('content-type'), 'content-type should survive purge');
        assert(sanitizedRequest.headers.has('user-agent'), 'user-agent should survive purge');

        // Verify purge validation
        assert(verifyPurged(sanitizedRequest) === true, 'Sanitized request must pass purge verification');
        assert(verifyPurged(mockRequest) === false, 'Original request must fail purge verification');
    });

    // ── Test 4.2: CSP Headers File ──────────────────
    await test('CSP headers set — _headers file contains production-grade directives', async () => {
        const headersPath = path.resolve(__dirname, '../public/_headers');
        assert(fs.existsSync(headersPath), '_headers file must exist in public/');

        const content = fs.readFileSync(headersPath, 'utf-8');

        // Check CSP is present with correct directives
        assert(content.includes('Content-Security-Policy'), 'Must contain Content-Security-Policy header');
        assert(content.includes("default-src 'self'"), "CSP must include default-src 'self'");
        assert(content.includes('connect-src'), 'CSP must include connect-src directive');
        assert(content.includes('*.cloudflare.com'), 'connect-src must allow *.cloudflare.com');
        assert(content.includes("frame-ancestors 'none'"), "CSP must include frame-ancestors 'none'");
        assert(content.includes("object-src 'none'"), "CSP must include object-src 'none' (plugin block)");
        assert(content.includes('worker-src'), 'CSP must include worker-src for PWA');
        assert(content.includes('upgrade-insecure-requests'), 'CSP must include upgrade-insecure-requests');

        // Check additional security headers
        assert(content.includes('X-Content-Type-Options'), 'Must include X-Content-Type-Options');
        assert(content.includes('nosniff'), 'X-Content-Type-Options must be nosniff');
        assert(content.includes('X-Frame-Options'), 'Must include X-Frame-Options');
        assert(content.includes('DENY'), 'X-Frame-Options must be DENY');
        assert(content.includes('Referrer-Policy'), 'Must include Referrer-Policy');
        assert(content.includes('Strict-Transport-Security'), 'Must include HSTS');
        assert(content.includes('Cross-Origin-Opener-Policy'), 'Must include COOP');
    });

    // ── Test 4.3: Camera Restricted to /report ──────
    await test('Camera restricted to /report — Permissions-Policy limits camera access', async () => {
        const headersPath = path.resolve(__dirname, '../public/_headers');
        const content = fs.readFileSync(headersPath, 'utf-8');

        // Global policy should restrict camera
        assert(content.includes('Permissions-Policy'), 'Must include Permissions-Policy header');
        assert(content.includes('camera=()'), 'Global Permissions-Policy must deny camera by default');
        assert(content.includes('interest-cohort=()'), 'Must opt out of FLoC');

        // /report route should allow camera
        assert(content.includes('/report'), 'Must have /report route-specific headers');
        assert(content.includes('camera=(self)'), '/report must allow camera=(self)');
        assert(content.includes('microphone=(self)'), '/report must allow microphone=(self)');
    });

    // ── Test 4.4: Amnesia Audit Renders ─────────────
    await test('Amnesia Audit — component + CSS production-ready with a11y', async () => {
        const filePath = path.resolve(__dirname, '../src/components/profile/AmnesiaAudit.tsx');
        assert(fs.existsSync(filePath), 'AmnesiaAudit.tsx must exist');

        const src = fs.readFileSync(filePath, 'utf-8');

        // Core component structure
        assert(src.includes('export default'), 'Must have default export');
        assert(src.includes('AmnesiaAudit'), 'Must export AmnesiaAudit component');
        assert(src.includes('AmnesiaAuditProps'), 'Must define AmnesiaAuditProps interface');
        assert(src.includes('AuditItem'), 'Must define AuditItem interface');

        // Required audit items from Component Spec
        assert(src.includes('IP LOG PURGED'), 'Must include "IP LOG PURGED" audit item');
        assert(src.includes('SESSION ROTATED'), 'Must include "SESSION ROTATED" audit item');
        assert(src.includes('METADATA STRIPPED'), 'Must include "METADATA STRIPPED" audit item');

        // Scanning animation logic
        assert(src.includes('scanning'), 'Must have scanning state');
        assert(src.includes('passed'), 'Must have passed state');
        assert(src.includes('pending'), 'Must have pending state');

        // Production patterns
        assert(src.includes('mountedRef'), 'Must use mountedRef for safe async updates');
        assert(src.includes('isScanningRef'), 'Must use isScanningRef to prevent stale closures');
        assert(src.includes('aria-label'), 'Must include ARIA labels for accessibility');
        assert(src.includes('aria-live'), 'Must include aria-live for screen reader updates');

        // Terminal styling references
        assert(src.includes('amnesia-audit'), 'Must reference amnesia-audit CSS class');
        assert(src.includes('[OK]'), 'Must display [OK] for passed items');
        assert(src.includes('[  ]'), 'Must display [  ] for pending items');

        // CSS file exists and is production-ready
        const cssPath = path.resolve(__dirname, '../src/styles/amnesia.css');
        assert(fs.existsSync(cssPath), 'amnesia.css must exist');
        const css = fs.readFileSync(cssPath, 'utf-8');
        assert(css.includes('.amnesia-audit'), 'CSS must contain .amnesia-audit class');
        assert(css.includes('auditLineReveal'), 'CSS must contain auditLineReveal keyframes');
        assert(css.includes('scanSweep'), 'CSS must contain scanSweep keyframes');
        assert(css.includes('terminalPulse'), 'CSS must contain terminalPulse keyframes');
        assert(css.includes('prefers-reduced-motion'), 'CSS must include prefers-reduced-motion for a11y');
        assert(css.includes('focus-visible'), 'CSS must include focus-visible styles');
        assert(css.includes('will-change'), 'CSS must include will-change for GPU compositing');

        // Profile.tsx integration
        const profilePath = path.resolve(__dirname, '../src/pages/Profile.tsx');
        const profileSrc = fs.readFileSync(profilePath, 'utf-8');
        assert(profileSrc.includes('AmnesiaAudit'), 'Profile.tsx must import AmnesiaAudit');
        assert(!profileSrc.includes('Module 4'), 'Profile.tsx should no longer reference "Module 4" placeholder');
        assert(profileSrc.includes('<AmnesiaAudit'), 'Profile.tsx must render <AmnesiaAudit');
    });

    // ── Test 4.5: No PII in Worker Logic ────────────
    await test('No PII in Worker logic — source scan confirms zero IP storage', async () => {
        const headerPurgePath = path.resolve(__dirname, '../workers/amnesia/headerPurge.ts');
        const logSuppressionPath = path.resolve(__dirname, '../workers/amnesia/logSuppression.ts');

        assert(fs.existsSync(headerPurgePath), 'headerPurge.ts must exist');
        assert(fs.existsSync(logSuppressionPath), 'logSuppression.ts must exist');

        const headerSrc = fs.readFileSync(headerPurgePath, 'utf-8');
        const logSrc = fs.readFileSync(logSuppressionPath, 'utf-8');

        // headerPurge.ts checks
        assert(headerSrc.includes('TOXIC_HEADERS'), 'Must define TOXIC_HEADERS constant');
        assert(headerSrc.includes('METADATA_HEADERS'), 'Must define METADATA_HEADERS constant');
        assert(headerSrc.includes('x-real-ip'), 'Must reference x-real-ip for deletion');
        assert(headerSrc.includes('cf-connecting-ip'), 'Must reference cf-connecting-ip for deletion');
        assert(headerSrc.includes('cf-ray'), 'Must reference cf-ray for metadata deletion');
        assert(headerSrc.includes('delete'), 'Must delete headers');
        assert(headerSrc.includes('purgeHeaders'), 'Must export purgeHeaders function');
        assert(headerSrc.includes('extractGeoCountry'), 'Must export extractGeoCountry function');
        assert(headerSrc.includes('verifyPurged'), 'Must export verifyPurged function');
        assert(headerSrc.includes('COUNTRY_CODE_RE'), 'Must validate country code format');

        // Ensure no IP storage patterns (no saving to DB, no logging IPs)
        assert(!headerSrc.includes('console.log(ip'), 'Must NOT log IP addresses');
        assert(!headerSrc.includes('saveIp'), 'Must NOT save IP addresses');
        assert(!headerSrc.includes('storeIp'), 'Must NOT store IP addresses');
        assert(!headerSrc.includes('ipAddress ='), 'Must NOT assign IP to variable named ipAddress');

        // logSuppression.ts checks
        assert(logSrc.includes('LOG_SUPPRESSED_ROUTES'), 'Must define LOG_SUPPRESSED_ROUTES');
        assert(logSrc.includes('/api/report'), 'Must suppress logs for /api/report');
        assert(logSrc.includes('/api/evidence'), 'Must suppress logs for /api/evidence');
        assert(logSrc.includes('isLogSuppressedRoute'), 'Must export isLogSuppressedRoute');
        assert(logSrc.includes('normalizePath'), 'Must normalize paths before comparison');
        assert(logSrc.includes('Amnesia'), 'Must reference Amnesia Protocol');

        // Test isLogSuppressedRoute with edge cases
        const { isLogSuppressedRoute } = await import('../workers/amnesia/logSuppression');
        assert(isLogSuppressedRoute('/api/report') === true, '/api/report must be suppressed');
        assert(isLogSuppressedRoute('/api/report/upload') === true, '/api/report/upload must be suppressed');
        assert(isLogSuppressedRoute('/api/evidence') === true, '/api/evidence must be suppressed');
        assert(isLogSuppressedRoute('/api/feed') === false, '/api/feed should NOT be suppressed');
        assert(isLogSuppressedRoute('/') === false, '/ should NOT be suppressed');
        assert(isLogSuppressedRoute('/api/report?id=123') === true, 'Query params must be stripped');
        assert(isLogSuppressedRoute('/api/report#hash') === true, 'Hash fragments must be stripped');
    });

    printResults();
}

runAll();
