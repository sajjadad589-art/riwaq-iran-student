import {test} from 'node:test';import assert from 'node:assert/strict';import {createECDH,randomBytes,randomUUID} from 'node:crypto';import webpush from 'web-push';import ece from 'http_ece';
import {notificationInput,subscriptionInput,deliver} from '../server/notifications.js';
import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';
const valid={id:randomUUID(),title:'تنبيه',body:'أخبار وياك',link:'#students',target:'self'};
test('notifications reject empty or excessive text, external links and invalid targets',()=>{
 assert.equal(notificationInput(valid).link,'#students');for(const patch of [{title:''},{body:'a'.repeat(501)},{link:'https://evil.test'},{link:'javascript:alert(1)'},{target:'someone'},{id:'invalid'}])assert.throws(()=>notificationInput({...valid,...patch}));
});
function subscription(){const key=createECDH('prime256v1');key.generateKeys();const auth=randomBytes(16);return {key,auth,subscription:{endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:key.getPublicKey().toString('base64url'),auth:auth.toString('base64url')}}};}
test('subscriptions restrict outbound requests to HTTPS browser push providers and valid keys',()=>{
 const {subscription:s}=subscription();assert.equal(subscriptionInput(s).endpoint,s.endpoint);
 for(const endpoint of ['http://fcm.googleapis.com/x','https://localhost/x','https://fcm.googleapis.com.evil.test/x','https://fcm.googleapis.com:123/x','https://user@fcm.googleapis.com/x'])assert.throws(()=>subscriptionInput({...s,endpoint}));assert.throws(()=>subscriptionInput({...s,keys:{auth:'bad',p256dh:'bad'}}));
});
test('push encrypts payload for recipient and authenticates with VAPID, uses bounded fetch without redirects',async()=>{
 const {key,auth,subscription:s}=subscription(),keys=webpush.generateVAPIDKeys();
 const code=await deliver({VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey},{...subscriptionInput(s),receipt_token:"a".repeat(64)},valid,async(url,options)=>{
  assert.equal(url,s.endpoint);assert.equal(options.redirect,'error');assert.equal(options.headers['Content-Encoding'],'aes128gcm');assert.match(options.headers.Authorization,/^vapid /);
  const plaintext=ece.decrypt(options.body,{version:'aes128gcm',privateKey:key,authSecret:auth});const payload=JSON.parse(plaintext);assert.equal(payload.title,valid.title);assert.equal(payload.url,'#students');assert.equal(payload.receipt,'a'.repeat(64));return {status:201};
 });assert.equal(code,201);
});
test('service worker displays push and confines notification clicks to the app',async()=>{
 const handlers={};let shown,opened,closed=false;
 const self={location:{origin:'https://way4.pages.dev'},addEventListener:(name,fn)=>handlers[name]=fn,registration:{showNotification:async(title,options)=>{shown={title,...options};}},clients:{matchAll:async()=>[],openWindow:async url=>{opened=url;}}};
 runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL});
 let work;handlers.push({data:{json:()=>({id:'test',title:'وياك',body:'خبر جديد',url:'#students'})},waitUntil:p=>work=p});await work;assert.equal(shown.body,'خبر جديد');assert.equal(shown.tag,'test');
 handlers.notificationclick({notification:{data:shown.data,close:()=>closed=true},waitUntil:p=>work=p});await work;assert.equal(opened,'https://way4.pages.dev/#students');assert.equal(closed,true);
 handlers.notificationclick({notification:{data:{url:'https://evil.test'},close:()=>{}},waitUntil:p=>work=p});await work;assert.equal(opened,'https://way4.pages.dev/#account');
});

test('worker acknowledges only after display, retries outstanding receipts and does not acknowledge failed display',async()=>{
 const handlers={},calls=[],receipt={id:'test',token:'a'.repeat(64)};let fail=false;
 const self={location:{origin:'https://way4.pages.dev'},addEventListener:(name,fn)=>handlers[name]=fn,registration:{showNotification:async()=>{calls.push('display');if(fail)throw Error('display denied');},getNotifications:async()=>[{data:{receipt}}]}};
 runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL,fetch:async(url,options)=>{calls.push('ack');assert.equal(url,'/api/push-receipt');assert.equal(options.credentials,'omit');assert.deepEqual(JSON.parse(options.body),receipt);}});
 let work;handlers.push({data:{json:()=>({id:receipt.id,receipt:receipt.token})},waitUntil:p=>work=p});await work;assert.deepEqual(calls,['display','ack']);calls.length=0;
 handlers.message({data:{type:'wayak:flush-receipts'},waitUntil:p=>work=p});await work;assert.deepEqual(calls,['ack']);calls.length=0;fail=true;
 handlers.push({data:{json:()=>({id:receipt.id,receipt:receipt.token})},waitUntil:p=>work=p});await assert.rejects(work);assert.deepEqual(calls,['display']);
});
