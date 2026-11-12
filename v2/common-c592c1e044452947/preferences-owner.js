import {settingsPalette} from '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/settings-workspace.js';
import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/service-workspace.js';
const clone=value=>structuredClone(value);
export function preferencesOwner(api){
 let host=null,kind='',generation=0,timer=null,provider=null,service=null;const pending=new Map();
 function apply(){const s=api.getState().settings,root=document.documentElement,color=settingsPalette.find(row=>row[0]===s.accent)?.[2]||(/^#[0-9a-f]{6}$/i.test(s.accent)?s.accent:'#76a9ff');root.style.setProperty('--fu-accent',color);root.style.setProperty('--fu-radius',(s.radius??24)+'px');root.style.setProperty('--fu-glow',String((s.glow??8)/100));root.style.setProperty('--fu-pad',s.density==='compact'?'12px':s.density==='spacious'?'20px':'16px');const theme={dark:['#101317','#1a1e24'],midnight:['#080d17','#121c2c'],graphite:['#151616','#222424']}[s.theme]||['#101317','#1a1e24'];root.style.setProperty('--fu-bg',theme[0]);root.style.setProperty('--fu-surface',theme[1]);root.dataset.motion=s.motionMode||'on';root.dataset.reduce=String(s.motionMode==='off');root.dataset.sound=String(s.sound??false);root.dataset.haptics=String(s.haptics??false);root.dataset.ambient=String(s.ambient??false);root.dispatchEvent(new CustomEvent('flow-preferences-change',{bubbles:true}));}
 function model(){const state=api.getState();if(kind==='settings')return clone(state.settings);if(kind==='projects')return{kind,records:state.projects,tasks:state.tasks,materials:['files','posts','links'].flatMap(key=>state.saved[key]||[]),notes:state.notes,transactions:state.finance.transactions};return{kind,agent:false,on:false,...clone(api.realHost?service||{}:state.boundServices?.[kind]||{})};}
 const epoch=()=>api.ownerEpoch?.()??null;
 async function guard(){if(!host?.isConnected)return true;if(pending.has(host))return false;if(kind==='settings')return true;const current=host,token=generation;if(host.dirty&&!await api.confirm('discard',host))return false;if(token!==generation||current!==host)return false;host.closeWindows();return true;}
 function render(next){
  clearTimeout(timer);provider?.dispose();provider=null;service=null;kind=next;
  const current=host=document.createElement(kind==='settings'?'flow-settings-workspace':'flow-service-workspace'),token=++generation,owner=epoch(),renderKind=kind;
  current.model=model();const valid=()=>host===current&&current.isConnected&&generation===token&&epoch()===owner;
  const settle=(id,ok,error='',extra={})=>{if(valid()){current.settle(id,{ok,error,...extra});if(ok)api.frame.respond();}};
  async function run(id,work){
   if(!valid())return;if(pending.has(current)){settle(id,false,'Подожди завершения текущего действия.');return;}
   const job={};pending.set(current,job);current.inert=true;
   try{await work();}catch(error){settle(id,false,error?.message||'Изменение не подтверждено.');}
   finally{if(pending.get(current)===job){pending.delete(current);current.inert=false;}}
  }
  current.addEventListener('flow-settings-change',event=>{event.preventDefault();const{key,value,requestId}=event.detail;
   void run(requestId,async()=>{
    if(typeof key!=='string'||['__proto__','constructor','prototype'].includes(key))throw Error('Неизвестная настройка.');
    const ok=await api.commit(state=>{if(!valid())throw Error('Настройки уже закрыты.');state.settings[key]=clone(value);});
    if(!valid())return;if(ok!==true)throw Error('Настройка не сохранена.');
    if(!Object.hasOwn(api.getState().settings,key)||JSON.stringify(api.getState().settings[key])!==JSON.stringify(value))throw Error('Сервер не подтвердил настройку.');
    apply();current.model=model();settle(requestId,true,'',{value:clone(api.getState().settings[key])});api.compare('L03',current.model);
   });
  });
  current.addEventListener('flow-settings-intent',event=>{event.preventDefault();const d=event.detail;void run(d.requestId,async()=>{
   if(!api.settingsIntent)throw Error('Это действие ещё не подключено к устройству.');
   const ok=await api.settingsIntent(d.action,{isCurrent:valid});if(valid())settle(d.requestId,ok===true,ok===true?'':'Действие не подтверждено.');
  });});
  const identity=id=>api.resolveId?.(id)||id;let creation=null,loading=Promise.resolve();
  current.addEventListener('flow-service-intent',event=>{event.preventDefault();const d=event.detail;if(!valid())return;const form=current._base,surface=current._epoch,viewValid=()=>valid()&&current._epoch===surface&&(renderKind!=='projects'||current._base===form);
   if(renderKind==='projects'&&d.action==='record-open'){
    if(pending.has(current))return;
    void(async()=>{try{if(!api.projectIntent)throw Error('Это действие ещё не подключено.');const ok=await api.projectIntent(d,{isCurrent:viewValid});if(viewValid())settle(d.requestId,ok===true,ok===true?'':'Не удалось открыть запись.');}catch(error){if(viewValid())settle(d.requestId,false,error?.message||'Не удалось открыть запись.');}})();return;
   }
   void run(d.requestId,async()=>{
    if(['discard','delete-project'].includes(d.action)){
     const ok=await api.confirm(d.action==='discard'?'discard':'delete',current);if(!viewValid())return;
     if(!ok){settle(d.requestId,false);return;}if(d.action==='discard'){settle(d.requestId,true);return;}
    }
    if(renderKind!=='projects'){
     const copy={shutdown:{title:'Выключить компьютер?',description:'Текущая работа на компьютере будет прервана.',confirm:'Выключить'},sleep:{title:'Перевести компьютер в сон?',description:'Текущая работа приостановится.',confirm:'Усыпить'},'process-stop':{title:'Завершить процесс?',description:'Несохранённые изменения программы могут потеряться.',confirm:'Завершить'},cancel:{title:'Отменить рендер?',description:'Уже записанные кадры сохранятся.',confirm:'Отменить рендер'}}[d.action];
     if(copy){if(!api.confirmCommand)throw Error('Подтверждение действия не подключено.');if(!await api.confirmCommand(copy,current)){settle(d.requestId,false,'Отменено.');return;}if(!viewValid())return;}
     if(d.action==='screenshot'&&!api.serviceResult)throw Error('Просмотр снимка ещё не подключён.');
     await loading;if(!viewValid())return;let result=provider?await provider.intent(d):undefined;
     if(result===undefined&&api.serviceIntent)result=await api.serviceIntent(d,{isCurrent:viewValid});
     if(d.action==='screenshot'&&result?.ok===true){if(!viewValid())return;const shown=await api.serviceResult(d,result,{isCurrent:viewValid});if(!viewValid())return;if(shown!==true)throw Error('Снимок получен, но не открыт.');}
     if(!viewValid())return;const ok=result===true||result?.ok===true;if(!ok)throw Error(result?.error||'Действие не подтверждено.');current.model=model();settle(d.requestId,true);return;
    }
    if(!['save-project','delete-project'].includes(d.action)){
     if(!api.projectIntent)throw Error('Это действие ещё не подключено.');const ok=await api.projectIntent(d,{isCurrent:viewValid});if(viewValid())settle(d.requestId,ok===true,ok===true?'':'Действие не подтверждено.');return;
    }
    const id=d.recordId?identity(d.recordId):creation?.base===form?identity(creation.id):null,previous=api.getState().projects.find(item=>String(item.id)===String(id));
    if(d.recordId&&!previous)throw Error('Проект уже изменился. Черновик остался здесь.');
    if(d.action==='save-project'&&!d.draft?.name?.trim())throw Error('Добавь название проекта.');
    if(!previous&&d.action==='save-project'&&creation?.base!==form)creation={base:form,id:crypto.randomUUID()};
    const recordId=previous?.id||creation?.id;let deleted;
    const ok=await api.commit(state=>{
     if(!viewValid())throw Error('Проект уже закрыт.');
     const canonicalId=identity(recordId),at=state.projects.findIndex(item=>String(item.id)===String(canonicalId)),before=at<0?null:state.projects[at];
     if(d.action==='delete-project'){if(!before)throw Error('Проект больше не существует.');deleted={type:'project',record:clone(before),index:at};state.projects.splice(at,1);state.trash.push({...deleted,deleted:Date.now()});return;}
     const patch=d.recordId&&d.changes?d.changes:d.draft;
     const record={...clone(before||{}),...clone(patch),id:before?.id||canonicalId};
     if(typeof record.name!=='string'||!record.name.trim())throw Error('Добавь название проекта.');record.name=record.name.trim();
     if(state.projects.some(item=>String(item.id)!==String(record.id)&&item.name===record.name))throw Error('Проект с таким названием уже есть.');
     if(at<0)state.projects.push(record);else state.projects[at]=record;
     if(before?.name&&before.name!==record.name)for(const rows of [state.tasks,state.notes,state.events,state.finance.transactions,...Object.values(state.saved).filter(Array.isArray)])for(const row of rows||[])if(row.project===before.name)row.project=record.name;
    });
    if(!viewValid())return;if(ok!==true)throw Error('Правки не сохранены. Черновик остался здесь.');
    const accepted=api.getState().projects.find(item=>String(item.id)===String(identity(recordId)));
    if(d.action==='delete-project'?!!accepted:!accepted)throw Error('Сервер не подтвердил проект.');
    if(deleted){api.deleted(deleted);api.restore();}current.model=model();settle(d.requestId,true);api.compare('V01',current.model);
   });
  });
  api.screen.replaceChildren(current);api.restore();api.compare(kind==='settings'?'L03':'V01',current.model);
  if(api.realHost&&['computer','pc','render'].includes(kind)){
   const publish=value=>{if(valid()){service=clone(value);current.model=model();}};
   const poll=()=>{if(!valid())return;clearTimeout(timer);timer=setTimeout(async()=>{try{if(!document.hidden&&!pending.has(current))await provider.load();}catch{}finally{poll();}},15000);};
   loading=(async()=>{try{const{createPreferencesPcProvider}=await import('./preferences-pc-provider.js');if(!valid())return;provider=createPreferencesPcProvider({getHost:api.realHost,isCurrent:valid,publish});await provider.load();poll();}catch(error){if(valid()){publish({agent:false,on:null});const notice=current.shadowRoot?.querySelector('.notice');if(notice)notice.textContent=error.message;}}})();
   current.addEventListener('click',event=>{const node=event.composedPath().find(node=>node?.dataset?.action==='processes');if(node)void run('processes-read',async()=>{await loading;if(provider)await provider.intent({action:'processes'});});});
  }
  return current;
 }

 return{apply,render,guard,get model(){return model();}};
}
