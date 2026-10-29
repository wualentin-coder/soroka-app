const universeEpisodeUi={expanded:new Set(),seasons:new Set(),closedPhases:new Set(),loading:new Set(),errors:new Map()};
const universeEpisodeKey=e=>`${e.season}:${e.episode}`;
const universeToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function universeEpisodeSummary(state){
  const today=universeToday(),aired=(state?.catalog||[]).filter(e=>e.date<=today),seen=new Set(state?.seen||[]),done=aired.filter(e=>seen.has(universeEpisodeKey(e))).length;
  return {seen:done,total:aired.length,fraction:aired.length?done/aired.length:0,complete:!!aired.length&&done===aired.length};
}
function universePartFraction(p,d){
  const state=p.kind==='series'?d?.episode_progress?.[p.imdbId]:null;
  return state?universeEpisodeSummary(state).fraction:universeBaseSeen(p,d)?1:0;
}
function universePercent(p){return p.all?Math.round(p.score/p.all*1000)/10:0;}
function renderUniversePartRow(p,i,d){
  const series=p.kind==='series',state=d.episode_progress?.[p.imdbId],summary=state?universeEpisodeSummary(state):null,seen=universeSeen(p,d),open=universeEpisodeUi.expanded.has(p.imdbId);
  const facts=[p.year,series?'Сериал':'Фильм',summary?`${summary.seen} / ${summary.total} серий`:null,p.released&&p.released>universeToday()?'Скоро':null,p.unplaced?'Место в сюжете не подтверждено':seen?'Просмотрено':null].filter(Boolean).map(esc).join(' · ');
  const row=`<div class="mu-part-row ${series?'is-series':''} ${seen?'is-seen':''}"><button class="mu-tick" type="button" data-action="mu-seen" data-imdb="${esc(p.imdbId)}" aria-label="${seen?'Снять просмотр':'Отметить просмотренным'}: ${esc(p.title)}" aria-pressed="${seen}" ${universeUi.busy?'disabled':''}>${seen?icon('check','icon-sm'):p.unplaced?'?':i+1}</button><button class="mu-part-open" type="button" data-action="${series?'mu-series-expand':'mu-part'}" data-imdb="${esc(p.imdbId)}" ${series?`aria-expanded="${open}"`:''}>${universePoster(p)}<span><b>${esc(p.title)}</b><small>${facts}</small>${summary?`<span class="mu-progress"><i style="width:${summary.fraction*100}%"></i></span>`:''}</span>${icon(series?(open?'up':'down'):'right','icon-sm')}</button>${series?`<button class="icon-button mu-series-info" type="button" data-action="mu-part" data-imdb="${esc(p.imdbId)}" aria-label="Карточка сериала ${esc(p.title)}">${icon('more','icon-sm')}</button>`:''}</div>`;
  return series?`<div class="mu-series-entry">${row}${renderUniverseEpisodePanel(p,d)}</div>`:row;
}
function universeAcceptList(list){
  const s=universeUi;s.lists=[list,...s.lists.filter(x=>x.id!==list.id)];
  if(s.detail?.id===list.id)s.detail=structuredClone(list);
}
async function universeLoadEpisodes(p,force=false){
  const s=universeUi,d=s.detail;if(!d||universeEpisodeUi.loading.has(p.imdbId))return false;
  const op=`episodes:${p.imdbId}`;universeEpisodeUi.loading.add(p.imdbId);universeEpisodeUi.errors.delete(p.imdbId);
  universeOperationStart(op,`Загружаю сезоны «${p.title}»`,'Получаю список серий и даты выхода из IMDb');universePaint();
  try{
    let current=d;
    if(current.version===undefined){current=await universeSave(current);if(!current)return false;}
    const answer=await universeApi('episodes',{id:current.id,imdbId:p.imdbId,force});
    if(!answer.list?.episode_progress?.[p.imdbId])throw Error('episodes_unavailable');
    universeAcceptList(answer.list);return true;
  }catch(e){universeEpisodeUi.errors.set(p.imdbId,universeError(e));return false;}
  finally{universeEpisodeUi.loading.delete(p.imdbId);universeOperationEnd(op);universePaint();}
}
async function universeToggleEpisode(p,selection={}){
  const s=universeUi;if(!s.detail||s.busy)return;
  if(!s.detail.episode_progress?.[p.imdbId]&&!await universeLoadEpisodes(p))return;
  const d=s.detail;if(!d?.id)return;
  s.busy=true;s.error='';universeOperationStart('episode-save','Сохраняю отметку серии','Прогресс марафона обновится после сохранения');universePaint();
  try{const {list}=await universeApi('episode_toggle',{id:d.id,version:d.version,imdbId:p.imdbId,...selection});universeAcceptList(list);}
  catch(e){s.error=universeError(e);}
  finally{s.busy=false;universeOperationEnd('episode-save');universePaint();}
}
function renderUniverseEpisodePanel(p,d){
  if(!universeEpisodeUi.expanded.has(p.imdbId))return '';
  const state=d.episode_progress?.[p.imdbId],loading=universeEpisodeUi.loading.has(p.imdbId),error=universeEpisodeUi.errors.get(p.imdbId);
  if(!state)return `<div class="mu-episode-panel">${loading?'<p class="section-note" role="status">Получаю сезоны и серии…</p>':`<p class="section-note">${esc(error||'Список серий ещё не загружен.')}</p><button class="small-button" type="button" data-action="mu-episode-retry" data-imdb="${esc(p.imdbId)}">Повторить</button>`}</div>`;
  const seasons=[...new Set(state.catalog.map(e=>e.season))],today=universeToday(),seen=new Set(state.seen);
  return `<div class="mu-episode-panel">${error?`<p class="form-error">${esc(error)}</p>`:''}${!seasons.length?'<p class="section-note">В IMDb пока нет серий с подтверждёнными датами выхода.</p>':''}${seasons.map(n=>{
    const eps=state.catalog.filter(e=>e.season===n),aired=eps.filter(e=>e.date<=today),done=aired.filter(e=>seen.has(universeEpisodeKey(e))).length,key=`${p.imdbId}:${n}`,open=universeEpisodeUi.seasons.has(key);
    return `<section class="mu-season"><div class="mu-season-head"><button class="mu-episode-tick" type="button" data-action="mu-season-mark" data-imdb="${esc(p.imdbId)}" data-season="${n}" aria-label="${done===aired.length&&done?'Снять отметки':'Отметить просмотренным'}: сезон ${n}" aria-pressed="${!!aired.length&&done===aired.length}" ${!aired.length||universeUi.busy?'disabled':''}>${done===aired.length&&done?icon('check','icon-sm'):icon('list','icon-sm')}</button><button class="mu-season-open" type="button" data-action="mu-season-open" data-imdb="${esc(p.imdbId)}" data-season="${n}" aria-expanded="${open}"><b>Сезон ${n}</b><small>${done} / ${aired.length}</small>${icon(open?'up':'down','icon-sm')}</button></div>${open?`<div class="mu-episode-list">${eps.map(e=>{const future=e.date>today,watched=seen.has(universeEpisodeKey(e))&&!future;return `<button class="mu-episode-row" type="button" data-action="mu-episode-mark" data-imdb="${esc(p.imdbId)}" data-season="${n}" data-episode="${e.episode}" aria-pressed="${watched}" ${future||universeUi.busy?'disabled':''}><span class="mu-episode-tick">${watched?icon('check','icon-sm'):e.episode}</span><span><b>Серия ${e.episode}</b><small>${future?'Скоро · ':''}${esc(e.date)}</small></span></button>`;}).join('')}</div>`:''}</section>`;
  }).join('')}<button class="text-action" type="button" data-action="mu-episode-retry" data-imdb="${esc(p.imdbId)}" ${loading?'disabled':''}>${loading?'Обновляю серии…':'Обновить серии'}</button></div>`;
}
function universeEpisodeAction(action,control){
  if(!['mu-series-expand','mu-season-open','mu-season-mark','mu-episode-mark','mu-episode-retry'].includes(action))return false;
  const d=universeUi.detail,p=d?.parts.find(p=>p.imdbId===control.dataset.imdb),key=control.dataset;
  if(!p||p.kind!=='series')return true;
  if(action==='mu-series-expand'){
    if(universeEpisodeUi.expanded.has(p.imdbId))universeEpisodeUi.expanded.delete(p.imdbId);
    else{universeEpisodeUi.expanded.add(p.imdbId);void universeLoadEpisodes(p);}
    render();
  }else if(action==='mu-season-open'){
    const id=`${p.imdbId}:${key.season}`;if(universeEpisodeUi.seasons.has(id))universeEpisodeUi.seasons.delete(id);else universeEpisodeUi.seasons.add(id);render();
  }else if(action==='mu-episode-retry')void universeLoadEpisodes(p,true);
  else void universeToggleEpisode(p,{season:Number(key.season),...(action==='mu-episode-mark'?{episode:Number(key.episode)}:{})});
  return true;
}

document.addEventListener?.('toggle',event=>{
  const node=event.target;if(!node?.isConnected||!node.matches?.('details[data-universe-phase]'))return;
  const key=node.dataset.universePhase;if(node.open)universeEpisodeUi.closedPhases.delete(key);else universeEpisodeUi.closedPhases.add(key);
},true);
