import React from 'react';
import type { FeedLane } from '../../data/mockFeed';
import './FeedToggle.css';

interface FeedToggleProps {
    activeLane: FeedLane;
    onLaneChange: (lane: FeedLane) => void;
}

export const FeedToggle: React.FC<FeedToggleProps> = ({ activeLane, onLaneChange }) => {
    return (
        <div className="feed-toggle" role="tablist" aria-label="Feed lane selector">
            <button
                type="button"
                className={`feed-toggle__tab ${activeLane === 'witness' ? 'feed-toggle__tab--active feed-toggle__tab--witness' : ''}`}
                role="tab"
                id="tab-witness"
                aria-selected={activeLane === 'witness'}
                aria-controls="feed-panel"
                onClick={() => onLaneChange('witness')}
            >
                <span className="feed-toggle__icon" aria-hidden="true">◈</span>
                Witness
            </button>
            <button
                type="button"
                className={`feed-toggle__tab ${activeLane === 'social' ? 'feed-toggle__tab--active feed-toggle__tab--social' : ''}`}
                role="tab"
                id="tab-social"
                aria-selected={activeLane === 'social'}
                aria-controls="feed-panel"
                onClick={() => onLaneChange('social')}
            >
                <span className="feed-toggle__icon" aria-hidden="true">💬</span>
                Social
            </button>
            <div
                className="feed-toggle__indicator"
                style={{
                    transform: activeLane === 'social' ? 'translateX(100%)' : 'translateX(0)',
                    backgroundColor: activeLane === 'witness' ? 'var(--truth-emerald)' : 'var(--text-main)',
                }}
                aria-hidden="true"
            />
        </div>
    );
};
