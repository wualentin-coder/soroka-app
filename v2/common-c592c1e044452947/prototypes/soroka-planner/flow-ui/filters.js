import{FlowControl}from'./control-base.js';
import{motionDisabled,trackMotion}from'./feedback.js';
const style=new CSSStyleSheet();style.replaceSync(`
.filters{position:relative;display:flex;gap:6px;align-items:stretch;isolation:isolate;border-bottom:1px solid var(--fu-line)}
.filter{position:relative;z-index:1;flex:1;min-width:0;min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:12px 12px 0 0;padding:10px 6px;background:transparent;color:var(--fu-muted);font-size:14px;white-space:nowrap;user-select:none;transition:border-color var(--fu-time) var(--fu-ease),color var(--fu-time) var(--fu-ease)}
.filter[aria-checked=true]{color:var(--fu-text);border-color:transparent}
.filter:focus{outline:none}.filter:focus-visible{outline:2px solid var(--fu-accent);outline-offset:3px}
.indicator{position:absolute;inset:0 auto 0 0;width:0;border-radius:12px 12px 0 0;background:color-mix(in srgb,var(--fu-accent) 7%,transparent);pointer-events:none;opacity:0}
.filter::after{content:"";position:absolute;bottom:0;left:12%;right:12%;height:1px;opacity:0;background:linear-gradient(90deg,transparent,var(--fu-accent),transparent);transition:opacity var(--fu-time) var(--fu-ease)}
.filter[aria-checked=true]::after{opacity:1}
.count{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 4px;border-radius:7px;font:500 11px/1 var(--fu-font);background:color-mix(in srgb,var(--fu-line) 40%,transparent);color:var(--fu-muted);transition:color var(--fu-time) var(--fu-ease),background var(--fu-time) var(--fu-ease)}
.filter[aria-checked=true] .count{color:var(--fu-accent);background:color-mix(in srgb,var(--fu-accent) 10%,transparent)}
:host{container-type:inline-size}@container(max-width:300px){.filters{gap:6px}.filter{gap:4px;padding-inline:2px;font-size:13px}.count{min-width:16px;height:18px;padding-inline:2px}}
.filter>.flow-response{border:0;box-shadow:none}.result{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;margin:0}
`);

class FlowFilters extends FlowControl{
 static observedAttributes=['value','disabled','aria-label'];
 constructor(){super();this.shadowRoot.adoptedStyleSheets=[...this.shadowRoot.adoptedStyleSheets,style];this._flowFeedbackLocal=true;}
 feedbackTarget(event){return event?.composedPath().find(node=>node?.classList?.contains('filter')&&node.getRootNode()===this.shadowRoot)||this.shadowRoot.querySelector('.filter[aria-checked=true]');}
 get value(){return this.getAttribute('value')||this.querySelector('option')?.value||''}
 set value(value){this.setAttribute('value',value)}
 connectedCallback(){if(!this._group){this.shadowRoot.innerHTML='<div class="filters" role="radiogroup"><span class="indicator" aria-hidden="true"></span></div><p class="result" aria-live="polite"></p>';this._group=this.shadowRoot.querySelector('.filters');for(const option of this.querySelectorAll('option')){const button=document.createElement('button');button.type='button';button.className='filter';button.dataset.value=option.value;button.setAttribute('role','radio');button.append(document.createTextNode(option.textContent));if(option.dataset.count){const count=document.createElement('span');count.className='count';count.textContent=option.dataset.count;button.append(count);}button.onclick=()=>this.choose(option.value);button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...this._group.querySelectorAll('button')],index=buttons.indexOf(button),at=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+buttons.length)%buttons.length;this.choose(buttons[at].dataset.value);buttons[at].focus({preventScroll:true});};this._group.append(button);}}this.sync();this._resize?.disconnect();this._resize=new ResizeObserver(()=>this.moveIndicator(false));this._resize.observe(this._group);}
 attributeChangedCallback(){if(this._group)this.sync();}
 choose(value){if(this.hasAttribute('disabled')||this.value===value)return;this.value=value;this.dispatchEvent(new Event('change',{bubbles:true,composed:true}));}
 sync(){this._group.setAttribute('aria-label',this.getAttribute('aria-label')||'Фильтр');for(const button of this._group.querySelectorAll('button')){const selected=button.dataset.value===this.value;button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1;button.disabled=this.hasAttribute('disabled');}const selected=[...this.querySelectorAll('option')].find(o=>o.value===this.value);this.shadowRoot.querySelector('.result').textContent=selected?.dataset.result||'';this.moveIndicator();}
 moveIndicator(animate=true){const selected=this._group.querySelector('[aria-checked=true]'),indicator=this._group.querySelector('.indicator');if(!selected)return;const css=getComputedStyle(indicator),before={transform:css.transform,width:css.width};this._motion?.cancel();const after={transform:`translateX(${selected.offsetLeft}px)`,width:selected.offsetWidth+'px'};indicator.style.transform=after.transform;indicator.style.width=after.width;indicator.style.opacity='1';if(animate&&this._indicatorReady&&!motionDisabled())this._motion=trackMotion(indicator.animate([before,after],{duration:480,easing:'cubic-bezier(.4,0,.2,1)'}));this._indicatorReady=true;}
 disconnectedCallback(){super.disconnectedCallback();this._resize?.disconnect();this._motion?.cancel();this._indicatorReady=false;}
}
if(!customElements.get('flow-filters'))customElements.define('flow-filters',FlowFilters);
