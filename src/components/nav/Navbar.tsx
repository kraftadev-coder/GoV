import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

const navLinks = [
    { path: '/', label: 'Feed' },
    { path: '/report', label: 'Report' },
    { path: '/profile', label: 'Profile' },
];

export const Navbar: React.FC = () => {
    const location = useLocation();

    return (
        <>
            {/* Logo */}
            <Link to="/" className="cv-nav__logo">
                <span className="cv-nav__logo-mark">◈</span>
                <span className="cv-nav__logo-text">CivicVoice</span>
            </Link>

            {/* Navigation Links */}
            <nav className="cv-nav__links">
                {navLinks.map((link) => (
                    <Link
                        key={link.path}
                        to={link.path}
                        className={`cv-nav__link ${location.pathname === link.path ? 'cv-nav__link--active' : ''}`}
                    >
                        {link.label}
                    </Link>
                ))}
            </nav>
        </>
    );
};
