const CACHE='wayak-v13';self.addEventListener('install',e=>{e.waitUntil((async()=>{const r=await fetch('/');const html=await r.clone().text();const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(x=>x[1]);const c=await caches.open(CACHE);await c.put('/',r);await c.addAll(['/manifest.webmanifest','/icon.svg','/city.svg','/tehran-hero.png','/icon-192.png','/icon-512.png',...assets]);await self.skipWaiting();})());});self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const key of await caches.keys())if(key!==CACHE)await caches.delete(key);await self.clients.claim();})());});self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.startsWith('/api/'))return;if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(()=>caches.match('/')));else e.respondWith(caches.match(e.request,{ignoreVary:true}).then(c=>c||fetch(e.request)));});


self.addEventListener('push',event=>{
 event.waitUntil((async()=>{let n;try{n=event.data.json();}catch{n={title:'وياك',body:'عندك إشعار جديد',url:'#account'};}
  await self.registration.showNotification(String(n.title||'وياك').slice(0,100),{body:String(n.body||'').slice(0,500),icon:'/icon-192.png',badge:'/icon-192.png',tag:n.id||'wayak',data:{url:typeof n.url==='string'&&/^#[a-z]+(?:$|\?)/.test(n.url)?n.url:'#account'}});
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();event.waitUntil((async()=>{const hash=event.notification.data?.url||'#account';const target=new URL('/',self.location.origin);target.hash=/^#[a-z]+(?:$|\?)/.test(hash)?hash:'#account';
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of windows){if(new URL(client.url).origin===target.origin){await client.navigate(target.href);return client.focus();}}return self.clients.openWindow(target.href);
 })());
});
