import React from 'react';
import type { OpinionPost } from '../../data/mockFeed';
import './OpinionCard.css';

interface OpinionCardProps {
    post: OpinionPost;
}

export const OpinionCard: React.FC<OpinionCardProps> = ({ post }) => {
    return (
        <article className="opinion-card" aria-label={`Opinion by ${post.handle}`}>
            {/* Header — Handle + Timestamp */}
            <div className="opinion-card__header">
                <span className="opinion-card__handle">{post.handle}</span>
                <time className="opinion-card__timestamp" dateTime={post.createdAt}>
                    {post.timestamp}
                </time>
            </div>

            {/* Body — Opinion text */}
            <div className="opinion-card__body">
                <p className="opinion-card__text">{post.text}</p>
            </div>

            {/* Footer — Interaction hint */}
            <div className="opinion-card__footer">
                <button type="button" className="opinion-card__action" aria-label={`Discuss opinion by ${post.handle}`}>
                    Discuss →
                </button>
            </div>
        </article>
    );
};
