import {FlowControl} from './control-base.js';
import {icon} from './components.js';
import './actions.js';

const sheet=new CSSStyleSheet();sheet.replaceSync(`
:host{display:block;min-width:0}.content-state{position:relative;isolation:isolate;display:grid;grid-template-columns:24px minmax(0,1fr) 24px;align-items:center;gap:10px;padding:var(--fu-pad);border:1px solid var(--fu-line);border-radius:var(--fu-radius);background:var(--fu-surface)}.mark{color:var(--fu-muted);display:grid;place-items:center}.copy{text-align:center;min-width:0}.mark svg{width:22px;height:22px}h3{margin:0;font-size:15px;line-height:1.5;font-weight:550;overflow-wrap:anywhere}.description{margin:4px 0 0;font-size:13px;color:var(--fu-muted);overflow-wrap:anywhere}.description:empty{display:none}flow-actions{grid-column:1/-1;margin-top:4px}.content-state[data-state=error]{border-color:var(--fu-danger)}.content-state[data-state=error] .mark{color:var(--fu-danger)}.content-state[data-state=offline]{border-style:dashed}.skeleton{display:grid;gap:7px;margin-top:12px;max-width:260px}.skeleton span{height:5px;border-radius:4px;background:var(--fu-line)}.skeleton span:last-child{width:65%}
`);
const states={empty:{title:'Записей пока нет',description:'',icon:'note'},loading:{title:'Загружается…',description:'',icon:'note'},error:{title:'Не удалось загрузить',description:'Попробуй ещё раз.',icon:'close',action:'Повторить'},offline:{title:'Нет связи',description:'Записи появятся после подключения.',icon:'note',action:'Проверить связь'}};

export class FlowContentState extends FlowControl{
 static observedAttributes=['state','heading','description','action-label','disabled'];
 constructor(){super();this.shadowRoot.adoptedStyleSheets=[...this.shadowRoot.adoptedStyleSheets,sheet];}
 feedbackTarget(){return this.shadowRoot.querySelector('.content-state');}
 connectedCallback(){this.render();}
 attributeChangedCallback(){if(this.isConnected)this.render();}
 render(){
  if(!this.shadowRoot.firstChild)this.shadowRoot.innerHTML='<section class="content-state" role="status" aria-live="polite"><span class="mark" aria-hidden="true"></span><div class="copy"><h3></h3><p class="description"></p><div class="skeleton" aria-hidden="true" hidden><span></span><span></span></div></div></section>';
  const state=Object.hasOwn(states,this.getAttribute('state'))?this.getAttribute('state'):'empty',entry=states[state],surface=this.shadowRoot.querySelector('.content-state');
  surface.dataset.state=state;surface.setAttribute('aria-busy',String(state==='loading'));this.shadowRoot.querySelector('.mark').innerHTML=icon(entry.icon);this.shadowRoot.querySelector('h3').textContent=this.getAttribute('heading')||entry.title;this.shadowRoot.querySelector('.description').textContent=this.getAttribute('description')??entry.description;this.shadowRoot.querySelector('.skeleton').hidden=state!=='loading';
  let actions=surface.querySelector('flow-actions');if(!entry.action){actions?.remove();return;}
  if(!actions){actions=document.createElement('flow-actions');const button=document.createElement('flow-button');button.setAttribute('stretch','');button.onclick=()=>{if(!button.hasAttribute('disabled'))this.emit('flow-content-retry',{state:this.getAttribute('state')});};actions.append(button);surface.append(actions);}
  const button=actions.querySelector('flow-button');button.setAttribute('label',this.getAttribute('action-label')||entry.action);button.toggleAttribute('disabled',this.hasAttribute('disabled'));
 }
}
if(!customElements.get('flow-content-state'))customElements.define('flow-content-state',FlowContentState);
