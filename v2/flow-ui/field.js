import{FlowControl}from'./control-base.js?v=644cff7ac9';
export class FlowField extends FlowControl{
 static formAssociated=true;
 static observedAttributes=['value','placeholder','aria-label','name','state','disabled','required','maxlength'];
 constructor(){super();this._internals=this.attachInternals();}
 get controlHTML(){return '<input type="text" aria-describedby="hint">'}
 connectedCallback(){if(!this._input){this.shadowRoot.innerHTML=`<div class="frame">${this.controlHTML}<i class="spinner" aria-hidden="true" hidden></i></div><p class="hint" id="hint" aria-live="polite"></p>`;this._input=this.shadowRoot.querySelector('input,textarea');this._input.oninput=e=>{e.stopPropagation();if(this.getAttribute('state')==='error')this.removeAttribute('state');this.updateValidity();this.dispatchEvent(new Event('input',{bubbles:true,composed:true}));};this._input.onchange=e=>{e.stopPropagation();this.dispatchEvent(new Event('change',{bubbles:true,composed:true}));};this._input.onkeydown=e=>this.submitOnEnter(e);this._default=this.getAttribute('value')||'';this._input.value=this._default;}this.sync();}
 attributeChangedCallback(name){if(!this._input)return;if(name==='value')this._input.value=this.getAttribute('value')||'';this.sync();}
 get value(){return this._input?.value??this.getAttribute('value')??''}
 set value(value){if(this._input){this._input.value=String(value);this.updateValidity();}else this.setAttribute('value',value);}
 get disabled(){return this.hasAttribute('disabled')||this._formDisabled||this.getAttribute('state')==='disabled'}
 formDisabledCallback(value){this._formDisabled=value;if(this._input)this.sync();}
 formResetCallback(){this.value=this._default;this.sync();}
 formStateRestoreCallback(value){this.value=value;}
 submitOnEnter(e){if(e.key!=='Enter'||e.isComposing||e.keyCode===229||this.disabled||this._input.readOnly)return;const form=this._internals.form;if(!form)return;e.preventDefault();const submitter=[...form.elements].find(el=>(el.tagName==='BUTTON'||el.tagName==='INPUT')&&['submit','image'].includes(el.type));if(submitter?.disabled)return;if(submitter)form.requestSubmit(submitter);else form.requestSubmit();}
 updateValidity(){if(!this._input)return;this._internals.setFormValue(this.disabled?null:this.value);const invalid={};for(const key of ['valueMissing','tooLong','typeMismatch','patternMismatch','badInput'])if(this._input.validity[key])invalid[key]=true;this._internals.setValidity(invalid,this._input.validationMessage,this._input);}
 sync(){if(!this._input)return;const state=this.getAttribute('state')||'rest';this._input.disabled=!!this.disabled;this._input.readOnly=state==='loading';this._input.setAttribute('aria-busy',String(state==='loading'));this._input.required=this.hasAttribute('required');this._input.maxLength=Math.max(1,Math.min(5000,Number(this.getAttribute('maxlength'))||200));this._input.placeholder=this.getAttribute('placeholder')||'Название';this._input.setAttribute('aria-label',this.getAttribute('aria-label')||this._input.placeholder);this._input.setAttribute('aria-invalid',String(state==='error'));this.shadowRoot.querySelector('.frame').dataset.state=state;this.shadowRoot.querySelector('.spinner').hidden=state!=='loading';const hint=this.shadowRoot.querySelector('.hint');hint.textContent=state==='error'?'Проверь значение и попробуй ещё раз.':state==='offline'?'Нет связи. Можно продолжить ввод.':'';hint.toggleAttribute('data-error',state==='error');this.updateValidity();}
}
if(!customElements.get('flow-field'))customElements.define('flow-field',FlowField);
