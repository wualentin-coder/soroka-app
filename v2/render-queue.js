/*
 * «Очередь рендеров» на экране «Компьютер» — Render Manager на домашнем ПК
 * (Karma из Houdini и After Effects). Зеркало очереди приходит в состоянии ПК
 * (`rmQueue`, его шлёт агент Flow); команды — те же rm_*, что у бота:
 * отменить, переставить (перетащить за ручку), повторить, дорендерить,
 * в облако снова, пауза очереди и «Поставить сцену» из недавних и из Облака.
 */

const RM_ACTIVE = ["rendering", "delivering"];
const RM_WAITING = ["queued", "paused"];
const RM_APP = { karma: "Karma", ae: "After Effects", fake: "Тест" };

function rmQueue() { return ui.pc?.data?.rmQueue || {}; }
function rmFresh(d) {
  const q=d.rmQueue || {},stamp=q.at || q.observed_at;
  return d.agent!==false && q.service?.available!==false && (!stamp || (Number.isFinite(Date.parse(stamp)) && Date.now()-Date.parse(stamp)<90000));
}
const rmJobs = () => rmQueue().jobs || [];
/** Есть ли в очереди что-то идущее или ждущее — тогда «Когда закончится» управляет очередью. */
const rmBusy = () => rmJobs().some(j => RM_ACTIVE.includes(j.status) || RM_WAITING.includes(j.status));

function rmMinutes(s) { s = Math.round(Number(s) || 0); return s >= 3600 ? `${Math.floor(s / 3600)} ч ${Math.round(s % 3600 / 60)} мин` : `${Math.max(1, Math.round(s / 60))} мин`; }
const rmBusyCls = key => ui.pc.quick?.[key] || "";

/** Идущая задача: название, процент, полоса, кадры и сколько осталось. */
function rmProgress(j) {
  if (j.status === "delivering") return Number(j.delivery?.total) > 0 ? Math.max(0, Math.min(100, Number(j.delivery.files || 0) / Number(j.delivery.total) * 100)) : null;
  // Счётчик кадров — не процент готового ролика: после него ещё сборка и проверка.
  if (j.stage && /склей|кодир|сборк|провер|подготов|открыва|копир|исходник/i.test(j.stage)) return null;
  if (j.percent === null || j.percent === undefined || j.percent === "" || !Number.isFinite(Number(j.percent))) return null;
  if (!j.done && j.stage && !j.stage.startsWith("рендер")) return null;
  return Math.max(0, Math.min(100, Number(j.percent)));
}
function rmActiveRow(j, fresh = true) {
  const pct = fresh ? rmProgress(j) : null;
  const facts = !fresh ? "Нет свежих данных с ПК" : j.status === "delivering" ? `переношу в облачную папку${j.delivery?.total ? ` · ${j.delivery.files || 0} из ${j.delivery.total} файлов` : ""}`
    // «готово», а не «кадр»: части рендерят с разных мест, номер кадра в папке обгоняет счёт готовых
    : [j.total ? `готово ${j.done || 0} из ${j.total}` : "", j.eta ? `осталось ~${rmMinutes(j.eta)}` : "", j.stage && j.stage !== "рендер" ? j.stage : ""].filter(Boolean).join(" · ");
  const bar = pct === null
    ? `<div class="pc-render-bar indeterminate"><b></b></div>` : `<div class="pc-render-bar"><b style="--v:${pct}%"></b></div>`;
  return `<div class="pc-render-live rm-live"><div class="pc-render-title"><span class="pc-render-dot"></span><strong>${esc(j.name)}</strong>${pct === null ? "" : `<b class="pc-render-pct">${Math.round(pct)}%</b>`}</div>${bar}<p class="pc-render-facts">${esc(RM_APP[j.app] || j.app)}${facts ? ` · ${esc(facts)}` : ""}</p>${j.resource_decision ? `<p class="section-note">${esc(rmResourceText(j.resource_decision))}</p>` : ''}${j.warning ? `<p class="rm-warn">${esc(j.warning)}</p>` : ""}<div class="rm-acts">${j.status === "rendering" ? `<button type="button" class="small-button ${rmBusyCls(`rm-pause-${j.id}`)}" data-action="rm-pause" data-id="${j.id}">Пауза</button>` : ""}<button type="button" class="small-button ${rmBusyCls(`rm-cancel-${j.id}`)}" data-action="rm-cancel" data-id="${j.id}" data-name="${esc(j.name)}">Отменить</button></div></div>`;
}
function rmResourceText(r) { return [`${r.mode==='auto'?'Авто':'Вручную'} · частей: ${r.parallel}`,r.reason,r.warning].filter(Boolean).join(' · '); }

/** Ждущая задача: ручка для перетаскивания, название, кадры, отмена. */
function rmWaitingRow(j, i) {
  const paused = j.status === "paused";
  // на паузе: сколько уже готово — «Продолжить» дорендерит остальное
  const facts = [RM_APP[j.app] || j.app, paused && j.total ? `готово ${j.done || 0} из ${j.total}` : j.frames ? `кадры ${j.frames}` : "", paused ? "на паузе" : ""];
  return `<div class="rm-wait ${paused ? "rm-paused" : ""}" data-id="${j.id}" style="--i:${i}"><span class="rm-grip" aria-label="Перетащить">${"<i></i>".repeat(6)}</span><span class="rm-wait-text"><b>${esc(j.name)}</b><small>${esc(facts.filter(Boolean).join(" · "))}</small></span>${paused ? `<button type="button" class="text-action ${rmBusyCls(`rm-resume-${j.id}`)}" data-action="rm-resume" data-id="${j.id}">Продолжить</button>` : ""}<button type="button" class="icon-button rm-x ${rmBusyCls(`rm-cancel-${j.id}`)}" data-action="rm-cancel" data-id="${j.id}" data-name="${esc(j.name)}" aria-label="Убрать из очереди">${pcIcon("x")}</button></div>`;
}

/** Законченная: итог одной строкой и действие, если оно есть. */
function rmRecentRow(j) {
  const deliveryFailed = j.status === "done" && j.delivery?.status === "failed";
  const mark = j.status === "done" && !deliveryFailed ? `<span class="rm-mark ok">${pcIcon("check")}</span>`
    : j.status === "cancelled" ? `<span class="rm-mark off">${pcIcon("x")}</span>` : `<span class="rm-mark bad">${pcIcon("x")}</span>`;
  const note = j.status === "done" && j.benchmark ? (j.benchmark_result ? rmBenchmarkText(j.benchmark_result) : `Тест завершён без достоверной оценки${j.warning ? `: ${j.warning}` : ''}`) : j.status === "done" ? (deliveryFailed ? `в облако не ушло: ${j.delivery.error || "ошибка"}` : j.warning ? `готово с предупреждением: ${j.warning}` : j.delivery?.status === "done" ? "готово, в облаке" : "готово")
    : j.status === "failed" ? (j.error || "ошибка") : `отменено${j.total ? ` на кадре ${j.done || 0} из ${j.total}` : ""}`;
  const act = (op, label) => `<button type="button" class="text-action ${rmBusyCls(`rm-${op}-${j.id}`)}" data-action="rm-${op}" data-id="${j.id}">${label}</button>`;
  // Karma и фон частями дорендеривают с готовых кадров в ту же папку — это «Продолжить», и ролик склеится целиком
  // (21.10 новая задача «с 980 кадра» ушла в отдельный рендер, и видео собралось только из её кадров).
  const resumable = (j.app === "karma" || (j.app === "ae" && j.ae_backend === "background")) && Number(j.done) > 0 && Number(j.total) > Number(j.done);
  const action = deliveryFailed ? act("deliver", "В облако")
    : j.status === "failed" && j.missing > 0 ? act("missing", `Дорендерить ${j.missing}`)
      : (j.status === "failed" || j.status === "cancelled") && resumable ? act("retry", `Продолжить · ${j.done}/${j.total}`)
        : j.status === "failed" || j.status === "cancelled" ? act("retry", "Повторить") : "";
  return `<div class="rm-recent">${mark}<span class="rm-wait-text"><b>${esc(j.name)}</b><small>${esc(note)}</small>${j.resource_decision ? `<small>${esc(rmResourceText(j.resource_decision))}</small>` : ''}</span>${action}</div>`;
}

function rmBlock(d) {
  const q = d.rmQueue || {};
  const jobs = q.jobs || [];
  const active = jobs.filter(j => RM_ACTIVE.includes(j.status));
  const waiting = jobs.filter(j => RM_WAITING.includes(j.status));
  const recent = jobs.filter(j => !RM_ACTIVE.includes(j.status) && !RM_WAITING.includes(j.status)).slice(0, 3);
  const hold = `<button type="button" class="small-button rm-hold ${rmBusyCls("rm-hold")}" data-action="rm-hold" data-on="${q.held ? "0" : "1"}">${q.held ? "Продолжить" : "Пауза"}</button>`;
  const empty = !active.length && !waiting.length;
  const body = [
    q.held ? `<p class="section-note rm-held">Очередь на паузе: текущий рендер доработает, следующие ждут.</p>` : "",
    active.map(j => rmActiveRow(j, rmFresh(d))).join(""),
    waiting.length ? `<p class="pc-find-label">Дальше${waiting.length > 1 ? " — порядок можно менять, перетаскивая за ручку" : ""}</p><div class="rm-waiting">${waiting.map(rmWaitingRow).join("")}</div>` : "",
    empty ? `<p class="section-note">Сейчас в очереди ничего нет.</p>` : "",
    recent.length ? `<p class="pc-find-label">Недавно</p><div class="rm-recents">${recent.map(rmRecentRow).join("")}</div><button type="button" class="text-action ${rmBusyCls("rm-clear")}" data-action="rm-clear">Очистить завершённые</button>` : "",
  ].join("");
  return `<section class="pc-card rm-card ${active.length ? "pc-rendering" : ""}"><div class="pc-card-head"><h3>${pcIcon("film")}Очередь рендеров</h3>${empty && !q.held ? "" : hold}</div>${body}<button type="button" class="ghost-button rm-add" data-action="rm-scenes">Поставить сцену</button></section>`;
}

