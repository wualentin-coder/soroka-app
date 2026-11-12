// Route data only; Telegram authorization fragments belong to its SDK.
const direct=new Set(['today','saved','finance','more','tasks','upcoming','inbox','archive','overview','settings','pc','render','projects','piano','english','sport','metrics','notes','vault','docs','server','vpn']);
const categories=new Set(['notes','lists','materials','recipes','products','addresses','tickets','cards','birthdays','docs','movies','sites','projects','vault']);
const finance=new Set(['overview','transactions','payments','debts','accounts','goals','budgets','transfers']);
const route=value=>direct.has(value)||value.startsWith('saved/')&&categories.has(value.slice(6))||value.startsWith('finance/')&&finance.has(value.slice(8));
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export function entryIntent(location,start=''){
 const query=new URLSearchParams(location.search||''),hash=String(location.hash||'').slice(1),page=query.get('page')||'',id=query.get('rid')||'',numeric=/^[1-9]\d{0,18}$/.test(id),result={route:route(hash)?hash:null};
 const startParam=query.get('tgWebAppStartParam')||start;
 if(!page&&/^note_[1-9]\d{0,18}$/.test(startParam))return{route:'saved/notes',open:{kind:'note',id:startParam.slice(5)}};
 if(page==='tasks'&&date(query.get('date')))return{route:'today',date:query.get('date')};
 if(['pc','render','english','piano','sport'].includes(page))return{route:page};
 if(query.get('tab')==='vault'||query.get('tab')==='docs')return{route:query.get('tab')};
 const mapping={notes:['saved/notes','note'],lists:['saved/lists','list'],shop:['saved/lists','list'],tasks:['tasks','task'],events:['upcoming','event'],tickets:['upcoming','event'],movies:['saved/movies','movie'],links:['saved/materials','saved'],recipes:['saved/recipes','saved'],goods:['saved/products','saved'],places:['saved/addresses','saved'],cards:['saved/cards','saved'],projects:['projects',null],metrics:['metrics',null],money:['finance/transactions',null],payments:['finance/payments',null],debts:['finance/debts',null],goals:['finance/goals',null],budgets:['finance/budgets',null]};
 if(mapping[page]){const [next,kind]=mapping[page];result.route=next;if(numeric&&kind)result.open={kind,id};}
 if(page==='notes'&&query.get('create')==='1')result.open={kind:'note',create:true};
 if(page==='sleep')result.route='today';return result;
}
