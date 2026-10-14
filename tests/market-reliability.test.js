import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {readMarketSource} from '../server/market-cache.js';import {parseIran,parseIranIntraday,chooseIran,onRequestPost} from '../functions/api/market.js';import {marketHealth,usableMarketRates,savedMarket} from '../market-health.js';
const now=Date.parse('2026-10-13T11:00:00Z'),live={date:'1405/07/21',time:'14:28',rates:{dollar:250000}};
function db(){const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('../migrations/0006_market_cache.sql',import.meta.url),'utf8'));return {sqlite,prepare(sql){let values=[];const q={bind(...v){values=v;return q;},async first(){return sqlite.prepare(sql).get(...values)||null;},async run(){return sqlite.prepare(sql).run(...values);}};return q;}};}
const spec={id:'IR',url:'https://nerkh.jahankhahan.shop/data/live.json',country:'IR',parse:parseIran};
test('manual refresh bypasses 20-minute cache but respects global one-minute provider limit',async()=>{
 const database=db();let calls=0;const send=async(url,options)=>{calls++;assert.ok(url.includes('wayak_minute='));assert.equal(options.cache,'no-store');assert.equal(options.cf,undefined,'do not combine incompatible Cloudflare cacheTtl and no-store');return Response.json({...live,rates:{dollar:250000+calls}});};
 try{const first=await readMarketSource(spec,{db:database,now,send});assert.equal(first.fetchMode,'network');const cached=await readMarketSource(spec,{db:database,now:now+30000,send});assert.equal(cached.fetchMode,'cache');assert.equal(calls,1);
  await readMarketSource(spec,{db:database,now:now+30000,send,force:true});assert.equal(calls,1);
  const forced=await readMarketSource(spec,{db:database,now:now+61000,send,force:true});assert.equal(calls,2);assert.equal(forced.rate,250002);assert.equal(forced.updatedAt,first.updatedAt,'fetch time must not rewrite quote timestamp');await readMarketSource(spec,{db:database,now:now+65000,send,force:true});assert.equal(calls,2);
 }finally{database.sqlite.close();}
});
test('closed/stale source retries in two minutes; outage preserves original timestamp with failure flag',async()=>{
 const database=db();let calls=0,failed=false;const send=async()=>{calls++;if(failed)throw Error('provider_offline');return Response.json({...live,time:''});};
 try{const first=await readMarketSource(spec,{db:database,now,send});await readMarketSource(spec,{db:database,now:now+121000,send});assert.equal(calls,2);failed=true;const saved=await readMarketSource(spec,{db:database,now:now+242000,send});assert.equal(saved.fetchError,true);assert.equal(saved.updatedAt,null);assert.equal(saved.sourceDate,first.sourceDate);assert.equal(saved.fetchedAt,new Date(now+121000).toISOString());assert.equal(marketHealth(saved,now+242000).usable,false);
 }finally{database.sqlite.close();}
});
test('shared SQL fetch lock prevents two simultaneous requests from calling provider twice',async()=>{
 const database=db();let calls=0;const send=async()=>{calls++;return Response.json(live);};try{await Promise.allSettled([readMarketSource(spec,{db:database,now,send}),readMarketSource(spec,{db:database,now,send})]);assert.equal(calls,1);}finally{database.sqlite.close();}
});
test('intraday fallback selects newest real observation and rejects future/invalid observations',()=>{
 const point=parseIranIntraday({date:'1405/07/21',series:{dollar:{points:[['14:20',249000],['14:29',251000]]}}},now);assert.equal(point.rate,251000);assert.equal(chooseIran(parseIran(live,now),point).channel,'intraday');assert.equal(chooseIran(null,point).rate,251000);const closed=chooseIran(parseIran({...live,time:''},now),point);assert.equal(closed.closed,true);assert.equal(marketHealth(closed,now).usable,false);assert.throws(()=>parseIranIntraday({date:'1405/07/21',series:{dollar:{points:[['23:59',251000]]}}},now));
});
test('old, closing and offline quotes cannot silently enter converter, and old storage expires',()=>{
 const quote=parseIran(live,now),data={source:'test',checked:now,markets:{IR:quote,IQ:{updatedAt:new Date(now).toISOString()}},rates:{USD:1,IRR:2500000,IQD:1500}};assert.equal(usableMarketRates(data,false,now).IRR,2500000);const closed={...data,markets:{...data.markets,IR:{...quote,closed:true}}};assert.equal(usableMarketRates(closed,false,now).IRR,null);assert.equal(usableMarketRates(closed,true,now).IRR,2500000);assert.equal(usableMarketRates({...data,cached:true},false,now).IQD,null);assert.equal(marketHealth(quote,now+3600001).usable,false);assert.equal(savedMarket(data,now+8*86400000),null);const corrupted=structuredClone(data);corrupted.markets.IR.updatedAt='bad';assert.equal(savedMarket(corrupted,now).rates.IRR,null);
});
test('manual refresh endpoint rejects cross-origin POST',async()=>{const r=await onRequestPost({request:new Request('https://way4.pages.dev/api/market',{method:'POST',headers:{Origin:'https://evil.test','X-Wayak-Request':'1'}})});assert.equal(r.status,403);});
