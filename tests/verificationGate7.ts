/**
 * Verification Gate 7 — Module 7: Admin Dashboard & Observability
 *
 * 8 Tests:
 *   7.1  D1 Schema — admin_activity_log table exists with correct columns
 *   7.2  D1 Schema — platform_metrics table exists with correct columns
 *   7.3  Admin Worker API — exports handleAdmin, validateAdminToken, logAdminActivity
 *   7.4  Admin Worker API — auth guard rejects missing/invalid tokens
 *   7.5  Workers Router — /api/admin routes wired into index.ts
 *   7.6  Admin Dashboard — page component exports and renders auth gate
 *   7.7  Admin Panel Components — all 5 panels export correctly
 *   7.8  Admin CSS & Route — admin.css exists, /admin route in App.tsx
 *
 * Run: npx tsx tests/verificationGate7.ts
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
    console.log(' VERIFICATION GATE 7 — Admin Dashboard & Observability');
    console.log('══════════════════════════════════════════════════════\n');

    let passed = 0;
    let failed = 0;

    results.forEach((r, i) => {
        const icon = r.passed ? '✓' : '✕';
        const color = r.passed ? '\x1b[32m' : '\x1b[31m';
        console.log(`  ${color}${icon}\x1b[0m Test 7.${i + 1}: ${r.name}`);
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

/* ──────────────────── Test 7.1: admin_activity_log Table ──────────────────── */

await test('D1 Schema — admin_activity_log table', () => {
    const schema = readFile('db/schema.sql');

    assert(
        schema.includes('CREATE TABLE IF NOT EXISTS admin_activity_log'),
        'Missing admin_activity_log table definition'
    );

    // Required columns
    const requiredColumns = [
        'event_id', 'event_type', 'target_id', 'geo_label', 'details', 'created_at'
    ];
    for (const col of requiredColumns) {
        assert(schema.includes(col), `Missing column '${col}' in admin_activity_log`);
    }

    // CHECK constraint on event_type
    assert(
        schema.includes("'report_submitted'") && schema.includes("'rate_limit_hit'"),
        'Missing CHECK constraint enum values on event_type'
    );

    // Indexes
    assert(
        schema.includes('idx_activity_created'),
        'Missing idx_activity_created index'
    );
    assert(
        schema.includes('idx_activity_type'),
        'Missing idx_activity_type index'
    );
});

/* ──────────────────── Test 7.2: platform_metrics Table ──────────────────── */

await test('D1 Schema — platform_metrics table', () => {
    const schema = readFile('db/schema.sql');

    assert(
        schema.includes('CREATE TABLE IF NOT EXISTS platform_metrics'),
        'Missing platform_metrics table definition'
    );

    // Required columns
    const requiredColumns = [
        'date', 'total_reports', 'total_users', 'flagged_count', 'verified_count',
        'storage_bytes', 'worker_invocations', 'rate_limit_hits', 'created_at', 'updated_at'
    ];
    for (const col of requiredColumns) {
        assert(schema.includes(col), `Missing column '${col}' in platform_metrics`);
    }

    // date is primary key
    assert(
        schema.includes('date            TEXT PRIMARY KEY'),
        'date column should be TEXT PRIMARY KEY'
    );
});

/* ──────────────────── Test 7.3: Admin Worker API Exports ──────────────────── */

await test('Admin Worker API — exports handleAdmin, validateAdminToken, logAdminActivity', async () => {
    const adminSrc = readFile('workers/api/admin.ts');

    // Exported functions
    assert(
        adminSrc.includes('export async function handleAdmin'),
        'Missing export: handleAdmin'
    );
    assert(
        adminSrc.includes('export function validateAdminToken'),
        'Missing export: validateAdminToken'
    );
    assert(
        adminSrc.includes('export async function logAdminActivity'),
        'Missing export: logAdminActivity'
    );

    // Route handling
    assert(
        adminSrc.includes("'stats'") && adminSrc.includes("'moderation'") &&
        adminSrc.includes("'moderate'") && adminSrc.includes("'activity'"),
        'Missing one or more admin routes (stats, moderation, moderate, activity)'
    );

    // CORS headers
    assert(
        adminSrc.includes('Access-Control-Allow-Origin'),
        'Missing CORS headers in admin API'
    );

    // Env interface with ADMIN_SECRET
    assert(
        adminSrc.includes('ADMIN_SECRET'),
        'Missing ADMIN_SECRET in AdminEnv interface'
    );
});

