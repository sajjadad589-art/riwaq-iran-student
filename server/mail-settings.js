import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
const key=secret=>createHash('sha256').update(secret).digest();
export function sealMailKey(value,secret){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),iv);return [iv,Buffer.concat([cipher.update(value,'utf8'),cipher.final()]),cipher.getAuthTag()].map(b=>b.toString('base64url')).join('.');}
export function openMailKey(value,secret){const [iv,data,tag]=value.split('.').map(s=>Buffer.from(s,'base64url')),cipher=createDecipheriv('aes-256-gcm',key(secret),iv);cipher.setAuthTag(tag);return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8');}
export async function mailSettings(env){
 if(!env.RESET_SECRET)return null;
 if(env.BREVO_API_KEY&&env.BREVO_SENDER_EMAIL)return env;
 const row=await env.DB.prepare('SELECT sender,key_cipher FROM recovery_email_settings WHERE id=1').first();if(!row)return null;
 try{return {...env,BREVO_SENDER_EMAIL:row.sender,BREVO_API_KEY:openMailKey(row.key_cipher,env.RESET_SECRET)};}catch{return null;}
}