/** Строка на экране «Компьютер»: что с рендером сейчас, по нажатию — раздел «Рендер». */
function rmLinkRow(d) {
  const jobs = d.rmQueue?.jobs || [];
  const now = jobs.find(j => RM_ACTIVE.includes(j.status));
  const waiting = jobs.filter(j => RM_WAITING.includes(j.status)).length;
  const r = d.render || {};
  const progress = now && rmFresh(d) ? rmProgress(now) : null;
  const line = now ? `${now.name} — ${!rmFresh(d)?'нет свежих данных':progress === null ? (now.stage || (now.status === "delivering" ? "доставка" : "подготовка")) : `${Math.round(progress)}%`}${waiting ? ` · ещё ${waiting} в очереди` : ""}`
    : r.rendering ? `Вручную в AE: ${r.comp || "композиция"}${r.percent != null ? ` — ${Math.round(Number(r.percent))}%` : ""}`
      : waiting ? `В очереди: ${waiting}` : "Очередь, прогресс, поставить сцену";
  return `<button type="button" class="pc-card rm-link ${now || r.rendering ? "pc-rendering" : ""}" data-action="navigate" data-page="render">${pcIcon("film")}<span class="rm-wait-text"><b>Рендер</b><small>${esc(line)}</small></span>${now || r.rendering ? `<span class="pc-render-dot"></span>` : ""}<span class="rm-chev">›</span></button>`;
}

/** Раздел «Рендер»: очередь Render Manager, ручной рендер AE и «Когда закончится». */
function renderRenderPage() {
  pcLoad();
  const d = ui.pc?.data;
  const top = header("Рендер", "Karma и After Effects на домашнем ПК", "Дом");
  if (!d) return `${top}<div class="content-grid"><div class="content-main pc-page"><section class="pc-card"><p class="section-note">${esc(ui.pc?.error || "Спрашиваю компьютер…")}</p>${ui.pc?.error ? `<button class="primary-button" type="button" data-action="pc-refresh">Повторить</button>` : ""}</section></div></div>`;
  const off = !d.agent ? `<section class="pc-card"><p class="section-note">${d.on === false ? "Компьютер выключен" : "Компьютер не на связи"} — ниже последняя известная очередь. «Поставить сцену» включит его сам${d.hub ? "" : ", когда ESP32 будет на связи"}.</p></section>` : "";
  return `${top}<div class="content-grid"><div class="content-main pc-page">${off}${rmBlock(d)}${rmHealthCard(d)}${d.agent ? pcRenderBlock(d) : ""}${rmSettingsCard(d)}</div></div>`;
}

function rmHealthCard(d) {
  const q=d.rmQueue || {},service=q.service || {},age=stamp=>Number.isFinite(Date.parse(stamp)) ? `${rmSecs(Math.max(0,Date.now()-Date.parse(stamp)))} назад`:'ещё нет данных';
  const row=(label,value)=>`<div class="rm-set-row"><span>${label}</span><b>${esc(value)}</b></div>`;
  const active=(q.jobs || []).find(j=>RM_ACTIVE.includes(j.status));
  return `<details class="pc-card rm-card"><summary>Связь и диагностика</summary>${row('Агент ПК',d.agent?'на связи':'нет связи')}${row('Последняя связь агента',age(d.agentSeen))}${row('Сервис Render Manager',service.available===false?'не отвечает':rmFresh(d)&&q.at?'на связи':'нет свежего подтверждения')}${row('Очередь обновлена',age(q.at || q.observed_at))}${row('Расширение AE',service.ae_agent?.alive?'на связи':service.ae_agent?'нет связи / AE закрыт':'нет данных')}${service.build?row('Сборка',typeof service.build==='string'?service.build:service.build.code || service.build.commit || service.build.version || 'неизвестна'):''}${active?row('Этап',active.stage || active.status):''}${active?.warning?`<p class="rm-warn">${esc(active.warning)}</p>`:''}<button type="button" class="text-action" data-action="pc-refresh">Обновить состояние</button></details>`;
}

// ------------------------------------------------------------ параметры задачи и настройки

const RM_OUTPUT = [["root", "Папка рендера"], ["scene", "Как в сцене"], ["custom", "Своя папка"]];
const RM_DELIVER = [["move", "В облако"], ["copy", "Копию в облако"], ["none", "Не отправлять"]];
const RM_BACKEND = [["background", "В фоне"], ["cep", "В открытом AE"], ["auto", "Авто"]];
// Фон частями (rm/runners/ae_split.py): несколько AE на своих кусках кадров; видео — кадрами, склейка ffmpeg
const RM_PARTS = [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]];
// 5–8 — для тестов владельца: у каждой части своя память и видеопамять, на 48 ГБ / 16 ГБ VRAM разумно 2–4
const RM_PARTS_TEST = [["5", "5"], ["6", "6"], ["7", "7"], ["8", "8"]];
const RM_MFR_PARTS_WARN = "Тест: MFR в каждой части. 21.10 три части с MFR заняли 15,5 из 16 ГБ видеопамяти и встали — если рендер замрёт, Render Manager дорендерит кусок одной частью.";
const RM_PARTS_NOTE = "Каждая часть — свой After Effects и своя память; при 48 ГБ разумно 2–3. Видео рендерится кадрами и склеивается ffmpeg — поэтому есть «Пауза» и «Продолжить». MFR у частей по умолчанию выключен: вместе они переполняют видеопамять.";
const rmLabel = (list, v) => (list.find(([k]) => k === v) || [, v])[1];
function rmSettings() {
  const s = rmQueue().settings || {};
  return { render_root: s.render_root || "D:\\Render", deliver_root: s.deliver_root || "D:\\RenderCloud", default_output: s.default_output || "root",
    default_deliver: s.default_deliver || "move", ae_backend: s.ae_backend || "auto", ae_parallel: String(s.ae_parallel || 2),
    background_off: Boolean(s.background_off), known: Boolean(rmQueue().settings) };
}

