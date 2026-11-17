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
const rmPendingArchive = new Map();
function rmVisibleJobs(queue) {
  const now=Date.now();
  for(const [id,until] of rmPendingArchive)if(until<now)rmPendingArchive.delete(id);
  return (queue.jobs || []).filter(j=>!rmPendingArchive.has(Number(j.id)));
}
const rmJobs = () => rmVisibleJobs(rmQueue());
let rmArchiveTimer=null,rmArchiveSending=false;
const rmArchiveBatch=new Set();
function rmArchive(ids, immediate=false) {
  ids=ids.filter(id=>rmJobs().some(j=>Number(j.id)===id && ['done','failed','cancelled'].includes(j.status)));
  if(!ids.length)return;
  ids.forEach(id=>rmPendingArchive.set(id,Date.now()+120000));
  ids.forEach(id=>rmArchiveBatch.add(id));
  render();
  clearTimeout(rmArchiveTimer);
  if(immediate)rmFlushArchive();else rmArchiveTimer=setTimeout(rmFlushArchive,900);
}
function rmFlushArchive() {
  if(rmArchiveSending || !rmArchiveBatch.size)return;
  const ids=[...rmArchiveBatch];rmArchiveBatch.clear();rmArchiveSending=true;
  const finish=()=>{rmArchiveSending=false;if(rmArchiveBatch.size)rmFlushArchive();};
  pcQuick('rm_clear',{ids},'rm-clear',()=>{pcLoad(true);finish();},()=>{ids.forEach(id=>rmPendingArchive.delete(id));render();finish();});
}
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
function rmCustomerButton(j){return Number.isSafeInteger(Number(j.id))&&Number(j.id)>0&&Number(j.started_at)>0?`<button type="button" class="small-button" data-action="rm-customer-share" data-id="${Number(j.id)}">${icon('share','icon-sm')}Для заказчика</button>`:'';}
/** Текст для системного «Поделиться» — без путей, ID попытки и служебных данных. */
function rmShareCopy(j){const percent=rmProgress(j),facts=[RM_APP[j.app]||j.app];if(j.status==='rendering')facts.push(percent===null?'рендер идёт':`${Math.round(percent)}%`);else if(j.status==='paused')facts.push('на паузе');else if(j.status==='delivering')facts.push('доставка');else if(j.status==='done')facts.push('готово');else if(j.status==='failed')facts.push('ошибка');if(j.eta&&j.status==='rendering')facts.push(`ещё ~${rmMinutes(j.eta)}`);return `Рендер «${String(j.name||'Рендер').trim().slice(0,120)}» — ${facts.filter(Boolean).join(' · ')}`;}
async function rmCopyText(text){try{await navigator.clipboard.writeText(text);return true;}catch{}try{const area=document.createElement('textarea');area.value=text;area.readOnly=true;area.style.position='fixed';area.style.left='-9999px';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();return ok;}catch{return false;}}
function rmActiveRow(j, fresh = true) {
  const pct = fresh ? rmProgress(j) : null;
  const facts = !fresh ? "Нет свежих данных с ПК" : j.status === "delivering" ? `переношу в облачную папку${j.delivery?.total ? ` · ${j.delivery.files || 0} из ${j.delivery.total} файлов` : ""}`
    // «готово», а не «кадр»: части рендерят с разных мест, номер кадра в папке обгоняет счёт готовых
    : [j.total ? `готово ${j.done || 0} из ${j.total}` : "", j.eta ? `осталось ~${rmMinutes(j.eta)}` : "", j.stage && j.stage !== "рендер" ? j.stage : ""].filter(Boolean).join(" · ");
  const bar = pct === null
    ? `<div class="pc-render-bar ${fresh ? "indeterminate" : "is-stale"}"><b></b></div>` : `<div class="pc-render-bar"><b style="--v:${pct}%"></b></div>`;
  return `<div class="pc-render-live rm-live ${fresh ? "" : "is-stale"}" data-render-fresh="${fresh}"><div class="pc-render-title"><span class="pc-render-dot"></span><strong>${esc(j.name)}</strong>${pct === null ? "" : `<b class="pc-render-pct">${Math.round(pct)}%</b>`}</div>${bar}<p class="pc-render-facts">${esc(RM_APP[j.app] || j.app)}${facts ? ` · ${esc(facts)}` : ""}</p><p class="section-note rm-memory">${esc(rmMemoryText(j.resources,fresh))}</p>${j.resource_decision ? `<details class="rm-resource"><summary>${j.resource_decision.mode==='auto'?'Авто':'Вручную'} · частей: ${j.resource_decision.parallel}</summary><p class="section-note">${esc(rmResourceText(j.resource_decision))}</p></details>` : ''}${j.warning ? `<p class="rm-warn">${esc(j.warning)}</p>` : ""}<div class="rm-acts">${rmCustomerButton(j)}${j.status === "rendering" ? `<button type="button" class="small-button ${rmBusyCls(`rm-pause-${j.id}`)}" data-action="rm-pause" data-id="${j.id}">Пауза</button>` : ""}<button type="button" class="small-button ${rmBusyCls(`rm-cancel-${j.id}`)}" data-action="rm-cancel" data-id="${j.id}" data-name="${esc(j.name)}">Отменить</button></div></div>`;
}
function rmResourceText(r) { return [`${r.mode==='auto'?'Авто':'Вручную'} · частей: ${r.parallel}`,r.reason,r.warning].filter(Boolean).join(' · '); }
function rmMemoryText(r, fresh=true) {
  const gb=n=>typeof n==='number' && Number.isFinite(n) && n>=0 ? `${(n/1073741824).toFixed(1)} ГБ` : 'нет данных';
  const current=fresh && r?.observed_at && Date.now()-r.observed_at*1000<20000;
  return `RAM ${gb(current?r.ram_bytes:null)} · VRAM ${gb(current?r.vram_bytes:null)}`;
}
function rmCalibrationCard() {
  const all=rmJobs().filter(j=>j.benchmark);
  const latest=[...all].sort((a,b)=>Number(b.id)-Number(a.id))[0];
  const tests=latest ? all.filter(j=>latest.benchmark.group ? j.benchmark.group===latest.benchmark.group : j.id===latest.id) : [];
  const running=tests.some(j=>RM_ACTIVE.includes(j.status)||RM_WAITING.includes(j.status));
  const completed=tests.filter(j=>j.status==='done'&&j.benchmark_result);
  const sceneOnly=latest && latest.benchmark.scope!=='pc';
  return `<section class="pc-card rm-card"><div class="pc-card-head"><h3>${sceneOnly ? "Тест скорости сцены" : "Тест скорости ПК"}</h3></div>${sceneOnly ? `<p class="section-note">Это замер отдельной композиции. Для выбора частей в других композициях нужен общий тест ПК — кнопка ниже.</p>` : ""}<p class="section-note">${running?`Тест идёт: завершено ${completed.length} из ${tests.length} проб.`:tests.length?`Завершено успешно: ${completed.length} из ${tests.length} проб.`:'Один запуск: выберите характерную композицию и короткий участок. Выполним 8 проб для 1–4 частей и сохраним общий профиль ПК.'}</p>${latest?rmBenchmarkSummary(tests):''}<p class="section-note">Авто выбирает режим при запуске с учётом свободной памяти. Другие сцены могут требовать больше RAM/VRAM. Оценка полного рендера приблизительная.</p><button type="button" class="ghost-button rm-wide" data-action="rm-calibrate">${tests.length && !sceneOnly?'Новый общий тест':'Общий тест скорости'}</button></section>`;
}
function rmBenchmarkSummary(tests) {
  const first=tests[0],groups=new Map(),positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
  const median=a=>{const s=[...a].sort((x,y)=>x-y),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
  const gb=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0?`${(n/1073741824).toFixed(1)} ГБ`:'нет замера';
  for(const j of [...tests].sort((a,b)=>(a.benchmark.repeat||1)-(b.benchmark.repeat||1))) {
    const key=j.benchmark.mode==='parts'?`Частей: ${j.parallel}`:`MFR ${j.benchmark_result?.mfr==='on'?'вкл.':j.benchmark_result?.mfr==='off'?'выкл.':'не определён'}`;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(j);
  }
  let incomplete=tests.some(j=>j.status!=='done'||j.warning||!positive(j.benchmark_result?.seconds_per_frame));
  const rows=[...groups].map(([label,jobs])=>{
    const valid=jobs.filter(j=>j.status==='done'&&!j.warning&&positive(j.benchmark_result?.seconds_per_frame));
    if(first.benchmark.mode==='parts' && new Set(valid.map(j=>j.benchmark.repeat)).size<2)incomplete=true;
    const speeds=valid.map(j=>j.benchmark_result.seconds_per_frame),score=speeds.length?median(speeds):null;
    const peak=key=>{const values=valid.map(j=>j.benchmark_result.resources?.[key]).filter(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0);return values.length?gb(Math.max(...values)):'нет замера';};
    const unstable=speeds.length>1&&Math.max(...speeds)>Math.min(...speeds)*1.25;
    return {label,score,unstable,html:`<div class="rm-recent"><span class="rm-wait-text"><b>${esc(label)} · ${valid.length}/${jobs.length} проб</b><small>${jobs.map(j=>`Проба ${esc(j.benchmark.repeat||1)}: `+esc(j.status==='done'&&positive(j.benchmark_result?.wall_seconds)?`${j.benchmark_result.wall_seconds.toFixed(1)} с${j.warning?` · ${j.warning}`:''}`:j.error||j.warning||({queued:'ожидает',rendering:'идёт',cancelled:'отменена',paused:'пауза'}[j.status])||'нет достоверного замера')).join(' · ')}</small><small>${score===null?'Скорость не определена':`${score.toFixed(2)} с/кадр · медиана`}${unstable?' · большой разброс, повторите тест':''}</small><small>Пик RAM: ${peak('peak_ram_bytes')} · VRAM: ${peak('peak_vram_bytes')}</small></span></div>`};
  });
  const winner=rows.filter(r=>r.score!==null).sort((a,b)=>a.score-b.score)[0];
  return `<details class="rm-resource" open><summary>Результаты теста</summary><p class="section-note" style="overflow-wrap:anywhere">${first.benchmark.scope==='pc'?'Общий профиль ПК':'Тест сцены'} · ${esc(first.target||first.name)}<br>${esc(first.scene||'')}<br>Участок: ${esc(first.frames)} · полный диапазон: ${esc(first.benchmark.full_frames)}<br>Фоновый AE · PNG · разрешение: ${esc(({inherit:'как в проекте',full:'полное',half:'½',quarter:'¼'})[first.ae_resolution]||'как в проекте')}. Время проб включает запуск; с/кадр — сохранённый замер скорости после первого прогресса, если он доступен.</p>${rows.map(r=>r.html).join('')}${winner?`<p class="section-note"><b>Лучшее время в тесте: ${esc(winner.label)}</b>. ${incomplete||rows.some(r=>r.unstable)?'Результат предварительный: не все пробы достоверны или повторы сильно различаются.':''} Это сравнение измеренных проб, а не гарантия времени всего проекта.</p>`:''}</details>`;
}

/** Ждущая задача: ручка для перетаскивания, название, кадры, отмена. */
function rmWaitingRow(j, i) {
  const paused = j.status === "paused";
  // на паузе: сколько уже готово — «Продолжить» дорендерит остальное
  const facts = [RM_APP[j.app] || j.app, paused && j.total ? `готово ${j.done || 0} из ${j.total}` : j.frames ? `кадры ${j.frames}` : "", paused ? "на паузе" : ""];
  return `<div class="rm-wait ${paused ? "rm-paused" : ""}" data-id="${j.id}" style="--i:${i}"><span class="rm-grip" aria-label="Перетащить">${"<i></i>".repeat(6)}</span><span class="rm-wait-text"><b>${esc(j.name)}</b><small>${esc(facts.filter(Boolean).join(" · "))}</small></span>${paused ? `<button type="button" class="text-action ${rmBusyCls(`rm-resume-${j.id}`)}" data-action="rm-resume" data-id="${j.id}">Продолжить</button>` : ""}<button type="button" class="icon-button rm-x ${rmBusyCls(`rm-cancel-${j.id}`)}" data-action="rm-cancel" data-id="${j.id}" data-name="${esc(j.name)}" aria-label="Убрать из очереди">${pcIcon("x")}</button></div>`;
}

/** Законченная: итог одной строкой и действие, если оно есть. */
function rmRecentDetails(j) {
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

function rmElapsed(j) {
  const seconds=Number(j.finished_at)-Number(j.started_at);
  if(!j.started_at || !j.finished_at || !Number.isFinite(seconds) || seconds<0)return 'Время не записано';
  return seconds<60?`${Math.round(seconds)} с`:rmMinutes(seconds);
}
function rmRecentStatus(j) {
  if (j.status === "done") return j.delivery?.status === "failed" ? "Готово · доставка не удалась" : "Готово";
  if (j.status === "failed") return "Ошибка";
  if (j.status === "cancelled") return "Отменено";
  return j.status || "Завершено";
}
function rmRecentLine(j) {
  const total=Number(j.total),done=Number(j.done);
  const frames=["failed","cancelled"].includes(j.status)&&Number.isFinite(total)&&total>0&&Number.isFinite(done)?`${Math.max(0,Math.min(total,done))} из ${total} кадров`:"";
  return [rmRecentStatus(j),frames,rmElapsed(j)].filter(Boolean).join(" · ");
}
function rmRecentRow(j) {
  return `<button type="button" class="rm-history-open" data-action="rm-detail" data-id="${j.id}"><b>${esc(j.name)}</b><small>${esc(rmRecentLine(j))}</small></button>${rmCustomerButton(j)}`;
}
function rmFrameChart(stats) {
  const points=(stats?.points||[]).filter(p=>Number.isFinite(p.frame)&&Number.isFinite(p.seconds)&&p.seconds>=0);
  if(!points.length)return '<p class="section-note">Замеры кадров не сохранились. График появится у рендеров с покадровым журналом AE.</p>';
  const max=Math.max(1,...points.map(p=>p.seconds)),first=points[0].frame,last=points.at(-1).frame;
  const xy=points.map(p=>`${12+296*(p.frame-first)/Math.max(1,last-first)},${132-112*p.seconds/max}`).join(' ');
  return `<div class="rm-frame-chart"><p class="section-note">Время кадра · секунды · максимум ${max.toFixed(1)}</p><svg viewBox="0 0 320 150" role="img" aria-label="Время рендера кадров в секундах"><path d="M12 16V132H308" class="rm-chart-axis"/><polyline points="${xy}" class="rm-chart-line"/></svg><div class="rm-chart-labels"><span>Кадр ${first}</span><span>${last}</span></div><p class="section-note">${Number(stats.count)||points.length} замеров. Точность журнала AE — до секунды; 0 означает менее секунды. Для длинного рендера график показывает пики групп кадров.</p></div><h3>Самые долгие кадры</h3><div class="rm-slow-frames">${(stats.slowest||[]).slice(0,5).map(p=>`<div><span>Кадр ${Number(p.frame)}</span><b>${Number(p.seconds).toFixed(1)} с</b></div>`).join('')}</div>`;
}
function renderRmDetailSheet() {
  const j=rmJobs().find(j=>Number(j.id)===Number(ui.sheet.id))||ui.sheet.job;
  if(!j)return '';
  // Карточка задачи (18.11): статус одной строкой, факты, действия; пустые сноски не показываем.
  const took=/не записано/.test(rmElapsed(j))?'':rmElapsed(j);
  const delivered=j.delivery?.status==='done',deliveryFailed=j.delivery?.status==='failed';
  const state=j.status==='done'?(deliveryFailed?'Готово · в облако не ушло':delivered?'Готово · в облаке':'Готово'):j.status==='failed'?'Ошибка':j.status==='cancelled'?'Отменено':j.status;
  const tone=j.status==='done'&&!deliveryFailed?'ok':'warn';
  const where=String((delivered&&j.delivery?.path)||j.output||'');
  const span=rmSpan(j.frames);
  const facts=[
    span?['Кадры',`${span[0]}–${span[1]}${j.fps?` · ${((span[1]-span[0]+1)/Number(j.fps)).toFixed(1).replace('.',',')} с`:''}`]:null,
    ['Программа',RM_APP[j.app]||j.app],
    took?['Рендер шёл',took]:null,
  ].filter(Boolean).map(([k,v])=>`<div class="rmd-fact"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('');
  // Нажатие по месту — открыть эту папку на ПК; путь виден целиком, переносится по папкам.
  const place=where?`<button type="button" class="rmd-where is-open" data-action="${j.status==='done'?'rm-reveal':'rm-dest-toggle'}" data-id="${j.id}" aria-label="Открыть папку на ПК: ${esc(where)}"><span class="rsx-dest-ico" aria-hidden="true">${icon('folder','icon-sm')}</span><span class="rmd-where-text"><small>${delivered?'В Облаке':'На диске'} · открыть на ПК</small><b>${esc(where).replace(/\\/g,'\\<wbr>')}</b></span></button>`:'';
  // Ошибки и предупреждения — под «!»: коротко, без длинных путей; у упавшей задачи открыто сразу.
  const problems=rmShortProblems([j.error,j.warning,deliveryFailed?j.delivery?.error:''].filter(Boolean).join('; '));
  const problemOpen=ui.sheet?.problemOpen??(j.status==='failed');
  const problemBtn=problems.length?`<button type="button" class="rmd-alert${problemOpen?' is-open':''}" data-action="rm-problem-toggle" aria-expanded="${problemOpen}" aria-label="${problemOpen?'Скрыть замечания':`Замечания: ${problems.length}`}">!</button>`:'';
  const problem=problems.length&&problemOpen?`<ul class="rmd-problem">${problems.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
  const actions=[
    rmPatchable(j)?`<button type="button" class="rmd-action is-main" data-action="rm-patch-open" data-id="${j.id}">Перерендерить участок</button>`:'',
    rmRecentAction(j).replace('class="dsv-action','class="rmd-action'),
    j.status==='done'?`<button type="button" class="rmd-action" data-action="rm-reveal" data-id="${j.id}">${icon('folder','icon-sm')}Открыть папку на ПК</button>`:'',
    Number(j.started_at)>0?`<button type="button" class="rmd-icon" data-action="rm-customer-share" data-id="${Number(j.id)}" aria-label="Ссылка для заказчика">${icon('share','icon-sm')}</button>`:'',
  ].filter(Boolean);
  const chart=(j.frame_stats?.points||[]).length?rmFrameChart(j.frame_stats):'';
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet rm-sheet rm-detail rmd" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${esc(rmBaseName(j.name))}</h2><button type="button" class="icon-button" data-action="close-sheet" aria-label="Закрыть">${icon('close')}</button></div>`
    +`<div class="rmd-state-row"><p class="rmd-state ${tone}"><i aria-hidden="true"></i>${esc(state)}</p>${problemBtn}</div>`
    +problem
    +`<div class="rmd-facts">${facts}${place}</div>`
    +rmPatchSummary(j)
    +(actions.length?`<div class="rmd-actions">${actions.join('')}</div>`:'')
    +rmVersionsBlock(j)+chart
    +`<button type="button" class="text-action rmd-archive" data-action="rm-archive" data-id="${j.id}">Убрать из истории</button></section></div>`;
}

function rmBlock(d) {
  const q = d.rmQueue || {};
  const jobs = rmVisibleJobs(q);
  const active = jobs.filter(j => RM_ACTIVE.includes(j.status));
  const waiting = jobs.filter(j => RM_WAITING.includes(j.status));
  const recent = jobs.filter(j => ['done','failed','cancelled'].includes(j.status));
  // «Остановить очередь», а не вторая «Пауза»: пауза у задачи — своя, в её строке.
  const hold = `<button type="button" class="text-action rm-hold ${rmBusyCls("rm-hold")}" data-action="rm-hold" data-on="${q.held ? "0" : "1"}">${q.held ? "Продолжить очередь" : "Остановить очередь"}</button>`;
  const empty = !active.length && !waiting.length;
  const body = [
    q.held ? `<p class="section-note rm-held">Очередь на паузе: текущий рендер доработает, следующие ждут.</p>` : "",
    !active.length && d.render?.rendering ? `<div class="rm-manual-row"><p class="pc-find-label">Вручную в After Effects</p>${pcRenderNow(d.render)}</div>` : '',
    active.map(j => rmActiveRow(j, rmFresh(d))).join(""),
    waiting.length ? `<p class="pc-find-label">Дальше${waiting.length > 1 ? " — порядок можно менять, перетаскивая за ручку" : ""}</p><div class="rm-waiting">${waiting.map(rmWaitingRow).join("")}</div>` : "",
    empty && !d.render?.rendering ? `<p class="section-note">Сейчас в очереди ничего нет.</p>` : "",
    recent.length ? `<details class="rm-history" ${ui.pc.rmHistoryOpen?'open':''}><summary data-action="rm-history-toggle">История · ${recent.length}</summary><button type="button" class="text-action ${rmBusyCls("rm-clear")}" data-action="rm-clear">Очистить историю</button><div class="rm-recents">${recent.map(j=>`<div class="rm-history-swipe" data-history-id="${j.id}"><span class="rm-history-remove" aria-hidden="true">Убрать</span><div class="rm-history-row">${rmRecentRow(j)}</div></div>`).join('')}</div></details>` : "",
  ].join("");
  return `<section class="pc-card rm-card ${active.length && rmFresh(d) ? "pc-rendering" : ""}"><div class="pc-card-head"><h3>${pcIcon("film")}Очередь рендеров</h3>${empty && !q.held ? "" : hold}</div>${body}<button type="button" class="primary-button rm-add" data-action="rm-scenes">Поставить сцену</button></section>`;
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
  // Наверху — то, что нужно сейчас: очередь и «после рендера». Настройки, тест скорости
  // и диагностика нужны редко — свёрнуты одним блоком внизу.
  const tools = `<details class="pc-card rm-tools" ${ui.pc.rmToolsOpen ? "open" : ""}><summary data-action="rm-tools-toggle">${pcIcon("list")}Настройки и диагностика</summary>${rmSettingsCard(d)}${rmCalibrationCard()}${rmHealthCard(d)}</details>`;
  return `${top}<div class="content-grid"><div class="content-main pc-page">${off}${rmBlock(d)}${d.agent ? pcRenderBlock(d,true) : ""}${tools}</div></div>`;
}

function rmHealthCard(d) {
  const q=d.rmQueue || {},service=q.service || {},age=stamp=>Number.isFinite(Date.parse(stamp)) ? `${rmSecs(Math.max(0,Date.now()-Date.parse(stamp)))} назад`:'ещё нет данных';
  const row=(label,value)=>`<div class="rm-set-row"><span>${label}</span><b>${esc(value)}</b></div>`;
  const active=(q.jobs || []).find(j=>RM_ACTIVE.includes(j.status));
  return `<details class="pc-card rm-card"><summary>Связь и диагностика</summary>${row('Агент ПК',d.agent?'на связи':'нет связи')}${row('Последняя связь агента',age(d.agentSeen))}${row('Сервис Render Manager',service.available===false?'не отвечает':rmFresh(d)&&q.at?'на связи':'нет свежего подтверждения')}${row('Очередь обновлена',age(q.at || q.observed_at))}${row('Расширение AE',service.ae_agent?.alive?'на связи':service.ae_agent?'нет связи / AE закрыт':'нет данных')}${service.build?row('Сборка',typeof service.build==='string'?service.build:service.build.code || service.build.commit || service.build.version || 'неизвестна'):''}${active?row('Этап',active.stage || active.status):''}${active?.warning?`<p class="rm-warn">${esc(active.warning)}</p>`:''}<button type="button" class="text-action" data-action="pc-refresh">Обновить состояние</button></details>`;
}

// ------------------------------------------------------------ параметры задачи и настройки

const RM_OUTPUT = [["root", "Общая папка"], ["scene", "Из сцены"], ["custom", "Своя папка"]];
const RM_DELIVER = [["move", "Перенести"], ["copy", "Копировать"], ["none", "Оставить"]];
const RM_BACKEND = [["background", "В фоне"], ["cep", "В окне AE"], ["auto", "Авто"]];
// Фон частями (rm/runners/ae_split.py): несколько AE на своих кусках кадров; видео — кадрами, склейка ffmpeg
const RM_PARTS = [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]];
const RM_MFR_PARTS_WARN = "Тест: MFR в каждой части. 21.10 три части с MFR заняли 15,5 из 16 ГБ видеопамяти и встали — если рендер замрёт, Render Manager дорендерит кусок одной частью.";
const RM_PARTS_NOTE = "Каждая часть — свой After Effects и своя память; при 48 ГБ разумно 2–3. Видео рендерится кадрами и склеивается ffmpeg — поэтому есть «Пауза» и «Продолжить». MFR у частей по умолчанию выключен: вместе они переполняют видеопамять.";
const rmLabel = (list, v) => (list.find(([k]) => k === v) || [, v])[1];
function rmSettings() {
  const s = rmQueue().settings || {};
  return { render_root: s.render_root || "D:\\Render", deliver_root: s.deliver_root || "D:\\RenderCloud", default_output: s.default_output || "root",
    default_deliver: s.default_deliver || "move", ae_backend: s.ae_backend || "background", ae_parallel: "auto",
    background_off: Boolean(s.background_off), open_folder: s.open_folder !== false, known: Boolean(rmQueue().settings) };
}

/** Ряд кнопок-вариантов: выбранный подсвечен, нажатие меняет поле формы листа. */
function rmSegments(key, list, value) {
  return `<div class="segmented rm-seg" style="--n:${list.length}">${list.map(([v, label]) => `<button type="button" class="segment ${value === v ? "active" : ""}" data-action="rm-opt" data-key="${key}" data-value="${v}" aria-pressed="${value === v}">${label}</button>`).join("")}</div>`;
}
const rmField = (label, html, note = "") => {
  const id = `rm-label-${encodeURIComponent(label)}`;
  const controls = html.replace(/<(input|select|textarea)\b([^>]*)>/g, (tag, name, attrs) => /aria-label(?:ledby)?=/.test(attrs) ? tag : `<${name} aria-labelledby="${id}"${attrs}>`);
  return `<div class="rm-field" role="group" aria-labelledby="${id}"><p id="${id}" class="pc-after-label">${label}</p>${controls}${note ? `<p class="section-note">${note}</p>` : ""}</div>`;
};
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
function rmOutputName(t,f) {
  if(!String(f.output_name || '').trim())return t.output || '';
  const source=t.output || 'render.mp4',folder=source.replace(/[^\\/]*$/,''),extension=source.match(/\.[^.\\/]+$/)?.[0] || '.mp4';
  return folder+String(f.output_name).trim()+(/\[#+\]/.test(source)?'.[####]':'')+extension;
}
function rmFormatSelect(chosen,f) {
  const templates=[...new Set(chosen.flatMap(x=>x.audit?.templates || []))];
  const standard=[['','Как в проекте'],['@flow:mp4','MP4 · H.264'],['@flow:mov-alpha','MOV · ProRes 4444 + альфа'],['@flow:png','PNG · секвенция + альфа'],['@flow:exr','EXR · секвенция + альфа'],['@flow:hap','MOV · HAP'],['@flow:hap-alpha','MOV · HAP + альфа']];
  const selected=standard.find(([v])=>v===(f.ae_template || ''))?.[1] || f.ae_template;
  const row=(value,label)=>`<button type="button" class="rm-format-option ${value===(f.ae_template || '')?'selected':''}" data-action="rm-format-pick" data-value="${esc(value)}" role="radio" aria-checked="${value===(f.ae_template || '')}"><span>${esc(label)}</span><i aria-hidden="true"></i></button>`;
  if(ui.sheet?.formatOpen && typeof queueMicrotask==='function')queueMicrotask(()=>{const list=document.getElementById('rm-format-list');if(list)list.scrollTop=ui.sheet?.formatScroll || 0;});
  return `<div class="rm-format-picker"><button type="button" class="rm-format-current" data-action="rm-format-toggle" aria-expanded="${Boolean(ui.sheet?.formatOpen)}" aria-controls="rm-format-list"><span>${esc(selected)}</span><span aria-hidden="true">${ui.sheet?.formatOpen?'⌃':'⌄'}</span></button>${ui.sheet?.formatOpen?`<div class="rm-format-list" id="rm-format-list" role="radiogroup" aria-label="Формат вывода">${standard.map(([v,n])=>row(v,n)).join('')}${templates.length?`<button type="button" class="rm-format-templates" data-action="rm-format-templates" aria-expanded="${Boolean(ui.sheet.formatTemplatesOpen)}">Шаблоны AE <span>${templates.length}</span></button>${ui.sheet.formatTemplatesOpen?templates.map(n=>row(n,n)).join(''):''}`:''}${templates.some(n=>/DXV/i.test(n))?'':'<p class="section-note">DXV появится после установки шаблона DXV в AE.</p>'}</div>`:''}</div>`;
}
function rmJobArgs(scene,t,f) {
  const media=rmEffectiveMedia(t,f,scene.app);
  return {path:scene.path,target:t.target,frames:String(f.frames).replace(/\s+/g,''),output:rmOutputName(t,f),scene_stamp:t.scene_stamp,
    ...(Number(t.audit?.fps)>0 ? {fps:Number(t.audit.fps)} : {}),...(media.width && media.height ? {width:media.width,height:media.height} : {}),format:f.ae_template ? '' : t.audit?.format || '',audit:t.audit || {},
    ...(t.comp_id ? {comp_id:t.comp_id} : {}),...(t.rq_index ? {rq_index:t.rq_index} : {}),urgent:f.urgent==='1',
    output_mode:f.output_mode,deliver:f.deliver,...(f.output_mode==='custom' ? {output_dir:String(f.output_dir || '').trim()} : {}),
    ...(scene.app==='ae' && f.ae_backend==='background' ? {parallel:f.parallel==='auto'?'auto':Number(f.parallel) || 1} : {}),...(scene.app==='ae' ? {ae_backend:f.ae_backend,ae_mfr:f.ae_backend==='background'?'off':f.ae_mfr || 'inherit',ae_resolution:f.ae_resolution || 'inherit',ae_template:f.ae_template || ''} : {}),
    // тест: MFR в каждой части принудительно (по умолчанию у частей выключен)
    ...(scene.app==='ae' && f.ae_backend==='background' ? {mfr_in_parts:false} : {})};
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
          benchmark:{full_frames:args.frames,mode:'parts',repeat:index<4?1:2,group,...(ui.sheet.calibration?{scope:'pc'}:{})},ae_backend:'background',ae_mfr:'off',mfr_in_parts:false,deliver:'none'});
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
    rmField("Общая папка рендеров", `<input class="rm-input" data-form="render_root" value="${esc(f.render_root)}" autocomplete="off" spellcheck="false">`),
    rmField("Папка Облака", `<input class="rm-input" data-form="deliver_root" value="${esc(f.deliver_root)}" autocomplete="off" spellcheck="false">`, "Облако Mail.ru забирает отсюда готовые рендеры."),
    rmField("Куда сохранять", rmSegments("default_output", RM_OUTPUT.filter(([k]) => k !== "custom"), f.default_output)),
    rmField("В облако после рендера", rmSegments("default_deliver", RM_DELIVER, f.default_deliver)),
    rmField("After Effects", rmSegments("ae_backend", RM_BACKEND, f.ae_backend)),
    rmField("Открывать папку после рендера", rmSegments("open_folder", [["1", "Да"], ["0", "Нет"]], f.open_folder)),
  ].join("");
  const back = ui.sheet.from === "rm-scenes" ? `<button class="icon-button" type="button" data-action="rm-scenes" aria-label="Назад">${icon("left")}</button>` : "";
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet rm-sheet rsx rsx-step-form rsx-settings" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head">${back}<h2 id="sheet-title">Настройки рендера</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div>${body}<div class="rm-foot"><button type="button" class="primary-button ${rmBusyCls("rm-settings-save")}" data-action="rm-settings-save">Сохранить</button></div></section></div>`;
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
  if (form.output_name && (/[<>:"/\\|?*]/.test(form.output_name) || form.output_name.length>120 || /[. ]$/.test(form.output_name))) errors.push('Имя файла: до 120 символов, без знаков пути и точки в конце');
  if (/^@flow:/.test(form.ae_template || '') && form.ae_backend==='cep') errors.push('Для этого формата выберите фоновый рендер');
  const media = rmEffectiveMedia(target,form,scene.app);
  warnings.push(...media.warnings);
  if(form.ae_template==='@flow:mp4' && media.width && (media.width%2 || media.height%2)) errors.push('MP4 H.264 требует чётные ширину и высоту. Выберите MOV + альфа или измените размер композиции.');
  if(/^@flow:hap/.test(form.ae_template || '') && media.width && (media.width%4 || media.height%4)) errors.push('HAP требует ширину и высоту, кратные четырём. Выберите другой формат.');
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
  const explicit=template.startsWith('@flow:');
  const known=divisor && (explicit || !transformed && !template) && Number(a.width)>0 && Number(a.height)>0;
  if (!known && a.width && a.height) warnings.push(`Композиция ${a.width}×${a.height}; итоговый размер подтвердит AE${transformed?' (resize/crop в Output Module)':''}.`);
  if (template && !explicit) warnings.push('Параметры выбранного Output Module подтвердит AE. Нестандартное видео рендерится одним процессом, чтобы сохранить кодек и прозрачность.');
  const formats={'@flow:mp4':'MP4 · H.264','@flow:mov-alpha':'MOV · ProRes 4444 + альфа','@flow:png':'PNG · секвенция + альфа','@flow:exr':'EXR · секвенция + альфа','@flow:hap':'MOV · HAP','@flow:hap-alpha':'MOV · HAP + альфа'};
  const format=template ? formats[template] || `Шаблон: ${template}` : a.format || 'Формат из проекта';
  return {width:known?Math.floor(Number(a.width)/divisor):null,height:known?Math.floor(Number(a.height)/divisor):null,format,warnings};
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
    let total = 0;
    const rows = chosen.map(t => {
      const form = rmFormFor(t, f), audit = rmAudit(s, t, form), media = rmEffectiveMedia(t, form, s.app);
      total += audit.frames?.count || 0;
      const name = String(t.target || '').split(/[\/]/).filter(Boolean).pop() || t.target;
      const fmt = [media.width ? `${media.width}×${media.height}` : '', media.format && !/из проекта/i.test(media.format) ? media.format : ''].filter(Boolean).join(' · ');
      return `<div class="rsx-batch-row" title="${esc(t.target)}"><b>${esc(name)}</b><span>${esc(String(form.frames || '').replace('-', '–'))}</span>${fmt ? `<em>${esc(fmt)}</em>` : ''}</div>`
        + audit.warnings.map(w => `<p class="rm-warn">${esc(w)}</p>`).join('');
    }).join('');
    return `<div class="rm-summary rsx-batch"><div class="rsx-batch-head"><b>${rmPlural(chosen.length, "композиция", "композиции", "композиций")}</b>${total ? `<span>${rmPlural(total, "кадр", "кадра", "кадров")}</span>` : ''}</div><div class="rsx-batch-list">${rows}</div></div>`;
  }

  const t = chosen[0], audit = rmAudit(s, t, rmFormFor(t, f)), a = audit.a, n = audit.frames?.count,media=rmEffectiveMedia(t,f,s.app);
  const line1 = [n ? rmPlural(n, "кадр", "кадра", "кадров") : "", rmDuration(n, a.fps)].filter(Boolean).join(" · ");
  const line2 = [media.width && media.height ? `${media.width}×${media.height}` : "", rmFps(a.fps), media.format].filter(Boolean).join(" · ");
  const warn = audit.warnings.slice(0, 3).map(w => `<p class="rm-warn">${esc(w)}</p>`).join("") + (audit.warnings.length > 3 ? `<p class="rm-warn">и ещё ${audit.warnings.length - 3}</p>` : "");
  return `<div class="rm-summary"><div class="rm-summary-name">${ui.sheet?.benchmark ? `<b class="rm-sum-title">${esc(f.output_name || t.target)}</b>` : ui.sheet?.renameOpen ? `<input class="rm-input rsx-name-input" data-form="output_name" data-rsx-name maxlength="120" value="${esc(f.output_name || t.target || '')}" placeholder="${esc(t.target)}" aria-label="Имя итогового файла, без расширения" autocomplete="off" spellcheck="false">` : `<button type="button" class="rsx-name" data-action="rm-name-toggle" aria-label="Имя файла: ${esc(f.output_name || t.target)}. Нажмите, чтобы изменить">${esc(f.output_name || t.target)}</button>`}</div>${line1 ? `<p class="rm-sum-facts">${esc(line1)}</p>` : ""}${line2 ? `<p class="rm-sum-facts">${esc(line2)}</p>` : ""}${warn}</div>`;
}

/** Куда ляжет рендер — одной строкой под переключателем. */
function rmWhere(s, t, f) {
  if (ui.sheet?.benchmark) return `${rmSettings().render_root}\\_benchmarks`;
  let output=rmOutputName(t,f);
  const extension={'@flow:mp4':'mp4','@flow:mov-alpha':'mov','@flow:hap':'mov','@flow:hap-alpha':'mov','@flow:png':'png','@flow:exr':'exr'}[f.ae_template];
  if(extension) output=output.replace(/(?:\.\[#+\])?\.[^.\\/]+$/,['png','exr'].includes(extension)?`.[####].${extension}`:`.${extension}`);
  if (f.output_mode === "scene") return output || "в сцене путь не задан";
  const filename=output.split(/[\\/]/).pop() || `${t.target || 'render'}.[####].exr`;
  const project=String(s.path || s.name).split(/[\\/]/).pop().replace(/\.[^.]+$/,'').replace(/[<>:"/\\|?*]/g,'_');
  const folder=f.output_mode==='custom'?f.output_dir:`${rmSettings().render_root}\\${project}`;
  return folder?`${folder.replace(/[\\/]$/,'')}\\${filename}`:'';
}

function rmFrameFields(frames) {
  const range=String(frames || '').match(/^(-?\d+)(?:-(-?\d+))?$/);
  if(!range)return `<input class="rm-input" data-form="frames" value="${esc(frames || '')}" aria-label="Кадры">`;
  return `<div class="rm-frame-range"><input class="rm-input" type="number" step="1" data-frame-edge="start" value="${range[1]}" aria-label="Первый кадр"><span>—</span><input class="rm-input" type="number" step="1" data-frame-edge="end" value="${range[2] || range[1]}" aria-label="Последний кадр"></div>`;
}

/** Параметры задачи: главное сверху, редкое — в «Дополнительно», кнопка — внизу листа. */
function rmJobForm(s, t) {
  const f = ui.sheet.form, set = rmSettings(), chosen = rmChosenTargets(s), many = chosen.length > 1, bench = ui.sheet.benchmark;
  const errors = [...new Set(chosen.flatMap(x => rmAudit(s, x, rmFormFor(x, f)).errors))];
  const ae = s.app === "ae";
  const main = bench ? [
    `<div class="rm-banner"><b>Тест скорости</b><span>${f.benchmark_mode==='parts'?'1–4 части, по две пробы в обратном порядке. Сравниваем время кадров; копирование проекта и сборка видео в замер не входят.':'Два коротких прогона — без MFR и с MFR.'} Тест пишет отдельную секвенцию без доставки и выключения ПК. Оценка полного рендера приблизительная.</span><button type="button" class="text-action" data-action="rm-benchmark-exit">Отменить тест</button></div>`,
    !ui.sheet.calibration ? rmField('Что сравнить',rmSegments('benchmark_mode',[['mfr','MFR'],['parts','1–4 части']],f.benchmark_mode || 'mfr')) : '',
    rmField("Кадры для теста", `<input class="rm-input" data-form="sample_frames" value="${esc(f.sample_frames)}" inputmode="numeric" autocomplete="off">`, `2–120 кадров подряд внутри ${esc(f.frames)}.`),
  ] : [
    !many ? rmField("Кадры", rsxFrameStrip(t, f.frames) + rmFrameFields(f.frames)) : "",
    rmField("Сохранение и облако", rmSegments("output_mode", RM_OUTPUT, f.output_mode) + (f.output_mode === "custom" ? `<input class="rm-input" data-form="output_dir" value="${esc(f.output_dir)}" placeholder="E:\Render" autocomplete="off" spellcheck="false" aria-label="Своя папка">` : "") + `<span class="rm-field-caption">В облако после рендера</span>` + rmSegments("deliver",RM_DELIVER,f.deliver) + rsxDestination(s, t, f, chosen)),
  ];
  // «Дополнительно» (решение 18.11): способ AE, формат, части и разрешение; пресеты и «Срочно» убраны.
  const more = ui.sheet.more;
  const moreBtn = `<button type="button" class="rm-more" data-action="rm-more" aria-expanded="${Boolean(more)}">Дополнительно<span aria-hidden="true">${more ? "▴" : "▾"}</span></button>`;
  const extra = bench ? "" : !ae ? moreBtn + (more ? `<p class="rsx-more-note">У Houdini (Karma) формат, разрешение и способ рендера задаются в ROP сцены.</p>` : "") : moreBtn + (!more ? "" : [
    rmField("Как рендерить", rmSegments("ae_backend", RM_BACKEND, f.ae_backend), set.background_off && f.ae_backend === "auto" ? "Фон после сбоя отключён на сутки — «Авто» сейчас рендерит в открытом AE." : ""),
    rmField('Формат вывода', rmFormatSelect(chosen, f)),
    f.ae_backend === "background" ? rmField("Частей одновременно", rmSegments("parallel", [['auto','Авто'],...RM_PARTS], String(f.parallel || '4'))) : "",
    rmField("Разрешение", rmSegments("ae_resolution", RM_RESOLUTION, f.ae_resolution || "inherit")),
  ].join(""));
  const label = bench ? "Запустить тест" : many ? `Поставить ${rmPlural(chosen.length, "задачу", "задачи", "задач")}` : "Поставить в очередь";
  return [
    rmSummary(s, chosen, f),
    ...main,
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
  if(event.target?.dataset?.frameEdge && ui.sheet?.form){
    const group=event.target.closest('.rm-frame-range');
    const start=group.querySelector('[data-frame-edge="start"]').value,end=group.querySelector('[data-frame-edge="end"]').value;
    ui.sheet.form.frames=!start || !end?'':start===end?start:`${start}-${end}`;
    delete ui.sheet.submissionId;ui.sheet.confirm=false;rmRefreshError();return;
  }
  const key = event.target?.dataset?.form;
  if (key && ui.sheet?.form) {ui.sheet.form[key] = event.target.value;delete ui.sheet.submissionId;ui.sheet.confirm=false;rmRefreshError();}
});
document.addEventListener('change',event=>{
  const key=event.target?.dataset?.form;
  if (key && ui.sheet?.form) {ui.sheet.form[key]=event.target.value;delete ui.sheet.submissionId;ui.sheet.confirm=false;}
});
document.addEventListener('scroll',event=>{
  if(event.target?.id==='rm-format-list' && ui.sheet)ui.sheet.formatScroll=event.target.scrollTop;
},true);

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
  const scenes = (rmQueue().scenes || []).filter(s=>!ui.sheet.calibration || s.app==='ae');
  const s = ui.sheet.scene ? scenes.find(x => x.id === ui.sheet.scene) : null;
  const t = s ? rmChosenTargets(s)[0] : null;
  const back = t ? `data-action="rm-scene" data-id="${esc(s.id)}"` : `data-action="rm-scenes"`;
  const sub = t ? rsxName(s) : '';
  const head = title => `<div class="sheet-handle"></div><div class="sheet-head">${s ? `<button class="icon-button" type="button" ${back} aria-label="Назад">${icon("left")}</button>` : ""}<h2 id="sheet-title">${title}${sub ? `<small class="rsx-sub">${esc(sub)}</small>` : ''}</h2>${!s ? `<button class="icon-button" type="button" data-action="rm-settings" aria-label="Настройки рендера: папки и способ по умолчанию">${icon("settings")}</button>` : ''}<button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div>`;
  let body;
  if (t) {
    body = rmJobForm(s, t);
  } else if (!s) {
    body = rsxScenePicker(scenes) + (ui.sheet.calibration ? '' : `<div class="rsx-tools"><button type="button" class="rsx-link" data-action="rm-calibrate">Тест скорости ПК</button></div>`);
  } else {
    body = rsxTargetPicker(s);
  }
  const title = t ? (ui.sheet.benchmark ? 'Тест скорости' : 'Параметры') : s ? rsxName(s) : (ui.sheet.calibration ? 'Тест скорости ПК' : 'Новый рендер');
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet rm-sheet rsx ${t ? 'rsx-step-form' : s ? 'rsx-step-targets' : 'rsx-step-scenes'}" role="dialog" aria-modal="true" aria-labelledby="sheet-title">${head(title)}${body}</section></div>`;
}

/** Прочитать цели сцены: ПК открывает её без окна, ответ кладёт в rmQueue.scenes. Ход — в панели внизу. */
function rmRead(id) {
  const scene = (rmQueue().scenes || []).find(x => x.id === id);
  if (!scene) return;
  ui.pc.rmReading = { ...(ui.pc.rmReading || {}), [id]: true };
  const calibration=Boolean(ui.sheet?.calibration);
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
      const open = () => { if (ui.page !== "render") navigate("render"); ui.sheet = { kind: "rm-scenes", scene: id, calibration, selected: [], justRendered: false }; render(); };
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
  rm_patch: { title: "Перерендер участка", typical: 12, steps: ["Отправил на компьютер", "Снимаю копию проекта", "Нахожу прошлую версию", "Ставлю участок в очередь"] },
  rm_reveal: { title: "Открываю папку на ПК", typical: 4, steps: ["Отправил на компьютер", "Открываю Проводник"] },
  rm_compare: { title: "Сравниваю версии", typical: 5, steps: ["Отправил на компьютер", "Запускаю сравнение"] },
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

function rmTaskNote(t) {
  return t.lastError?'Нет связи с сервером. Повторяю проверку этой же команды.':`Этапы ориентировочные; подтверждение придёт с ПК. Обычно до ${rmSecs(t.typical * 1000)}. Можно свернуть — итог появится здесь.`;
}
function rmTaskHtml(t) {
  const key = `${t.id}:${t.status}:${t.min}:${t.open}`;
  const icon = t.status === "done" ? pcIcon("check") : t.status === "failed" ? pcIcon("x") : `<i class="rm-t-spin"></i>`;
  if (t.status === "running" && t.min) {
    return `<button type="button" class="rm-t-pill" data-key="${key}" data-rm-dock="unmin" data-id="${t.id}">${icon}<b>${esc(t.title)}</b><span class="rm-t-time">${rmSecs(Date.now() - t.started)}</span></button>`;
  }
  if (t.status === "running") {
    const step = rmTaskStep(t);
    return `<section class="rm-t" data-key="${key}" role="status"><div class="rm-t-head">${icon}<b>${esc(t.title)}</b><span class="rm-t-time">${rmSecs(Date.now() - t.started)}</span><button type="button" class="rm-t-min" data-rm-dock="min" data-id="${t.id}" aria-label="Свернуть">Свернуть</button></div>
      <div class="pc-render-bar indeterminate"><b></b></div>
      <ol class="rm-t-steps">${t.steps.map((s, i) => `<li class="${i < step ? "done" : i === step ? "now" : ""}">${esc(s)}</li>`).join("")}</ol>
      <p class="rm-t-note">${esc(rmTaskNote(t))}</p></section>`;
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
      const note=el.querySelector('.rm-t-note');
      if(note) note.textContent=rmTaskNote(t);
      const list=el.querySelector('.rm-t-steps');
      if(list && list.children.length!==t.steps.length) list.innerHTML=t.steps.map(s=>`<li>${esc(s)}</li>`).join('');
      const step = rmTaskStep(t);
      el.querySelectorAll(".rm-t-steps li").forEach((li, i) => { li.className = i < step ? "done" : i === step ? "now" : ""; });
    }
    return el;
  });
  wanted.forEach((el, i) => { if (dock.children[i] !== el) dock.insertBefore(el, dock.children[i] || null); });
  while (dock.children.length > wanted.length) dock.lastElementChild.remove();
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
  if(action==='rm-problem-toggle'){const j=rmJobs().find(x=>Number(x.id)===Number(ui.sheet?.id))||ui.sheet?.job;ui.sheet.problemOpen=!(ui.sheet.problemOpen??(j?.status==='failed'));render();return true;}
  if(action==='rm-dest-toggle'){ui.sheet.destOpen=!ui.sheet.destOpen;render();return true;}
  if(action==='rm-name-toggle'){ui.sheet.renameOpen=!ui.sheet.renameOpen;render();const n=document.querySelector?.('[data-rsx-name]');if(n){n.focus();n.select();}return true;}
  if(action==='rm-format-toggle'){ui.sheet.formatOpen=!ui.sheet.formatOpen;render();return true;}
  if(action==='rm-format-templates'){ui.sheet.formatTemplatesOpen=!ui.sheet.formatTemplatesOpen;render();return true;}
  if(action==='rm-format-pick'){
    ui.sheet.form.ae_template=control.dataset.value;ui.sheet.formatOpen=false;ui.sheet.formatScroll=0;
    delete ui.sheet.submissionId;ui.sheet.confirm=false;render();return true;
  }
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
      if (ui.sheet.calibration && selected.size!==1) {toast('Для общего теста выберите одну композицию');return true;}
      if (!selected.size || selected.size>50) {toast('Выберите от 1 до 50 целей');return true;}
      // одна цель — сразу её кадры в поле; несколько — у каждой свой диапазон
      const one=selected.size===1 ? (scene.targets || []).find(t=>selected.has(rmTargetKey(t))) : null;
      const s=rmSettings();ui.sheet.batch=true;ui.sheet.more=false;ui.sheet.form={frames:one?.frames || '',output_mode:s.default_output,output_dir:'',deliver:s.default_deliver,ae_backend:s.ae_backend,parallel:"4",ae_mfr:'inherit',ae_resolution:'inherit',ae_template:'',urgent:''};
      if(ui.sheet.calibration) return rmAction('rm-benchmark',{dataset:{}});
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
    ui.sheet.benchmark=true;ui.sheet.confirm=false;if(ui.sheet.calibration)f.benchmark_mode='parts';f.sample_frames=`${start}-${start+count-1}`;f.ae_backend='background';f.deliver='none';f.output_mode='root';render();return true;
  }
  if (action==='rm-preset') {
    const scene=(rmQueue().scenes || []).find(s=>s.id===ui.sheet?.scene),f=ui.sheet?.form;
    const preset=scene && rmPresets(scene.app).find(p=>p.id===control.dataset.id);
    if (f && preset) {for (const key of RM_PRESET_KEYS) if (key in preset.form) f[key]=key==='mfr_in_parts' ? (preset.form[key]?'1':'') : key==='parallel'?String(preset.form[key]):preset.form[key];if(Number(f.parallel)>4)f.parallel='auto';f.mfr_in_parts='';if(f.ae_backend==='background')f.ae_mfr='off';f.preset_id=(rmQueue().presets || []).some(p=>p.id===preset.id) ? preset.id : '';f.preset_name=preset.name;delete ui.sheet.submissionId;ui.sheet.confirm=false;render();}return true;
  }
  if (action==='rm-preset-save' || action==='rm-preset-delete') {
    const scene=(rmQueue().scenes || []).find(s=>s.id===ui.sheet?.scene),f=ui.sheet?.form;
    if (!scene || !f) return true;
    const name=String(f.preset_name || '').trim();
    if (action==='rm-preset-save' && !name) {toast('Введите название пресета');return true;}
    const args=action==='rm-preset-delete' ? {action:'delete',id:control.dataset.id} : {action:'save',...(f.preset_id ? {id:f.preset_id} : {}),name,app:scene.app,form:Object.fromEntries(RM_PRESET_KEYS.map(k=>[k,f[k] || '']))};
    if (args.form) {args.form.parallel=f.parallel==='auto'?'auto':Number(f.parallel)||1;args.form.mfr_in_parts=false;if(f.ae_backend==='background')args.form.ae_mfr='off';}
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
  if (action === 'rm-tools-toggle') { ui.pc.rmToolsOpen=!ui.pc.rmToolsOpen; return true; }
  if (action === 'rm-history-toggle') { ui.pc.rmHistoryOpen=!ui.pc.rmHistoryOpen; return true; }
  if (action === 'rm-project') { ui.pc.rmProject = control.dataset.project || ''; render(); return true; }
  if (action === 'rm-patch-open') { const job=rmJobs().find(j=>Number(j.id)===id);if(!rmPatchable(job))return true;ui.sheet={kind:'rm-patch',id,job};render();rmPatchMarkers(job);return true; }
  if (action === 'rm-patch-send') {
    const s=ui.sheet;if(s?.kind!=='rm-patch'||s.start==null)return true;
    const frames=s.start===s.end?String(s.start):`${s.start}-${s.end}`;
    ui.sheet=null;render();
    rmTask('rm_patch',{id,frames},{done:r=>{reload();return {title:r?.message||`Перерендер ${frames} в очереди`};}});
    return true;
  }
  if (action === 'rm-reveal') { rmTask('rm_reveal',{id},{done:r=>({title:r?.message||'Папка открыта на ПК'})}); return true; }
  if (action === 'rm-patch-markers') { const s=ui.sheet,job=rmPatchJob();if(s?.kind!=='rm-patch'||!job)return true;s.markersRead=false;s.markersFailed=false;render();rmPatchMarkers(job,true);return true; }
  if (action === 'rm-compare') { rmTask('rm_compare',{id},{done:r=>{reload();return {title:r?.message||'Сравниваю'};}}); return true; }
  if (action === 'rm-detail') { ui.sheet={kind:'rm-detail',id,job:rmJobs().find(j=>Number(j.id)===id)};render();return true; }
  if (action === 'rm-archive') { if(ui.sheet?.kind==='rm-detail')ui.sheet=null;rmArchive([id]); return true; }
  if (action === "rm-clear") {
    rmArchive(rmJobs().filter(j=>['done','failed','cancelled'].includes(j.status)).map(j=>Number(j.id)),true);
    return true;
  }
  if (action === "rm-calibrate" || action === "rm-scenes") { ui.sheet = { kind: "rm-scenes", calibration:action==='rm-calibrate' || Boolean(ui.sheet?.calibration), justRendered: false }; render(); return true; }
  if (action === "rm-scene") {
    // «Назад» из параметров — к той же сцене с той же отметкой композиций
    const keep = ui.sheet?.scene === control.dataset.id ? ui.sheet.selected : [];
    ui.sheet = { kind: "rm-scenes", scene: control.dataset.id, calibration:Boolean(ui.sheet?.calibration), selected: keep || [], justRendered: false }; render(); return true;
  }
  if (action === "rm-read") { rmRead(control.dataset.id); return true; }
  if (action === "rm-go") {
    // цель выбрана — шаг с параметрами, по умолчанию из настроек Render Manager
    const scene = (rmQueue().scenes || []).find(x => x.id === control.dataset.id);
    const i = Number(control.dataset.i);
    const t = scene?.targets?.[i];
    if (!t) return true;
    const s = rmSettings();
    ui.sheet = { kind: "rm-scenes", scene: scene.id, calibration:Boolean(ui.sheet?.calibration), target: i, justRendered: false,
      targetKey: rmTargetKey(t), form: { frames: t.frames || "", output_mode: s.default_output, output_dir: "", deliver: s.default_deliver, ae_backend: s.ae_backend, parallel: "4", ae_mfr: "inherit", ae_resolution:"inherit", ae_template:"", urgent: "" } };
    if(ui.sheet.calibration) return rmAction('rm-benchmark',{dataset:{}});
    render();
    return true;
  }
  if (action === "rm-opt") {
    if (ui.sheet?.form) {
      const key=String(control.dataset.key||''),value=String(control.dataset.value||'');
      ui.sheet.form[key]=value;delete ui.sheet.submissionId;ui.sheet.justRendered=false;render();
      requestAnimationFrame(()=>{const esc=v=>window.CSS?.escape?CSS.escape(v):v.replace(/["\\]/g,'\\$&');const next=document.querySelector(`.sheet [data-action="rm-opt"][data-key="${esc(key)}"][data-value="${esc(value)}"]`);next?.focus({preventScroll:true});});
    }
    return true;
  }
  if (action === "rm-confirm-back") { ui.sheet.confirm = false; render(); return true; }
  if (action === "rm-submit") {if (ui.pc.quick?.['rm-submit'] !== 'is-busy') rmSubmitSheet();return true;}
  if (action === "rm-settings") {
    const s = rmSettings();
    ui.sheet = { kind: "rm-settings", from: ui.sheet?.kind === "rm-scenes" ? "rm-scenes" : "", justRendered: false, form: { render_root: s.render_root, deliver_root: s.deliver_root, default_output: s.default_output, default_deliver: s.default_deliver, ae_backend: s.ae_backend, ae_parallel: "auto", open_folder: s.open_folder ? "1" : "0" } };
    render();
    return true;
  }
  if (action === "rm-settings-save") {
    const f = ui.sheet?.form;
    if (!f) return true;
    if (![f.render_root, f.deliver_root].every(p => /^[a-z]:\\/i.test(String(p).trim()))) { toast("Папки — полный путь, например D:\\Render"); return true; }
    const args = { ...f, render_root: f.render_root.trim(), deliver_root: f.deliver_root.trim(), ae_parallel: "auto", open_folder: f.open_folder !== "0" };
    const from = ui.sheet.from;
    pcQuick("rm_settings", args, "rm-settings-save", r => {
      if (r?.settings) ui.pc.data.rmQueue = { ...rmQueue(), settings: r.settings };
      toast("Настройки сохранены");
      ui.sheet = from === "rm-scenes" ? { kind: "rm-scenes", justRendered: false } : null;
      render();
    });
    return true;
  }
  return false;
}
// A history swipe archives one finished entry; files and live jobs are untouched.
(function rmHistorySwipe(){
 let drag=null,blockUntil=0;
 document.addEventListener('pointerdown',e=>{
  const box=e.target.closest?.('.rm-history-swipe');
  if(!box || e.button!==0)return;
  drag={box,row:box.querySelector('.rm-history-row'),ids:String(box.dataset.historyIds||box.dataset.historyId||'').split(',').map(Number).filter(Boolean),x:e.clientX,y:e.clientY,on:false};
 });
 document.addEventListener('pointermove',e=>{
  if(!drag)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.on && Math.abs(dy)>10 && Math.abs(dy)>Math.abs(dx)){drag=null;return;}
  if(dx < -12)drag.on=true;
  if(drag.on)drag.row.style.transform=`translateX(${Math.max(-110,Math.min(0,dx))}px)`;
 },{passive:true});
 const end=(e,cancelled=false)=>{
  if(!drag)return;
  const d=drag;drag=null;
  d.row.style.transform='';
  if(d.on){blockUntil=performance.now()+400;if(!cancelled && e.clientX-d.x < -65)rmArchive(d.ids);}
 };
 document.addEventListener('pointerup',end);
 document.addEventListener('pointercancel',e=>end(e,true));
 document.addEventListener('click',e=>{if(performance.now()<blockUntil && e.target.closest?.('.rm-history-swipe')){e.preventDefault();e.stopPropagation();}},true);
})();

// Existing owner-only server flow; explicit user click, stable retry identity.
const rmCustomerIntents=new Map();
document.addEventListener('click',async event=>{
 const button=event.target.closest?.('[data-action="rm-customer-share"]');if(!button)return;event.preventDefault();event.stopPropagation();
 const job=rmJobs().find(row=>String(row.id)===button.dataset.id);if(!job||typeof window.sorokaRenderShare!=='function')return;
 const key=String(job.id)+':'+String(job.started_at);let intent=rmCustomerIntents.get(key);if(!intent){intent={requestId:crypto.randomUUID(),shareId:null,busy:false};rmCustomerIntents.set(key,intent);}if(intent.busy)return;
 intent.busy=true;button.disabled=true;
 try{
  if(!intent.shareId){const answer=await window.sorokaRenderShare({op:'create',jobId:String(job.id),requestId:intent.requestId,label:String(job.name||'Рендер').trim().slice(0,120)});if(typeof answer?.shareId!=='string')throw Error('share_unconfirmed');intent.shareId=answer.shareId;}
  const sent=await window.sorokaRenderShare({op:'send_owner',shareId:intent.shareId,requestId:intent.requestId});if(sent?.sent!==true)throw Error('send_unconfirmed');toast('Карточка в чате Flow — её можно переслать заказчику');
 }catch{toast('Отправка не подтверждена. Нажми ещё раз, чтобы проверить её.');}finally{intent.busy=false;if(button.isConnected)button.disabled=false;}
},true);

// «Поделиться рендером»: живая публичная ссылка на статус, без токена в DOM/логах.
const rmShareIntents=new Map();
document.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-action="rm-share"]');if(!button)return;event.preventDefault();event.stopPropagation();
 const job=rmJobs().find(row=>String(row.id)===String(button.dataset.id));if(!job)return;
 if(typeof window.sorokaRenderShare!=='function'){toast('Поделиться можно в приложении Flow');return;}
 const key=String(job.id)+':'+String(job.started_at),prior=rmShareIntents.get(key);if(prior?.busy)return;
 const intent=prior||{requestId:`app-share:${String(job.id)}:${String(job.started_at||'')}`.slice(0,100),statusUrl:'',busy:false};rmShareIntents.set(key,intent);intent.busy=true;button.disabled=true;
 void(async()=>{try{
  if(!intent.statusUrl){const answer=await window.sorokaRenderShare({op:'create',jobId:String(job.id),requestId:intent.requestId,label:String(job.name||'Рендер').trim().slice(0,120)});if(typeof answer?.statusUrl!=='string'||!/^https:\/\//i.test(answer.statusUrl))throw Error('share_unavailable');intent.statusUrl=answer.statusUrl;}
  const text=rmShareCopy(job);
  if(typeof navigator.share==='function'){try{await navigator.share({title:'Рендер',text,url:intent.statusUrl});toast('Ссылка на живой статус отправлена');return;}catch(error){if(error?.name==='AbortError')return;}}
  if(await rmCopyText(text+'\n'+intent.statusUrl)){toast('Ссылка на живой статус скопирована');return;}
  throw Error('copy_failed');
 }catch{toast('Не удалось поделиться. Повтори ещё раз.');}finally{intent.busy=false;if(button.isConnected)button.disabled=false;}})();
},true);


/* ========== Перерендер участка готового видео ==========
 * Лист «Перерендер участка»: шкала всего ролика, светящийся участок с двумя ручками, точные поля и оценка времени.
 * Команда rm_patch → агент ПК → Render Manager: пересчитываются только эти кадры, остальное берётся из готовой версии.
 * После рендера служба сама сравнивает версии; итог (rm_notice и поле compare) показан в карточке задачи. */
/** «markers» — участок по маркерам RR в AE: служба узнает кадры перед рендером. */
const rmPatchLabel = v => String(v || '').toLowerCase() === 'markers' ? 'по маркерам RR' : String(v || '');
function rmSpan(text) {
  const m=String(text||'').match(/^(\d+)(?:-(\d+))?/);
  return m ? [Number(m[1]), Number(m[2] ?? m[1])] : null;
}
function rmPatchable(j) {
  // Видео, собранное своим Output Module одним AE, служба не правит участком (rm/patch.py) — кнопку не показываем.
  const native=/Output Module сохраняется/.test(String(j?.warning||''));
  return !!j && j.app==='ae' && j.status==='done' && !!rmSpan(j.frames) && !native;
}
function rmTimecode(frame, first, fps) {
  if(!(fps>0))return '';
  const t=Math.max(0,(frame-first)/fps),m=Math.floor(t/60),s=t-m*60;
  return `${m}:${s.toFixed(1).padStart(4,'0').replace('.',',')}`;
}
function rmPatchFacts(j, a, b) {
  const [first,last]=rmSpan(j.frames),total=last-first+1,n=b-a+1,fps=Number(j.fps)||0;
  const length=fps>0?`${(n/fps).toFixed(1).replace('.',',')} с`:'';
  const spent=Number(j.finished_at)-Number(j.started_at);
  // Оценка — по фактическому времени прошлого рендера, плюс минута на открытие проекта и склейку.
  const guess=spent>0&&total>0?Math.round(spent*n/total+60):0;
  return {count:`${rmPlural(n,'кадр','кадра','кадров')}${length?` · ${length}`:''}`,
    time:guess?`≈ ${rmMinutes(guess)} вместо ${rmMinutes(spent)}`:'', total, first, last, fps};
}
function rmPatchJob() {
  const s=ui.sheet;
  return rmJobs().find(x=>Number(x.id)===Number(s?.id))||s?.job;
}
function rmPatchStrip(j, a, b) {
  const {first,last,total}=rmPatchFacts(j,a,b),pos=f=>((f-first)/Math.max(1,total-1)*100).toFixed(3);
  return `<div class="rm-patch-strip" data-patch-strip style="--a:${pos(a)}%;--b:${pos(b)}%">`
    + `<div class="rm-patch-film" aria-hidden="true"></div><div class="rm-patch-range" aria-hidden="true"></div>`
    + `<button type="button" class="rm-patch-handle" data-patch-handle="start" role="slider" aria-label="Первый кадр участка" aria-valuemin="${first}" aria-valuemax="${last}" aria-valuenow="${a}"></button>`
    + `<button type="button" class="rm-patch-handle" data-patch-handle="end" role="slider" aria-label="Последний кадр участка" aria-valuemin="${first}" aria-valuemax="${last}" aria-valuenow="${b}"></button>`
    + `</div><div class="rm-patch-scale" aria-hidden="true"><span>${first}</span><span>${last}</span></div>`;
}
function renderRmPatchSheet() {
  const j=rmPatchJob();
  if(!rmPatchable(j))return '';
  const s=ui.sheet,[first,last]=rmSpan(j.frames);
  if(s.start==null){const mem=ui.pc.rmPatchRange?.[rmPatchKey(j)];
    if(mem&&mem.start>=first&&mem.end<=last){s.start=mem.start;s.end=mem.end;}
    else{s.start=first+Math.round((last-first)*.4);s.end=Math.min(last,s.start+Math.max(1,Math.round((last-first)*.1)));}}
  const f=rmPatchFacts(j,s.start,s.end),busy=rmBusyCls(`rm-patch-${j.id}`);
  const source=j.kept_frames?'Остальные кадры возьмутся из сохранённых — без потерь.':'Остальные кадры возьмутся из готового видео.';
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet rm-sheet rm-patch" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div>`
    + `<div class="sheet-head"><h2 id="sheet-title">Перерендер участка</h2><button type="button" class="icon-button" data-action="close-sheet" aria-label="Закрыть">${icon('close')}</button></div>`
    + `<p class="rm-patch-job">${esc(rmBaseName(j.name))}${j.patch_of ? ` · поверх правки ${esc(j.patch_frames || '')}` : ''}</p>`
    + `<div class="rm-patch-readout" aria-live="polite"><b data-patch-out="range">${s.start}–${s.end}</b><span data-patch-out="count">${esc(f.count)}</span>${f.time?`<span class="rm-patch-time" data-patch-out="time">${esc(f.time)}</span>`:''}</div>`
    + (()=>{const m=s.markers||[],busy=!s.markersRead;const t=busy?'Ищу маркеры RR в проекте AE…':m.length?`Маркеры RR: ${m.map(x=>x[0]===x[1]?x[0]:`${x[0]}–${x[1]}`).join(', ')}`:s.markersFailed?'Маркеры RR прочитать не удалось':'В композиции нет маркеров RR';return `<p class="rm-patch-markline${m.length?' is-found':''}">${esc(t)}</p>`;})()
    + rmPatchStrip(j,s.start,s.end)
    + `<div class="rm-patch-fields"><label><span>С кадра</span><input class="rm-input" type="number" inputmode="numeric" step="1" min="${first}" max="${last}" data-patch-edge="start" value="${s.start}"></label>`
    + `<label><span>По кадр</span><input class="rm-input" type="number" inputmode="numeric" step="1" min="${first}" max="${last}" data-patch-edge="end" value="${s.end}"></label>`
    + `${f.fps?`<p class="rm-patch-tc" data-patch-out="tc">${rmTimecode(s.start,first,f.fps)} — ${rmTimecode(s.end,first,f.fps)}</p>`:''}</div>`
    + `<button type="button" class="rm-patch-markers ${!s.markersRead?'is-busy':''}" data-action="rm-patch-markers" data-id="${j.id}" ${!s.markersRead?'disabled':''}>${!s.markersRead?'Читаю маркеры RR…':'Взять участок из маркеров RR'}<small>обновит участок по маркерам в сохранённом проекте AE</small></button>`
    + `<p class="section-note">${source} Проект берётся с диска — сохраните правки в AE.</p>`
    + `<button type="button" class="primary-button rm-patch-go ${busy}" data-action="rm-patch-send" data-id="${j.id}">Перерендерить <span data-patch-out="label">${s.start}–${s.end}</span></button>`
    + `</section></div>`;
}
/** Перерисовка без render(): поля не теряют фокус, ручка не прыгает под пальцем. */
function rmPatchPaint() {
  const s=ui.sheet,j=rmPatchJob(),root=document.querySelector('.rm-patch');
  if(!root||!j)return;
  const f=rmPatchFacts(j,s.start,s.end),pos=x=>((x-f.first)/Math.max(1,f.total-1)*100).toFixed(3)+'%';
  const strip=root.querySelector('[data-patch-strip]');
  strip.style.setProperty('--a',pos(s.start));strip.style.setProperty('--b',pos(s.end));
  root.querySelector('[data-patch-handle=start]').setAttribute('aria-valuenow',s.start);
  root.querySelector('[data-patch-handle=end]').setAttribute('aria-valuenow',s.end);
  const out=(k,v)=>{const n=root.querySelector(`[data-patch-out=${k}]`);if(n)n.textContent=v;};
  out('range',`${s.start}–${s.end}`);out('label',`${s.start}–${s.end}`);out('count',f.count);out('time',f.time);
  if(f.fps)out('tc',`${rmTimecode(s.start,f.first,f.fps)} — ${rmTimecode(s.end,f.first,f.fps)}`);
  for(const edge of ['start','end']){const input=root.querySelector(`[data-patch-edge=${edge}]`);if(input&&document.activeElement!==input)input.value=s[edge];}
}
function rmPatchSet(edge, frame) {
  const s=ui.sheet,j=rmPatchJob();if(!j)return;
  const [first,last]=rmSpan(j.frames);frame=Math.round(Math.min(last,Math.max(first,frame)));
  if(edge==='start')s.start=Math.min(frame,s.end);else s.end=Math.max(frame,s.start);
  s.touched=true;rmPatchRemember(j,s.start,s.end);
  rmPatchPaint();
}
/** Один ролик — один ключ (все его версии): выбранный участок не сбрасывается при повторном открытии. */
function rmPatchKey(j){return `${j.scene||''}|${j.target||rmBaseName(j.name)}`;}
function rmPatchRemember(j,a,b){ui.pc.rmPatchRange||={};ui.pc.rmPatchRange[rmPatchKey(j)]={start:a,end:b};}
/** Маркеры RR в текущем проекте AE (служба читает его фоновым AE, ~15 с): один участок — сразу в ручки. */
function rmPatchMarkers(j, force=false){
  pcQuick('rm_markers',{id:j.id},`rm-markers-${j.id}`,r=>{
    const s=ui.sheet;if(s?.kind!=='rm-patch'||Number(s.id)!==Number(j.id))return;
    s.markers=(r?.ranges||[]).map(x=>[Number(x[0]),Number(x[1])]);s.markersRead=true;
    if(s.markers.length&&(force||!s.touched)){s.start=Math.min(...s.markers.map(x=>x[0]));s.end=Math.max(...s.markers.map(x=>x[1]));rmPatchRemember(j,s.start,s.end);}
    render();
  },()=>{const s=ui.sheet;if(s?.kind==='rm-patch'){s.markersRead=true;s.markersFailed=true;render();}});
}
// Ручки: перетаскивание пальцем/мышью; касание шкалы переносит ближайшую ручку.
let rmPatchDrag=null;
document.addEventListener('pointerdown',event=>{
  const strip=event.target.closest?.('[data-patch-strip]');if(!strip||ui.sheet?.kind!=='rm-patch')return;
  const j=rmPatchJob();if(!j)return;
  const [first,last]=rmSpan(j.frames);
  const at=x=>{const r=strip.getBoundingClientRect();return first+(Math.min(r.right,Math.max(r.left,x))-r.left)/Math.max(1,r.width)*(last-first);};
  const frame=at(event.clientX);
  const handle=event.target.dataset?.patchHandle||(Math.abs(frame-ui.sheet.start)<=Math.abs(frame-ui.sheet.end)?'start':'end');
  rmPatchDrag={handle,at};strip.setPointerCapture?.(event.pointerId);strip.classList.add('dragging');
  event.target.closest('[data-patch-handle]')?.focus({preventScroll:true});
  rmPatchSet(handle,frame);event.preventDefault();
});
document.addEventListener('pointermove',event=>{if(rmPatchDrag)rmPatchSet(rmPatchDrag.handle,rmPatchDrag.at(event.clientX));});
document.addEventListener('pointerup',()=>{if(!rmPatchDrag)return;rmPatchDrag=null;document.querySelector('[data-patch-strip]')?.classList.remove('dragging');});
document.addEventListener('pointercancel',()=>{rmPatchDrag=null;document.querySelector('[data-patch-strip]')?.classList.remove('dragging');});
document.addEventListener('keydown',event=>{
  const edge=event.target?.dataset?.patchHandle;if(!edge||ui.sheet?.kind!=='rm-patch')return;
  const step={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1,PageDown:-10,PageUp:10}[event.key];
  if(!step)return;event.preventDefault();rmPatchSet(edge,ui.sheet[edge]+step*(event.shiftKey?10:1));
});
document.addEventListener('input',event=>{
  const edge=event.target?.dataset?.patchEdge;if(!edge||ui.sheet?.kind!=='rm-patch')return;
  const v=Number(event.target.value);if(event.target.value!==''&&Number.isFinite(v))rmPatchSet(edge,v);
});
document.addEventListener('change',event=>{
  const edge=event.target?.dataset?.patchEdge;if(edge&&ui.sheet?.kind==='rm-patch')event.target.value=ui.sheet[edge];
});

/** Карточка задачи: правка участка и итог сравнения версий. */
function rmPatchSummary(j) {
  const c=j.compare,rows=[];
  if(j.patch_of)rows.push(`<p class="rm-patch-of">Правка участка <b>${esc(rmPatchLabel(j.patch_frames))}</b></p>`);
  if(c?.status==='running')rows.push(`<p class="rm-compare-state">Сравниваю с прошлой версией…</p>`);
  else if(c?.status==='failed')rows.push(`<p class="rm-compare-state warn">Сравнение не удалось: ${esc(c.error||'ошибка')}</p><button type="button" class="text-action ${rmBusyCls(`rm-compare-${j.id}`)}" data-action="rm-compare" data-id="${j.id}">Сравнить ещё раз</button>`);
  else if(c?.status==='done'){
    const bad=Number(c.outside)>0;  // резкий стык при настоящей правке ожидаем — это подсказка, не ошибка
    rows.push(`<div class="rm-compare ${bad?'warn':'ok'}"><span class="rm-compare-dot" aria-hidden="true"></span><p>${esc(c.verdict||rmCompareShort(c)?.text||'')}</p></div>`);
  }
  return rows.length?`<div class="rm-patch-summary">${rows.join('')}</div>`:'';
}


/* ========== Раздел «Рендер»: ролик как плёнка ==========
 * Одна шкала-плёнка во всём разделе: в «Сейчас» она заполняется по ходу рендера (у правки — только участок),
 * в «Готовых роликах» на ней отмечены правленые участки, в листе «Перерендер участка» её выделяют ручками.
 * Версии одного ролика (исходник и его правки, связанные patch_of) собраны в одну карточку. */
const rmPct = (f, first, last) => `${Math.max(0, Math.min(100, (f - first) / Math.max(1, last - first) * 100)).toFixed(3)}%`;
function rmFilm({ first, last, marks = [], fill = null, live = false, label = '' }) {
  const items = marks.map(m => `<i class="rmf-mark ${m.kind || ''}" style="--a:${rmPct(m.a, first, last)};--b:${rmPct(m.b + 1 > last ? last : m.b + 1, first, last)}${m.p != null ? `;--p:${m.p}%` : ''}"></i>`).join('');
  return `<div class="rmf${live ? ' is-live' : ''}"${label ? ` role="img" aria-label="${esc(label)}"` : ' aria-hidden="true"'}>${fill != null ? `<i class="rmf-fill" style="--p:${fill}%"></i>` : ''}${items}</div>`;
}
function rmFilmScale(first, last, fps) {
  const tc = f => fps > 0 ? rmTimecode(f, first, fps).replace(/,\d$/, '') : String(f);
  return `<div class="rmf-scale" aria-hidden="true"><span>${tc(first)}</span><span>${tc(last + 1)}</span></div>`;
}
/** Плёнка текущего рендера: у правки участка закрашено всё готовое, а участок заполняется по ходу. */
function rmNowFilm(j, percent) {
  const span = rmSpan(j.frames);
  if (!span) return '';
  const [first, last] = span, patch = rmSpan(j.patch_frames);
  if (patch) {
    const count = patch[1] - patch[0] + 1, total = last - first + 1, done = Number(j.done) || 0;
    const inPatch = j.total ? Math.max(0, Math.min(100, (done - (total - count)) / count * 100)) : (percent ?? 0);
    return rmFilm({ first, last, fill: 100, marks: [{ a: patch[0], b: patch[1], kind: 'is-work', p: inPatch.toFixed(1) }], live: true,
      label: `Пересчитываю кадры ${j.patch_frames}` });
  }
  return rmFilm({ first, last, fill: percent ?? 0, live: percent == null, label: percent == null ? 'Рендер идёт' : `Готово ${Math.round(percent)}%` });
}

/** Готовые и неудачные задачи → ролики: исходная версия и все её правки вместе, свежие сверху. */
function rmVideoGroups(jobs) {
  const byId = new Map(jobs.map(j => [Number(j.id), j]));
  const root = j => { let r = j, guard = 0; while (r.patch_of && byId.has(Number(r.patch_of)) && guard++ < 50) r = byId.get(Number(r.patch_of)); return r.patch_of && !byId.has(Number(r.patch_of)) ? Number(r.patch_of) : Number(r.id); };
  const groups = new Map();
  for (const j of jobs) { const key = root(j); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(j); }
  return [...groups.values()].map(list => {
    const versions = list.slice().sort((a, b) => Number(a.id) - Number(b.id));
    const latest = versions.at(-1), done = versions.filter(v => v.status === 'done'), current = done.at(-1) || null;
    return { versions, latest, current, at: Math.max(...versions.map(v => Number(v.finished_at) || 0)) };
  }).sort((a, b) => b.at - a.at);
}
const rmBaseName = name => String(name || 'Рендер').replace(/\s*·\s*правка\s+[\d,\-\s]+$/i, '');
function rmCompareShort(c) {
  if (!c) return null;
  if (c.status === 'running') return { text: 'сравниваю…', tone: '' };
  if (c.status === 'failed') return { text: 'сравнение не удалось', tone: 'warn' };
  if (c.status !== 'done') return null;
  if (Number(c.outside) > 0) return { text: `изменения вне участка: ${c.outside}`, tone: 'warn' };
  if (Number(c.seams_bad) > 0) return { text: 'посмотрите стык', tone: '' };
  if (!Number(c.changed)) return { text: 'изменений нет', tone: 'warn' };
  return { text: 'стыки ровные', tone: 'ok' };
}
/** Действие для неудачной или прерванной попытки — то же, что в карточке задачи. */
function rmRecentAction(j) {
  const deliveryFailed = j.status === 'done' && j.delivery?.status === 'failed';
  const act = (op, label) => `<button type="button" class="dsv-action ${rmBusyCls(`rm-${op}-${j.id}`)}" data-action="rm-${op}" data-id="${j.id}">${label}</button>`;
  const resumable = (j.app === 'karma' || (j.app === 'ae' && j.ae_backend === 'background')) && Number(j.done) > 0 && Number(j.total) > Number(j.done);
  return deliveryFailed ? act('deliver', 'Отправить в облако')
    : j.status === 'failed' && j.missing > 0 ? act('missing', `Дорендерить ${j.missing}`)
      : (j.status === 'failed' || j.status === 'cancelled') && resumable ? act('retry', `Продолжить · ${j.done}/${j.total}`)
        : j.status === 'failed' || j.status === 'cancelled' ? act('retry', 'Повторить') : '';
}
function rmVersionRow(v, n) {
  const what = v.patch_of ? `правка ${esc(rmPatchLabel(v.patch_frames))}` : 'весь ролик';
  const took = /не записано/.test(rmElapsed(v)) ? '' : rmElapsed(v);
  const state = v.status === 'done' ? took : v.status === 'failed' ? 'ошибка' : v.status === 'cancelled' ? 'отменено' : '';
  const cmp = rmCompareShort(v.compare);
  const meta = [esc(state), cmp ? `<em class="${cmp.tone}">${esc(cmp.text)}</em>` : ''].filter(Boolean).join(' · ');
  return `<div class="dsv-version-row"><button type="button" class="dsv-version" data-action="rm-detail" data-id="${v.id}"><span class="dsv-v">v${n}</span><span class="dsv-what">${what}</span><span class="dsv-meta">${meta}</span></button>`
    + (v.status === 'done' ? `<button type="button" class="dsv-icon dsv-version-folder" data-action="rm-reveal" data-id="${v.id}" aria-label="Открыть папку версии v${n} на ПК">${icon('folder', 'icon-sm')}</button>` : '') + `</div>`;
}
function rmVideoCard(g, project) {
  const base = g.current || g.versions[0], span = rmSpan(base.frames);
  const title = rmShortTitle(rmBaseName(g.versions[0].name), project), latest = g.latest;
  const failedLatest = latest.status !== 'done' || latest.delivery?.status === 'failed';
  const patches = g.versions.filter(v => v.patch_of && v.status === 'done' && rmSpan(v.patch_frames));
  const marks = patches.map((v, i) => { const [a, b] = rmSpan(v.patch_frames); return { a, b, kind: i === patches.length - 1 ? 'is-new' : 'is-old' }; });
  // У ещё не готового ролика плёнки нет: показывать нечего.
  const film = span && g.current ? rmFilm({ first: span[0], last: span[1], fill: 100, marks,
    label: marks.length ? `Ролик, правленые участки: ${patches.map(v => v.patch_frames).join(', ')}` : 'Ролик целиком' }) : '';
  const took = v => { const t = rmElapsed(v); return /не записано/.test(t) ? '' : t; };
  // Одна строка о последней версии; все версии — в карточке задачи по нажатию.
  const n = g.versions.length, cmp = rmCompareShort(latest.compare);
  const what = failedLatest
    ? `<em class="warn">${esc(latest.status === 'done' ? `в облако не ушло: ${latest.delivery?.error || 'ошибка'}` : latest.error || (latest.status === 'cancelled' ? 'отменено' : 'ошибка рендера'))}</em>`
    : [latest.patch_of ? `правка ${esc(rmPatchLabel(latest.patch_frames))}` : 'весь ролик', esc(took(latest)), cmp ? `<em class="${cmp.tone}">${esc(cmp.text)}</em>` : ''].filter(Boolean).join(' · ');
  const tools = [
    failedLatest ? rmRecentAction(latest) : '',
    !failedLatest && g.current && rmPatchable(g.current) ? `<button type="button" class="dsv-action is-main" data-action="rm-patch-open" data-id="${g.current.id}" aria-label="Перерендерить участок «${esc(title)}»">Участок</button>` : '',
    g.current ? `<button type="button" class="dsv-icon" data-action="rm-reveal" data-id="${Number(g.current.id)}" aria-label="Открыть папку на компьютере" title="Открыть папку на ПК">${icon('folder', 'icon-sm')}</button>` : '',
    g.current ? `<button type="button" class="dsv-icon" data-action="rm-customer-share" data-id="${Number(g.current.id)}" aria-label="Ссылка для заказчика">${icon('share', 'icon-sm')}</button>` : '',
  ].join('');
  const ids = g.versions.filter(v => ['done', 'failed', 'cancelled'].includes(v.status)).map(v => v.id).join(',');
  const state = !g.current ? 'is-failed' : failedLatest ? 'is-warn' : '';
  return `<div class="rm-history-swipe" data-history-ids="${ids}"><span class="rm-history-remove" aria-hidden="true">Убрать</span><article class="rm-history-row dsv-card ${state}">`
    + `<div class="dsv-top"><button type="button" class="dsv-open" data-action="rm-detail" data-id="${latest.id}"><b>${failedLatest ? `<i class="dsv-dot" aria-hidden="true"></i>` : ''}${esc(title)}${n > 1 ? `<span class="dsv-n">v${n}</span>` : ''}</b><small>${what}</small></button>`
    + `${tools ? `<div class="dsv-tools">${tools}</div>` : ''}</div>${film}</article></div>`;
}
/** Все версии ролика — для карточки задачи. */
function rmVersionsBlock(j) {
  const recent = rmJobs().filter(x => ['done', 'failed', 'cancelled'].includes(x.status));
  const g = rmVideoGroups(recent).find(x => x.versions.some(v => Number(v.id) === Number(j.id)));
  if (!g || g.versions.length < 2) return '';
  return `<div class="dsv-versions"><p class="pc-find-label">Версии</p>${g.versions.slice().reverse().map(v => rmVersionRow(v, g.versions.indexOf(v) + 1)).join('')}</div>`;
}


/* Готовые ролики по проектам: проект — файл сцены (MAP.aep → «MAP»); без сцены — начало имени до « · ». */
function rmProjectOf(j) {
  const file = String(j?.scene || '').split(/[\\/]/).pop().replace(/\.(aep|aepx|hip|hiplc|hipnc)$/i, '').trim();
  return file || String(j?.name || 'Без проекта').split(' · ')[0].trim() || 'Без проекта';
}
function rmShortTitle(title, project) {
  const t = String(title || ''), p = String(project || '');
  return p && t.toLowerCase().startsWith(p.toLowerCase() + ' · ') ? t.slice(p.length + 3) : t;
}
function rmProjectGroups(videos) {
  const map = new Map();
  for (const g of videos) { const key = rmProjectOf(g.versions[0]); if (!map.has(key)) map.set(key, []); map.get(key).push(g); }
  return [...map.entries()].map(([name, list]) => ({ name, videos: list, at: Math.max(...list.map(g => g.at)) })).sort((a, b) => b.at - a.at);
}
/** Секция «Готовые ролики»: чипы проектов (если их больше двух) и карточки, сгруппированные по проектам. */
function rmVideosSection(recent) {
  const projects = rmProjectGroups(rmVideoGroups(recent));
  if (!projects.length) return '';
  const chosen = projects.some(p => p.name === ui.pc.rmProject) ? ui.pc.rmProject : '';
  const chips = projects.length > 2 ? `<div class="dsv-chips" role="tablist" aria-label="Проекты">${[['', 'Все'], ...projects.map(p => [p.name, p.name])].map(([v, l]) =>
    `<button type="button" role="tab" class="dsv-chip" data-action="rm-project" data-project="${esc(v)}" aria-selected="${v === chosen}">${esc(l)}</button>`).join('')}</div>` : '';
  const shown = chosen ? projects.filter(p => p.name === chosen) : projects;
  const body = shown.map(p => `<section class="dsv-project" aria-label="Проект ${esc(p.name)}"><header class="dsv-project-head"><h3>${esc(p.name)}</h3><span>${rmPlural(p.videos.length, 'ролик', 'ролика', 'роликов')}</span></header><div class="rm-recents dsv-list">${p.videos.map(g => rmVideoCard(g, p.name)).join('')}</div></section>`).join('');
  return `<section class="dsr-videos" aria-labelledby="dsr-videos-title"><header class="dsr-videos-head"><h2 id="dsr-videos-title">Готовые ролики</h2><button type="button" class="dsr-link ${rmBusyCls('rm-clear')}" data-action="rm-clear">Очистить</button></header>${chips}${body}</section>`;
}


/* ========== «Новый рендер»: выбор сцены, композиций и параметров ==========
 * Тот же язык, что у раздела: компактные строки, одна главная кнопка внизу, кадры — на плёнке с ручками.
 * Логика постановки прежняя (rmJobForm, rmSubmitSheet, rmAction): здесь только вид шагов 1–2 и плёнка кадров. */
const rsxApp = s => s.app === 'karma' ? 'Hou' : 'AE';
const rsxName = s => String(s.name || '').replace(/\.(aep|aepx|hip|hiplc|hipnc)$/i, '');
function rsxSceneRow(x) {
  const folder = String(x.path || '').split(/[\\/]/).slice(-3, -1).join('\\');
  const n = x.targets?.length || 0;
  const facts = [n ? rmPlural(n, x.app === 'ae' ? 'композиция' : 'цель', x.app === 'ae' ? 'композиции' : 'цели', x.app === 'ae' ? 'композиций' : 'целей') : 'не прочитана', folder].filter(Boolean).join(' · ');
  return `<button type="button" class="rsx-scene" data-action="rm-scene" data-id="${esc(x.id)}" data-q="${esc((x.name + ' ' + x.path).toLowerCase())}"><span class="rsx-app ${x.app === 'ae' ? 'is-ae' : 'is-hou'}">${rsxApp(x)}</span><span class="rsx-text"><b>${esc(rsxName(x))}</b><small>${esc(facts)}</small></span><span class="rsx-chev" aria-hidden="true">›</span></button>`;
}
function rsxScenePicker(scenes) {
  if (!scenes.length) return `<p class="rsx-empty">Список сцен ещё не пришёл с компьютера. Он появится в течение 10 минут после запуска агента Flow.</p>`;
  const groups = [['Основные проекты', scenes.filter(s => s.primary && !s.cloud)], ['Недавние', scenes.filter(s => !s.primary && !s.cloud)], ['В Облаке', scenes.filter(s => s.cloud)]].filter(([, list]) => list.length);
  const search = scenes.length > 6 ? `<label class="rsx-search"><span class="sr-only">Найти сцену</span><input type="search" data-rsx-q placeholder="Найти сцену" autocomplete="off" spellcheck="false"></label>` : '';
  return search + groups.map(([title, list]) => `<section class="rsx-group"><h3>${title}</h3>${list.map(rsxSceneRow).join('')}</section>`).join('')
    + `<p class="rsx-none" hidden>Ничего не нашлось</p>`;
}
document.addEventListener('input', event => {
  if (!event.target?.matches?.('[data-rsx-q]')) return;
  const q = event.target.value.trim().toLowerCase(), root = event.target.closest('.sheet');
  let shown = 0;
  for (const row of root.querySelectorAll('.rsx-scene')) { const on = !q || row.dataset.q.includes(q); row.hidden = !on; shown += on; }
  for (const g of root.querySelectorAll('.rsx-group')) g.hidden = ![...g.querySelectorAll('.rsx-scene')].some(r => !r.hidden);
  root.querySelector('.rsx-none').hidden = shown > 0;
});
function rsxTargetFilter(scene) {
  if (scene.app !== 'ae') return '';
  const filter = rmFilter(scene);
  const seg = (mode, label) => `<button type="button" class="segment ${filter.mode === mode ? 'active' : ''}" data-action="rm-filter" data-mode="${mode}" aria-pressed="${filter.mode === mode}">${label}</button>`;
  return `<div class="segmented rm-seg rsx-filter" style="--n:3" role="group" aria-label="Какие композиции показать">${seg('queue', 'Очередь AE')}${seg('prefix', 'По префиксу')}${seg('label', 'По метке')}</div>`
    + (filter.mode === 'prefix' ? `<input class="rm-input rsx-filter-input" data-rm-filter="prefix" value="${esc(filter.prefix)}" maxlength="24" placeholder="Начало имени, например [R]" aria-label="Префикс имени">` : '')
    + (filter.mode === 'label' ? `<select class="rm-input rsx-filter-input" data-rm-filter="label_id" aria-label="Цвет метки">${Array.from({ length: 16 }, (_, i) => `<option value="${i + 1}" ${Number(filter.label_id) === i + 1 ? 'selected' : ''}>${scene.ae_labels?.[String(i + 1)] ? esc(scene.ae_labels[String(i + 1)]) : `Цвет ${i + 1}`}</option>`).join('')}</select>` : '');
}
function rsxTargetPicker(s) {
  const reading = ui.pc.rmReading?.[s.id];
  const requested = rmFilter(s), loaded = s.target_filter || { mode: 'queue', prefix: '[R]', label_id: 1 };
  const matches = s.app !== 'ae' || (requested.mode === loaded.mode && (requested.mode !== 'prefix' || requested.prefix === loaded.prefix) && (requested.mode !== 'label' || Number(requested.label_id) === Number(loaded.label_id)));
  const available = matches ? s.targets || [] : [];
  const selected = new Set(ui.sheet.selected || []), n = available.filter(t => selected.has(rmTargetKey(t))).length;
  const rows = available.map((t, i) => {
    const on = selected.has(rmTargetKey(t));
    const facts = [t.frames ? `кадры ${t.frames}` : '', t.audit?.width ? `${t.audit.width}×${t.audit.height}` : ''].filter(Boolean).join(' · ');
    return `<button type="button" class="rsx-target ${on ? 'on' : ''}" data-action="rm-select" data-i="${i}" aria-pressed="${on}"><span class="rsx-box" aria-hidden="true">${on ? pcIcon('check') : ''}</span><span class="rsx-text"><b>${esc(t.target)}</b><small>${esc(facts)}</small></span></button>`;
  }).join('');
  const read = `<button type="button" class="rsx-link ${reading ? 'is-busy' : ''}" data-action="rm-read" data-id="${esc(s.id)}" ${reading ? 'disabled' : ''}>${reading ? 'Читаю сцену…' : rows ? 'Перечитать' : 'Прочитать сцену'}</button>`;
  const empty = reading ? 'Компьютер открывает сцену без окна — 20–60 секунд.'
    : !matches ? 'Фильтр изменён — прочитайте сцену заново.'
      : `${s.cloud ? 'Сцена в Облаке. ' : ''}Компьютер откроет сцену без окна и покажет, что в ней можно рендерить.`;
  const kind = s.app === 'ae' ? 'Композиции' : 'Цели';
  return `<p class="rsx-path">${esc(s.path)}</p>${rsxTargetFilter(s)}`
    + (rows ? `<div class="rsx-list-head"><span>${kind} · ${available.length}</span>${read}</div><div class="rsx-targets">${rows}</div>`
      + `<div class="rm-foot rsx-foot"><button type="button" class="rsx-link" data-action="rm-select-all">${n === available.length ? 'Снять все' : 'Выбрать все'}</button><button type="button" class="primary-button" data-action="rm-batch-config" ${n ? '' : 'disabled'}>${n ? `Дальше · ${n}` : 'Отметьте'}</button></div>`
      : `<p class="rsx-empty">${empty}</p><div class="rm-foot rsx-foot">${reading ? '' : `<button type="button" class="primary-button rm-wide" data-action="rm-read" data-id="${esc(s.id)}">Прочитать сцену</button>`}</div>`);
}

/* Кадры новой задачи на плёнке: те же ручки, что в перерендере участка; значения — в поля data-frame-edge,
 * а они уже обновляют форму (обработчик input выше). Шкала — диапазон композиции из Render Queue. */
function rsxFrameStrip(t, frames) {
  const span = rmSpan(t.frames), cur = rmSpan(frames);
  if (!span || !cur) return '';
  const [first, last] = span, a = Math.max(first, Math.min(last, cur[0])), b = Math.max(a, Math.min(last, cur[1]));
  const pos = f => ((f - first) / Math.max(1, last - first) * 100).toFixed(3);
  return `<div class="rm-patch-strip rsx-strip" data-patch-strip data-first="${first}" data-last="${last}" style="--a:${pos(a)}%;--b:${pos(b)}%"><div class="rm-patch-film" aria-hidden="true"></div><div class="rm-patch-range" aria-hidden="true"></div>`
    + `<button type="button" class="rm-patch-handle" data-patch-handle="start" role="slider" aria-label="Первый кадр" aria-valuemin="${first}" aria-valuemax="${last}" aria-valuenow="${a}"></button>`
    + `<button type="button" class="rm-patch-handle" data-patch-handle="end" role="slider" aria-label="Последний кадр" aria-valuemin="${first}" aria-valuemax="${last}" aria-valuenow="${b}"></button></div>`;
}
function rsxStripSet(strip, edge, frame) {
  const first = Number(strip.dataset.first), last = Number(strip.dataset.last), group = strip.closest('.rm-field')?.querySelector('.rm-frame-range');
  if (!group) return;
  const sIn = group.querySelector('[data-frame-edge=start]'), eIn = group.querySelector('[data-frame-edge=end]');
  let a = Number(sIn.value), b = Number(eIn.value);
  frame = Math.round(Math.min(last, Math.max(first, frame)));
  if (edge === 'start') a = Math.min(frame, b); else b = Math.max(frame, a);
  sIn.value = a; eIn.value = b;
  const pos = f => ((f - first) / Math.max(1, last - first) * 100).toFixed(3) + '%';
  strip.style.setProperty('--a', pos(a)); strip.style.setProperty('--b', pos(b));
  strip.querySelector('[data-patch-handle=start]').setAttribute('aria-valuenow', a);
  strip.querySelector('[data-patch-handle=end]').setAttribute('aria-valuenow', b);
  sIn.dispatchEvent(new Event('input', { bubbles: true }));
}
let rsxDrag = null;
document.addEventListener('pointerdown', event => {
  const strip = event.target.closest?.('.rsx-strip'); if (!strip) return;
  const first = Number(strip.dataset.first), last = Number(strip.dataset.last);
  const at = x => { const r = strip.getBoundingClientRect(); return first + (Math.min(r.right, Math.max(r.left, x)) - r.left) / Math.max(1, r.width) * (last - first); };
  const group = strip.closest('.rm-field')?.querySelector('.rm-frame-range');
  const a = Number(group?.querySelector('[data-frame-edge=start]')?.value), b = Number(group?.querySelector('[data-frame-edge=end]')?.value), f = at(event.clientX);
  const edge = event.target.dataset?.patchHandle || (Math.abs(f - a) <= Math.abs(f - b) ? 'start' : 'end');
  rsxDrag = { strip, edge, at }; strip.setPointerCapture?.(event.pointerId); strip.classList.add('dragging');
  rsxStripSet(strip, edge, f); event.preventDefault();
});
document.addEventListener('pointermove', event => { if (rsxDrag) rsxStripSet(rsxDrag.strip, rsxDrag.edge, rsxDrag.at(event.clientX)); });
const rsxEnd = () => { if (!rsxDrag) return; rsxDrag.strip.classList.remove('dragging'); rsxDrag = null; };
document.addEventListener('pointerup', rsxEnd); document.addEventListener('pointercancel', rsxEnd);
document.addEventListener('keydown', event => {
  const strip = event.target?.closest?.('.rsx-strip'), edge = event.target?.dataset?.patchHandle; if (!strip || !edge) return;
  const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[event.key]; if (!step) return;
  event.preventDefault();
  const v = Number(event.target.getAttribute('aria-valuenow')); rsxStripSet(strip, edge, v + step * (event.shiftKey ? 10 : 1));
});
// Ввод в поля двигает ручки (поля — источник правды для формы).
document.addEventListener('input', event => {
  if (!event.target?.dataset?.frameEdge) return;
  const field = event.target.closest('.rm-field'), strip = field?.querySelector('.rsx-strip'); if (!strip) return;
  const first = Number(strip.dataset.first), last = Number(strip.dataset.last), pos = f => ((Math.min(last, Math.max(first, f)) - first) / Math.max(1, last - first) * 100).toFixed(3) + '%';
  const a = Number(field.querySelector('[data-frame-edge=start]').value), b = Number(field.querySelector('[data-frame-edge=end]').value);
  if (Number.isFinite(a)) strip.style.setProperty('--a', pos(a)); if (Number.isFinite(b)) strip.style.setProperty('--b', pos(b));
});

// Имя файла: Enter или уход из поля — сохранить и снова показать названием.
function rsxNameDone(input) {
  if (!ui.sheet?.renameOpen) return;
  const v = input.value.trim();
  if (ui.sheet.form) ui.sheet.form.output_name = v;
  ui.sheet.renameOpen = false;
  render();
}
document.addEventListener('keydown', event => {
  if (!event.target?.matches?.('[data-rsx-name]')) return;
  if (event.key === 'Enter') { event.preventDefault(); rsxNameDone(event.target); }
  if (event.key === 'Escape') { event.preventDefault(); ui.sheet.renameOpen = false; render(); }
});
document.addEventListener('focusout', event => { if (event.target?.matches?.('[data-rsx-name]')) setTimeout(() => rsxNameDone(event.target), 0); });

/** Куда ляжет рендер: папка крупно, файл и судьба после рендера — одной строкой. */
function rsxDestination(s, t, f, chosen) {
  // «D:\Render\proj\/stage/rop.[####].exr» (имя цели Karma с путём) → обычный путь Windows
  const full = String(rmWhere(s, t, f) || '').replace(/[\\/]+/g, '\\');
  const cut = full.lastIndexOf('\\');
  const file = cut > 0 ? full.slice(cut + 1) : '';
  // Пакет: файлы лягут по именам целей — показываем папку проекта, а не папку первой цели.
  const project = String(s.path || s.name).split(/[\\/]/).pop().replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*]/g, '_');
  const base = f.output_mode === 'custom' ? String(f.output_dir || '').replace(/[\\/]+$/, '') : f.output_mode === 'root' ? `${rmSettings().render_root}\\${project}` : '';
  const folder = chosen.length > 1 && base ? base : cut > 0 ? full.slice(0, cut) : full;
  const what = chosen.length > 1 ? `${rmPlural(chosen.length, 'файл', 'файла', 'файлов')} по именам композиций` : file;
  const after = { move: 'потом переедет в Облако', copy: 'копия уйдёт в Облако', none: 'останется здесь' }[f.deliver] || '';
  // По нажатию — полные пути (у пакета — каждого файла); ещё нажатие — свернуть.
  const open = Boolean(ui.sheet?.destOpen);
  const paths = chosen.length > 1
    ? chosen.map(x => String(rmWhere(s, x, rmFormFor(x, f)) || '').replace(/[\\/]+/g, '\\'))
    : [full];
  return `<button type="button" class="rsx-dest${open ? ' is-open' : ''}" data-action="rm-dest-toggle" aria-expanded="${open}" aria-label="${open ? 'Свернуть путь' : 'Показать полный путь'}"><span class="rsx-dest-ico" aria-hidden="true">${icon('folder', 'icon-sm')}</span><span class="rsx-dest-text"><b>${esc(folder || 'путь задан в сцене')}</b><small>${esc([what, after].filter(Boolean).join(' · '))}</small>${open ? `<span class="rsx-dest-full">${paths.map(p => `<code>${esc(p).replace(/\\/g, '\\<wbr>')}</code>`).join('')}</span>` : ''}</span></button>`;
}

/** Замечания задачи коротко: «не найдены исходники (2): C:\…; C:\…» → «Не найдены исходники (2)». */
function rmShortProblems(text) {
  const out = [];
  for (const part of String(text || '').split(/;\s+/)) {
    let t = part.trim();
    if (!t || /^[a-z]:[\\/]/i.test(t)) continue;                 // хвост списка путей
    t = t.replace(/:\s*[a-z]:[\\/].*$/i, '').replace(/\s*\(([^)]*[\\/][^)]*)\)\s*$/, '').trim();
    if (t.length > 110) t = t.slice(0, 107).replace(/\s+\S*$/, '') + '…';
    t = t.charAt(0).toUpperCase() + t.slice(1);
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 4);
}
