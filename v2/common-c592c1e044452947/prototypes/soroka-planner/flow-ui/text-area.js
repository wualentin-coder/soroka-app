import{FlowField}from'./field.js';
const style=new CSSStyleSheet();style.replaceSync('.frame{align-items:flex-start}.frame textarea{resize:none;min-height:94px;max-height:280px;overflow-y:auto}.spinner{margin-top:14px}');
class FlowTextArea extends FlowField{
 get controlHTML(){return '<textarea rows="3" aria-describedby="hint"></textarea>'}
 connectedCallback(){super.connectedCallback();if(!this._textMounted){this._textMounted=true;this.shadowRoot.adoptedStyleSheets=[...this.shadowRoot.adoptedStyleSheets,style];this.addEventListener('input',()=>this.grow());}this.grow();}
 grow(){if(!this._input)return;this._input.style.height='auto';this._input.style.height=Math.min(280,Math.max(94,this._input.scrollHeight))+'px';}
 sync(){super.sync();if(this._textMounted)this.grow();}
 get value(){return super.value}
 set value(value){super.value=value;this.grow();}
 submitOnEnter(){}
}
if(!customElements.get('flow-text-area'))customElements.define('flow-text-area',FlowTextArea);
