CREATE TABLE user_data(user_id TEXT PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,revision INTEGER NOT NULL DEFAULT 0,document TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE tutor_turns(user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,id TEXT NOT NULL,prompt TEXT NOT NULL,reply TEXT,status TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,id));
CREATE UNIQUE INDEX tutor_one_pending ON tutor_turns(user_id) WHERE status='pending';
CREATE TABLE tutor_budget(day TEXT NOT NULL,scope TEXT NOT NULL,used INTEGER NOT NULL,PRIMARY KEY(day,scope));
