import {json,session,sameOrigin,body} from '../../server/security.js';
export async function onRequest({request,env}){
 if(!env.DB)return json({error:'قاعدة البيانات غير متاحة'},503);
 const user=await session(request,env.DB);if(user?.role!=='admin')return json({error:'صلاحية الإدارة مطلوبة'},403);
 if(request.method==='GET'){
  const users=await env.DB.prepare('SELECT id,phone,name,role,created_at FROM app_users ORDER BY created_at DESC LIMIT 200').all();
  const count=await env.DB.prepare('SELECT count(*) AS total FROM app_users').first();
  const history=await env.DB.prepare('SELECT revision,updated_at FROM cms_history ORDER BY revision DESC LIMIT 20').all();
  return json({users:users.results,total:count.total,history:history.results});
 }
 if(request.method==='POST'&&sameOrigin(request)){
  try{const d=await body(request);if(d.action==='revoke'&&typeof d.userId==='string'){await env.DB.prepare('DELETE FROM app_sessions WHERE user_id=?').bind(d.userId).run();return json({ok:true});}
   if(d.action==='history'&&Number.isInteger(d.revision)){const row=await env.DB.prepare('SELECT document FROM cms_history WHERE revision=?').bind(d.revision).first();return row?json({document:JSON.parse(row.document)}):json({error:'النسخة غير موجودة'},404);}
  }catch{return json({error:'طلب غير صحيح'},400);}
 }
 return json({error:'غير مسموح'},405);
}
