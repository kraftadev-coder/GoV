/**
 * AdminDashboard — Module 7
 *
 * Protected super admin dashboard for platform health monitoring,
 * content moderation, and operational visibility.
 *
 * Access: Requires admin secret token via URL param (?token=...) or
 *         entered via the access denied screen.
 *
 * Theme: Dark "Security Mode" aesthetic (Deep Obsidian background).
 * Layout: Bento grid with real-time stat cards.
 *
 * Source: Implementation Plan Module 7, UI/UX Strategy §2.2 (Security Mode)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PlatformHealthPanel } from '../../components/admin/PlatformHealthPanel';
import { ContentModerationPanel } from '../../components/admin/ContentModerationPanel';
import { UserActivityPanel } from '../../components/admin/UserActivityPanel';
import { CostMonitorPanel } from '../../components/admin/CostMonitorPanel';
import { ActivityLogPanel } from '../../components/admin/ActivityLogPanel';
import { getAdminHeaders } from '../../components/admin/adminTypes';
import type { PlatformStats, FlaggedReport, ActivityEvent, ModerationAction } from '../../components/admin/adminTypes';
import '../../styles/admin.css';

/* ─── Configuration ─── */

const API_BASE = '/api/admin';
const REFRESH_INTERVAL_MS = 30_000; // Auto-refresh every 30 seconds

/* ─── Admin Dashboard Page ─── */

export function AdminDashboard() {
    const [adminToken, setAdminToken] = useState<string>('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [tokenInput, setTokenInput] = useState('');
    const abortRef = useRef<AbortController | null>(null);

    // Data state
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [flaggedReports, setFlaggedReports] = useState<FlaggedReport[]>([]);
    const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Read token from URL params on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        if (urlToken) {
            setAdminToken(urlToken);
            setIsAuthenticated(true);
            // Remove token from URL for security
            window.history.replaceState({}, '', '/admin');
        }
    }, []);

    // Fetch all admin data
    const fetchData = useCallback(async () => {
        if (!adminToken) return;

        // Cancel any in-flight requests
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const headers = getAdminHeaders(adminToken);
            const signal = controller.signal;
            const [statsRes, moderationRes, activityRes] = await Promise.all([
                fetch(`${API_BASE}/stats`, { headers, signal }),
                fetch(`${API_BASE}/moderation`, { headers, signal }),
                fetch(`${API_BASE}/activity`, { headers, signal }),
            ]);

            // Check for auth failure
            if (statsRes.status === 403 || moderationRes.status === 403 || activityRes.status === 403) {
                setIsAuthenticated(false);
                setAdminToken('');
                setError('Invalid admin token. Access denied.');
                setLoading(false);
                return;
            }

            const [statsData, moderationData, activityData] = await Promise.all([
                statsRes.json() as Promise<{ stats: PlatformStats }>,
                moderationRes.json() as Promise<{ reports: FlaggedReport[] }>,
                activityRes.json() as Promise<{ events: ActivityEvent[] }>,
            ]);

            if (!signal.aborted) {
                setStats(statsData.stats);
                setFlaggedReports(moderationData.reports ?? []);
                setActivityEvents(activityData.events ?? []);
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setError(err instanceof Error ? err.message : 'Failed to load admin data');
        } finally {
            setLoading(false);
        }
    }, [adminToken]);

    // Initial fetch + auto-refresh
    useEffect(() => {
        if (isAuthenticated && adminToken) {
            fetchData();
            const interval = setInterval(fetchData, REFRESH_INTERVAL_MS);
            return () => {
                clearInterval(interval);
                abortRef.current?.abort();
            };
        }
    }, [isAuthenticated, adminToken, fetchData]);

    // Handle moderation action
    const handleModerate = async (reportId: string, action: ModerationAction) => {
        if (!adminToken) return;

        try {
            const res = await fetch(`${API_BASE}/moderate`, {
                method: 'POST',
                headers: getAdminHeaders(adminToken),
                body: JSON.stringify({ reportId, action }),
            });

            if (!res.ok) {
                throw new Error('Moderation action failed');
            }

            // Refresh data after moderation
            await fetchData();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Moderation failed');
        }
    };

    // Handle token submission from login screen
    const handleTokenSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (tokenInput.trim()) {
            setAdminToken(tokenInput.trim());
            setIsAuthenticated(true);
            setTokenInput('');
        }
    };

    // ─── Access Denied Screen ───
    if (!isAuthenticated) {
        return (
            <div className="admin-access-denied" id="admin-access-denied">
                <div className="lock-icon">🔒</div>
                <h1>Access Denied</h1>
                <p>
                    This dashboard requires a valid admin token.
                    Enter your token below or navigate with <code>?token=YOUR_TOKEN</code>.
                </p>
                {error && (
                    <p style={{ color: 'var(--danger-red)', marginTop: 'var(--space-sm)' }}>
                        {error}
                    </p>
                )}
                <form className="admin-token-input" onSubmit={handleTokenSubmit}>
                    <input
                        type="password"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="Enter admin token..."
                        autoComplete="off"
                        aria-label="Admin token"
                    />
                    <button type="submit">Authenticate</button>
                </form>
            </div>
        );
    }

    // ─── Dashboard ───
    return (
        <div className="admin-dashboard" data-theme="security" id="admin-dashboard">
            <header className="admin-header">
                <div>
                    <h1>CivicVoice Admin</h1>
                    <div className="admin-timestamp">
                        Last updated: {new Date().toLocaleString()}
                        {' • '}Auto-refresh: {REFRESH_INTERVAL_MS / 1000}s
                    </div>
                </div>
                <span className="admin-badge">🟢 Super Admin</span>
            </header>

            {error && (
                <div className="budget-alert critical" style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-sm) var(--space-md)' }}>
                    Error: {error}
                </div>
            )}

            <div className="admin-grid">
                {/* Row 1: Health + Cost */}
                <PlatformHealthPanel stats={stats} loading={loading} />
                <CostMonitorPanel stats={stats} loading={loading} />

                {/* Row 2: Content Moderation (full width) */}
                <ContentModerationPanel
                    reports={flaggedReports}
                    loading={loading}
                    onModerate={handleModerate}
                />

                {/* Row 3: User Activity + (expandable) */}
                <UserActivityPanel stats={stats} loading={loading} />
                <div className="admin-panel">
                    <h2><span className="panel-icon">⚡</span> Quick Actions</h2>
                    <div className="stat-grid">
                        <button
                            className="mod-btn approve"
                            onClick={fetchData}
                            style={{ width: '100%', padding: 'var(--space-md)' }}
                        >
                            Refresh Data
                        </button>
                    </div>
                </div>

                {/* Row 4: Activity Log (full width) */}
                <ActivityLogPanel events={activityEvents} loading={loading} />
            </div>
        </div>
    );
}

export default AdminDashboard;
