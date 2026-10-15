ALTER TABLE tutor_turns ADD COLUMN source TEXT NOT NULL DEFAULT 'ai';
CREATE TABLE tutor_answer_cache(cache_key TEXT PRIMARY KEY,reply TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,hits INTEGER NOT NULL DEFAULT 0);
CREATE TABLE tutor_cache_locks(cache_key TEXT PRIMARY KEY,owner TEXT NOT NULL,expires_at INTEGER NOT NULL);
