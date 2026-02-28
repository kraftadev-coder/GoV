/**
 * Turnstile — Module 8: Production Deployment
 *
 * Cloudflare Turnstile CAPTCHA component — privacy-first verification.
 * No cookies, no tracking. Verifies the user is human before allowing
 * report submission.
 *
 * Usage:
 *   <Turnstile
 *     siteKey="0x..."
 *     onVerify={(token) => setToken(token)}
 *     onError={() => setError('Verification failed')}
 *   />
 *
 * Source: Technical Blueprint §7, Security Protocol §5
 */

import { useEffect, useRef, useCallback, useState } from 'react';

/* ─── Types ─── */

interface TurnstileProps {
    /** Turnstile site key from Cloudflare Dashboard */
    siteKey: string;
    /** Called with verification token on success */
    onVerify: (token: string) => void;
    /** Called when verification fails or expires */
    onError?: (error: string) => void;
    /** Called when token expires (user must re-verify) */
    onExpire?: () => void;
    /** Theme: auto, light, or dark */
    theme?: 'auto' | 'light' | 'dark';
    /** Size: normal or compact */
    size?: 'normal' | 'compact';
    /** Accessibility label */
    'aria-label'?: string;
}

interface TurnstileRenderParams {
    sitekey: string;
    callback: (token: string) => void;
    'error-callback': (error: string) => void;
    'expired-callback': () => void;
    theme: string;
    size: string;
    appearance: string;
}

/* Extend window for Turnstile global */
declare global {
    interface Window {
        turnstile?: {
            render: (container: HTMLElement, params: TurnstileRenderParams) => string;
            reset: (widgetId: string) => void;
            remove: (widgetId: string) => void;
        };
        onTurnstileLoad?: () => void;
    }
}

/* ─── Constants ─── */

const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const SCRIPT_ID = 'cf-turnstile-script';

/* ─── Turnstile Script Loader ─── */

let scriptLoadPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
    if (scriptLoadPromise) return scriptLoadPromise;

    scriptLoadPromise = new Promise((resolve, reject) => {
        // Already loaded
        if (window.turnstile) {
            resolve();
            return;
        }

        // Check if script tag already exists
        if (document.getElementById(SCRIPT_ID)) {
            window.onTurnstileLoad = () => resolve();
            return;
        }

        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = `${TURNSTILE_SCRIPT_URL}?onload=onTurnstileLoad&render=explicit`;
        script.async = true;
        script.defer = true;

        window.onTurnstileLoad = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Turnstile script'));

        document.head.appendChild(script);
    });

    return scriptLoadPromise;
}

/* ─── Component ─── */

export function Turnstile({
    siteKey,
    onVerify,
    onError,
    onExpire,
    theme = 'auto',
    size = 'normal',
    'aria-label': ariaLabel = 'Human verification',
}: TurnstileProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [verified, setVerified] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleVerify = useCallback((token: string) => {
        setVerified(true);
        setError(null);
        onVerify(token);
    }, [onVerify]);

    const handleError = useCallback((err: string) => {
        setError('Verification failed. Please try again.');
        setVerified(false);
        onError?.(err);
    }, [onError]);

    const handleExpire = useCallback(() => {
        setVerified(false);
        onExpire?.();
    }, [onExpire]);

    useEffect(() => {
        let mounted = true;

        loadTurnstileScript()
            .then(() => {
                if (!mounted || !containerRef.current || !window.turnstile) return;

                setLoading(false);

                // Render widget
                const widgetId = window.turnstile.render(containerRef.current, {
                    sitekey: siteKey,
                    callback: handleVerify,
                    'error-callback': handleError,
                    'expired-callback': handleExpire,
                    theme,
                    size,
                    appearance: 'always',
                });

                widgetIdRef.current = widgetId;
            })
            .catch((err) => {
                if (!mounted) return;
                setLoading(false);
                setError(err instanceof Error ? err.message : 'Failed to load verification');
            });

        return () => {
            mounted = false;
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
                    // Widget may already be removed
                }
                widgetIdRef.current = null;
            }
        };
    }, [siteKey, theme, size, handleVerify, handleError, handleExpire]);

    /** Reset the widget (e.g., after a failed submission) */
    const reset = useCallback(() => {
        if (widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
            setVerified(false);
            setError(null);
        }
    }, []);

    return (
        <div
            className="turnstile-container"
            id="turnstile-widget"
            aria-label={ariaLabel}
            role="group"
        >
            {loading && (
                <div className="turnstile-loading" aria-live="polite">
                    Loading verification...
                </div>
            )}

            <div
                ref={containerRef}
                style={{ minHeight: loading ? 0 : size === 'compact' ? '120px' : '65px' }}
            />

            {verified && (
                <div className="turnstile-status turnstile-status--verified" aria-live="polite">
                    ✓ Verified
                </div>
            )}

            {error && (
                <div className="turnstile-status turnstile-status--error" aria-live="assertive">
                    ⚠ {error}
                    <button
                        type="button"
                        onClick={reset}
                        className="turnstile-retry"
                        aria-label="Retry verification"
                    >
                        Retry
                    </button>
                </div>
            )}
        </div>
    );
}

/* ─── Server-Side Validation Helper ─── */

/**
 * Validates a Turnstile token server-side.
 * Call this from the Worker before processing a report submission.
 *
 * @param token - The cf-turnstile-response token from the client
 * @param secretKey - Turnstile secret key (Worker Secret)
 * @param remoteIp - Optional client IP for additional validation
 * @returns True if the token is valid
 */
export async function validateTurnstileToken(
    token: string,
    secretKey: string,
    remoteIp?: string,
): Promise<boolean> {
    if (!token || !secretKey) return false;

    try {
        const formData = new URLSearchParams();
        formData.append('secret', secretKey);
        formData.append('response', token);
        if (remoteIp) formData.append('remoteip', remoteIp);

        const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData,
        });

        const outcome = await result.json() as { success: boolean };
        return outcome.success === true;
    } catch {
        return false;
    }
}

export default Turnstile;
