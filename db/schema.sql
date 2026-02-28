-- CivicVoice D1 Schema
-- Source: Technical Blueprint §4, Implementation Plan Module 5
--
-- Tables:
--   witness_reports  — stores every submitted report
--   anon_reputation  — anonymous user reputation scores

/* ─── witness_reports ─── */
CREATE TABLE IF NOT EXISTS witness_reports (
    report_id       TEXT PRIMARY KEY,
    anon_token      TEXT NOT NULL,
    media_key       TEXT,                           -- R2 object key (null if R2 unavailable)
    media_type      TEXT CHECK(media_type IN ('image', 'audio', 'video')) DEFAULT 'image',
    file_size       INTEGER DEFAULT 0,              -- bytes
    geo_label       TEXT NOT NULL DEFAULT 'Unknown', -- "Lagos, NG" or "Ikeja District"
    network_country TEXT,                           -- CF-IPCountry (Key A)
    device_country  TEXT,                           -- Browser Geolocation country (Key B)
    verification_status TEXT CHECK(verification_status IN ('pending', 'witness-verified', 'remote-verified'))
                        DEFAULT 'pending',
    witness_score   INTEGER DEFAULT 0,
    content_hash    TEXT NOT NULL,                  -- SHA-256 integrity hash
    lane            TEXT CHECK(lane IN ('witness', 'social')) NOT NULL DEFAULT 'witness',
    title           TEXT DEFAULT '',
    description     TEXT DEFAULT '',
    upvotes         INTEGER DEFAULT 0,
    status          TEXT CHECK(status IN ('active', 'flagged', 'removed')) DEFAULT 'active',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Feed queries: filter by lane, order by newest
CREATE INDEX IF NOT EXISTS idx_reports_lane_created
    ON witness_reports(lane, created_at DESC);

-- Rate limiting: count recent reports by anon_token
CREATE INDEX IF NOT EXISTS idx_reports_token_created
    ON witness_reports(anon_token, created_at DESC);

-- Lookup by content hash (deduplication)
CREATE INDEX IF NOT EXISTS idx_reports_content_hash
    ON witness_reports(content_hash);

-- Flagged reports for moderation queue (Module 7)
CREATE INDEX IF NOT EXISTS idx_reports_status
    ON witness_reports(status);

/* ─── anon_reputation ─── */
CREATE TABLE IF NOT EXISTS anon_reputation (
    anon_token      TEXT PRIMARY KEY,
    points          INTEGER NOT NULL DEFAULT 0,
    level           TEXT CHECK(level IN ('junior', 'advanced')) NOT NULL DEFAULT 'junior',
    verified_reports INTEGER NOT NULL DEFAULT 0,
    peer_upvotes    INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Leaderboard / top contributors
CREATE INDEX IF NOT EXISTS idx_reputation_points
    ON anon_reputation(points DESC);

/* ─── admin_activity_log (Module 7) ─── */
CREATE TABLE IF NOT EXISTS admin_activity_log (
    event_id        TEXT PRIMARY KEY,
    event_type      TEXT NOT NULL CHECK(event_type IN (
        'report_submitted', 'report_verified', 'report_flagged',
        'report_approved', 'report_rejected', 'report_escalated',
        'user_registered', 'user_level_up', 'rate_limit_hit'
    )),
    target_id       TEXT,                               -- report_id or anon_token hash
    geo_label       TEXT DEFAULT 'Unknown',
    details         TEXT DEFAULT '',                     -- JSON string for extra context
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Recent activity: chronological order
CREATE INDEX IF NOT EXISTS idx_activity_created
    ON admin_activity_log(created_at DESC);

-- Filter by event type
CREATE INDEX IF NOT EXISTS idx_activity_type
    ON admin_activity_log(event_type, created_at DESC);

/* ─── platform_metrics (Module 7) ─── */
CREATE TABLE IF NOT EXISTS platform_metrics (
    date            TEXT PRIMARY KEY,                    -- YYYY-MM-DD
    total_reports   INTEGER NOT NULL DEFAULT 0,
    total_users     INTEGER NOT NULL DEFAULT 0,
    flagged_count   INTEGER NOT NULL DEFAULT 0,
    verified_count  INTEGER NOT NULL DEFAULT 0,
    storage_bytes   INTEGER NOT NULL DEFAULT 0,
    worker_invocations INTEGER NOT NULL DEFAULT 0,
    rate_limit_hits INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
