/**
 * Verification Gate 8 — Module 8: Production Deployment & CI/CD
 *
 * 8 Tests:
 *   8.1  CI/CD Pipeline — deploy.yml exists with correct structure
 *   8.2  CI/CD Pipeline — deploy workflow builds and deploys
 *   8.3  Security Workflow — gitleaks scan configured
 *   8.4  Security Workflow — CSP validation, dependency audit, PII check
 *   8.5  Turnstile — component exports with siteKey, onVerify, validation helper
 *   8.6  Performance — Vite config optimized, PWA manifest, Service Worker
 *   8.7  Worker Secrets — wrangler.toml documents all required secrets
 *   8.8  End-to-end — _headers CSP, routing, Turnstile in SubmissionFlow
 *
 * Run: npx tsx tests/verificationGate8.ts
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
    console.log('\n══════════════════════════════════════════════════════');
    console.log(' VERIFICATION GATE 8 — Production Deployment & CI/CD');
    console.log('══════════════════════════════════════════════════════\n');

    let passed = 0;
    let failed = 0;

    results.forEach((r, i) => {
        const icon = r.passed ? '✓' : '✕';
        const color = r.passed ? '\x1b[32m' : '\x1b[31m';
        console.log(`  ${color}${icon}\x1b[0m Test 8.${i + 1}: ${r.name}`);
        if (!r.passed) console.log(`    → ${r.message}`);
        r.passed ? passed++ : failed++;
    });

    console.log(`\n  Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
    console.log('══════════════════════════════════════════════════════\n');

    if (failed > 0) process.exit(1);
}

/* ────────────────────── Helper Functions ──────────────────────── */

function readFile(relativePath: string): string {
    const filePath = path.resolve(__dirname, '..', relativePath);
    assert(fs.existsSync(filePath), `File not found: ${relativePath}`);
    return fs.readFileSync(filePath, 'utf-8');
}

function fileExists(relativePath: string): boolean {
    const filePath = path.resolve(__dirname, '..', relativePath);
    return fs.existsSync(filePath);
}

/* ──────────────────── Test 8.1: CI/CD Deploy Workflow Structure ──────────────────── */

await test('CI/CD Pipeline — deploy.yml exists with correct structure', () => {
    assert(fileExists('.github/workflows/deploy.yml'), 'Missing deploy.yml');
    const deploy = readFile('.github/workflows/deploy.yml');

    // Trigger configuration
    assert(
        deploy.includes('push:') && deploy.includes('pull_request:'),
        'Deploy workflow must trigger on push and pull_request'
    );
    assert(
        deploy.includes('branches: [main]'),
        'Deploy workflow must target main branch'
    );

    // Required jobs
    assert(deploy.includes('build:'), 'Missing build job');
    assert(deploy.includes('security:'), 'Missing security job');
    assert(deploy.includes('deploy:'), 'Missing deploy job');

    // Node.js setup
    assert(
        deploy.includes('actions/setup-node@v4'),
        'Must use actions/setup-node@v4'
    );
});

/* ──────────────────── Test 8.2: Deploy Workflow Builds and Deploys ──────────────────── */

await test('CI/CD Pipeline — deploy workflow builds and deploys', () => {
    const deploy = readFile('.github/workflows/deploy.yml');

    // Build steps
    assert(deploy.includes('npm ci'), 'Missing npm ci step');
    assert(deploy.includes('npm run lint'), 'Missing lint step');
    assert(deploy.includes('npm run build'), 'Missing build step');

    // TypeScript check
    assert(
        deploy.includes('tsc'),
        'Missing TypeScript check step'
    );

    // Cloudflare deployment
    assert(
        deploy.includes('cloudflare/wrangler-action@v3'),
        'Must use cloudflare/wrangler-action@v3 for deployment'
    );
    assert(
        deploy.includes('CLOUDFLARE_API_TOKEN') && deploy.includes('CLOUDFLARE_ACCOUNT_ID'),
        'Must reference CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID secrets'
    );

    // Pages deploy command
    assert(
        deploy.includes('pages deploy'),
        'Must include pages deploy command'
    );

    // Workers deploy for production
    assert(
        deploy.includes("refs/heads/main") && deploy.includes('command: deploy'),
        'Must deploy Workers API on merge to main'
    );
});

/* ──────────────────── Test 8.3: Security Workflow — Gitleaks ──────────────────── */

