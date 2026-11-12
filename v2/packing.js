/* Packing lists retain their canonical identity and sync; lists is their visible home. */
const PK_SECTIONS = Object.fromEntries(PackingCore.PACKING_SECTIONS.map(s=>[s.id,s.label]));
const PK_ICONS = Object.fromEntries(PackingCore.PACKING_SECTIONS.map(s=>[s.id,s.icon]));
const pkMemory={items:[],loaded:false,loading:null,error:"",pending:new Map()};
const pkJobs = new Map();
let pkWakeTimer=0;
const PK = () => window.PackingCore;
function packingIsNote(item, sheet = ui.sheet) { return Boolean(item?.packing || sheet?.noteType === "packing" || sheet?.packingDraft); }
function pkToday() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function pkFind(uid) { return data.notes.find(note => note.packing?.id === uid); }
function pkActive(uid) { return ui.sheet?.kind === "saved" && ["notes","lists"].includes(ui.sheet.category) && ui.sheet.packingDraft?.id === uid; }
function packingDraft(item) {
  const sheet = ui.sheet;
  if (!sheet.packingDraft) {
    sheet.packingDraft = PK().normalizePacking(item?.packing || {version:1,id:crypto.randomUUID(),config:{destination:"",startOn:pkToday(),endOn:"",days:14,transport:"plane",baggage:"cabin",laundryEvery:5,activities:["city"],special:""},items:[],removedKeys:[]});
    sheet.packingBase = item?.packing ? structuredClone(item.packing) : null;
  } else if (item?.packing && JSON.stringify(item.packing)!==JSON.stringify(sheet.packingBase)) {
    sheet.packingDraft=PK().mergePacking(item.packing,sheet.packingBase,sheet.packingDraft);
    sheet.packingBase=structuredClone(item.packing);
  }
  if(sheet.packingEdit&&!sheet.packingDraft.items.some(row=>row.id===sheet.packingEdit.id))delete sheet.packingEdit;
  const ready=pkJobs.get(sheet.packingDraft.id);
  if(ready?.plan&&!sheet.packingEdit&&!sheet.packingAdd?.text?.trim())queueMicrotask(()=>pkApplyJob(ready));
  return sheet.packingDraft;
}
function pkCommit(doc, sheet = pkActive(doc.id) ? ui.sheet : null, baseline = sheet?.packingBase) {
  let normalized = PK().normalizePacking({...doc,hierarchyVersion:1});
  let item = pkFind(doc.id);
  if (!item && sheet?.packingExisting) return null; // A deleted note must stay deleted.
  if (item?.packing && baseline) normalized=PK().mergePacking(item.packing,baseline,normalized);
  if (!item) {
    if (!normalized.config.destination && !normalized.items.length) return null;
    const folder = sheet?.draft?.categoryId || (ui.savedSection === "__none__" ? "" : ui.savedSection) || "";
    item = {id:id(),created:todayIso(),source:"Добавлено вручную",versions:[],items:[],tags:[],categoryId:folder,topic:savedSection("lists",folder)?.name || ""};
    data.notes.push(item);
  }
  item.packing = normalized;
  item.title = normalized.config.destination ? `Сборы · ${normalized.config.destination}`.slice(0,120) : "Сборы";
  item.description = PK().packingText(normalized); item.updated = new Date().toISOString();
  if (sheet) { sheet.id = item.id; sheet.packingExisting = true; sheet.packingDraft = normalized; sheet.packingBase=structuredClone(normalized); }
  save(); return item;
}
function pkCurrent(uid) { return pkActive(uid) ? packingDraft(pkFind(uid)) : pkFind(uid)?.packing; }
function pkReleaseJob(job) { if(pkJobs.get(job.uid)===job)pkJobs.delete(job.uid); }
function pkTripRaw(sheet, doc) { return sheet.packingTrip ||= {...doc.config,days:PK().tripDays(doc.config),activities:[...doc.config.activities]}; }
function packingOpen() {
 ui.sheet={kind:"saved",category:"lists",noteType:"packing",draft:{categoryId:ui.savedCategory==="lists"&&ui.savedSection!=="__none__"?ui.savedSection||"":""},packingSettings:true,packingImportMemory:true};
 const uid=packingDraft(null).id;render();
 void pkLoadMemory().then(ok=>{if(ok&&pkActive(uid)){try{pkImportMemory();}catch(error){ui.sheet.packingError=error.message;ui.sheet.packingMemoryOpen=true;}render();}});
}
function packingSaveQuietly() {
  if (!ui.sheet || !packingIsNote(pkRecord())) return;
  const doc = packingDraft(pkRecord());
  pkCommit(doc);
}
function packingSheetDirty() {
  const sheet=ui.sheet,doc=sheet?.packingDraft;
  if(!doc)return false;
  if(sheet.packingTrip){
    try { if(PK().packingConfigKey({...sheet.packingTrip,endOn:""})!==PK().packingConfigKey({...doc.config,endOn:""}))return true; }
    catch (_) { return true; }
  }
  const edit=sheet.packingEdit,row=doc.items.find(item=>item.id===edit?.id);
  return Boolean(sheet.packingAdd?.text?.trim()||(row&&(edit.text!==row.text||Number(edit.quantity)!==row.quantity)));
}
function packingDidClose(sheet) { clearTimeout(pkWakeTimer);pkWakeTimer=0;const job=pkJobs.get(sheet?.packingDraft?.id);if(job?.plan)pkApplyJob(job); }
function pkArmStatus(doc) {
  clearTimeout(pkWakeTimer);pkWakeTimer=0;
  const remaining=90000-(Date.now()-Date.parse(doc.generationStartedAt||""));
  if(doc.generating&&!pkJobs.has(doc.id)&&Number.isFinite(remaining)&&remaining>0)pkWakeTimer=setTimeout(()=>{pkWakeTimer=0;if(pkActive(doc.id))render();},remaining+50);
}
function pkDates(config) { return `${config.startOn ? new Date(config.startOn+"T12:00:00Z").toLocaleDateString("ru-RU",{day:"numeric",month:"short",timeZone:"UTC"}) : "Дата не указана"} · ${PK().tripDays(config)} дн.`; }
function packingNoteRow(item) {
 const doc=item.packing,p=PK().packingProgress(doc);
 return `<button class="record-card pk-list-card" type="button" data-action="saved-open" data-category="lists" data-id="${esc(item.id)}"><span class="pk-type">${icon("plane","icon-sm")}Сборы</span><strong>${esc(doc.config.destination||item.title||"Поездка")}</strong><span>${esc(pkDates(doc.config))} · ${p.done} из ${p.total}</span><span class="progress-track"><span style="width:${p.total?p.done/p.total*100:0}%"></span></span></button>`;
}
function pkSettings(sheet, doc) {
  const raw = pkTripRaw(sheet,doc);
  const options = (field,values) => `<div class="pk-choices" data-trip-choice="${field}">${values.map(([value,label])=>`<button type="button" class="${(Array.isArray(raw[field]) ? raw[field].includes(value) : raw[field]===value) ? "active" : ""}" data-action="packing-choice" data-field="${field}" data-value="${value}" aria-pressed="${Array.isArray(raw[field]) ? raw[field].includes(value) : raw[field]===value}">${label}</button>`).join("")}</div>`;
  return `<form id="packing-trip-form" class="pk-trip-form"><label class="field">Куда едем<input name="destination" required maxlength="180" placeholder="Город, страна или маршрут" value="${esc(raw.destination)}"></label><div class="field-row"><label class="field">Когда<input name="startOn" type="date" required value="${esc(raw.startOn)}"></label><label class="field">На сколько дней<input name="days" type="number" inputmode="numeric" min="1" max="365" required value="${esc(raw.days)}"></label></div><details class="pk-extra"><summary>Детали поездки</summary><p class="pk-label">Как добираемся</p>${options("transport",[["plane","Самолёт"],["train","Поезд"],["car","Машина"],["other","Другое"]])}<p class="pk-label">Багаж</p>${options("baggage",[["backpack","Рюкзак"],["cabin","Ручная кладь"],["checked","Чемодан"]])}<p class="pk-label">Что планируем</p>${options("activities",[["city","Город"],["beach","Море"],["nature","Природа"],["work","Работа"]])}<label class="field">Стирка каждые, дней<input name="laundryEvery" type="number" min="0" max="14" inputmode="numeric" value="${raw.laundryEvery}"><small>0 — без стирки. Это влияет на количество одежды.</small></label><label class="field">Что ещё учесть<textarea name="special" rows="2" maxlength="500" placeholder="Особые занятия или личные вещи">${esc(raw.special)}</textarea></label></details><p class="form-error" role="alert">${esc(sheet.packingError || "")}</p><div class="sheet-actions"><button class="ghost-button" type="button" data-action="packing-settings-save">Сохранить</button><button class="primary-button" type="submit">${doc.generatedFor ? "Обновить список" : "Составить список"}</button></div><p class="section-note">Только нужное. Без повторов и запасов «на всякий случай».</p></form>`;
}
function pkEditForm(sheet,doc) {
 const edit=sheet.packingEdit,row=doc.items.find(i=>i.id===edit?.id);if(!row||row.kind==='group')return '';
 return `<form id="packing-edit-form" class="pk-row editing ${row.parentId?'pk-child':''}" data-id="${esc(row.id)}" data-uid="${esc(doc.id)}" data-state-key="${esc(doc.id+':'+row.id)}">${pkCheckMarkup(row)}<div class="pk-inline-main"><input name="text" maxlength="120" value="${esc(edit.text)}" autocomplete="off" enterkeyhint="done" aria-label="Текст пункта"><input class="pk-inline-quantity" name="quantity" type="number" min="1" max="99" value="${esc(edit.quantity)}" inputmode="numeric" aria-label="Количество">${row.note?`<small class="pk-item-note">${esc(row.note)}</small>`:''}</div>${pkRemoveMarkup(row)}</form>`;
}
function pkStatus(doc) {
  const job = pkJobs.get(doc.id),age=Date.now()-Date.parse(doc.generationStartedAt||""),stale=Boolean(doc.generating&&!job&&(!Number.isFinite(age)||age>=90000));
  if (job?.plan) return `<div class="pk-status" role="status">Список готов. Заверши правку пункта, чтобы применить.</div>`;
  if (doc.generating && !stale) return `<div class="pk-status" role="status"><span class="live-spin" aria-hidden="true"></span><span>Составляю компактный список…</span></div>`;
  if (doc.generationError || stale) return `<div class="pk-status pk-status-error" role="status"><span>${esc(doc.generationError || "Составление прервалось. Прежний список сохранён.")}</span><button type="button" class="text-action" data-action="packing-generate">Повторить</button></div>`;
  if (doc.generatedFor && doc.generatedFor!==PK().packingConfigKey(doc.config)) return `<div class="pk-status" role="status"><span>Поездка изменилась</span><button type="button" class="text-action" data-action="packing-generate">Обновить список</button></div>`;
  return "";
}
function pkList(sheet,doc) {
 const progress=PK().packingProgress(doc);
 const sections=Object.entries(PK_SECTIONS).map(([section,label])=>{
  const roots=doc.items.filter(row=>row.section===section&&!row.parentId),leaves=doc.items.filter(row=>row.section===section&&row.kind!=='group'),done=leaves.filter(row=>row.done).length;
  const sole=roots.length===1&&roots[0].kind==='group'&&roots[0].source==='ai'?roots[0]:null,key='section:'+section,visible=sole?doc.items.filter(i=>i.parentId===sole.id):roots;
  const add=sheet.packingAdd,adding=add?.section===section&&(!add.parentId||add.parentId===sole?.id);
  return `<details class="pk-group" data-pk-fold="${key}" ${sheet.packingClosed?.includes(key)?'':'open'}><summary class="pk-section-head"><h3>${icon(PK_ICONS[section],'icon-sm')}${label}</h3><span>${done}/${leaves.length}</span><button type="button" class="icon-button" data-action="packing-add-here" data-section="${section}" ${sole?`data-parent="${esc(sole.id)}"`:''} aria-label="Добавить в ${label}">${icon('plus','icon-sm')}</button>${icon('down','icon-sm')}</summary>${visible.map(row=>pkItemMarkup(row,doc,sheet)).join('')}${adding?pkAddMarkup(sheet):''}</details>`;
 }).join('');
 return `<div class="pk-trip-summary"><span>${esc(pkDates(doc.config))}</span><button type="button" class="text-action" data-action="packing-memory">${icon('bookmark','icon-sm')}Личные вещи</button></div>${pkStatus(doc)}${progress.total?`<div class="pk-progress"><span>Собрано ${progress.done} из ${progress.total}</span><div class="progress-track"><span style="width:${progress.done/progress.total*100}%"></span></div></div>`:`<div class="pk-empty"><p>Составь список с ИИ или добавь вещи в нужные разделы.</p><button class="primary-button" type="button" data-action="packing-generate" ${doc.generating?'disabled':''}>Составить список</button></div>`}${sheet.packingMemoryOpen?pkMemoryMarkup():''}${sections}${progress.total?`<button class="text-action pk-regenerate" type="button" data-action="packing-generate" ${doc.generating?'disabled':''}>${icon('spark','icon-sm')}Пересобрать с ИИ</button>`:''}<p class="pk-note">Ручные пункты и отметки сохраняются при пересборке.</p>`;
}
function renderPackingSheet(item) {
  const sheet = ui.sheet, doc = packingDraft(item);
  pkArmStatus(doc);
  if (item) sheet.packingExisting = true;
  return `<div class="modal-backdrop note-backdrop packing-backdrop" data-action="backdrop"><section class="sheet packing-sheet" role="dialog" aria-modal="true" aria-label="Сборы"><div class="sheet-handle"></div><header class="sheet-head"><button class="icon-button" type="button" data-action="close-sheet" aria-label="К спискам">${icon("left")}</button><div class="pk-heading"><span class="pk-type">${icon("plane","icon-sm")}Сборы</span><h2>${esc(doc.config.destination || "Новая поездка")}</h2></div><button class="icon-button" type="button" data-action="packing-settings" aria-label="Настроить поездку">${icon("settings")}</button>${item?`<button class="icon-button" type="button" data-action="saved-delete" aria-label="Удалить сборы">${icon("trash")}</button>`:""}</header><div class="pk-body">${sheet.packingSettings?pkSettings(sheet,doc)+(sheet.packingMemoryOpen?pkMemoryMarkup():""):pkList(sheet,doc)}</div></section></div>`;
}
function pkApplyJob(job) {
  if(pkJobs.get(job.uid)!==job)return;
  const current = pkCurrent(job.uid);
  if (!current || current.requestId!==job.requestId || PK().packingConfigKey(current.config)!==job.inputKey) { pkReleaseJob(job); return; }
  if (pkActive(job.uid) && (ui.sheet.packingEdit||ui.sheet.packingAdd?.text?.trim())) { render(); return; }
  let updated;
  try { updated=PK().applyPackingPlan(current,job.plan,job.inputKey); }
  catch (_) { current.generating=false;current.generationError="Не получилось применить список. Твои пункты сохранены.";pkCommit(current);pkReleaseJob(job);if(pkActive(job.uid))render();return; }
  updated.generating=false; delete updated.generationError;
  if (pkActive(job.uid)) {
    ui.sheet.packingDraft=updated;
    if(ui.sheet.packingAdd?.parentId&&!updated.items.some(i=>i.id===ui.sheet.packingAdd.parentId))ui.sheet.packingAdd.parentId='';
  }
  pkCommit(updated,pkActive(job.uid)?ui.sheet:null,current); pkReleaseJob(job); if (pkActive(job.uid)) render();
}
async function pkGenerate() {
  let sheet=ui.sheet, doc=packingDraft(pkRecord(sheet));
  if (pkJobs.has(doc.id)) return;
  if(sheet.packingImportMemory&&!sheet.packingMemoryApplied){const uid=doc.id;if(!await pkLoadMemory()){if(pkActive(uid)){ui.sheet.packingSettings=true;ui.sheet.packingError="Не удалось загрузить личные вещи. Повтори, чтобы не потерять их в новом списке.";render();}return;}if(!pkActive(uid))return;sheet=ui.sheet;try{pkImportMemory();doc=packingDraft(pkRecord(sheet));}catch(error){sheet.packingSettings=true;sheet.packingMemoryOpen=true;sheet.packingError=error.message;render();return;}}
  if(pkJobs.has(doc.id))return;
  try { doc.config=PK().normalizeTrip(doc.config,true); }
  catch(error) { sheet.packingSettings=true; sheet.packingError=error.message; render(); return; }
  if (typeof window.sorokaPackingGenerate!=="function") { doc.generationError="ИИ доступен в приложении Flow.";pkCommit(doc);render();return; }
  const job={uid:doc.id,requestId:crypto.randomUUID(),inputKey:PK().packingConfigKey(doc.config)};
  doc.requestId=job.requestId;doc.generating=true;doc.generationStartedAt=new Date().toISOString();delete doc.generationError;
  sheet.packingSettings=false;pkJobs.set(doc.id,job);pkCommit(doc);render();
  try {
    const result=await window.sorokaPackingGenerate(doc.config,doc.items);
    const current=pkCurrent(job.uid);
    if (!current || current.requestId!==job.requestId || PK().packingConfigKey(current.config)!==job.inputKey || result.inputKey!==job.inputKey) { pkReleaseJob(job); return; }
    job.plan=result.plan;pkApplyJob(job);
  } catch (_) {
    const current=pkCurrent(job.uid);
    if (current?.requestId===job.requestId) { current.generating=false;current.generationError="Не получилось составить список. Твои пункты сохранены.";pkCommit(current); }
    pkReleaseJob(job);if(pkActive(job.uid))render();
  }
}
function pkReadTrip(form) {
  const sheet=ui.sheet, doc=packingDraft(pkRecord(sheet)),raw=pkTripRaw(sheet,doc);
  for(const name of ["destination","startOn","days","laundryEvery","special"])raw[name]=form.elements.namedItem(name).value;
  return PK().normalizeTrip({...raw,endOn:""},true);
}
function pkSaveTrip(form,generate) {
  try {
    const doc=packingDraft(pkRecord()),config=pkReadTrip(form);
    if(PK().packingConfigKey(config)!==PK().packingConfigKey(doc.config)){doc.generating=false;delete doc.requestId;pkJobs.delete(doc.id);}
    doc.config=config;ui.sheet.packingError="";ui.sheet.packingSettings=false;delete ui.sheet.packingTrip;
    pkCommit(doc);if(generate)pkGenerate();else render();
  } catch(error) {ui.sheet.packingError=error.message;render();}
}
function pkFinishEdit(form=null,renderAfter=true) {
 const sheet=ui.sheet;if(!sheet?.packingDraft)return false;
 const edit=sheet.packingEdit,doc=packingDraft(pkRecord()),row=doc.items.find(i=>i.id===edit?.id);
 if(!edit||!row||row.kind==='group')return false;
 if(form&&(form.isConnected===false||(form.dataset?.id&&form.dataset.id!==edit.id)||(form.dataset?.uid&&form.dataset.uid!==doc.id)))return false;
 const field=name=>form?.elements?.namedItem?.(name)||form?.elements?.[name];
 const text=String(field('text')?.value??edit.text).trim(),quantity=Number(field('quantity')?.value??edit.quantity);
 if(text.length>120||!Number.isInteger(quantity)||quantity<1||quantity>99){toast('Укажи название до 120 символов и количество от 1 до 99');return false;}
 if(text&&(text!==row.text||quantity!==row.quantity)){
  const updated={...row,text,quantity,edited:true};
  if(row.remember||edit.remember)pkMarkRemembered(updated);
  doc.items=doc.items.map(i=>i.id===row.id?updated:i);delete sheet.packingEdit;pkCommit(doc);pkMemory.loaded=false;
 }else delete sheet.packingEdit;
 if(renderAfter){const job=pkJobs.get(doc.id);if(job?.plan)pkApplyJob(job);else render();}
 return true;
}
function pkFinishAdd(form=null,renderAfter=true) {
 const sheet=ui.sheet,add=sheet?.packingAdd;if(!add)return false;
 const doc=packingDraft(pkRecord());
 if(form&&(form.isConnected===false||(form.dataset?.uid&&form.dataset.uid!==doc.id)))return false;
 const text=String(form?.elements?.text?.value??add.text??'').trim();if(!text)return true;
 if(text.length>120||doc.items.length>=200){toast(text.length>120?'Название должно быть не длиннее 120 символов':'В списке уже 200 пунктов');return false;}
 if(!PK_SECTIONS[add.section])return false;
 if(add.parentId&&!doc.items.some(i=>i.id===add.parentId&&i.kind==='group'&&i.section===add.section)){toast('Группа изменилась. Выбери раздел снова.');return false;}
 const row={id:crypto.randomUUID(),text,quantity:1,section:add.section,done:false,source:'manual',...(add.parentId?{parentId:add.parentId}:{})};
 if(!['before','final'].includes(row.section))pkMarkRemembered(row);
 doc.items.push(row);add.text='';add.revision=(add.revision||0)+1;pkCommit(doc);pkMemory.loaded=false;
 if(renderAfter){const job=pkJobs.get(doc.id);if(job?.plan)pkApplyJob(job);else render();queueMicrotask(pkFocusAdd);}
 return true;
}
function pkFocusAdd(){const input=document.querySelector('#pk-add-text');input?.scrollIntoView({block:'nearest'});input?.focus({preventScroll:true});}
function packingAction(action,control,event) {
  if(action==="packing-new"){packingOpen();return true;}
  if(!ui.sheet||!packingIsNote(pkRecord()))return false;
  const sheet=ui.sheet;let doc=packingDraft(pkRecord(sheet));
  if(action==="note-cancel"){closeSheet();return true;}
  if(action==="note-improve-menu"||action==="note-improve"){pkGenerate();return true;}
  if(!action.startsWith("packing-"))return false;

  if(action==='packing-edit'&&sheet.packingEdit?.id===control.dataset.id)return true;
  if(sheet.packingEdit&&action!=='packing-edit-cancel'&&!(action==='packing-remove'&&control.dataset.id===sheet.packingEdit.id)){
   if(!pkFinishEdit(null,false))return true;doc=packingDraft(pkRecord(sheet));
  }
  if(sheet.packingAdd?.text?.trim()&&action!=='packing-add-cancel'){
   if(!pkFinishAdd(null,false))return true;doc=packingDraft(pkRecord(sheet));
  }
  if(action==="packing-settings"){sheet.packingSettings=!sheet.packingSettings;render();}
  if(action==="packing-settings-save"){const form=document.getElementById("packing-trip-form");if(form)pkSaveTrip(form,false);}
  if(action==="packing-generate")pkGenerate();
  if(action==="packing-choice"){
    const raw=pkTripRaw(sheet,doc),field=control.dataset.field,value=control.dataset.value;
    if(field==="activities")raw.activities=raw.activities.includes(value)?raw.activities.filter(x=>x!==value):[...raw.activities,value];else if(["transport","baggage"].includes(field))raw[field]=value;
    for(const button of control.closest("[data-trip-choice]").querySelectorAll("button")){const active=Array.isArray(raw[field])?raw[field].includes(button.dataset.value):raw[field]===button.dataset.value;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));}
  }
  if(action==="packing-toggle"){doc.items=doc.items.map(row=>row.id===control.dataset.id?{...row,done:!row.done}:row);pkCommit(doc);render();}
  if(action==="packing-remove"){
    const row=doc.items.find(i=>i.id===control.dataset.id);if(row?.kind==='group')return true;if(row){const children=doc.items.filter(i=>i.parentId===row.id);if(children.length&&!window.confirm(`Убрать группу и ${children.length} пунктов?`))return true;const ids=new Set([row.id,...children.map(i=>i.id)]);for(const i of doc.items)if(ids.has(i.id)&&i.source==="ai"&&i.key)doc.removedKeys=[...new Set([...doc.removedKeys,i.key])];doc.items=doc.items.filter(i=>!ids.has(i.id));pkCommit(doc);render();}
  }

  if(action==='packing-edit'){
   const row=doc.items.find(i=>i.id===control.dataset.id);if(!row||row.kind==='group')return true;
   sheet.packingEdit={id:row.id,text:row.text,quantity:row.quantity,remember:row.remember??(row.section==='medicines')};delete sheet.packingAdd;
   sheet.packingClosed=(sheet.packingClosed||[]).filter(key=>![row.parentId,'section:'+row.section].includes(key));render();
   queueMicrotask(()=>{const input=document.querySelector('#packing-edit-form [name=text]');input?.scrollIntoView({block:'nearest'});input?.focus({preventScroll:true});input?.setSelectionRange(input.value.length,input.value.length);});
  }
  if(action==='packing-add-here'){
   event?.preventDefault();const section=control.dataset.section||'personal';if(!PK_SECTIONS[section])return true;
   sheet.packingAdd={section,parentId:control.dataset.parent||'',text:'',session:crypto.randomUUID()};delete sheet.packingEdit;
   sheet.packingClosed=(sheet.packingClosed||[]).filter(key=>!['section:'+section,sheet.packingAdd.parentId].includes(key));render();queueMicrotask(pkFocusAdd);
  }
  if(action==='packing-add-cancel'){delete sheet.packingAdd;render();}
  if(action==="packing-memory"){sheet.packingMemoryOpen=!sheet.packingMemoryOpen;render();if(sheet.packingMemoryOpen)void pkLoadMemory(true).then(()=>render());}
  if(action==="packing-memory-retry")void pkLoadMemory(true).then(()=>render());
  if(action==="packing-forget")void pkForgetMemory(control.dataset.id,doc.id);
  if(action==="packing-edit-cancel"){delete sheet.packingEdit;const job=pkJobs.get(doc.id);if(job?.plan)pkApplyJob(job);else render();}
  return true;
}
function pkRecord(sheet=ui.sheet){return sheet?.id?data.notes.find(i=>i.id===sheet.id)||data.saved?.lists?.find(i=>i.id===sheet.id):null;}
function packingAddExternal(item,text){const doc=PK().normalizePacking(item.packing);if(doc.items.length>=200){toast('В списке уже 200 пунктов');return false;}const row={id:crypto.randomUUID(),text,quantity:1,section:'personal',done:false,source:'manual'};pkMarkRemembered(row);doc.items.push(row);pkCommit(doc,null,item.packing);pkMemory.loaded=false;return true;}
function pkMarkRemembered(row,parentLabel){if(!row.remember)row.templateId=crypto.randomUUID();row.remember=true;row.templateId ||=crypto.randomUUID();row.templateAt=new Date(Math.max(Date.now(),(Date.parse(row.templateAt||'')||0)+1)).toISOString();parentLabel ??= ui.sheet?.packingDraft?.items.find(i=>i.id===row.parentId)?.text||'';pkMemory.pending.set(row.templateId,{id:row.templateId,text:row.text,quantity:row.quantity,section:row.section,parentLabel,updatedAt:row.templateAt});}
function pkFolderId(item){return savedSections('lists').find(s=>s.id===item.categoryId)?.id||savedSections('lists').find(s=>s.name.toLocaleLowerCase('ru-RU')===String(item.topic||'').toLocaleLowerCase('ru-RU'))?.id||'';}
async function pkLoadMemory(force=false){
 if(pkMemory.loading)return pkMemory.loading;if(pkMemory.loaded&&!force)return true;
 pkMemory.loading=(async()=>{try{const result=typeof window.sorokaPackingMemory==='function'?await window.sorokaPackingMemory('list'):{items:[]};const items=new Map(PK().normalizePackingMemory(result.items||[]).map(i=>[i.id,i]));for(const [id,pending] of pkMemory.pending){if(Date.parse(items.get(id)?.updatedAt||'')>=Date.parse(pending.updatedAt))pkMemory.pending.delete(id);else items.set(id,pending);}pkMemory.items=[...items.values()];pkMemory.loaded=true;pkMemory.error='';return true;}catch(_){pkMemory.error='Личные вещи не загрузились';return false;}finally{pkMemory.loading=null;}})();return pkMemory.loading;
}
function pkImportMemory(){const sheet=ui.sheet;if(!sheet?.packingImportMemory||sheet.packingMemoryApplied)return;sheet.packingDraft=PK().importPackingMemory(sheet.packingDraft,pkMemory.items);sheet.packingMemoryApplied=true;}
function pkMemoryMarkup(){return `<div class="pk-memory"><h3>${icon('bookmark','icon-sm')}Для следующих поездок</h3>${pkMemory.loading?'<p role="status">Загружаю личные вещи…</p>':pkMemory.error?`<p role="status">${esc(pkMemory.error)} <button class="text-action" type="button" data-action="packing-memory-retry">Повторить</button></p>`:pkMemory.items.length?pkMemory.items.map(i=>`<div class="pk-memory-row"><span>${esc(i.parentLabel?i.parentLabel+' · ':'')}${esc(i.text)}${i.quantity>1?' ×'+i.quantity:''}</span><button class="text-action" type="button" data-action="packing-forget" data-id="${esc(i.id)}">Забыть</button></div>`).join(''):'<p>Добавь свои вещи в список. Личные дополнения запомнятся для новых поездок.</p>'}</div>`;}
async function pkForgetMemory(id,uid){try{await window.sorokaPackingMemory('forget',id);pkMemory.pending.delete(id);pkMemory.items=pkMemory.items.filter(i=>i.id!==id);const doc=pkCurrent(uid);if(doc){doc.items=doc.items.map(i=>i.templateId===id?{...i,remember:false}:i);pkCommit(doc);}if(pkActive(uid))render();}catch(_){toast('Не получилось забыть вещь. Повтори, когда появится связь.');}}
function pkAddMarkup(sheet){const add=sheet.packingAdd;if(!add)return '';return `<form id="packing-add-form" class="pk-inline-add" data-uid="${esc(sheet.packingDraft.id)}" data-state-key="${esc(sheet.packingDraft.id+':'+(add.session||add.section+':'+(add.parentId||''))+':'+(add.revision||0))}"><span class="pk-add-icon">${icon('plus','icon-sm')}</span><input id="pk-add-text" name="text" maxlength="120" value="${esc(add.text||'')}" placeholder="Добавить пункт" autocomplete="off" enterkeyhint="done" aria-label="Новый пункт"><button class="pk-remove" type="button" data-action="packing-add-cancel" aria-label="Отменить добавление">${icon('close','icon-sm')}</button></form>`;}
function pkCheckMarkup(row){return `<button class="task-check ${row.done?'checked':''}" type="button" data-action="packing-toggle" data-id="${esc(row.id)}" aria-pressed="${row.done}" aria-label="${row.done?'Вернуть':'Собрано'}: ${esc(row.text)}">${icon('check','icon-sm')}</button>`;}
function pkRemoveMarkup(row){return `<button class="pk-remove" type="button" data-action="packing-remove" data-id="${esc(row.id)}" aria-label="Убрать: ${esc(row.text)}">${icon('close','icon-sm')}</button>`;}
function pkItemMarkup(row,doc,sheet){
 if(row.kind==='group'){const p=PK().packingProgress(doc,row.id);return `<details class="pk-subgroup" data-pk-fold="${esc(row.id)}" ${sheet.packingClosed?.includes(row.id)?'':'open'}><summary><span>${icon('down','icon-sm')}${esc(row.text)}</span><small>${p.done}/${p.total}</small><button type="button" class="icon-button" data-action="packing-add-here" data-section="${row.section}" data-parent="${esc(row.id)}" aria-label="Добавить в ${esc(row.text)}">${icon('plus','icon-sm')}</button></summary>${doc.items.filter(i=>i.parentId===row.id).map(i=>pkItemMarkup(i,doc,sheet)).join('')}${sheet.packingAdd?.parentId===row.id?pkAddMarkup(sheet):''}</details>`;}
 if(sheet.packingEdit?.id===row.id)return pkEditForm(sheet,doc);
 return `<div class="pk-row ${row.done?'done':''} ${row.parentId?'pk-child':''}">${pkCheckMarkup(row)}<button class="pk-item-text" type="button" data-action="packing-edit" data-id="${esc(row.id)}" aria-label="Изменить: ${esc(row.text)}"><span>${esc(row.text)}${row.note?`<small class="pk-item-note">${esc(row.note)}</small>`:''}</span>${row.quantity>1?`<small>×${row.quantity}</small>`:''}</button>${pkRemoveMarkup(row)}</div>`;
}

