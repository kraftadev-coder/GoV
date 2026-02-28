CivicVoice: Security Hardening & Edge Case Protocol v1.0

Architect: Senior Software Engineer (Security & Infrastructure Focus)

Applicability: Antigravity Development / Cloudflare Pages / Workers / R2

Core Objective: Technical enforcement of the "Zero-Knowledge" promise and platform resilience against bad actors.

1. The "Amnesia" Security Standard (Identity Protection)

To fulfill the anonymity goal, we must treat a user's IP address and session data as "Toxic Waste."

1.1 Stateless Edge Execution

Protocol: Cloudflare Workers MUST be configured with node_compat = false to ensure no persistent filesystem access.

Log Suppression: Explicitly disable Cloudflare Request Logs for the /api/whistle endpoint.

Header Purging: The Worker must immediately extract CF-IPCountry and then delete the x-real-ip and cf-connecting-ip headers from the request object before processing the payload.

1.2 Client-Side Sanitization (The Scrub)

Constraint: Media metadata scrubbing MUST happen in the browser (using exif-js or similar) before the upload starts.

Edge Case: If a user has JavaScript disabled or the scrub fails, the Cloudflare Worker MUST reject the file. Never allow a "Raw" file to touch R2 storage.

2. Primary Data Integrity (Anti-Spoofing)

We verify the Location, not the User. This creates unique security challenges.

2.1 The "VPN Paradox"

The Problem: Nigerian users often use VPNs for privacy, which masks their Cloudflare Edge location (making them appear to be in the US/UK).

The Solution: Dual-Key Verification.

Key A (Network): Cloudflare Edge Location.

Key B (Device): Browser Geolocation API.

Logic: If Key A and Key B do not match (e.g., VPN is on), the post is marked as "Remote Verified" rather than "Witness Verified." This maintains transparency without blocking the user.

2.2 Deepfake & AI Audio Gating

The Problem: Malicious actors uploading AI-generated "leaks."

The Solution: The "Witness Cam" MUST record in a high-fidelity .webm or .ogg format that includes background ambient noise signatures.

Edge Case: If the audio file is "too clean" (zero noise floor), the system flags it for community peer-review before giving it the Emerald Badge.

3. Defense Against "Founder Ruin" (Cost Security)

A solo builder’s biggest security risk is a "Data Bomb" that fills up R2 storage and results in a massive bill.

3.1 Data Bombing Prevention

Rate Limiting: Implement "Leaky Bucket" rate limiting at the Cloudflare WAF level. Max 3 whistleblowing attempts per hour per device fingerprint.

Payload Capping: * Images: Max 5MB.

Audio: Max 10MB.

Video: Max 25MB (Gated by Reputation > 1000).

R2 Lifecycle Policy: Configure R2 to automatically delete "Pending" or "Orphaned" uploads that haven't been linked to a D1 database record within 24 hours.

4. Edge Case Scenarios & Failure Modes

4.1 "The 3G Drop-out" (Network Resilience)

Scenario: A whistleblower is recording on a slow MTN/Airtel 3G connection and the signal drops.

Implementation: Use Tus.io or a "Resumable Upload" logic for R2. The PWA must store the "Proof" in IndexedDB locally until a 200 OK signal is received from the Worker.

4.2 "The Sudden Take-down" (Censorship Resilience)

Scenario: The platform is targeted for a DNS block in Nigeria.

Implementation: 1.  Worker Mirrors: Deploy the same Worker code to multiple "worker.dev" subdomains.

2.  Client-Side Switch: If civicvoice.ng returns a 502 or timeout, the PWA automatically tries a secondary "Mirror" API endpoint.

4.3 "The Reputation Sybil Attack"

Scenario: A botnet creates 1,000 accounts to upvote a fake leak to gain "Advanced Witness" status.

Implementation: Reputation points for "Advanced" status are weighted by Location Diversity. 100 upvotes from the same cell tower count as 1 upvote. 100 upvotes from different states count as 100.

5. Antigravity & GitHub Workflow Security

5.1 Secret Management

Strict Rule: No API Keys (PayStack, Google Maps) in the code. Use Cloudflare Worker Secrets (wrangler secret put).

CI/CD Audit: Use GitHub Actions to run gitleaks on every push to ensure no developer accidentally commits a private key.

5.2 Content Security Policy (CSP)

Ensure the Next.js app sends a strict CSP header:

connect-src: Only allow *.cloudflare.com and your specific API domains.

camera: Only allowed on the /report route.

6. Summary for Development

Risk

Mitigation

User Identity Leak

Stateless Workers + IP Header Deletion.

Fake Proofs

In-app Camera Gating + Network Geo-stamping.

High Storage Bills

Client-side compression + Reputation Gating for Video.

Network Failure

IndexedDB local persistence + Resumable Uploads.

Legal Pressure

Data Zero-Storage (You can't give what you don't have).