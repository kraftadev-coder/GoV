/**
 * Module 2: Auth Context
 *
 * Provides anonymous session and reputation state to the entire React tree.
 * Initializes session on first load, restores on subsequent visits.
 *
 * No PII ever touches this context — only anon_token, handle, and points.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
    createSession,
    restoreSession,
    updateSessionHandle,
} from '../lib/auth/anonymousAuth';
import {
    createProfile,
    loadProfile,
    awardPoints as engineAwardPoints,
} from '../lib/auth/reputationEngine';
import type { AnonSession, ReputationProfile, ScoreEvent, AuthState } from '../lib/auth/types';

/* ───────────────────── Context ───────────────────── */

const AuthContext = createContext<AuthState | null>(null);

/* ───────────────────── Provider ───────────────────── */

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<AnonSession | null>(null);
    const [reputation, setReputation] = useState<ReputationProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Use a ref for reputation so awardPoints never has a stale closure
    const reputationRef = useRef<ReputationProfile | null>(null);
    reputationRef.current = reputation;

    /**
     * Initialize or restore the anonymous session.
     * Creates a fresh session + reputation profile if none exists.
     * Wrapped in try/catch to prevent white-screen crashes.
     */
    const initSession = useCallback(async () => {
        setIsLoading(true);

        try {
            // 1. Try to restore existing session
            let currentSession = restoreSession();

            if (!currentSession) {
                // 2. Create new session (async — needs SHA-256)
                currentSession = await createSession();
            }

            setSession(currentSession);

            // 3. Load or create reputation profile
            let profile = loadProfile(currentSession.anonToken);
            if (!profile) {
                profile = createProfile(currentSession.anonToken);
            }
            setReputation(profile);
        } catch (err) {
            console.error('[AuthContext] Session init failed:', err);
            // Still allow the app to render — session/reputation will be null
        }

        setIsLoading(false);
    }, []);

    /**
     * Set or update the crypto handle.
     */
    const setHandle = useCallback((handle: string) => {
        const normalized = handle.startsWith('@') ? handle : `@${handle}`;
        const updated = updateSessionHandle(normalized);
        if (updated) {
            setSession(updated);
        }
    }, []);

    /**
     * Award reputation points (offline-first).
     * Uses ref to always read the latest reputation, avoiding stale closures
     * and unnecessary re-render cycles from dependency changes.
     */
    const awardPoints = useCallback(
        (event: ScoreEvent) => {
            const current = reputationRef.current;
            if (!current) return;
            const updated = engineAwardPoints(current, event);
            setReputation(updated);
        },
        [] // Stable — no deps needed thanks to ref
    );

    // Auto-initialize on mount
    useEffect(() => {
        initSession();
    }, [initSession]);

    const value: AuthState = {
        session,
        reputation,
        isLoading,
        initSession,
        setHandle,
        awardPoints,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/* ───────────────────── Hook ───────────────────── */

/**
 * Access the auth context from any component.
 * Must be used within an AuthProvider.
 */
export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return ctx;
}
