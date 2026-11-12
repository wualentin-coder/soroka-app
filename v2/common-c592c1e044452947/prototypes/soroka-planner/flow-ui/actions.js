const style=new CSSStyleSheet();style.replaceSync(`
:host{display:block;width:100%;min-width:0;--fu-button-width:100%;--fu-button-pad:10px}
.actions{display:flex;align-items:stretch;gap:10px;width:100%}
::slotted(flow-button){display:flex;flex:1 1 0;min-width:0;width:0;margin:0}
::slotted(flow-button[variant=icon]){flex:0 0 44px;width:44px}
`);
class FlowActions extends HTMLElement{
 constructor(){super();this.attachShadow({mode:'open'});this.shadowRoot.adoptedStyleSheets=[style];}
 connectedCallback(){if(!this.shadowRoot.firstChild)this.shadowRoot.innerHTML='<div class="actions"><slot></slot></div>';}
}
if(!customElements.get('flow-actions'))customElements.define('flow-actions',FlowActions);
