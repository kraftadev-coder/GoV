import React from 'react';
import './EvidenceFrame.css';

interface EvidenceFrameProps {
    geoLabel: string;
    contentHash: string;
    mediaUrl?: string;
    children?: React.ReactNode;
}

export const EvidenceFrame: React.FC<EvidenceFrameProps> = ({
    geoLabel,
    contentHash,
    mediaUrl,
    children,
}) => {
    // Truncate hash for display (first 16 + last 8 chars)
    const displayHash =
        contentHash.length > 24
            ? `${contentHash.slice(0, 16)}…${contentHash.slice(-8)}`
            : contentHash;

    return (
        <div className="evidence-frame" role="figure" aria-label={`Evidence from ${geoLabel}`}>
            {/* Top bar — Region label */}
            <div className="evidence-frame__top-bar">
                <span className="evidence-frame__region">
                    <span className="evidence-frame__region-icon" aria-hidden="true">◈</span>
                    {geoLabel}
                </span>
                <span className="evidence-frame__live-tag">EVIDENCE</span>
            </div>

            {/* Media container */}
            <div className="evidence-frame__media">
                {mediaUrl ? (
                    <img
                        src={mediaUrl}
                        alt={`Evidence from ${geoLabel}`}
                        className="evidence-frame__image"
                        loading="lazy"
                        decoding="async"
                    />
                ) : children ? (
                    children
                ) : (
                    <div className="evidence-frame__placeholder">
                        <span className="evidence-frame__placeholder-icon" aria-hidden="true">📸</span>
                        <span className="evidence-frame__placeholder-text">Evidence on file</span>
                    </div>
                )}
            </div>

            {/* Bottom bar — SHA-256 hash */}
            <div className="evidence-frame__bottom-bar">
                <span className="evidence-frame__hash-label">SHA-256</span>
                <span className="evidence-frame__hash-value" title={contentHash}>{displayHash}</span>
            </div>
        </div>
    );
};
