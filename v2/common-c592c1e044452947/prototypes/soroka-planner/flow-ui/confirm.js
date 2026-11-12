import{dialogHeader,dialogHeaderSheet}from'./dialog-header.js';
import{motionDisabled,trackMotion,pulseFeedback}from'./feedback.js';
import{FlowControl,observeOwners}from'./control-base.js';
import'./components.js';
const style=new CSSStyleSheet();style.replaceSync('dialog{width:min(390px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;border:1px solid var(--fu-line);border-radius:var(--fu-radius);padding:24px;background:var(--fu-surface);color:var(--fu-text);box-shadow:0 20px 60px #0005}dialog::backdrop{background:#080b1099;backdrop-filter:blur(5px)}h2{font:600 26px/1.2 var(--fu-font);margin:0 0 14px}p{font-size:14px;color:var(--fu-muted);margin:0 0 22px}.status{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;margin:0}.status:empty{min-height:0;margin:0}:host([trigger-hidden]) [data-open],:host([trigger-hidden]) .status{display:none}:host([purpose=discard]) dialog{padding:20px}');
const copies={delete:{trigger:'Удалить запись',title:'Удалить запись?',description:'Выбранная запись исчезнет из списка.',cancel:'Отмена',confirm:'Удалить',icon:'trash',confirmed:'Удаление подтверждено в образце'},discard:{trigger:'Закрыть без сохранения',title:'Закрыть без сохранения?',description:'Введённые изменения будут потеряны.',cancel:'Продолжить',confirm:'Не сохранять',icon:'close',confirmed:'Отказ от сохранения подтверждён в образце'}};
export class FlowConfirm extends FlowControl{
 static observedAttributes=['disabled','purpose'];
 constructor(){super();this.shadowRoot.adoptedStyleSheets=[...this.shadowRoot.adoptedStyleSheets,style,dialogHeaderSheet];this._generation=0;}
 get purpose(){return ['discard','command'].includes(this.getAttribute('purpose'))?this.getAttribute('purpose'):'delete';}
 set command(value){if(this._active)this.close('cancel',true);this._command=value&&['title','description','confirm'].every(key=>typeof value[key]==='string'&&value[key].trim())?Object.freeze({trigger:value.confirm,title:value.title,description:value.description,cancel:value.cancel||'Отмена',confirm:value.confirm,icon:'check',confirmed:'Действие подтверждено'}):null;if(this._dialog)this.sync();}
 get copy(){return this.purpose==='command'?this._command:copies[this.purpose];}
 connectedCallback(){
  if(!this._dialog){
   this.shadowRoot.innerHTML=`<flow-button variant="danger" stretch data-open></flow-button><p class="status" aria-live="polite"></p><dialog aria-labelledby="title" aria-describedby="description">${dialogHeader('Удалить запись?','title')}<p id="description"></p><flow-actions class="actions"><flow-button stretch data-cancel></flow-button><flow-button variant="danger" stretch data-confirm></flow-button></flow-actions></dialog>`;
   this._dialog=this.shadowRoot.querySelector('dialog');this._trigger=this.shadowRoot.querySelector('[data-open]');this._trigger.onclick=()=>this.open();this.shadowRoot.querySelector('.dialog-close').onclick=()=>this.close('cancel');this.shadowRoot.querySelector('[data-cancel]').onclick=()=>this.close('cancel');this.shadowRoot.querySelector('[data-confirm]').onclick=()=>this.close('confirm');
   this._dialog.addEventListener('close',()=>{if(this._active&&!this._dialog.open)this.finish(this._dialog.returnValue==='confirm'?'confirm':'cancel',this._active.id);});
   this._dialog.addEventListener('cancel',event=>{event.preventDefault();this.close('cancel');});
   this._dialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const controls=[this.shadowRoot.querySelector('.dialog-close'),...['[data-cancel]','[data-confirm]'].map(selector=>this.shadowRoot.querySelector(selector).shadowRoot.querySelector('button'))].filter(control=>control&&!control.disabled&&control.getClientRects().length);let active=this.shadowRoot.activeElement;while(active?.shadowRoot?.activeElement)active=active.shadowRoot.activeElement;const index=controls.indexOf(active);if(index<0||!event.shiftKey&&index===controls.length-1||event.shiftKey&&index===0){event.preventDefault();controls[event.shiftKey?controls.length-1:0]?.focus();}});
   this._dialog.onclick=event=>{const rect=this._dialog.getBoundingClientRect();if(event.target===this._dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))this.close('cancel');};
  }
  this.sync();
 }
 attributeChangedCallback(name,oldValue,newValue){if(!this._dialog)return;if(name==='purpose'&&oldValue!==newValue&&this._active)this.close('cancel',true);this.sync();}
 sync(){const copy=this.copy;if(!copy)return;this.shadowRoot.querySelector('.dialog-close').hidden=this.purpose!=='delete';this._trigger.setAttribute('label',copy.trigger);this._trigger.setAttribute('icon',copy.icon);this._trigger.toggleAttribute('disabled',this.hasAttribute('disabled'));this.shadowRoot.querySelector('#title').textContent=copy.title;this.shadowRoot.querySelector('#description').textContent=copy.description;this.shadowRoot.querySelector('[data-cancel]').setAttribute('label',copy.cancel);this.shadowRoot.querySelector('[data-confirm]').setAttribute('label',copy.confirm);if(this.hasAttribute('disabled')&&this._active)this.close('cancel',true);}
 open(){
  if(!this.isConnected||!this._dialog||this.hasAttribute('disabled')||!this.copy)return null;
  if(this._active&&this._dialog.open&&!this._closing)return this._active.id;
  if(this._active)this.finish('cancel',this._active.id);
  const active=this._active={id:++this._generation,purpose:this.purpose,copy:this.copy};this._closing=false;this._dialog.returnValue='cancel';this.shadowRoot.querySelector('.status').textContent='';this._dialog.showModal();this._motion=this.animateDialog([{opacity:0,transform:'translateY(10px) scale(.98)'},{opacity:1,transform:'none'}],480);this._unwatch=observeOwners(this,()=>{if(this._active?.id===active.id)this.close('cancel',true);});this.shadowRoot.querySelector('[data-cancel]').shadowRoot.querySelector('button').focus({preventScroll:true});return active.id;
 }
 animateDialog(frames,limit){if(motionDisabled())return null;const duration=Math.min(limit,parseFloat(getComputedStyle(this).getPropertyValue('--fu-time'))||0);return duration?trackMotion(this._dialog.animate(frames,{duration,easing:'cubic-bezier(.22,.75,.2,1)'})):null;}
 finish(result,session){
  const active=this._active;if(!active||active.id!==session)return;this._active=null;this._unwatch?.();this._unwatch=null;this._motion?.cancel();this._motion=null;this._closing=false;if(this._dialog.open)this._dialog.close(result);const confirmed=result==='confirm';this.shadowRoot.querySelector('.status').textContent=confirmed?active.copy.confirmed:'Действие отменено';if(this.isConnected&&!this.hasAttribute('trigger-hidden')){const button=this._trigger.shadowRoot.querySelector('button');button.focus({preventScroll:true});pulseFeedback(this._trigger,button,{tone:confirmed?'action':'cancel'});}this.emit('flow-confirm-result',{confirmed,purpose:active.purpose,kind:active.purpose,session:active.id});
 }
 async close(result,immediate=false){
  const active=this._active;if(!active)return;result=result==='confirm'?'confirm':'cancel';if(immediate){this.finish(result,active.id);return;}if(this._closing)return;this._closing=true;const css=getComputedStyle(this._dialog),start={opacity:css.opacity,transform:css.transform};this._motion?.cancel();const animation=this._motion=this.animateDialog([start,{opacity:0,transform:'translateY(8px) scale(.98)'}],340);if(animation)await animation.finished.catch(()=>{});if(this._active?.id!==active.id||this._motion!==animation)return;this.finish(result,active.id);
 }
 disconnectedCallback(){if(this._active)this.finish('cancel',this._active.id);this._unwatch?.();this._unwatch=null;this._motion?.cancel();this._motion=null;super.disconnectedCallback();}
}
if(!customElements.get('flow-confirm'))customElements.define('flow-confirm',FlowConfirm);
