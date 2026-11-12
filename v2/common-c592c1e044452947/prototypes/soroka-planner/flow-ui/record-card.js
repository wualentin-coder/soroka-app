import {FlowControl} from './control-base.js';
import {icon} from './components.js';

const sheet=new CSSStyleSheet();sheet.replaceSync(`
:host{display:block;min-width:0}.record{position:relative;isolation:isolate;display:grid;grid-template-columns:minmax(0,1fr) 44px;align-items:center;gap:4px;padding:8px;border:1px solid var(--fu-line);border-radius:var(--fu-radius);background:var(--fu-surface)}
button{border:0;background:none;user-select:none;-webkit-touch-callout:none}.body{display:grid;grid-template-columns:24px minmax(0,1fr);align-content:start;align-items:center;gap:8px;text-align:left;padding:8px;border-radius:12px;min-height:64px;min-width:0}.record-kind{color:var(--fu-accent);display:grid;place-items:center;height:24px}.record-kind svg{width:22px;height:22px}.copy{min-width:0;align-self:center}.copy strong{display:block;font-size:15px;line-height:1.5;font-weight:550;overflow-wrap:anywhere}.meta{display:block;margin-top:3px;font-size:12px;color:var(--fu-muted);overflow-wrap:anywhere}.meta:empty{display:none}.bookmark{display:grid;place-items:center;width:44px;height:44px;padding:11px;border-radius:12px;color:var(--fu-muted)}.bookmark svg{width:22px;height:22px}.bookmark[aria-pressed=true]{color:var(--fu-accent)}.bookmark[aria-pressed=true] path{fill:color-mix(in srgb,var(--fu-accent) 18%,transparent)}.body:active,.bookmark:active{transform:scale(.985);transition:transform 120ms var(--fu-ease)}.thumbnail{display:block;grid-column:1/-1;aspect-ratio:16/9;overflow:hidden;border-radius:10px;background:var(--fu-bg);margin-bottom:4px;width:100%;min-width:0}.thumbnail img{display:block;width:100%;height:100%;object-fit:cover}.record:has(.thumbnail:not([hidden])){align-items:start}.record:has(.thumbnail:not([hidden])) .bookmark{margin-top:8px}.status{grid-column:1/-1;margin:0;padding:0 8px 7px;color:var(--fu-muted);font-size:12px;overflow-wrap:anywhere}.record[data-state=error]{border-color:var(--fu-danger)}.record[data-state=error] .status{color:var(--fu-danger)}.record[data-state=offline]{border-style:dashed}
`);
// Existing flat bookmark geometry: app.js icons.bookmark. No new glyph family.
const bookmark='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h14v17l-7-5-7 5V4Z"/></svg>';
const kinds={note:{label:'Заметка',icon:'note'},material:{label:'Материал',icon:'note'},list:{label:'Список',icon:'list'}};
const messages={loading:'Запись загружается…',error:'Не удалось сохранить изменение.',offline:'Нет связи. Доступна сохранённая запись.',disabled:'Запись недоступна.'};
function thumbnailURL(value){if(!value)return '';try{const url=new URL(value,document.baseURI);return ['http:','https:','blob:'].includes(url.protocol)||/^data:image\/(png|jpeg|webp|gif);base64,/i.test(value)?url.href:'';}catch{return '';}}

export class FlowRecordCard extends FlowControl{
 static observedAttributes=['record-id','kind','title','meta','thumbnail','bookmarked','state','disabled'];
 constructor(){super();this.shadowRoot.adoptedStyleSheets=[...this.shadowRoot.adoptedStyleSheets,sheet];}
 feedbackTarget(){return this.shadowRoot.querySelector('.record');}
 connectedCallback(){this.render();}
 attributeChangedCallback(){if(this.isConnected)this.render();}
 render(){
  if(!this.shadowRoot.firstChild){
   this.shadowRoot.innerHTML=`<article class="record"><button type="button" class="body" data-open><span class="thumbnail" hidden><img alt="" loading="lazy" decoding="async"></span><span class="record-kind" aria-hidden="true"></span><span class="copy"><strong></strong><span class="meta"></span></span></button><button type="button" class="bookmark" data-bookmark>${bookmark}</button><p class="status" role="status" aria-live="polite" hidden></p></article>`;
   this.shadowRoot.querySelector('[data-open]').onclick=()=>{if(!this.shadowRoot.querySelector('[data-open]').disabled)this.emit('flow-record-open',this.detail());};
   this.shadowRoot.querySelector('[data-bookmark]').onclick=()=>{if(this.shadowRoot.querySelector('[data-bookmark]').disabled)return;this.toggleAttribute('bookmarked');this.emit('flow-record-bookmark-change',{...this.detail(),bookmarked:this.hasAttribute('bookmarked')});};
   this.shadowRoot.querySelector('img').onerror=()=>{this._failedThumbnail=this.shadowRoot.querySelector('img').getAttribute('src');this.shadowRoot.querySelector('.thumbnail').hidden=true;};
  }
  const kind=Object.hasOwn(kinds,this.getAttribute('kind'))?kinds[this.getAttribute('kind')]:kinds.note,state=this.hasAttribute('disabled')?'disabled':this.getAttribute('state')||'rest',title=this.getAttribute('title')||kind.label,open=this.shadowRoot.querySelector('[data-open]'),save=this.shadowRoot.querySelector('[data-bookmark]'),status=this.shadowRoot.querySelector('.status'),image=this.shadowRoot.querySelector('img'),url=thumbnailURL(this.getAttribute('thumbnail'));
  this.shadowRoot.querySelector('.record').dataset.state=state;this.shadowRoot.querySelector('.record').setAttribute('aria-busy',String(state==='loading'));
  this.shadowRoot.querySelector('.record-kind').innerHTML=icon(kind.icon);this.shadowRoot.querySelector('strong').textContent=title;this.shadowRoot.querySelector('.meta').textContent=[kind.label,this.getAttribute('meta')].filter(Boolean).join(' · ');
  open.setAttribute('aria-label',`Открыть: ${title}`);open.disabled=['loading','disabled'].includes(state);
  save.setAttribute('aria-label',this.hasAttribute('bookmarked')?'Убрать из избранного':'Добавить в избранное');save.setAttribute('aria-pressed',String(this.hasAttribute('bookmarked')));save.disabled=['loading','disabled','error','offline'].includes(state);
  status.textContent=messages[state]||'';status.hidden=!messages[state];this.shadowRoot.querySelector('.thumbnail').hidden=!url||url===this._failedThumbnail;
  if(url){if(image.getAttribute('src')!==url)image.src=url;}else image.removeAttribute('src');
 }
 detail(){return {recordId:this.getAttribute('record-id')||'',kind:Object.hasOwn(kinds,this.getAttribute('kind'))?this.getAttribute('kind'):'note'};}
}
if(!customElements.get('flow-record-card'))customElements.define('flow-record-card',FlowRecordCard);
