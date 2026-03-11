import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
    { path: '/', label: 'Feed' },
    { path: '/report', label: 'Report' },
    { path: '/guide', label: 'Community' },
];

export const Navbar: React.FC = () => {
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 sm:gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cta sm:h-10 sm:w-10">
                    <span className="text-base font-black text-white sm:text-lg">G</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-black tracking-tight text-text-primary sm:text-base">GoVoicing</span>
                    <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.15em] text-success sm:text-[9px]">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                        Live Ledger
                    </span>
                </div>
            </Link>

            {/* Center Nav Links — Desktop */}
            <nav className="hidden items-center gap-8 md:flex">
                {navLinks.map((link) => (
                    <Link
                        key={link.path}
                        to={link.path}
                        className={`text-sm transition-colors duration-200 ${
                            location.pathname === link.path
                                ? 'font-semibold text-text-primary'
                                : 'font-medium text-text-secondary hover:text-text-primary'
                        }`}
                    >
                        {link.label}
                    </Link>
                ))}
            </nav>

            {/* Right Icons — Desktop */}
            <div className="hidden items-center gap-3 md:flex">
                <button className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                    </svg>
                </button>
                <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                    </svg>
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-danger" />
                </button>
                <Link
                    to="/profile"
                    className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-text-primary shadow-sm transition-all hover:border-brand/30 hover:shadow-md hover:shadow-brand/5"
                >
                    <svg className="h-4 w-4 text-text-secondary" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z" />
                    </svg>
                    Profile
                </Link>
            </div>

            {/* Mobile: Hamburger + Profile */}
            <div className="flex items-center gap-2 md:hidden">
                <Link to="/profile" className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-white text-text-secondary">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z" />
                    </svg>
                </Link>
                <button
                    onClick={() => setMenuOpen(!menuOpen)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-text-primary transition-colors hover:bg-surface-muted"
                    aria-label="Toggle menu"
                >
                    {menuOpen ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                    ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                    )}
                </button>
            </div>

            {/* Mobile Menu Dropdown */}
            {menuOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mx-3 mt-2 rounded-2xl border border-border bg-white/95 p-4 shadow-xl backdrop-blur-xl md:hidden">
                    <nav className="flex flex-col gap-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                onClick={() => setMenuOpen(false)}
                                className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                                    location.pathname === link.path
                                        ? 'bg-surface-muted font-semibold text-text-primary'
                                        : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                                }`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            )}
        </div>
    );
};
