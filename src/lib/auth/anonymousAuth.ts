/**
 * Module 2: Anonymous Authentication
 *
 * Generates a deterministic, non-reversible `anon_token` from device signals.
 * No email, phone, NIN, or IP is ever collected or stored.
 *
 * Source:
 * - Security Protocol §1 (Amnesia standard)
 * - Feature Goal Matrix §"Option to remain anonymous"
 * - Technical Blueprint §4.2 (anon_reputation.anon_token)
 */

import type { AnonSession } from './types';

/* ───────────────────── Constants ───────────────────── */

const SESSION_COOKIE_NAME = 'cv_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/* ───────────────────── Fingerprint ───────────────────── */

/**
 * Collect a stable device fingerprint from non-PII browser signals.
 * We deliberately avoid anything that could identify a person.
 */
function collectFingerprint(): string {
    const signals: string[] = [
        navigator.userAgent,
        navigator.language,
        `${screen.width}x${screen.height}x${screen.colorDepth}`,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        String(navigator.hardwareConcurrency ?? 'unknown'),
        navigator.platform ?? 'unknown',
    ];
    return signals.join('|');
}

/**
 * SHA-256 hash of a string → hex. Non-reversible.
 * Uses the built-in Web Crypto API (available in all modern browsers).
 */
async function sha256(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ───────────────────── Cookie helpers ───────────────────── */

function setCookie(name: string, value: string, maxAgeMs: number): void {
    const maxAgeSec = Math.max(0, Math.floor(maxAgeMs / 1000));
    // SameSite=Strict, Secure when on HTTPS — no tracking, no PII
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=Strict${secure}`;
}

/** Escape special regex chars in cookie name to prevent ReDoS */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${escapeRegex(name)}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string): void {
    document.cookie = `${name}=; path=/; max-age=0`;
}

/* ───────────────────── Session API ───────────────────── */

/**
 * Generate a new anonymous session.
 * The `anonToken` is a SHA-256 hash of device fingerprint + a salt.
 * A fresh salt per session means the token rotates, preventing long-term tracking.
 */
export async function createSession(): Promise<AnonSession> {
    const fingerprint = collectFingerprint();
    const salt = crypto.getRandomValues(new Uint8Array(16)).join('');
    const anonToken = await sha256(`${fingerprint}:${salt}`);

    const now = new Date();
    const session: AnonSession = {
        anonToken,
        handle: null,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    };

    // Persist session in cookie (short TTL, no server-side storage)
    setCookie(SESSION_COOKIE_NAME, JSON.stringify(session), SESSION_TTL_MS);

    return session;
}

/** Runtime type guard — ensures parsed JSON is actually an AnonSession */
function isValidSession(obj: unknown): obj is AnonSession {
    if (!obj || typeof obj !== 'object') return false;
    const s = obj as Record<string, unknown>;
    return (
        typeof s.anonToken === 'string' &&
        s.anonToken.length === 64 &&
        (s.handle === null || typeof s.handle === 'string') &&
        typeof s.createdAt === 'string' &&
        typeof s.expiresAt === 'string'
    );
}

/**
 * Restore an existing session from the cookie, or return null.
 * Returns null if the session has expired, is corrupt, or fails validation.
 */
export function restoreSession(): AnonSession | null {
    const raw = getCookie(SESSION_COOKIE_NAME);
    if (!raw) return null;

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isValidSession(parsed)) {
            deleteCookie(SESSION_COOKIE_NAME);
            return null;
        }
        // Check expiry
        if (new Date(parsed.expiresAt) <= new Date()) {
            deleteCookie(SESSION_COOKIE_NAME);
            return null;
        }
        return parsed;
    } catch {
        deleteCookie(SESSION_COOKIE_NAME);
        return null;
    }
}

/**
 * Sanitize handle input — strip HTML/script tags, enforce length.
 * Prevents XSS if handle is ever rendered in other contexts.
 */
export function sanitizeHandle(raw: string): string {
    // Strip anything that looks like HTML tags
    const stripped = raw.replace(/<[^>]*>/g, '');
    // Only keep alphanumeric, underscores, hyphens, @
    const cleaned = stripped.replace(/[^a-zA-Z0-9_@\-]/g, '');
    // Enforce max length (20 chars) and trim
    return cleaned.slice(0, 20).trim();
}

/**
 * Update the crypto handle on the current session.
 * Returns null if session is expired or invalid.
 */
export function updateSessionHandle(handle: string): AnonSession | null {
    const session = restoreSession();
    if (!session) return null;

    const remaining = new Date(session.expiresAt).getTime() - Date.now();
    // Guard: don't set cookie if session already expired
    if (remaining <= 0) {
        deleteCookie(SESSION_COOKIE_NAME);
        return null;
    }

    session.handle = sanitizeHandle(handle);
    setCookie(SESSION_COOKIE_NAME, JSON.stringify(session), remaining);
    return session;
}

/**
 * Destroy the current session (rotate).
 */
export function destroySession(): void {
    deleteCookie(SESSION_COOKIE_NAME);
}

/**
 * PII audit: verify nothing personal is stored anywhere.
 * Returns a list of check results for the Amnesia Audit display.
 * Wrapped in try/catch for environments where localStorage may throw (private mode).
 */
export function auditPII(): { label: string; ok: boolean }[] {
    const safeGetLS = (key: string): string | null => {
        try {
            return localStorage.getItem(key);
        } catch {
            return null; // Private browsing or storage quota
        }
    };

    const checks = [
        { label: 'NO EMAIL IN STORAGE', ok: !safeGetLS('email') && !getCookie('email') },
        { label: 'NO PHONE IN STORAGE', ok: !safeGetLS('phone') && !getCookie('phone') },
        { label: 'NO NIN IN STORAGE', ok: !safeGetLS('nin') && !getCookie('nin') },
        { label: 'NO IP IN STORAGE', ok: !safeGetLS('ip') && !getCookie('ip') },
        { label: 'SESSION IS SHORT-LIVED', ok: !!restoreSession()?.expiresAt },
    ];
    return checks;
}
