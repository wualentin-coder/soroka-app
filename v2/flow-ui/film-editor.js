import './components.js?v=644cff7ac9';
import './field.js?v=644cff7ac9';
import './text-area.js?v=644cff7ac9';
import './flow-select.js?v=644cff7ac9';
import {FlowControl} from './control-base.js?v=644cff7ac9';
import {dialogHeader,dialogHeaderSheet} from './dialog-header.js?v=644cff7ac9';
import {filmRatingPatch,filmStatusPatch} from './film-state.js?v=644cff7ac9';

const clone=value=>structuredClone(value??{});
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=value=>Array.isArray(value)?value.map(part=>typeof part==='object'?(part.name||part.title||''):String(part)).filter(Boolean).join(', '):String(value??'');
const strings=['title','originalTitle','director','genre','description','hook','plot','where','topic','kinopoiskUrl','coverPath','reason','review'];
const numbers=['year','minutes','kinopoiskRating','imdbRating','rating'];
const arrays=['genres','countries','cast','tags'];
const field=(name,label,value,max=500)=>`<flow-field name="${name}" aria-label="${label}" placeholder="${label}" maxlength="${max}" value="${escape(text(value))}" ${name==='title'?'required':''}></flow-field>`;
const area=(name,label,value)=>`<flow-text-area name="${name}" aria-label="${label}" placeholder="${label}" maxlength="5000" value="${escape(text(value))}"></flow-text-area>`;
const number=(name,label,value,attributes='')=>`<label class="number"><input name="${name}" type="number" inputmode="decimal" aria-label="${label}" placeholder="${label}" value="${escape(value??'')}" ${attributes}></label>`;
const statuses=['Хочу посмотреть','Смотрю','Посмотрел'];
const style=new CSSStyleSheet();style.replaceSync(`
:host{display:block;min-width:0;color:var(--fu-text);font:15px/1.5 var(--fu-font)}*{box-sizing:border-box}.surface{position:relative;isolation:isolate;padding:16px;border:1px solid var(--fu-line);border-radius:var(--fu-radius);background:var(--fu-surface)}form{display:flex;flex-direction:column;max-height:calc(100dvh - 72px);min-height:0;margin:0}.body{overflow:auto;min-height:0;overscroll-behavior:contain;padding:0 2px 2px}.fields{display:grid;gap:10px}.pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.primary-meta{grid-template-columns:92px minmax(0,1fr)}flow-field,flow-text-area,flow-select{display:block;min-width:0}.number{display:block;min-width:0}.number input{width:100%;min-width:0;min-height:46px;border:1px solid var(--fu-line);border-radius:12px;padding:10px 12px;color:var(--fu-text);background:var(--fu-bg);font:inherit;outline:0}.number input:focus-visible{border-color:var(--fu-accent);box-shadow:0 0 0 1px color-mix(in srgb,var(--fu-accent) 25%,transparent)}.number input::placeholder{color:var(--fu-muted)}details{margin-top:10px;border-top:1px solid var(--fu-line)}summary{display:flex;justify-content:space-between;gap:12px;align-items:center;min-height:44px;padding:8px 4px;color:var(--fu-muted);list-style:none;cursor:pointer;border-radius:12px;user-select:none;-webkit-tap-highlight-color:transparent}summary::-webkit-details-marker{display:none}summary::after{content:'+';font-size:20px;color:var(--fu-accent)}details[open]>summary::after{content:'−'}summary:focus-visible{outline:0;text-decoration:underline;text-decoration-color:var(--fu-accent);text-underline-offset:4px}details>.fields{padding:2px 0 10px}footer{flex:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--fu-line)}.rating{margin-top:2px}.rating-head{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;color:var(--fu-muted);margin-bottom:6px}.rating output{color:var(--fu-accent);font-variant-numeric:tabular-nums}.rating-line{position:relative;min-height:44px;display:flex;align-items:center;border-radius:12px}.stars{width:100%;display:flex;justify-content:space-around;gap:1px;font-size:22px;color:var(--fu-muted);pointer-events:none}.stars [data-on]{color:var(--fu-accent)}.rating input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:.01;cursor:pointer}.rating-line:focus-within{box-shadow:inset 0 0 0 1px var(--fu-accent)}[hidden]{display:none!important}
@media(max-width:350px){.surface{padding:12px}form{max-height:calc(100dvh - 56px)}.pair{gap:8px}.primary-meta{grid-template-columns:80px minmax(0,1fr)}}
`);

