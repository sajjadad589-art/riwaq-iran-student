export async function notificationHistory(db){
 const history=await db.prepare("SELECT n.id,n.title,n.created_at,n.target_user,COUNT(d.endpoint) AS total,SUM(d.status='accepted') AS accepted,SUM(d.status='failed') AS failed,SUM(d.status='pending') AS pending,SUM(d.status='sending') AS sending FROM notifications n LEFT JOIN push_deliveries d ON d.notification_id=n.id GROUP BY n.id ORDER BY n.created_at DESC LIMIT 20").all();
 for(const n of history.results){
  const counts=await db.prepare(`SELECT COUNT(*) AS recipients,COALESCE(SUM(has_push),0) AS subscribedUsers,COALESCE(SUM(has_push=0),0) AS unsubscribedUsers,COALESCE(SUM(inbox_shown_at IS NOT NULL),0) AS inAppUsers,
   COALESCE(SUM(EXISTS(SELECT 1 FROM push_deliveries d WHERE d.notification_id=r.notification_id AND d.user_id=r.user_id AND d.received_at IS NOT NULL)),0) AS confirmedUsers,
   COALESCE(SUM(EXISTS(SELECT 1 FROM push_deliveries d WHERE d.notification_id=r.notification_id AND d.user_id=r.user_id AND d.status='accepted')),0) AS acceptedUsers,
   COALESCE(SUM(has_push=1 AND NOT EXISTS(SELECT 1 FROM push_deliveries d WHERE d.notification_id=r.notification_id AND d.user_id=r.user_id AND (d.received_at IS NOT NULL OR d.status<>'failed'))),0) AS failedUsers,
   COALESCE(SUM(has_push=1 AND NOT EXISTS(SELECT 1 FROM push_deliveries d WHERE d.notification_id=r.notification_id AND d.user_id=r.user_id AND d.received_at IS NOT NULL) AND EXISTS(SELECT 1 FROM push_deliveries d WHERE d.notification_id=r.notification_id AND d.user_id=r.user_id AND d.status<>'failed')),0) AS waitingUsers
   FROM notification_recipients r WHERE notification_id=?`).bind(n.id).first();Object.assign(n,counts);
 }
 return history.results;
}
