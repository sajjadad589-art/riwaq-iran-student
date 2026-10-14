import {marketHealth} from '../market-health.js';
export async function readMarketSource(spec,{db,force=false,now=Date.now(),send=fetch}={}){
 let row=db?await db.prepare('SELECT * FROM market_source_cache WHERE id=?').bind(spec.id).first():null;
 let cached;try{if(row?.payload)cached=spec.parse(JSON.parse(row.payload),now);}catch{}
 const ttl=cached&&!row?.last_error&&marketHealth(cached,now,spec.country).usable?1200000:120000;
 if(cached&&!force&&now-row.fetched_at<ttl)return {...cached,fetchedAt:new Date(row.fetched_at).toISOString(),fetchError:!!row.last_error,fetchMode:'cache'};
 const lock=crypto.randomUUID();
 if(db){const claimed=await db.prepare('INSERT INTO market_source_cache(id,last_attempt,lock_until,lock_token) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET last_attempt=excluded.last_attempt,lock_until=excluded.lock_until,lock_token=excluded.lock_token WHERE last_attempt<=? AND lock_until<=? RETURNING id').bind(spec.id,now,now+15000,lock,now-60000,now).first();
  if(!claimed){if(cached)return {...cached,fetchedAt:new Date(row.fetched_at).toISOString(),fetchError:!!row.last_error,fetchMode:'cooldown'};throw Error('provider_busy');}
 }
 try{
  const url=new URL(spec.url);url.searchParams.set('wayak_minute',String(Math.floor(now/60000)));
  const response=await send(url.href,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json','Cache-Control':'no-cache'},cache:'no-store',cf:{cacheTtl:0,cacheEverything:false}});
  if(!response.ok)throw Error('upstream_http_'+response.status);
  const payload=await response.json(),quote=spec.parse(payload,now);
  if(db)await db.prepare('UPDATE market_source_cache SET payload=?,fetched_at=?,lock_until=0,last_error=NULL WHERE id=? AND lock_token=?').bind(JSON.stringify(payload),now,spec.id,lock).run();
  return {...quote,fetchedAt:new Date(now).toISOString(),fetchError:false,fetchMode:'network'};
 }catch(error){
  if(db)await db.prepare('UPDATE market_source_cache SET lock_until=0,last_error=? WHERE id=? AND lock_token=?').bind(String(error.message).slice(0,80),spec.id,lock).run();
  if(cached)return {...cached,fetchedAt:new Date(row.fetched_at).toISOString(),fetchError:true,fetchMode:'saved'};
  throw error;
 }
}
