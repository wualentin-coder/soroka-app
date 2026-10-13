/* A wish is not a failed price check. Searching is always an explicit action. */
const productWishStates = new Map();
const productWishStores = [['ozon','Ozon'],['wb','WB'],['dns','DNS'],['mvideo','М.Видео'],['poizon','Poizon']];
function isProductWish(item) { return !String(item?.url || '').trim() && !(Number(item?.price) > 0); }
function productWishTabs() {
  const wishes = savedItems('products').filter(isProductWish).length;
  const active = ui.productTab === 'wishes' ? 'wishes' : 'products';
  return `<div class="movie-seen-tabs product-tabs" role="group" aria-label="Товары"><button type="button" data-action="product-wish-tab" data-tab="products" class="${active==='products'?'active':''}" aria-pressed="${active==='products'}">Товары<span>${savedItems('products').length-wishes}</span></button><button type="button" data-action="product-wish-tab" data-tab="wishes" class="${active==='wishes'?'active':''}" aria-pressed="${active==='wishes'}">Без цены<span>${wishes}</span></button></div>`;
}
function productWishRow(item) {
  return `<button type="button" class="product-wish-row" data-action="saved-open" data-category="products" data-id="${esc(item.id)}"><span class="product-wish-symbol">${icon(item.pinned?'heart':'wallet','icon-sm')}</span><span><strong>${esc(item.title)}</strong><small>${esc(item.description || (item.targetPrice>0?`Бюджет до ${rub(item.targetPrice)}`:'Выберите товар по ссылке или через подбор'))}</small></span>${icon('right','icon-sm')}</button>`;
}
function wishState(item) {
  let s=productWishStates.get(item.id);
  if (!s) {
    s={params:{query:[item.title,item.description].filter(Boolean).join('. '),min:'',max:item.targetPrice||'',count:5,stores:productWishStores.map(x=>x[0])},answer:{state:'idle'},sort:'value',error:'',dirty:false,loading:false,busy:false};
    productWishStates.set(item.id,s);
  }
  return s;
}
function wishError(error) {
  return ({invalid_search:'Проверьте бюджет, количество вариантов и выбор магазинов.',unsupported_product_link:'Вставьте прямую HTTPS-ссылку на товар Ozon, WB, DNS, М.Видео или Poizon.',product_exists:'Этот товар уже сохранён. Выберите другой или откройте его в «Товарах».',not_a_wish:'Для этой хотелки уже выбран товар. Обновите список.',wish_already_selected:'Для этой хотелки уже выбран товар.',invalid_selection:'Результат устарел. Откройте подбор заново.',search_timeout:'Поиск не завершился. Запустите подбор ещё раз.',search_unavailable:'Поиск не ответил. Попробуйте ещё раз или добавьте ссылку.',service_unavailable:'Сервис временно недоступен. Попробуйте ещё раз.'})[error?.message || error] || 'Не удалось выполнить действие. Попробуйте ещё раз.';
}
function wishSortedResults(s) {
  const items=(s.answer.result?.items || []).slice();
  if (s.sort==='price') items.sort((a,b)=>(a.price??Infinity)-(b.price??Infinity));
  if (s.sort==='reviews') {
    const quality=x=>x.rating==null?-1:((x.reviews||0)*x.rating+20*3.5)/((x.reviews||0)+20);
    items.sort((a,b)=>quality(b)-quality(a)||(b.reviews||0)-(a.reviews||0));
  }
  return items;
}
function wishResults(item,s) {
  const state=s.answer.state;
  if (s.loading || state==='running') return `<p class="section-note wish-search-progress" role="status"><span class="live-spin"></span>Подбираю товары и проверяю источники…</p>`;
  if (state==='failed') return `<p class="form-error" role="alert">${esc(wishError(s.answer.result?.error))}</p>`;
  if (state!=='success') return `<p class="section-note">Подбор запускается кнопкой. Открытие окна и сортировка не расходуют ИИ.</p>`;
  const items=wishSortedResults(s);
  if (!items.length) return `<div class="wish-search-empty"><strong>Подходящих вариантов не найдено</strong><p>Попробуйте уточнить запрос, расширить бюджет или выбрать другие магазины. Неподтверждённые цены не включаются в подбор с бюджетом.</p></div>`;
  return `<div class="wish-results-head"><strong>Варианты · ${items.length}</strong><label class="field"><span class="sr-only">Сортировка вариантов</span><select data-wish-sort aria-label="Сортировка вариантов"><option value="value" ${s.sort==='value'?'selected':''}>Лучшее за свои деньги</option><option value="price" ${s.sort==='price'?'selected':''}>Дешевле</option><option value="reviews" ${s.sort==='reviews'?'selected':''}>По отзывам</option></select></label></div>${s.answer.result?.note?`<p class="section-note">${esc(s.answer.result.note)}</p>`:''}<ol class="wish-candidates">${items.map((x,i)=>`<li class="wish-candidate"><div class="wish-candidate-head"><span class="wish-rank">${i+1}</span><div><strong>${esc(x.title)}</strong><small>${esc(x.store)}</small></div><b>${x.price>0?rub(x.price):'Цена не подтверждена'}</b></div><p class="wish-review-line">${x.rating!=null?`★ ${esc(x.rating)}`:'Рейтинг неизвестен'}${x.reviews!=null?` · Оценки/отзывы: ${Number(x.reviews).toLocaleString('ru-RU')}`:''}</p><p class="wish-reason">${esc(x.reason)}</p>${x.caveat?`<p class="section-note">${esc(x.caveat)}</p>`:x.rating!=null&&x.reviews!=null&&x.reviews<5?'<p class="section-note">Оценок пока мало — рейтинг может быть неустойчивым.</p>':''}<p class="section-note">${x.priceSource==='search'?'Цена из поисковой выдачи; перед покупкой сверить в магазине.':x.priceSource==='page'?'Цена из карточки магазина.':''}</p><div class="inline-actions"><a class="small-button" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Магазин ${icon('external','icon-sm')}</a><button type="button" class="primary-button" data-action="product-wish-select" data-url="${esc(x.url)}" ${s.busy?'disabled':''}>Выбрать</button></div></li>`).join('')}</ol>`;
}
function renderProductWishSheet(item) {
  const s=wishState(item), p=s.params;
  if (s.sheet !== ui.sheet) { s.sheet=ui.sheet; Promise.resolve().then(()=>loadWishState(item)); }
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet saved-view-sheet product-wish-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${esc(item.title)}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon('close')}</button></div><p class="eyebrow">Товары · Без цены</p>${item.description?`<p class="saved-prose">${esc(item.description)}</p>`:''}<form id="product-wish-link"><label class="field">Ссылка на товар<input name="url" type="url" placeholder="https://…" required value="${esc(s.link||'')}" inputmode="url"></label><button class="primary-button" type="submit" ${s.busy?'disabled':''}>Привязать ссылку</button></form><div class="wish-divider"><span>или подобрать</span></div><form id="product-wish-search"><label class="field">Что ищем<textarea name="query" maxlength="600" required placeholder="Характеристики и пожелания">${esc(p.query)}</textarea></label><div class="field-row"><label class="field">Бюджет от, ₽<input name="min" type="number" min="0" max="10000000" value="${esc(p.min??'')}" placeholder="Не важно"></label><label class="field">До, ₽<input name="max" type="number" min="0" max="10000000" value="${esc(p.max??'')}" placeholder="Не важно"></label></div><label class="field">Сколько вариантов<select name="count">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}" ${Number(p.count)===n?'selected':''}>${n}</option>`).join('')}</select></label><fieldset class="wish-store-picker"><legend>Где искать</legend>${productWishStores.map(([key,label])=>`<label><input type="checkbox" name="stores" value="${key}" ${p.stores.includes(key)?'checked':''}><span>${label}</span></label>`).join('')}</fieldset><button class="primary-button" type="submit" data-wish-search-button ${s.loading||s.busy||s.answer.state==='running'?'disabled':''}>${s.answer.state==='running'?'Идёт подбор…':'Подобрать с ИИ'}</button></form><p class="form-error" data-wish-error role="alert">${esc(s.error)}</p><div class="product-wish-results" aria-live="polite">${wishResults(item,s)}</div><div class="inline-actions saved-view-actions"><button type="button" data-action="saved-edit">${icon('note')}Изменить хотелку</button><button type="button" class="danger" data-action="saved-delete">${icon('trash')}Удалить</button></div></section></div>`;
}
function wishIsOpen(ref) { return ui.sheet?.kind==='saved' && ui.sheet.category==='products' && ui.sheet.id===ref && ui.sheet.mode!=='edit'; }
function patchWish(item) {
  if (!wishIsOpen(item.id)) return;
  const s=wishState(item), root=document.querySelector('.product-wish-sheet');
  if (!root) return;
  const results=root.querySelector('.product-wish-results');
  const scroll=root.scrollTop;
  results.innerHTML=wishResults(item,s);
  root.querySelector('[data-wish-error]').textContent=s.error;
  const button=root.querySelector('[data-wish-search-button]');
  button.disabled=s.loading||s.busy||s.answer.state==='running';
  button.textContent=s.answer.state==='running'?'Идёт подбор…':'Подобрать с ИИ';
  root.querySelector('#product-wish-link button').disabled=s.busy;
  for(const button of root.querySelectorAll('.saved-view-actions button')) button.disabled=s.busy;
  root.scrollTop=scroll;
}
function wishPoll(item) {
  const s=wishState(item); clearTimeout(s.timer);
  if (!wishIsOpen(item.id) || s.answer.state!=='running') return;
  s.timer=setTimeout(async()=>{
    if (!wishIsOpen(item.id)) return;
    if (document.hidden) { wishPoll(item);return; }
    try { s.answer=await window.sorokaWishState(item.id,s.answer.searchId);s.error=''; }
    catch(error) { s.error=wishError(error); }
    patchWish(item);wishPoll(item);
  },3000);
}
async function loadWishState(item) {
  const s=wishState(item);
  const revision=s.revision||0;
  if (typeof window.sorokaWishState!=='function') return;
  try {
    const answer=await window.sorokaWishState(item.id);
    if (s.loading || revision!==(s.revision||0)) return; // A submitted search owns the current answer.
    s.answer=answer;
    if (answer.params && !s.dirty) {
      s.params=answer.params;
      if (wishIsOpen(item.id)) {
        const form=document.querySelector('#product-wish-search');
        if (form) {
          for (const name of ['query','min','max','count']) form.elements[name].value=s.params[name]??'';
          for (const box of form.querySelectorAll('[name="stores"]')) box.checked=s.params.stores.includes(box.value);
        }
      }
    }
    patchWish(item);wishPoll(item);
  } catch(error) { s.error=wishError(error);patchWish(item); }
}
function readWishForm(form) {
  const f=new FormData(form);
  return { query:String(f.get('query')||'').trim(),min:f.get('min')||null,max:f.get('max')||null,count:Number(f.get('count')),stores:f.getAll('stores').map(String) };
}
async function chooseWish(item,url,searchId) {
  const s=wishState(item); if (s.busy) return;
  s.busy=true;s.error='';patchWish(item);
  try {
    await window.sorokaWishSelect(item.id,{url,...(searchId?{searchId}:{})});
    ui.productTab='products';
    if (wishIsOpen(item.id)) { ui.sheet=null;openSavedRecord('products',item.id); }
    else render();
    // Price checks are ordinary existing checks; selection itself uses no AI.
    window.sorokaProductRefresh?.(item.id).then(answer=>{
      const state=productChecks.get(item.id)||{};
      Object.assign(state,answer,{revision:(state.revision||0)+1,connectionError:false});productChecks.set(item.id,state);
      if (productCheckOpen(item.id)) render();
    }).catch(()=>{const state=productChecks.get(item.id)||{};state.connectionError=true;productChecks.set(item.id,state);if(productCheckOpen(item.id))render();});
  } catch(error) { s.error=wishError(error); }
  finally { s.busy=false;patchWish(item); }
}
function productWishAction(action,control) {
  if (action==='product-wish-tab') { ui.productTab=control.dataset.tab;ui.savedSection='';ui.savedQuery='';ui.savedLimit=60;render();return true; }
  if (action==='product-wish-new') { ui.productTab='wishes';openSavedRecord('products');return true; }
  if (action==='product-wish-select') {
    const item=savedItem('products',ui.sheet?.id);if (item) void chooseWish(item,control.dataset.url,wishState(item).answer.searchId);
    return true;
  }
  return false;
}
function productWishSubmit(event) {
  if (!['product-wish-link','product-wish-search'].includes(event.target.id)) return false;
  event.preventDefault();
  const item=savedItem('products',ui.sheet?.id);if (!item) return true;
  const s=wishState(item);
  if (event.target.id==='product-wish-link') { void chooseWish(item,new FormData(event.target).get('url'));return true; }
  if (s.loading||s.busy||s.answer.state==='running') return true;
  const params=readWishForm(event.target);
  if (!params.stores.length || (params.min!=null&&params.max!=null&&Number(params.min)>Number(params.max))) { s.error='Проверьте бюджет и выберите хотя бы один магазин.';patchWish(item);return true; }
  s.params=params;s.dirty=true;s.loading=true;s.error='';s.revision=(s.revision||0)+1;patchWish(item);
  window.sorokaWishSearch(item.id,params).then(answer=>{s.answer=answer;}).catch(error=>{s.error=wishError(error);}).finally(()=>{s.loading=false;patchWish(item);wishPoll(item);});
  return true;
}
document.addEventListener('input',event=>{
  const item=savedItem('products',ui.sheet?.id);if (!item) return;
  const s=wishState(item);
  if (event.target.closest('#product-wish-search')) {s.params=readWishForm(event.target.closest('form'));s.dirty=true;}
  if (event.target.closest('#product-wish-link')) s.link=event.target.value;
});
document.addEventListener('change',event=>{
  const item=savedItem('products',ui.sheet?.id);if (!item) return;
  const s=wishState(item);
  if (event.target.matches('[data-wish-sort]')) {s.sort=event.target.value;patchWish(item);}
  if (event.target.closest('#product-wish-search')) {s.params=readWishForm(event.target.closest('form'));s.dirty=true;}
});
