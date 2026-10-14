import {scrypt, randomBytes, timingSafeEqual, createHash} from 'node:crypto';
export function normalizePhone(value){
 if(typeof value!=='string'||value.length>40)throw Error('رقم الهاتف غير صحيح');
 let phone=value.replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)>=0x6f0?c.charCodeAt(0)-0x6f0:c.charCodeAt(0)-0x660)).replace(/[\s().-]/g,'');
 if(phone.startsWith('00'))phone='+'+phone.slice(2);
 if(/^07\d{9}$/.test(phone))phone='+964'+phone.slice(1);
 if(/^9647\d{9}$/.test(phone))phone='+'+phone;
 if(!/^\+[1-9]\d{7,14}$/.test(phone)||phone.startsWith('+964')&&!/^\+9647\d{9}$/.test(phone))throw Error('اكتب رقم موبايل صحيحاً مع رمز الدولة');
 return phone;
}
export function checkPassword(password){if(typeof password!=='string'||password.length<6||password.length>128)throw Error('كلمة المرور يجب أن تكون من 6 إلى 128 حرفاً');}
const derive=(password,salt)=>new Promise((resolve,reject)=>scrypt(password.normalize('NFKC'),salt,32,{N:32768,r:8,p:3,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
export async function hashPassword(password){checkPassword(password);const salt=randomBytes(16).toString('hex');return `scrypt1:${salt}:${(await derive(password,salt)).toString('hex')}`;}
export async function verifyPassword(password,hash){
 if(typeof password!=='string'||password.length>128)return false;
 const [version,salt,digest]=hash.split(':');if(version!=='scrypt1'||!/^\w{32}$/.test(salt)||!/^\w{64}$/.test(digest))return false;
 const actual=await derive(password,salt),expected=Buffer.from(digest,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export const token=()=>randomBytes(32).toString('hex');
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export function cookie(request,value,maxAge){return `wayak_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
export function sameOrigin(request){return request.headers.get('Origin')===new URL(request.url).origin&&request.headers.get('X-Wayak-Request')==='1';}
export async function readBytes(request,max){if(Number(request.headers.get('Content-Length')||0)>max)throw Error('الطلب كبير جداً');if(!request.body)throw Error('الطلب فارغ');const reader=request.body.getReader(),chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('الطلب كبير جداً');}chunks.push(value);}}finally{reader.releaseLock();}const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;}
export async function body(request,max=8192){if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('نوع الطلب غير صحيح');return JSON.parse(new TextDecoder().decode(await readBytes(request,max)));}
export async function session(request,db){const raw=request.headers.get('Cookie')?.match(/(?:^|;\s*)wayak_session=([a-f0-9]{64})(?:;|$)/)?.[1];if(!raw)return null;return db.prepare('SELECT u.id,u.phone,u.name,u.role,u.phone_verified,u.created_at,u.email FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(digest(raw),Date.now()).first();}
export async function newSession(db,user,request){const raw=token(),now=Date.now();await db.batch([db.prepare('DELETE FROM app_sessions WHERE expires_at<?').bind(now),db.prepare('INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(digest(raw),user.id,now+3*86400000),db.prepare('UPDATE app_users SET last_login_at=? WHERE id=?').bind(now,user.id)]);return json({user},200,{'Set-Cookie':cookie(request,raw,3*86400)});}
export async function throttle(db,key,limit){const now=Date.now();const result=await db.prepare('INSERT INTO auth_attempts(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<? THEN 1 ELSE count+1 END,expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END RETURNING count').bind(digest(key),now+600000,now,now).first();if(result.count>limit)throw Error('محاولات كثيرة. انتظر 10 دقائق وحاول مجدداً.');}
