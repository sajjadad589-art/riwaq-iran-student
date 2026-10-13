import {normalizePhone,hashPassword,verifyPassword,token,digest,json,body,sameOrigin,session,newSession,cookie,throttle,checkPassword} from '../../../server/security.js';
export async function onRequest({request,env,params}){
 if(!env.DB)return json({error:'خدمة الحسابات لم تُفعّل بعد'},503);
 const action=Array.isArray(params.action)?params.action.join('/'):params.action||'';
 try{
  if(request.method==='GET'&&action==='session')return json({user:await session(request,env.DB)});
  if(request.method!=='POST'||!sameOrigin(request))return json({error:'طلب غير مسموح'},403);
  const d=await body(request),db=env.DB,ip=request.headers.get('CF-Connecting-IP')||'local';
  await throttle(db,'ip:'+ip,30);
  if(action==='logout'){const raw=request.headers.get('Cookie')?.match(/wayak_session=([a-f0-9]{64})/)?.[1];if(raw)await db.prepare('DELETE FROM app_sessions WHERE token_hash=?').bind(digest(raw)).run();return json({ok:true},200,{'Set-Cookie':cookie(request,'',0)});}
  if(action==='password'){
   const user=await session(request,db);if(!user)return json({error:'سجّل الدخول أولاً'},401);
   await throttle(db,'password:'+user.id,6);const stored=await db.prepare('SELECT password_hash FROM app_users WHERE id=?').bind(user.id).first();
   if(!await verifyPassword(d.currentPassword,stored.password_hash))return json({error:'كلمة المرور الحالية غير صحيحة'},400);
   const hash=await hashPassword(d.password);await db.batch([db.prepare('UPDATE app_users SET password_hash=? WHERE id=?').bind(hash,user.id),db.prepare('DELETE FROM app_sessions WHERE user_id=?').bind(user.id)]);return newSession(db,user,request);
  }
  const phone=normalizePhone(d.phone);await throttle(db,'phone:'+phone,8);
  if(action==='register'||action==='setup'){
   checkPassword(d.password);const name=typeof d.name==='string'?d.name.trim().slice(0,80):'';if(!name)return json({error:'اكتب اسمك'},400);
   if(action==='register'&&await db.prepare('SELECT 1 FROM admin_invites WHERE phone=? LIMIT 1').bind(phone).first())return json({error:'هذا الرقم محجوز لحساب الإدارة'},403);
   const hash=await hashPassword(d.password),id=crypto.randomUUID(),created=Date.now();
   if(action==='setup'){
    if(typeof d.invite!=='string'||!/^[a-f0-9]{64}$/.test(d.invite))return json({error:'رابط تفعيل الإدارة غير صالح'},403);
    const results=await db.batch([db.prepare("INSERT INTO app_users(id,phone,name,password_hash,role,created_at) SELECT ?,?,?,?,'admin',? FROM admin_invites WHERE token_hash=? AND phone=? AND used=0 AND expires_at>?").bind(id,phone,name,hash,created,digest(d.invite),phone,created),db.prepare('UPDATE admin_invites SET used=1 WHERE token_hash=? AND EXISTS(SELECT 1 FROM app_users WHERE id=?)').bind(digest(d.invite),id)]);
    if(results[0].meta.changes!==1)return json({error:'الرابط منتهي أو استُخدم سابقاً'},403);
   }else{try{await db.prepare("INSERT INTO app_users(id,phone,name,password_hash,role,created_at) VALUES (?,?,?,?,'user',?)").bind(id,phone,name,hash,created).run();}catch(e){if(String(e).includes('UNIQUE'))return json({error:'الرقم مسجّل مسبقاً. استخدم تسجيل الدخول.'},409);throw e;}}
   return newSession(db,{id,phone,name,role:action==='setup'?'admin':'user',phone_verified:0},request);
  }
  if(action==='login'){
   const user=await db.prepare('SELECT * FROM app_users WHERE phone=?').bind(phone).first();
   const dummy='scrypt1:00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000';
   const valid=await verifyPassword(d.password,user?.password_hash||dummy);if(!user||!valid)return json({error:'رقم الهاتف أو كلمة المرور غير صحيحة'},401);
   return newSession(db,{id:user.id,phone:user.phone,name:user.name,role:user.role,phone_verified:0},request);
  }
  return json({error:'غير موجود'},404);
 }catch(error){const message=String(error.message);if(message.includes('محاولات كثيرة'))return json({error:message},429);if(/رقم|كلمة المرور|الطلب|JSON|نوع الطلب/.test(message))return json({error:message},400);return json({error:'تعذّر إكمال الطلب. حاول لاحقاً.'},500);}
}
