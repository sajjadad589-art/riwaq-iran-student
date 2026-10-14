const button=(text,handler)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=handler;return b;};
export function createNotifications(api,getUser){
 let cached=null,sending=false,prompt=null;const shown=new Set();
 const supported=()=> 'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
 const bounded=(promise,message)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),15000);})]).finally(()=>clearTimeout(timer));};
 const registration=()=>bounded(navigator.serviceWorker.ready,'تعذّر تجهيز الإشعارات. حدّث التطبيق وحاول مرة ثانية.');
 const preference=(key,value)=>{try{if(value===undefined)return localStorage.getItem(key);localStorage.setItem(key,String(value));}catch{}return null;};
 async function activate(){
  if(!supported())throw Error('هذا المتصفح لا يدعم إشعارات الجهاز. بالآيفون افتح وياك من الشاشة الرئيسية.');
  if(Notification.permission==='denied')throw Error('الإشعارات محظورة لهذا التطبيق. اسمح بها من إعدادات المتصفح أو الجهاز، ثم ارجع وفعلها.');
  const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
  if(permission!=='granted')throw Error('لم تُمنح صلاحية الإشعارات. تگدر تفعّلها لاحقاً من الإعدادات.');
  const userId=getUser()?.id,d=await api('/api/notifications');if(!d.publicKey)throw Error('خدمة إشعارات الجهاز غير مهيأة بعد');
  const r=await registration();let s=await r.pushManager.getSubscription();if(!s){const raw=atob(d.publicKey.replace(/-/g,'+').replace(/_/g,'/'));s=await bounded(r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))}),'تعذّر ربط الجهاز بخدمة الإشعارات. جرّب متصفحاً مدعوماً أو افتح التطبيق المثبّت.');}
  if(getUser()?.id!==userId)throw Error('سجّل الدخول وحاول مرة ثانية');await api('/api/notifications','POST',{action:'subscribe',subscription:s.toJSON()});preference('wayak-push-off','0');return 'تم تفعيل إشعارات هذا الجهاز لحسابك.';
 }
 function closePrompt(){if(prompt){prompt.close();prompt.remove();prompt=null;}}
 async function offer(d){
  if(!d?.publicKey||!getUser()||document.hidden||prompt||preference('wayak-push-off')==='1')return;
  if(supported()&&Notification.permission==='granted'){try{await activate();navigator.serviceWorker.controller?.postMessage({type:'wayak:flush-receipts'});return;}catch{}}
  if(Number(preference('wayak-push-prompt-after'))>Date.now())return;
  preference('wayak-push-prompt-after',Date.now()+7*86400000);prompt=document.createElement('dialog');prompt.id='push-permission-dialog';prompt.className='push-permission-dialog';prompt.setAttribute('aria-labelledby','push-permission-title');prompt.innerHTML='<img src="/wayak-logo.webp" alt="" width="64" height="64"><h2 id="push-permission-title">خلّ وياك يوصلك بالجديد 💙</h2><p>فعّل إشعارات جهازك حتى توصلك أخبار وياك حتى لو التطبيق مغلق. بعدها جهازك يطلب موافقتك.</p><p class="muted">بالآيفون: أضف وياك للشاشة الرئيسية وافتحه منها. تگدر توقف الإشعارات بأي وقت من الإعدادات.</p><p class="push-prompt-status" role="status"></p>';
  const current=prompt,enable=button('تفعيل الإشعارات',async()=>{enable.disabled=true;try{await activate();closePrompt();}catch(e){current.querySelector('[role=status]').textContent=e.message;}finally{enable.disabled=false;}});enable.className='primary';if(!supported()){enable.disabled=true;current.querySelector('[role=status]').textContent='متصفحك الحالي ما يدعم إشعارات الجهاز. افتح وياك بمتصفح مدعوم، أو كتطبيق مثبّت على الآيفون.';}
  current.append(enable,button('لاحقاً',closePrompt));current.addEventListener('cancel',()=>{current.remove();prompt=null;});document.body.append(current);current.showModal();
 }
 async function disable(byUser=false){
  cached=null;
  closePrompt();if(byUser){preference('wayak-push-off','1');preference('wayak-push-prompt-after',Date.now()+7*86400000);}
  if(!supported())return;
  const r=await navigator.serviceWorker.getRegistration();if(!r)return;const s=await r.pushManager.getSubscription();
  if(s){try{await api('/api/notifications','POST',{action:'unsubscribe',endpoint:s.endpoint});}finally{await s.unsubscribe();}}
 }
 async function load(){if(!getUser()||document.hidden)return;const id=getUser().id,d=await api('/api/notifications');if(getUser()?.id!==id)return;cached=d;for(const inbox of document.querySelectorAll('[data-notification-inbox]'))renderInbox(inbox);const shortcut=document.querySelector('.account-shortcut');if(shortcut)shortcut.textContent=d.messages.length?'حسابي 🔔 '+d.messages.length:'حسابي';return d;}
 function renderInbox(inbox){
  inbox.replaceChildren();const heading=document.createElement('h3');heading.textContent='إشعارات وياك';inbox.append(heading);
  if(!cached?.messages.length){const p=document.createElement('p');p.className='muted';p.textContent=cached?'ما عندك إشعارات حالياً.':'جارٍ تحميل الإشعارات…';inbox.append(p);return;}
  for(const n of cached.messages){const card=document.createElement('article');card.className='notification-item';const title=document.createElement('strong'),body=document.createElement('p'),time=document.createElement('small'),link=document.createElement('a');title.textContent=n.title;body.textContent=n.body;time.textContent=new Date(n.created_at).toLocaleString('ar-IQ');link.textContent='فتح التفاصيل';link.href=/^#[a-z]+(?:$|\?)/.test(n.link)?n.link:'#home';card.append(title,body,time,link);inbox.append(card);}
  if(!document.hidden&&!inbox.closest('section')?.hidden){const ids=cached.messages.map(n=>n.id).filter(id=>!shown.has(getUser()?.id+':'+id));if(ids.length){const userId=getUser()?.id;api('/api/notifications','POST',{action:'inbox-shown',ids}).then(()=>ids.forEach(id=>shown.add(userId+':'+id))).catch(()=>{});}}
 }
 function accountControls(card){
  const box=document.createElement('div');box.className='notification-settings';const h=document.createElement('h3');h.textContent='الإشعارات';const note=document.createElement('p');note.className='muted';note.textContent='فعّل إشعارات الجهاز حتى توصلك أخبار وياك. بالآيفون أضف التطبيق للشاشة الرئيسية وافتحه منها أولاً. تگدر توقفها بأي وقت.';const result=document.createElement('p');result.setAttribute('role','status');
  const enable=button('تفعيل إشعارات الجهاز',async()=>{enable.disabled=true;try{result.textContent=await activate();}catch(e){result.textContent=e.message;}finally{enable.disabled=false;}});
  const stop=button('إيقاف إشعارات هذا الجهاز',async()=>{stop.disabled=true;try{await disable(true);result.textContent='تم إيقاف إشعارات هذا الجهاز.';}catch(e){result.textContent=e.message;}finally{stop.disabled=false;}});
  box.append(h,note,enable,stop,result);const inbox=document.createElement('div');inbox.id=card.closest('#settings')?'settings-notification-inbox':'notification-inbox';inbox.dataset.notificationInbox='1';box.append(inbox);card.append(box);renderInbox(inbox);load().catch(e=>result.textContent=e.message);
 }
 async function adminPanel(panel=document.getElementById('admin-panel')){
  panel.replaceChildren();
  const intro=document.createElement('p');intro.textContent='يظهر الإشعار في حساب المستخدم، ويُرسل للجهاز إذا فعّل استلام الإشعارات. قبول مزود الجهاز للإرسال لا يؤكد قراءة المستخدم.';panel.append(intro);
  const form=document.createElement('form');form.className='account-form';form.innerHTML='<label>عنوان الإشعار<input name="title" maxlength="100" required></label><label>نص الإشعار<textarea name="body" maxlength="500" required></textarea></label><label>القسم عند الضغط<select name="link"><option value="#home">الرئيسية</option><option value="#phrases">العبارات</option><option value="#students">الطلاب</option><option value="#exchange">محول العملات</option><option value="#services">المزيد</option></select></label><label>المستلمون<select name="target"><option value="self">تجربة على حسابي فقط</option><option value="all">جميع المستخدمين</option></select></label><button class="primary">إرسال الإشعار</button><p role="status"></p>';
  if(panel.closest('#settings'))form.elements.target.value='all';
  panel.append(form);const history=document.createElement('div');history.id=panel.closest('#settings')?'settings-notification-history':'notification-history';panel.append(button('تحديث نتائج الوصول',()=>refresh()),history);
  const status=form.querySelector('[role=status]');let sendId=null;
  async function process(id){sending=true;form.querySelector('button').disabled=true;try{let result;do{status.textContent='جارٍ إرسال إشعارات الأجهزة…';result=await api('/api/notifications','POST',{action:'process',id});}while(result.remaining>0);status.textContent='تم نشر الإشعار وإكمال محاولات الإرسال. راجع النتائج أدناه.';}catch(e){status.textContent=e.message+' — يمكنك استكمال الإرسال من السجل.';}finally{sending=false;form.querySelector('button').disabled=false;await refresh();}}
  async function refresh(){try{const d=await api('/api/notifications');if(!history.isConnected)return;history.replaceChildren();const info=document.createElement('p');info.textContent=`مفعّلو إشعارات الجهاز: ${d.subscribers.users} مستخدم · ${d.subscribers.devices} جهاز`;history.append(info);
   for(const n of d.history){const item=document.createElement('article');item.className='notification-item';const title=document.createElement('strong'),stats=document.createElement('p');title.textContent=n.title;stats.textContent=`${n.target_user?'تجربة خاصة':'للجميع'} · ${new Date(n.created_at).toLocaleString('ar-IQ')} · المستلمون: ${n.recipients||0} شخص`;item.append(title,stats);const metrics=document.createElement('div');metrics.className='notification-metrics';for(const [key,label]of [['confirmedUsers','أكد الجهاز استلامه'],['failedUsers','فشل إرسالهم'],['waitingUsers','بانتظار تأكيد الجهاز'],['unsubscribedUsers','لم يفعّلوا إشعارات الجهاز'],['inAppUsers','ظهر داخل التطبيق']]){const cell=document.createElement('p'),value=document.createElement('strong'),text=document.createElement('span');value.textContent=n[key]||0;text.textContent=label;cell.append(value,text);metrics.append(cell);}item.append(metrics);const note=document.createElement('small');note.textContent=`قبله مزود الإشعارات: ${n.acceptedUsers||0} شخص · الأجهزة: ${n.total} · مقبول: ${n.accepted||0} · تعذّر: ${n.failed||0} · متبقّي: ${n.pending||0}. تأكيد الجهاز يعني عرض الإشعار، ولا يعني أن الشخص قرأه.`;item.append(note);if(n.pending)item.append(button('استكمال الإرسال',()=>{if(!sending)process(n.id);}));history.append(item);}
  }catch(e){status.textContent=e.message;}}
  form.onsubmit=async e=>{e.preventDefault();if(sending)return;const values=Object.fromEntries(new FormData(form));if(values.target==='all'&&!confirm('إرسال هذا الإشعار إلى جميع المستخدمين؟'))return;form.querySelector('button').disabled=true;sendId||=crypto.randomUUID();try{const d=await api('/api/notifications','POST',{action:'create',id:sendId,...values});sendId=null;form.reset();await process(d.id);}catch(e){status.textContent=e.message;}finally{form.querySelector('button').disabled=false;}};
  await refresh();const timer=setInterval(()=>{if(!history.isConnected){clearInterval(timer);return;}if(!document.hidden&&!history.closest('section')?.hidden&&!sending)refresh();},15000);
 }
 window.addEventListener('wayak:authenticated',()=>{cached=null;shown.clear();load().then(offer).catch(()=>{});});document.addEventListener('visibilitychange',()=>{if(!document.hidden)load().then(offer).catch(()=>{});});setInterval(()=>load().catch(()=>{}),60000);
 window.addEventListener('hashchange',()=>load().catch(()=>{}));window.addEventListener('online',()=>{navigator.serviceWorker?.controller?.postMessage({type:'wayak:flush-receipts'});load().catch(()=>{});});
 window.addEventListener('wayak:session-expired',()=>{cached=null;shown.clear();closePrompt();});
 return {accountControls,adminPanel,disable};
}