await test('Security Workflow — gitleaks scan configured', () => {
    assert(fileExists('.github/workflows/security.yml'), 'Missing security.yml');
    const security = readFile('.github/workflows/security.yml');

    // Gitleaks job
    assert(security.includes('gitleaks'), 'Missing gitleaks reference');
    assert(
        security.includes('gitleaks/gitleaks-action@v2'),
        'Must use gitleaks/gitleaks-action@v2'
    );

    // Triggers on all branches
    assert(
        security.includes("branches: ['*']"),
        'Security workflow should run on all branches'
    );

    // Gitleaks config file
    assert(fileExists('.gitleaks.toml'), 'Missing .gitleaks.toml config');
    const gitleaksConfig = readFile('.gitleaks.toml');
    assert(
        gitleaksConfig.includes('[allowlist]'),
        'Gitleaks config must have an allowlist section'
    );
});

/* ──────────────────── Test 8.4: Security Workflow — CSP, Deps, PII ──────────────────── */

await test('Security Workflow — CSP validation, dependency audit, PII check', () => {
    const security = readFile('.github/workflows/security.yml');

    // CSP validation job
    assert(
        security.includes('csp-validation'),
        'Missing CSP validation job'
    );
    assert(
        security.includes('default-src') && security.includes('script-src'),
        'CSP validation must check for required directives'
    );

    // Dependency audit job
    assert(
        security.includes('dependency-audit'),
        'Missing dependency audit job'
    );
    assert(
        security.includes('npm audit'),
        'Must run npm audit'
    );

    // PII check job
    assert(
        security.includes('pii-check') || security.includes('No-PII'),
        'Missing PII/privacy check job'
    );

    // Security headers validation
    assert(
        security.includes('X-Frame-Options') && security.includes('Strict-Transport-Security'),
        'Must validate security headers'
    );
});

/* ──────────────────── Test 8.5: Turnstile Component ──────────────────── */

await test('Turnstile — component exports with siteKey, onVerify, validation helper', () => {
    assert(fileExists('src/components/ui/Turnstile.tsx'), 'Missing Turnstile.tsx');
    const turnstile = readFile('src/components/ui/Turnstile.tsx');

    // Component export
    assert(
        turnstile.includes('export function Turnstile') || turnstile.includes('export default Turnstile'),
        'Missing Turnstile component export'
    );

    // Props: siteKey, onVerify
    assert(
        turnstile.includes('siteKey') && turnstile.includes('onVerify'),
        'Turnstile must accept siteKey and onVerify props'
    );

    // Privacy-first: Cloudflare challenges URL
    assert(
        turnstile.includes('challenges.cloudflare.com'),
        'Must use Cloudflare Turnstile API'
    );

    // Server-side validation helper
    assert(
        turnstile.includes('validateTurnstileToken'),
        'Missing server-side validateTurnstileToken helper'
    );
    assert(
        turnstile.includes('siteverify'),
        'Validation must call Turnstile siteverify endpoint'
    );

    // Error handling
    assert(
        turnstile.includes('onError') && turnstile.includes('onExpire'),
        'Must handle error and token expiry callbacks'
    );

    // Widget cleanup
    assert(
        turnstile.includes('turnstile.remove'),
        'Must clean up widget on unmount'
    );

    // Turnstile in SubmissionFlow
    assert(fileExists('src/components/witness/SubmissionFlow.tsx'), 'Missing SubmissionFlow.tsx');
    const submission = readFile('src/components/witness/SubmissionFlow.tsx');
    assert(
        submission.includes('Turnstile') || submission.includes('turnstile'),
        'SubmissionFlow should integrate Turnstile for bot prevention'
    );
});

/* ──────────────────── Test 8.6: Performance & PWA ──────────────────── */

