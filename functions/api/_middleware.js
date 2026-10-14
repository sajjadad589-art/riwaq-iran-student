import {json,session} from '../../server/security.js';
export async function onRequest(context){
 const path=new URL(context.request.url).pathname;
 if(path.startsWith('/api/account/'))return context.next();
 if(!context.env.DB)return json({error:'خدمة الحسابات غير متاحة'},503);
 const user=await session(context.request,context.env.DB);
 if(!user)return json({error:'سجّل الدخول للوصول إلى التطبيق',code:'login_required'},401);
 context.data.user=user;
 return context.next();
}
