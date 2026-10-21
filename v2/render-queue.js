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
const rmJobs = () => rmQueue().jobs || [];
/** Есть ли в очереди что-то идущее или ждущее — тогда «Когда закончится» управляет очередью. */
const rmBusy = () => rmJobs().some(j => RM_ACTIVE.includes(j.status) || RM_WAITING.includes(j.status));

function rmMinutes(s) { s = Math.round(Number(s) || 0); return s >= 3600 ? `${Math.floor(s / 3600)} ч ${Math.round(s % 3600 / 60)} мин` : `${Math.max(1, Math.round(s / 60))} мин`; }
const rmBusyCls = key => ui.pc.quick?.[key] || "";

/** Идущая задача: название, процент, полоса, кадры и сколько осталось. */
function rmActiveRow(j) {
  const pct = j.status === "delivering" ? null : Math.max(0, Math.min(100, Number(j.percent) || 0));
  const facts = j.status === "delivering" ? "переношу в облако"
    : [j.total ? `кадр ${j.done || 0} из ${j.total}` : "", j.eta ? `осталось ~${rmMinutes(j.eta)}` : "", j.stage && j.stage !== "рендер" ? j.stage : ""].filter(Boolean).join(" · ");
  const bar = pct === null || (!j.done && j.stage && j.stage !== "рендер")
    ? `<div class="pc-render-bar indeterminate"><b></b></div>` : `<div class="pc-render-bar"><b style="--v:${pct}%"></b></div>`;
  return `<div class="pc-render-live rm-live"><div class="pc-render-title"><span class="pc-render-dot"></span><strong>${esc(j.name)}</strong>${pct === null ? "" : `<b class="pc-render-pct">${Math.round(pct)}%</b>`}</div>${bar}<p class="pc-render-facts">${esc(RM_APP[j.app] || j.app)}${facts ? ` · ${esc(facts)}` : ""}</p>${j.warning ? `<p class="rm-warn">${esc(j.warning)}</p>` : ""}<button type="button" class="small-button ${rmBusyCls(`rm-cancel-${j.id}`)}" data-action="rm-cancel" data-id="${j.id}" data-name="${esc(j.name)}">Отменить</button></div>`;
}

/** Ждущая задача: ручка для перетаскивания, название, кадры, отмена. */
function rmWaitingRow(j, i) {
  return `<div class="rm-wait" data-id="${j.id}" style="--i:${i}"><span class="rm-grip" aria-label="Перетащить">${"<i></i>".repeat(6)}</span><span class="rm-wait-text"><b>${esc(j.name)}</b><small>${esc([RM_APP[j.app] || j.app, j.frames ? `кадры ${j.frames}` : "", j.status === "paused" ? "на паузе" : ""].filter(Boolean).join(" · "))}</small></span><button type="button" class="icon-button rm-x ${rmBusyCls(`rm-cancel-${j.id}`)}" data-action="rm-cancel" data-id="${j.id}" data-name="${esc(j.name)}" aria-label="Убрать из очереди">${pcIcon("x")}</button></div>`;
}

/** Законченная: итог одной строкой и действие, если оно есть. */
function rmRecentRow(j) {
  const deliveryFailed = j.status === "done" && j.delivery?.status === "failed";
  const mark = j.status === "done" && !deliveryFailed ? `<span class="rm-mark ok">${pcIcon("check")}</span>`
    : j.status === "cancelled" ? `<span class="rm-mark off">${pcIcon("x")}</span>` : `<span class="rm-mark bad">${pcIcon("x")}</span>`;
  const note = j.status === "done" ? (deliveryFailed ? `в облако не ушло: ${j.delivery.error || "ошибка"}` : j.delivery?.status === "done" ? "готово, в облаке" : "готово")
    : j.status === "failed" ? (j.error || "ошибка") : `отменено${j.total ? ` на кадре ${j.done || 0} из ${j.total}` : ""}`;
  const act = (op, label) => `<button type="button" class="text-action ${rmBusyCls(`rm-${op}-${j.id}`)}" data-action="rm-${op}" data-id="${j.id}">${label}</button>`;
  const action = deliveryFailed ? act("deliver", "В облако")
    : j.status === "failed" && j.missing > 0 ? act("missing", `Дорендерить ${j.missing}`)
      : j.status === "failed" || j.status === "cancelled" ? act("retry", "Повторить") : "";
  return `<div class="rm-recent">${mark}<span class="rm-wait-text"><b>${esc(j.name)}</b><small>${esc(note)}</small></span>${action}</div>`;
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
    active.map(rmActiveRow).join(""),
    waiting.length ? `<p class="pc-find-label">Дальше${waiting.length > 1 ? " — порядок можно менять, перетаскивая за ручку" : ""}</p><div class="rm-waiting">${waiting.map(rmWaitingRow).join("")}</div>` : "",
    empty ? `<p class="section-note">Сейчас в очереди ничего нет.</p>` : "",
    recent.length ? `<p class="pc-find-label">Недавно</p><div class="rm-recents">${recent.map(rmRecentRow).join("")}</div>` : "",
  ].join("");
  return `<section class="pc-card rm-card ${active.length ? "pc-rendering" : ""}"><div class="pc-card-head"><h3>${pcIcon("film")}Очередь рендеров</h3>${empty && !q.held ? "" : hold}</div>${body}<button type="button" class="ghost-button rm-add" data-action="rm-scenes">Поставить сцену</button></section>`;
}

