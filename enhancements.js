import './enhancements.css';

const $ = id => document.getElementById(id);
const number = n => new Intl.NumberFormat('en-US', {maximumFractionDigits: 2}).format(n);
const read = (key, fallback) => {try {return JSON.parse(localStorage.getItem(key)) ?? fallback;} catch {return fallback;}};
const save = (key, value) => {try {localStorage.setItem(key, JSON.stringify(value));return true;} catch {return false;}};

export function enhanceApp(map, state) {
  const toast = document.createElement('p');
  toast.className = 'app-toast';toast.id = 'app-toast';toast.setAttribute('role', 'status');toast.hidden = true;
  document.body.append(toast);
  let toastTimer;
  const notify = text => {toast.textContent = text;toast.hidden = false;clearTimeout(toastTimer);toastTimer = setTimeout(() => toast.hidden = true, 3000);};

  const shortcuts = document.createElement('div');
  shortcuts.className = 'daily-shortcuts';
  shortcuts.innerHTML = '<button data-screen="expenses"><span>▤</span>مصاريفي</button><button data-screen="students"><span>✓</span>تجهيز السفر</button><button data-screen="daily" class="emergency-shortcut"><span>✚</span>الطوارئ</button>';
  document.querySelector('.launcher').before(shortcuts);
  let shortcutTarget=null;
  shortcuts.querySelector('.emergency-shortcut').addEventListener('click',()=>{shortcutTarget='#daily .services .card:last-child';});
  shortcuts.querySelector('[data-screen="students"]').addEventListener('click',()=>{shortcutTarget='.travel-checklist';});
  window.addEventListener('hashchange',()=>{if(shortcutTarget){const target=shortcutTarget;shortcutTarget=null;requestAnimationFrame(()=>document.querySelector(target)?.scrollIntoView({block:'start'}));}});
  const launcherTitle = document.createElement('h2');launcherTitle.className = 'compact-heading';launcherTitle.textContent = 'خدماتك السريعة';document.querySelector('.launcher').before(launcherTitle);
  const homeEquivalent = document.createElement('button');homeEquivalent.id = 'home-equivalent';homeEquivalent.className = 'home-equivalent';homeEquivalent.dataset.screen = 'exchange';document.querySelector('.today-card').append(homeEquivalent);
  document.querySelectorAll('.rate-tile').forEach((tile, i) => {
    const meta = document.createElement('small');meta.id = i ? 'iran-meta' : 'iraq-meta';meta.className = 'market-meta';tile.querySelector('div').append(meta);
  });
  let previous = '';
  function rateDetails() {
    const {data, busy} = state();
    const key = JSON.stringify([data?.markets, data?.cached, busy, data?.checked, $('iqd-equivalent').textContent]);
    if (key === previous) return;previous = key;
    homeEquivalent.textContent = $('iqd-equivalent').textContent + ' ←';
    for (const [id, market] of [['iran-meta', data?.markets?.IR], ['iraq-meta', data?.markets?.IQ]]) {
      $(id).textContent = !market ? (busy ? 'جارٍ جلب السعر…' : 'المصدر غير متاح') :
        (market.updatedAt ? new Date(market.updatedAt).toLocaleTimeString('ar-IQ', {timeZone: 'Asia/Baghdad', hour: '2-digit', minute: '2-digit'}) : market.sourceDate) +
        ' · ' + (data.cached ? 'محفوظ' : market.stale ? 'قراءة قديمة' : market.closed ? 'آخر إغلاق' : 'وقت المصدر');
    }
  }
  rateDetails();setInterval(rateDetails, 1000);

  const presets = document.createElement('div');presets.className = 'converter-tabs';presets.setAttribute('aria-label', 'اتجاه التحويل');
  [['IQD','IRT','دينار ← تومان'],['IRT','IQD','تومان ← دينار'],['USD','IRT','دولار ← تومان']].forEach(([from,to,label]) => {
    const b = document.createElement('button');b.textContent = label;b.dataset.from = from;b.dataset.to = to;
    b.onclick = () => {$('from').value = from;$('to').value = to;$('from').dispatchEvent(new Event('input'));};presets.append(b);
  });
  document.querySelector('#exchange .exchange-grid').before(presets);
  const copy = document.createElement('button');copy.id = 'copy-conversion';copy.className = 'copy-conversion';copy.textContent = 'نسخ نتيجة التحويل ⧉';
  copy.onclick = async () => {
    if ($('result').textContent.includes('غير متاحة')) {notify('أدخل سعراً أو انتظر وصول أسعار السوق');return;}
    try {await navigator.clipboard.writeText($('amount').value + ' ' + $('from').selectedOptions[0].text + ' = ' + $('result').textContent);notify('تم نسخ نتيجة التحويل');} catch {notify('تعذّر النسخ. يمكنك تحديد النتيجة ونسخها يدوياً.');}
  };
  $('result').after(copy);
  const invalid = document.createElement('p');invalid.id = 'amount-error';invalid.className = 'field-error';invalid.setAttribute('role', 'status');$('amount').after(invalid);$('amount').setAttribute('aria-describedby','amount-error');
  const syncConverter = () => {
    presets.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.from === $('from').value && b.dataset.to === $('to').value));
    const bad = !$('amount').value || !Number.isFinite(Number($('amount').value)) || Number($('amount').value) < 0;
    $('amount').setAttribute('aria-invalid', bad);invalid.textContent = bad ? 'أدخل مبلغاً صحيحاً، صفر أو أكثر.' : '';copy.disabled = bad;
    document.querySelectorAll('.quick-amounts button').forEach(b => b.setAttribute('aria-pressed', Number(b.textContent.replaceAll(',','')) === Number($('amount').value)));
  };
  ['amount','from','to'].forEach(id => $(id).addEventListener('input',syncConverter));$('swap').addEventListener('click',syncConverter);syncConverter();

  // Search and filters share one empty state.
  const noPhrases = document.createElement('p');noPhrases.className = 'empty-state';noPhrases.id = 'phrase-empty';noPhrases.textContent = 'ما لقينا عبارة بهذا البحث. جرّب كلمة ثانية أو اختَر «الكل».';noPhrases.hidden = true;noPhrases.setAttribute('role','status');$('phrase-grid').after(noPhrases);
  const updateEmpty = () => noPhrases.hidden = [...document.querySelectorAll('.phrase')].some(p => !p.hidden);
  $('phrase-search').addEventListener('input',updateEmpty);document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click',updateEmpty));
  const phraseObserver = new MutationObserver(updateEmpty);phraseObserver.observe($('phrase-grid'),{subtree:true,attributes:true,attributeFilter:['hidden']});

  const checklist = document.createElement('article');checklist.className = 'card travel-checklist';
  checklist.innerHTML = '<div class="row"><h3>قائمة تجهيز السفر والدراسة</h3><span id="checklist-progress"></span></div><p class="muted">علاماتك تُحفظ على جهازك. المتطلبات النهائية تتأكد منها من الجامعة والجهة المختصة.</p><div id="checklist-items"></div>';
  $('students').append(checklist);
  const tasks = ['نسخة من الجواز والمستندات المهمة','التحقق من متطلبات الدخول والإقامة','تأكيد عنوان السكن ووسيلة الوصول','مراجعة قبول الجامعة والاعتراف بالتخصص','حفظ أرقام الطوارئ ووسيلة تواصل','تقدير ميزانية الرحلة والصرف'];
  let checked = read('wayak-checklist', []);if (!Array.isArray(checked)) checked = [];checked=[...new Set(checked.filter(i=>Number.isInteger(i)&&i>=0&&i<tasks.length))];
  const progress = () => $('checklist-progress').textContent = number(checked.length) + ' / ' + number(tasks.length);
  tasks.forEach((text,i) => {const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');input.type='checkbox';input.checked=checked.includes(i);span.textContent=text;input.onchange=()=>{checked=input.checked?[...new Set([...checked,i])]:checked.filter(x=>x!==i);save('wayak-checklist',checked);progress();};label.append(input,span);$('checklist-items').append(label);});progress();

  const budget = document.createElement('article');budget.className = 'card trip-budget';
  budget.innerHTML = '<h3>ميزانية الرحلة</h3><label for="trip-budget">الميزانية بالتومان<input id="trip-budget" type="number" min="0" step="any" placeholder="مثال: 5000000"></label><div class="budget-track"><div id="budget-fill"></div></div><p id="budget-status" role="status"></p>';
  $('expenses').append(budget);
  let budgetValue = read('wayak-budget', 0);if (!Number.isFinite(budgetValue) || budgetValue < 0) budgetValue=0;$('trip-budget').value=budgetValue||'';
  const budgetUpdate = () => {
    const list=read('wayak-expenses',[]),total=Array.isArray(list)?list.reduce((sum,x)=>sum+(Number.isFinite(x.amount)&&x.amount>0?x.amount:0),0):0;
    const value=Number($('trip-budget').value);$('budget-fill').style.width=value>0?Math.min(100,total/value*100)+'%':'0%';budget.classList.toggle('over-budget',value>0&&total>value);
    $('budget-status').textContent=value>0?(total<=value?'المتبقي: '+number(value-total)+' تومان':'تجاوزت الميزانية بـ '+number(total-value)+' تومان'):'أدخل ميزانيتك حتى تتابع المتبقي من مصاريف الرحلة.';
  };
  $('trip-budget').oninput=()=>{const value=Number($('trip-budget').value);if(Number.isFinite(value)&&value>=0)save('wayak-budget',value);budgetUpdate();};
  new MutationObserver(budgetUpdate).observe($('expense-list'),{childList:true,subtree:true});budgetUpdate();
  const expenseEmpty=document.createElement('p');expenseEmpty.className='empty-state';expenseEmpty.textContent='بعدك ما سجّلت مصاريف. أضف أول مصروف حتى تتابع ميزانية رحلتك.';$('expense-list').before(expenseEmpty);
  const expenseState=()=>expenseEmpty.hidden=$('expense-list').childElementCount>0;new MutationObserver(expenseState).observe($('expense-list'),{childList:true});expenseState();

  const cities=document.createElement('div');cities.className='city-picker';cities.innerHTML='<label for="map-city">انتقل إلى مدينة</label><select id="map-city"><option value="">اختَر مدينة في إيران</option><option value="35.6892,51.3890">طهران</option><option value="36.2605,59.6168">مشهد</option><option value="34.6416,50.8746">قم</option><option value="32.6546,51.6680">أصفهان</option><option value="29.5918,52.5837">شيراز</option><option value="38.0800,46.2919">تبريز</option><option value="36.5659,53.0586">ساري</option><option value="37.2808,49.5832">رشت</option></select>';
  $('search-form').before(cities);
  $('map-city').onchange=()=>{if(!$('map-city').value)return;map.setView($('map-city').value.split(',').map(Number),13);$('map-status').textContent='تم الانتقال إلى '+$('map-city').selectedOptions[0].text+'. اختَر نوع المكان للبحث حول مركز الخريطة.';$('places').replaceChildren();};
  const savedPanel=document.createElement('details');savedPanel.className='saved-places';savedPanel.innerHTML='<summary>أماكني المحفوظة <span id="saved-count">0</span></summary><div id="saved-places-list"></div>';$('places').after(savedPanel);
  let savedPlaces=read('wayak-places',[]);if(!Array.isArray(savedPlaces))savedPlaces=[];savedPlaces=savedPlaces.filter(p=>typeof p.name==='string'&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180);
  const placeKey=p=>p.lat.toFixed(5)+','+p.lon.toFixed(5);
  function renderSaved(){
    $('saved-count').textContent=number(savedPlaces.length);$('saved-places-list').replaceChildren();
    document.querySelectorAll('[data-saved-key]').forEach(button=>{const exists=savedPlaces.some(p=>placeKey(p)===button.dataset.savedKey);button.textContent=exists?'★ محفوظ':'☆ حفظ المكان';button.disabled=exists;});
    if(!savedPlaces.length){const p=document.createElement('p');p.className='muted';p.textContent='احفظ الأماكن من نتائج البحث حتى ترجع لها بسرعة.';$('saved-places-list').append(p);}
    savedPlaces.forEach(place=>{const row=document.createElement('div');row.className='saved-place-row';const button=document.createElement('button');button.textContent=place.name;button.onclick=()=>map.setView([place.lat,place.lon],16);const remove=document.createElement('button');remove.textContent='حذف';remove.setAttribute('aria-label','حذف '+place.name);remove.onclick=()=>{savedPlaces=savedPlaces.filter(p=>placeKey(p)!==placeKey(place));save('wayak-places',savedPlaces);renderSaved();};row.append(button,remove);$('saved-places-list').append(row);});
  }
  renderSaved();
  window.addEventListener('wayak:places',event=>{
    const valid=event.detail.filter(p=>Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon)));
    const buttons=[...$('places').children];valid.forEach((p,i)=>{
      if(!buttons[i])return;const place={name:p.display_name,lat:Number(p.lat),lon:Number(p.lon)},card=document.createElement('article');card.className='place-result';buttons[i].replaceWith(card);card.append(buttons[i]);
      const actions=document.createElement('div');actions.className='place-actions';const pin=document.createElement('button');
      pin.dataset.savedKey=placeKey(place);const sync=()=>{const exists=savedPlaces.some(x=>placeKey(x)===placeKey(place));pin.textContent=exists?'★ محفوظ':'☆ حفظ المكان';pin.disabled=exists;};sync();
      pin.onclick=()=>{if(savedPlaces.length>=50){notify('وصلت إلى 50 مكاناً. احذف مكاناً حتى تحفظ غيره.');return;}if(!savedPlaces.some(x=>placeKey(x)===placeKey(place)))savedPlaces.push(place);const persisted=save('wayak-places',savedPlaces);renderSaved();sync();notify(persisted?'تم حفظ المكان على جهازك':'المكان محفوظ لهذه الجلسة فقط؛ التخزين غير متاح');};
      const directions=document.createElement('a');directions.textContent='الاتجاهات ↗';directions.href='https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(place.lat+','+place.lon);directions.target='_blank';directions.rel='noopener';actions.append(pin,directions);card.append(actions);
    });
  });
  // Keep button state and navigation focus readable on small touch screens.
  document.querySelectorAll('button:not([type])').forEach(b=>{if(!b.closest('form'))b.type='button';});
  window.addEventListener('hashchange',()=>{const heading=$('screen-title');if(!heading.closest('[hidden]')){heading.tabIndex=-1;heading.focus({preventScroll:true});}});
}
