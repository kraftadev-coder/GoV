/**
 * Guide / Community Page — Modern Citizen Hub Design
 * Platform features, how-it-works, use cases, privacy promise.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const features = [
    { id: 'witness-feed', title: 'Dual-Lane Feed', tagline: 'Truth & Opinion, separated.', description: 'GoVoicing separates verified witness reports from personal opinions. Toggle between the "Witness" lane and the "Social" lane.', steps: ['Open the home Feed page', 'Use the toggle to switch between Witness and Social lanes', 'Witness cards show verified evidence with emerald stamps', 'Opinion cards show community discussions'], cta: { label: 'View Feed →', path: '/' }, icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6V7.5z" /></svg>
    ) },
    { id: 'witness-cam', title: 'Witness Cam & Report', tagline: 'Capture. Scrub. Submit.', description: 'Use your device camera to capture evidence. GoVoicing strips all metadata to protect your identity.', steps: ['Tap "Report" in navigation', 'Grant camera permission and capture', 'Preview and confirm your media', 'Watch Amnesia Protocol scrub metadata', 'Submit with human verification'], cta: { label: 'Submit a Report →', path: '/report' }, icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
    ) },
    { id: 'amnesia-protocol', title: 'Amnesia Protocol', tagline: 'Your identity is invisible.', description: 'Multi-layer privacy shield that strips IPs, purges headers, scrubs metadata, and rotates sessions.', steps: ['EXIF metadata stripped from all media', 'IP addresses purged at the edge', 'Voice recordings pitch-shifted', 'Geo-location generalized to district level', 'Session tokens are cryptographic hashes'], cta: { label: 'View Privacy Audit →', path: '/profile' }, icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
    ) },
    { id: 'reputation', title: 'Reputation Engine', tagline: 'Earn trust. Unlock features.', description: 'Your anonymous reputation grows as you contribute quality reports. Higher reputation unlocks video submissions.', steps: ['Start as "Junior Witness"', 'Submit verified reports for points', '500 pts → "Field Reporter"', '1000 pts → "Senior Correspondent" (video unlocked)', 'Location diversity boosts score'], cta: { label: 'Check Reputation →', path: '/profile' }, icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
    ) },
];

const useCases = [
    { title: 'Infrastructure Failures', desc: 'Collapsed bridges, broken roads, flooding — geo-verified evidence.', icon: '🏗️' },
    { title: 'Power & Water Outages', desc: 'Extended blackouts or water cuts. Geo-stamped service failure maps.', icon: '⚡' },
    { title: 'Healthcare Gaps', desc: 'Empty pharmacies, understaffed clinics. Evidence drives accountability.', icon: '🏥' },
    { title: 'Election Monitoring', desc: 'Voting irregularities, intimidation — identity protected.', icon: '🗳️' },
    { title: 'Education Access', desc: 'School closures, missing teachers, infrastructure problems.', icon: '🏫' },
    { title: 'Environmental Issues', desc: 'Illegal dumping, oil spills, pollution — geo-verified location.', icon: '🌿' },
];

const Guide: React.FC = () => {
    const [activeFeature, setActiveFeature] = useState(0);

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            {/* Hero */}
            <section className="mb-16 text-center">
                <div className="glass-panel mb-6 inline-flex items-center gap-2 rounded-full px-5 py-2">
                    <span className="meta-label">How It Works</span>
                </div>
                <h1 className="text-4xl font-black tracking-tighter text-text-primary sm:text-5xl lg:text-6xl">
                    Civic Accountability,<br />
                    <span className="text-brand">Powered by Citizens.</span>
                </h1>
                <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-text-body">
                    GoVoicing is a privacy-first civic reporting platform. Submit anonymous, geo-verified
                    evidence — no email, no phone, no tracking.
                </p>
                <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                    <Link to="/report" className="btn-primary group">
                        Submit a Report
                        <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                    </Link>
                    <a href="#features" className="btn-secondary">Learn More ↓</a>
                </div>

                {/* Stats */}
                <div className="mx-auto mt-12 flex max-w-md items-center justify-center gap-8">
                    {[{ val: '0', label: 'PII Stored' }, { val: '256-bit', label: 'Identity Hash' }, { val: '100%', label: 'Anonymous' }].map((s, i) => (
                        <div key={i} className={`text-center ${i > 0 ? 'border-l border-border pl-8' : ''}`}>
                            <div className="text-2xl font-black tracking-tight text-text-primary">{s.val}</div>
                            <div className="meta-label mt-1 text-text-secondary">{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* 3 Steps */}
            <section className="mb-16">
                <h2 className="mb-8 text-center text-2xl font-black tracking-tighter sm:text-3xl">3 Steps to Civic Accountability</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                    {[
                        { num: '01', title: 'Capture', desc: 'Use your phone camera to document governance failures.', icon: (<svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>) },
                        { num: '02', title: 'Protect', desc: 'Amnesia Protocol strips metadata, purges IPs, disguises voice.', icon: (<svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>) },
                        { num: '03', title: 'Publish', desc: 'Geo-verified report appears in the Witness Feed — anonymous and credible.', icon: (<svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>) },
                    ].map((step, i) => (
                        <div key={i} className="modern-card p-6 text-center">
                            <div className="meta-label mb-3 text-brand">{step.num}</div>
                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-text-secondary">{step.icon}</div>
                            <h3 className="mb-2 text-lg font-black tracking-tight">{step.title}</h3>
                            <p className="text-[13px] leading-relaxed text-text-body">{step.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features Deep Dive */}
            <section id="features" className="mb-16">
                <h2 className="mb-2 text-center text-2xl font-black tracking-tighter sm:text-3xl">Platform Features</h2>
                <p className="mb-8 text-center text-[14px] text-text-body">Every feature built with privacy-first principles.</p>

                <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                    {/* Tabs */}
                    <div className="flex flex-row gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
                        {features.map((f, i) => (
                            <button
                                key={f.id}
                                onClick={() => setActiveFeature(i)}
                                className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition-all duration-300 ${
                                    i === activeFeature
                                        ? 'bg-cta text-white font-semibold shadow-lg shadow-cta/10'
                                        : 'bg-white text-text-secondary hover:bg-surface-muted border border-border'
                                }`}
                            >
                                <span className={i === activeFeature ? 'text-white' : 'text-text-secondary'}>{f.icon}</span>
                                <span className="whitespace-nowrap">{f.title}</span>
                            </button>
                        ))}
                    </div>

                    {/* Detail */}
                    <div className="modern-card p-6 sm:p-8">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-brand">
                            {features[activeFeature].icon}
                        </div>
                        <h3 className="mb-1 text-xl font-black tracking-tight">{features[activeFeature].title}</h3>
                        <p className="mb-3 text-[13px] font-semibold text-brand">{features[activeFeature].tagline}</p>
                        <p className="mb-5 text-[14px] leading-relaxed text-text-body">{features[activeFeature].description}</p>
                        <div className="mb-5 space-y-2">
                            <h4 className="meta-label text-text-secondary">How to use:</h4>
                            {features[activeFeature].steps.map((step, i) => (
                                <div key={i} className="flex items-start gap-3 text-[13px] text-text-body">
                                    <span className="meta-label mt-0.5 text-brand">{i + 1}</span>
                                    <span>{step}</span>
                                </div>
                            ))}
                        </div>
                        <Link to={features[activeFeature].cta.path} className="btn-primary inline-flex text-sm">
                            {features[activeFeature].cta.label}
                        </Link>
                    </div>
                </div>
            </section>

            {/* Use Cases */}
            <section className="mb-16">
                <h2 className="mb-2 text-center text-2xl font-black tracking-tighter sm:text-3xl">What Can You Report?</h2>
                <p className="mb-8 text-center text-[14px] text-text-body">Documenting governance failures across every sector.</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {useCases.map((uc, i) => (
                        <div key={i} className="modern-card p-6">
                            <span className="mb-3 block text-2xl">{uc.icon}</span>
                            <h4 className="mb-2 text-[15px] font-bold tracking-tight">{uc.title}</h4>
                            <p className="text-[13px] leading-relaxed text-text-body">{uc.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Privacy Promise */}
            <section className="mb-16">
                <div className="rounded-[28px] bg-[#1a1d23] p-8 text-white shadow-2xl sm:p-10">
                    <div className="mb-6 flex items-center gap-2">
                        <svg className="h-5 w-5 text-brand" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 00-6 0V9h6z" clipRule="evenodd" /></svg>
                        <h2 className="text-xl font-black tracking-tight">Our Privacy Promise</h2>
                    </div>
                    <div className="grid gap-6 sm:grid-cols-2">
                        <div>
                            <h4 className="mb-3 text-[13px] font-black uppercase tracking-[0.15em] text-success">✅ What We DO</h4>
                            <ul className="space-y-2 text-[13px] text-white/70">
                                {['Strip all photo/video metadata', 'Purge IP addresses at edge', 'Hash identity with 256-bit encryption', 'Disguise audio recordings', 'Generalize location to district', 'Run data through Amnesia Protocol'].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2"><span className="mt-0.5 text-success">•</span>{item}</li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="mb-3 text-[13px] font-black uppercase tracking-[0.15em] text-danger">❌ What We NEVER Do</h4>
                            <ul className="space-y-2 text-[13px] text-white/70">
                                {['Store email, phone, or real name', 'Log IP address or device fingerprint', 'Use tracking cookies or analytics', 'Share data with third parties', 'Store exact GPS coordinates', 'Require account registration'].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2"><span className="mt-0.5 text-danger">•</span>{item}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Footer */}
            <section className="mb-8 text-center">
                <h2 className="mb-3 text-3xl font-black tracking-tighter sm:text-4xl">Ready to Be the Witness?</h2>
                <p className="mb-8 text-[15px] text-text-body">Your voice matters. Your identity is protected.</p>
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                    <Link to="/report" className="btn-primary group">
                        Submit Evidence Now
                        <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                    </Link>
                    <Link to="/" className="btn-secondary">Browse the Feed</Link>
                </div>
            </section>
        </div>
    );
};

export default Guide;
