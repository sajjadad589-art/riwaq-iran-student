ALTER TABLE app_users ADD COLUMN last_login_at INTEGER;
ALTER TABLE app_users ADD COLUMN last_seen_at INTEGER;
-- Existing registrations automatically created a signed-in session.
UPDATE app_users SET last_login_at=created_at;
CREATE TABLE app_presence (
 session_hash TEXT NOT NULL REFERENCES app_sessions(token_hash) ON DELETE CASCADE,
 tab_id TEXT NOT NULL,
 seen_at INTEGER NOT NULL,
 PRIMARY KEY(session_hash,tab_id)
);
CREATE INDEX presence_seen ON app_presence(seen_at);
