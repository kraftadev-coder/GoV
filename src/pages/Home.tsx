/**
 * Home Page — Modern Citizen Hub
 *
 * Two-column layout: Feed (left) + Sidebar widgets (right)
 * Pill tabs: ALL / WITNESS / OPINION
 * Modern rounded cards, dark Secure Reporter, Trending Districts, Stats
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { mockWitnessPosts, mockOpinionPosts } from '../data/mockFeed';
import type { WitnessPost, OpinionPost } from '../data/mockFeed';
import { API_BASE } from '../lib/apiConfig';

/* ─── API Types ─── */
interface ApiFeedReport {
    reportId: string; lane: 'witness' | 'social'; title: string; description: string;
    mediaKey: string | null; mediaType: string; geoLabel: string;
    verificationStatus: string; witnessScore: number; contentHash: string;
    upvotes: number; createdAt: string;
}
interface ApiFeedResponse { reports: ApiFeedReport[]; nextCursor: string | null; hasMore: boolean; lane: string; }

function apiToWitnessPost(r: ApiFeedReport): WitnessPost {
    return { id: r.reportId, type: 'witness', geoLabel: r.geoLabel, contentHash: r.contentHash,
        excerpt: r.description || r.title || '', score: r.witnessScore, timestamp: fmtTime(r.createdAt),
        createdAt: r.createdAt, mediaUrl: r.mediaKey ? `/api/media/${encodeURIComponent(r.mediaKey)}` : undefined,
        verified: r.verificationStatus === 'witness-verified' || r.verificationStatus === 'remote-verified',
        upvotes: r.upvotes, verificationStatus: r.verificationStatus as WitnessPost['verificationStatus'], };
}
function apiToOpinionPost(r: ApiFeedReport): OpinionPost {
    return { id: r.reportId, type: 'opinion', handle: '@AnonymousWitness',
        text: r.description || r.title || '', timestamp: fmtTime(r.createdAt), createdAt: r.createdAt, upvotes: r.upvotes, };
}
function fmtTime(iso: string): string {
    const d = (Date.now() - new Date(iso).getTime()) / 60000;
    if (d < 1) return 'Just now'; if (d < 60) return `${Math.floor(d)}m ago`;
    const h = d / 60; if (h < 24) return `${Math.floor(h)}h ago`;
    const dy = h / 24; if (dy < 7) return `${Math.floor(dy)}d ago`;
    return new Date(iso).toLocaleDateString();
}

type FeedState = 'loading' | 'loaded' | 'error' | 'fallback';
type TabLane = 'all' | 'witness' | 'social';

/* ─── Sub-Components ─── */

const FeedTabs: React.FC<{ active: TabLane; onChange: (t: TabLane) => void }> = ({ active, onChange }) => (
    <div className="flex items-center gap-2">
        {(['all', 'witness', 'opinion'] as const).map((tab) => (
            <button
                key={tab}
                onClick={() => onChange(tab === 'opinion' ? 'social' : tab as TabLane)}
                className={`rounded-full px-5 py-2 text-[11px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                    (tab === 'opinion' ? 'social' : tab) === active
                        ? 'bg-cta text-white shadow-lg shadow-cta/10'
                        : 'bg-white text-text-secondary hover:bg-surface-muted hover:text-text-primary border border-border'
                }`}
            >
                {tab}
            </button>
        ))}
    </div>
);

const WitnessCardNew: React.FC<{ post: WitnessPost }> = ({ post }) => {
    const location = post.geoLabel.split('•')[0]?.split(',')[0]?.trim() || 'Unknown';
    const title = post.excerpt.length > 60 ? post.excerpt.substring(0, 60).split(' ').slice(0, -1).join(' ') : post.excerpt;
    return (
        <article className="modern-card group cursor-pointer p-6">
            <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-muted text-text-secondary">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                </div>

                <div className="flex-1 min-w-0">
                    {/* Meta row */}
                    <div className="mb-2 flex items-center gap-2">
                        <span className="meta-label text-text-secondary">Witness</span>
                        {post.verified && (
                            <span className="badge-verified">
                                <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                                Verified
                            </span>
                        )}
                        {!post.verified && (
                            <span className="badge-pending">Pending</span>
                        )}
                    </div>

                    {/* Title */}
                    <h3 className="mb-2 text-[17px] font-bold leading-snug tracking-tight text-text-primary">
                        {title}
                    </h3>
                </div>

                {/* Timestamp + Status */}
                <div className="shrink-0 text-right">
                    <span className="meta-label text-text-secondary">{post.timestamp}</span>
                    <div className="mt-1 flex items-center justify-end gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-success">Secured</span>
                    </div>
                </div>
            </div>

            {/* Description */}
            <p className="mt-3 pl-[60px] text-[14px] leading-relaxed text-text-body">
                {post.excerpt}
            </p>

            {/* Footer */}
            <div className="mt-5 flex items-center gap-3 pl-[60px]">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                    {location}
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                    ANON_{String(post.score).slice(-2)}
                </span>

                {/* Pagination dots */}
                <div className="ml-auto flex items-center gap-1">
                    {[1, 2, 3].map(n => (
                        <span key={n} className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-muted text-[10px] font-bold text-text-secondary">{n}</span>
                    ))}
                    <span className="ml-1 flex h-6 items-center rounded-lg bg-surface-muted px-2 text-[10px] font-bold text-text-secondary">+{post.upvotes || 12}</span>
                    <span className="ml-2 text-brand">→</span>
                </div>
            </div>
        </article>
    );
};

