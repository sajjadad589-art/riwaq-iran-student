import {sectionNames,phraseCategories,validateDocument} from './cms-contract.js';
const $=id=>document.getElementById(id);
const excluded='#map,#phrase-grid,#rates,#places,#expense-list,#saved-places-list,.live-update,.market-meta,.phrase-tools,.trip-budget,.travel-checklist,.converter-tabs,.quick-amounts,.daily-shortcuts';
const dynamicIds=new Set(['market-notice','result','iqd-equivalent','rate-status','market-status','market-rates','home-rate-status','home-equivalent','phrase-count','copy-status','connection','budget-status','install-help','amount-error','expense-total','map-status']);
export function createContentManager(){
 const nodes=new Map(),defaults={sections:{},ads:[],phrases:[]};
 for(const [id,title]of Object.entries(sectionNames)){
  const section=$(id);if(!section)continue;
  const blocks=[];section.querySelectorAll('h1,h2,h3,p,a,summary,.welcome small,.more-list b,.more-list small,.launch-tile').forEach((node,i)=>{
   if(node.closest(excluded)||dynamicIds.has(node.id)||node.querySelector('input,button,output,select')||node.classList.contains('launch-tile'))return;
   if(node.children.length&&!node.matches('a'))return;
   const identity=node.tagName+'|'+node.textContent+'|'+(node.getAttribute('href')||'');let hash=2166136261;for(const char of identity)hash=Math.imul(hash^char.charCodeAt(0),16777619);let key=id+'.'+(hash>>>0).toString(36);while(nodes.has(key))key+='x';const entry={id:key,text:node.textContent};if(node.matches('a'))entry.href=node.getAttribute('href')||'';
   nodes.set(key,{node,text:node.textContent,href:node.getAttribute('href')});blocks.push(entry);
  });defaults.sections[id]={title,enabled:true,blocks,cards:[]};
 }
 const oldCategories=['help','help','shop','study','study','help','help','travel','travel','shop','help','shop'];
 document.querySelectorAll('.phrase').forEach((p,i)=>defaults.phrases.push({ar:p.querySelector('span').textContent,fa:p.querySelector('strong').textContent,sound:p.querySelector('small').textContent,category:p.dataset.category||oldCategories[i]||'help'}));
 let current=structuredClone(defaults),revision=0,editing=false;
 function apply(document){
  current=validateDocument(document);
  for(const value of nodes.values()){value.node.textContent=value.text;if(value.href!==null)value.node.setAttribute('href',value.href);}
  document= current;
  for(const [id,s]of Object.entries(document.sections)){
   const section=$(id);if(!section)continue;section.classList.toggle('cms-disabled',!s.enabled);
   section.querySelectorAll(':scope > .cms-cards,.cms-ads,:scope > .cms-unavailable').forEach(n=>n.remove());
   const notice=window.document.createElement('p');notice.className='cms-unavailable';notice.textContent='هذا القسم غير متاح حالياً. جرّب لاحقاً.';section.append(notice);
   for(const block of s.blocks){const entry=nodes.get(block.id);if(!entry)continue;entry.node.textContent=block.text;if(block.href!==undefined&&entry.node.matches('a'))entry.node.setAttribute('href',block.href);}
   const cards=window.document.createElement('div');cards.className='cms-cards';for(const card of s.cards)cards.append(renderCard(card,false));section.append(cards);
   const ads=window.document.createElement('div');ads.className='cms-ads';const now=Date.now();for(const ad of document.ads)if(ad.enabled&&ad.section===id&&(!ad.start||Date.parse(ad.start)<=now)&&(!ad.end||Date.parse(ad.end)>now))ads.append(renderCard(ad,true));
   if(id==='home')section.querySelector('.home-body').prepend(ads);else section.prepend(ads);
  }
  const grid=$('phrase-grid');grid.replaceChildren();for(const p of document.phrases){const button=window.document.createElement('button');button.className='phrase';button.dataset.category=p.category;const ar=window.document.createElement('span'),fa=window.document.createElement('strong'),sound=window.document.createElement('small');ar.textContent=p.ar;fa.textContent=p.fa;fa.lang='fa';sound.textContent=p.sound;button.append(ar,fa,sound);button.onclick=async()=>{try{await navigator.clipboard.writeText(p.fa);$('copy-status').textContent='تم نسخ العبارة';}catch{$('copy-status').textContent='تعذّر النسخ. يمكنك نسخ العبارة يدوياً.';}};grid.append(button);}
  $('phrase-search').dispatchEvent(new Event('input'));window.dispatchEvent(new CustomEvent('wayak:content',{detail:document}));
 }
 function renderCard(card,ad){const article=document.createElement('article');article.className='card cms-card'+(ad?' sponsored-card':'');if(ad){const tag=document.createElement('small');tag.textContent='إعلان';article.append(tag);}if(card.image){const image=document.createElement('img');image.src=card.image;image.alt=card.title;image.loading='lazy';image.referrerPolicy='no-referrer';article.append(image);}const title=document.createElement('h3'),body=document.createElement('p');title.textContent=card.title;body.textContent=card.body;article.append(title,body);if(card.link){const a=document.createElement('a');a.href=card.link;a.textContent='التفاصيل ←';if(!card.link.startsWith('#')){a.target='_blank';a.rel='noopener';}article.append(a);}return article;}
 async function load(){if(editing||document.documentElement.classList.contains('auth-locked'))return;try{const r=await fetch('/api/content',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)return;const d=await r.json();if(d.document&&d.revision!==revision){apply(d.document);revision=d.revision;try{localStorage.setItem('wayak-cms',JSON.stringify(d));}catch{}}}catch{}}
 try{const cached=JSON.parse(localStorage.getItem('wayak-cms'));if(cached?.document){apply(cached.document);revision=cached.revision;}}catch{}
 load();setInterval(load,60000);window.addEventListener('hashchange',load);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
 return {defaults,get document(){return structuredClone(current);},get revision(){return revision;},setEditing(value){editing=value;},applyPublished(d){apply(d.document);revision=d.revision;try{localStorage.setItem('wayak-cms',JSON.stringify(d));}catch{}},load};
}
