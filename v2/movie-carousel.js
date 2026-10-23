// Carousel is a local display preference; records and actions stay in Saved.
let movieDeck = null;
let movieDeckId = "";
let movieFiltersOpen = null;
let movieLayoutObserver = null;
let movieDeckMode = (() => { try { return localStorage.getItem("flow-movie-view") === "carousel"; } catch { return false; } })();
function moviePlansTab() { return ui.savedCategory === "movies" && !["viewed", "reco", "skipped"].includes(ui.savedFilter); }
function movieCarouselEnabled() { return moviePlansTab() && movieDeckMode; }
function movieBuiltinSection(section) { return /^(кино|фильмы|сериалы|анимация|мультфильмы)$/i.test(String(section?.name || "").trim()); }
function movieCarouselToggle() {
  if (!moviePlansTab()) return "";
  const label = movieDeckMode ? "Показать списком" : "Показать каруселью";
  return `<button type="button" class="icon-button movie-carousel-toggle ${movieDeckMode ? "active" : ""}" data-action="movie-carousel-toggle" aria-label="${label}" title="${label}" aria-pressed="${movieDeckMode}"><svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${movieDeckMode ? '<rect x="4" y="5" width="16" height="6" rx="2"/><rect x="4" y="14" width="16" height="6" rx="2"/>' : '<rect x="7" y="4" width="10" height="16" rx="2"/><path d="M3 7v10M21 7v10"/>'}</svg></button>`;
}
function movieCarouselScores(item) {
  const rating=Number(item.imdbRating)>0?['IMDb',item.imdbRating]:Number(item.kinopoiskRating)>0?['КП',item.kinopoiskRating]:Number(item.rating)>0?['Моя оценка',item.rating]:null;
  return rating?`<span class="movie-deck-rating">${icon('star','icon-sm')}<b>${movieScore(rating[1])}</b><small>/ 10 · ${rating[0]}</small></span>`:'<span class="movie-deck-rating is-empty">Пока без оценки</span>';
}
function movieCarouselActions(item) {
 return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet movie-deck-actions" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${esc(item.title)}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon('close')}</button></div><div class="movie-deck-actions-list"><button type="button" data-action="saved-edit">${icon('note','icon-sm')}Изменить</button><button type="button" data-action="saved-share">${icon('share','icon-sm')}Поделиться</button><button type="button" data-action="movie-skip">${icon('thumbDown','icon-sm')}Не интересно</button><button type="button" class="danger" data-action="saved-delete">${icon('trash','icon-sm')}Удалить</button></div></section></div>`;
}
function movieCarouselCard(item, index, slot) {
  return `<article class="movie-deck-card" data-index="${index}" data-slot="${slot}"><button type="button" class="movie-deck-poster" data-action="saved-open" data-category="movies" data-id="${esc(item.id)}" aria-label="Открыть ${esc(item.title)}">${movieCoverMarkup(item)}</button><button type="button" class="movie-deck-pin ${item.pinned ? "is-pinned" : ""}" data-action="saved-pin-card" data-category="movies" data-id="${esc(item.id)}" aria-label="${item.pinned ? "Открепить" : "Закрепить"}: ${esc(item.title)}" aria-pressed="${Boolean(item.pinned)}">${icon("bookmark", "icon-sm")}</button><button type="button" class="movie-deck-info" data-action="saved-open" data-category="movies" data-id="${esc(item.id)}"><strong>${esc(item.title)}</strong>${movieCarouselScores(item)}<span class="movie-deck-description">${esc(item.description && !movieBlurbEmpty(item.description) ? item.description : "Добавлен в планы на просмотр.")}</span></button></article>`;
}
function mountMovieCarousel() {
  const track = document.getElementById("movie-deck");
  if (movieDeck?.track === track) return;
  movieLayoutObserver?.disconnect();movieLayoutObserver=null;
  movieDeck?.destroy(); movieDeck = null;
  if (!track || !movieCarouselEnabled()) return;
  const items = savedVisibleItems();
  if (!items.length) return;
  const index = Math.max(0, items.findIndex(item => item.id === movieDeckId));
  sizeMovieCarousel(track);
  movieDeck = new LoopDeck(track, {count: items.length, index, card: (i, slot) => movieCarouselCard(items[i], i, slot), onAction: (action,i)=>{
    const item=savedItem('movies',items[i].id);if(!item)return;
    if(action==='viewed')toggleMovieViewed(item);
    else {ui.sheet={kind:'saved',category:'movies',id:item.id,mode:'carousel-actions',justRendered:false};render();}
  }, onChange: i => {
    movieDeckId = items[i].id;
    const count = document.getElementById("movie-deck-count");
    if (count) count.textContent = `${i + 1} из ${items.length}`;
  }});
  if(typeof ResizeObserver==='function'){
    movieLayoutObserver=new ResizeObserver(()=>{if(movieDeck?.track===track){sizeMovieCarousel(track);movieDeck.paint();}});
    track.closest('.movie-library-screen')?.querySelectorAll('.movie-island-row,.saved-section-heading,.movie-carousel-tabbar').forEach(node=>movieLayoutObserver.observe(node));
  }
}
function sizeMovieCarousel(track) {
  const screen=track.closest('.movie-library-screen'),filters=screen?.querySelector('.movie-carousel-filters');
  const toggle=screen?.querySelector('.movie-filter-toggle');
  if(!filters)return;
  filters.hidden=false;
  const viewport=window.visualViewport?.height || innerHeight;
  const counter=document.getElementById('movie-deck-count');
  const footer=Math.max((counter?.offsetHeight || 22)+16,56);
  const width=Math.min(480,innerWidth*.8,track.clientWidth*.94);
  const room=()=>viewport-(track.getBoundingClientRect().top+window.scrollY)-footer;
  filters.hidden=movieFiltersOpen===null ? width*1.5+160>room() : !movieFiltersOpen;
  toggle?.setAttribute('aria-expanded',String(!filters.hidden));
  track.dataset.heightLimit=String(Math.max(320,Math.floor(room())));
}
document.addEventListener("click", event => {
  const filters=event.target.closest('[data-action="movie-filters-toggle"]');
  if(filters){
    event.preventDefault();event.stopPropagation();
    movieFiltersOpen=filters.getAttribute('aria-expanded')!=='true';
    if(movieDeck){sizeMovieCarousel(movieDeck.track);movieDeck.paint();}
    else {
      const panel=filters.closest('.movie-library-screen')?.querySelector('.movie-carousel-filters');
      if(panel)panel.hidden=!movieFiltersOpen;
      filters.setAttribute('aria-expanded',String(movieFiltersOpen));
    }
    return;
  }
  const control = event.target.closest('[data-action="movie-carousel-toggle"]');
  if (control) {
    event.preventDefault(); event.stopPropagation(); movieDeckMode = !movieDeckMode;
    try { localStorage.setItem("flow-movie-view", movieDeckMode ? "carousel" : "list"); } catch {}
    window.scrollTo(0,0);render(); return;
  }
  const card = event.target.closest(".movie-deck-card");
  if (!card || !movieDeck) return;
  if (performance.now() < movieDeck.ignoreClickUntil) { event.preventDefault(); event.stopPropagation(); return; }
  if (Number(card.dataset.slot) !== Math.round(movieDeck.position)) {
    event.preventDefault(); event.stopPropagation(); movieDeck.select(Number(card.dataset.index), Number(card.dataset.slot));
  }
}, true);
document.addEventListener("keydown", event => {
  if (!event.target.closest("#movie-deck") || !movieDeck || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault(); movieDeck.nudge(event.key === "ArrowRight" ? 1 : -1);
});
window.addEventListener("resize", () => { if (movieDeck) { sizeMovieCarousel(movieDeck.track); movieDeck.select(Math.round(movieDeck.position), undefined, false); } });
window.visualViewport?.addEventListener('resize',()=>{if(movieDeck){sizeMovieCarousel(movieDeck.track);movieDeck.paint();}});
// Full renders and search-only result replacements share the same lifecycle.
new MutationObserver(mountMovieCarousel).observe(document.documentElement, {childList: true, subtree: true});