/** Строка на экране «Компьютер»: что с рендером сейчас, по нажатию — раздел «Рендер». */
function rmLinkRow(d) {
  const jobs = d.rmQueue?.jobs || [];
  const now = jobs.find(j => RM_ACTIVE.includes(j.status));
  const waiting = jobs.filter(j => RM_WAITING.includes(j.status)).length;
  const r = d.render || {};
  const line = now ? `${now.name} — ${Math.round(Number(now.percent) || 0)}%${waiting ? ` · ещё ${waiting} в очереди` : ""}`
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
  if ((d.rmQueue?.jobs || []).some(j => RM_ACTIVE.includes(j.status)) || d.render?.rendering) { clearTimeout(ui.pc.renderTimer); ui.pc.renderTimer = setTimeout(() => { if (pcOnPage()) pcLoad(true); }, 6000); }
  const off = !d.agent ? `<section class="pc-card"><p class="section-note">${d.on === false ? "Компьютер выключен" : "Компьютер не на связи"} — ниже последняя известная очередь. «Поставить сцену» включит его сам${d.hub ? "" : ", когда ESP32 будет на связи"}.</p></section>` : "";
  return `${top}<div class="content-grid"><div class="content-main pc-page">${off}${rmBlock(d)}${d.agent ? pcRenderBlock(d) : ""}</div></div>`;
}

// ------------------------------------------------------------ «Поставить сцену»

function renderRmScenesSheet() {
  const scenes = rmQueue().scenes || [];
  const s = ui.sheet.scene ? scenes.find(x => x.id === ui.sheet.scene) : null;
  const head = title => `<div class="sheet-handle"></div><div class="sheet-head">${s ? `<button class="icon-button" type="button" data-action="rm-scenes" aria-label="Назад">${icon("left")}</button>` : ""}<h2 id="sheet-title">${title}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div>`;
  let body;
  if (!s) {
    body = scenes.length
      ? `<div class="rm-scenes">${scenes.map(x => `<button type="button" class="pc-find-row" data-action="rm-scene" data-id="${esc(x.id)}"><span class="pc-find-ico file"><svg viewBox="0 0 24 24" aria-hidden="true">${PC_FIND_ICON.file}</svg></span><span class="pc-find-text"><b>${esc(x.name)}${x.cloud ? " ☁" : ""}</b><small>${esc([x.app === "karma" ? "Houdini" : "After Effects", x.targets?.length ? `целей: ${x.targets.length}` : "ещё не прочитана", x.cloud ? "в Облаке" : ""].filter(Boolean).join(" · "))}</small></span></button>`).join("")}</div><p class="section-note">Недавние сцены Houdini и AE, прошлые рендеры и проекты в Облаке (O:). Список обновляется раз в 10 минут, пока компьютер на связи.</p>`
      : `<p class="section-note">Список сцен с компьютера ещё не пришёл — он приходит в течение 10 минут после запуска агента Flow.</p>`;
  } else {
    const reading = ui.pc.rmReading?.[s.id];
    const targets = (s.targets || []).map((t, i) => `<button type="button" class="pc-find-row ${rmBusyCls(`rm-go-${s.id}-${i}`)}" data-action="rm-go" data-id="${esc(s.id)}" data-i="${i}"><span class="pc-find-ico app"><svg viewBox="0 0 24 24" aria-hidden="true">${PC_FIND_ICON.app}</svg></span><span class="pc-find-text"><b>${esc(t.label || t.target)}</b><small>${esc([t.frames ? `кадры ${t.frames}` : "", t.problem || ""].filter(Boolean).join(" · ") || "в очередь")}</small></span></button>`).join("");
    body = `<p class="section-note">${esc(s.path)}</p>${targets ? `<div class="rm-scenes">${targets}</div>` : `<p class="section-note">${s.cloud ? "Сцена в Облаке — " : ""}что в ней рендерить, ещё неизвестно: прочитайте сцену на компьютере.</p>`}<button type="button" class="${targets ? "ghost-button" : "primary-button"} rm-read ${reading ? "is-busy" : ""}" data-action="rm-read" data-id="${esc(s.id)}" ${reading ? "disabled" : ""}>${reading ? "Читаю сцену…" : "Прочитать сцену"}</button>${reading ? `<p class="section-note">Houdini или After Effects открывают сцену без окна — 20–60 секунд.</p>` : ""}`;
  }
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet rm-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">${head(s ? s.name : "Поставить на рендер")}${body}</section></div>`;
}