/* ──────────────────── Test 7.4: Auth Guard Logic ──────────────────── */

await test('Admin Worker API — auth guard rejects missing/invalid tokens', () => {
    const adminSrc = readFile('workers/api/admin.ts');

    // Bearer token extraction
    assert(
        adminSrc.includes("'Bearer'") || adminSrc.includes('"Bearer"'),
        'Auth guard should parse Bearer token scheme'
    );

    // 403 response for invalid token
    assert(
        adminSrc.includes('403') && adminSrc.includes('Access denied'),
        'Auth guard should return 403 with "Access denied" message'
    );

    // Constant-time comparison (XOR-based)
    assert(
        adminSrc.includes('charCodeAt') && adminSrc.includes('mismatch'),
        'Auth guard should use constant-time comparison (XOR) to prevent timing attacks'
    );

    // Missing auth header check
    assert(
        adminSrc.includes("get('Authorization')"),
        'Auth guard should read Authorization header'
    );

    // Token truncation for privacy in responses
    assert(
        adminSrc.includes("substring(0, 8)"),
        'API responses should truncate anon_tokens to 8 chars for privacy'
    );
});

/* ──────────────────── Test 7.5: Workers Router Integration ──────────────────── */

await test('Workers Router — /api/admin routes wired into index.ts', () => {
    const indexSrc = readFile('workers/index.ts');

    // Import
    assert(
        indexSrc.includes("import { handleAdmin } from './api/admin'"),
        'Missing handleAdmin import in workers/index.ts'
    );

    // Route matching
    assert(
        indexSrc.includes("pathname.startsWith('/api/admin')"),
        'Missing /api/admin route match in workers/index.ts'
    );

    // handleAdmin call
    assert(
        indexSrc.includes('handleAdmin(processedRequest, env)'),
        'Missing handleAdmin dispatch call'
    );

    // ADMIN_SECRET in Env interface
    assert(
        indexSrc.includes('ADMIN_SECRET'),
        'Missing ADMIN_SECRET in Env interface'
    );
});

/* ──────────────────── Test 7.6: AdminDashboard Page ──────────────────── */

await test('Admin Dashboard — page component with auth gate', () => {
    const dashSrc = readFile('src/pages/admin/AdminDashboard.tsx');

    // Component export
    assert(
        dashSrc.includes('export function AdminDashboard') || dashSrc.includes('export default AdminDashboard'),
        'Missing AdminDashboard export'
    );

    // Auth gate — access denied screen
    assert(
        dashSrc.includes('admin-access-denied') || dashSrc.includes('Access Denied'),
        'Missing access denied / auth gate screen'
    );

    // Token input form
    assert(
        dashSrc.includes('type="password"') && dashSrc.includes('admin token'),
        'Missing token input form on auth gate'
    );

    // API fetch calls (uses API_BASE constant with template literals)
    assert(
        dashSrc.includes("API_BASE") &&
        dashSrc.includes("/stats") &&
        dashSrc.includes("/moderation") &&
        dashSrc.includes("/activity"),
        'Missing API fetch calls for stats, moderation, activity'
    );

    // Auto-refresh
    assert(
        dashSrc.includes('setInterval') || dashSrc.includes('REFRESH_INTERVAL'),
        'Missing auto-refresh mechanism'
    );

    // Panel imports
    assert(
        dashSrc.includes('PlatformHealthPanel') &&
        dashSrc.includes('ContentModerationPanel') &&
        dashSrc.includes('UserActivityPanel') &&
        dashSrc.includes('CostMonitorPanel') &&
        dashSrc.includes('ActivityLogPanel'),
        'Missing one or more panel component imports'
    );

    // Admin CSS import
    assert(
        dashSrc.includes('admin.css'),
        'Missing admin.css import'
    );
});

