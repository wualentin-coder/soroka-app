import{pulseFeedback}from'../../../prototypes/soroka-planner/flow-ui/feedback.js';
import '../../../prototypes/soroka-planner/flow-ui/confirm.js';
import '../../../prototypes/soroka-planner/flow-ui/text-area.js';
import{FlowControl}from'../../../prototypes/soroka-planner/flow-ui/control-base.js';
import{dialogHeader,dialogHeaderSheet}from'../../../prototypes/soroka-planner/flow-ui/dialog-header.js';
const sampleStyle=new CSSStyleSheet();sampleStyle.replaceSync('.editor{min-width:0}.editor flow-text-area{display:block}.closed{display:block}[hidden]{display:none!important}');
class DiscardExample extends FlowControl{
 constructor(){super();this.shadowRoot.adoptedStyleSheets=[...this.shadowRoot.adoptedStyleSheets,dialogHeaderSheet,sampleStyle];this._epoch=0;}
 connectedCallback(){
  if(!this._field){
   this.shadowRoot.innerHTML=`<flow-surface class="editor">${dialogHeader('Заметка','draft-title')}<flow-text-area aria-label="Текст заметки" placeholder="Текст заметки" maxlength="4000"></flow-text-area></flow-surface><flow-button class="closed" label="Открыть заметку" stretch hidden></flow-button><flow-confirm purpose="discard" trigger-hidden></flow-confirm>`;
   this._field=this.shadowRoot.querySelector('flow-text-area');this._confirm=this.shadowRoot.querySelector('flow-confirm');this._editor=this.shadowRoot.querySelector('.editor');this._closed=this.shadowRoot.querySelector('.closed');this._field.addEventListener('input',()=>this._epoch++);this.shadowRoot.querySelector('.dialog-close').onclick=()=>this.attemptClose();this._closed.onclick=()=>{this._epoch++;this._editor.hidden=false;this._closed.hidden=true;this._field.shadowRoot.querySelector('textarea').focus();};
   this._confirm.addEventListener('flow-confirm-result',event=>{const pending=this._pending;if(!pending||event.detail.session!==pending.session||event.detail.purpose!=='discard')return;this._pending=null;if(event.detail.confirmed&&pending.epoch===this._epoch&&pending.text===this._field.value&&!this._editor.hidden){this._field.value='';this.closeEditor();}else if(!this._editor.hidden){this._field.shadowRoot.querySelector('textarea').focus({preventScroll:true});pulseFeedback(this._editor,this._editor.shadowRoot.querySelector('.surface'),{tone:'cancel'});}});
  }
  this.sync();
 }
 static observedAttributes=['disabled'];
 attributeChangedCallback(){if(this._field)this.sync();}
 sync(){this._field.toggleAttribute('disabled',this.hasAttribute('disabled'));this._confirm.toggleAttribute('disabled',this.hasAttribute('disabled'));this.shadowRoot.querySelector('.dialog-close').disabled=this.hasAttribute('disabled');this._closed.toggleAttribute('disabled',this.hasAttribute('disabled'));}
 attemptClose(){if(this.hasAttribute('disabled'))return;if(!this._field.value){this.closeEditor();return;}const epoch=this._epoch,text=this._field.value,session=this._confirm.open();if(session)this._pending={session,epoch,text};}
 closeEditor(){this._epoch++;this._pending=null;this._editor.hidden=true;this._closed.hidden=false;this._closed.shadowRoot.querySelector('button').focus({preventScroll:true});}
 disconnectedCallback(){this._epoch++;this._pending=null;if(this._confirm?._dialog?.open)this._confirm.close('cancel',true);super.disconnectedCallback();}
}
if(!customElements.get('flow-discard-example'))customElements.define('flow-discard-example',DiscardExample);
export const packetSeven=[
 {id:'D05',name:'Закрытие без сохранения',version:'0.2.0',source:'confirm.js',sample:'packet7.js',layout:'packet7.css',deps:['D01','F01','B02','I03'],uses:['Закрытие изменённой заметки','Отмена редактирования формы'],target:['sheet-state.js::confirmSheetDiscard','app.js','motion.js','digital-assistant.js'],render:state=>`<flow-discard-example ${state==='disabled'?'disabled':''}></flow-discard-example>`,states:['rest','disabled']}
];
