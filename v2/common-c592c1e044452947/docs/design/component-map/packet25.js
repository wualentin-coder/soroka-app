import '../../../prototypes/soroka-planner/flow-ui/vault-workspace.js';
const sheet=new CSSStyleSheet(),response=await fetch(new URL('./packet25.css',import.meta.url));if(!response.ok)throw Error('Vault specimen styles unavailable');sheet.replaceSync(await response.text());
class VaultWorkspaceExample extends HTMLElement{
 static observedAttributes=['state'];
 connectedCallback(){if(!this.shadowRoot){this.attachShadow({mode:'open'});this.shadowRoot.adoptedStyleSheets=[sheet];this.shadowRoot.innerHTML='<flow-vault-workspace></flow-vault-workspace>';this.workspace=this.shadowRoot.firstElementChild;this.workspace.ownerEvents.addEventListener('flow-vault-intent',event=>{event.preventDefault();this.workspace.settle(event.detail.requestId,{ok:false,error:'Для сохранения и открытия подключи владельца хранилища.'});});}this.reset();}
 attributeChangedCallback(){if(this.workspace)this.reset();}
 disconnectedCallback(){this.workspace?.closeWindows();}
 reset(){this.workspace.closeWindows();const state=this.getAttribute('state')||'setup';this.workspace.model={mode:state==='locked'?'locked':state==='empty'?'unlocked':'setup',records:[]};}
}
if(!customElements.get('flow-vault-workspace-example'))customElements.define('flow-vault-workspace-example',VaultWorkspaceExample);
export const packetTwentyFive=[{id:'L07',name:'Пароли · закрытое хранилище',version:'0.1.0',source:'vault-workspace.js',sample:'packet25.js',layout:'packet25.css',icons:true,extraSources:['dialog-header.js'],deps:['F01','B01','B02','I01','I02','I03','D01'],uses:['Мастер-пароль, запись, временное раскрытие и блокировка','Сохранение подтверждает отдельный владелец'],target:['vault-crypto.js','more.js','app-prototype/bound/vault-owner.js'],render:state=>`<flow-vault-workspace-example state="${state}"></flow-vault-workspace-example>`,states:['setup','locked','empty']}];

