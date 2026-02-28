import React from 'react';
import './Badge.css';

export type BadgeVariant = 'emerald' | 'amber' | 'neutral' | 'danger';

interface BadgeProps {
    variant?: BadgeVariant;
    children: React.ReactNode;
    pulse?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
    variant = 'neutral',
    children,
    pulse = false,
    className = '',
    style,
}) => {
    return (
        <span className={`cv-badge cv-badge--${variant} ${pulse ? 'cv-badge--pulse' : ''} ${className}`} style={style}>
            {children}
        </span>
    );
};
