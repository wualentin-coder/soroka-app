import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/connection-workspace.js';
const clone=value=>structuredClone(value),record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const copies={disable:{title:'Отключить ключ?',description:'Это устройство сразу потеряет подключение к VPN.',confirm:'Отключить'},delete:{title:'Удалить ключ?',description:'Подключение этого устройства перестанет работать. Для возврата потребуется новый ключ.',confirm:'Удалить'},restart:{title:'Перезапустить VPN?',description:'Подключения к VPN ненадолго прервутся.',confirm:'Перезапустить'},route:{title:'Изменить маршрут сервиса?',description:'Сервис переключится между VPN и прямым подключением. Обнови подписку в VPN-приложении после изменения.',confirm:'Изменить маршрут'},exceptions:{title:'Изменить исключения?',description:'Маршруты указанных сайтов изменятся. Приложения получат их после обновления подписки.',confirm:'Сохранить'},'restart-functions':{title:'Перезапустить функции Flow?',description:'Бот и приложение могут не отвечать несколько секунд.',confirm:'Перезапустить'},'restart-flow':{title:'Перезапустить Flow?',description:'База, файлы и функции будут перезапущены. Приложение может не отвечать около минуты; VPN продолжит работать.',confirm:'Перезапустить'},'reload-nginx':{title:'Перечитать настройки nginx?',description:'Сервер применит текущие настройки веб-службы.',confirm:'Применить'},'prune-images':{title:'Удалить старые образы?',description:'Неиспользуемые образы Docker будут удалены. Действующие контейнеры останутся.',confirm:'Удалить'}};
const serverActions=new Set(['restart-functions','restart-flow','reload-nginx','prune-images','backup']),clientName=/^[a-z0-9][a-z0-9-]{0,30}$/;
const cleanLinks=value=>Object.fromEntries(['main','reserve','subscription','qrImage'].filter(key=>typeof value?.[key]==='string'&&value[key].length<= (key==='qrImage'?1_000_000:65_536)).map(key=>[key,value[key]]));
export function connectionOwner(api){
 let host=null,kind='server',generation=0,snapshot=null,unsubscribe=null,pending=null;
 const model=()=>api.realHost?clone(snapshot||{kind}):({kind,...clone(api.getState().boundConnections?.[kind]||{})});
 function scrub(){if(!snapshot?.linksByClient)return;delete snapshot.linksByClient;if(host?.isConnected)host.model=model();}
 async function guard(){if(!host?.isConnected)return true;if(pending&&!['refresh','links'].includes(pending.action))return false;const current=host,token=generation,epoch=api.ownerEpoch?.();if(host.dirty&&!await api.confirm('discard',host))return false;if(current!==host||token!==generation||api.ownerEpoch?.()!==epoch)return false;host.closeWindows();scrub();return true;}
 async function render(next){if(!['server','vpn'].includes(next))throw Error('Unknown connection workspace');unsubscribe?.();unsubscribe=null;host?.closeWindows();pending=null;kind=next;snapshot=null;const current=host=document.createElement('flow-connection-workspace'),token=++generation,epoch=api.ownerEpoch?.();let captured=null,createName=null,createAttempted=false;
  const valid=()=>host===current&&current.isConnected&&generation===token&&api.ownerEpoch?.()===epoch&&(!captured||typeof captured.isCurrent==='function'&&captured.isCurrent(captured.owner));
  const done=(requestId,result)=>{if(valid())current.settle(requestId,result);};
  async function refresh(){const answer=await captured.request(kind==='server'?'server':'summary',{});if(!valid())throw Error('stale');if(!record(answer)||answer.error||answer.ok===false||!record(answer[kind==='server'?'host':'server']))throw Error('invalid_snapshot');const receivedAt=Date.now();snapshot={...clone(answer),kind,receivedAt,...(kind==='vpn'?{observedAt:answer.observedAt??answer.time??answer.updatedAt??receivedAt}:{})};delete snapshot.linksByClient;return model();}
  current.model=model();api.screen.replaceChildren(current);api.compare('L08',{kind});
  current.addEventListener('flow-connection-intent',async event=>{
   event.preventDefault();const detail=event.detail,{action,recordId='',requestId}=detail;if(!valid())return;
   if(!api.realHost){done(requestId,{ok:false,error:'Сервис не подключён к локальному просмотру. Команда не отправлена.'});return;}
   if(pending){done(requestId,{ok:false,error:'Дождись завершения текущего действия.'});return;}
   if(!captured){if(action==='refresh'){void render(next);return;}done(requestId,{ok:false,error:'Дождись подключения сервиса.'});return;}
   // Clipboard permission belongs to the original reveal/copy gesture, before any await.
   if(action==='copy'){const field=detail.args?.field,value=snapshot?.linksByClient?.[recordId]?.[field];if(!['main','reserve','subscription'].includes(field)||typeof value!=='string'||!value||!current._revealed||!current.fresh()){done(requestId,{ok:false,error:'Сначала явно открой актуальные ссылки.'});return;}try{await navigator.clipboard.writeText(value);done(requestId,{ok:true});}catch{done(requestId,{ok:false,error:'Не удалось скопировать. Выдели ссылку вручную.'});}return;}
   const job={action,host:current};pending=job;let accepted=false;
   try{
    if(action==='discard'){if(await api.confirm('discard',current)&&valid()){createName=null;createAttempted=false;done(requestId,{ok:true});}else done(requestId,{ok:false});return;}
    if(action==='refresh'){done(requestId,{ok:true,model:await refresh()});return;}
    if(!current.fresh())throw Error('stale_snapshot');
    if(action==='links'){
     if(kind!=='vpn'||!clientName.test(recordId)||!snapshot.clients?.some(client=>client.name===recordId))throw Error('missing_client');const answer=await captured.request('links',{name:recordId});if(!valid())return;if(!record(answer)||answer.error||answer.ok===false)throw Error('invalid_links');
     if(!current.shadowRoot.querySelector('dialog[open]')||current._detail!==recordId||current.hasOpenEditor){done(requestId,{ok:false});return;}const links=cleanLinks(answer);if(!Object.keys(links).length)throw Error('invalid_links');snapshot={...snapshot,linksByClient:{[recordId]:links}};done(requestId,{ok:true,model:model()});return;
    }
    let op,args,copy;
    if(kind==='server'){
     if(action==='save-settings'){op='server-settings';args=Object.fromEntries(Object.entries(detail.changes||{}).filter(([key,value])=>['ALERTS','MEM_ALERT_MB','DISK_ALERT_PCT','BACKUP_DAYS'].includes(key)&&typeof value==='number'&&Number.isFinite(value)));if(!Object.keys(args).length)throw Error('empty_settings');}
     else if(action==='backup'){op='server-action';args={op:'backup'};}
     else if(action==='server-action'&&serverActions.has(detail.args?.op)){op='server-action';args={op:detail.args.op};copy=copies[args.op];}
    }else{
     if(['disable','enable','delete','rename'].includes(action)){if(!clientName.test(recordId)||!snapshot.clients?.some(client=>client.name===recordId))throw Error('missing_client');op=action;args={name:recordId};if(action==='rename'){const title=String(detail.draft?.title||'').trim();if(!title||title.length>40)throw Error('invalid_title');args.title=title;}copy=copies[action];}
     else if(action==='create'){const title=String(detail.draft?.title||'').trim();if(!title||title.length>40)throw Error('invalid_title');createName??='flow-'+crypto.randomUUID().replaceAll('-','').slice(0,22);op='create';args={name:createName,title};if(createAttempted){await refresh();if(!valid())return;const existing=snapshot.clients?.find(client=>client.name===createName);if(existing){if(existing.title!==title)throw Error('create_conflict');createName=null;createAttempted=false;done(requestId,{ok:true,model:model()});return;}}}
     else if(action==='exceptions'){op='exceptions';args={direct:clone(detail.draft?.direct||[]),proxy:clone(detail.draft?.proxy||[])};if(![args.direct,args.proxy].every(list=>Array.isArray(list)&&list.length<=200&&list.every(domain=>typeof domain==='string'&&domain.length<=253&&/^(?:[a-z0-9а-яё](?:[a-z0-9а-яё-]*[a-z0-9а-яё])?\.)+[a-zа-яё]{2,63}$/i.test(domain)))||args.direct.some(domain=>args.proxy.includes(domain)))throw Error('invalid_domains');copy=copies.exceptions;}
     else if(action==='route'){const tag=detail.args?.tag,service=snapshot.services?.items?.find(item=>item.tag===tag);if(!service?.can_route||!/^s-[a-z]{2,20}$/.test(tag)||typeof detail.args.direct!=='boolean')throw Error('invalid_route');op='service-route';args={tag,direct:detail.args.direct};copy=copies.route;}
     else if(action==='restart'){op='restart';args={};copy=copies.restart;}
    }
    if(!op)throw Error('unsupported_action');
    if(copy){if(typeof api.confirmCommand!=='function')throw Error('confirmation_unavailable');if(!await api.confirmCommand(copy,current)){done(requestId,{ok:false});return;}if(!valid())return;}
    if(action==='create')createAttempted=true;
    const answer=await captured.request(op,args);if(!valid())return;if(!record(answer)||answer.error||answer.ok===false)throw Error('command_rejected');accepted=true;
    const updated=await refresh();if(!valid())return;if(action==='create'){if(!snapshot.clients?.some(client=>client.name===createName))throw Error('create_unconfirmed');createName=null;createAttempted=false;}done(requestId,{ok:true,model:updated});
   }catch(error){if(!valid())return;let message=error.message==='confirmation_unavailable'?'Подтверждение этой команды пока не подключено. Команда не отправлена.':error.message==='stale_snapshot'?'Состояние устарело. Сначала обнови снимок.':accepted?'Команда принята, но новое состояние пока не получено. Обнови снимок перед повтором.':'Сервис не подтвердил действие. Правки остались в форме.';if(action==='refresh'||accepted){snapshot={...(snapshot||{kind}),error:'Не удалось получить актуальное состояние.'};delete snapshot.linksByClient;}done(requestId,{ok:false,error:message,...(action==='refresh'||accepted?{model:model()}: {})});
   }finally{if(pending===job)pending=null;}
  });
  if(!api.realHost)return;
  const initialJob={action:'refresh',host:current};pending=initialJob;
  try{captured=await api.realHost();if(!valid())return;if(!record(captured?.owner)||!/^[a-f0-9]{64}$/.test(captured.owner.scope)||typeof captured.request!=='function'||typeof captured.isCurrent!=='function'||typeof captured.subscribe!=='function'||!captured.isCurrent(captured.owner))throw Error('owner_unavailable');unsubscribe=captured.subscribe(()=>{if(host!==current||generation!==token||captured.isCurrent(captured.owner))return;pending=null;current.closeWindows();snapshot={kind,error:'Владелец изменился. Открой Flow заново.'};current.model=model();});current.model=await refresh();}
  catch{if(host===current&&generation===token&&current.isConnected){snapshot={kind,error:'Не удалось подключить сервис. Нажми «Обновить», чтобы повторить.'};current.model=model();}}
  finally{if(pending===initialJob)pending=null;}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)scrub();});
 return{render,guard,get model(){const value=model();delete value.linksByClient;return value;}};
}
