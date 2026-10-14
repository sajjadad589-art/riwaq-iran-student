import {json,sameOrigin,body,throttle,digest} from '../../server/security.js';
import {notificationInput,subscriptionInput,deliver,deliveryReceiptToken} from '../../server/notifications.js';
import {notificationHistory} from '../../server/notification-stats.js';
export async function onRequest({request,env,data}){
 const user=data.user,db=env.DB;
 if(request.method==='GET'){
  const messages=await db.prepare('SELECT id,title,body,link,created_at FROM notifications WHERE (target_user IS NULL OR target_user=?) AND created_at>=? ORDER BY created_at DESC LIMIT 50').bind(user.id,user.created_at||0).all();
  const ready=!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY);
  if(user.role!=='admin')return json({messages:messages.results,publicKey:ready?env.VAPID_PUBLIC_KEY:null});
  const history=await notificationHistory(db);
  const subscribers=await db.prepare('SELECT COUNT(DISTINCT user_id) AS users,COUNT(*) AS devices FROM push_subscriptions').first();
  return json({messages:messages.results,publicKey:ready?env.VAPID_PUBLIC_KEY:null,history,subscribers});
 }
 if(request.method!=='POST')return json({error:'غير مسموح'},405);
 if(!sameOrigin(request))return json({error:'طلب غير مسموح'},403);
 try{
  const d=await body(request),now=Date.now();
  if(d.action==='inbox-shown'){
   if(!Array.isArray(d.ids)||d.ids.length>50||d.ids.some(id=>typeof id!=='string'||id.length>40))throw Error('طلب غير صحيح');
   await throttle(db,'notification-inbox:'+user.id,60);
   const ids=[...new Set(d.ids)];if(ids.length)await db.prepare(`UPDATE notification_recipients SET inbox_shown_at=COALESCE(inbox_shown_at,?) WHERE user_id=? AND notification_id IN (${ids.map(()=>'?').join(',')})`).bind(now,user.id,...ids).run();return json({ok:true});
  }
  if(d.action==='subscribe'){
   if(!env.VAPID_PRIVATE_KEY)return json({error:'إشعارات الجهاز غير مهيأة بعد'},503);
   await throttle(db,'push-subscribe:'+user.id,30);const s=subscriptionInput(d.subscription);
   await db.prepare('INSERT INTO push_subscriptions(endpoint,user_id,p256dh,auth,created_at) VALUES (?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,created_at=excluded.created_at').bind(s.endpoint,user.id,s.p256dh,s.auth,now).run();return json({ok:true});
  }
  if(d.action==='unsubscribe'){
   if(typeof d.endpoint!=='string')throw Error('اشتراك غير صحيح');
   await db.batch([db.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?').bind(d.endpoint,user.id),db.prepare("UPDATE push_deliveries SET status='failed',updated_at=? WHERE endpoint=? AND user_id=? AND status='pending'").bind(now,d.endpoint,user.id)]);return json({ok:true});
  }
  if(user.role!=='admin')return json({error:'صلاحية الإدارة مطلوبة'},403);
  if(d.action==='create'){
   const n=notificationInput(d);await throttle(db,'notification-create:'+user.id,20);
   const existing=await db.prepare('SELECT id FROM notifications WHERE id=?').bind(n.id).first();if(existing)return json({id:n.id});
   await db.batch([db.prepare('INSERT INTO notifications(id,title,body,link,target_user,created_at,created_by) VALUES (?,?,?,?,?,?,?)').bind(n.id,n.title,n.body,n.link,n.target==='self'?user.id:null,now,user.id),db.prepare('INSERT INTO push_deliveries(notification_id,endpoint,user_id,p256dh,auth,updated_at) SELECT ?,endpoint,user_id,p256dh,auth,? FROM push_subscriptions WHERE (? IS NULL OR user_id=?)').bind(n.id,now,n.target==='self'?user.id:null,user.id),db.prepare('INSERT INTO notification_recipients(notification_id,user_id,has_push) SELECT ?,u.id,EXISTS(SELECT 1 FROM push_deliveries d WHERE d.notification_id=? AND d.user_id=u.id) FROM app_users u WHERE (? IS NULL OR u.id=?)').bind(n.id,n.id,n.target==='self'?user.id:null,user.id)]);
   return json({id:n.id});
  }
  if(d.action==='process'){
   if(typeof d.id!=='string'||d.id.length>40)throw Error('طلب غير صحيح');
   await throttle(db,'notification-process:'+user.id,100);
   const n=await db.prepare('SELECT * FROM notifications WHERE id=?').bind(d.id).first();if(!n)return json({error:'الإشعار غير موجود'},404);
   const rows=await db.prepare("SELECT * FROM push_deliveries WHERE notification_id=? AND status='pending' LIMIT 8").bind(n.id).all();
   if(rows.results.length&&!env.VAPID_PRIVATE_KEY)return json({error:'إشعارات الجهاز غير مهيأة'},503);
   await Promise.all(rows.results.map(async row=>{
    row.receipt_token=deliveryReceiptToken(env.VAPID_PRIVATE_KEY,n.id,row.user_id,row.endpoint);
    const claim=await db.prepare("UPDATE push_deliveries SET status='sending',updated_at=?,receipt_hash=? WHERE notification_id=? AND endpoint=? AND status='pending' RETURNING endpoint").bind(now,digest(row.receipt_token),n.id,row.endpoint).first();if(!claim)return;
    let code=0;try{code=await deliver(env,row,n);}catch{}
    await db.prepare("UPDATE push_deliveries SET status=?,updated_at=?,p256dh='',auth='' WHERE notification_id=? AND endpoint=?").bind(code>=200&&code<300?'accepted':'failed',Date.now(),n.id,row.endpoint).run();
    if(code===404||code===410)await db.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND p256dh=?').bind(row.endpoint,row.p256dh).run();
   }));
   const remaining=await db.prepare("SELECT COUNT(*) AS total FROM push_deliveries WHERE notification_id=? AND status='pending'").bind(n.id).first();return json({remaining:remaining.total});
  }
  throw Error('طلب غير صحيح');
 }catch(error){return json({error:error.message||'تعذّر إكمال الطلب'},400);}
}
