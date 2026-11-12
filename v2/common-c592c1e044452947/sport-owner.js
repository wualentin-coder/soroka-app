import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/sport-workspace.js';
import {createSportOwner} from '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/sport-owner.mjs';
const clone=value=>structuredClone(value);
const failure=(code,message)=>Object.assign(Error(message),{code});
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const safeChanges=changes=>Array.isArray(changes)&&changes.length<=2000&&changes.every(change=>record(change)&&Array.isArray(change.path)&&change.path.length<=12&&change.path.every(key=>typeof key==='string'&&key.length<=200&&!['__proto__','constructor','prototype'].includes(key)));
const validPacket=packet=>record(packet)&&typeof packet.requestId==='string'&&packet.requestId.length>0&&packet.requestId.length<=160&&Number.isSafeInteger(packet.baseRevision)&&packet.baseRevision>=0&&safeChanges(packet.changes)&&(packet.session===null||record(packet.session));
const atPath=(state,path)=>{let value=state;for(const key of path){if(!record(value)||!Object.hasOwn(value,key))return{present:false};value=value[key];}return{present:true,value:clone(value)};};
const equalValue=(a,b)=>a.present===b.present&&(!a.present||JSON.stringify(a.value)===JSON.stringify(b.value));
const serverValue=value=>{if(!record(value)||value.error||value.demo===true||!record(value.state)||!record(value.catalog)||value.startedOn!=null&&!/^\d{4}-\d{2}-\d{2}$/.test(value.startedOn))throw failure('not_ready','Сервер не подтвердил данные спорта.');return{state:clone(value.state),catalog:clone(value.catalog),startedOn:value.startedOn??null,serverUpdatedAt:typeof value.updatedAt==='string'?value.updatedAt:null};};

