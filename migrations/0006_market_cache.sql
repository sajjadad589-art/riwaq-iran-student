CREATE TABLE market_source_cache (
 id TEXT PRIMARY KEY, payload TEXT, fetched_at INTEGER NOT NULL DEFAULT 0,
 last_attempt INTEGER NOT NULL DEFAULT 0, lock_until INTEGER NOT NULL DEFAULT 0,
 lock_token TEXT, last_error TEXT
);