/** Ряд кнопок-вариантов: выбранный подсвечен, нажатие меняет поле формы листа. */
function rmSegments(key, list, value) {
  return `<div class="segmented rm-seg" style="--n:${list.length}">${list.map(([v, label]) => `<button type="button" class="segment ${value === v ? "active" : ""}" data-action="rm-opt" data-key="${key}" data-value="${v}" aria-pressed="${value === v}">${label}</button>`).join("")}</div>`;
}
const rmField = (label, html, note = "") => `<div class="rm-field"><p class="pc-after-label">${label}</p>${html}${note ? `<p class="section-note">${note}</p>` : ""}</div>`;
const RM_PRESET_KEYS = ['output_mode','output_dir','deliver','ae_backend','parallel','mfr_in_parts','ae_mfr','ae_resolution','ae_template'];
const RM_RESOLUTION = [['inherit','Как в AE'],['full','Полное'],['half','½'],['quarter','¼']];
function rmPresets(app) {
  const base = {output_mode:'root',output_dir:'',deliver:'none',ae_backend:'background',ae_mfr:'inherit',ae_template:''};
  return [...(app === 'ae' ? [
    {id:'draft',name:'Черновик · ½',form:{...base,ae_resolution:'half'}},
    {id:'check',name:'Проверка · полное',form:{...base,ae_resolution:'full'}},
    {id:'final',name:'Финал · как в AE',form:{...base,ae_resolution:'inherit'}},
  ] : []),...(rmQueue().presets || []).filter(p=>p.app===app)];
}
function rmBenchmarkText(r) {
  const memory=r.resources,gb=n=>n==null?'нет замера':`${(Number(n)/1073741824).toFixed(1)} ГБ`;
  return `Тест: ${Number(r.wall_seconds).toFixed(1)} с · ${Number(r.seconds_per_frame).toFixed(2)} с/кадр · полный рендер ≈${rmMinutes(r.estimated_seconds)} · ${r.mode==='parts'?`${r.parallel} части · проба ${r.repeat}`:`MFR ${r.mfr === 'on' ? 'вкл.' : 'выкл.'}`}${memory?` · пик RAM ${gb(memory.peak_ram_bytes)} · VRAM ${gb(memory.peak_vram_bytes)}`:''}`;
}
function rmPartAdvice(scene,target,form) {
  const jobs=rmJobs().filter(j=>j.status==='done' && j.benchmark_result?.mode==='parts' && j.benchmark?.group &&
    j.scene===scene.path && j.target===target.target && j.scene_stamp===target.scene_stamp &&
    (j.ae_resolution || 'inherit')===(form.ae_resolution || 'inherit') && (j.benchmark.requested_template || '')===(form.ae_template || ''));
  const group=jobs.sort((a,b)=>Number(b.finished_at || 0)-Number(a.finished_at || 0))[0]?.benchmark.group;
  const samples=jobs.filter(j=>j.benchmark.group===group),scores=[];
  for(const parallel of [1,2,3,4]) {
    const measured=samples.filter(j=>j.benchmark_result.parallel===parallel && Number(j.benchmark_result.seconds_per_frame)>0);
    if(new Set(measured.map(j=>j.benchmark.repeat)).size<2)return '';
    const values=measured.map(j=>Number(j.benchmark_result.seconds_per_frame)).sort((a,b)=>a-b);
    const n=values.length,median=(values[Math.floor((n-1)/2)]+values[Math.floor(n/2)])/2;
    scores.push({parallel,median});
  }
  const best=scores.sort((a,b)=>a.median-b.median || a.parallel-b.parallel)[0];
  return best?`<button type="button" class="text-action" data-action="rm-opt" data-key="parallel" data-value="${best.parallel}">По двум пробам: ${best.parallel} части · ${best.median.toFixed(2)} с/кадр — применить</button>`:'';
}
/** Пресеты — одной строкой чипов наверху; сохранить свой — в «Дополнительно». */
function rmPresetChips(scene,f) {
  const list = rmPresets(scene.app);
  if (!list.length) return '';
  return `<div class="rm-chips" role="group" aria-label="Пресеты">${list.map(p=>`<button type="button" class="rm-chip ${f.preset_name===p.name ? 'active' : ''}" data-action="rm-preset" data-id="${esc(p.id)}" aria-pressed="${f.preset_name===p.name}">${esc(p.name)}</button>`).join('')}</div>`;
}
function rmPresetSave(f) {
  return rmField('Сохранить как пресет', `<div class="rm-inline"><input class="rm-input" data-form="preset_name" maxlength="60" value="${esc(f.preset_name || '')}" placeholder="Название"><button type="button" class="small-button ${rmBusyCls('rm-preset-save')}" data-action="rm-preset-save">Сохранить</button></div>${f.preset_id ? `<button type="button" class="text-action" data-action="rm-preset-delete" data-id="${esc(f.preset_id)}">Удалить этот пресет</button>` : ''}`, 'Сохраняются куда, облако и настройки AE — без кадров и срочности.');
}
function rmChosenTargets(scene) {
  return ui.sheet?.batch ? (scene.targets || []).filter(t=>(ui.sheet.selected || []).includes(rmTargetKey(t))) :
    [ui.sheet?.targetKey ? scene.targets?.find(t=>rmTargetKey(t)===ui.sheet.targetKey) : scene.targets?.[ui.sheet?.target]].filter(Boolean);
}
function rmFormFor(t,f) { return {...f,frames:ui.sheet?.batch && !String(f.frames || '').trim() ? t.frames : f.frames,...(ui.sheet?.benchmark ? {output_mode:'root',deliver:'none',ae_backend:'background'} : {})}; }
function rmJobArgs(scene,t,f) {
  const media=rmEffectiveMedia(t,f,scene.app);
  return {path:scene.path,target:t.target,frames:String(f.frames).replace(/\s+/g,''),output:t.output || '',scene_stamp:t.scene_stamp,
    ...(Number(t.audit?.fps)>0 ? {fps:Number(t.audit.fps)} : {}),...(media.width && media.height ? {width:media.width,height:media.height} : {}),format:f.ae_template ? '' : t.audit?.format || '',audit:t.audit || {},
    ...(t.comp_id ? {comp_id:t.comp_id} : {}),...(t.rq_index ? {rq_index:t.rq_index} : {}),urgent:f.urgent==='1',
    output_mode:f.output_mode,deliver:f.deliver,...(f.output_mode==='custom' ? {output_dir:String(f.output_dir || '').trim()} : {}),
    ...(scene.app==='ae' && f.ae_backend==='background' ? {parallel:f.parallel==='auto'?'auto':Number(f.parallel) || 1} : {}),...(scene.app==='ae' ? {ae_backend:f.ae_backend,ae_mfr:f.parallel==='auto' && f.ae_backend==='background'?'off':f.ae_mfr || 'inherit',ae_resolution:f.ae_resolution || 'inherit',ae_template:f.ae_template || ''} : {}),
    // тест: MFR в каждой части принудительно (по умолчанию у частей выключен)
    ...(scene.app==='ae' && f.ae_backend==='background' && Number(f.parallel) > 1 && f.mfr_in_parts==='1' ? {mfr_in_parts:true,ae_mfr:'on'} : {})};
}
function rmSubmitSheet() {
  const scene=(rmQueue().scenes || []).find(s=>s.id===ui.sheet?.scene), f=ui.sheet?.form;
  if (!scene || !f) return;
  const targets=rmChosenTargets(scene);
  if (!targets.length) return;
  const items=[];
  for (const t of targets) {
    const form=rmFormFor(t,f), audit=rmAudit(scene,t,form);
    if (audit.errors.length) {toast(audit.errors[0]);rmRefreshError();return;}
    const args=rmJobArgs(scene,t,form);
    if (ui.sheet.benchmark) {
      let sample;
      try {sample=rmFrameSummary(f.sample_frames);} catch(e){toast(e.message);return;}
      const full=String(form.frames).match(/^(-?\d+)(?:-(-?\d+))?$/), part=String(f.sample_frames).match(/^(-?\d+)(?:-(-?\d+))?$/);
      if (!full || !part || sample.segments!==1 || sample.count<2 || sample.count>120 || Number(part[1])<Number(full[1]) || Number(part[2]??part[1])>Number(full[2]??full[1])) {toast('Тест: 2–120 кадров внутри полного диапазона');return;}
      if(f.benchmark_mode==='parts') {
        const group=ui.sheet.submissionId ||= window.crypto?.randomUUID?.() || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
        for(const [index,parallel] of [1,2,3,4,4,3,2,1].entries())items.push({...args,frames:f.sample_frames,parallel,
          benchmark:{full_frames:args.frames,mode:'parts',repeat:index<4?1:2,group},ae_backend:'background',ae_mfr:'off',mfr_in_parts:false,deliver:'none'});
      } else for (const mfr of ['off','on']) items.push({...args,frames:f.sample_frames,benchmark:{full_frames:args.frames},ae_backend:'background',parallel:1,mfr_in_parts:false,ae_mfr:mfr,deliver:'none'});
    } else items.push(args);
  }
  const batch=items.length>1 || ui.sheet.benchmark;
  ui.sheet.submissionId ||= window.crypto?.randomUUID?.() || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const args={path:scene.path,request_id:ui.sheet.submissionId,items:items.map(({path,...item})=>item)};
  const names=[...new Set(items.map(x=>x.target))], bench=ui.sheet.benchmark;
  ui.sheet=null;render();
  rmTask('rm_batch',args,{title:bench ? 'Ставлю тест скорости' : batch ? `Ставлю ${rmPlural(items.length,'задачу','задачи','задач')}` : `Ставлю «${names[0]}»`,
    done:r=>{setTimeout(()=>pcLoad(true),1000);return {title:r?.message || 'Поставил в очередь',lines:names.slice(0,6),
      action:{label:'К очереди',run:()=>{if (ui.page!=='render') navigate('render');render();}}};}});
}
const rmBackendNote = s => s.background_off ? "Фон после сбоя отключён на сутки: «Авто» сейчас рендерит в открытом AE. «В фоне» — попробовать фон снова." : "В фоне AE работает без окна, как Karma в Houdini; не начал за 20 мин — «Авто» переходит в открытый AE.";

/** Настройки по умолчанию: куда рендерить, облако, способ AE. */
function rmSettingsCard(d) {
  const s = rmSettings();
  if (!s.known && !d.agent) return "";
  const row = (k, v) => `<div class="rm-set-row"><span>${k}</span><b>${esc(v)}</b></div>`;
  return `<section class="pc-card rm-card"><div class="pc-card-head"><h3>${pcIcon("list")}Настройки рендера</h3><button type="button" class="small-button" data-action="rm-settings" ${s.known ? "" : "disabled"}>Изменить</button></div>${s.known ? `${row("Папка рендера", s.render_root)}${row("Папка Облака", s.deliver_root)}${row("Куда по умолчанию", rmLabel(RM_OUTPUT, s.default_output))}${row("Облако по умолчанию", rmLabel(RM_DELIVER, s.default_deliver))}${row("After Effects", rmLabel(RM_BACKEND, s.ae_backend))}${s.background_off && s.ae_backend === "auto" ? `<p class="rm-warn">${rmBackendNote(s)}</p>` : ""}` : `<p class="section-note">Настройки придут с компьютера вместе с очередью — в течение минуты.</p>`}</section>`;
}

