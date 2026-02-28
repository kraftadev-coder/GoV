/**
 * AmnesiaAudit.tsx — Digital Terminal Audit Display
 *
 * Component Spec: "A dedicated section in the user profile that uses
 * a 'Digital Terminal' look with a scanning animation that visually
 * ticks off items."
 *
 * Aesthetic Goal: "Make the user feel like they are inside a
 * high-security vault."
 *
 * Displays:
 *   [OK] IP LOG PURGED
 *   [OK] SESSION ROTATED
 *   [OK] METADATA STRIPPED
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import '../../styles/amnesia.css';

/* ─── Types ─── */

export interface AuditItem {
    id: string;
    label: string;
    status: 'pending' | 'scanning' | 'passed';
}

export interface AmnesiaAuditProps {
    /** Auto-run the scan on mount (default: true) */
    autoScan?: boolean;
    /** Delay between line reveals in ms (default: 600) */
    scanDelay?: number;
    /** Called when all items pass */
    onComplete?: () => void;
}

/* ─── Default Audit Items ─── */

const DEFAULT_AUDIT_ITEMS: readonly AuditItem[] = [
    { id: 'ip-purge', label: 'IP LOG PURGED', status: 'pending' },
    { id: 'session-rotate', label: 'SESSION ROTATED', status: 'pending' },
    { id: 'metadata-strip', label: 'METADATA STRIPPED', status: 'pending' },
] as const;

/* ─── Component ─── */

const AmnesiaAudit: React.FC<AmnesiaAuditProps> = ({
    autoScan = true,
    scanDelay = 600,
    onComplete,
}) => {
    const [items, setItems] = useState<AuditItem[]>([...DEFAULT_AUDIT_ITEMS]);
    const [isScanning, setIsScanning] = useState(false);
    const [scanComplete, setScanComplete] = useState(false);
    const [timestamp, setTimestamp] = useState<string | null>(null);

    // Use refs to avoid stale closure issues in timeouts
    const scanTimeoutRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
    const isScanningRef = useRef(false);
    const onCompleteRef = useRef(onComplete);
    const mountedRef = useRef(true);

    // Keep callback ref fresh
    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    // Track mount status for safe async updates
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            scanTimeoutRefs.current.forEach(clearTimeout);
            scanTimeoutRefs.current = [];
        };
    }, []);

    /* Run scan sequence */
    const runScan = useCallback(() => {
        // Guard via ref to avoid stale closure
        if (isScanningRef.current) return;

        // Update scanning state
        isScanningRef.current = true;
        setIsScanning(true);
        setScanComplete(false);
        setTimestamp(null);
        setItems(DEFAULT_AUDIT_ITEMS.map((item) => ({ ...item, status: 'pending' as const })));

        // Clear any existing timeouts
        scanTimeoutRefs.current.forEach(clearTimeout);
        scanTimeoutRefs.current = [];

        // Sequentially reveal each item
        DEFAULT_AUDIT_ITEMS.forEach((_, index) => {
            // Set to "scanning" state
            const scanTimeout = setTimeout(() => {
                if (!mountedRef.current) return;
                setItems((prev) =>
                    prev.map((item, i) =>
                        i === index ? { ...item, status: 'scanning' as const } : item
                    )
                );
            }, index * scanDelay);
            scanTimeoutRefs.current.push(scanTimeout);

            // Set to "passed" state after brief scan animation
            const passTimeout = setTimeout(
                () => {
                    if (!mountedRef.current) return;
                    setItems((prev) =>
                        prev.map((item, i) =>
                            i === index ? { ...item, status: 'passed' as const } : item
                        )
                    );

                    // Complete after last item
                    if (index === DEFAULT_AUDIT_ITEMS.length - 1) {
                        const completeTimeout = setTimeout(() => {
                            if (!mountedRef.current) return;
                            isScanningRef.current = false;
                            setIsScanning(false);
                            setScanComplete(true);
                            setTimestamp(new Date().toISOString());
                            onCompleteRef.current?.();
                        }, 300);
                        scanTimeoutRefs.current.push(completeTimeout);
                    }
                },
                index * scanDelay + 400
            );
            scanTimeoutRefs.current.push(passTimeout);
        });
    }, [scanDelay]);

    /* Auto-scan on mount */
    useEffect(() => {
        if (autoScan) {
            const initTimeout = setTimeout(runScan, 300);
            return () => clearTimeout(initTimeout);
        }
    }, [autoScan, runScan]);

    /* Format timestamp */
    const formattedTimestamp = timestamp
        ? new Date(timestamp).toLocaleString('en-NG', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        })
        : '—';

    const allPassed = items.every((item) => item.status === 'passed');

    return (
        <div className="amnesia-audit" role="region" aria-label="Amnesia Protocol Security Audit">
            {/* Terminal header */}
            <div className="amnesia-audit__header">
                <div className="amnesia-audit__header-icon" aria-hidden="true" />
                <span className="amnesia-audit__header-text">
                    Amnesia Protocol v1.0
                </span>
            </div>

            {/* Audit lines */}
            <div className="amnesia-audit__lines" aria-live="polite">
                {items.map((item) => (
                    <div
                        key={item.id}
                        className={`amnesia-audit__line ${item.status !== 'pending' ? 'amnesia-audit__line--revealed' : ''
                            }`}
                        role="status"
                        aria-label={`${item.label}: ${item.status === 'passed' ? 'OK' : item.status === 'scanning' ? 'Scanning' : 'Pending'
                            }`}
                    >
                        {/* Status indicator */}
                        <span
                            className={`amnesia-audit__status amnesia-audit__status--${item.status === 'passed' ? 'ok' : 'pending'
                                }`}
                            aria-hidden="true"
                        >
                            {item.status === 'passed' ? '[OK]' : '[  ]'}
                        </span>

                        {/* Label */}
                        <span className="amnesia-audit__label">{item.label}</span>

                        {/* Dots */}
                        <span className="amnesia-audit__dots" aria-hidden="true">
                            {'·'.repeat(20)}
                        </span>

                        {/* Result */}
                        <span
                            className={`amnesia-audit__result amnesia-audit__result--${item.status === 'passed' ? 'passed' : 'pending'
                                }`}
                        >
                            {item.status === 'passed'
                                ? 'CLEAR'
                                : item.status === 'scanning'
                                    ? 'SCAN...'
                                    : 'PENDING'}
                        </span>

                        {/* Scanner overlay */}
                        {item.status === 'scanning' && (
                            <div
                                className="amnesia-audit__scanner amnesia-audit__scanner--active"
                                aria-hidden="true"
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Summary bar */}
            <div className="amnesia-audit__summary">
                <span
                    className={`amnesia-audit__summary-text amnesia-audit__summary-text--${allPassed ? 'passed' : 'pending'
                        }`}
                >
                    {allPassed
                        ? '● All Systems Clear'
                        : isScanning
                            ? '○ Scanning...'
                            : '○ Awaiting Scan'}
                </span>
                <span className="amnesia-audit__timestamp">{formattedTimestamp}</span>
            </div>

            {/* Rescan button */}
            {scanComplete && (
                <button
                    className="amnesia-audit__rescan"
                    onClick={runScan}
                    disabled={isScanning}
                    type="button"
                    aria-label="Re-run amnesia security scan"
                >
                    ↻ Rescan
                </button>
            )}
        </div>
    );
};

export default AmnesiaAudit;