const OpinionCardNew: React.FC<{ post: OpinionPost }> = ({ post }) => (
    <article className="modern-card group cursor-pointer p-6">
        <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-warning-light text-warning">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
            </div>
            <div className="flex-1 min-w-0">
                <div className="mb-2 flex items-center gap-2">
                    <span className="meta-label text-warning">Opinion</span>
                </div>
                <h3 className="mb-2 text-[17px] font-bold leading-snug tracking-tight text-text-primary">
                    {post.text.substring(0, 50)}...
                </h3>
            </div>
            <div className="shrink-0 text-right">
                <span className="meta-label text-text-secondary">{post.timestamp}</span>
                <div className="mt-1 flex items-center justify-end gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-success">Secured</span>
                </div>
            </div>
        </div>
        <p className="mt-3 pl-[60px] text-[14px] leading-relaxed text-text-body">{post.text}</p>
        <div className="mt-5 flex items-center gap-3 pl-[60px]">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                {post.handle.replace('@', '').toUpperCase().substring(0, 5)}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                {post.handle.replace('@', '')}
            </span>
            <div className="ml-auto flex items-center gap-1">
                {[1, 2, 3].map(n => (
                    <span key={n} className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-muted text-[10px] font-bold text-text-secondary">{n}</span>
                ))}
                <span className="ml-2 text-brand">→</span>
            </div>
        </div>
    </article>
);

/* ─── Sidebar Widgets ─── */

const SecureReporter: React.FC<{ onPostSuccess?: () => void }> = ({ onPostSuccess }) => {
    const [text, setText] = useState('');
    const [posting, setPosting] = useState(false);

    const handlePost = async () => {
        if (!text.trim() || posting) return;
        setPosting(true);
        try {
            const encoder = new TextEncoder();
            const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(text));
            const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
            const form = new FormData();
            form.append('title', text.substring(0, 80));
            form.append('description', text);
            form.append('mediaType', 'text');
            form.append('lane', 'social');
            form.append('contentHash', hashHex);
            form.append('geoLabel', 'ANONYMOUS • SECURED');
            await fetch(`${API_BASE}/api/report`, { method: 'POST', body: form });
            setText('');
            onPostSuccess?.();
        } catch (e) { console.warn('Post failed:', e); }
        finally { setPosting(false); }
    };

    return (
        <div className="rounded-[28px] bg-[#1a1d23] p-6 text-white shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20">
                    <svg className="h-4 w-4 text-brand" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 00-6 0V9h6z" clipRule="evenodd" /></svg>
                </div>
                <div>
                    <h3 className="text-base font-black tracking-tight">Secure Reporter</h3>
                    <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
                        <span className="text-[9px] font-black uppercase tracking-[0.15em] text-brand">Amnesia Protocol Active</span>
                    </div>
                </div>
            </div>
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What's happening in your community? Your identity is protected by our zero-log infrastructure."
                className="mb-4 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-[13px] leading-relaxed text-white/80 placeholder-white/30 outline-none transition-all focus:border-brand/40 focus:ring-1 focus:ring-brand/20 resize-none"
                rows={3}
            />
            <div className="flex items-center gap-3">
                <button className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] font-black uppercase tracking-[0.15em] text-white/60 transition-all hover:border-white/20 hover:bg-white/10">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                    Media
                </button>
                <button
                    onClick={handlePost}
                    disabled={!text.trim() || posting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-[11px] font-black uppercase tracking-[0.15em] text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-hover hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                    {posting ? 'Posting...' : 'Post Now'}
                </button>
            </div>
        </div>
    );
};

const TrendingDistricts: React.FC = () => (
    <div className="modern-card p-6">
        <div className="mb-4 flex items-center gap-2">
            <span className="text-brand">📈</span>
            <h3 className="meta-label text-text-secondary">Trending Districts</h3>
        </div>
        {[
            { name: 'Lagos District 04', reports: '1.2K', pct: '+12%' },
            { name: 'Abuja Central', reports: '850', pct: '+5%' },
            { name: 'Kano North', reports: '2.4K', pct: '+24%' },
        ].map((d, i) => (
            <div key={i} className={`flex items-center justify-between py-3 ${i > 0 ? 'border-t border-border' : ''}`}>
                <div>
                    <h4 className="text-[15px] font-bold tracking-tight text-text-primary">{d.name}</h4>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-secondary">
                        {d.reports} Reports <span className="text-success">{d.pct}</span>
                    </span>
                </div>
                <span className="text-brand/50">→</span>
            </div>
        ))}
    </div>
);

