import {json,session,sameOrigin,body} from '../../server/security.js';
import {validateDocument} from '../../cms-contract.js';
export async function onRequest({request,env}){
 if(!env.DB)return json({document:null,revision:0},request.method==='GET'?200:503);
 if(request.method==='GET'){const row=await env.DB.prepare('SELECT * FROM cms_state WHERE id=1').first();return json({document:row?JSON.parse(row.document):null,revision:row?.revision||0,updatedAt:row?.updated_at||null});}
 if(request.method!=='PUT'||!sameOrigin(request))return json({error:'طلب غير مسموح'},403);
 const user=await session(request,env.DB);if(user?.role!=='admin')return json({error:'صلاحية الإدارة مطلوبة'},403);
 try{
  const d=await body(request,700000),document=validateDocument(d.document);if(!Number.isInteger(d.revision)||d.revision<0)throw Error('نسخة غير صحيحة');
  const serialized=JSON.stringify(document),now=Date.now(),revision=d.revision+1;
  const results=await env.DB.batch([
   env.DB.prepare('INSERT INTO cms_state(id,revision,document,updated_at,updated_by) VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,document=excluded.document,updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE cms_state.revision=?').bind(revision,serialized,now,user.id,d.revision),
   env.DB.prepare('INSERT OR IGNORE INTO cms_history(revision,document,updated_at,updated_by) SELECT revision,document,updated_at,updated_by FROM cms_state WHERE revision=? AND updated_at=? AND updated_by=?').bind(revision,now,user.id)
  ]);
  if(results[0].meta.changes!==1)return json({error:'المحتوى تغيّر من جلسة أخرى. أعد تحميل النسخة قبل الحفظ.'},409);
  return json({ok:true,document,revision,updatedAt:now});
 }catch(error){return json({error:error.message?.includes('D1')?'تعذّر حفظ المحتوى':error.message||'محتوى غير صحيح'},400);}
}
