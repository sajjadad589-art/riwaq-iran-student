import {json,session,sameOrigin,body,digest,throttle} from '../../server/security.js';
export async function onRequest({request,env,data}){
 if(request.method!=='POST'||!sameOrigin(request))return json({error:'طلب غير مسموح'},403);
 const user=data?.user||await session(request,env.DB);if(!user)return json({error:'سجّل الدخول'},401);
 try{
  const d=await body(request);if(!/^[a-f0-9-]{36}$/.test(d.tabId||'')||typeof d.visible!=='boolean')return json({error:'طلب غير صحيح'},400);
  const raw=request.headers.get('Cookie')?.match(/(?:^|;\s*)wayak_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!raw)return json({error:'سجّل الدخول'},401);
  const hash=digest(raw),now=Date.now();
  if(!d.visible){await env.DB.prepare('DELETE FROM app_presence WHERE session_hash=? AND tab_id=?').bind(hash,d.tabId).run();return json({ok:true});}
  await throttle(env.DB,'presence:'+user.id,120);
  const count=await env.DB.prepare('SELECT COUNT(*) AS count FROM app_presence WHERE session_hash=? AND seen_at>?').bind(hash,now-120000).first();if(count.count>=20&&!await env.DB.prepare('SELECT 1 FROM app_presence WHERE session_hash=? AND tab_id=?').bind(hash,d.tabId).first())return json({error:'عدد الجلسات المفتوحة كبير'},429);
  await env.DB.batch([
   env.DB.prepare('DELETE FROM app_presence WHERE seen_at<?').bind(now-120000),
   env.DB.prepare('INSERT INTO app_presence(session_hash,tab_id,seen_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM app_sessions WHERE token_hash=? AND expires_at>?) ON CONFLICT(session_hash,tab_id) DO UPDATE SET seen_at=excluded.seen_at WHERE app_presence.seen_at<?').bind(hash,d.tabId,now,hash,now,now-15000),
   env.DB.prepare('UPDATE app_users SET last_seen_at=? WHERE id=? AND (last_seen_at IS NULL OR last_seen_at<?)').bind(now,user.id,now-15000)
  ]);return json({ok:true,serverTime:now});
 }catch(error){return json({error:error.message?.includes('محاولات')?error.message:'تعذّر تحديث حالة الاتصال'},error.message?.includes('محاولات')?429:400);}
}
