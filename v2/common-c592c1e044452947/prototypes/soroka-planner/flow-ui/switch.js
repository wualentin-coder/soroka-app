import{FlowControl}from'./control-base.js';
const style=new CSSStyleSheet();style.replaceSync('.switch{display:flex;align-items:center;justify-content:space-between;gap:18px;width:100%;min-height:48px;border:0;background:transparent;text-align:left;padding:2px 12px}.track{position:relative;isolation:isolate;display:block;width:44px;height:26px;padding:3px;border:1px solid var(--fu-line);border-radius:20px;background:var(--fu-line);flex:none;transition:background-color 480ms cubic-bezier(.4,0,.2,1),border-color 480ms cubic-bezier(.4,0,.2,1)}.knob{display:block;width:18px;height:18px;border-radius:50%;background:var(--fu-text);transform:translateX(0);transition:transform 520ms cubic-bezier(.4,0,.2,1),width 160ms ease,background-color 480ms cubic-bezier(.4,0,.2,1)}[aria-checked=true] .track{background:var(--fu-accent);border-color:var(--fu-accent)}[aria-checked=true] .knob{background:var(--fu-on);transform:translateX(18px)}.switch:focus{outline:none}.switch:focus-visible .track{outline:2px solid var(--fu-accent);outline-offset:3px}.switch:active .knob{width:22px}.switch:active[aria-checked=true] .knob{transform:translateX(14px)}');
class FlowSwitch extends FlowControl{
 static formAssociated=true;static observedAttributes=['checked','disabled','label','name'];
 constructor(){super();this._internals=this.attachInternals();this._flowFeedbackLocal=true;this.shadowRoot.adoptedStyleSheets=[...this.shadowRoot.adoptedStyleSheets,style];}
 feedbackTarget(){return this.shadowRoot.querySelector('.track');}
 connectedCallback(){if(!this._button){this.shadowRoot.innerHTML='<button type="button" class="switch" role="switch"><span class="label"></span><span class="track" aria-hidden="true"><span class="knob"></span></span></button>';this._button=this.shadowRoot.querySelector('button');this._button.onclick=()=>{this.toggleAttribute('checked');this.dispatchEvent(new Event('change',{bubbles:true,composed:true}));};this._default=this.hasAttribute('checked');}this.sync();}
 attributeChangedCallback(){if(this._button)this.sync();}
 formDisabledCallback(value){this._formDisabled=value;if(this._button)this.sync();}
 formResetCallback(){this.toggleAttribute('checked',this._default);}
 formStateRestoreCallback(value){this.toggleAttribute('checked',value==='on');}
 sync(){this._button.disabled=this.hasAttribute('disabled')||!!this._formDisabled;this._button.setAttribute('aria-checked',String(this.hasAttribute('checked')));this.shadowRoot.querySelector('.label').textContent=this.getAttribute('label')||'Включить';this._internals.setFormValue(this.hasAttribute('checked')?'on':null);}
}
if(!customElements.get('flow-switch'))customElements.define('flow-switch',FlowSwitch);
