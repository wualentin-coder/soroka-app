// Display groups only: marathon cards never become movie records or own their marks.
const movieMarathonPlans = {loading:false,at:0,error:'',queued:false,back:null};
let movieMarathonFrame=null;
function movieMarathonBegin(){movieMarathonFrame={identities:null};}
function movieMarathonEnd(){movieMarathonFrame=null;}
const movieMarathonIsCard = item => Boolean(item?._movieMarathon);
const movieMarathonPlansActive = settings => settings.savedCategory==='movies' && !['reco','skipped'].includes(settings.savedFilter);
function movieMarathonEntries(items,settings=ui) {
  if(!movieMarathonPlansActive(settings))return items;
  const all=savedItems('movies'),q=String(settings.savedQuery||'').trim().toLocaleLowerCase('ru-RU'),section=settings.savedSection||'',type=settings.movieType||'';
  const rows=[],hidden=new Set();
  const lists=universeUi.lists.filter(d=>!d.deleted_at);
  // Parse each library link once per calculation, not for every part of every list.
  // Rebuild from current records so in-place edits and refreshed lists stay visible.
  const identities=movieMarathonFrame?.identities || (lists.length?all.map(item=>({item,
    imdb:item.imdbUrl?.match(/\/title\/(tt\d+)/)?.[1] || item.imdbId,
    kp:typeof moviePlayerKinopoiskId==='function'?moviePlayerKinopoiskId(item):''
  })):[]);
  if(movieMarathonFrame)movieMarathonFrame.identities=identities;
  const byImdb=new Map(identities.filter(m=>m.imdb).map(m=>[m.imdb,m.item]));
  const byKp=new Map(identities.filter(m=>m.kp).map(m=>[String(m.kp),m.item]));
  const viewed=settings.savedFilter==='viewed';
  for(const d of lists) {
    const parts=universePartsVisible(d),imdbIds=new Set(parts.map(p=>p.imdbId).filter(Boolean)),kpIds=new Set(parts.map(p=>String(p.kpId||'')).filter(Boolean));
    const members=identities.filter(m=>(m.imdb&&imdbIds.has(m.imdb))||(m.kp&&kpIds.has(m.kp))).map(m=>m.item);
    const complete=parts.length>0 && parts.every(p=>{
      const episodes=p.kind==='series' && d.episode_progress?.[p.imdbId];
      if(episodes)return universeEpisodeSummary(episodes).fraction>=1;
      if(typeof d.progress?.[p.imdbId]==='boolean')return d.progress[p.imdbId];
      const own=byImdb.get(p.imdbId)||byKp.get(String(p.kpId||''));
      return own ? movieIsViewed(own) : false;
    });
    if(viewed!==complete) {
      if(!viewed)for(const m of members)hidden.add(m.id);
      continue;
    }
    // Specific watched filters describe individual films, not a collection's rating/year.
    if(viewed && settings.movieSeen)continue;
    const folderMatch=m=>!section || (section==='__none__'?!m.categoryId:m.categoryId===section);
    const scoped=members.filter(m=>folderMatch(m) && (!type || movieBaseType(m)===type) && (settings.savedFilter!=='pinned' || m.pinned));
    if(section && !scoped.length || settings.savedFilter==='pinned' && !scoped.length)continue;
    if(type && !scoped.length && !parts.some(p=>type==='series'?p.kind==='series':type==='movie'&&p.kind!=='series'))continue;
    if(q && ![d.title,...parts.flatMap(p=>[p.title,p.originalTitle]),...scoped.map(m=>`${m.title} ${m.description||''} ${(m.tags||[]).join(' ')}`)].some(t=>String(t||'').toLocaleLowerCase('ru-RU').includes(q)))continue;
    if(!viewed)for(const m of members)hidden.add(m.id);
    rows.push({id:`marathon:${d.id}`,title:d.title,_movieMarathon:d,memberIds:members.map(m=>m.id),pinned:members.some(m=>m.pinned),created:d.created_at||'',updated:d.updated_at||''});
  }
  return [...items.filter(m=>!hidden.has(m.id)),...rows].sort((a,b)=>sortSavedItems(a,b));
}
function movieMarathonCount(pool,section='',type='') {
  const filtered=pool.filter(m=>(!section || (section==='__none__'?!m.categoryId:m.categoryId===section)) && (!type || movieBaseType(m)===type));
  return movieMarathonEntries(filtered,{...ui,savedSection:section,movieType:type,savedQuery:''}).length;
}
function movieMarathonEnsure() {
  if(!movieMarathonPlansActive(ui) || !window.sorokaUniverse || movieMarathonPlans.loading || movieMarathonPlans.error || movieMarathonPlans.queued)return;
  if(Date.now()-Math.max(movieMarathonPlans.at,universeUi.loadedAt||0)<6*3600000)return;
  movieMarathonPlans.queued=true;setTimeout(()=>{movieMarathonPlans.queued=false;void movieMarathonLoad();},0);
}
async function movieMarathonLoad(force=false) {
  const state=movieMarathonPlans;if(state.loading)return;
  state.loading=true;state.error='';
  const baseline=new Map(universeUi.lists.map(d=>[d.id,d.version]));
  if(movieMarathonPlansActive(ui)&&!ui.sheet)render();
  try {
    const answer=await universeApi('lists',{force});
    const current=new Map(universeUi.lists.map(d=>[d.id,d]));
    const lists=(answer.lists||[]).filter(d=>!baseline.has(d.id)||current.has(d.id)).map(d=>current.get(d.id)?.version>d.version?current.get(d.id):d);
    for(const d of current.values())if(!lists.some(x=>x.id===d.id)&&(!baseline.has(d.id)||d.version>baseline.get(d.id)))lists.push(d);
    universeUi.lists=lists;state.at=Date.now();
  } catch(e) {state.error=universeError(e);}
  state.loading=false;if(movieMarathonPlansActive(ui)&&!ui.sheet)render();
}
function movieMarathonStatus() {
  if(!movieMarathonPlansActive(ui))return '';
  if(movieMarathonPlans.loading||movieMarathonPlans.queued)return '<p class="section-note" role="status">Загружаю марафоны…</p>';
  return movieMarathonPlans.error?`<p class="form-error" role="alert">${esc(movieMarathonPlans.error)}</p><button type="button" class="small-button" data-action="mu-plan-retry">Повторить загрузку марафонов</button>`:'';
}
function movieMarathonOpen(entry) {
  const d=entry?._movieMarathon || universeUi.lists.find(d=>d.id===entry?.id);if(!d||!confirmSheetDiscard())return;
  movieMarathonPlans.back={id:d.id,filter:ui.savedFilter,section:ui.savedSection,type:ui.movieType,query:ui.savedQuery,scroll:window.scrollY||0};
  ui.sheet=null;ui.savedFilter='reco';universeUi.tab='universes';universeUi.detail=structuredClone(d);universeUi.error='';
  if(d.order_mode==='story')void universeLoadStory(d);render();window.scrollTo(0,0);
}
function movieMarathonAction(action,control) {
  if(action==='mu-plan-retry'){void movieMarathonLoad(true);return true;}
  if(action==='mu-plan-open'){movieMarathonOpen({id:control.dataset.id});return true;}
  if(action==='mu-back'&&movieMarathonPlans.back){
    if(universeUi.detail?.id!==movieMarathonPlans.back.id){movieMarathonPlans.back=null;return false;}
    const back=movieMarathonPlans.back;movieMarathonPlans.back=null;universeUi.detail=null;universeUi.error='';
    Object.assign(ui,{savedFilter:back.filter,savedSection:back.section,movieType:back.type,savedQuery:back.query});render();window.scrollTo(0,back.scroll);return true;
  }
  return false;
}
function movieMarathonCopy(d) {
  const progress=universeProgress(d),parts=universePartsVisible(d),ordered=universeOrdered(d),route=ordered.length?ordered:parts;
  const front=route.find(p=>!universeSeen(p,d))||route[0]||{title:d.title};
  const art=[front,...parts.filter(p=>p.imdbId!==front.imdbId)].slice(0,3);
  return {progress,front,art,percent:universePercent(progress),description:parts.slice(0,3).map(p=>p.title).join(' · '),facts:`${parts.filter(p=>p.kind!=='series').length} фильмов · ${parts.filter(p=>p.kind==='series').length} сериалов`};
}
function movieMarathonListCard(entry) {
  const d=entry._movieMarathon,c=movieMarathonCopy(d);
  return `<button class="mu-card mm-list-card" type="button" data-action="mu-plan-open" data-id="${esc(d.id)}"><span class="mu-card-art">${c.art.map(p=>universePoster(p)).join('')}</span><span class="mu-card-copy"><small class="mm-kicker">${icon('archive','icon-sm')}Марафон</small><strong>${esc(d.title)}</strong><small>${esc(c.facts)}</small><span class="mu-progress"><i style="width:${c.percent}%"></i></span><small>${c.progress.seen} из ${c.progress.all} частей · ${c.percent.toLocaleString('ru-RU')}%</small></span>${icon('right','icon-sm')}</button>`;
}
function movieMarathonCarouselCard(entry,index,slot) {
  const d=entry._movieMarathon,c=movieMarathonCopy(d),open=`data-action="mu-plan-open" data-id="${esc(d.id)}"`;
  const layers=[1,2].map(n=>`<span class="mm-stack-sheet mm-stack-${n}" aria-hidden="true">${c.art[n]?.coverPath?`<img src="${esc(c.art[n].coverPath)}" alt="" loading="lazy">`:''}</span>`).join('');
  return `<article class="movie-deck-card is-marathon" data-index="${index}" data-slot="${slot}">${layers}<div class="mm-front"><button class="movie-deck-poster" type="button" ${open} aria-label="Открыть марафон ${esc(d.title)}">${movieCoverMarkup(c.front)}</button><span class="mm-deck-label">${icon('archive','icon-sm')}Марафон</span><button class="movie-deck-info" type="button" ${open}><strong>${esc(d.title)}</strong><span class="movie-deck-metadata">${esc(c.facts)}</span><span class="mu-progress"><i style="width:${c.percent}%"></i></span><span class="mm-deck-progress">${c.progress.seen} из ${c.progress.all} частей · ${c.percent.toLocaleString('ru-RU')}%</span><span class="movie-deck-description">${esc(c.description)}</span><span class="mm-deck-open">Открыть марафон${icon('right','icon-sm')}</span></button></div></article>`;
}
