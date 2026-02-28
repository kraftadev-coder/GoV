import React from 'react';
import './Layout.css';

/* AppShell — main app wrapper */
interface AppShellProps {
    children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
    return <div className="cv-shell">{children}</div>;
};

/* Header — top navigation */
interface HeaderProps {
    children: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ children }) => {
    return (
        <header className="cv-header">
            <div className="container">
                {children}
            </div>
        </header>
    );
};

/* Main content area */
interface MainProps {
    children: React.ReactNode;
    className?: string;
}

export const Main: React.FC<MainProps> = ({ children, className = '' }) => {
    return (
        <main className={`cv-main ${className}`}>
            <div className="container">
                {children}
            </div>
        </main>
    );
};

/* BentoGrid — Asymmetric grid system for the feed */
interface BentoGridProps {
    children: React.ReactNode;
    className?: string;
}

export const BentoGrid: React.FC<BentoGridProps> = ({ children, className = '' }) => {
    return (
        <div className={`cv-bento ${className}`}>
            {children}
        </div>
    );
};

/* BentoItem — individual grid cell */
interface BentoItemProps {
    children: React.ReactNode;
    span?: 1 | 2;  /* 1 = Opinion (1x), 2 = Witness (2x) */
    className?: string;
}

export const BentoItem: React.FC<BentoItemProps> = ({ children, span = 1, className = '' }) => {
    return (
        <div className={`cv-bento__item cv-bento__item--span-${span} ${className}`}>
            {children}
        </div>
    );
};
