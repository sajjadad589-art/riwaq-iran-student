import {json,body,digest} from '../../server/security.js';
export async function onRequest({request,env}){
 if(request.method!=='POST')return json({error:'غير مسموح'},405);
 if(!env.DB)return json({error:'غير متاح'},503);
 try{const d=await body(request,1024);if(typeof d.id!=='string'||! /^[\w-]{36}$/.test(d.id)||typeof d.token!=='string'||! /^[a-f0-9]{64}$/.test(d.token))return json({error:'طلب غير صحيح'},400);
  // A per-delivery secret in the encrypted push payload authorizes this receipt,
  // even when the session cookie has expired in the background.
  await env.DB.prepare("UPDATE push_deliveries SET received_at=COALESCE(received_at,?) WHERE notification_id=? AND receipt_hash=? AND status IN ('sending','accepted','failed')").bind(Date.now(),d.id,digest(d.token)).run();return json({ok:true});
 }catch{return json({error:'طلب غير صحيح'},400);}
}