/** Native path-patch transport; session/revision/receipt remain one durable device envelope. */
export async function createSportServerAdapter({source,storage=localStorage,locks=navigator.locks,writable=()=>true,now=()=>Date.now()}){
 const supplied=source?.owner;
 if(!record(supplied)||!/^[a-f0-9]{64}$/.test(supplied.scope)||!['string','number'].includes(typeof supplied.epoch)||!String(supplied.epoch)||typeof supplied.epoch==='number'&&!Number.isFinite(supplied.epoch)||typeof source.isCurrent!=='function'||typeof source.request!=='function'||typeof source.subscribe!=='function')throw failure('stale','Для спорта нужен подтверждённый владелец Flow.');
 const lease=Object.freeze({scope:supplied.scope,epoch:supplied.epoch}),key='flow.sport.bound.owner.v1:'+lease.scope;
 let stopped=false,releaseLock=null,unsubscribe=null,value=null,serial=Promise.resolve();
 const current=captured=>!stopped&&source.isCurrent(supplied)&&captured?.scope===lease.scope&&captured?.epoch===lease.epoch;
 const assert=()=>{if(!current(lease))throw failure('stale','Владелец тренировки изменился.');};
 const dispose=()=>{stopped=true;unsubscribe?.();unsubscribe=null;releaseLock?.();releaseLock=null;};
 const store=next=>{assert();const body=JSON.stringify(next);if(body.length>8_000_000)throw failure('quota','Не хватает места для сохранения тренировки.');storage.setItem(key,body);value=next;};
 const queued=fn=>{const job=serial.then(fn);serial=job.catch(()=>{});return job;};
 const read=()=>{assert();return{...clone(value),pending:value.pending?1:0,sync:{state:value.pending?'error':'ready',pending:value.pending?1:0,...(value.pending?{error:'Есть неподтверждённое действие. Нажми обновление, чтобы повторить.'}:{})}};};
 function cached(){const raw=storage.getItem(key);if(raw===null)return null;let item;try{if(raw.length>8_000_000)throw Error();item=JSON.parse(raw);}catch{throw failure('not_ready','Сохранённые данные спорта повреждены. Они не заменены.');}
  if(!record(item)||item.schema!==1||item.scope!==lease.scope||!Number.isSafeInteger(item.revision)||item.revision<0||!record(item.state)||!record(item.catalog)||!record(item.ledger)||item.session!==null&&!record(item.session)||item.pending!==null&&(!validPacket(item.pending)||item.pending.baseRevision!==item.revision||!Array.isArray(item.pendingBefore)||item.pendingBefore.length!==item.pending.changes.length||!item.pendingBefore.every(entry=>record(entry)&&typeof entry.present==='boolean')))throw failure('not_ready','Сохранённые данные спорта повреждены. Они не заменены.');
  for(const [id,entry]of Object.entries(item.ledger))if(!record(entry)||typeof entry.body!=='string'||!record(entry.ack)||!Number.isSafeInteger(entry.ack.revision)||entry.ack.revision<1||id.length>160)throw failure('not_ready','Подтверждение тренировки повреждено. Данные не заменены.');return item;
 }
 function settle(packet,canonical){const ack={revision:value.revision+1,pending:0},entries=Object.entries(value.ledger).slice(-127),next={...value,...canonical,revision:ack.revision,session:clone(packet.session),pending:null,pendingBefore:null,ledger:{...Object.fromEntries(entries),[packet.requestId]:{body:JSON.stringify(packet),ack}}};store(next);return ack;}
 async function transmit(packet){assert();if(writable()===false)throw failure('stale','Редактирование открыто в другой вкладке.');const answer=packet.changes.length?serverValue(await source.request('patch',{changes:clone(packet.changes)})):{state:value.state,catalog:value.catalog,startedOn:value.startedOn,serverUpdatedAt:value.serverUpdatedAt};assert();return settle(packet,answer);}
 async function recover(){assert();const canonical=serverValue(await source.request('load',{}));assert();if(value.pending){const packet=clone(value.pending);let complete=true;for(const [index,change]of packet.changes.entries()){const actual=atPath(canonical.state,change.path),target=change.remove?{present:false}:{present:true,value:change.value};if(equalValue(actual,target))continue;complete=false;if(!equalValue(actual,value.pendingBefore[index]))throw failure('stale','Эти данные уже изменились на сервере. Неподтверждённая правка сохранена; автоматическая замена остановлена.');}if(complete)return settle(packet,canonical);return transmit(packet);}store({...value,...canonical,revision:value.revision+1});return{revision:value.revision,pending:0};}
 try{
  if(!locks?.request)throw failure('not_ready','Не удалось защитить тренировку от записи в другой вкладке.');
  const acquired=await new Promise((resolve,reject)=>{void locks.request('flow-sport-writer:'+lease.scope,{mode:'exclusive',ifAvailable:true},lock=>{resolve(!!lock);return lock?new Promise(done=>{releaseLock=done;}):undefined;}).catch(reject);});
  if(!acquired)throw failure('stale','Тренировка уже открыта в другой вкладке.');assert();unsubscribe=source.subscribe(()=>{if(!source.isCurrent(supplied))dispose();});
  const previous=cached(),canonical=serverValue(await source.request('load',{}));assert();
  value={schema:1,scope:lease.scope,revision:previous?.revision??0,...canonical,session:previous?.session??null,settings:record(previous?.settings)?previous.settings:{warmup:true},planDays:[],pending:previous?.pending??null,pendingBefore:previous?.pendingBefore??null,ledger:previous?.ledger??{}};
  // Do not replay uncertain writes during load; the existing refresh action retries them explicitly.
  return{capture:()=>current(lease)?lease:null,current,now,uuid:()=>crypto.randomUUID(),read:captured=>{if(!current(captured))throw failure('stale','Владелец тренировки изменился.');return read();},
   commit:(captured,packet)=>queued(async()=>{if(!current(captured))throw failure('stale','Владелец тренировки изменился.');if(!validPacket(packet)||packet.session&&packet.session.owner!==lease.scope)throw failure('invalid','Некорректное действие тренировки.');const body=JSON.stringify(packet),previous=value.ledger[packet.requestId];if(previous){if(previous.body!==body)throw failure('invalid','Повторный запрос изменился.');return clone(previous.ack);}if(value.pending&&JSON.stringify(value.pending)!==body)throw failure('not_ready','Есть неподтверждённое действие. Нажми обновление, чтобы повторить.');if(value.revision!==packet.baseRevision)throw failure('stale','Тренировка изменилась. Повтори действие.');if(writable()===false)throw failure('stale','Редактирование открыто в другой вкладке.');
    if(value.pending)return recover();if(packet.changes.length)store({...value,pending:clone(packet),pendingBefore:packet.changes.map(change=>atPath(value.state,change.path))});return transmit(packet);
   }),
   refresh:()=>queued(recover),
   hasPending:()=>!!value.pending,dispose};
 }catch(error){dispose();throw error;}
}
let corePromise;
function loadCore(){return corePromise??=new Promise((resolve,reject)=>{if(window.SportCore)return resolve(window.SportCore);const script=document.createElement('script');script.src='/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/sport-core.js';script.onload=()=>window.SportCore?resolve(window.SportCore):reject(Error('Не загружен SportCore'));script.onerror=()=>reject(Error('Не удалось загрузить тренировки'));document.head.append(script);});}
export function sportOwner(api){
 let host=null,domain=null,unsubscribe=null,generation=0,loading=null,server=null,unsubscribeSource=null;
 const lease=api.realHost?null:Object.freeze({scope:location.origin+'/bound-sport',epoch:crypto.randomUUID()});
 let active=true;
 const current=captured=>active&&!!lease&&captured?.scope===lease.scope&&captured?.epoch===lease.epoch;
 async function initial(core){const fixture=await(await fetch('./sport-fixture.json')).json();return{revision:0,state:{checks:{},workouts:{}},catalog:fixture,startedOn:core.todayKey(),planDays:[],session:null,settings:{warmup:true},pending:0,ledger:{}};}
 async function render(){
  if(host?.isConnected&&domain)return;
  const token=++generation,element=host=document.createElement('flow-sport-workspace');let ownedAdapter=null,ownedSourceSubscription=null;api.screen.replaceChildren(element);
  loading=(async()=>{try{
   const core=await loadCore();core.setCalendarTimeZone('Europe/Moscow');
   let stable;
   if(api.realHost){const source=await api.realHost();if(token!==generation||!element.isConnected)return;const adapter=ownedAdapter=await createSportServerAdapter({source,writable:()=>api.writable?.()!==false});if(token!==generation||!element.isConnected){adapter.dispose();return;}server=adapter;stable=adapter;const settings=adapter.read(adapter.capture()).state.notificationSettings;core.setCalendarTimeZone(core.notificationSettings(settings).timeZone);unsubscribeSource=ownedSourceSubscription=source.subscribe(()=>{if(token===generation&&element.isConnected&&!adapter.capture())element.model=domain?.snapshot()||{profileId:'',ownerEpoch:'',sync:{state:'error',pending:0},error:'Владелец тренировки изменился.'};});}
   else{
   const seed=await initial(core);if(token!==generation||!element.isConnected)return;
   const read=()=>clone(api.getState().boundSport||seed);
   stable={capture:()=>lease,current,now:()=>Date.now(),uuid:()=>crypto.randomUUID(),read(captured){if(!current(captured))throw Object.assign(Error('Владелец тренировки изменился'),{code:'stale'});const value=read();return{...value,sync:{state:'ready',pending:value.pending||0}};},
    async commit(captured,packet){
     if(api.writable?.()===false)throw Object.assign(Error('Редактирование открыто в другой вкладке. Закрой её и перезагрузи эту страницу.'),{code:'stale'});
     if(!current(captured))throw Object.assign(Error('Владелец тренировки изменился'),{code:'stale'});
     const value=read(),body=JSON.stringify(packet),previous=value.ledger?.[packet.requestId];
     if(previous){if(previous.body!==body)throw Object.assign(Error('Повторный запрос изменился'),{code:'invalid'});return clone(previous.ack);}
     if(value.revision!==packet.baseRevision)throw Object.assign(Error('Тренировка изменилась. Повтори действие'),{code:'stale'});
     // One root storage write: native state, checkpoint, revision and idempotency ledger.
     const ack={revision:value.revision+1,pending:0};
     const next={...value,state:core.applyStateChanges(value.state,packet.changes),session:clone(packet.session),revision:ack.revision,pending:0,ledger:{...value.ledger,[packet.requestId]:{body,ack}}};
     if(await api.commit(state=>{if(!current(captured)||(state.boundSport?.revision??0)!==packet.baseRevision)throw Object.assign(Error('Данные изменились'),{code:'stale'});state.boundSport=next;})!==true)throw Object.assign(Error('Не удалось сохранить тренировку. Черновик остался здесь'),{name:'QuotaExceededError',code:'quota'});
     return ack;
    }};
   }
   const owner=domain=createSportOwner({core,host:stable});
   const update=model=>{if(token===generation&&element.isConnected)element.model=model;};update(owner.snapshot());unsubscribe=owner.subscribe(update);
   element.addEventListener('flow-sport-request',async event=>{event.preventDefault();const request=event.detail;if(token!==generation||!element.isConnected||owner!==domain)return;let ack;try{if(server&&request.intent?.kind==='refresh')await server.refresh();ack=await owner.dispatch(request);}catch(error){ack={ok:false,code:error.code||'not_ready',error:error.message||'Не удалось обновить тренировку.'};}if(token!==generation||!element.isConnected||owner!==domain)return;update(owner.snapshot());element.settle(request.requestId,ack);});
   api.compare('SP14',owner.snapshot());
  }catch(error){ownedAdapter?.dispose();ownedSourceSubscription?.();if(server===ownedAdapter)server=null;if(unsubscribeSource===ownedSourceSubscription)unsubscribeSource=null;if(token===generation&&element.isConnected){element.model={profileId:lease?.scope||'',ownerEpoch:lease?.epoch||'',sync:{state:'error',pending:0,error:error.message},error:error.message};}}
  })();await loading;
 }
 async function guard(){if(!host?.isConnected)return true;await loading;if(host.guard&&!await host.guard())return false;if(domain){const ack=await domain.suspend();if(!ack.ok){host.status?.(ack.error);return false;}if(!await domain.flush()&&!(server?.capture()&&!server.hasPending()))return false;}return true;}
 async function leave(){if(domain){const owner=domain;if(!await owner.dispose())return false;if(domain===owner)domain=null;}unsubscribe?.();unsubscribe=null;unsubscribeSource?.();unsubscribeSource=null;server?.dispose();server=null;generation++;return true;}
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&host?.isConnected)void domain?.suspend();});
 window.addEventListener('pagehide',()=>{void domain?.suspend();});
 return{render,guard,leave,get model(){return domain?.snapshot()||null;}};
}
