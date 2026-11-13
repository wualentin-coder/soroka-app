/* R10 presentation over the mature Movies owners. No record, transport or deck replacement. */
(() => {
 'use strict';
 if(document.documentElement.dataset.flowDesign==='classic'||window.flowFilms)return;
 const parse=html=>{const t=document.createElement('template');t.innerHTML=html;return t;};
 const wrap=(name,project)=>{const native=window[name];if(typeof native!=='function')return;window[name]=function(...args){return project(native.apply(this,args),...args);};};
 const motion=()=>!document.hidden&&document.documentElement.dataset.motion!=='off'&&!(document.documentElement.dataset.motion!=='on'&&matchMedia('(prefers-reduced-motion:reduce)').matches);
 const animations=new Set(),responses=new Set();let owner='',pageStamp='',entries=0,presses=0,choice=null;
 function animate(node,frames,options,done){const a=node.animate(frames,options);animations.add(a);a.finished.catch(()=>{}).finally(()=>{animations.delete(a);done?.();});return a;}
 function clear(){for(const a of animations)a.cancel();animations.clear();for(const node of responses)node.remove();responses.clear();}
 wrap('savedRecordCardBody',(html,item,category)=>{
  if(category!=='movies')return html;const t=parse(html),card=t.content.querySelector('.record-card');if(!card)return html;
  card.classList.add('df-film-card');card.querySelector('.dc2-film-copy>small')?.remove();return t.innerHTML;
 });
 wrap('renderSavedPage',html=>{
  if(ui.savedCategory!=='movies')return html;const t=parse(html),page=t.content.querySelector('.dc2-movies');if(!page)return html;page.classList.add('df-movies');
  const toolbar=page.querySelector('.dc-movie-title-row'),actions=toolbar?.querySelector('.movie-toolbar-actions');if(toolbar&&actions)toolbar.style.setProperty('--df-toolbar-count',String(actions.children.length+1));
  const random=page.querySelector('[data-action=movie-random]');if(random)random.innerHTML='<svg class="icon df-shuffle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 3 3 3-3 3M18 15l3 3-3 3M3 6h2c5 0 9 12 14 12h2M3 18h2c2 0 4-2 6-5M13 9c2-2 4-3 6-3h2"/></svg>';
  const select=page.querySelector('#saved-show');if(select){select.hidden=true;select.tabIndex=-1;const trigger=document.createElement('button');trigger.type='button';trigger.className='df-sort';trigger.dataset.filmSort='';trigger.setAttribute('aria-label','Порядок фильмов: '+select.selectedOptions[0]?.textContent);trigger.setAttribute('aria-haspopup','dialog');trigger.innerHTML='<span>'+esc(select.selectedOptions[0]?.textContent||'Порядок')+'</span>'+icon('down','icon-sm');select.after(trigger);}
  return t.innerHTML;
 });
 function relatedCard(html){const t=parse(html);for(const card of t.content.querySelectorAll('.record-card.movie-card')){card.classList.add('df-film-card','df-reco-card');const poster=card.querySelector(':scope>.movie-cover');if(poster){const slot=document.createElement('span');slot.className='dc2-poster';poster.before(slot);slot.append(poster);}const copy=card.querySelector('.movie-card-body');if(copy){copy.classList.add('dc2-film-copy');if(!card.classList.contains('similar-own'))copy.querySelector('.movie-card-kicker')?.remove();const title=copy.querySelector('.movie-card-title');if(title){const strong=document.createElement('strong');strong.textContent=title.textContent;title.replaceWith(strong);}const description=copy.querySelector('.movie-card-description');if(description){const p=document.createElement('p');p.textContent=description.textContent;description.replaceWith(p);}}}return t.innerHTML;}
 wrap('recoCard',relatedCard);
 function filmSheet(html,item){
  const t=parse(html),sheet=t.content.querySelector('.sheet');if(!sheet)return html;sheet.classList.add('df-film-sheet');
  const head=sheet.querySelector('.sheet-head');
  if(head&&!head.querySelector('.dc2-window-tools')){const title=head.querySelector('h2'),copy=document.createElement('div'),tools=document.createElement('div');tools.className='dc2-window-tools';if(title)copy.append(title);for(const button of [...head.querySelectorAll('button')])tools.append(button);head.replaceChildren(copy,tools);}
  const raw=sheet.querySelector('.movie-detail-hero');if(raw){const identity=document.createElement('section');identity.className='dc2-film-identity';const art=document.createElement('div');art.className='dc2-film-art';const poster=raw.querySelector('.movie-cover');if(poster)art.append(poster);const intro=raw.querySelector('.movie-detail-intro')||document.createElement('div');intro.classList.add('dc2-film-heading');const links=intro.querySelector('.movie-detail-buttons');if(links){links.classList.add('dc2-film-links');raw.after(links);}identity.append(art,intro);raw.replaceWith(identity);}
  const identity=sheet.querySelector('.dc2-film-identity'),heading=identity?.querySelector('h2');
  if(head&&heading){head.firstElementChild?.querySelector('p')?.remove();head.firstElementChild?.append(heading);}
  if(identity){
   const intro=identity.querySelector('.dc2-film-heading'),links=sheet.querySelector('.dc2-film-links');
   if(item){const meta=intro?.querySelector('.movie-detail-meta'),genres=[...new Map([item.genre,...(item.tags||[])].filter(Boolean).map(value=>[String(value).toLocaleLowerCase('ru'),value])).values()];if(meta)meta.textContent=[item.year,genres.join(', '),(item.countries||[]).join(', '),item.minutes?`${item.minutes} мин`:''].filter(Boolean).join(' · ');}
   if(intro&&links){const facts=document.createElement('div');facts.className='df-film-scores';for(const score of [...links.querySelectorAll('.movie-detail-score')])facts.append(score);intro.append(facts);}
   const quick=document.createElement('div');quick.className='df-film-quick-actions';
   const watch=links?.querySelector('.movie-watch-btn'),similar=sheet.querySelector('.dc2-film-discovery [data-action=movie-similar]');if(watch)quick.append(watch);if(similar)quick.append(similar);
   if(quick.children.length)identity.after(quick);if(links&&!links.children.length)links.remove();
   const discovery=sheet.querySelector('.dc2-film-discovery');if(discovery&&!discovery.children.length)discovery.remove();
  }
  const rating=sheet.querySelector('.movie-personal-rating');
  if(rating&&item&&typeof starSlider==='function'){
   const row=document.createElement('div');row.className='df-rating-row';row.innerHTML=starSlider(item)+'<output class="star-value" aria-live="polite">'+(item.rating?esc(item.rating)+'<small>/10</small>':'<small>—</small>')+'</output>';
   rating.querySelector('.stars')?.remove();rating.querySelector('.movie-personal-rating-head>b')?.remove();rating.append(row);
  }
  if(!sheet.querySelector(':scope>.dc2-window-body')&&!sheet.querySelector('#saved-form')){const body=document.createElement('div');body.className='dc2-window-body';for(const child of [...sheet.children])if(!child.matches('.sheet-head,.sheet-handle,.sheet-actions,.saved-view-actions,.movie-run-actions'))body.append(child);const footer=sheet.querySelector(':scope>.sheet-actions,:scope>.saved-view-actions,:scope>.movie-run-actions');footer?.classList.add('dc2-window-actions');if(footer)footer.before(body);else sheet.append(body);}
  return t.innerHTML;
 }
 wrap('renderSavedViewSheet',(html,item,category)=>category==='movies'?filmSheet(html,item):html);
 wrap('renderRecoDetailSheet',html=>filmSheet(html));
 for(const name of ['renderMovieSimilarSheet','renderMovieDialog','renderMovieSeriesPartSheet','renderUniverseSheet','renderMovieRateSheet'])wrap(name,html=>filmSheet(relatedCard(html)));
 wrap('renderMovieRunSheet',html=>{
  const t=parse(html),pad=t.content.querySelector('.run-pad');
  const review=t.content.querySelector('.movie-run-form');if(review)review.dataset.stateKey=String(ui.sheet.queue?.[ui.sheet.index]||'');
  if(pad&&!pad.classList.contains('df-run-stars')){
   pad.classList.add('df-run-stars');
   for(const button of pad.children){button.innerHTML=movieStarIcon();button.setAttribute('aria-pressed',String(Number(button.dataset.value)===Number(ui.sheet.pick)));}
   const row=document.createElement('div');row.className='df-rating-row';pad.before(row);row.append(pad);
   const value=document.createElement('output');value.className='star-value';value.setAttribute('aria-live','polite');value.textContent=ui.sheet.pick?`${ui.sheet.pick}/10`:'—';row.append(value);
   const rewatch=t.content.querySelector('[data-action=movie-run-rewatch]');if(rewatch){rewatch.setAttribute('aria-label','Пересмотреть');rewatch.title='Пересмотреть';rewatch.innerHTML=icon('reset','icon-sm');}
  }
  return filmSheet(t.innerHTML);
 });
 const advanceRun=window.movieRunAdvance;
 if(typeof advanceRun==='function')window.movieRunAdvance=function(...args){const result=advanceRun.apply(this,args);for(const a of document.querySelector('.df-film-sheet .movie-run-card')?.getAnimations()||[]){if(!motion())a.cancel();else a.effect?.updateTiming({duration:520,easing:'cubic-bezier(.4,0,.2,1)'});}return result;};
 wrap('renderSavedSheet',html=>{if(ui.sheet?.category!=='movies')return html;const t=parse(html);if(!t.content.querySelector('#saved-form'))return html;const head=t.content.querySelector('.sheet-head');head?.querySelector('p')?.remove();const title=head?.querySelector('h2');if(title)title.textContent=ui.sheet.id?'Изменить фильм':'Добавить фильм';return t.innerHTML;});
 // Include loading/error/retry states that the older presentation wrapper hid.
 // The native series renderer already omits films with no related parts.
 const filmKinds=new Set(['saved-add-menu','movie-similar','movie-dialog','movie-card-actions','movie-series-part','movie-run','movie-reco-detail','carousel-actions']);
 const nativeRender=window.render;
 window.render=function(...args){
  const result=nativeRender.apply(this,args),inFilms=ui.page==='saved'&&ui.savedCategory==='movies';
  if(!inFilms){clear();closeChoice();pageStamp='';owner='';return result;}
  if(ui.sheet&&(ui.sheet.category==='movies'||filmKinds.has(ui.sheet.kind)||/^movie-|^mu-|^universe-/.test(ui.sheet.kind)))document.querySelectorAll('#app .sheet:not(.note-sheet)').forEach(n=>n.classList.add('df-film-sheet'));
  const nextOwner=ui.sheet?[ui.sheet.kind,ui.sheet.id,ui.sheet.mode].join(':'):'';
  if(nextOwner!==owner){clear();owner=nextOwner;if(motion()&&owner){const sheet=document.querySelector('.df-film-sheet');for(const node of sheet?.querySelectorAll('.sheet-head,.dc2-film-identity')||[])animate(node,[{opacity:.65,translate:'0 5px'},{opacity:1,translate:'0 0'}],{duration:520,easing:'cubic-bezier(.4,0,.2,1)'});}}
  const stamp=[ui.savedFilter,movieDeckMode,ui.savedFilter==='reco'?universeUi.tab:'',ui.savedFilter==='reco'?universeUi.detail?.id||universeUi.detail?.source||'':''].join(':');if(pageStamp!==stamp){clear();pageStamp=stamp;if(motion()&&!ui.sheet){const nodes=document.querySelectorAll('.df-movies .record-card,.df-movies .mu-own-row,.df-movies .mu-hero,.df-movies .mu-catalog');for(const [i,node] of [...nodes].slice(0,6).entries())animate(node,[{opacity:.7,translate:'0 5px'},{opacity:1,translate:'0 0'}],{duration:520,delay:i*35,fill:'backwards',easing:'cubic-bezier(.4,0,.2,1)'});entries++;}}
  return result;
 };
 function closeChoice(){if(!choice)return;const {dialog,trigger}=choice;choice=null;dialog.close();dialog.remove();if(trigger.isConnected)trigger.focus({preventScroll:true});}
 function openSort(trigger){
  closeChoice();const select=document.querySelector('.df-movies #saved-show');if(!select)return;
  const dialog=document.createElement('dialog');dialog.className='df-choice';dialog.setAttribute('aria-labelledby','df-choice-title');dialog.innerHTML='<h2 id="df-choice-title">Порядок фильмов</h2><div class="df-choice-options">'+[...select.options].map(o=>'<button type="button" data-film-sort-value="'+esc(o.value)+'" aria-pressed="'+o.selected+'"><span>'+esc(o.textContent)+'</span>'+(o.selected?icon('check','icon-sm'):'')+'</button>').join('')+'</div>';document.body.append(dialog);choice={dialog,trigger};
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeChoice();});dialog.addEventListener('click',event=>{const button=event.target.closest('[data-film-sort-value]');if(button){const current=document.querySelector('.df-movies #saved-show'),value=button.dataset.filmSortValue;closeChoice();if(!current||![...current.options].some(option=>option.value===value))return;current.value=value;current.dispatchEvent(new Event('change',{bubbles:true}));}else if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeChoice();}});dialog.showModal();dialog.querySelector('[aria-pressed=true]')?.focus();
 }
 document.addEventListener('click',event=>{const button=event.target.closest('[data-film-sort]');if(button){event.preventDefault();openSort(button);}},true);
 function respond(event){
  const sheet=event.target.closest('.df-film-sheet');
  if(!motion()||choice||!sheet&&(ui.sheet||typeof movieDeck!=='undefined'&&(movieDeck?.drag||movieDeck?.spinning||Date.now()<(movieDeck?.ignoreClickUntil||0))))return;
  const surface=sheet||event.target.closest('.df-movies .record-card-shell,.df-movies .movie-deck-card.active,.df-movies .df-reco-card,.df-movies .mu-own-row,.df-movies .mu-hero,.df-movies .mu-catalog,.df-movies .reco-load,.df-movies .mu-episode-panel');if(!surface)return;
  const r=surface.getBoundingClientRect(),style=getComputedStyle(surface),radius=style.borderRadius;if(!r.width)return;
  const layer=document.createElement('i');layer.className='df-surface-response';layer.setAttribute('aria-hidden','true');layer.style.cssText=`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:${radius}`;if(!parseFloat(radius)||!parseFloat(style.borderTopWidth))layer.style.boxShadow='none';document.body.append(layer);responses.add(layer);presses++;
  animate(layer,[{opacity:0},{opacity:.65,offset:.22},{opacity:0}],{duration:1000,easing:'cubic-bezier(.4,0,.2,1)'},()=>{layer.remove();responses.delete(layer);});
 }
 document.addEventListener('pointerdown',respond,{passive:true});document.addEventListener('scroll',clear,{capture:true,passive:true});window.addEventListener('resize',clear);window.addEventListener('pagehide',()=>{clear();closeChoice();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();closeChoice();}});document.addEventListener('flow:effectschange',()=>{if(!motion())clear();});
 function composer(){const state=window.flowCompose?.getState?.();if(state?.open&&state.context==='movies')state.layer?.classList.add('df-film-composer');}
 document.addEventListener('flow:composer',composer);
 window.flowFilms={getState:()=>({entries,presses,animations:animations.size,responses:responses.size,choice:!!choice}),refresh:()=>render()};render();
})();
