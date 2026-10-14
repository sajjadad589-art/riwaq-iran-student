import {readMarketSource} from '../../server/market-cache.js';
import {marketHealth} from '../../market-health.js';
import {json,sameOrigin} from '../../server/security.js';
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
 return {rate:d.rates.dollar,buy:null,sell:null,unit:'IRT per USD',source:'Nerkhsanj',url:'https://nerkh.jahankhahan.shop/developers/en',updatedAt:time?updatedAt:null,sourceDate:d.date,sourceDateISO:iranTimestamp(d.date,'12:00',now).slice(0,10),sourceTime:time,closed:!time,stale:age>6*3600000,change:Number.isFinite(d.change?.dollar)?d.change.dollar:null};
}
export function parseIraq(d,now=Date.now()){
 const p=d.parallel,age=now-Date.parse(p?.publishedAt);
 if(d.unit!=='IQD per 1 USD'||!positive(p?.buy)||!positive(p?.sell)||p.buy>p.sell||!Number.isFinite(age)||age< -300000||age>MAX_AGE)throw Error('invalid Iraq data');
 return {rate:(p.buy+p.sell)/2,buy:p.buy,sell:p.sell,unit:'IQD per USD',source:'IQWealth (iraqsm.com)',url:'https://iraqsm.com/fx',updatedAt:p.publishedAt,sourceDate:d.asOf,stale:!!p.stale||age>6*3600000};
}
export function parseIranIntraday(d,now=Date.now()){
 if(!Array.isArray(d.series?.dollar?.points))throw Error('invalid intraday');
 const points=d.series.dollar.points.map(p=>{if(!Array.isArray(p)||!positive(p[1]))throw Error('invalid point');const updatedAt=iranTimestamp(d.date,p[0],now),age=now-Date.parse(updatedAt);if(age< -300000||age>MAX_AGE)throw Error('invalid point age');return {rate:p[1],updatedAt,time:p[0]};}).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
 if(!points.length)throw Error('empty intraday');const p=points[0];
 return {rate:p.rate,buy:null,sell:null,unit:'IRT per USD',source:'Nerkhsanj',url:'https://nerkh.jahankhahan.shop/developers/en',updatedAt:p.updatedAt,sourceDate:d.date,sourceDateISO:iranTimestamp(d.date,'12:00',now).slice(0,10),sourceTime:p.time,closed:false,stale:now-Date.parse(p.updatedAt)>6*3600000,channel:'intraday'};
}
export function chooseIran(live,intraday){
 if(!live)return intraday;if(!intraday)return live;
 const liveStamp=Date.parse(live.updatedAt||live.sourceDateISO+'T00:00:00+03:30'),pointStamp=Date.parse(intraday.updatedAt);
 const selected=pointStamp>liveStamp?{...intraday}:live;
 if(selected.channel==='intraday'&&live.closed&&live.sourceDate===intraday.sourceDate)selected.closed=true;
 return selected;
}
async function marketResponse(context={},force=false){
 const now=Date.now(),db=context.env?.DB;
 const specs=[{id:'iran-live-v2',url:IR_URL,parse:parseIran,country:'IR'},{id:'iran-intraday-v2',url:'https://nerkh.jahankhahan.shop/data/intraday.json',parse:parseIranIntraday,country:'IR'},{id:'iraq-parallel-v2',url:IQ_URL,parse:parseIraq,country:'IQ'}];
 const results=await Promise.allSettled(specs.map(spec=>readMarketSource(spec,{db,force,now})));
 const value=i=>results[i].status==='fulfilled'?results[i].value:null;
 const markets={IR:chooseIran(value(0),value(1)),IQ:value(2)};
 const health=Object.fromEntries(Object.entries(markets).map(([id,m])=>[id,marketHealth(m,now,id)]));
 return json({markets,health,rates:{USD:1,IRT:markets.IR?.rate??null,IQD:markets.IQ?.rate??null},checkedAt:new Date(now).toISOString(),retryAfterSeconds:Object.values(health).some(h=>!h.usable)?120:1200,manual:force,errors:Object.entries(markets).filter(([,m])=>!m).map(([id])=>id),sources:specs.map((s,i)=>({id:s.id,ok:results[i].status==='fulfilled',mode:value(i)?.fetchMode||'failed',fetchedAt:value(i)?.fetchedAt||null}))},markets.IR||markets.IQ?200:502);
}
export async function onRequestGet(context){return marketResponse(context);}
export async function onRequestPost(context){if(!sameOrigin(context.request))return json({error:'طلب غير مسموح'},403);return marketResponse(context,true);}
