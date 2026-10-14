import {json,body,sameOrigin,verifyPassword,throttle} from '../../server/security.js';
import {normalizeEmail} from '../../server/email-recovery.js';import {sealMailKey,mailSettings} from '../../server/mail-settings.js';
export async function onRequest({request,env,data}){
 const user=data.user;if(user?.role!=='admin')return json({error:'صلاحية الإدارة مطلوبة'},403);
 if(request.method==='GET'){const settings=await mailSettings(env);return json({ready:!!settings,canConfigure:!!env.RESET_SECRET,sender:settings?.BREVO_SENDER_EMAIL||'',dailyLimit:250});}
 if(request.method!=='POST'||!sameOrigin(request))return json({error:'طلب غير مسموح'},403);
 try{
  if(!env.RESET_SECRET)return json({error:'مفتاح حماية الخدمة غير مهيأ'},503);
  const d=await body(request);await throttle(env.DB,'mail-settings:'+user.id,5);
  const row=await env.DB.prepare('SELECT password_hash FROM app_users WHERE id=?').bind(user.id).first();if(!await verifyPassword(d.currentPassword,row.password_hash))return json({error:'كلمة المرور الحالية غير صحيحة'},400);
  const sender=normalizeEmail(d.sender),previous=await mailSettings(env),apiKey=d.apiKey||previous?.BREVO_API_KEY;
  if(typeof apiKey!=='string'||apiKey.length<20||apiKey.length>500||/[\r\n]/.test(apiKey))return json({error:'أدخل مفتاح API صالح من Brevo'},400);
  await env.DB.prepare('INSERT INTO recovery_email_settings(id,sender,key_cipher,updated_at) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET sender=excluded.sender,key_cipher=excluded.key_cipher,updated_at=excluded.updated_at').bind(sender,sealMailKey(apiKey,env.RESET_SECRET),Date.now()).run();return json({ok:true});
 }catch{return json({error:'تعذّر حفظ إعدادات البريد'},400);}
}
