export function convert(amount,from,to,rates,market){
 const r={...rates,IRT:rates.IRR/10};
 if(Number(market)>0){r.IRT=Number(market);r.IRR=r.IRT*10;}
 if(!Number.isFinite(amount)||amount<0||!r[from]||!r[to])return null;
 return amount/r[from]*r[to];
}
