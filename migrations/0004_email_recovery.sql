ALTER TABLE app_users ADD COLUMN email TEXT;
CREATE TABLE password_resets (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 email TEXT NOT NULL, password_hash TEXT NOT NULL, code_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, consumed INTEGER NOT NULL DEFAULT 0, ready INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX reset_user ON password_resets(user_id);
CREATE INDEX reset_expiry ON password_resets(expires_at);
CREATE TABLE reset_cooldowns (key TEXT PRIMARY KEY, requested_at INTEGER NOT NULL);
CREATE TABLE email_send_budget (day TEXT PRIMARY KEY, sent INTEGER NOT NULL DEFAULT 0);