/* ──────────────────── Test 7.7: Panel Components ──────────────────── */

await test('Admin Panel Components — all 5 panels export correctly', () => {
    // Check each panel component exists and exports correctly
    const panels = [
        { file: 'src/components/admin/PlatformHealthPanel.tsx', name: 'PlatformHealthPanel', features: ['stat-grid', 'sparkline', 'meter-bar'] },
        { file: 'src/components/admin/ContentModerationPanel.tsx', name: 'ContentModerationPanel', features: ['moderation-list', 'mod-btn', 'approve'] },
        { file: 'src/components/admin/UserActivityPanel.tsx', name: 'UserActivityPanel', features: ['distribution-chart', 'dist-bar', 'Sybil'] },
        { file: 'src/components/admin/CostMonitorPanel.tsx', name: 'CostMonitorPanel', features: ['meter-bar', 'budget-alert', 'FREE_TIER_LIMITS'] },
        { file: 'src/components/admin/ActivityLogPanel.tsx', name: 'ActivityLogPanel', features: ['activity-feed', 'activity-item', 'activity-type'] },
    ];

    for (const panel of panels) {
        assert(fileExists(panel.file), `Panel file not found: ${panel.file}`);
        const src = readFile(panel.file);

        assert(
            src.includes(`export function ${panel.name}`) || src.includes(`export default ${panel.name}`),
            `Missing export for ${panel.name}`
        );

        for (const feature of panel.features) {
            assert(
                src.includes(feature),
                `Missing feature '${feature}' in ${panel.name}`
            );
        }
    }

    // Shared types file
    assert(fileExists('src/components/admin/adminTypes.ts'), 'Missing adminTypes.ts');
    const types = readFile('src/components/admin/adminTypes.ts');
    assert(types.includes('PlatformStats'), 'Missing PlatformStats type');
    assert(types.includes('FlaggedReport'), 'Missing FlaggedReport type');
    assert(types.includes('ActivityEvent'), 'Missing ActivityEvent type');
    assert(types.includes('FREE_TIER_LIMITS'), 'Missing FREE_TIER_LIMITS constant');
});

/* ──────────────────── Test 7.8: Admin CSS & Route ──────────────────── */

await test('Admin CSS & Route — styling and routing configured', () => {
    // CSS file exists
    assert(fileExists('src/styles/admin.css'), 'Missing admin.css');
    const css = readFile('src/styles/admin.css');

    // Key CSS classes
    const requiredClasses = [
        '.admin-dashboard', '.admin-header', '.admin-grid', '.admin-panel',
        '.stat-grid', '.stat-card', '.meter-bar', '.moderation-list',
        '.moderation-item', '.mod-btn', '.activity-feed', '.activity-item',
        '.admin-access-denied', '.budget-alert',
    ];
    for (const cls of requiredClasses) {
        assert(css.includes(cls), `Missing CSS class: ${cls}`);
    }

    // Security Mode theme (dark background)
    assert(
        css.includes('var(--bg-obsidian)') || css.includes('#0D1117'),
        'Missing Security Mode dark theme'
    );

    // Responsive breakpoints
    assert(
        css.includes('@media (max-width: 768px)'),
        'Missing responsive breakpoint at 768px'
    );

    // App.tsx route
    const appSrc = readFile('src/App.tsx');
    assert(
        appSrc.includes("'/admin'") || appSrc.includes('"/admin"'),
        'Missing /admin route in App.tsx'
    );
    assert(
        appSrc.includes('AdminDashboard'),
        'Missing AdminDashboard component reference in App.tsx'
    );
    assert(
        appSrc.includes('lazy(') || appSrc.includes('React.lazy('),
        'Admin route should use lazy loading for code-splitting'
    );
    assert(
        appSrc.includes('Suspense'),
        'Admin route should use Suspense for lazy loading fallback'
    );

    // wrangler.toml — ADMIN_SECRET mention
    const wrangler = readFile('wrangler.toml');
    assert(
        wrangler.includes('ADMIN_SECRET'),
        'Missing ADMIN_SECRET documentation in wrangler.toml'
    );
});

/* ──────────────────── Print Results ──────────────────── */

printResults();
