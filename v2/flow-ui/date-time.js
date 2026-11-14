import {FlowControl,observeOwners} from './control-base.js?v=644cff7ac9';
import {motionDisabled,trackMotion} from './feedback.js?v=644cff7ac9';

const style=new CSSStyleSheet();style.replaceSync(`
.trigger{width:100%;min-height:46px;display:flex;align-items:center;gap:10px;text-align:left;padding:10px 12px;border:1px solid var(--fu-line);border-radius:12px;background:var(--fu-bg)}.trigger span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.trigger[data-empty] span{color:var(--fu-muted)}.trigger[aria-invalid=true]{border-color:var(--fu-danger)}button{user-select:none}svg{width:20px;height:20px;flex:none}
dialog{--picker-pad:22px;width:min(390px,calc(100vw - 8px));max-width:none;max-height:calc(100dvh - 16px);overflow:auto;overscroll-behavior:contain;padding:var(--picker-pad);border:1px solid var(--fu-line);border-radius:var(--fu-radius);background:var(--fu-surface);color:var(--fu-text);box-shadow:0 20px 60px #0005}dialog>.flow-response{inset:0}dialog::backdrop{background:#080b1099;backdrop-filter:blur(5px)}.dialog-header{margin-bottom:12px;padding-inline:4px}.month-nav{display:flex;align-items:center;justify-content:space-between;gap:4px}.month-nav button,.today{border-radius:12px;min-height:44px;border:0;background:none;padding:8px;color:var(--fu-accent)}.month-nav button{width:44px;display:grid;place-items:center}.month-title{font-weight:550;text-transform:capitalize;text-align:center}.calendar{margin-inline:calc(-1 * var(--picker-pad));margin-bottom:8px}.weekdays,.week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}.weekdays span{height:30px;display:grid;place-items:center;font-size:12px;color:var(--fu-muted)}.day{height:44px;width:100%;padding:0;border:0;background:transparent;border-radius:12px;font-variant-numeric:tabular-nums}.day.weekend{color:var(--fu-muted)}.day[aria-current=date]{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--fu-accent) 45%,transparent)}.day[aria-selected=true]{background:var(--fu-accent);color:var(--fu-on)}.day:focus-visible{outline-offset:-3px}.today{display:block;margin:2px auto 8px}.wheels{display:grid;grid-template-columns:1fr 20px 1fr;gap:6px;align-items:center;margin:10px 0 20px}.wheel-label{text-align:center;color:var(--fu-muted);font-size:12px;margin-bottom:4px}.wheel{height:220px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;scroll-snap-type:y mandatory;padding-block:88px;border-radius:14px;background:linear-gradient(to bottom,transparent 88px,color-mix(in srgb,var(--fu-accent) 11%,var(--fu-bg)) 88px,color-mix(in srgb,var(--fu-accent) 11%,var(--fu-bg)) 132px,transparent 132px);font-variant-numeric:tabular-nums}.wheel::-webkit-scrollbar{display:none}.wheel:focus-visible{outline:2px solid var(--fu-accent);outline-offset:2px}.wheel [role=option]{height:44px;scroll-snap-align:center;display:grid;place-items:center;font-size:24px;color:var(--fu-muted);cursor:pointer;user-select:none}.wheel [aria-selected=true]{color:var(--fu-accent);font-weight:550}.colon{font-size:24px;text-align:center;padding-top:20px}flow-actions{margin-top:12px}button:disabled{opacity:.45}@media(max-width:420px){dialog{--picker-pad:18px}}
`);
const pad=n=>String(n).padStart(2,'0'),iso=d=>`${String(d.getFullYear()).padStart(4,'0')}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const date=s=>new Date(`${s}T00:00:00`),today=()=>iso(new Date());
const icon=kind=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${kind==='time'?'<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>':'<path d="M5 5h14v15H5zM8 3v4m8-4v4M5 10h14"/>'}</svg>`;
const valid=(value,kind)=>kind==='time'?/^([01]\d|2[0-3]):[0-5]\d$/.test(value):/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='0001-01-01'&&value<='9999-12-31'&&Number.isFinite(+date(value))&&iso(date(value))===value;
export class FlowDateTime extends FlowControl{
 static formAssociated=true;
 static observedAttributes=['kind','value','name','required','disabled','aria-label','placeholder'];
 constructor(){super();this._internals=this.attachInternals();this._value='';this._dirty=false;this._disabled=false;this.shadowRoot.adoptedStyleSheets=[...this.shadowRoot.adoptedStyleSheets,style];}
 get kind(){return this.getAttribute('kind')==='time'?'time':'date';}
 get value(){return this._value;}
 set value(value){this._dirty=true;this._value=valid(String(value),this.kind)?String(value):'';this.sync();}
 get disabled(){return this.hasAttribute('disabled')||this._disabled;}
 set disabled(value){this.toggleAttribute('disabled',!!value);}
 get required(){return this.hasAttribute('required');}
 set required(value){this.toggleAttribute('required',!!value);}
 get name(){return this.getAttribute('name')||'';}
 set name(value){this.setAttribute('name',value);}
 get form(){return this._internals.form;}
 get validity(){return this._internals.validity;}
 get validationMessage(){return this._internals.validationMessage;}
 get willValidate(){return this._internals.willValidate;}
 checkValidity(){return this._internals.checkValidity();}
 reportValidity(){return this._internals.reportValidity();}
 connectedCallback(){
  if(!this._trigger){
   this.shadowRoot.innerHTML='<button type="button" class="trigger" aria-haspopup="dialog" aria-controls="picker" aria-expanded="false"><span></span></button><dialog id="picker"><div class="contents"></div></dialog>';
   this._trigger=this.shadowRoot.querySelector('.trigger');this.addEventListener('invalid',()=>{this._attempted=true;this.sync()});this._dialog=this.shadowRoot.querySelector('dialog');
   this._trigger.onclick=()=>this.open();
   this._dialog.addEventListener('cancel',event=>{event.preventDefault();this.close(false);});
   this._dialog.addEventListener('close',()=>{if(this._dialog.open)return;this._watch?.();this._motion?.cancel();this._closing=false;this._trigger.setAttribute('aria-expanded','false');if(this.isConnected&&!this.disabled)this._trigger.focus({preventScroll:true});});
   this._dialog.addEventListener('click',event=>{const r=this._dialog.getBoundingClientRect();if(event.target===this._dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))this.close(false);});
  }
  if(!this._dirty)this._value=valid(this.getAttribute('value')||'',this.kind)?this.getAttribute('value'):'';
  this.sync();
 }
 attributeChangedCallback(name){if(name==='kind'){this.close(false,true);this._value=valid(this._value,this.kind)?this._value:'';}if(name==='value'&&!this._dirty)this._value=valid(this.getAttribute('value')||'',this.kind)?this.getAttribute('value'):'';this.sync();}
 sync(){
  this._internals.setFormValue(this._value);
  this._internals.setValidity(this.required&&!this._value?{valueMissing:true}:{},this.required&&!this._value?'Выберите '+(this.kind==='time'?'время':'дату')+'.':'',this._trigger);
  if(!this._trigger)return;
  this._trigger.disabled=this.disabled;this._trigger.setAttribute('aria-label',this.getAttribute('aria-label')||(this.kind==='time'?'Время':'Дата'));this._trigger.toggleAttribute('data-empty',!this._value);this._trigger.setAttribute('aria-invalid',String(!!this._attempted&&!this.validity.valid));
  this._trigger.querySelector('span').textContent=this._value?(this.kind==='time'?this._value:new Intl.DateTimeFormat('ru',{day:'2-digit',month:'2-digit',year:'2-digit'}).format(date(this._value))):(this.getAttribute('placeholder')||(this.kind==='time'?'Время':'Дата'));
  this._trigger.title=this._value?(this.kind==='time'?this._value:new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',year:'numeric'}).format(date(this._value))):'';
  this._trigger.querySelector('svg')?.remove();this._trigger.insertAdjacentHTML('beforeend',icon(this.kind));
  if(this.disabled)this.close(false,true);
 }
 formDisabledCallback(disabled){this._disabled=disabled;this.sync();}
 formResetCallback(){this._dirty=false;this._attempted=false;this._value=valid(this.getAttribute('value')||'',this.kind)?this.getAttribute('value'):'';this.close(false,true);this.sync();}
 formStateRestoreCallback(value){this.value=value;this.close(false,true);}
 open(){
  if(this.disabled||this._dialog.open)return;
  this._draft=this._value||(this.kind==='date'?today():`${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`);
  this._dialog.setAttribute('aria-label',this.kind==='time'?'Выбрать время':'Выбрать дату');
  this._contents=this.shadowRoot.querySelector('.contents');this._contents.innerHTML='<div class="picker-body"></div><flow-actions><flow-button label="Отмена" stretch data-cancel></flow-button>'+(!this.required&&this._value?'<flow-button label="'+(this.kind==='time'?'Убрать время':'Убрать дату')+'" variant="icon" icon="trash" data-clear></flow-button>':'')+'<flow-button label="Сохранить" variant="primary" stretch data-save></flow-button></flow-actions>';
  this._contents.querySelector('[data-cancel]').onclick=()=>this.close(false);this._contents.querySelector('[data-save]').onclick=()=>this.close(true);this._contents.querySelector('[data-clear]')?.addEventListener('click',()=>{this._draft='';this.close(true)});
  if(this.kind==='date'){this._month=this._draft.slice(0,7);this.calendar();}else this.time();
  this._dialog.showModal();this._trigger.setAttribute('aria-expanded','true');this._watch=observeOwners(this,()=>this.close(false,true));
  if(!motionDisabled())this._motion=trackMotion(this._dialog.animate([{opacity:0,transform:'translateY(10px) scale(.98)'},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.22,.75,.2,1)'}));
  if(this.kind==='time'){this._contents.querySelectorAll('.wheel').forEach((wheel,index)=>this.positionWheel(wheel,Number(this._draft.split(':')[index])));this._contents.querySelector('.wheel').focus({preventScroll:true});}else this._contents.querySelector('.day[tabindex="0"]').focus({preventScroll:true});
 }
 async close(commit=false,immediate=false){
  if(!this._dialog?.open)return;
  if(immediate){this._motion?.cancel();this._motion=null;this._closing=false;this._watch?.();this._dialog.close(this._pendingResult||(commit?'save':'cancel'));this._pendingResult=null;return;}
  if(this._closing)return;this._closing=true;this._pendingResult=commit?'save':'cancel';
  if(commit){this._value=this._draft;this._dirty=true;this.sync();this.dispatchEvent(new Event('input',{bubbles:true,composed:true}));this.dispatchEvent(new Event('change',{bubbles:true,composed:true}));}
  const css=getComputedStyle(this._dialog),start={opacity:css.opacity,transform:css.transform};this._motion?.cancel();
  const animation=this._motion=motionDisabled()?null:trackMotion(this._dialog.animate([start,{opacity:0,transform:'translateY(8px) scale(.99)'}],{duration:220,easing:'cubic-bezier(.4,0,1,1)'}));
  if(animation)await animation.finished.catch(()=>{});if(this._motion!==animation)return;this._motion=null;this._watch?.();if(this._dialog.open)this._dialog.close(this._pendingResult);this._pendingResult=null;this._closing=false;
 }

 calendar(focus=false){
  const first=date(this._month+'-01'),offset=(first.getDay()+6)%7,end=new Date(+first);end.setMonth(end.getMonth()+1,0);const count=end.getDate(),current=today();
  const body=this._contents.querySelector('.picker-body');body.innerHTML='<div class="month-nav"><button type="button" aria-label="Предыдущий месяц">‹</button><span class="month-title" aria-live="polite"></span><button type="button" aria-label="Следующий месяц">›</button></div><div class="calendar" role="grid" aria-label="Календарь"><div class="weekdays" role="row">'+['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(n=>`<span role="columnheader">${n}</span>`).join('')+'</div></div><button type="button" class="today">Сегодня</button>';
  body.querySelector('.month-title').textContent=new Intl.DateTimeFormat('ru',{month:'long',year:'numeric'}).format(first);
  const nav=body.querySelectorAll('.month-nav button');nav[0].disabled=this._month==='0001-01';nav[1].disabled=this._month==='9999-12';nav.forEach((button,index)=>button.onclick=()=>{first.setMonth(first.getMonth()+(index?1:-1));this._month=iso(first).slice(0,7);this.calendar();body.querySelectorAll('.month-nav button')[index]?.focus({preventScroll:true});});
  const grid=body.querySelector('.calendar');let row;
  for(let index=0;index<Math.ceil((offset+count)/7)*7;index++){
   if(index%7===0){row=document.createElement('div');row.className='week';row.setAttribute('role','row');grid.append(row);}const number=index-offset+1;
   if(number<1||number>count){const blank=document.createElement('span');blank.setAttribute('role','gridcell');row.append(blank);continue;}
   const value=this._month+'-'+pad(number),button=document.createElement('button');button.type='button';button.className='day'+(index%7>4?' weekend':'');button.textContent=number;button.dataset.value=value;button.setAttribute('role','gridcell');button.setAttribute('aria-selected',String(value===this._draft));button.setAttribute('aria-label',new Intl.DateTimeFormat('ru',{day:'numeric',month:'long',year:'numeric'}).format(date(value)));if(value===current)button.setAttribute('aria-current','date');button.tabIndex=value===(this._draft.startsWith(this._month)?this._draft:this._month+'-01')?0:-1;
   button.onclick=()=>{this._draft=value;this.calendar(true);};button.onkeydown=event=>this.dayKey(event,value);row.append(button);
  }
  body.querySelector('.today').onclick=()=>{this._draft=today();this._month=this._draft.slice(0,7);this.calendar(true);};if(focus)body.querySelector('[tabindex="0"]').focus({preventScroll:true});
 }
 dayKey(event,value){
  const d=date(value),day=(d.getDay()+6)%7,deltas={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-day,End:6-day};
  if(event.key in deltas)d.setDate(d.getDate()+deltas[event.key]);else if(['PageUp','PageDown'].includes(event.key)){const n=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+(event.key==='PageUp'?-1:1));const last=new Date(+d);last.setMonth(last.getMonth()+1,0);d.setDate(Math.min(n,last.getDate()));}else return;
  event.preventDefault();const next=iso(d);if(d.getFullYear()<1||d.getFullYear()>9999)return;this._draft=next;this._month=next.slice(0,7);this.calendar(true);
 }
 time(){
  const body=this._contents.querySelector('.picker-body');body.innerHTML='<div class="wheels"><div><div class="wheel-label" aria-hidden="true">Часы</div><div class="wheel" role="listbox" tabindex="0" aria-label="Часы"></div></div><span class="colon" aria-hidden="true">:</span><div><div class="wheel-label" aria-hidden="true">Минуты</div><div class="wheel" role="listbox" tabindex="0" aria-label="Минуты"></div></div></div>';
  body.querySelectorAll('.wheel').forEach((wheel,index)=>{
   const count=index?60:24;wheel.innerHTML=Array.from({length:count},(_,n)=>`<div role="option" id="${index?'minute':'hour'}-${n}" aria-selected="false">${pad(n)}</div>`).join('');
   const choose=value=>{value=Math.max(0,Math.min(count-1,value));if(wheel.getAttribute('aria-activedescendant')===`${index?'minute':'hour'}-${value}`)return;const parts=this._draft.split(':');parts[index]=pad(value);this._draft=parts.join(':');wheel.setAttribute('aria-activedescendant',`${index?'minute':'hour'}-${value}`);[...wheel.children].forEach((option,n)=>option.setAttribute('aria-selected',String(n===value)));};
   wheel.onclick=event=>{const option=event.target.closest('[role=option]');if(option){const value=Number(option.textContent);choose(value);this.positionWheel(wheel,value);wheel.focus({preventScroll:true});}};
   wheel.onscroll=()=>{if(!this._closing&&this._dialog.open&&wheel.isConnected&&this._contents.contains(wheel))choose(Math.round(wheel.scrollTop/44));};wheel.onkeydown=event=>{const current=Number(this._draft.split(':')[index]),next=event.key==='Home'?0:event.key==='End'?count-1:event.key==='ArrowDown'?current+1:event.key==='ArrowUp'?current-1:null;if(next===null)return;event.preventDefault();choose(next);this.positionWheel(wheel,Math.max(0,Math.min(count-1,next)));};
   choose(Number(this._draft.split(':')[index]));
  });
 }
 positionWheel(wheel,value){wheel.scrollTop=value*44;}
 disconnectedCallback(){this.close(false,true);super.disconnectedCallback();}
}
if(!customElements.get('flow-date-time'))customElements.define('flow-date-time',FlowDateTime);
