export const emptyData=()=>({expenses:[],saved:[],budget:0,checklist:[],places:[],imports:[],removed:[]});
const id=x=>typeof x==='string'&&/^[\w-]{1,80}$/.test(x);
const day=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const expense=x=>{if(!x||!id(x.id)||!day(x.day)||typeof x.name!=='string'||!x.name.trim()||x.name.length>80||!Number.isFinite(x.amount)||x.amount<=0||x.amount>1e12)throw Error('مصروف غير صحيح');return {id:x.id,day:x.day,name:x.name.trim(),amount:x.amount};};
const place=x=>{if(!x||typeof x.name!=='string'||!x.name||x.name.length>500||!Number.isFinite(x.lat)||Math.abs(x.lat)>90||!Number.isFinite(x.lon)||Math.abs(x.lon)>180)throw Error('مكان غير صحيح');return {name:x.name,lat:x.lat,lon:x.lon};};
export const placeKey=p=>p.lat.toFixed(5)+','+p.lon.toFixed(5);
export function changeData(previous,d){const s=structuredClone(previous);s.removed??=[];const ids=()=>{if(!Array.isArray(d.ids)||d.ids.length>2000||d.ids.some(x=>!id(x)))throw Error('قائمة غير صحيحة');return new Set(d.ids);};
 switch(d.action){
 case 'add':{const x=expense(d.expense);if(!s.removed.includes(x.id)&&!s.expenses.some(e=>e.id===x.id)&&!s.saved.some(e=>e.id===x.id))s.expenses.push(x);break;}
 case 'delete':case 'reset':{const selected=ids();s.expenses=s.expenses.filter(x=>!selected.has(x.id));s.removed=[...new Set([...s.removed,...selected])];break;}
 case 'archive':{const selected=ids(),saved=new Set(s.saved.map(x=>x.id));for(const x of s.expenses)if(selected.has(x.id)&&!saved.has(x.id)){s.saved.push({...x});saved.add(x.id);}break;}
 case 'budget':if(!Number.isFinite(d.value)||d.value<0||d.value>1e12)throw Error('ميزانية غير صحيحة');s.budget=d.value;break;
 case 'check':if(!Number.isInteger(d.index)||d.index<0||d.index>30||typeof d.checked!=='boolean')throw Error('اختيار غير صحيح');s.checklist=s.checklist.filter(x=>x!==d.index);if(d.checked)s.checklist.push(d.index);break;
 case 'place-add':{const x=place(d.place);if(!s.places.some(p=>placeKey(p)===placeKey(x)))s.places.push(x);break;}
 case 'place-delete':if(typeof d.key!=='string')throw Error('مكان غير صحيح');s.places=s.places.filter(p=>placeKey(p)!==d.key);break;
 case 'import':{if(!id(d.importId))throw Error('نقل غير صحيح');if(s.imports.includes(d.importId))break;for(const key of ['expenses','saved']){if(!Array.isArray(d[key])||d[key].length>2000)throw Error('بيانات كثيرة');const existing=new Set(s[key].map(x=>x.id));for(const item of d[key]){const x=expense(item);if(!existing.has(x.id)&&(key!=='expenses'||!s.removed.includes(x.id))){s[key].push(x);existing.add(x.id);}}}if(d.budget!==undefined&&s.budget===0){if(!Number.isFinite(d.budget)||d.budget<0||d.budget>1e12)throw Error('ميزانية غير صحيحة');s.budget=d.budget;}if(!Array.isArray(d.checklist)||d.checklist.some(x=>!Number.isInteger(x)||x<0||x>30)||!Array.isArray(d.places))throw Error('بيانات غير صحيحة');s.checklist=[...new Set([...s.checklist,...d.checklist])];for(const p of d.places){const x=place(p);if(!s.places.some(y=>placeKey(y)===placeKey(x)))s.places.push(x);}s.imports.push(d.importId);break;}
 default:throw Error('طلب غير صحيح');}
 if(s.expenses.length>2000||s.saved.length>10000||s.places.length>50||s.imports.length>100||new TextEncoder().encode(JSON.stringify(s)).byteLength>1500000)throw Error('وصلت إلى حد البيانات المسموح لحسابك');return s;
}
