import {json,sameOrigin,session,readBytes} from '../../../server/security.js';
export async function onRequest({request,env,params}){
 if(!env.DB)return json({error:'الخدمة غير مفعلة'},503);
 const id=Array.isArray(params.id)?params.id[0]:params.id;
 if(request.method==='GET'&&/^[a-f0-9-]{36}$/.test(id||'')){
  const row=await env.DB.prepare('SELECT mime,data FROM app_assets WHERE id=?').bind(id).first();
  return row?new Response(new Uint8Array(row.data),{headers:{'Content-Type':row.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=86400'}}):new Response('Not found',{status:404});
 }
 if(request.method==='POST'&&sameOrigin(request)){
  const user=await session(request,env.DB);if(user?.role!=='admin')return json({error:'صلاحية الإدارة مطلوبة'},403);
  const mime=request.headers.get('Content-Type');if(!['image/png','image/jpeg','image/webp'].includes(mime)||Number(request.headers.get('Content-Length')||0)>500000)return json({error:'صورة PNG أو JPEG أو WebP بحد أقصى 500 كيلوبايت'},400);
  let bytes;try{bytes=await readBytes(request,500000);}catch{return json({error:'حجم الصورة غير مناسب'},400);}if(bytes.length<12)return json({error:'حجم الصورة غير مناسب'},400);
  const valid=mime==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!valid)return json({error:'ملف الصورة غير صحيح'},400);
  const asset=crypto.randomUUID();await env.DB.prepare('INSERT INTO app_assets(id,mime,data,created_at) VALUES (?,?,?,?)').bind(asset,mime,bytes.buffer,Date.now()).run();return json({url:'/api/media/'+asset});
 }
 return json({error:'غير مسموح'},405);
}
