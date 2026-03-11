/**
 * Profile Page — Modern Citizen Hub Design
 * Anonymous identity, session details, reputation, and Amnesia Audit.
 */

import React from 'react';
import { CryptoHandle } from '../components/auth/CryptoHandle';
import AmnesiaAudit from '../components/profile/AmnesiaAudit';
import { useAuth } from '../contexts/AuthContext';

const Profile: React.FC = () => {
    const { session, reputation, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-brand/20 border-t-brand" />
                <p className="meta-label mt-4">Initializing anonymous session...</p>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
            {/* Page Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-black tracking-tighter text-text-primary sm:text-4xl">Profile</h1>
                <p className="mt-2 text-[15px] text-text-body">Your anonymous identity and reputation score.</p>
            </div>

            {/* Identity Card */}
            <div className="modern-card mb-5 p-6">
                <div className="mb-4 flex items-center justify-between">
                    <span className="meta-label text-text-secondary">Anonymous Identity</span>
                    <span className="badge-verified">Active</span>
                </div>
                <CryptoHandle editable showDetails />
            </div>

            {/* Session Details */}
            <div className="modern-card mb-5 p-6">
                <div className="mb-4">
                    <span className="meta-label text-text-secondary">Session Details</span>
                </div>
                <div className="space-y-3 text-[13px] text-text-body">
                    <div className="flex items-center justify-between">
                        <span>Token Hash</span>
                        <span className="font-mono text-[11px] text-text-secondary">
                            {session?.anonToken
                                ? `${session.anonToken.slice(0, 8)}...${session.anonToken.slice(-8)}`
                                : '—'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span>Created</span>
                        <span>{session?.createdAt ? new Date(session.createdAt).toLocaleString() : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span>Expires</span>
                        <span>{session?.expiresAt ? new Date(session.expiresAt).toLocaleString() : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span>Stateless</span>
                        <span className="font-semibold text-success">✓ No server storage</span>
                    </div>
                </div>
            </div>

            {/* Feature Access */}
            <div className="modern-card mb-5 p-6">
                <div className="mb-4">
                    <span className="meta-label text-text-secondary">Feature Access</span>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-[15px] font-bold text-text-primary">Video Upload</h4>
                        <p className="mt-0.5 text-[12px] text-text-secondary">
                            {reputation?.canUploadVideo
                                ? 'Unlocked — Advanced Witness'
                                : `Locked — Need ${(1000 - (reputation?.points ?? 0)).toLocaleString()} more points`}
                        </p>
                    </div>
                    {reputation?.canUploadVideo ? (
                        <span className="badge-verified">Unlocked</span>
                    ) : (
                        <span className="badge-pending">Locked</span>
                    )}
                </div>
            </div>

            {/* Reputation */}
            <div className="mb-5 grid grid-cols-2 gap-4">
                <div className="modern-card flex flex-col items-center p-6 text-center">
                    <span className="text-3xl font-black tracking-tight text-text-primary">
                        {reputation?.points?.toLocaleString() ?? '0'}
                    </span>
                    <span className="meta-label mt-1 text-text-secondary">Total Points</span>
                </div>
                <div className="modern-card flex flex-col items-center p-6 text-center">
                    <span className="text-3xl font-black tracking-tight text-text-primary">
                        {reputation?.level ?? 'Junior'}
                    </span>
                    <span className="meta-label mt-1 text-text-secondary">Rank</span>
                </div>
            </div>

            {/* Amnesia Audit */}
            <div className="rounded-[28px] bg-[#1a1d23] p-6 text-white shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-brand" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 00-6 0V9h6z" clipRule="evenodd" /></svg>
                        <span className="meta-label text-white/60">Amnesia Audit</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                        Active
                    </span>
                </div>
                <AmnesiaAudit autoScan scanDelay={600} />
            </div>
        </div>
    );
};

export default Profile;
