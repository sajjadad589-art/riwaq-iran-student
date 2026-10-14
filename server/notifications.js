import webpush from 'web-push';
import {createHmac,createHash} from 'node:crypto';
export const deliveryReceiptToken=(secret,id,userId,endpoint)=>createHmac('sha256',secret).update(JSON.stringify([id,userId,createHash('sha256').update(endpoint).digest('hex')])).digest('hex');
export function notificationInput(d){
 const title=typeof d.title==='string'?d.title.trim():'';
 const body=typeof d.body==='string'?d.body.trim():'';
 const link=d.link||'#home';
 if(!title||title.length>100||!body||body.length>500)throw Error('اكتب عنواناً حتى 100 حرف ونصاً حتى 500 حرف');
 if(typeof link!=='string'||!/^#(?:home|exchange|explore|phrases|students|transfer|daily|expenses|services|account)$/.test(link)||link.length>200)throw Error('اختر رابط قسم داخل التطبيق');
 if(!['all','self'].includes(d.target))throw Error('اختر المستلمين');
 if(typeof d.id!=='string'||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(d.id))throw Error('معرّف إرسال غير صحيح');
 return {id:d.id,title,body,link,target:d.target};
}
export function subscriptionInput(d){
 const endpoint=d?.endpoint;let u;try{u=new URL(endpoint);}catch{throw Error('اشتراك غير صحيح');}
 // Only established browser push providers; no arbitrary outbound URLs or redirects.
 if(u.protocol!=='https:'||u.port||u.username||u.password||endpoint.length>2048||!(['fcm.googleapis.com','updates.push.services.mozilla.com','push.services.mozilla.com','web.push.apple.com'].includes(u.hostname)||u.hostname.endsWith('.notify.windows.com')))throw Error('مزود إشعارات غير مدعوم');
 const {p256dh,auth}=d.keys||{};
 if(typeof p256dh!=='string'||! /^[\w-]{87}$/.test(p256dh)||Buffer.from(p256dh,'base64url').length!==65||Buffer.from(p256dh,'base64url')[0]!==4||typeof auth!=='string'||! /^[\w-]{22}$/.test(auth))throw Error('مفاتيح اشتراك غير صحيحة');
 return {endpoint,p256dh,auth};
}
export async function deliver(env,row,n,send=fetch){
 const details=webpush.generateRequestDetails({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify({id:n.id,title:n.title,body:n.body,url:n.link,...(row.receipt_token?{receipt:row.receipt_token}:{})}),{TTL:86400,vapidDetails:{subject:'https://way4.pages.dev',publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY}});
 const response=await send(details.endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'error',signal:AbortSignal.timeout(10000)});
 return response.status;
}
