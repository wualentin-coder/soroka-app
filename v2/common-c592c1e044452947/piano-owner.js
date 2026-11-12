import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/piano-workspace.js';
const clone=value=>structuredClone(value??{}),object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const empty=()=>({profileId:'bound-piano',progress:{},revision:0,storage:{},compositions:[]});
const requireValue=(condition,message)=>{if(!condition)throw new Error(message)};
let stateModule;
const stateTools=()=>stateModule??=import('/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/piano/state.mjs?v=1458d8543105');
function storageSnapshot(value){requireValue(object(value),'Неверное локальное хранилище пианино.');requireValue(Object.keys(value).length<=128&&Object.entries(value).every(([key,item])=>key.length<=240&&typeof item==='string'),'Неверная запись локального хранилища.');requireValue(new TextEncoder().encode(JSON.stringify(value)).length<=8*1024*1024,'Хранилище пианино превышает 8 МБ.');return clone(value);}
function compositionSnapshot(value){
 requireValue(object(value)&&typeof value.id==='string'&&/^[-A-Za-z0-9._]{1,80}$/.test(value.id)&&typeof value.title==='string'&&value.title.trim()&&value.title.length<=120,'Проверь название и идентификатор композиции.');
 requireValue(new TextEncoder().encode(JSON.stringify(value)).length<=2*1024*1024,'Композиция превышает 2 МБ.');requireValue(Number.isFinite(value.tempo)&&value.tempo>0&&Array.isArray(value.tracks)&&value.tracks.length>0&&value.tracks.length<=64,'Неверные дорожки композиции.');let count=0;const ids=new Set();
 for(const track of value.tracks){requireValue(object(track)&&typeof track.id==='string'&&track.id.length>0&&!ids.has(track.id)&&Array.isArray(track.notes),'Неверная дорожка композиции.');ids.add(track.id);let previous=-Infinity;for(const note of track.notes){count++;requireValue(object(note)&&Number.isInteger(note.midi)&&note.midi>=0&&note.midi<=127&&Number.isFinite(note.time)&&note.time>=0&&note.time>=previous&&Number.isFinite(note.duration)&&note.duration>0&&note.time+note.duration<=3600,'Неверная нота композиции.');previous=note.time;}}
 requireValue(count>0&&count<=5000&&value.tracks.some(track=>track.id===value.defaultTrack&&track.notes.length),'В композиции нет доступной партии.');return clone(value);
}
const metadata=composition=>({id:composition.id,title:composition.title,author:composition.author||'',source:composition.source||'midi',private:true});
/** Local synthetic owner. Mutation ACK follows the root's successful durable commit. */
export function pianoOwner(api){
 let host=null,generation=0,guardFlight=null,unsubscribe=null,observer=null,activeHost=null,realState=null;
 const realMode=api.realHost!==undefined;
 const blankReal=(status='starting',error='')=>({profileId:null,progress:{},revision:null,storage:{},compositions:[],status,error});
 if(realMode)realState=blankReal();
 const model=()=>realMode?clone(realState):({...empty(),...clone(api.getState().boundPiano)});
 const stopLease=()=>{try{unsubscribe?.();}catch{}unsubscribe=null;observer?.disconnect();observer=null;activeHost=null;};
 const cacheKeys=profile=>{const key=`flow-piano-profile:${profile}`;return[key,key+':player',key+':player:intro-voice',key+':player:practice-v2','flow-piano-active-profile'];};
 const cacheStore=()=>api.storage||globalThis.localStorage;
 function cacheRead(profile){const entries={'flow-piano-active-profile':profile};try{const store=cacheStore();for(const key of cacheKeys(profile).slice(0,-1)){const value=store.getItem(key);if(value!==null)entries[key]=value;}}catch{api.notice?.('Не удалось прочитать кэш пианино на устройстве. Серверный прогресс доступен.');}return storageSnapshot(entries);}
 function cacheWrite(profile,value){const entries=storageSnapshot(value),keys=cacheKeys(profile);requireValue(Object.keys(entries).every(key=>keys.includes(key))&&(!Object.hasOwn(entries,'flow-piano-active-profile')||entries['flow-piano-active-profile']===profile),'Кэш относится к другому профилю пианино.');entries['flow-piano-active-profile']=profile;const store=cacheStore(),previous=new Map(keys.map(key=>[key,store.getItem(key)]));try{for(const key of keys){if(Object.hasOwn(entries,key))store.setItem(key,entries[key]);else store.removeItem(key);}requireValue(keys.every(key=>store.getItem(key)===(entries[key]??null)),'Кэш не подтвердил запись.');}catch(error){for(const[key,old]of previous)try{old===null?store.removeItem(key):store.setItem(key,old);}catch{}throw Error('Не удалось сохранить кэш пианино на устройстве. Изменения остались здесь.');}return entries;}
 function progressAnswer(answer,profile=null){requireValue(object(answer)&&/^piano-[a-f0-9]{24}$/.test(answer.profileId)&&(!profile||answer.profileId===profile)&&Number.isSafeInteger(answer.revision)&&answer.revision>=0&&object(answer.progress),'Сервер не подтвердил профиль и прогресс пианино.');return clone(answer);}
 function catalogAnswer(answer){requireValue(object(answer)&&Array.isArray(answer.compositions)&&answer.compositions.length<=100&&answer.compositions.every(item=>object(item)&&typeof item.id==='string'&&typeof item.title==='string'),'Сервер не подтвердил каталог пианино.');return clone(answer);}
 function status(message,retry=false){const node=document.createElement('p');node.setAttribute('role','status');node.textContent=message;if(retry){const button=document.createElement('flow-button');button.setAttribute('label','Повторить');button.addEventListener('click',()=>render());node.append(button);}return node;}
 async function guard(){if(!host?.isConnected)return true;if(guardFlight)return guardFlight;const current=host,token=generation,flight=(async()=>{const ok=await current.flush();if(current!==host||token!==generation||!current.isConnected)return false;if(!ok){api.notice?.('Прогресс пианино ещё не сохранён. Повтори сохранение.');api.frame?.respond?.('cancel');}return ok;})().finally(()=>{if(guardFlight===flight)guardFlight=null});guardFlight=flight;return flight;}
 async function renderReal(){stopLease();guardFlight=null;const token=++generation,ownerEpoch=api.ownerEpoch?.(),loading=status('Загружаем пианино…');host=null;realState=blankReal();api.screen.replaceChildren(loading);
  let captured,current=null;const valid=()=>{try{return token===generation&&api.ownerEpoch?.()===ownerEpoch&&captured===activeHost&&captured?.isCurrent()===true&&(current?current===host&&current.isConnected:loading.isConnected);}catch{return false;}};
  observer=new MutationObserver(()=>{if(token===generation&&!(current?current.isConnected:loading.isConnected)){generation++;stopLease();host=null;realState=blankReal('inactive');}});observer.observe(api.screen,{childList:true,subtree:true});
  try{
   captured=await (typeof api.realHost==='function'?api.realHost():api.realHost);if(token!==generation||!loading.isConnected||api.ownerEpoch?.()!==ownerEpoch)return null;
   requireValue(captured&&captured.owner&&typeof captured.isCurrent==='function'&&captured.isCurrent()===true&&typeof captured.request==='function','Подключение пианино не подтверждено.');activeHost=captured;
   const invalidate=()=>{if(token!==generation)return;const visible=current?current===host&&current.isConnected:loading.isConnected;generation++;stopLease();realState=blankReal('blocked','Подключение пианино изменилось. Открой раздел заново.');if(visible){host=null;api.screen.replaceChildren(status(realState.error,true));}};
   if(typeof captured.subscribe==='function')unsubscribe=captured.subscribe(invalidate);if(!valid())return null;
   const progress=progressAnswer(await captured.request('progress_load',{}));if(!valid())return null;
   const profile=progress.profileId,catalog=catalogAnswer(await captured.request('composition_list',{}));if(!valid())return null;
   realState={...progress,storage:cacheRead(profile),compositions:catalog.compositions,status:'ready',error:''};
   current=host=document.createElement('flow-piano-workspace');current.model=model();const seen=new Set();let queue=Promise.resolve();
   current.addEventListener('flow-piano-navigate',event=>{if(valid())api.navigate?.(event.detail.route);});
   current.addEventListener('flow-piano-request',event=>{event.preventDefault();const request=clone(event.detail);if(seen.has(request.requestId))return;seen.add(request.requestId);queue=queue.then(async()=>{
    if(!valid())return;const {requestId,op,args={}}=request;
    try{let data;
     if(op==='storage_save'){const storage=cacheWrite(profile,args.entries);if(!valid())return;realState.storage=storage;data={saved:true};}
     else if(op==='progress_load'){data=progressAnswer(await captured.request(op,{}),profile);if(!valid())return;Object.assign(realState,data);}
     else if(op==='progress_save'){
      requireValue(object(args.progress)&&Number.isSafeInteger(args.baseRevision)&&args.baseRevision>=0,'Неверный прогресс пианино.');
      // Native iframe storage has its own device-cache ACK. Never send it as
      // extra remote progress fields or use cache success as server success.
      data=progressAnswer(await captured.request(op,{progress:clone(args.progress),baseRevision:args.baseRevision}),profile);if(!valid())return;
      requireValue(data.revision===args.baseRevision+1,'Сервер не подтвердил новую версию прогресса.');Object.assign(realState,data);api.frame?.respond?.();
     }else if(op==='composition_list'){data=catalogAnswer(await captured.request(op,{}));if(!valid())return;realState.compositions=clone(data.compositions);}
     else if(op==='composition_get'){requireValue(typeof args.id==='string','Композиция не выбрана.');data=await captured.request(op,{id:args.id});if(!valid())return;requireValue(object(data)&&data.composition?.id===args.id,'Сервер не подтвердил композицию.');compositionSnapshot(data.composition);}
     else if(op==='composition_import'){const composition=compositionSnapshot(args.composition);data=await captured.request(op,{composition});if(!valid())return;requireValue(object(data)&&object(data.metadata)&&data.metadata.id===composition.id&&typeof data.metadata.title==='string','Сервер не подтвердил импорт MIDI.');realState.compositions=[...realState.compositions.filter(item=>item.id!==composition.id),clone(data.metadata)];api.frame?.respond?.();}
     else throw Error('Этот сервис пианино не подключён.');
     if(valid())current.settle(requestId,{ok:true,data:clone(data)});
    }catch(error){if(valid())current.settle(requestId,{ok:false,error:error.message||'Не удалось сохранить пианино.'});}
   }).catch(error=>{if(valid())api.notice?.(error.message)});});
   api.screen.replaceChildren(current);api.compare?.('PN08',model());return current;
  }catch(error){if(token!==generation||!loading.isConnected)return null;stopLease();host=null;realState=blankReal('blocked',error.message||'Не удалось загрузить пианино.');api.screen.replaceChildren(status(realState.error,true));return null;}
 }
 function render(){if(realMode)return renderReal();const initial=model(),token=++generation,current=host=document.createElement('flow-piano-workspace'),profile=initial.profileId,seen=new Set();let queue=Promise.resolve();current.model=initial;const valid=()=>host===current&&generation===token&&current.isConnected&&model().profileId===profile;
  current.addEventListener('flow-piano-navigate',event=>{if(valid())api.navigate?.(event.detail.route);});
  current.addEventListener('flow-piano-request',event=>{event.preventDefault();const request=clone(event.detail);if(seen.has(request.requestId))return;seen.add(request.requestId);queue=queue.then(async()=>{if(!valid())return;const{requestId,op,args={}}=request;try{let data,next=null;const previous=model();
    if(op==='progress_load')data={profileId:previous.profileId,revision:previous.revision,progress:clone(previous.progress)};
    else if(op==='composition_list')data={compositions:previous.compositions.map(metadata)};
    else if(op==='composition_get'){const composition=previous.compositions.find(item=>item.id===args.id);requireValue(composition,'Композиция не найдена в этом профиле.');data={composition:clone(composition)};}
    else if(op==='storage_save'){next={...previous,storage:storageSnapshot(args.entries)};data={saved:true};}
    else if(op==='composition_import'){const composition=compositionSnapshot(args.composition),items=previous.compositions.filter(item=>item.id!==composition.id);requireValue(items.length<8,'В локальной библиотеке уже 8 своих композиций.');next={...previous,compositions:[...items,composition]};data={metadata:metadata(composition)};}
    else if(op==='progress_save'){
     requireValue(object(args.progress),'Неверный прогресс пианино.');const tools=await stateTools();if(!valid())return;const fresh=model();requireValue(Number.isSafeInteger(args.baseRevision)&&args.baseRevision===fresh.revision,'Прогресс изменился. Загрузим свежую версию и повторим сохранение.');requireValue(Number.isSafeInteger(fresh.revision)&&fresh.revision<Number.MAX_SAFE_INTEGER,'Неверная версия прогресса.');
     const canonical=tools.toPianoProgress(tools.mergePianoState(fresh.progress,args.progress));next={...fresh,revision:fresh.revision+1,progress:{...clone(fresh.progress),...clone(args.progress),...canonical,preferences:{...clone(fresh.progress.preferences),...clone(args.progress.preferences),...canonical.preferences}},storage:args.storage?storageSnapshot(args.storage):fresh.storage};data={revision:next.revision};
    }else throw new Error('Этот сервис пианино не подключён.');
    if(!valid())return;if(next){if(await api.commit(state=>{if(!valid())throw Error('stale owner');state.boundPiano=next})!==true){current.settle(requestId,{ok:false,error:'Не удалось сохранить пианино. Изменения остались здесь.'});return;}if(!valid())return;api.frame?.respond?.();}
    current.settle(requestId,{ok:true,data});
   }catch(error){if(valid())current.settle(request.requestId,{ok:false,error:error.message||'Не удалось сохранить пианино.'});}}).catch(error=>{if(valid())api.notice?.(error.message)});
  });api.screen.replaceChildren(current);api.compare?.('PN08',initial);return current;
 }
 return{render,guard,get model(){return model();}};
}
