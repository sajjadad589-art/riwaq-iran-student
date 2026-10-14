export const FRESH_FOR=60*60*1000;
export function marketHealth(m,now=Date.now(),country='IR',cached=false){
 if(!m)return {state:'unavailable',usable:false,label:'المصدر غير متاح'};
 const age=now-Date.parse(m.updatedAt),zone=country==='IR'?'Asia/Tehran':'Asia/Baghdad';
 const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 const previousDay=Number.isFinite(age)&&day(m.updatedAt)!==day(now);
 let state=cached||m.fetchError?'cached':m.closed?'closed':!Number.isFinite(age)||age< -300000||age>FRESH_FOR||m.stale||previousDay?'stale':'fresh';
 return {state,usable:state==='fresh',age:Math.max(0,age),label:({fresh:'أحدث رصد متاح',closed:'آخر إغلاق — ليس سعراً مباشراً',stale:'قراءة قديمة — ليست مباشرة',cached:'قراءة محفوظة — تعذّر جلب جديد',unavailable:'المصدر غير متاح'})[state]};
}
export function marketStamp(m,country='IR'){
 if(!m)return '';
 const zone=country==='IR'?'Asia/Tehran':'Asia/Baghdad';
 if(m.updatedAt)return new Date(m.updatedAt).toLocaleString('ar-IQ',{timeZone:zone,day:'numeric',month:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});
 if(m.sourceDateISO)return new Date(m.sourceDateISO+'T12:00:00Z').toLocaleDateString('ar-IQ',{timeZone:zone});
 return m.sourceDate||'توقيت غير معروف';
}
export function usableMarketRates(data,allowOld=false,now=Date.now()){
 const usable=id=>allowOld||marketHealth(data?.markets?.[id],now,id,!!data?.cached).usable;
 return {USD:1,IQD:usable('IQ')?data?.rates?.IQD:null,IRR:usable('IR')?data?.rates?.IRR:null};
}
export function savedMarket(data,now=Date.now()){
 if(!data?.source||data.rates?.USD!==1||!Number.isFinite(data.checked)||now-data.checked>7*86400000||data.checked>now+300000)return null;
 const result=structuredClone(data);result.cached=true;
 result.markets||={};for(const [id,key]of [['IR','IRR'],['IQ','IQD']]){const m=result.markets[id],time=Date.parse(m?.updatedAt||m?.sourceDateISO+'T12:00:00Z');if(!Number.isFinite(time)||now-time>7*86400000||time>now+300000){result.markets[id]=null;result.rates[key]=null;}}
 return result;
}
