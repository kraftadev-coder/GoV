import React from 'react';
import './Card.css';

export type CardVariant = 'default' | 'witness' | 'opinion';

interface CardProps {
    variant?: CardVariant;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
    variant = 'default',
    children,
    className = '',
    style,
    onClick,
}) => {
    return (
        <div
            className={`cv-card cv-card--${variant} ${className}`}
            style={style}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            {children}
        </div>
    );
};

/* Sub-components for structured content */
export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = '',
}) => <div className={`cv-card__header ${className}`}>{children}</div>;

export const CardBody: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = '',
}) => <div className={`cv-card__body ${className}`}>{children}</div>;

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({
    children,
    className = '',
}) => <div className={`cv-card__footer ${className}`}>{children}</div>;
