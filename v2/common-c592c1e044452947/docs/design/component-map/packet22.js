import {filmLibraryMatches} from '../../../prototypes/soroka-planner/flow-ui/film-library.js';
const response=await fetch(new URL('../app-prototype/bound/fixtures.json',import.meta.url));
if(!response.ok)throw Error('Film specimen data unavailable');
const fixture=await response.json();

// An in-memory owner exercises the same ACK contract as the bound application.
export class FilmLibraryExample extends HTMLElement{
 connectedCallback(){
  if(this.workspace)return;
  this._model={records:structuredClone(fixture.data.saved.movies),sections:structuredClone(fixture.data.savedSections.movies),today:fixture.today};
  const workspace=this.workspace=document.createElement('flow-film-library');
  workspace.model=this._model;
  const state=this.getAttribute('state');
  workspace.view=state==='list'?{mode:'list'}:state==='watched'?{tab:'watched'}:state==='collections'?{tab:'collections'}:{};
  workspace.addEventListener('flow-film-library-intent',event=>{event.preventDefault();this.intent(event.detail)});
  workspace.addEventListener('flow-film-intent',event=>{
   event.stopPropagation();
   const child=event.composedPath().find(node=>node.localName==='flow-record-example'),{action,recordId,changes,value}=event.detail;
   const record=this._model.records.find(item=>String(item.id)===String(recordId));
   if(action==='open'&&value===true)return;
   if(record&&['pin','status','rating','review','note','episode'].includes(action)){
    Object.assign(record,structuredClone(changes));workspace.model=this._model;child.acknowledgeFilmChange(action,true);
   }else if(record&&action==='delete'){
    this._model.records=this._model.records.filter(item=>item!==record);workspace.model=this._model;
   }else child?.acknowledgeFilmChange(action,false,'Это действие подключает приложение.');
  });
  this.append(workspace);
 }
 get model(){return structuredClone(this._model)}
 intent({action,recordId,requestId,args,changes}){
  const workspace=this.workspace,next=structuredClone(this._model),record=next.records.find(item=>String(item.id)===String(recordId));
  try{
   if(action==='viewed'){
    if(!filmLibraryMatches(record,args.before))throw Error('Статус фильма уже изменился.');
    Object.assign(record,changes);
   }else if(action==='undo'){
    if(!filmLibraryMatches(record,args.expectedAfter))throw Error('Статус фильма уже изменился.');
    for(const {key,own,value} of args.before)if(own)record[key]=value;else delete record[key];
   }else if(action==='folder-create')next.sections.push({id:crypto.randomUUID(),name:args.name});
   else if(action==='folder-rename'){
    const folder=next.sections.find(item=>String(item.id)===String(args.folderId));if(!folder)throw Error('Подборка не найдена.');folder.name=args.name;
   }else if(action==='folder-delete'){
    next.sections=next.sections.filter(item=>String(item.id)!==String(args.folderId));
    for(const movie of next.records)if(String(movie.categoryId)===String(args.folderId))movie.categoryId='';
   }else if(action==='folder-assign'){
    if(!record)throw Error('Фильм не найден.');
    if(args.folderId&&!next.sections.some(item=>String(item.id)===String(args.folderId)))throw Error('Подборка не найдена.');
    record.categoryId=args.folderId;
   }else throw Error(action==='recommend'||action==='external-search'?'Источник новых фильмов не подключён.':'Это действие подключает приложение.');
   this._model=next;workspace.model=next;workspace.settle(requestId,{ok:true});
  }catch(error){workspace.settle(requestId,{ok:false,error:error.message})}
 }
}
if(!customElements.get('flow-film-library-example'))customElements.define('flow-film-library-example',FilmLibraryExample);
export const packetTwentyTwo=[{id:'L05',name:'Фильмы · библиотека',version:'0.2.0',source:'film-library.js',sample:'packet22.js',layout:'packet22.css',extraSources:['film-state.js'],deps:['R10','M01'],states:['deck','list','watched','collections'],uses:['Карусель, список, поиск и подборки одной библиотеки','Исходный LoopDeck и общая карточка R10; изменения после подтверждения владельца'],target:['movie-carousel.js','loop-deck.js','saved.js','app-prototype/bound/app.js'],render:state=>`<flow-film-library-example state="${state}"></flow-film-library-example>`}];
