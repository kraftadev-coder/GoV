import React, { useState, useCallback } from 'react';
import { Badge } from '../ui';
import { EvidenceFrame } from './EvidenceFrame';
import type { WitnessPost } from '../../data/mockFeed';
import './WitnessCard.css';

interface WitnessCardProps {
    post: WitnessPost;
}

export const WitnessCard: React.FC<WitnessCardProps> = ({ post }) => {
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseEnter = useCallback(() => setIsHovered(true), []);
    const handleMouseLeave = useCallback(() => setIsHovered(false), []);

    return (
        <article
            className={`witness-card ${isHovered ? 'witness-card--hovered' : ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            aria-label={`Witness report from ${post.geoLabel}`}
        >
            {/* Header — Status + Timestamp */}
            <div className="witness-card__header">
                <div className="witness-card__status">
                    <Badge variant={post.verified ? 'emerald' : 'amber'} pulse={isHovered && post.verified}>
                        {post.verified ? '✓ Witness Verified' : '◈ Pending Review'}
                    </Badge>
                </div>
                <time className="witness-card__timestamp" dateTime={post.createdAt}>
                    {post.timestamp}
                </time>
            </div>

            {/* Body — Excerpt */}
            <div className="witness-card__body">
                <p className="witness-card__excerpt">{post.excerpt}</p>
            </div>

            {/* Evidence Frame */}
            <div className="witness-card__evidence">
                <EvidenceFrame
                    geoLabel={post.geoLabel}
                    contentHash={post.contentHash}
                    mediaUrl={post.mediaUrl}
                />
            </div>

            {/* Footer — Score + Meta */}
            <div className="witness-card__footer">
                <Badge variant={post.score >= 1000 ? 'emerald' : 'neutral'}>
                    Score: {post.score.toLocaleString()}
                </Badge>
                <span className="witness-card__meta">
                    {post.verified ? 'Geo-verified evidence' : 'Awaiting verification'}
                </span>
            </div>

            {/* Emerald stamp — always in DOM, visibility controlled via CSS */}
            <div
                className={`witness-card__stamp ${isHovered && post.verified ? 'witness-card__stamp--visible' : ''}`}
                aria-hidden="true"
            >
                <span className="witness-card__stamp-icon">◈</span>
            </div>
        </article>
    );
};
