import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import {randomUUID,createECDH,randomBytes} from 'node:crypto';
const base=process.env.APP_URL||'http://127.0.0.1:8790';
if(!new URL(base).hostname.match(/^(127\.0\.0\.1|localhost)$/))throw Error('This broadcast test only runs locally');
const browser=await chromium.launch({channel:'msedge',headless:true}),admin=await browser.newContext({viewport:{width:390,height:844}}),user=await browser.newContext();const a=await admin.newPage(),p=await user.newPage(),errors=[];for(const page of [a,p])page.on('pageerror',e=>errors.push(e.message));
const post=(request,data,origin=base)=>request.post(base+'/api/notifications',{headers:{Origin:origin,'X-Wayak-Request':'1'},data});
try{
 await a.goto(base+'/#account');await a.locator('input[name=phone]').fill('+9647700008888');await a.locator('input[name=password]').fill('Local-admin-test-2026');await a.getByRole('button',{name:'دخول',exact:true}).click();await a.locator('#stat-registered').waitFor();
 assert.equal((await p.request.get(base+'/api/notifications')).status(),401);
 await p.goto(base+'/#account');await p.getByRole('button',{name:'حساب جديد',exact:true}).click();await p.locator('input[name=name]').fill('فحص إشعارات محلي');await p.locator('input[name=phone]').fill('+964779'+String(Date.now()).slice(-7));for(const name of ['password','confirmation'])await p.locator('input[name='+name+']').fill('123456');await p.getByRole('button',{name:'إنشاء حساب',exact:true}).click();await p.waitForURL('**/#home');
 const n={id:randomUUID(),title:'إشعار خاص للاختبار '+Date.now(),body:'نص تجربة الإدارة',link:'#students',target:'self',action:'create'};
 assert.equal((await post(p.request,n)).status(),403);assert.equal((await post(a.request,n,'https://evil.test')).status(),403);assert.equal((await post(a.request,{...n,link:'https://evil.test'})).status(),400);
 assert.equal((await post(a.request,n)).status(),200);assert.equal((await post(a.request,n)).status(),200);
 let inbox=await (await p.request.get(base+'/api/notifications')).json();assert.equal(inbox.messages.some(x=>x.id===n.id),false);
 await a.locator('[data-panel=notifications]').click();await a.locator('#notification-history').getByText(n.title,{exact:true}).waitFor();
 await a.locator('#admin-panel input[name=title]').fill('إشعار للجميع '+Date.now());await a.locator('#admin-panel textarea[name=body]').fill('<script>نص آمن للجميع</script>');await a.locator('#admin-panel select[name=target]').selectOption('all');a.once('dialog',d=>d.accept());await a.getByRole('button',{name:'إرسال الإشعار',exact:true}).click();await a.waitForFunction(()=>document.querySelector('#admin-panel [role=status]')?.textContent.includes('تم نشر الإشعار'));
 await p.goto(base+'/#account');await p.locator('#notification-inbox').getByText('<script>نص آمن للجميع</script>',{exact:true}).waitFor();assert.equal(await p.locator('#notification-inbox script').count(),0);assert.equal(await p.getByRole('button',{name:'تفعيل إشعارات الجهاز',exact:true}).isVisible(),true);
 const key=createECDH('prime256v1');key.generateKeys();const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/wayak-local-invalid-'+randomUUID(),keys:{p256dh:key.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
 assert.equal((await post(a.request,{action:'subscribe',subscription})).status(),200);
 const push={...n,id:randomUUID(),title:'اختبار تشفير وإرسال للجهاز'};assert.equal((await post(a.request,push)).status(),200);const process=await post(a.request,{action:'process',id:push.id});assert.equal(process.status(),200,await process.text());assert.equal((await process.json()).remaining,0);
 let history=(await(await a.request.get(base+'/api/notifications')).json()).history;const job=history.find(x=>x.id===push.id);assert.equal(job.total,1);assert.equal(job.failed,1,'nonexistent push endpoint is reported as failed, not falsely delivered');
 assert.equal((await post(a.request,{action:'process',id:push.id})).status(),200);history=(await(await a.request.get(base+'/api/notifications')).json()).history;assert.equal(history.find(x=>x.id===push.id).failed,1);
 assert.equal((await post(a.request,{action:'unsubscribe',endpoint:subscription.endpoint})).status(),200);
 await a.screenshot({path:'../outputs/wayak-notifications-admin.png',animations:'disabled'});assert.deepEqual(errors,[]);console.log('PASS real local D1: role and CSRF protection, idempotent send, private test inbox, broadcast UI/inbox, safe text, subscription keys, bounded push processing, failure reporting, no duplicate processing, unsubscribe.');
}finally{await browser.close();}
