/**
 * Verification Gate 2 — Unit Tests
 * 
 * Tests 2.3 and 2.4 from the implementation plan:
 * 2.3: Reputation score computes (Sybil weighting works)
 * 2.4: Level gating works (video blocked < 1000, allowed ≥ 1000)
 * 
 * Run: npx tsx tests/verificationGate2.ts
 */

// ── Node.js polyfills (localStorage, document.cookie) ──
const store = new Map<string, string>();
(globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
};

import {
    calculateLevel,
    canUploadVideo,
    applyLocationDiversity,
    computeEventPoints,
    createProfile,
    awardPoints,
    POINT_VALUES,
    getLevelProgress,
    getPointsToNextLevel,
} from '../src/lib/auth/reputationEngine';
import type { ScoreEvent } from '../src/lib/auth/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string): void {
    if (condition) {
        console.log(`  ✅ PASS: ${testName}`);
        passed++;
    } else {
        console.log(`  ❌ FAIL: ${testName}`);
        failed++;
    }
}

console.log('\n═══════════════════════════════════════════');
console.log('  VERIFICATION GATE 2 — Unit Tests');
console.log('═══════════════════════════════════════════\n');

/* ─── Test 2.3: Reputation Score Computes ─── */
console.log('📋 Test 2.3: Reputation score computes\n');

// Level calculation
assert(calculateLevel(0) === 'junior', 'Level 0 → Junior');
assert(calculateLevel(500) === 'junior', 'Level 500 → Junior');
assert(calculateLevel(999) === 'junior', 'Level 999 → Junior');
assert(calculateLevel(1000) === 'advanced', 'Level 1000 → Advanced');
assert(calculateLevel(5000) === 'advanced', 'Level 5000 → Advanced');

// Score increment on verified report
const profile1 = createProfile('test-token-1');
const reportEvent: ScoreEvent = {
    type: 'verified-report',
    basePoints: POINT_VALUES['verified-report'],
};
const afterReport = awardPoints(profile1, reportEvent);
assert(afterReport.points === 150, `Verified report awards 150 pts (got ${afterReport.points})`);
assert(afterReport.verifiedReports === 1, `Verified reports count incremented (got ${afterReport.verifiedReports})`);

// Score increment on peer upvote (no Sybil)
const upvoteEvent: ScoreEvent = {
    type: 'peer-upvote',
    basePoints: POINT_VALUES['peer-upvote'],
    locationDiversityFactor: 1.0, // Fully diverse
};
const afterUpvote = awardPoints(afterReport, upvoteEvent);
assert(afterUpvote.points === 160, `Peer upvote adds 10 pts (got ${afterUpvote.points})`);
assert(afterUpvote.peerUpvotes === 1, `Peer upvotes count incremented (got ${afterUpvote.peerUpvotes})`);

// Sybil weighting — 100 same-tower votes = 1 point
console.log('\n📋 Sybil Defense Tests\n');

const sameLocationPoints = applyLocationDiversity(10, 0.01);
assert(sameLocationPoints === 0, `Same-tower: 10 * 0.01 = 0 (floored) (got ${sameLocationPoints})`);

const diversePoints = applyLocationDiversity(10, 1.0);
assert(diversePoints === 10, `Fully diverse: 10 * 1.0 = 10 (got ${diversePoints})`);

const halfDiversePoints = applyLocationDiversity(10, 0.5);
assert(halfDiversePoints === 5, `Half diverse: 10 * 0.5 = 5 (got ${halfDiversePoints})`);

// Sybil event computation
const sybilEvent: ScoreEvent = {
    type: 'sybil-upvote',
    basePoints: 10,
    locationDiversityFactor: 0.01, // Same tower
};
const sybilPoints = computeEventPoints(sybilEvent);
assert(sybilPoints === 0, `Sybil upvote awards 0 pts (10 * 0.01 floored) (got ${sybilPoints})`);

/* ─── Test 2.4: Level Gating Works ─── */
console.log('\n📋 Test 2.4: Level gating (video upload)\n');

// Video blocked below 1000
assert(!canUploadVideo(0), 'Video blocked at 0 points');
assert(!canUploadVideo(500), 'Video blocked at 500 points');
assert(!canUploadVideo(999), 'Video blocked at 999 points');

// Video allowed at 1000+
assert(canUploadVideo(1000), 'Video allowed at 1000 points');
assert(canUploadVideo(2000), 'Video allowed at 2000 points');

// Achievement of Advanced through accumulated events
const profile2 = createProfile('test-token-2');
let current = profile2;
// Award 7 verified reports (7 * 150 = 1050 pts)
for (let i = 0; i < 7; i++) {
    current = awardPoints(current, {
        type: 'verified-report',
        basePoints: 150,
    });
}
assert(current.points === 1050, `7 verified reports = 1050 pts (got ${current.points})`);
assert(current.level === 'advanced', `Level is Advanced (got ${current.level})`);
assert(current.canUploadVideo === true, `Video upload unlocked (got ${current.canUploadVideo})`);

// Additional utility tests
console.log('\n📋 Utility function tests\n');
assert(getLevelProgress(500) === 0.5, `Progress at 500 = 50% (got ${getLevelProgress(500)})`);
assert(getLevelProgress(1000) === 1, `Progress at 1000 = 100% (got ${getLevelProgress(1000)})`);
assert(getPointsToNextLevel(750) === 250, `250 pts to next level from 750 (got ${getPointsToNextLevel(750)})`);
assert(getPointsToNextLevel(1000) === 0, `0 pts to next level from 1000 (got ${getPointsToNextLevel(1000)})`);

/* ─── Summary ─── */
console.log('\n═══════════════════════════════════════════');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════\n');

if (failed > 0) {
    console.log('❌ VERIFICATION GATE 2 — FAILED');
    process.exit(1);
} else {
    console.log('✅ VERIFICATION GATE 2 — ALL TESTS PASSED');
    process.exit(0);
}
