// Configure MARKET_FEED_URL as a private Cloudflare Pages environment variable.
// Feed contract: {rates:{IRT: positive number, IQD: positive number}, updatedAt: ISO date, source: string}.
export async function onRequestGet({env}) {
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  if(!env.MARKET_FEED_URL)return new Response(JSON.stringify({error:'market_feed_not_configured'}),{status:503,headers});
  try {
    const url=new URL(env.MARKET_FEED_URL);if(url.protocol!=='https:')throw Error();
    const upstream=await fetch(url,{headers:env.MARKET_FEED_TOKEN?{Authorization:`Bearer ${env.MARKET_FEED_TOKEN}`}:{},signal:AbortSignal.timeout(10000)});
    if(!upstream.ok)throw Error();const d=await upstream.json(),age=Date.now()-Date.parse(d.updatedAt);
    if(![d.rates?.IRT,d.rates?.IQD].every(x=>Number.isFinite(x)&&x>0)||!Number.isFinite(age)||age< -300000||age>3600000||typeof d.source!=='string')throw Error();
    return new Response(JSON.stringify({rates:{IRT:d.rates.IRT,IQD:d.rates.IQD},updatedAt:d.updatedAt,source:d.source.slice(0,160)}),{headers});
  }catch{return new Response(JSON.stringify({error:'market_feed_unavailable_or_stale'}),{status:502,headers});}
}
