import {json,sameOrigin,body,throttle} from '../../server/security.js';import {emptyData,changeData} from '../../server/user-data.js';
export async function onRequest({request,env,data}){const uid=data.user.id,db=env.DB;
 const read=async()=>await db.prepare('SELECT revision,document FROM user_data WHERE user_id=?').bind(uid).first();
 if(request.method==='GET'){const row=await read();return json({revision:row?.revision||0,document:row?JSON.parse(row.document):emptyData()});}
 if(request.method!=='POST'||!sameOrigin(request))return json({error:'طلب غير مسموح'},403);
 try{const d=await body(request,800000);await throttle(db,'account-data:'+uid,240);await db.prepare('INSERT OR IGNORE INTO user_data VALUES (?,0,?,?)').bind(uid,JSON.stringify(emptyData()),Date.now()).run();
 for(let i=0;i<5;i++){const row=await read(),next=changeData(JSON.parse(row.document),d);const result=await db.prepare('UPDATE user_data SET document=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=? RETURNING revision').bind(JSON.stringify(next),Date.now(),uid,row.revision).first();if(result)return json({revision:result.revision,document:next});}return json({error:'صار تعديل من جهاز ثاني. حدّث القائمة وحاول مجدداً.'},409);
 }catch(e){return json({error:e.message||'تعذّر حفظ البيانات'},400);}}
