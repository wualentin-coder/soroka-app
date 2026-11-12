import {FlowControl} from './control-base.js';
import {icon} from './components.js';
import {motionDisabled,trackMotion} from './feedback.js';

const sheet=new CSSStyleSheet();sheet.replaceSync(`
:host{display:block;min-width:0}.group{position:relative;isolation:isolate;border:1px solid var(--fu-line);border-radius:var(--fu-radius);background:var(--fu-surface);padding:8px;min-width:0}.heading{position:relative;isolation:isolate;display:flex;gap:4px;align-items:center;min-height:44px;padding-bottom:8px}.heading::after{content:'';position:absolute;inset:auto 4px 0;height:1px;background:linear-gradient(90deg,var(--fu-line),color-mix(in srgb,var(--fu-accent) 65%,var(--fu-line)) 52%,var(--fu-line));opacity:.75;pointer-events:none}.parent{display:grid;place-items:center;width:44px;height:44px;flex:none;padding:11px;border:0;border-radius:10px;background:none;user-select:none}.box{display:grid;place-items:center;width:22px;height:22px;border:1px solid var(--fu-muted);border-radius:7px}.box svg{width:16px;height:16px}.parent[aria-checked=true] .box{border-color:var(--fu-accent);background:var(--fu-accent);color:var(--fu-on)}.parent[aria-checked=mixed] .box{border-color:var(--fu-accent);color:var(--fu-accent);background:color-mix(in srgb,var(--fu-accent) 8%,transparent)}.disclosure{display:flex;align-items:center;gap:10px;min-height:44px;min-width:0;flex:1;border:0;border-radius:10px;padding:6px 8px 6px 0;background:none;text-align:left;user-select:none;-webkit-touch-callout:none}.title{font-weight:550;font-size:15px;line-height:1.5;min-width:0;flex:1;overflow-wrap:anywhere}.count{font-size:12px;color:var(--fu-muted);font-variant-numeric:tabular-nums;white-space:nowrap}.chevron{width:18px;height:18px;flex:none;color:var(--fu-muted);transition:transform 340ms var(--fu-ease)}.disclosure[aria-expanded=true] .chevron{transform:rotate(180deg)}.children{position:relative;overflow:clip;margin:0 0 2px 22px;padding-left:16px;min-width:0}
.children::before{content:'';position:absolute;left:0;top:10px;bottom:10px;width:2px;border-radius:999px;background:linear-gradient(180deg,transparent,color-mix(in srgb,var(--fu-accent) 26%,var(--fu-line)) 18%,var(--fu-line) 78%,transparent);opacity:.65;pointer-events:none}
.rows{display:block;min-width:0}.status{margin:8px 8px 4px;font-size:12px;color:var(--fu-muted);overflow-wrap:anywhere}.group[data-state=error]{border-color:var(--fu-danger)}.group[data-state=error] .status{color:var(--fu-danger)}.group[data-state=offline]{border-style:dashed}.parent:active:not(:disabled){transform:scale(.96);transition:transform 140ms var(--fu-ease)}
`);
const messages={loading:'Обновляется…',error:'Не удалось сохранить отметку.',offline:'Нет связи. Отметки недоступны.'};

