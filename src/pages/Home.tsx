/**
 * Module 5: Home Page — Live Feed
 *
 * Fetches reports from /api/feed with cursor-based pagination.
 * Falls back to mock data when the API is unavailable (local dev without Wrangler).
 *
 * Source:
 * - Implementation Plan §Module 5: "Dual-lane feed from D1"
 * - Feature Goal Matrix §"Interact and air opinions"
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Main, BentoGrid, BentoItem } from '../components/ui';
import { FeedToggle, WitnessCard, OpinionCard, StaggeredFeed } from '../components/feed';
import OpinionComposer from '../components/feed/OpinionComposer';
import { mockWitnessPosts, mockOpinionPosts } from '../data/mockFeed';
import type { FeedLane, WitnessPost, OpinionPost } from '../data/mockFeed';
import '../styles/home.css';

/** API base: use env variable for production, fallback to empty for dev proxy */
const API_BASE = import.meta.env.VITE_API_BASE || '';

/** Map API FeedReport → WitnessPost for the WitnessCard component */
interface ApiFeedReport {
    reportId: string;
    lane: 'witness' | 'social';
    title: string;
    description: string;
    mediaKey: string | null;
    mediaType: string;
    geoLabel: string;
    verificationStatus: string;
    witnessScore: number;
    contentHash: string;
    upvotes: number;
    createdAt: string;
}

interface ApiFeedResponse {
    reports: ApiFeedReport[];
    nextCursor: string | null;
    hasMore: boolean;
    lane: string;
}

function apiToWitnessPost(report: ApiFeedReport): WitnessPost {
    return {
        id: report.reportId,
        type: 'witness',
        geoLabel: report.geoLabel,
        contentHash: report.contentHash,
        excerpt: report.description || report.title || 'No description provided',
        score: report.witnessScore,
        timestamp: formatTimeAgo(report.createdAt),
        createdAt: report.createdAt,
        mediaUrl: report.mediaKey ? `/api/media/${encodeURIComponent(report.mediaKey)}` : undefined,
        verified: report.verificationStatus === 'witness-verified' || report.verificationStatus === 'remote-verified',
        upvotes: report.upvotes,
        verificationStatus: report.verificationStatus as WitnessPost['verificationStatus'],
    };
}

function apiToOpinionPost(report: ApiFeedReport): OpinionPost {
    return {
        id: report.reportId,
        type: 'opinion',
        handle: '@AnonymousWitness',
        text: report.description || report.title || 'No content provided',
        timestamp: formatTimeAgo(report.createdAt),
        createdAt: report.createdAt,
        upvotes: report.upvotes,
    };
}

function formatTimeAgo(isoDate: string): string {
    const now = Date.now();
    const then = new Date(isoDate).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    return new Date(isoDate).toLocaleDateString();
}

type FeedState = 'loading' | 'loaded' | 'error' | 'fallback';

