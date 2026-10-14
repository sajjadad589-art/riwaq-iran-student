CREATE TABLE push_subscriptions (
 endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX push_user ON push_subscriptions(user_id);
CREATE TABLE notifications (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, link TEXT NOT NULL,
 target_user TEXT REFERENCES app_users(id) ON DELETE CASCADE,
 created_at INTEGER NOT NULL, created_by TEXT NOT NULL REFERENCES app_users(id)
);
CREATE INDEX notifications_time ON notifications(created_at DESC);
CREATE TABLE push_deliveries (
 notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
 endpoint TEXT NOT NULL, user_id TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', updated_at INTEGER NOT NULL,
 PRIMARY KEY(notification_id,endpoint)
);