const StatsCards: React.FC = () => (
    <div className="grid grid-cols-2 gap-4">
        <div className="modern-card flex flex-col items-center p-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted">
                <svg className="h-6 w-6 text-text-secondary" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
            </div>
            <span className="text-2xl font-black tracking-tight text-text-primary">12.4k</span>
            <span className="meta-label mt-1 text-text-secondary">Active Citizens</span>
        </div>
        <div className="modern-card flex flex-col items-center p-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-success-light">
                <svg className="h-6 w-6 text-success" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            </div>
            <span className="text-2xl font-black tracking-tight text-text-primary">8.2k</span>
            <span className="meta-label mt-1 text-success">Verified Truths</span>
        </div>
    </div>
);

/* ─── Main Component ─── */
const Home: React.FC = () => {
    const [tabLane, setTabLane] = useState<TabLane>('all');
    const [witnessPosts, setWitnessPosts] = useState<WitnessPost[]>([]);
    const [opinionPosts, setOpinionPosts] = useState<OpinionPost[]>([]);
    const [feedState, setFeedState] = useState<FeedState>('loading');
    const abortRef = useRef<AbortController | null>(null);

    const fetchFeed = useCallback(async (_lane?: string) => {
        abortRef.current?.abort();
        const ac = new AbortController(); abortRef.current = ac;
        setFeedState('loading');
        try {
            const [wRes, sRes] = await Promise.all([
                fetch(`${API_BASE}/api/feed?lane=witness&limit=10`, { signal: ac.signal }),
                fetch(`${API_BASE}/api/feed?lane=social&limit=10`, { signal: ac.signal }),
            ]);
            if (!wRes.ok || !sRes.ok) throw new Error('API error');
            const wData: ApiFeedResponse = await wRes.json();
            const sData: ApiFeedResponse = await sRes.json();
            setWitnessPosts(wData.reports.map(apiToWitnessPost));
            setOpinionPosts(sData.reports.map(apiToOpinionPost));
            setFeedState('loaded');
        } catch (err) {
            if ((err as Error).name === 'AbortError') return;
            setWitnessPosts(mockWitnessPosts);
            setOpinionPosts(mockOpinionPosts);
            setFeedState('fallback');
        }
    }, []);

    useEffect(() => { fetchFeed(tabLane); return () => abortRef.current?.abort(); }, [fetchFeed, tabLane]);

    const filteredPosts = (() => {
        if (tabLane === 'witness') return { witness: witnessPosts, opinion: [] as OpinionPost[] };
        if (tabLane === 'social') return { witness: [] as WitnessPost[], opinion: opinionPosts };
        return { witness: witnessPosts, opinion: opinionPosts };
    })();

    const allPosts = [
        ...filteredPosts.witness.map(p => ({ ...p, _sort: new Date(p.createdAt).getTime() })),
        ...filteredPosts.opinion.map(p => ({ ...p, _sort: new Date(p.createdAt).getTime() })),
    ].sort((a, b) => b._sort - a._sort);

    return (
        <div className="mx-auto max-w-6xl px-6 py-8">
            {/* Header / Title */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-4xl font-black italic tracking-tighter text-text-primary">Community Feed</h1>
                    <p className="meta-label mt-1 text-text-secondary">Real-Time Witness Ledger</p>
                </div>
                <FeedTabs active={tabLane} onChange={setTabLane} />
            </div>

            {/* Two-Column Layout */}
            <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
                {/* LEFT — Feed */}
                <div className="flex flex-col gap-5">
                    {feedState === 'loading' && (
                        <div className="flex items-center justify-center py-20">
                            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand/20 border-t-brand" />
                        </div>
                    )}
                    {feedState !== 'loading' && allPosts.length === 0 && (
                        <div className="modern-card p-12 text-center">
                            <div className="mb-4 text-5xl">📢</div>
                            <h3 className="mb-2 text-xl font-black tracking-tight">No reports yet</h3>
                            <p className="text-[14px] text-text-body">Be the first to contribute!</p>
                        </div>
                    )}
                    {feedState !== 'loading' && allPosts.map((post) =>
                        post.type === 'witness'
                            ? <WitnessCardNew key={post.id} post={post as WitnessPost} />
                            : <OpinionCardNew key={post.id} post={post as OpinionPost} />
                    )}
                </div>

                {/* RIGHT — Sidebar */}
                <aside className="flex flex-col gap-5">
                    <SecureReporter onPostSuccess={() => fetchFeed(tabLane)} />
                    <TrendingDistricts />
                    <StatsCards />
                </aside>
            </div>
        </div>
    );
};

export default Home;
