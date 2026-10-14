ALTER TABLE push_deliveries ADD COLUMN receipt_hash TEXT;
ALTER TABLE push_deliveries ADD COLUMN received_at INTEGER;
CREATE INDEX delivery_receipts ON push_deliveries(notification_id,receipt_hash);
CREATE TABLE notification_recipients (
 notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 has_push INTEGER NOT NULL DEFAULT 0, inbox_shown_at INTEGER,
 PRIMARY KEY(notification_id,user_id)
);
INSERT INTO notification_recipients(notification_id,user_id,has_push)
 SELECT n.id,u.id,EXISTS(SELECT 1 FROM push_deliveries d WHERE d.notification_id=n.id AND d.user_id=u.id)
 FROM notifications n JOIN app_users u ON (n.target_user IS NULL OR n.target_user=u.id) AND u.created_at<=n.created_at;
