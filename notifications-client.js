const button=(text,handler)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=handler;return b;};
export function createNotifications(api,getUser){
 let cached=null,sending=false;
 const supported=()=> 'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
 const registration=()=>navigator.serviceWorker.ready;
 async function disable(){
  cached=null;
  if(!supported())return;
  const r=await navigator.serviceWorker.getRegistration();if(!r)return;const s=await r.pushManager.getSubscription();
  if(s){try{await api('/api/notifications','POST',{action:'unsubscribe',endpoint:s.endpoint});}finally{await s.unsubscribe();}}
 }
 async function load(){if(!getUser()||document.hidden)return;const id=getUser().id,d=await api('/api/notifications');if(getUser()?.id!==id)return;cached=d;const inbox=document.getElementById('notification-inbox');if(inbox)renderInbox(inbox);const shortcut=document.querySelector('.account-shortcut');if(shortcut)shortcut.textContent=d.messages.length?'حسابي 🔔 '+d.messages.length:'حسابي';}
 function renderInbox(inbox){
  inbox.replaceChildren();const heading=document.createElement('h3');heading.textContent='إشعارات وياك';inbox.append(heading);
  if(!cached?.messages.length){const p=document.createElement('p');p.className='muted';p.textContent=cached?'ما عندك إشعارات حالياً.':'جارٍ تحميل الإشعارات…';inbox.append(p);return;}
  for(const n of cached.messages){const card=document.createElement('article');card.className='notification-item';const title=document.createElement('strong'),body=document.createElement('p'),time=document.createElement('small'),link=document.createElement('a');title.textContent=n.title;body.textContent=n.body;time.textContent=new Date(n.created_at).toLocaleString('ar-IQ');link.textContent='فتح التفاصيل';link.href=/^#[a-z]+(?:$|\?)/.test(n.link)?n.link:'#home';card.append(title,body,time,link);inbox.append(card);}
 }
 function accountControls(card){
  const box=document.createElement('div');box.className='notification-settings';const h=document.createElement('h3');h.textContent='الإشعارات';const note=document.createElement('p');note.className='muted';note.textContent='فعّل إشعارات الجهاز حتى توصلك أخبار وياك. بالآيفون أضف التطبيق للشاشة الرئيسية وافتحه منها أولاً. تگدر توقفها بأي وقت.';const result=document.createElement('p');result.setAttribute('role','status');
  const enable=button('تفعيل إشعارات الجهاز',async()=>{enable.disabled=true;try{
   if(!supported())throw Error('هذا المتصفح لا يدعم إشعارات الجهاز. بالآيفون افتح وياك من الشاشة الرئيسية.');
   const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('لم تُمنح صلاحية الإشعارات. يمكنك السماح بها من إعدادات المتصفح.');
   const d=await api('/api/notifications');if(!d.publicKey)throw Error('خدمة إشعارات الجهاز غير مهيأة بعد');
   const r=await registration();let s=await r.pushManager.getSubscription();if(!s){const raw=atob(d.publicKey.replace(/-/g,'+').replace(/_/g,'/'));s=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))});}
   await api('/api/notifications','POST',{action:'subscribe',subscription:s.toJSON()});result.textContent='تم تفعيل إشعارات هذا الجهاز لحسابك.';
  }catch(e){result.textContent=e.message;}finally{enable.disabled=false;}});
  const stop=button('إيقاف إشعارات هذا الجهاز',async()=>{stop.disabled=true;try{await disable();result.textContent='تم إيقاف إشعارات هذا الجهاز.';}catch(e){result.textContent=e.message;}finally{stop.disabled=false;}});
  box.append(h,note,enable,stop,result);const inbox=document.createElement('div');inbox.id='notification-inbox';box.append(inbox);card.append(box);renderInbox(inbox);load().catch(e=>result.textContent=e.message);
 }
 async function adminPanel(){
  const panel=document.getElementById('admin-panel');panel.replaceChildren();
  const intro=document.createElement('p');intro.textContent='يظهر الإشعار في حساب المستخدم، ويُرسل للجهاز إذا فعّل استلام الإشعارات. قبول مزود الجهاز للإرسال لا يؤكد قراءة المستخدم.';panel.append(intro);
  const form=document.createElement('form');form.className='account-form';form.innerHTML='<label>عنوان الإشعار<input name="title" maxlength="100" required></label><label>نص الإشعار<textarea name="body" maxlength="500" required></textarea></label><label>القسم عند الضغط<select name="link"><option value="#home">الرئيسية</option><option value="#phrases">العبارات</option><option value="#students">الطلاب</option><option value="#exchange">محول العملات</option><option value="#services">المزيد</option></select></label><label>المستلمون<select name="target"><option value="self">تجربة على حسابي فقط</option><option value="all">جميع المستخدمين</option></select></label><button class="primary">إرسال الإشعار</button><p role="status"></p>';
  panel.append(form);const history=document.createElement('div');history.id='notification-history';panel.append(history);
  const status=form.querySelector('[role=status]');let sendId=null;
  async function process(id){sending=true;form.querySelector('button').disabled=true;try{let result;do{status.textContent='جارٍ إرسال إشعارات الأجهزة…';result=await api('/api/notifications','POST',{action:'process',id});}while(result.remaining>0);status.textContent='تم نشر الإشعار وإكمال محاولات الإرسال. راجع النتائج أدناه.';}catch(e){status.textContent=e.message+' — يمكنك استكمال الإرسال من السجل.';}finally{sending=false;form.querySelector('button').disabled=false;await refresh();}}
  async function refresh(){try{const d=await api('/api/notifications');if(!history.isConnected)return;history.replaceChildren();const info=document.createElement('p');info.textContent=`مفعّلو إشعارات الجهاز: ${d.subscribers.users} مستخدم · ${d.subscribers.devices} جهاز`;history.append(info);
   for(const n of d.history){const item=document.createElement('article');item.className='notification-item';const title=document.createElement('strong'),stats=document.createElement('p');title.textContent=n.title;stats.textContent=`${n.target_user?'تجربة خاصة':'للجميع'} · ${new Date(n.created_at).toLocaleString('ar-IQ')} · الأجهزة: ${n.total} · مقبول: ${n.accepted||0} · تعذّر: ${n.failed||0} · متبقّي: ${n.pending||0} · قيد المحاولة أو غير مؤكد: ${n.sending||0}`;item.append(title,stats);if(n.pending)item.append(button('استكمال الإرسال',()=>{if(!sending)process(n.id);}));history.append(item);}
  }catch(e){status.textContent=e.message;}}
  form.onsubmit=async e=>{e.preventDefault();if(sending)return;const values=Object.fromEntries(new FormData(form));if(values.target==='all'&&!confirm('إرسال هذا الإشعار إلى جميع المستخدمين؟'))return;form.querySelector('button').disabled=true;sendId||=crypto.randomUUID();try{const d=await api('/api/notifications','POST',{action:'create',id:sendId,...values});sendId=null;form.reset();await process(d.id);}catch(e){status.textContent=e.message;}finally{form.querySelector('button').disabled=false;}};
  await refresh();
 }
 window.addEventListener('wayak:authenticated',()=>{cached=null;load().catch(()=>{});});document.addEventListener('visibilitychange',()=>{if(!document.hidden)load().catch(()=>{});});setInterval(()=>load().catch(()=>{}),60000);
 window.addEventListener('wayak:session-expired',()=>{cached=null;});
 return {accountControls,adminPanel,disable};
}