const Home: React.FC = () => {
    const [activeLane, setActiveLane] = useState<FeedLane>('witness');
    const [witnessPosts, setWitnessPosts] = useState<WitnessPost[]>([]);
    const [opinionPosts, setOpinionPosts] = useState<OpinionPost[]>([]);
    const [feedState, setFeedState] = useState<FeedState>('loading');
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const fetchFeed = useCallback(async (lane: FeedLane, cursor?: string | null, append = false) => {
        // Cancel any in-flight request
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        if (!append) setFeedState('loading');

        try {
            const apiLane = lane === 'social' ? 'social' : 'witness';
            const params = new URLSearchParams({ lane: apiLane, limit: '20' });
            if (cursor) params.set('cursor', cursor);

            const response = await fetch(`${API_BASE}/api/feed?${params}`, {
                signal: ac.signal,
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const data: ApiFeedResponse = await response.json();

            if (lane === 'witness') {
                const posts = data.reports.map(apiToWitnessPost);
                setWitnessPosts(prev => append ? [...prev, ...posts] : posts);
            } else {
                const posts = data.reports.map(apiToOpinionPost);
                setOpinionPosts(prev => append ? [...prev, ...posts] : posts);
            }

            setNextCursor(data.nextCursor);
            setHasMore(data.hasMore);
            setFeedState('loaded');
        } catch (err) {
            if ((err as Error).name === 'AbortError') return;

            console.warn('[Home] Feed API unavailable, using mock data:', (err as Error).message);
            // Fallback to mock data
            setWitnessPosts(mockWitnessPosts);
            setOpinionPosts(mockOpinionPosts);
            setNextCursor(null);
            setHasMore(false);
            setFeedState('fallback');
        }
    }, []);

    const handleLaneChange = useCallback((lane: FeedLane) => {
        setActiveLane(lane);
    }, []);

    // Fetch feed when lane changes
    useEffect(() => {
        fetchFeed(activeLane);
        return () => abortRef.current?.abort();
    }, [activeLane, fetchFeed]);

    const handleLoadMore = useCallback(() => {
        if (nextCursor && hasMore) {
            fetchFeed(activeLane, nextCursor, true);
        }
    }, [activeLane, nextCursor, hasMore, fetchFeed]);

    // Determine which posts to show
    const showWitness = activeLane === 'witness';
    const currentWitness = witnessPosts;
    const currentOpinion = opinionPosts;
    const isEmpty = showWitness ? currentWitness.length === 0 : currentOpinion.length === 0;

    return (
        <>
            {/* Hero Section — Doczai mesh gradient */}
            <section className="cv-hero">
                <div className="container">
                    <h1 className="cv-hero__title">
                        Report 📢!<br />Make Your Voice Heard
                    </h1>
                    <p className="cv-hero__subtitle">
                        Verified civic evidence and public discourse — powered by zero-knowledge privacy.
                    </p>
                </div>
            </section>

            <Main>
                {/* Feed Toggle */}
                <div style={{ marginBottom: 'var(--space-5)' }}>
                    <FeedToggle activeLane={activeLane} onLaneChange={handleLaneChange} />
                </div>

                {/* Feed Status */}
                {feedState === 'fallback' && (
                    <div style={{
                        padding: 'var(--space-sm) var(--space-md)',
                        background: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginBottom: 'var(--space-md)',
                        textAlign: 'center',
                    }}>
                        ⚡ Showing sample data — API not connected. Reports will appear here once submitted via the Worker API.
                    </div>
                )}

                {/* Opinion Composer — only on Social lane */}
                {!showWitness && (
                    <OpinionComposer onPostSuccess={() => fetchFeed('social')} />
                )}

                {/* Feed Content */}
                <div
                    id="feed-panel"
                    role="tabpanel"
                    aria-label={`${showWitness ? 'Witness' : 'Social'} feed`}
                    aria-live="polite"
                >
                    {feedState === 'loading' && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: 'var(--space-xl)',
                            color: 'var(--text-muted)',
                        }}>
                            <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>Loading feed...</span>
                        </div>
                    )}

                    {feedState !== 'loading' && isEmpty && (
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--space-xl)',
                            color: 'var(--text-muted)',
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)' }}>
                                {showWitness ? '📢' : '💬'}
                            </div>
                            <h3 style={{ marginBottom: 'var(--space-sm)', color: 'var(--text-main)' }}>
                                No {showWitness ? 'witness reports' : 'social posts'} yet
                            </h3>
                            <p>Be the first to submit a report! Click <strong>File a Report</strong> in the navigation.</p>
                        </div>
                    )}

                    {feedState !== 'loading' && !isEmpty && (
                        <BentoGrid>
                            <StaggeredFeed key={activeLane}>
                                {showWitness
                                    ? currentWitness.map((post) => (
                                        <BentoItem key={post.id} span={2}>
                                            <WitnessCard post={post} />
                                        </BentoItem>
                                    ))
                                    : currentOpinion.map((post) => (
                                        <BentoItem key={post.id} span={1}>
                                            <OpinionCard post={post} />
                                        </BentoItem>
                                    ))}
                            </StaggeredFeed>
                        </BentoGrid>
                    )}

                    {/* Load More Button */}
                    {feedState === 'loaded' && hasMore && !isEmpty && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            marginTop: 'var(--space-xl)',
                        }}>
                            <button
                                type="button"
                                onClick={handleLoadMore}
                                id="load-more-feed"
                                style={{
                                    padding: 'var(--space-sm) var(--space-xl)',
                                    background: 'transparent',
                                    border: 'var(--border-weight, 1px) solid var(--border-color)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-main)',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                Load More
                            </button>
                        </div>
                    )}
                </div>
            </Main>
        </>
    );
};

export default Home;