await test('Performance — Vite config optimized, PWA manifest, Service Worker', () => {
    // Vite config optimizations
    const vite = readFile('vite.config.ts');
    assert(
        vite.includes('manualChunks'),
        'Vite must configure manual chunks for code splitting'
    );
    assert(
        vite.includes("minify: 'esbuild'") || vite.includes('minify:'),
        'Vite must enable minification'
    );
    assert(
        vite.includes('cssMinify'),
        'Vite must enable CSS minification'
    );

    // PWA Manifest
    assert(fileExists('public/manifest.json'), 'Missing manifest.json');
    const manifest = readFile('public/manifest.json');
    assert(
        manifest.includes('"standalone"') && manifest.includes('"CivicVoice"'),
        'Manifest must set display:standalone and name:CivicVoice'
    );
    assert(
        manifest.includes('icon-192') && manifest.includes('icon-512'),
        'Manifest must include 192x192 and 512x512 icons'
    );

    // Service Worker
    assert(fileExists('public/sw.js'), 'Missing Service Worker (sw.js)');
    const sw = readFile('public/sw.js');
    assert(
        sw.includes("addEventListener('install'") && sw.includes("addEventListener('fetch'"),
        'Service Worker must handle install and fetch events'
    );
    assert(
        sw.includes('cacheFirst') || sw.includes('cache-first') || sw.includes('Cache-First'),
        'Service Worker must implement cache-first strategy for static assets'
    );
    assert(
        sw.includes('networkFirst') || sw.includes('network-first') || sw.includes('Network-First'),
        'Service Worker must implement network-first strategy for API calls'
    );

    // Service Worker registration in index.html
    const indexHtml = readFile('index.html');
    assert(
        indexHtml.includes('serviceWorker') || indexHtml.includes('sw.js'),
        'index.html must register the Service Worker'
    );

    // Font optimization — preconnect
    assert(
        indexHtml.includes("rel=\"preconnect\"") && indexHtml.includes("fonts.googleapis.com"),
        'Must preconnect to Google Fonts'
    );
});

/* ──────────────────── Test 8.7: Worker Secrets ──────────────────── */

await test('Worker Secrets — wrangler.toml documents all required secrets', () => {
    const wrangler = readFile('wrangler.toml');

    // Required secrets documented
    const requiredSecrets = ['ADMIN_SECRET', 'TURNSTILE_SECRET'];
    for (const secret of requiredSecrets) {
        assert(
            wrangler.includes(secret),
            `Missing documentation for required secret: ${secret}`
        );
    }

    // Production environment
    assert(
        wrangler.includes('[env.production]'),
        'Must have production environment configured'
    );

    // D1 binding
    assert(
        wrangler.includes('[[d1_databases]]'),
        'Must have D1 database binding'
    );

    // No actual secrets in the file
    const secretPatterns = [
        /sk_live_[0-9a-zA-Z]{20,}/,
        /AKIA[0-9A-Z]{16}/,
        /AIza[0-9A-Za-z_-]{35}/,
    ];
    for (const pattern of secretPatterns) {
        assert(
            !pattern.test(wrangler),
            'wrangler.toml must NOT contain actual secret values'
        );
    }

    // .gitignore exists and excludes sensitive files
    assert(fileExists('.gitignore'), 'Missing .gitignore');
    const gitignore = readFile('.gitignore');
    assert(
        gitignore.includes('.env') || gitignore.includes('*.local'),
        '.gitignore must exclude .env or *.local files'
    );
});

/* ──────────────────── Test 8.8: End-to-End Integration ──────────────────── */

await test('End-to-end — _headers CSP, routing, Turnstile integration', () => {
    // _headers file with CSP
    assert(fileExists('public/_headers'), 'Missing public/_headers');
    const headers = readFile('public/_headers');
    assert(
        headers.includes('Content-Security-Policy') && headers.includes("default-src 'self'"),
        'Must have Content-Security-Policy with default-src self'
    );
    assert(
        headers.includes('challenges.cloudflare.com'),
        'CSP must allow Turnstile challenges.cloudflare.com'
    );

    // App.tsx routing
    const app = readFile('src/App.tsx');
    assert(
        app.includes("'/admin'") || app.includes('"/admin"'),
        'Must have /admin route'
    );
    assert(
        app.includes("'/'") || app.includes('"/"'),
        'Must have / home route'
    );
    assert(
        app.includes("'/report'") || app.includes('"/report"'),
        'Must have /report route'
    );

    // Workers router handles admin
    const workersIndex = readFile('workers/index.ts');
    assert(
        workersIndex.includes("'/api/admin'") && workersIndex.includes("'/api/report'"),
        'Workers router must handle /api/admin and /api/report routes'
    );

    // index.html SEO
    const indexHtml = readFile('index.html');
    assert(
        indexHtml.includes('<title>') && indexHtml.includes('meta name="description"'),
        'Must have title tag and meta description for SEO'
    );

    // Turnstile CSS styling exists
    const turnstileSrc = readFile('src/components/ui/Turnstile.tsx');
    assert(
        turnstileSrc.includes('turnstile-container'),
        'Turnstile must use turnstile-container CSS class'
    );

    // HSTS configured
    assert(
        headers.includes('max-age=31536000'),
        'Must have HSTS with 1 year max-age'
    );
});

/* ──────────────────── Print Results ──────────────────── */

printResults();
