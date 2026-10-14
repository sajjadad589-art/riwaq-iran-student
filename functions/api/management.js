import {json,session,sameOrigin,body} from '../../server/security.js';
export async function onRequest({request,env}){
 if(!env.DB)return json({error:'قاعدة البيانات غير متاحة'},503);
 const user=await session(request,env.DB);if(user?.role!=='admin')return json({error:'صلاحية الإدارة مطلوبة'},403);
 if(request.method==='GET'){
  const now=Date.now(),today=Math.floor((now+10800000)/86400000)*86400000-10800000;
  const users=await env.DB.prepare('SELECT id,phone,name,role,created_at,last_login_at,last_seen_at,EXISTS(SELECT 1 FROM app_presence p JOIN app_sessions s ON p.session_hash=s.token_hash WHERE s.user_id=u.id AND s.expires_at>? AND p.seen_at>?) AS online FROM app_users u ORDER BY created_at DESC LIMIT 200').bind(now,now-120000).all();
  const count=await env.DB.prepare('SELECT count(*) AS total,COUNT(last_login_at) AS signedIn,SUM(CASE WHEN last_login_at>=? THEN 1 ELSE 0 END) AS signedInToday FROM app_users').bind(today).first();
  const online=await env.DB.prepare('SELECT COUNT(DISTINCT s.user_id) AS total FROM app_presence p JOIN app_sessions s ON s.token_hash=p.session_hash WHERE p.seen_at>? AND s.expires_at>?').bind(now-120000,now).first();
  const history=await env.DB.prepare('SELECT revision,updated_at FROM cms_history ORDER BY revision DESC LIMIT 20').all();
  const stats={registered:count.total,signedIn:count.signedIn,signedInToday:count.signedInToday||0,online:online.total};
  return json({users:users.results,total:count.total,stats,onlineWindowSeconds:120,asOf:now,history:history.results});
 }
 if(request.method==='POST'&&sameOrigin(request)){
  try{const d=await body(request);if(d.action==='revoke'&&typeof d.userId==='string'){await env.DB.prepare('DELETE FROM app_sessions WHERE user_id=?').bind(d.userId).run();return json({ok:true});}
   if(d.action==='history'&&Number.isInteger(d.revision)){const row=await env.DB.prepare('SELECT document FROM cms_history WHERE revision=?').bind(d.revision).first();return row?json({document:JSON.parse(row.document)}):json({error:'النسخة غير موجودة'},404);}
  }catch{return json({error:'طلب غير صحيح'},400);}
 }
 return json({error:'غير مسموح'},405);
}
