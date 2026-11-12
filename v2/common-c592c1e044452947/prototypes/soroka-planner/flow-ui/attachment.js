import {FlowControl} from './control-base.js';
import {icon} from './components.js';
import './actions.js';

const sheet=new CSSStyleSheet();sheet.replaceSync(`
:host{display:block;min-width:0}.attachments{position:relative;isolation:isolate;border:1px solid var(--fu-line);border-radius:var(--fu-radius);padding:var(--fu-pad);background:var(--fu-surface);min-width:0}.list{display:grid;gap:8px;margin:0 0 12px;padding:0;list-style:none}.list:empty{display:none}.item{display:flex;align-items:center;gap:10px;min-width:0;min-height:44px}.preview{display:grid;place-items:center;flex:0 0 56px;width:56px;height:42px;border-radius:8px;overflow:hidden;color:var(--fu-muted);background:var(--fu-bg)}.preview img{width:100%;height:100%;object-fit:cover;display:block}.preview svg{width:22px;height:22px}.filename{font-size:13px;line-height:1.5;flex:1;min-width:0;overflow-wrap:anywhere}.filename small{display:block;color:var(--fu-muted);font-size:11px}.item flow-button{flex:0 0 44px}.hint{margin:8px 0 0;min-height:0;font-size:12px;color:var(--fu-muted);overflow-wrap:anywhere}.hint:empty{display:none}.hint[data-error]{color:var(--fu-danger)}.attachments[data-invalid=true]{border-color:var(--fu-danger)}input[type=file]{display:none}
`);
const supportedImages=new Set(['image/png','image/jpeg','image/webp','image/gif','image/avif']);
const bytesLabel=bytes=>bytes>=1048576?`${Math.round(bytes/104857.6)/10} МБ`:`${Math.max(1,Math.ceil(bytes/1024))} КБ`;
export class FlowAttachment extends FlowControl{
 static formAssociated=true;
 static observedAttributes=['name','state','disabled','max-files','max-bytes','aria-label'];
 constructor(){super();this.shadowRoot.adoptedStyleSheets=[...this.shadowRoot.adoptedStyleSheets,sheet];this._internals=this.attachInternals();this._files=[];this._urls=new Map();this._error='';}
 feedbackTarget(){return this.shadowRoot.querySelector('.attachments');}
 connectedCallback(){this.render();}
 disconnectedCallback(){this.releaseURLs();super.disconnectedCallback();}
 attributeChangedCallback(){if(this.isConnected)this.render();}
 get disabled(){return this.hasAttribute('disabled')||this._formDisabled||['loading','disabled'].includes(this.getAttribute('state'));}
 get files(){const transfer=new DataTransfer();for(const file of this._files)transfer.items.add(file);return transfer.files;}
 get maxFiles(){return Math.min(20,Math.max(1,Number(this.getAttribute('max-files'))||5));}
 get maxBytes(){return Math.max(1,Number(this.getAttribute('max-bytes'))||10485760);}
 formDisabledCallback(value){this._formDisabled=value;if(this.isConnected)this.render();}
 formResetCallback(){this.clear(false);}
 releaseURLs(){for(const url of this._urls.values())URL.revokeObjectURL(url);this._urls.clear();}
 clear(emit=true){const changed=this._files.length>0;this.releaseURLs();this._files=[];this._error='';if(this.isConnected)this.render();else this.syncForm();if(changed&&emit)this.emitChange('clear');}
 addFiles(files){
  if(this.disabled)return false;const incoming=[...files],seen=new Set(this._files.map(file=>this.identity(file))),unique=incoming.filter(file=>{const id=this.identity(file);if(seen.has(id))return false;seen.add(id);return true;});
  const bad=unique.find(file=>!supportedImages.has(file.type)&&file.type!=='application/pdf'),large=unique.find(file=>file.size>this.maxBytes);
  this._error=bad?'Выбери PNG, JPEG, WebP, GIF, AVIF или PDF.':large?`Файл «${large.name}» больше ${bytesLabel(this.maxBytes)}.`:this._files.length+unique.length>this.maxFiles?`Можно прикрепить не больше ${this.maxFiles} файлов.`:'';
  if(this._error){this.render();return false;}if(!unique.length){this.render();return true;}
  this._files.push(...unique);this.render();this.emitChange('add');return true;
 }
 identity(file){return JSON.stringify([file.name,file.size,file.type,file.lastModified]);}
 removeFile(file){if(this.disabled)return;const index=this._files.indexOf(file);if(index<0)return;const url=this._urls.get(file);if(url)URL.revokeObjectURL(url);this._urls.delete(file);this._files.splice(index,1);this._error='';this.render();this.emitChange('remove');const buttons=[...this.shadowRoot.querySelectorAll('.item flow-button')];(buttons[Math.min(index,buttons.length-1)]||this.shadowRoot.querySelector('[data-choose]'))?.shadowRoot?.querySelector('button')?.focus();}
 emitChange(reason){this.emit('flow-attachment-change',{files:this.files,reason});this.dispatchEvent(new Event('change',{bubbles:true,composed:true}));}
 syncForm(){const form=new FormData(),name=this.getAttribute('name')||'attachments';for(const file of this._files)form.append(name,file,file.name);this._internals.setFormValue(this.disabled?null:form);this._internals.setValidity(this._error?{customError:true}:{},this._error||'',this.shadowRoot.querySelector('[data-choose]')?.shadowRoot?.querySelector('button'));}
 render(){
  if(!this.shadowRoot.firstChild){
   this.shadowRoot.innerHTML='<section class="attachments"><ul class="list" aria-label="Прикреплённые файлы"></ul><flow-actions><flow-button data-choose icon="plus" label="Прикрепить"></flow-button></flow-actions><input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,application/pdf" multiple aria-label="Выбрать файлы"><p class="hint" role="status" aria-live="polite"></p></section>';
   const input=this.shadowRoot.querySelector('input');this.shadowRoot.querySelector('[data-choose]').onclick=()=>{if(!this.disabled)input.click();};input.onchange=()=>{this.addFiles(input.files);input.value='';};
  }
  const state=this.getAttribute('state')||'rest',surface=this.shadowRoot.querySelector('.attachments'),list=this.shadowRoot.querySelector('.list'),choose=this.shadowRoot.querySelector('[data-choose]'),hint=this.shadowRoot.querySelector('.hint');
  surface.dataset.invalid=String(Boolean(this._error)||state==='error');surface.setAttribute('aria-busy',String(state==='loading'));surface.setAttribute('aria-label',this.getAttribute('aria-label')||'Вложения');choose.toggleAttribute('disabled',Boolean(this.disabled));this.shadowRoot.querySelector('input').disabled=Boolean(this.disabled);
  list.replaceChildren();for(const file of this._files){
   const row=document.createElement('li');row.className='item';const preview=document.createElement('span');preview.className='preview';preview.setAttribute('aria-hidden','true');
   if(supportedImages.has(file.type)&&this.isConnected){let url=this._urls.get(file);if(!url){url=URL.createObjectURL(file);this._urls.set(file,url);}const image=document.createElement('img');image.alt='';image.src=url;image.onerror=()=>{preview.innerHTML=icon('note');};preview.append(image);}else preview.innerHTML=icon('note');
   const name=document.createElement('span');name.className='filename';name.textContent=file.name;const size=document.createElement('small');size.textContent=bytesLabel(file.size);name.append(size);const remove=document.createElement('flow-button');remove.setAttribute('variant','icon');remove.setAttribute('icon','close');remove.setAttribute('label',`Убрать: ${file.name}`);remove.toggleAttribute('disabled',Boolean(this.disabled));remove.onclick=()=>this.removeFile(file);row.append(preview,name,remove);list.append(row);
  }
  hint.textContent=this._error||(state==='error'?'Не удалось прикрепить файл. Выбери его ещё раз.':state==='offline'?'Нет связи. Файлы остаются на этом устройстве.':state==='loading'?'Подготовка файлов…':'');hint.toggleAttribute('data-error',Boolean(this._error)||state==='error');this.syncForm();
 }
}
if(!customElements.get('flow-attachment'))customElements.define('flow-attachment',FlowAttachment);