export class FlowCheckGroup extends FlowControl{
 static observedAttributes=['title','group-id','open','ordered','state','disabled'];
 constructor(){super();this.shadowRoot.adoptedStyleSheets=[...this.shadowRoot.adoptedStyleSheets,sheet];this._rows=[];}
 feedbackTarget(event){const header=this.shadowRoot.querySelector('.heading');return event?.composedPath().includes(header)?this.shadowRoot.querySelector('.group'):null;}
 connectedCallback(){
  if(!this.shadowRoot.firstChild){
   this.shadowRoot.innerHTML=`<section class="group"><header class="heading"><button type="button" class="parent" role="checkbox"><span class="box" aria-hidden="true"></span></button><button type="button" class="disclosure" aria-controls="subitems"><span class="title"></span><span class="count"></span><svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button></header><div class="children" id="subitems"><div class="rows"></div></div><p class="status" role="status" aria-live="polite" hidden></p></section>`;
   this.shadowRoot.querySelector('.disclosure').onclick=()=>{this.toggleAttribute('open');this.emit('flow-group-toggle',{groupId:this.getAttribute('group-id')||'',open:this.hasAttribute('open')});};
   this.shadowRoot.querySelector('.parent').onclick=()=>{if(this.blocked())return;const next=!this._rows.every(row=>row.hasAttribute('done'));for(const row of this._rows)row.toggleAttribute('done',next);this._stack?.reorder();this.update();this.emitChange(null);};
   this.shadowRoot.addEventListener('flow-row-change',event=>{const row=event.composedPath().find(node=>this._rows.includes(node));if(!row)return;this.update();this.emitChange(row.getAttribute('item-id')||'');});
   this.shadowRoot.addEventListener('flow-row-open',event=>{const row=event.composedPath().find(node=>this._rows.includes(node));if(row)this.emit('flow-group-item-open',{groupId:this.getAttribute('group-id')||'',itemId:row.getAttribute('item-id')||''});});
  }
  this.collect();this.update();
  this._ownerObserver=new MutationObserver(()=>this.collect());this._ownerObserver.observe(this,{childList:true});
  this._rowObserver=new MutationObserver(()=>this.update());this._rowObserver.observe(this.shadowRoot.querySelector('.rows'),{subtree:true,attributes:true,attributeFilter:['done','title']});
 }
 disconnectedCallback(){this._ownerObserver?.disconnect();this._rowObserver?.disconnect();this._opening?.cancel();super.disconnectedCallback();}
 attributeChangedCallback(name,oldValue,newValue){if(!this.isConnected||!this.shadowRoot.firstChild||oldValue===newValue)return;this.update(name==='open');if(name==='open')this.animateOpen();}
 collect(){const added=[...this.children].filter(node=>node.matches('flow-line-row,flow-row'));if(!added.length&&this._stackMode===this.hasAttribute('ordered'))return;this._rows.push(...added);this.setContainer();this.update();}
 setContainer(){
  const ordered=this.hasAttribute('ordered');if(this._stackMode===ordered&&this._container){for(const row of this._rows)if(row.parentElement!==this._container)this._container.append(row);return;}
  this._container=document.createElement(ordered?'div':'flow-task-stack');if(!ordered)this._container.setAttribute('variant','lines');this._container.append(...(ordered?this._rows:[...this._rows].sort((a,b)=>Number(a.hasAttribute('done'))-Number(b.hasAttribute('done')))));this.shadowRoot.querySelector('.rows').replaceChildren(this._container);this._stack=ordered?null:this._container;this._stackMode=ordered;
 }
 blocked(){return this.hasAttribute('disabled')||['loading','offline','disabled'].includes(this.getAttribute('state'));}
 update(keepVisibility=false){
  if(!this.shadowRoot.firstChild)return;if(this._stackMode!==this.hasAttribute('ordered'))this.setContainer();
  const state=this.hasAttribute('disabled')?'disabled':this.getAttribute('state')||'rest',title=this.getAttribute('title')||'Список',total=this._rows.length,done=this._rows.filter(row=>row.hasAttribute('done')).length,checked=total>0&&done===total,parent=this.shadowRoot.querySelector('.parent'),expanded=this.hasAttribute('open');
  this.shadowRoot.querySelector('.group').dataset.state=state;this.shadowRoot.querySelector('.group').dataset.open=String(expanded);parent.setAttribute('aria-checked',checked?'true':done?'mixed':'false');parent.setAttribute('aria-label',`${checked?'Вернуть всё':'Выполнить всё'}: ${title}`);parent.disabled=!total||this.blocked();parent.querySelector('.box').innerHTML=checked?icon('check'):done?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 12h12"/></svg>':'';
  this.shadowRoot.querySelector('.title').textContent=title;this.shadowRoot.querySelector('.count').textContent=`${done} / ${total}`;this.shadowRoot.querySelector('.count').setAttribute('aria-label',`Выполнено ${done} из ${total}`);this.shadowRoot.querySelector('.disclosure').setAttribute('aria-expanded',String(expanded));if(!keepVisibility&&!this._opening)this.shadowRoot.querySelector('.children').hidden=!expanded;
  const status=this.shadowRoot.querySelector('.status');status.textContent=messages[state]||'';status.hidden=!messages[state];const rowState=this.blocked()?'disabled':'rest';for(const row of this._rows)if(row.getAttribute('state')!==rowState)row.setAttribute('state',rowState);
 }
 animateOpen(){
  const children=this.shadowRoot.querySelector('.children'),open=this.hasAttribute('open'),style=getComputedStyle(children),start={height:(children.hidden?0:children.getBoundingClientRect().height)+'px',opacity:children.hidden?0:style.opacity,marginTop:children.hidden?'0px':style.marginTop,marginBottom:children.hidden?'0px':style.marginBottom};
  this._opening?.cancel();this._opening=null;
  if(!open&&children.contains(this.shadowRoot.activeElement))this.shadowRoot.querySelector('.disclosure').focus({preventScroll:true});
  if(motionDisabled()){children.hidden=!open;return;}
  children.hidden=false;const end={height:open?children.scrollHeight+'px':'0px',opacity:open?1:0,marginTop:'0px',marginBottom:open?'2px':'0px'};
  const animation=this._opening=trackMotion(children.animate([start,end],{duration:420,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'}));
  animation.finished.catch(()=>{}).then(()=>{if(this._opening!==animation)return;children.hidden=!this.hasAttribute('open');this._opening=null;animation.cancel();});
 }
 get items(){return this._rows.map(row=>({id:row.getAttribute('item-id')||'',title:row.getAttribute('title')||'',done:row.hasAttribute('done')}));}
 emitChange(changedId){const items=this.items,done=items.filter(item=>item.done).length;this.emit('flow-group-change',{groupId:this.getAttribute('group-id')||'',changedId,items,done,total:items.length,checked:items.length>0&&done===items.length,mixed:done>0&&done<items.length,ordered:this.hasAttribute('ordered')});}
}
if(!customElements.get('flow-check-group'))customElements.define('flow-check-group',FlowCheckGroup);
