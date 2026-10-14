import {createHmac,randomInt,timingSafeEqual} from 'node:crypto';
import {json,normalizePhone,hashPassword,verifyPassword,checkPassword,throttle,digest,cookie,session} from './security.js';
import {mailSettings} from './mail-settings.js';
export function normalizeEmail(value){
 if(typeof value!=='string'||value.length>254)throw Error('اكتب إيميل صحيح');
 const email=value.trim().toLowerCase();
 if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)||email.split('@')[0].length>64||email.split('@')[0].startsWith('.')||email.includes('..')||email.split('@')[0].endsWith('.'))throw Error('اكتب إيميل صحيح');
 return email;
}
export const codeHash=(secret,id,code)=>createHmac('sha256',secret).update(id+':'+code).digest('hex');
export function equalCode(secret,id,code,expected){if(!/^\d{6}$/.test(code)||!/^[a-f0-9]{64}$/.test(expected))return false;return timingSafeEqual(Buffer.from(codeHash(secret,id,code),'hex'),Buffer.from(expected,'hex'));}
export async function sendResetMail(env,email,code,send=fetch){
 const response=await send('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':env.BREVO_API_KEY,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({sender:{name:'وياك',email:normalizeEmail(env.BREVO_SENDER_EMAIL)},to:[{email}],subject:'وياك — رمز استرجاع كلمة المرور',textContent:`رمز استرجاع كلمة المرور في وياك: ${code}\n\nالرمز صالح لمدة 10 دقائق ويُستخدم مرة واحدة. لا تشاركه مع أحد.\nإذا لم تطلب الاسترجاع، تجاهل هذه الرسالة. لن تتغير كلمة المرور بدون إدخال الرمز.`}),redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('mail_failed');
}
const generic=id=>json({id,message:'إذا طابقت المعلومات حساباً مسجّلاً، راح يوصلك كود على الإيميل. افحص البريد والرسائل غير المرغوب بها.'});
export async function emailRecovery(action,{request,env},d){
 const db=env.DB,now=Date.now(),ip=request.headers.get('CF-Connecting-IP')||'local';
 if(action==='email'){
  const user=await session(request,db);if(!user)return json({error:'سجّل الدخول أولاً'},401);
  await throttle(db,'email-change:'+user.id,5);const email=normalizeEmail(d.email),row=await db.prepare('SELECT password_hash FROM app_users WHERE id=?').bind(user.id).first();
  if(!await verifyPassword(d.currentPassword,row.password_hash))return json({error:'كلمة المرور الحالية غير صحيحة'},400);
  await db.batch([db.prepare('UPDATE app_users SET email=? WHERE id=? AND password_hash=?').bind(email,user.id,row.password_hash),db.prepare('DELETE FROM password_resets WHERE user_id=?').bind(user.id)]);return json({ok:true,email});
 }
 const settings=action==='forgot'?await mailSettings(env):null;
 if(!env.RESET_SECRET||action==='forgot'&&!settings)return json({error:'خدمة استرجاع كلمة المرور غير مفعّلة بعد. حاول لاحقاً.'},503);
 if(action==='forgot'){
  const phone=normalizePhone(d.phone),email=normalizeEmail(d.email),id=crypto.randomUUID();
  await throttle(db,'reset-ip:'+ip,6);await throttle(db,'reset-phone:'+phone,3);await throttle(db,'reset-mail:'+email,3);
  const cooldown=await db.prepare('INSERT INTO reset_cooldowns(key,requested_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET requested_at=excluded.requested_at WHERE requested_at<=? RETURNING key').bind(digest(phone),now,now-60000).first();
  if(!cooldown)return json({error:'انتظر دقيقة قبل طلب كود جديد'},429);
  const user=await db.prepare('SELECT id,email,password_hash FROM app_users WHERE phone=? AND email=?').bind(phone,email).first();
  if(!user)return generic(id);
  const day=new Date(now).toISOString().slice(0,10),budget=await db.prepare('INSERT INTO email_send_budget(day,sent) VALUES (?,1) ON CONFLICT(day) DO UPDATE SET sent=sent+1 WHERE sent<250 RETURNING sent').bind(day).first();
  if(!budget)return generic(id);
  const code=String(randomInt(0,1000000)).padStart(6,'0');
  await db.batch([db.prepare('DELETE FROM password_resets WHERE user_id=? OR expires_at<?').bind(user.id,now),db.prepare('INSERT INTO password_resets(id,user_id,email,password_hash,code_hash,created_at,expires_at) VALUES (?,?,?,?,?,?,?)').bind(id,user.id,email,user.password_hash,codeHash(env.RESET_SECRET,id,code),now,now+600000)]);
  try{await sendResetMail(settings,email,code);await db.prepare('UPDATE password_resets SET ready=1 WHERE id=?').bind(id).run();}catch{await db.prepare('DELETE FROM password_resets WHERE id=?').bind(id).run();}
  return generic(id);
 }
 if(action==='reset'){
  await throttle(db,'reset-verify-ip:'+ip,20);
  if(typeof d.id!=='string'||!/^[a-f0-9-]{36}$/.test(d.id))return json({error:'الكود غير صحيح أو منتهي الصلاحية'},400);
  checkPassword(d.password);const code=typeof d.code==='string'?d.code.replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)>=0x6f0?c.charCodeAt(0)-0x6f0:c.charCodeAt(0)-0x660)).trim():'';
  const row=await db.prepare('UPDATE password_resets SET attempts=attempts+1 WHERE id=? AND consumed=0 AND ready=1 AND expires_at>? AND attempts<5 RETURNING *').bind(d.id,now).first();
  if(!row||!equalCode(env.RESET_SECRET,d.id,code,row.code_hash))return json({error:'الكود غير صحيح أو منتهي الصلاحية'},400);
  const hash=await hashPassword(d.password),finished=Date.now();
  const results=await db.batch([db.prepare('UPDATE app_users SET password_hash=? WHERE id=? AND email=? AND password_hash=? AND EXISTS(SELECT 1 FROM password_resets WHERE id=? AND consumed=0 AND ready=1 AND expires_at>? AND attempts<=5) RETURNING id').bind(hash,row.user_id,row.email,row.password_hash,row.id,finished),db.prepare('UPDATE password_resets SET consumed=1 WHERE user_id=? AND EXISTS(SELECT 1 FROM app_users WHERE id=? AND password_hash=?)').bind(row.user_id,row.user_id,hash),db.prepare('DELETE FROM app_sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM app_users WHERE id=? AND password_hash=?)').bind(row.user_id,row.user_id,hash)]);
  if(!results[0].results.length)return json({error:'الكود غير صحيح أو منتهي الصلاحية'},400);
  return json({ok:true,message:'تم تغيير كلمة المرور. سجّل الدخول برقمك وكلمة المرور الجديدة.'},200,{'Set-Cookie':cookie(request,'',0)});
 }
 return json({error:'غير موجود'},404);
}