/** Прочитать цели сцены: ПК открывает её без окна, ответ кладёт в rmQueue.scenes. */
function rmRead(id) {
  const scene = (rmQueue().scenes || []).find(x => x.id === id);
  if (!scene) return;
  ui.pc.rmReading = { ...(ui.pc.rmReading || {}), [id]: true };
  render();
  const before = JSON.stringify(scene.targets || []);
  const stop = message => { delete ui.pc.rmReading[id]; if (message) toast(message); render(); };
  pcCall({ op: "send", cmd: "rm_targets", args: { path: scene.path } }).then(made => {
    if (made?.error) throw new Error(made.error);
    if (made.woke) toast("Компьютер выключен — включаю его");
    const poll = (tries = 0) => pcCall({ op: "result", id: made.id }).then(r => {
      if (r?.status === "done") {
        // Цели пишет сервер в rmQueue.scenes — забираем свежее состояние.
        pcCall({ op: "state" }).then(st => { if (st && !st.error) ui.pc.data = { ...ui.pc.data, ...st }; }).finally(() => {
          const now = (rmQueue().scenes || []).find(x => x.id === id);
          stop(JSON.stringify(now?.targets || []) === before && !now?.targets?.length ? r.result?.message || "В сцене нечего рендерить" : "");
        });
        return;
      }
      if (r?.status === "failed" || r?.status === "expired" || tries > 150) return stop(r?.result?.message || "Компьютер не прочитал сцену");
      setTimeout(() => poll(tries + 1), 2000);
    }).catch(() => setTimeout(() => poll(tries + 1), 3000));
    poll();
  }).catch(error => { const m = String(error?.message || error); stop(PC_ERRORS[m] || `Не получилось: ${m.slice(0, 60)}`); });
}

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
  if (action === "rm-cancel") {
    if (!window.confirm(`Отменить «${control.dataset.name}»? Уже записанные кадры останутся.`)) return true;
    pcQuick("rm_cancel", { id }, `rm-cancel-${id}`, r => { toast(r?.message || "Отменил"); reload(); });
    return true;
  }
  if (action === "rm-retry" || action === "rm-missing") {
    pcQuick("rm_retry", { id, missing_only: action === "rm-missing" }, `${action}-${id}`, r => { toast(r?.message || "Поставил заново"); reload(); });
    return true;
  }
  if (action === "rm-deliver") { pcQuick("rm_deliver", { id }, `rm-deliver-${id}`, r => { toast(r?.message || "Отправляю в облако"); reload(); }); return true; }
  if (action === "rm-hold") {
    const on = control.dataset.on === "1";
    pcQuick("rm_hold", { on }, "rm-hold", r => { toast(r?.message || (on ? "Очередь на паузе" : "Очередь продолжена")); ui.pc.data.rmQueue = { ...rmQueue(), held: on }; reload(); });
    return true;
  }
  if (action === "rm-scenes") { ui.sheet = { kind: "rm-scenes", justRendered: false }; render(); return true; }
  if (action === "rm-scene") { ui.sheet = { kind: "rm-scenes", scene: control.dataset.id, justRendered: false }; render(); return true; }
  if (action === "rm-read") { rmRead(control.dataset.id); return true; }
  if (action === "rm-go") {
    const scene = (rmQueue().scenes || []).find(x => x.id === control.dataset.id);
    const t = scene?.targets?.[Number(control.dataset.i)];
    if (!t) return true;
    const args = { path: scene.path, target: t.target, frames: t.frames || "", output: "", urgent: false, ...(t.rq_index ? { rq_index: t.rq_index } : {}) };
    pcQuick("rm_add", args, `rm-go-${scene.id}-${control.dataset.i}`, r => { toast(r?.message || "Поставил в очередь"); ui.sheet = null; reload(); });
    return true;
  }
  return false;
}