export class FlowFilmEditor extends FlowControl{
 constructor(){super();this.shadowRoot.adoptedStyleSheets=[...this.shadowRoot.adoptedStyleSheets,style,dialogHeaderSheet];}
 get record(){return clone(this._record)}
 set record(value){this._record=clone(value);this._baseline=null;if(this.isConnected)this.render()}
 get draft(){
  const form=this.shadowRoot.querySelector('form'),record=clone(this._record),original=clone(this._record);if(!form)return record;
  const values=new FormData(form);
  for(const key of strings){const value=String(values.get(key)??'').trim();if(value!==text(record[key]).trim()||Object.hasOwn(record,key)||key==='title')record[key]=value;}
  for(const key of numbers){const raw=String(values.get(key)??'');if(raw!==text(record[key])||Object.hasOwn(record,key)){record[key]=raw===''?(key==='year'||key==='minutes'||key==='rating'?0:''):Number(raw);}}
  for(const key of arrays){const raw=String(values.get(key)??'');if(raw!==text(record[key]))record[key]=raw.split(',').map(part=>part.trim()).filter(Boolean);}
  if(Number(record.rating||0)!==Number(original.rating||0))Object.assign(record,filmRatingPatch(original,record.rating));
  const status=String(values.get('status')||'Хочу посмотреть');if(status!==String(original.status||'Хочу посмотреть'))Object.assign(record,filmStatusPatch(record,status));
  return record;
 }
 get dirty(){return !!this._baseline&&JSON.stringify(this.draft)!==this._baseline}
 connectedCallback(){if(!this.shadowRoot.firstChild)this.render()}
 feedbackTarget(){return this.shadowRoot.querySelector('.surface')}
 render(){
  clearTimeout(this._idle);const record=clone(this._record),status=record.status||'Хочу посмотреть';
  const statusOptions=statuses.includes(status)?statuses:[...statuses,status];
  const header=dialogHeader(record.id?'Изменить фильм':'Новый фильм','film-editor-title');
  this.shadowRoot.innerHTML=`<section class="surface"><form>${header}<div class="body"><div class="fields">${field('title','Название фильма',record.title,120)}<div class="pair primary-meta">${number('year','Год',record.year||'','min="1880" max="2200" step="1"')}${field('director','Режиссёр',record.director)}</div><flow-select presentation="dialog" name="status" aria-label="Статус фильма" value="${escape(status)}">${statusOptions.map(value=>`<option value="${escape(value)}">${escape(value)}</option>`).join('')}</flow-select>${field('hook','Коротко о фильме',record.hook,500)}<section class="rating" aria-label="Моя оценка"><div class="rating-head"><span>Моя оценка</span><output>${Number(record.rating)||'—'}</output></div><div class="rating-line"><div class="stars" aria-hidden="true">${Array.from({length:10},(_,i)=>`<span ${i<Number(record.rating)?'data-on':''}>☆</span>`).join('')}</div><input name="rating" type="range" min="0" max="10" step="1" value="${Number(record.rating)||0}" aria-label="Моя оценка" aria-valuetext="${Number(record.rating)||'Без оценки'}"></div></section></div><details><summary>Сведения о фильме</summary><div class="fields">${field('originalTitle','Оригинальное название',record.originalTitle)}<div class="pair">${field('genre','Жанр',record.genre)}${number('minutes','Длительность, мин',record.minutes||'','min="0" max="10000" step="1"')}</div>${field('genres','Все жанры, через запятую',record.genres)}${field('countries','Страны, через запятую',record.countries)}${area('description','Описание',record.description)}${area('plot','Сюжет',record.plot)}${area('cast','В ролях, через запятую',record.cast)}</div></details><details><summary>Ссылки и обложка</summary><div class="fields">${field('where','Где смотреть',record.where)}${field('kinopoiskUrl','Ссылка на Кинопоиск',record.kinopoiskUrl,2000)}${field('coverPath','Адрес обложки',record.coverPath,2000)}<div class="pair">${number('kinopoiskRating','Кинопоиск',record.kinopoiskRating,'min="0" max="10" step="0.1"')}${number('imdbRating','IMDb',record.imdbRating,'min="0" max="10" step="0.1"')}</div></div></details><details><summary>Мои заметки</summary><div class="fields">${field('topic','Тема',record.topic)}${field('tags','Метки, через запятую',record.tags)}${area('reason','Почему сохранил',record.reason)}${area('review','Мой отзыв',record.review)}</div></details></div><footer><flow-actions>${record.id?'<flow-button stretch variant="danger" icon="trash" label="Удалить" data-delete></flow-button>':''}<flow-button stretch variant="primary" label="${record.id?'Сохранить':'Добавить'}" data-save></flow-button></flow-actions></footer></form></section>`;
  const form=this.shadowRoot.querySelector('form'),surface=this.shadowRoot.querySelector('.surface');
  this._baseline=JSON.stringify(this.draft);
  const intent=(kind,detail=this.draft)=>this.dispatchEvent(new CustomEvent(`flow-film-editor-${kind}`,{detail,bubbles:true,composed:true,cancelable:true}));
  const save=()=>{if(!form.reportValidity())return;const title=this.shadowRoot.querySelector('flow-field[name=title]');if(!title.value.trim()){title.shadowRoot.querySelector('input').focus();return;}intent('save');};
  form.onsubmit=event=>{event.preventDefault();save()};
  this.shadowRoot.querySelector('[data-save]').onclick=save;
  this.shadowRoot.querySelector('[data-delete]')?.addEventListener('click',()=>intent('delete'));
  this.shadowRoot.querySelector('.dialog-close').onclick=()=>intent('close',{draft:this.draft,dirty:this.dirty});
  form.oninput=()=>{surface.dataset.state='input';clearTimeout(this._idle);this._idle=setTimeout(()=>surface.dataset.state='rest',650);const rating=form.elements.rating.value;this.shadowRoot.querySelector('.rating output').textContent=Number(rating)||'—';form.elements.rating.setAttribute('aria-valuetext',Number(rating)?`${rating} из 10`:'Без оценки');for(const[index,star]of[...this.shadowRoot.querySelectorAll('.stars span')].entries())star.toggleAttribute('data-on',index<Number(rating));this.emit('flow-film-editor-change',{draft:this.draft,dirty:this.dirty});};
 }
 disconnectedCallback(){clearTimeout(this._idle);super.disconnectedCallback()}
}
if(!customElements.get('flow-film-editor'))customElements.define('flow-film-editor',FlowFilmEditor);
