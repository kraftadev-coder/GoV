CivicVoice: Product Feature Matrix (Antigravity Source)

Core Goal: A forum for interaction and opinions on social/political matters, whistleblowing with verified proof (photo/file/video), with options for total anonymity or persistent accounts.

Goal Requirement

UX / Technical Feature

How it Achieves the Goal

User Protection (Friends)

Founder Protection (You)

"Interact and air opinions"

Dual-Lane Feed (Social vs. Whistle)

Separates casual discourse from high-stakes evidence, allowing daily engagement.

Allows users to discuss light matters without triggering heavy security protocols.

Reduces moderation overhead by isolating "Opinions" from "Verified Leaks."

"Blow whistle with proofs"

The Witness Cam (Primary Data Engine)

In-app capture attaches cryptographic Geo-Stamps and Timestamps to media.

Provides built-in credibility; the user doesn't have to "prove" they were at the scene.

Eliminates "Fake News" liability. You are hosting data verified by the device, not just the user.

"File and Photo uploads"

Metadata Scrubber & Amnesia Protocol

Client-side JS wipes EXIF data (Author, Device ID) before the file hits Cloudflare R2.

Prevents accidental self-doxxing via photo metadata or document properties.

Plausible Deniability. You cannot be forced to hand over identity data that was never stored.

"Video uploads"

Advanced Witness Gating (Reputation)

Unlocks 15s video proofing for users with high trust scores.

Enables the highest level of proof for the most trusted community members.

Cost Protection: Prevents storage/bandwidth bills from exploding due to spam or viral video spikes.

"Option to remain anonymous"

Zero-Knowledge Auth (No SIM/NIN)

Uses Cloudflare Workers to handle stateless sessions without logging IP addresses.

Total immunity from government or corporate tracking via phone numbers (NIN).

Technical immunity. Since you don't store PII, you are not a target for subpoenas or data breaches.

"Option to create an account"

Reputation Engine & Crypto-Handles

Users build "Trust Capital" over time via upvotes and verified reports.

Allows "Known Anonymous" personas (e.g., @LekkiWitness) to lead the movement.

Encourages self-moderation. High-reputation users act as the platform's "Trust Layer."

"Modern & Premium Feel"

Bento Grid & Cinematic UI

High-fidelity animations (Emerald Stamp) signal authority and integrity.

Increases psychological safety; a professional tool feels safer than a "shady" forum.

Investor Attraction. A premium product justifies funding and high-level partnerships.

Technical Enforcement for Antigravity Devs

1. The "Amnesia" Constraint

Every feature in the whistleblowing lane MUST pass through the scrubMedia() function.

Input: Raw File + GPS Coordinates.

Output: Sanitized File + Anonymized Geo-Label (e.g., "Ikeja District").

2. The "Founder Survival" Constraint

Video features MUST be gated by the reputationScore >= 1000 logic. This ensures that the high costs associated with Cloudflare R2 storage are only incurred for the most valuable "Primary Data."

3. The "Network Reality" Constraint

All media MUST be compressed client-side using ffmpeg.wasm.

Target: No whistleblower upload should exceed 5MB, regardless of original file size. This protects the Nigerian user's data plan and the platform's storage budget.

Architect's Note: This matrix ensures the project remains a "Neutral Pipe" for truth. By verifying the Data (Where/When) instead of the User (Who), we achieve the goal while making the platform technically impossible to compromise.