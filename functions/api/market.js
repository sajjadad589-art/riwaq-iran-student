const IR_URL='https://nerkh.jahankhahan.shop/data/live.json';
const IQ_URL='https://iraqsm.com/data/fx.json';
const MAX_AGE=7*86400000;
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
export function iranTimestamp(date,time,now=Date.now()){
 if(!/^\d{4}\/\d{2}\/\d{2}$/.test(date)||time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('invalid date');
 const fmt=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'});
 for(let i=-1;i<=8;i++){
  const day=new Date(now-i*86400000);day.setUTCHours(12,0,0,0);const p=Object.fromEntries(fmt.formatToParts(day).map(x=>[x.type,x.value]));
  if(`${p.year}/${p.month}/${p.day}`===date)return new Date(`${day.toISOString().slice(0,10)}T${time||'00:00'}:00+03:30`).toISOString();
 }
 throw Error('date too old');
}
export function parseIran(d,now=Date.now()){
 if(!positive(d.rates?.dollar))throw Error('invalid price');
 const time=d.time||'',updatedAt=iranTimestamp(d.date,time,now),age=now-Date.parse(updatedAt);
 if(age< -300000||age>MAX_AGE)throw Error('invalid age');
 return {rate:d.rates.dollar,buy:null,sell:null,unit:'IRT per USD',source:'Nerkhsanj',url:'https://nerkh.jahankhahan.shop/developers/en',updatedAt:time?updatedAt:null,sourceDate:d.date,sourceTime:time,closed:!time,stale:age>6*3600000,change:Number.isFinite(d.change?.dollar)?d.change.dollar:null};
}
export function parseIraq(d,now=Date.now()){
 const p=d.parallel,age=now-Date.parse(p?.publishedAt);
 if(d.unit!=='IQD per 1 USD'||!positive(p?.buy)||!positive(p?.sell)||p.buy>p.sell||!Number.isFinite(age)||age< -300000||age>MAX_AGE)throw Error('invalid Iraq data');
 return {rate:(p.buy+p.sell)/2,buy:p.buy,sell:p.sell,unit:'IQD per USD',source:'IQWealth (iraqsm.com)',url:'https://iraqsm.com/fx',updatedAt:p.publishedAt,sourceDate:d.asOf,stale:!!p.stale||age>6*3600000};
}
async function read(url,parse){
 const cache=globalThis.caches?.default,key=new Request(url);
 let d;const hit=cache&&await cache.match(key);
 if(hit)d=await hit.json();
 else {const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('upstream error');d=await r.json();parse(d);if(cache)await cache.put(key,new Response(JSON.stringify(d),{headers:{'Cache-Control':'public, max-age=1200','Content-Type':'application/json'}}));}
 return parse(d);
}
export async function onRequestGet(){
 const results=await Promise.allSettled([read(IR_URL,parseIran),read(IQ_URL,parseIraq)]);
 const markets={IR:results[0].status==='fulfilled'?results[0].value:null,IQ:results[1].status==='fulfilled'?results[1].value:null};
 return Response.json({markets,rates:{USD:1,IRT:markets.IR?.rate??null,IQD:markets.IQ?.rate??null},checkedAt:new Date().toISOString(),errors:results.map((r,i)=>r.status==='rejected'?(i===0?'IR':'IQ'):null).filter(Boolean)},{status:markets.IR||markets.IQ?200:502,headers:{'Cache-Control':'no-store'}});
}