function renderRmSettingsSheet() {
  const f = ui.sheet.form;
  const body = [
    rmField("Папка рендера", `<input class="rm-input" data-form="render_root" value="${esc(f.render_root)}" autocomplete="off" spellcheck="false">`, "Сюда рендерится всё с «Папка рендера»: сцена\\цель\\v001."),
    rmField("Папка Облака", `<input class="rm-input" data-form="deliver_root" value="${esc(f.deliver_root)}" autocomplete="off" spellcheck="false">`, "Её резервирует Облако Mail.ru — готовый рендер переносится или копируется сюда."),
    rmField("Куда по умолчанию", rmSegments("default_output", RM_OUTPUT.filter(([k]) => k !== "custom"), f.default_output)),
    rmField("Облако по умолчанию", rmSegments("default_deliver", RM_DELIVER, f.default_deliver)),
    rmField("After Effects по умолчанию", rmSegments("ae_backend", RM_BACKEND, f.ae_backend), rmBackendNote(rmSettings())),
    rmField("Частей в фоне по умолчанию", rmSegments("ae_parallel", RM_PARTS, String(f.ae_parallel || "2")), RM_PARTS_NOTE),
  ].join("");
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet rm-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Настройки рендера</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div>${body}<button type="button" class="primary-button rm-submit ${rmBusyCls("rm-settings-save")}" data-action="rm-settings-save">Сохранить</button></section></div>`;
}

function rmFrameSummary(text) {
  const intervals = String(text || "").split(",").map(part => {
    const m = part.trim().match(/^(-?\d+)(?:-(-?\d+))?$/);
    if (!m) throw Error("Проверьте диапазон кадров");
    const a = Number(m[1]), b = Number(m[2] ?? m[1]);
    if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || b < a) throw Error("Конец диапазона раньше начала");
    return [a,b];
  }).sort((a,b) => a[0]-b[0]);
  const merged = [];
  for (const pair of intervals) {
    const last = merged.at(-1);
    if (last && pair[0] <= last[1]+1) last[1] = Math.max(last[1],pair[1]); else merged.push([...pair]);
  }
  const count = merged.reduce((n,[a,b]) => n+b-a+1,0);
  if (count > 10000000) throw Error("Слишком большой диапазон кадров");
  return {count,segments:merged.length};
}
/** Проверка перед постановкой: ошибки (не пустим) и предупреждения (пустим, но покажем). */
function rmAudit(scene,target,form) {
  const a = target.audit || {}, errors = [], warnings = [...(a.warnings || []), ...(target.problems || [])];
  let frames;
  try { frames = rmFrameSummary(form.frames); } catch(error) { errors.push(error.message); }
  if (scene.app === "ae" && frames?.segments > 1) errors.push("Для AE нужен непрерывный диапазон кадров");
  if (!target.audited_at || !target.scene_stamp) errors.push("Сначала прочитайте сцену");
  if (form.output_mode === "scene" && !target.output) errors.push("В сцене не указан путь вывода — выберите «Папка рендера»");
  if (form.output_mode === "custom" && !/^[a-z]:\\/i.test(form.output_dir || "")) errors.push("Укажите полный путь своей папки, например E:\\Render");
  const media = rmEffectiveMedia(target,form,scene.app);
  warnings.push(...media.warnings);
  if (scene.app==='ae' && form.ae_backend==='background' && Number(form.parallel)>4) warnings.push('5–8 частей — экспериментальный режим: каждая часть занимает отдельную RAM и VRAM.');
  if (scene.app==='ae' && form.ae_backend==='background' && Number(form.parallel)>1 && form.mfr_in_parts==='1') warnings.push(RM_MFR_PARTS_WARN);
  return {errors, warnings, frames, a};
}

/** Аудит хранит размеры композиции. Показываем выбранный масштаб, не выдавая
 * неизвестный Output Module resize/crop за проверенные размеры файла. */
function rmEffectiveMedia(target,form,app='ae') {
  const a=target.audit || {}, warnings=[];
  const template=String(form.ae_template || '');
  let divisor=app==='ae'?{full:1,half:2,quarter:4}[form.ae_resolution]:1;
  if (!divisor) {
    const resolution=String(a.resolution || '').trim().toLowerCase();
    divisor=/^(full|полное|полный|1)$/.test(resolution)?1:/^(half|половина|половинное|½|2)$/.test(resolution)?2:/^(quarter|четверть|¼|4)$/.test(resolution)?4:0;
  }
  const transformed=[a.resize,a.crop].some(x=>x && !/^(off|false|выкл\.?|нет|0)$/i.test(String(x).trim()));
  const known=divisor && !transformed && !template && Number(a.width)>0 && Number(a.height)>0;
  if (!known && a.width && a.height) warnings.push(`Композиция ${a.width}×${a.height}; итоговый размер подтвердит AE${transformed?' (resize/crop в Output Module)':''}.`);
  if (template) warnings.push('Параметры выбранного Output Module подтвердит AE. Нестандартное видео рендерится одним процессом, чтобы сохранить кодек и прозрачность.');
  const format=template ? `Шаблон: ${template}` : a.format || 'Формат из проекта';
  return {width:known?Math.ceil(Number(a.width)/divisor):null,height:known?Math.ceil(Number(a.height)/divisor):null,format,warnings};
}

const rmFps = fps => Number.isFinite(Number(fps)) && Number(fps) > 0 ? `${+Number(fps).toFixed(3)} fps` : "";
function rmDuration(count, fps) {
  if (!count || !(Number(fps) > 0)) return "";
  const s = count / Number(fps);
  return s >= 60 ? `${Math.floor(s / 60)} мин ${Math.round(s % 60)} с` : `${s.toFixed(1)} с`;
}
const rmPlural = (n, one, few, many) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many}`;

/** Что рендерим — одной карточкой: кадры, длительность, размер, формат; ниже — предупреждения. */
function rmSummary(s, chosen, f) {
  if (chosen.length > 1) {
    const rows = chosen.map(t => {
      const form=rmFormFor(t,f),audit=rmAudit(s,t,form),media=rmEffectiveMedia(t,form,s.app);
      const facts=[form.frames,media.width?`${media.width}×${media.height}`:'',rmFps(audit.a.fps),media.format].filter(Boolean).join(' · ');
      return `<div class="rm-sum-row"><span>${esc(t.target)}</span><b>${esc(facts)}</b></div>${audit.warnings.map(w=>`<p class="rm-warn">${esc(w)}</p>`).join('')}`;
    }).join("");
    return `<div class="rm-summary"><b class="rm-sum-title">${rmPlural(chosen.length, "композиция", "композиции", "композиций")}</b><details open><summary>Параметры и предупреждения всех композиций</summary>${rows}</details></div>`;
  }
  const t = chosen[0], audit = rmAudit(s, t, rmFormFor(t, f)), a = audit.a, n = audit.frames?.count,media=rmEffectiveMedia(t,f,s.app);
  const line1 = [n ? rmPlural(n, "кадр", "кадра", "кадров") : "", rmDuration(n, a.fps)].filter(Boolean).join(" · ");
  const line2 = [media.width && media.height ? `${media.width}×${media.height}` : "", rmFps(a.fps), media.format].filter(Boolean).join(" · ");
  const warn = audit.warnings.slice(0, 3).map(w => `<p class="rm-warn">${esc(w)}</p>`).join("") + (audit.warnings.length > 3 ? `<p class="rm-warn">и ещё ${audit.warnings.length - 3}</p>` : "");
  return `<div class="rm-summary"><b class="rm-sum-title">${esc(t.target)}</b>${line1 ? `<p class="rm-sum-facts">${esc(line1)}</p>` : ""}${line2 ? `<p class="rm-sum-facts">${esc(line2)}</p>` : ""}${warn}</div>`;
}

/** Куда ляжет рендер — одной строкой под переключателем. */
function rmWhere(s, t, f) {
  if (ui.sheet?.benchmark) return `${rmSettings().render_root}\\_benchmarks`;
  if (f.output_mode === "scene") return t.output || "в сцене путь не задан";
  if (f.output_mode === "custom") return f.output_dir ? `${f.output_dir}\\…\\v###` : "";
  // как rm/paths.py output_for: папка рендера \ папка проекта \ сцена \ цель \ v###
  const parts = String(s.path || "").split("\\");
  const project = parts.length > 1 ? parts[parts.length - 2] : "scenes";
  const leaf = (ui.sheet?.batch && rmChosenTargets(s).length > 1) ? "<композиция>" : String(t.target || "").replace(/^.*\//, "");
  return `${rmSettings().render_root}\\${project}\\${s.name}\\${leaf}\\v###`;
}

/** Параметры задачи: главное сверху, редкое — в «Дополнительно», кнопка — внизу листа. */
function rmJobForm(s, t) {
  const f = ui.sheet.form, set = rmSettings(), chosen = rmChosenTargets(s), many = chosen.length > 1, bench = ui.sheet.benchmark;
  const errors = [...new Set(chosen.flatMap(x => rmAudit(s, x, rmFormFor(x, f)).errors))];
  const ae = s.app === "ae";
  const main = bench ? [
    `<div class="rm-banner"><b>Тест скорости</b><span>${f.benchmark_mode==='parts'?'1–4 части, по две пробы в обратном порядке. Сравниваем время кадров; копирование проекта и сборка видео в замер не входят.':'Два коротких прогона — без MFR и с MFR.'} Тест пишет отдельную секвенцию без доставки и выключения ПК. Оценка полного рендера приблизительная.</span><button type="button" class="text-action" data-action="rm-benchmark-exit">Отменить тест</button></div>`,
    rmField('Что сравнить',rmSegments('benchmark_mode',[['mfr','MFR'],['parts','1–4 части']],f.benchmark_mode || 'mfr')),
    rmField("Кадры для теста", `<input class="rm-input" data-form="sample_frames" value="${esc(f.sample_frames)}" inputmode="numeric" autocomplete="off">`, `2–120 кадров подряд внутри ${esc(f.frames)}.`),
  ] : [
    !many ? rmField("Кадры", `<input class="rm-input" data-form="frames" value="${esc(f.frames)}" inputmode="numeric" autocomplete="off" placeholder="${esc(t.frames || "1-100")}">`) : "",
    rmField("Куда", rmSegments("output_mode", RM_OUTPUT, f.output_mode) + (f.output_mode === "custom" ? `<input class="rm-input" data-form="output_dir" value="${esc(f.output_dir)}" placeholder="E:\\Render" autocomplete="off" spellcheck="false">` : ""), rmWhere(s, t, f) ? `<span class="rm-path">${esc(rmWhere(s, t, f))}</span>` : ""),
    rmField("Облако", rmSegments("deliver", RM_DELIVER, f.deliver)),
    ae ? rmField("Как рендерить", rmSegments("ae_backend", RM_BACKEND, f.ae_backend), set.background_off && f.ae_backend === "auto" ? "Фон после сбоя отключён на сутки — «Авто» сейчас рендерит в открытом AE." : "") : "",
    ae && f.ae_backend === "background" ? rmField("Частей одновременно", rmSegments("parallel", [['auto','Авто'],...RM_PARTS], String(f.parallel || set.ae_parallel)) + (!many ? rmPartAdvice(s,t,f):'')
      + `<p class="pc-after-label rm-test-label">Для теста</p>` + rmSegments("parallel", RM_PARTS_TEST, String(f.parallel || set.ae_parallel)), f.parallel==='auto'?'Авто выбирает число частей по повторным тестам скорости и свободной RAM/VRAM. Без подходящих замеров — одна часть. MFR внутри частей выключен.':RM_PARTS_NOTE) : "",
    ae && f.ae_backend === "background" && Number(f.parallel || set.ae_parallel) > 1 && !bench
      ? `<button type="button" class="rm-toggle" data-action="rm-opt" data-key="mfr_in_parts" data-value="${f.mfr_in_parts === "1" ? "" : "1"}" aria-pressed="${f.mfr_in_parts === "1"}"><span>MFR в каждой части (тест)</span><i class="rm-switch"></i></button>${f.mfr_in_parts === "1" ? `<p class="rm-warn rm-mfr-warn">${RM_MFR_PARTS_WARN}</p>` : ""}` : "",
    `<button type="button" class="rm-toggle" data-action="rm-opt" data-key="urgent" data-value="${f.urgent === "1" ? "" : "1"}" aria-pressed="${f.urgent === "1"}"><span>Срочно — поставить первой</span><i class="rm-switch"></i></button>`,
  ];
  const more = ui.sheet.more;
  const extra = !more ? "" : [
    many && !bench ? rmField("Один диапазон для всех", `<input class="rm-input" data-form="frames" value="${esc(f.frames)}" inputmode="numeric" autocomplete="off" placeholder="у каждой свой">`) : "",
    ae ? rmField("Разрешение", rmSegments("ae_resolution", RM_RESOLUTION, f.ae_resolution || "inherit"), "Только для этой задачи; композиция в проекте не меняется.") : "",
    ae ? rmField("Формат вывода", `<select class="rm-input" data-form="ae_template"><option value="">Как в проекте</option>${[...new Set(chosen.flatMap(x => x.audit?.templates || []))].map(name => `<option value="${esc(name)}" ${f.ae_template === name ? "selected" : ""}>${esc(name)}</option>`).join("")}</select>`) : "",
    ae && !bench && f.ae_backend === "background" && Number(f.parallel || 1) <= 1 ? rmField("Многокадровый рендер (MFR)", rmSegments("ae_mfr", [["inherit", "Как в AE"], ["off", "Выкл."], ["on", "Вкл."]], f.ae_mfr || "inherit"), "Ускоряет не всё: проверьте тестом скорости.") : "",
    ae && !many && !bench ? `<button type="button" class="ghost-button rm-wide" data-action="rm-benchmark">Тест скорости: с MFR и без</button>` : "",
    !bench ? rmPresetSave(f) : "",
  ].join("");
  const label = bench ? "Запустить тест" : many ? `Поставить ${rmPlural(chosen.length, "задачу", "задачи", "задач")}` : "Поставить в очередь";
  return [
    rmSummary(s, chosen, f),
    !bench ? rmPresetChips(s, f) : "",
    ...main,
    `<button type="button" class="rm-more" data-action="rm-more" aria-expanded="${Boolean(more)}">Дополнительно<span>${more ? "▴" : "▾"}</span></button>`,
    extra,
    `<div class="rm-foot"><p class="rm-err" ${errors.length ? "" : "hidden"}>${esc(errors[0] || "")}</p>${!t.audited_at ? `<button type="button" class="ghost-button rm-wide" data-action="rm-read" data-id="${esc(s.id)}">Прочитать сцену</button>` : ""}<button type="button" class="primary-button rm-wide ${rmBusyCls("rm-submit")}" data-action="rm-submit">${label}</button></div>`,
  ].join("");
}

/** Пока печатают кадры или папку — обновляем только строку ошибки над кнопкой (поле не теряет фокус). */
function rmRefreshError() {
  const box = document.querySelector(".rm-sheet .rm-err");
  const s = (rmQueue().scenes || []).find(x => x.id === ui.sheet?.scene), f = ui.sheet?.form;
  if (!box || !s || !f) return;
  const first = rmChosenTargets(s).flatMap(x => rmAudit(s, x, rmFormFor(x, f)).errors)[0] || "";
  box.textContent = first;
  box.hidden = !first;
}

// Поля листа: значение — сразу в форму, без перерисовки (иначе поле теряет фокус).
document.addEventListener("input", event => {
  const key = event.target?.dataset?.form;
  if (key && ui.sheet?.form) {ui.sheet.form[key] = event.target.value;delete ui.sheet.submissionId;ui.sheet.confirm=false;rmRefreshError();}
});
document.addEventListener('change',event=>{
  const key=event.target?.dataset?.form;
  if (key && ui.sheet?.form) {ui.sheet.form[key]=event.target.value;delete ui.sheet.submissionId;ui.sheet.confirm=false;}
});

// ------------------------------------------------------------ «Поставить сцену»

const rmTargetKey = t => `${t.comp_id || t.target}:${t.rq_index || 0}`;
const rmFilter = scene => ui.pc.rmTargetFilters?.[scene.id] || scene.target_filter || {mode:"queue",prefix:"[R]",label_id:1};
/** Какие композиции AE показать: из Render Queue, по префиксу имени или по цветовой метке (label). */
function rmTargetFilter(scene) {
  if (scene.app !== "ae") return "";
  const filter = rmFilter(scene);
  const chip = (mode, label) => `<button type="button" class="rm-chip ${filter.mode === mode ? "active" : ""}" data-action="rm-filter" data-mode="${mode}" aria-pressed="${filter.mode === mode}">${label}</button>`;
  return `<div class="rm-chips" role="group" aria-label="Какие композиции">${chip("queue", "Render Queue")}${chip("prefix", "Префикс имени")}${chip("label", "Цвет метки")}</div>` +
    (filter.mode === "prefix" ? `<input class="rm-input" data-rm-filter="prefix" value="${esc(filter.prefix)}" maxlength="24" placeholder="Начало имени, например [R]">` : "") +
    (filter.mode === "label" ? `<select class="rm-input" data-rm-filter="label_id">${Array.from({length:16},(_,i)=>`<option value="${i+1}" ${Number(filter.label_id) === i+1 ? "selected" : ""}>${scene.ae_labels?.[String(i+1)] ? esc(scene.ae_labels[String(i+1)]) : `Цвет ${i+1}`}</option>`).join("")}</select>` : "");
}
const rmTargetFacts = t => [t.rq_index ? `#${t.rq_index} в очереди AE` : "", t.frames ? `кадры ${t.frames}` : "", t.audit?.width ? `${t.audit.width}×${t.audit.height}` : ""].filter(Boolean).join(" · ");
document.addEventListener("change", event => {
  const key = event.target?.dataset?.rmFilter;
  if (!key) return;
  const scene = (rmQueue().scenes || []).find(x=>x.id === ui.sheet?.scene);
  if (!scene) return;
  ui.sheet.selected=[];
  ui.pc.rmTargetFilters = {...(ui.pc.rmTargetFilters || {}),[scene.id]:{...rmFilter(scene),[key]:event.target.value}};
  render();
});

function renderRmScenesSheet() {
  const scenes = rmQueue().scenes || [];
  const s = ui.sheet.scene ? scenes.find(x => x.id === ui.sheet.scene) : null;
  const t = s ? rmChosenTargets(s)[0] : null;
  const back = t ? `data-action="rm-scene" data-id="${esc(s.id)}"` : `data-action="rm-scenes"`;
  const head = title => `<div class="sheet-handle"></div><div class="sheet-head">${s ? `<button class="icon-button" type="button" ${back} aria-label="Назад">${icon("left")}</button>` : ""}<h2 id="sheet-title">${title}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div>`;
  let body;
  if (t) {
    body = rmJobForm(s, t);
  } else if (!s) {
    body = scenes.length
      ? `<div class="rm-scenes">${scenes.map(x => `<button type="button" class="pc-find-row" data-action="rm-scene" data-id="${esc(x.id)}"><span class="pc-find-ico file"><svg viewBox="0 0 24 24" aria-hidden="true">${PC_FIND_ICON.file}</svg></span><span class="pc-find-text"><b>${esc(x.name)}${x.cloud ? " ☁" : ""}</b><small>${esc([x.primary ? 'Основной проект' : '', x.app === "karma" ? "Houdini" : "After Effects", x.targets?.length ? `целей: ${x.targets.length}` : "ещё не прочитана", x.cloud ? "в Облаке" : ""].filter(Boolean).join(" · "))}</small></span></button>`).join("")}</div><p class="section-note">Основные проекты, недавние сцены Houdini и AE, прошлые рендеры и проекты в Облаке (O:). Служебные снимки скрыты.</p>`
      : `<p class="section-note">Список сцен с компьютера ещё не пришёл — он приходит в течение 10 минут после запуска агента Flow.</p>`;
  } else {
    const reading = ui.pc.rmReading?.[s.id];
    const requested = rmFilter(s), loaded = s.target_filter || {mode:"queue",prefix:"[R]",label_id:1};
    const matches = s.app !== "ae" || (requested.mode === loaded.mode && (requested.mode !== "prefix" || requested.prefix === loaded.prefix) && (requested.mode !== "label" || Number(requested.label_id) === Number(loaded.label_id)));
    const available=matches ? s.targets || [] : [];
    const selected=new Set(ui.sheet.selected || []), n=available.filter(t=>selected.has(rmTargetKey(t))).length;
    const kind=s.app === "ae" ? "Композиции" : "ROP";
    // строка целиком — переключатель; дальше — одна кнопка внизу
    const rows=available.map((t,i)=>{const on=selected.has(rmTargetKey(t));return `<button type="button" class="rm-pick ${on ? "on" : ""}" data-action="rm-select" data-i="${i}" aria-pressed="${on}"><span class="rm-check">${on ? pcIcon("check") : ""}</span><span class="rm-wait-text"><b>${esc(t.target)}</b><small>${esc(rmTargetFacts(t))}</small></span></button>`;}).join("");
    const readBtn=cls=>`<button type="button" class="${cls} rm-read ${reading ? "is-busy" : ""}" data-action="rm-read" data-id="${esc(s.id)}" ${reading ? "disabled" : ""}>${reading ? "Читаю сцену…" : rows ? "Обновить" : "Прочитать сцену"}</button>`;
    const empty=reading ? "Houdini или After Effects открывают сцену без окна — 20–60 секунд."
      : !matches ? "Фильтр изменён — прочитайте сцену, чтобы увидеть композиции."
      : `${s.cloud ? "Сцена в Облаке. " : ""}Прочитайте сцену — компьютер откроет её без окна и пришлёт, что в ней можно рендерить.`;
    body = `<p class="rm-path">${esc(s.path)}</p>${rmTargetFilter(s)}${rows
      ? `<div class="rm-list-head"><span>${kind} · ${available.length}</span><span class="rm-list-acts"><button type="button" class="text-action" data-action="rm-select-all">${n === available.length ? "Снять все" : "Выбрать все"}</button>${readBtn("text-action")}</span></div><div class="rm-picks">${rows}</div>
         <div class="rm-foot"><button type="button" class="primary-button rm-wide" data-action="rm-batch-config" ${n ? "" : "disabled"}>${n ? `Дальше · ${n}` : `Отметьте ${s.app === "ae" ? "композиции" : "ROP"}`}</button></div>`
      : `<p class="section-note">${empty}</p><div class="rm-foot">${readBtn("primary-button rm-wide")}</div>`}`;
  }
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet rm-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">${head(s ? s.name : "Поставить на рендер")}${body}</section></div>`;
}

/** Прочитать цели сцены: ПК открывает её без окна, ответ кладёт в rmQueue.scenes. Ход — в панели внизу. */
function rmRead(id) {
  const scene = (rmQueue().scenes || []).find(x => x.id === id);
  if (!scene) return;
  ui.pc.rmReading = { ...(ui.pc.rmReading || {}), [id]: true };
  ui.sheet = null;  // лист закрываем — ход виден в панели, а итог откроет его снова
  render();
  rmTask("rm_targets", { path: scene.path, ...(scene.app === "ae" ? rmFilter(scene) : {}) }, {
    title: `Читаю «${scene.name}»`,
    after: () => { delete ui.pc.rmReading[id]; if (pcOnPage()) render(); },
    done: r => {
      const fresh = r.scene;
      if (fresh) ui.pc.data.rmQueue = { ...rmQueue(), scenes: [fresh, ...(rmQueue().scenes || []).filter(x => x.id !== fresh.id)] };
      const targets = fresh?.targets || [];
      const warn = targets.reduce((n, x) => n + (x.audit?.warnings?.length || 0) + (x.problems?.length || 0), 0);
      const lines = [...targets.slice(0, 6).map(x => `${x.target}${x.frames ? ` · кадры ${x.frames}` : ""}`),
        ...(targets.length > 6 ? [`и ещё ${targets.length - 6}`] : []), ...(warn ? [`Предупреждений: ${warn} — видно при выборе`] : [])];
      const open = () => { if (ui.page !== "render") navigate("render"); ui.sheet = { kind: "rm-scenes", scene: id, selected: [], justRendered: false }; render(); };
      return targets.length
        ? { title: `«${scene.name}»: ${rmPlural(targets.length, "цель", "цели", "целей")}`, lines, action: { label: scene.app === "ae" ? "Выбрать композиции" : "Выбрать ROP", run: open } }
        : { title: r.message || "По фильтру не найдено композиций", lines: ["Поменяйте фильтр и прочитайте сцену снова."], action: { label: "Открыть сцену", run: open } };
    },
  });
}

// ------------------------------------------------------------ долгие действия: ход, «свернуть», итог

/** Команды на ПК, которые идут секунды–минуты: шаги (по статусу команды и времени) и сколько обычно занимают.
 *  Ход показывает панель внизу экрана (поверх листов): её можно свернуть в плашку, а когда готово —
 *  выезжает небольшое окно итога, которое раскрывается в подробности. Панель живёт вне render() приложения. */
const RM_FLOWS = {
  rm_targets: { title: "Читаю сцену", typical: 35, steps: ["Отправил на компьютер", "Компьютер принял", "Открываю сцену без окна", "Собираю композиции и исходники"] },
  rm_add: { title: "Ставлю на рендер", typical: 10, steps: ["Отправил на компьютер", "Компьютер принял", "Снимаю копию проекта", "Ставлю в очередь"] },
  rm_batch: { title: "Ставлю пакет на рендер", typical: 25, steps: ["Отправил на компьютер", "Компьютер принял", "Копии проекта для каждой композиции", "Ставлю в очередь"] },
  rm_pause: { title: "Ставлю на паузу", typical: 12, steps: ["Отправил на компьютер", "Останавливаю After Effects", "Убираю недописанные кадры"] },
  rm_resume: { title: "Продолжаю рендер", typical: 5, steps: ["Отправил на компьютер", "Возвращаю в очередь"] },
  rm_cancel: { title: "Отменяю рендер", typical: 10, steps: ["Отправил на компьютер", "Останавливаю рендер"] },
  rm_retry: { title: "Ставлю заново", typical: 8, steps: ["Отправил на компьютер", "Готовлю копию проекта", "Возвращаю в очередь"] },
  rm_deliver: { title: "Отправляю в облако", typical: 6, steps: ["Отправил на компьютер", "Запускаю перенос"] },
};
const RM_WAKE_STEP = "Включаю компьютер через ESP32";

function rmTasks() { ui.pc ||= {}; return (ui.pc.rmTasks ||= []); }

/** Команда на ПК с панелью хода. done(result) — побочные действия и итог: {title, lines, action:{label, run}}. */
function rmTask(cmd, args, { title, done, after } = {}) {
  const flow = RM_FLOWS[cmd] || { title: "Выполняю", typical: 6, steps: ["Отправил на компьютер", "Компьютер выполняет"] };
  const task = { id: `${cmd}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, cmd, title: title || flow.title, steps: [...flow.steps],
    typical: flow.typical, started: Date.now(), takenAt: 0, woke: false, status: "running", min: false, open: false };
  rmTasks().push(task);
  rmDock();
  let deadline=task.started+6*60000,deadlineTimer;
  const finish = (ok, result) => {
    if (task.status !== "running") return;
    clearTimeout(deadlineTimer);
    try { after?.(); } catch (_) {}
    let out = {};
    try { out = (ok && done ? done(result) : null) || {}; } catch (_) {}
    task.status = ok ? "done" : "failed";
    task.ended = Date.now();
    const retry=!ok && ['rm_batch','rm_add'].includes(cmd) && args.request_id ? {label:'Проверить постановку без дублирования',run:()=>rmTask(cmd,args,{title,done,after})}:null;
    task.result = { title: out.title || result?.message || (ok ? "Готово" : "Не получилось"), lines: out.lines || [], action: out.action || retry };
    task.min = false;
    task.open = false;  // сначала небольшое окно; подробности — по нажатию
    try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(ok ? "success" : "error"); } catch (_) {}
    rmDock();
    setTimeout(() => { if (!task.open) rmDismiss(task.id); }, 20000);
  };
  const expired=()=> {
    if (task.status!=='running') return true;
    if (Date.now()<deadline) return false;
    finish(false,{message:task.lastError ? 'Связь с компьютером потеряна — время ожидания истекло. Проверьте очередь перед повтором.' : 'Компьютер не ответил вовремя. Проверьте очередь перед повтором.'});return true;
  };
  const guard=()=>{if(!expired())deadlineTimer=setTimeout(guard,Math.max(1,deadline-Date.now()));};
  guard();
  pcCall({ op: "send", cmd, args }).then(made => {
    if (expired()) return;
    if (made?.error) throw new Error(made.error);
    if (made.woke) { task.woke = true; task.steps.splice(1, 0, RM_WAKE_STEP); task.typical += 120; }
    deadline = Date.now() + (made.woke ? 15 : 6) * 60000;
    clearTimeout(deadlineTimer);guard();
    task.commandId=made.id;
    const poll = () => {
      if (expired()) return;
      task.lastAttempt=Date.now();
      return pcCall({ op: "result", id: made.id }).then(r => {
      if (expired()) return;
      if (r?.error) throw new Error(r.error);
      task.lastResponse=Date.now();task.lastError='';
      if (r?.status === "taken" && !task.takenAt) task.takenAt = Date.now();
      if (r?.status === "done") return finish(true, r.result || {});
      if (r?.status === "failed" || r?.status === "expired" || r?.status === "cancelled") {
        return finish(false, { message: r?.result?.message || (r.status === "expired" ? "Компьютер не забрал команду за 10 минут" : "Компьютер не выполнил команду") });
      }
      setTimeout(poll, 1200);
    }).catch(error => {
      if (task.status!=='running') return;
      task.lastError=String(error?.message || error);
      if (/401|403|unauthorized|forbidden|auth_required|invalid_init_data/i.test(task.lastError)) return finish(false,{message:'Сессия истекла. Откройте Flow заново и проверьте очередь перед повтором.'});
      if (!expired()) setTimeout(poll,2500);
    });};
    poll();
  }).catch(error => { const m = String(error?.message || error); finish(false, { message: PC_ERRORS[m] || `Не получилось: ${m.slice(0, 80)}` }); });
  return task;
}

function rmDismiss(id) {
  ui.pc.rmTasks = rmTasks().filter(t => t.id !== id);
  rmDock();
}

/** Какой шаг сейчас: до «принял» — первый (или включение ПК), дальше — по времени от «обычно занимает». */
function rmTaskStep(t) {
  if (t.status !== "running") return t.steps.length;
  const base = t.woke ? 2 : 1;  // после «Отправил» (и «Включаю компьютер»)
  if (!t.takenAt) return t.woke && Date.now() - t.started > 3000 ? 1 : 0;
  const rest = t.steps.length - base;
  const per = Math.max(2, t.typical / Math.max(1, rest));
  return Math.min(t.steps.length - 1, base + Math.floor((Date.now() - t.takenAt) / 1000 / per));
}
const rmSecs = ms => { const s = Math.max(0, Math.round(ms / 1000)); return s >= 60 ? `${Math.floor(s / 60)} мин ${s % 60} с` : `${s} с`; };

function rmTaskHtml(t) {
  const key = `${t.id}:${t.status}:${t.min}:${t.open}:${t.steps.length}:${Boolean(t.lastError)}`;
  const icon = t.status === "done" ? pcIcon("check") : t.status === "failed" ? pcIcon("x") : `<i class="rm-t-spin"></i>`;
  if (t.status === "running" && t.min) {
    return `<button type="button" class="rm-t-pill" data-key="${key}" data-rm-dock="unmin" data-id="${t.id}">${icon}<b>${esc(t.title)}</b><span class="rm-t-time">${rmSecs(Date.now() - t.started)}</span></button>`;
  }
  if (t.status === "running") {
    const step = rmTaskStep(t);
    return `<section class="rm-t" data-key="${key}" role="status"><div class="rm-t-head">${icon}<b>${esc(t.title)}</b><span class="rm-t-time">${rmSecs(Date.now() - t.started)}</span><button type="button" class="rm-t-min" data-rm-dock="min" data-id="${t.id}" aria-label="Свернуть">Свернуть</button></div>
      <div class="pc-render-bar indeterminate"><b></b></div>
      <ol class="rm-t-steps">${t.steps.map((s, i) => `<li class="${i < step ? "done" : i === step ? "now" : ""}">${esc(s)}</li>`).join("")}</ol>
      <p class="rm-t-note">${t.lastError ? 'Нет связи с сервером. Повторяю проверку этой же команды.' : `Этапы ориентировочные; подтверждение придёт с ПК. Обычно до ${rmSecs(t.typical * 1000)}. Можно свернуть — итог появится здесь.`}</p></section>`;
  }
  const r = t.result || {};
  if (!t.open) {
    return `<div class="rm-t-pill ${t.status}" data-key="${key}"><button type="button" class="rm-t-pill-main" data-rm-dock="open" data-id="${t.id}">${icon}<b>${esc(r.title)}</b><span class="rm-t-more">Подробнее</span></button><button type="button" class="rm-t-x" data-rm-dock="close" data-id="${t.id}" aria-label="Закрыть">${pcIcon("x")}</button></div>`;
  }
  const lines = [`${t.title} · ${rmSecs((t.ended || Date.now()) - t.started)}`, ...(r.lines || [])];
  return `<section class="rm-t ${t.status}" data-key="${key}"><div class="rm-t-head">${icon}<b>${esc(r.title)}</b><button type="button" class="rm-t-min" data-rm-dock="close" data-id="${t.id}" aria-label="Закрыть">${pcIcon("x")}</button></div>
    <ul class="rm-t-lines">${lines.map(l => `<li>${esc(l)}</li>`).join("")}</ul>
    ${r.action ? `<button type="button" class="primary-button rm-wide" data-rm-dock="act" data-id="${t.id}">${esc(r.action.label)}</button>` : ""}</section>`;
}

/** Панель задач внизу экрана. Пока что-то идёт — обновляет время, полосу и шаги раз в полсекунды,
 *  не пересобирая карточку (иначе крутилка перезапускалась бы каждый раз). */
function rmDock() {
  let dock = document.getElementById("rm-dock");
  if (!dock) {
    dock = document.createElement("div");
    dock.id = "rm-dock";
    dock.className = "rm-dock";
    document.body.appendChild(dock);
  }
  const tasks = rmTasks();
  dock.hidden = !tasks.length;
  const existing = new Map([...dock.children].map(el => [el.dataset.key, el]));
  const wanted = tasks.map(t => {
    const html = rmTaskHtml(t);
    const key = html.match(/data-key="([^"]+)"/)[1];
    let el = existing.get(key);
    if (!el) {
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      el = tmp.firstElementChild;
    } else if (t.status === "running") {
      const time = el.querySelector(".rm-t-time");
      if (time) time.textContent = rmSecs(Date.now() - t.started);
      const step = rmTaskStep(t);
      el.querySelectorAll(".rm-t-steps li").forEach((li, i) => { li.className = i < step ? "done" : i === step ? "now" : ""; });
    }
    return el;
  });
  dock.replaceChildren(...wanted);
  clearTimeout(rmDock.timer);
  if (tasks.some(t => t.status === "running")) rmDock.timer = setTimeout(rmDock, 500);
}

document.addEventListener("click", event => {
  const b = event.target.closest?.("[data-rm-dock]");
  if (!b) return;
  event.preventDefault();
  event.stopPropagation();
  const t = rmTasks().find(x => x.id === b.dataset.id);
  if (!t) return;
  const op = b.dataset.rmDock;
  if (op === "min") t.min = true;
  else if (op === "unmin") t.min = false;
  else if (op === "open") t.open = true;
  else if (op === "close") return rmDismiss(t.id);
  else if (op === "act") { rmDismiss(t.id); t.result?.action?.run?.(); return; }
  rmDock();
}, true);

// ------------------------------------------------------------ порядок: перетаскивание за ручку

(function installRmDrag() {
  let drag = null, swallow = false;
  document.addEventListener("pointerdown", event => {
    const grip = event.target.closest?.(".rm-grip");
    if (!grip || event.button > 0) return;
    const row = grip.closest(".rm-wait"), list = row?.parentElement;
    const rows = list ? [...list.children] : [];
    if (rows.length < 2) return;
    event.preventDefault();
    drag = { row, rows, y: event.clientY, from: rows.indexOf(row), to: rows.indexOf(row), step: row.offsetHeight + (parseFloat(getComputedStyle(list).rowGap) || 0) };
    row.classList.add("rm-dragging");
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light"); } catch (_) {}
  });
  document.addEventListener("pointermove", event => {
    if (!drag) return;
    const dy = event.clientY - drag.y;
    drag.row.style.transform = `translateY(${dy}px)`;
    const to = Math.max(0, Math.min(drag.rows.length - 1, Math.round(drag.from + dy / drag.step)));
    if (to === drag.to) return;
    drag.to = to;
    try { window.Telegram?.WebApp?.HapticFeedback?.selectionChanged(); } catch (_) {}
    drag.rows.forEach((el, j) => {
      if (el === drag.row) return;
      const shift = drag.from < j && j <= to ? -drag.step : to <= j && j < drag.from ? drag.step : 0;
      el.style.transform = shift ? `translateY(${shift}px)` : "";
    });
  }, { passive: true });
  document.addEventListener("touchmove", event => { if (drag) event.preventDefault(); }, { passive: false });
  function finish() {
    if (!drag) return;
    const { row, rows, from, to } = drag;
    drag = null;
    swallow = true;
    setTimeout(() => { swallow = false; }, 300);
    rows.forEach(el => { el.style.transform = ""; });
    row.classList.remove("rm-dragging");
    if (from === to) return;
    // Сразу показываем новый порядок, ПК подтвердит снимком очереди.
    const jobs = rmJobs();
    const waiting = jobs.filter(j => RM_WAITING.includes(j.status));
    const [moved] = waiting.splice(from, 1);
    waiting.splice(to, 0, moved);
    const others = jobs.filter(j => !RM_WAITING.includes(j.status));
    ui.pc.data.rmQueue = { ...rmQueue(), jobs: [...others.filter(j => RM_ACTIVE.includes(j.status)), ...waiting, ...others.filter(j => !RM_ACTIVE.includes(j.status))] };
    pcQuick("rm_move", { id: moved.id, index: to }, `rm-move-${moved.id}`, () => setTimeout(() => pcLoad(true), 1500));
  }
  document.addEventListener("pointerup", finish);
  document.addEventListener("pointercancel", finish);
  document.addEventListener("click", event => { if (swallow) { swallow = false; event.preventDefault(); event.stopImmediatePropagation(); } }, true);
})();

// ------------------------------------------------------------ действия

function rmAction(action, control) {
  if (!action.startsWith("rm-")) return false;
  const id = Number(control.dataset.id);
  const reload = () => setTimeout(() => pcLoad(true), 1500);
  if (['rm-select','rm-select-all','rm-batch-config'].includes(action)) {
    const scene=(rmQueue().scenes || []).find(s=>s.id===ui.sheet?.scene);
    if (!scene) return true;
    const selected=new Set(ui.sheet.selected || []);
    if (action==='rm-select') {
      const t=scene.targets?.[Number(control.dataset.i)];if (!t) return true;
      const key=rmTargetKey(t);if (selected.has(key)) selected.delete(key);else selected.add(key);
      ui.sheet.selected=[...selected];
    } else if (action==='rm-select-all') ui.sheet.selected=selected.size===(scene.targets || []).length ? [] : (scene.targets || []).map(rmTargetKey);
    else {
      if (!selected.size || selected.size>50) {toast('Выберите от 1 до 50 целей');return true;}
      // одна цель — сразу её кадры в поле; несколько — у каждой свой диапазон
      const one=selected.size===1 ? (scene.targets || []).find(t=>selected.has(rmTargetKey(t))) : null;
      const s=rmSettings();ui.sheet.batch=true;ui.sheet.more=false;ui.sheet.form={frames:one?.frames || '',output_mode:s.default_output,output_dir:'',deliver:s.default_deliver,ae_backend:s.ae_backend,parallel:s.ae_parallel,ae_mfr:'inherit',ae_resolution:'inherit',ae_template:'',urgent:''};
    }
    render();return true;
  }
  if (action==='rm-benchmark-exit') {ui.sheet.benchmark=false;ui.sheet.confirm=false;render();return true;}
  if (action==='rm-more') {ui.sheet.more=!ui.sheet.more;ui.sheet.justRendered=false;render();return true;}
  if (action==='rm-filter') {
    const scene=(rmQueue().scenes || []).find(x=>x.id===ui.sheet?.scene);
    if (!scene) return true;
    ui.sheet.selected=[];
    ui.pc.rmTargetFilters={...(ui.pc.rmTargetFilters || {}),[scene.id]:{...rmFilter(scene),mode:control.dataset.mode}};
    ui.sheet.justRendered=false;render();return true;
  }
  if (action==='rm-benchmark') {
    const scene=(rmQueue().scenes || []).find(s=>s.id===ui.sheet?.scene),f=ui.sheet?.form;
    if (!scene || !f || scene.app!=='ae') return true;
    const m=String(f.frames).match(/^(-?\d+)-(-?\d+)$/);
    if (!m || Number(m[2])<=Number(m[1])) {toast('Для теста нужен непрерывный диапазон минимум 2 кадра');return true;}
    const count=Math.min(24,Number(m[2])-Number(m[1])+1),start=Number(m[1])+Math.floor((Number(m[2])-Number(m[1])+1-count)/2);
    ui.sheet.benchmark=true;ui.sheet.confirm=false;f.sample_frames=`${start}-${start+count-1}`;f.ae_backend='background';f.deliver='none';f.output_mode='root';render();return true;
  }
  if (action==='rm-preset') {
    const scene=(rmQueue().scenes || []).find(s=>s.id===ui.sheet?.scene),f=ui.sheet?.form;
    const preset=scene && rmPresets(scene.app).find(p=>p.id===control.dataset.id);
    if (f && preset) {for (const key of RM_PRESET_KEYS) if (key in preset.form) f[key]=key==='mfr_in_parts' ? (preset.form[key]?'1':'') : key==='parallel'?String(preset.form[key]):preset.form[key];f.preset_id=(rmQueue().presets || []).some(p=>p.id===preset.id) ? preset.id : '';f.preset_name=preset.name;delete ui.sheet.submissionId;ui.sheet.confirm=false;render();}return true;
  }
  if (action==='rm-preset-save' || action==='rm-preset-delete') {
    const scene=(rmQueue().scenes || []).find(s=>s.id===ui.sheet?.scene),f=ui.sheet?.form;
    if (!scene || !f) return true;
    const name=String(f.preset_name || '').trim();
    if (action==='rm-preset-save' && !name) {toast('Введите название пресета');return true;}
    const args=action==='rm-preset-delete' ? {action:'delete',id:control.dataset.id} : {action:'save',...(f.preset_id ? {id:f.preset_id} : {}),name,app:scene.app,form:Object.fromEntries(RM_PRESET_KEYS.map(k=>[k,f[k] || '']))};
    if (args.form) {args.form.parallel=f.parallel==='auto'?'auto':Number(f.parallel)||1;args.form.mfr_in_parts=f.parallel!=='auto' && f.mfr_in_parts==='1';}
    pcQuick('rm_presets',args,'rm-preset-save',r=>{ui.pc.data.rmQueue={...rmQueue(),presets:r?.presets || []};f.preset_id='';toast(action==='rm-preset-delete' ? 'Пресет удалён' : 'Пресет сохранён');render();});return true;
  }
  if (action === "rm-pause" || action === "rm-resume") {
    const cmd = action === "rm-pause" ? "rm_pause" : "rm_resume";
    rmTask(cmd, { id }, { done: r => { reload(); return { title: r?.message || (action === "rm-pause" ? "На паузе" : "Продолжаю") }; } });
    return true;
  }
  if (action === "rm-cancel") {
    if (!window.confirm(`Отменить «${control.dataset.name}»? Уже записанные кадры останутся.`)) return true;
    rmTask("rm_cancel", { id }, { done: r => { reload(); return { title: r?.message || "Отменил" }; } });
    return true;
  }
  if (action === "rm-retry" || action === "rm-missing") {
    rmTask("rm_retry", { id, missing_only: action === "rm-missing" }, { title: action === "rm-missing" ? "Дорендериваю недостающие" : undefined,
      done: r => { reload(); return { title: r?.message || "Поставил заново" }; } });
    return true;
  }
  if (action === "rm-deliver") { rmTask("rm_deliver", { id }, { done: r => { reload(); return { title: r?.message || "Отправляю в облако" }; } }); return true; }
  if (action === "rm-hold") {
    const on = control.dataset.on === "1";
    pcQuick("rm_hold", { on }, "rm-hold", r => { toast(r?.message || (on ? "Очередь на паузе" : "Очередь продолжена")); ui.pc.data.rmQueue = { ...rmQueue(), held: on }; reload(); });
    return true;
  }
  if (action === "rm-clear") {
    pcQuick("rm_clear", {}, "rm-clear", r => { toast(r?.message || "Завершённые задачи убраны"); reload(); });
    return true;
  }
  if (action === "rm-scenes") { ui.sheet = { kind: "rm-scenes", justRendered: false }; render(); return true; }
  if (action === "rm-scene") {
    // «Назад» из параметров — к той же сцене с той же отметкой композиций
    const keep = ui.sheet?.scene === control.dataset.id ? ui.sheet.selected : [];
    ui.sheet = { kind: "rm-scenes", scene: control.dataset.id, selected: keep || [], justRendered: false }; render(); return true;
  }
  if (action === "rm-read") { rmRead(control.dataset.id); return true; }
  if (action === "rm-go") {
    // цель выбрана — шаг с параметрами, по умолчанию из настроек Render Manager
    const scene = (rmQueue().scenes || []).find(x => x.id === control.dataset.id);
    const i = Number(control.dataset.i);
    const t = scene?.targets?.[i];
    if (!t) return true;
    const s = rmSettings();
    ui.sheet = { kind: "rm-scenes", scene: scene.id, target: i, justRendered: false,
      targetKey: rmTargetKey(t), form: { frames: t.frames || "", output_mode: s.default_output, output_dir: "", deliver: s.default_deliver, ae_backend: s.ae_backend, parallel: s.ae_parallel, ae_mfr: "inherit", ae_resolution:"inherit", ae_template:"", urgent: "" } };
    render();
    return true;
  }
  if (action === "rm-opt") {
    if (ui.sheet?.form) { ui.sheet.form[control.dataset.key] = control.dataset.value; delete ui.sheet.submissionId; ui.sheet.justRendered = false; render(); }
    return true;
  }
  if (action === "rm-confirm-back") { ui.sheet.confirm = false; render(); return true; }
  if (action === "rm-submit") {if (ui.pc.quick?.['rm-submit'] !== 'is-busy') rmSubmitSheet();return true;}
  if (action === "rm-settings") {
    const s = rmSettings();
    ui.sheet = { kind: "rm-settings", justRendered: false, form: { render_root: s.render_root, deliver_root: s.deliver_root, default_output: s.default_output, default_deliver: s.default_deliver, ae_backend: s.ae_backend, ae_parallel: s.ae_parallel } };
    render();
    return true;
  }
  if (action === "rm-settings-save") {
    const f = ui.sheet?.form;
    if (!f) return true;
    if (![f.render_root, f.deliver_root].every(p => /^[a-z]:\\/i.test(String(p).trim()))) { toast("Папки — полный путь, например D:\\Render"); return true; }
    const args = { ...f, render_root: f.render_root.trim(), deliver_root: f.deliver_root.trim(), ae_parallel: Number(f.ae_parallel) || 2 };
    pcQuick("rm_settings", args, "rm-settings-save", r => {
      if (r?.settings) ui.pc.data.rmQueue = { ...rmQueue(), settings: r.settings };
      toast("Настройки сохранены");
      ui.sheet = null;
      render();
    });
    return true;
  }
  return false;
}
