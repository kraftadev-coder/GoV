import React, { useEffect, useState } from 'react';
import './StaggeredFeed.css';

interface StaggeredFeedProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * StaggeredFeed applies slide-up staggered entrance animation to its children.
 * Uses React.Fragment so it doesn't break parent CSS grid layout.
 * Clones each child to inject stagger animation CSS classes and delay.
 */
export const StaggeredFeed: React.FC<StaggeredFeedProps> = ({ children, className = '' }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger animation after a brief delay so the initial opacity:0 is painted
        const timer = requestAnimationFrame(() => {
            setIsVisible(true);
        });

        return () => cancelAnimationFrame(timer);
    }, []);

    return (
        <>
            {React.Children.map(children, (child, index) => {
                if (!React.isValidElement(child)) return child;

                const staggerClass = isVisible ? 'stagger-animate' : 'stagger-hidden';
                const childProps = child.props as { className?: string; style?: React.CSSProperties };
                const existingClassName = childProps.className || '';

                return React.cloneElement(child as React.ReactElement<{ className?: string; style?: React.CSSProperties }>, {
                    className: `${existingClassName} ${staggerClass} ${className}`.trim(),
                    style: {
                        ...(childProps.style || {}),
                        '--stagger-index': index,
                    } as React.CSSProperties,
                });
            })}
        </>
    );
};
