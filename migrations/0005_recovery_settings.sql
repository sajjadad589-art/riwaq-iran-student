CREATE TABLE recovery_email_settings (id INTEGER PRIMARY KEY CHECK(id=1), sender TEXT NOT NULL, key_cipher TEXT NOT NULL, updated_at INTEGER NOT NULL);
