import React, { useState, useCallback } from 'react';
import { Main, BentoGrid, BentoItem } from '../components/ui';
import { FeedToggle, WitnessCard, OpinionCard, StaggeredFeed } from '../components/feed';
import { mockWitnessPosts, mockOpinionPosts } from '../data/mockFeed';
import type { FeedLane } from '../data/mockFeed';

const Home: React.FC = () => {
    const [activeLane, setActiveLane] = useState<FeedLane>('witness');

    const handleLaneChange = useCallback((lane: FeedLane) => {
        setActiveLane(lane);
    }, []);

    return (
        <Main>
            {/* Page title */}
            <div style={{ marginBottom: 'var(--space-xl)' }}>
                <h1>The Ledger</h1>
                <p style={{ marginTop: 'var(--space-sm)' }}>
                    Verified civic evidence and public discourse.
                </p>
            </div>

            {/* Feed Toggle */}
            <div style={{ marginBottom: 'var(--space-lg)' }}>
                <FeedToggle activeLane={activeLane} onLaneChange={handleLaneChange} />
            </div>

            {/* Feed Content — aria-live so screen readers announce lane switch */}
            <div
                id="feed-panel"
                role="tabpanel"
                aria-label={`${activeLane === 'witness' ? 'Witness' : 'Social'} feed`}
                aria-live="polite"
            >
                <BentoGrid>
                    <StaggeredFeed key={activeLane}>
                        {activeLane === 'witness'
                            ? mockWitnessPosts.map((post) => (
                                <BentoItem key={post.id} span={2}>
                                    <WitnessCard post={post} />
                                </BentoItem>
                            ))
                            : mockOpinionPosts.map((post) => (
                                <BentoItem key={post.id} span={1}>
                                    <OpinionCard post={post} />
                                </BentoItem>
                            ))}
                    </StaggeredFeed>
                </BentoGrid>
            </div>
        </Main>
    );
};

export default Home;