document.addEventListener('toggle',event=>{const key=event.target?.dataset?.pkFold;if(!key||!event.target.isConnected||!ui.sheet)return;const closed=new Set(ui.sheet.packingClosed||[]);if(event.target.open)closed.delete(key);else closed.add(key);ui.sheet.packingClosed=[...closed];},true);
document.addEventListener('input',event=>{
 if(!ui.sheet?.packingDraft)return;
 if(event.target.closest?.('#packing-trip-form')&&event.target.name)pkTripRaw(ui.sheet,ui.sheet.packingDraft)[event.target.name]=event.target.value;
 if(event.target.closest?.('#packing-edit-form')&&ui.sheet.packingEdit&&['text','quantity'].includes(event.target.name))ui.sheet.packingEdit[event.target.name]=event.target.value;
 if(event.target.closest?.('#packing-add-form')&&ui.sheet.packingAdd&&event.target.name==='text')ui.sheet.packingAdd.text=event.target.value;
});
document.addEventListener('submit',event=>{
 if(!['packing-trip-form','packing-add-form','packing-edit-form'].includes(event.target.id))return;
 event.preventDefault();event.stopImmediatePropagation();const form=event.target;
 if(form.id==='packing-trip-form')return pkSaveTrip(form,true);
 if(form.id==='packing-edit-form')return pkFinishEdit(form);
 return pkFinishAdd(form);
},true);
document.addEventListener('focusout',event=>{
 const form=event.target?.closest?.('#packing-edit-form, #packing-add-form');
 if(!form||(event.relatedTarget&&form.contains(event.relatedTarget)))return;
 setTimeout(()=>{if(document.body.contains(form)&&form.isConnected!==false)form.requestSubmit();},0);
});
document.addEventListener('keydown',event=>{
 if(!['Enter','Escape'].includes(event.key))return;
 const form=event.target?.closest?.('#packing-edit-form, #packing-add-form');if(!form)return;
 if(event.isComposing){event.stopImmediatePropagation();return;}
 event.preventDefault();event.stopImmediatePropagation();
 if(event.key==='Enter'){form.requestSubmit();return;}
 packingAction(form.id==='packing-edit-form'?'packing-edit-cancel':'packing-add-cancel',{dataset:{}},event);
},true);
