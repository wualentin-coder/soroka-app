import {readCustomerView} from '../../../../../prototypes/soroka-planner/flow-ui/customer-render-card.js';
import {createCustomerRenderReader,publicRenderTransport} from './reader.js';
const card=document.querySelector('flow-customer-render-card'),connection=document.querySelector('#connection'),retry=document.querySelector('#retry');
let reader=null;const base=document.querySelector('meta[name=flow-render-share-api]')?.content;
const labels={loading:'Получаем статус…',fresh:'',unavailable:'Статус пока недоступен.',closed:'Эта ссылка больше не открывает статус.',offline:'Нет связи. Проверим статус ещё раз.', 'rate-limited':'Обновления временно ограничены. Повторим чуть позже.'};
function openShare(){
 // A second fragment is a different share: clear old content/transport first.
 reader?.dispose();reader=null;card.model={availability:'unavailable'};retry.hidden=true;
 // Fragment is the share URL: retain it for Reload/history. It is never sent
 // in an HTTP URL/referrer and is not copied into local/session storage.
 let capability=location.hash.slice(1);
 try{const read=publicRenderTransport({apiBase:base,capability});capability='';
  reader=createCustomerRenderReader({read,decode:readCustomerView,onView:view=>card.model=view,onState:state=>{connection.textContent=labels[state]||'';retry.hidden=!['offline','unavailable'].includes(state);}});
  if(!document.hidden)reader.start();
 }catch{capability='';connection.textContent='Открой ссылку на рендер из сообщения ещё раз.';}
}
document.addEventListener('visibilitychange',()=>document.hidden?reader?.suspend():reader?.resume());
addEventListener('pagehide',()=>reader?.suspend());addEventListener('pageshow',()=>{if(!document.hidden)reader?.resume();});
addEventListener('hashchange',openShare);retry.onclick=()=>reader?.refresh();openShare();
