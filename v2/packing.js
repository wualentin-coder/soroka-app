/* A structured note: trip settings, a small editable packing list and real AI proposals. */
const PK_SECTIONS = { documents: "Документы и деньги", clothes: "Одежда и обувь", tech: "Техника", hygiene: "Гигиена", personal: "Личное", before: "Перед выходом" };
const pkJobs = new Map();
let pkWakeTimer=0;
const PK = () => window.PackingCore;
function packingIsNote(item, sheet = ui.sheet) { return Boolean(item?.packing || sheet?.noteType === "packing" || sheet?.packingDraft); }
function pkToday() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
function pkFind(uid) { return data.notes.find(note => note.packing?.id === uid); }
function pkActive(uid) { return ui.sheet?.kind === "saved" && ui.sheet.category === "notes" && ui.sheet.packingDraft?.id === uid; }
function packingDraft(item) {
  const sheet = ui.sheet;
  if (!sheet.packingDraft) {
    sheet.packingDraft = PK().normalizePacking(item?.packing || {version:1,id:crypto.randomUUID(),config:{destination:"",startOn:pkToday(),endOn:"",days:14,transport:"plane",baggage:"cabin",laundryEvery:5,activities:["city"],special:""},items:[],removedKeys:[]});
    sheet.packingBase = item?.packing ? structuredClone(item.packing) : null;
  } else if (item?.packing && JSON.stringify(item.packing)!==JSON.stringify(sheet.packingBase)) {
    sheet.packingDraft=PK().mergePacking(item.packing,sheet.packingBase,sheet.packingDraft);
    sheet.packingBase=structuredClone(item.packing);
  }
  const ready=pkJobs.get(sheet.packingDraft.id);
  if(ready?.plan&&!sheet.packingEdit)queueMicrotask(()=>pkApplyJob(ready));
  return sheet.packingDraft;
}
function pkCommit(doc, sheet = pkActive(doc.id) ? ui.sheet : null, baseline = sheet?.packingBase) {
  let normalized = PK().normalizePacking(doc);
  let item = pkFind(doc.id);
  if (!item && sheet?.packingExisting) return null; // A deleted note must stay deleted.
  if (item?.packing && baseline) normalized=PK().mergePacking(item.packing,baseline,normalized);
  if (!item) {
    if (!normalized.config.destination && !normalized.items.length) return null;
    const folder = sheet?.draft?.categoryId || (ui.savedSection === "__none__" ? "" : ui.savedSection) || "";
    item = {id:id(),created:todayIso(),source:"Добавлено вручную",versions:[],items:[],tags:[],categoryId:folder,topic:savedSection("notes",folder)?.name || ""};
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
  ui.sheet = {kind:"saved",category:"notes",noteType:"packing",draft:{categoryId:ui.savedSection === "__none__" ? "" : ui.savedSection || ""},packingSettings:true};
  render();
}
function packingSaveQuietly() {
  if (!ui.sheet || !packingIsNote(ui.sheet.id ? savedItem("notes",ui.sheet.id) : null)) return;
  const doc = packingDraft(ui.sheet.id ? savedItem("notes",ui.sheet.id) : null);
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
  return Boolean(row&&(edit.text!==row.text||Number(edit.quantity)!==row.quantity||edit.section!==row.section));
}
function packingDidClose(sheet) { clearTimeout(pkWakeTimer);pkWakeTimer=0;const job=pkJobs.get(sheet?.packingDraft?.id);if(job?.plan)pkApplyJob(job); }
function pkArmStatus(doc) {
  clearTimeout(pkWakeTimer);pkWakeTimer=0;
  const remaining=90000-(Date.now()-Date.parse(doc.generationStartedAt||""));
  if(doc.generating&&!pkJobs.has(doc.id)&&Number.isFinite(remaining)&&remaining>0)pkWakeTimer=setTimeout(()=>{pkWakeTimer=0;if(pkActive(doc.id))render();},remaining+50);
}
function pkDates(config) { return `${config.startOn ? new Date(config.startOn+"T12:00:00Z").toLocaleDateString("ru-RU",{day:"numeric",month:"short",timeZone:"UTC"}) : "Дата не указана"} · ${PK().tripDays(config)} дн.`; }
function packingNoteRow(item) {
  const doc = item.packing, count = (doc.items || []).length, done = (doc.items || []).filter(row=>row.done).length;
  return `<button class="note-row" type="button" data-action="saved-open" data-category="notes" data-id="${esc(item.id)}"><span class="note-row-title">${esc(item.title || "Сборы")}</span><span class="note-row-preview">${esc(pkDates(doc.config))}${count ? ` · собрано ${done} из ${count}` : " · составить список"}</span><span class="note-row-foot"><span class="pk-type">${icon("plane","icon-sm")}Сборы</span><time>${esc(noteDateLabel(item))}</time>${item.pinned ? icon("bookmark","icon-sm") : ""}</span></button>`;
}
function pkSettings(sheet, doc) {
  const raw = pkTripRaw(sheet,doc);
  const options = (field,values) => `<div class="pk-choices" data-trip-choice="${field}">${values.map(([value,label])=>`<button type="button" class="${(Array.isArray(raw[field]) ? raw[field].includes(value) : raw[field]===value) ? "active" : ""}" data-action="packing-choice" data-field="${field}" data-value="${value}" aria-pressed="${Array.isArray(raw[field]) ? raw[field].includes(value) : raw[field]===value}">${label}</button>`).join("")}</div>`;
  return `<form id="packing-trip-form" class="pk-trip-form"><label class="field">Куда едем<input name="destination" required maxlength="180" placeholder="Город, страна или маршрут" value="${esc(raw.destination)}"></label><div class="field-row"><label class="field">Когда<input name="startOn" type="date" required value="${esc(raw.startOn)}"></label><label class="field">На сколько дней<input name="days" type="number" inputmode="numeric" min="1" max="365" required value="${esc(raw.days)}"></label></div><details class="pk-extra"><summary>Детали поездки</summary><p class="pk-label">Как добираемся</p>${options("transport",[["plane","Самолёт"],["train","Поезд"],["car","Машина"],["other","Другое"]])}<p class="pk-label">Багаж</p>${options("baggage",[["backpack","Рюкзак"],["cabin","Ручная кладь"],["checked","Чемодан"]])}<p class="pk-label">Что планируем</p>${options("activities",[["city","Город"],["beach","Море"],["nature","Природа"],["work","Работа"]])}<label class="field">Стирка каждые, дней<input name="laundryEvery" type="number" min="0" max="14" inputmode="numeric" value="${raw.laundryEvery}"><small>0 — без стирки. Это влияет на количество одежды.</small></label><label class="field">Что ещё учесть<textarea name="special" rows="2" maxlength="500" placeholder="Особые занятия или личные вещи">${esc(raw.special)}</textarea></label></details><p class="form-error" role="alert">${esc(sheet.packingError || "")}</p><div class="sheet-actions"><button class="ghost-button" type="button" data-action="packing-settings-save">Сохранить</button><button class="primary-button" type="submit">${doc.items.length ? "Обновить список" : "Составить список"}</button></div><p class="section-note">Только нужное. Без повторов и запасов «на всякий случай».</p></form>`;
}
function pkEditForm(sheet, doc) {
  const edit = sheet.packingEdit, row = doc.items.find(item=>item.id===edit?.id);
  if (!row) { delete sheet.packingEdit; return ""; }
  return `<form id="packing-edit-form" class="pk-edit-form"><label class="field">Вещь<input name="text" maxlength="120" required value="${esc(edit.text)}"></label><div class="field-row"><label class="field">Количество<input name="quantity" type="number" min="1" max="99" inputmode="numeric" required value="${esc(edit.quantity)}"></label><label class="field">Раздел<select name="section">${Object.entries(PK_SECTIONS).map(([key,label])=>`<option value="${key}" ${edit.section===key?"selected":""}>${label}</option>`).join("")}</select></label></div>${row.note?`<p class="section-note">${esc(row.note)}</p>`:""}<div class="sheet-actions"><button class="ghost-button" type="button" data-action="packing-edit-cancel">Отмена</button><button class="primary-button" type="submit">Готово</button></div></form>`;
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
  const done = doc.items.filter(item=>item.done).length, total = doc.items.length;
  const groups = Object.entries(PK_SECTIONS).map(([key,label])=>{
    const rows = doc.items.filter(item=>item.section===key); if (!rows.length) return "";
    return `<details class="pk-group" open><summary><b>${label}</b><span>${rows.filter(row=>row.done).length}/${rows.length}</span></summary><div>${rows.map(row=>`<div class="pk-row ${row.done?"done":""}"><button class="task-check ${row.done?"checked":""}" type="button" data-action="packing-toggle" data-id="${esc(row.id)}" aria-pressed="${row.done}" aria-label="${row.done?"Вернуть":"Собрано"}: ${esc(row.text)}">${icon("check","icon-sm")}</button><button class="pk-item-text" type="button" data-action="packing-edit" data-id="${esc(row.id)}"><span>${esc(row.text)}</span>${row.quantity>1?`<small>×${row.quantity}</small>`:""}</button><button class="pk-remove" type="button" data-action="packing-remove" data-id="${esc(row.id)}" aria-label="Убрать: ${esc(row.text)}">${icon("close","icon-sm")}</button></div>`).join("")}</div></details>`;
  }).join("");
  return `<div class="pk-trip-summary"><span>${esc(pkDates(doc.config))}</span><button class="text-action" type="button" data-action="packing-settings">Параметры поездки</button></div>${pkStatus(doc)}${total ? `<div class="pk-progress"><span>Собрано ${done} из ${total}</span><div class="progress-track"><span style="width:${done/total*100}%"></span></div></div>` : `<div class="pk-empty"><p>Список под твою поездку: минимум вещей, только необходимое.</p><button class="primary-button" type="button" data-action="packing-generate" ${doc.generating&&!doc.generationError?"disabled":""}>Составить список</button></div>`}${groups}${sheet.packingEdit?pkEditForm(sheet,doc):`<form id="packing-add-form" class="pk-add"><label class="sr-only" for="pk-add-text">Добавить вещь</label><input id="pk-add-text" name="text" maxlength="120" placeholder="Добавить свою вещь" autocomplete="off" required><button class="icon-button" type="submit" aria-label="Добавить вещь">${icon("plus")}</button></form>`}${total ? `<button class="text-action pk-regenerate" type="button" data-action="packing-generate" ${doc.generating&&!doc.generationError?"disabled":""}>${icon("spark","icon-sm")}Пересобрать с ИИ</button>`:""}<p class="pk-note">Твои пункты и правки сохраняются при пересборке.</p>`;
}
function renderPackingSheet(item) {
  const sheet = ui.sheet, doc = packingDraft(item);
  pkArmStatus(doc);
  if (item) sheet.packingExisting = true;
  return `<div class="modal-backdrop note-backdrop packing-backdrop" data-action="backdrop"><section class="sheet packing-sheet" role="dialog" aria-modal="true" aria-label="Сборы"><div class="sheet-handle"></div><header class="sheet-head"><button class="icon-button" type="button" data-action="close-sheet" aria-label="К заметкам">${icon("left")}</button><div class="pk-heading"><span class="pk-type">${icon("plane","icon-sm")}Сборы</span><h2>${esc(doc.config.destination || "Новая поездка")}</h2></div><button class="icon-button" type="button" data-action="packing-settings" aria-label="Настроить поездку">${icon("settings")}</button>${item?`<button class="icon-button" type="button" data-action="saved-delete" aria-label="Удалить сборы">${icon("trash")}</button>`:""}</header><div class="pk-body">${sheet.packingSettings?pkSettings(sheet,doc):pkList(sheet,doc)}</div></section></div>`;
}
function pkApplyJob(job) {
  if(pkJobs.get(job.uid)!==job)return;
  const current = pkCurrent(job.uid);
  if (!current || current.requestId!==job.requestId || PK().packingConfigKey(current.config)!==job.inputKey) { pkReleaseJob(job); return; }
  if (pkActive(job.uid) && ui.sheet.packingEdit) { render(); return; }
  let updated;
  try { updated=PK().applyPackingPlan(current,job.plan,job.inputKey); }
  catch (_) { current.generating=false;current.generationError="Не получилось применить список. Твои пункты сохранены.";pkCommit(current);pkReleaseJob(job);if(pkActive(job.uid))render();return; }
  updated.generating=false; delete updated.generationError;
  if (pkActive(job.uid)) ui.sheet.packingDraft=updated;
  pkCommit(updated,pkActive(job.uid)?ui.sheet:null,current); pkReleaseJob(job); if (pkActive(job.uid)) render();
}
async function pkGenerate() {
  const sheet=ui.sheet, doc=packingDraft(sheet.id?savedItem("notes",sheet.id):null);
  if (pkJobs.has(doc.id)) return;
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
  const sheet=ui.sheet, doc=packingDraft(sheet.id?savedItem("notes",sheet.id):null),raw=pkTripRaw(sheet,doc);
  for(const name of ["destination","startOn","days","laundryEvery","special"])raw[name]=form.elements.namedItem(name).value;
  return PK().normalizeTrip({...raw,endOn:""},true);
}
function pkSaveTrip(form,generate) {
  try {
    const doc=packingDraft(ui.sheet.id?savedItem("notes",ui.sheet.id):null),config=pkReadTrip(form);
    if(PK().packingConfigKey(config)!==PK().packingConfigKey(doc.config)){doc.generating=false;delete doc.requestId;pkJobs.delete(doc.id);}
    doc.config=config;ui.sheet.packingError="";ui.sheet.packingSettings=false;delete ui.sheet.packingTrip;
    pkCommit(doc);if(generate)pkGenerate();else render();
  } catch(error) {ui.sheet.packingError=error.message;render();}
}
function pkFinishEdit(form) {
  const sheet=ui.sheet,doc=packingDraft(sheet.id?savedItem("notes",sheet.id):null),edit=sheet.packingEdit;
  if(!edit)return;
  const text=form.elements.text.value.trim(),quantity=Number(form.elements.quantity.value),section=form.elements.section.value;
  if(!text||!Number.isInteger(quantity)||quantity<1||quantity>99){toast("Укажи вещь и количество от 1 до 99");return;}
  doc.items=doc.items.map(row=>row.id===edit.id?{...row,text,quantity,section,edited:true}:row);delete sheet.packingEdit;pkCommit(doc);
  const job=pkJobs.get(doc.id);if(job?.plan)pkApplyJob(job);else render();
}
function packingAction(action,control,event) {
  if(action==="packing-new"){packingOpen();return true;}
  if(!ui.sheet||!packingIsNote(ui.sheet.id?savedItem("notes",ui.sheet.id):null))return false;
  const sheet=ui.sheet,doc=packingDraft(sheet.id?savedItem("notes",sheet.id):null);
  if(action==="note-cancel"){closeSheet();return true;}
  if(action==="note-improve-menu"||action==="note-improve"){pkGenerate();return true;}
  if(!action.startsWith("packing-"))return false;
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
    const row=doc.items.find(row=>row.id===control.dataset.id);if(row){if(row.source==="ai"&&row.key)doc.removedKeys=[...new Set([...doc.removedKeys,row.key])];doc.items=doc.items.filter(item=>item.id!==row.id);pkCommit(doc);render();}
  }
  if(action==="packing-edit"){const row=doc.items.find(row=>row.id===control.dataset.id);if(row){sheet.packingEdit={id:row.id,text:row.text,quantity:row.quantity,section:row.section};render();}}
  if(action==="packing-edit-cancel"){delete sheet.packingEdit;const job=pkJobs.get(doc.id);if(job?.plan)pkApplyJob(job);else render();}
  return true;
}
document.addEventListener("input",event=>{
  if(!ui.sheet?.packingDraft)return;
  if(event.target.closest?.("#packing-trip-form")&&event.target.name)pkTripRaw(ui.sheet,ui.sheet.packingDraft)[event.target.name]=event.target.value;
  if(event.target.closest?.("#packing-edit-form")&&ui.sheet.packingEdit)ui.sheet.packingEdit[event.target.name]=event.target.value;
});
document.addEventListener("submit",event=>{
  if(!["packing-trip-form","packing-add-form","packing-edit-form"].includes(event.target.id))return;
  event.preventDefault();event.stopImmediatePropagation();const form=event.target;
  if(form.id==="packing-trip-form")return pkSaveTrip(form,true);
  if(form.id==="packing-edit-form")return pkFinishEdit(form);
  const doc=packingDraft(ui.sheet.id?savedItem("notes",ui.sheet.id):null),text=form.elements.text.value.trim();if(!text)return;
  if(doc.items.length>=200){toast("В списке уже 200 пунктов");return;}
  doc.items.push({id:crypto.randomUUID(),text,quantity:1,section:"personal",done:false,source:"manual"});pkCommit(doc);render();
},true);
