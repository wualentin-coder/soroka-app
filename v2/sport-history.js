/* Sport 2.0 review, history and result editing. */
(() => {
  "use strict";

  const key = row => JSON.stringify([row.plan_exercise_id, row.set_index]);
  const fields = ["status", "actual_kg", "actual_weight_basis", "actual_units", "actual_reps", "actual_seconds", "rir", "note"];
  const statuses = { confirmed: "Записан", unconfirmed: "Не подтверждён", skipped: "Пропущен",
    missing: "Нет записи", future: "Не начат", inProgress: "В процессе" };
  const signs = { confirmed: "✓", unconfirmed: "○", skipped: "⏭", missing: "—", future: "–", inProgress: "▶" };
  const bases = { per_dumbbell: "На гантель", total: "Общий", machine: "Тренажёр", additional: "Дополнительный" };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const clock = seconds => {
    if (seconds == null) return "";
    const parts = [Math.floor(seconds / 60), String(seconds % 60).padStart(2, "0")];
    return parts.join(":");
  };
  const dateLabel = session => {
    const format = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" });
    if (session.finished_at || session.started_at) return format.format(new Date(session.finished_at || session.started_at));
    return session.workout_date ? format.format(new Date(session.workout_date + "T12:00:00")) : "";
  };
  const svg = name => typeof icon === "function" ? icon(name, "icon-sm") : "";
  const button = (action, label, cls = "ghost-button", attr = "") =>
    `<button type="button" data-sh="${action}" class="${cls}" ${attr}>${label}</button>`;
  const closeButton = label => button("close", svg("close") || "×", "sr-icon-button sr-bare", `aria-label="${label}"`);
  const result = row => Object.fromEntries(fields.map(field => [field, row?.[field] ?? (field === "status" ? "missing" : null)]));
  const equal = (a, b) => fields.every(field => a[field] === b[field]);
  const address = row => ({ plan_exercise_id: row.plan_exercise_id, set_index: row.set_index });

  function groups(snapshot, sets) {
    const byKey = new Map(sets.map(row => [key(row), row]));
    const byExercise = new Map();
    for (const block of snapshot.workout.blocks) {
      for (const exercise of block.exercises) {
        const group = { exercise, rows: [] };
        byExercise.set(exercise.plan_exercise_id, group);
        for (let n = 1; n <= exercise.sets; n++) {
          const slot = { plan_exercise_id: exercise.plan_exercise_id, set_index: n };
          const stored = byKey.get(key(slot));
          group.rows.push({ slot, stored });
          byKey.delete(key(slot));
        }
      }
    }
    for (const stored of byKey.values()) {
      const exerciseId = stored.plan_exercise_id;
      if (!byExercise.has(exerciseId)) byExercise.set(exerciseId, {
        exercise: { name: stored.performed_name || "Упражнение", mode: "manual" }, rows: [],
      });
      byExercise.get(exerciseId).rows.push({ slot: address(stored), stored });
    }
    return [...byExercise.values()];
  }

  function planLabel(exercise) {
    const { load } = exercise;
    return [exercise.sets ? `${exercise.sets} × ${exercise.mode === "timed" ? clock(exercise.work_seconds) || "—" : exercise.reps || exercise.target || "—"}` : "",
      load ? `${load.units ? load.units + "×" : ""}${load.kg} кг${load.basis === "per_dumbbell" && !load.units ? " / гантель" : ""}` : ""]
      .filter(Boolean).join(" · ");
  }

  function factLabel(row) {
    return [row.actual_kg != null ? `${row.actual_units ? row.actual_units + "×" : ""}${row.actual_kg} кг${row.actual_weight_basis === "per_dumbbell" && !row.actual_units ? " / гантель" : ""}` : "",
      row.actual_reps != null ? `×${row.actual_reps}` : "", clock(row.actual_seconds),
      row.rir != null ? `Запас ${row.rir === 3 ? "3+" : row.rir}` : ""].filter(Boolean).join(" · ");
  }

  function preview(snapshot, sets, seconds, active) {
    const items = groups(snapshot, sets);
    const counts = { confirmed: 0, unconfirmed: 0, skipped: 0, missing: 0, future: 0, inProgress: 0 };
    const statusOf = ({ slot, stored }) => {
      if (key(slot) === active?.openSet) return "inProgress";
      return stored?.status ?? (active && !active.hasPending ? "future" : "missing");
    };
    let first = null;
    for (const { rows } of items) for (const entry of rows) {
      const status = statusOf(entry);
      counts[status]++;
      if (!first && (status === "missing" || status === "future" || status === "unconfirmed")) first = key(entry.slot);
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const count = (status, label) => counts[status]
      ? `<span data-sh-status="${status}"><span aria-hidden="true">${signs[status]}</span> ${counts[status]} ${label}</span>` : "";
const summary = `<div class="sh-summary"><div class="sh-f-metrics">
      ${seconds == null ? "" : `<div class="sh-f-metric" aria-label="Длительность ${clock(seconds)}"><b>${clock(seconds)}</b><small>Время</small></div>`}
      <div class="sh-f-metric" aria-label="Записано ${counts.confirmed} из ${total}"><b>${counts.confirmed}<small>/${total}</small></b><small>Подходов записано</small></div></div>
      <div class="sh-f-status-counts">${count("inProgress", "в процессе")}${count("unconfirmed", "не подтверждено")}${count("future", "не начато")}
      ${count("missing", "без записи")}${count("skipped", "пропущено")}</div></div>`;
    const list = items.map(({ exercise, rows }) => `<section class="sh-group">
      <header><strong>${esc(exercise.name)}</strong>${planLabel(exercise) ? `<small>План · ${esc(planLabel(exercise))}</small>` : ""}</header>
      <ol>${rows.map(entry => {
        const { slot, stored } = entry;
        const status = statusOf(entry);
        const row = result(stored);
        return `<li data-sh-status="${status}" title="${statuses[status]}" aria-label="Подход ${slot.set_index}. ${statuses[status]}${status === "confirmed" ? ". " + esc(factLabel(row)) : ""}${row.note ? ". " + esc(row.note) : ""}">
          <small>${slot.set_index}</small><span aria-hidden="true">${signs[status]}</span>
          ${status === "confirmed" ? esc(factLabel(row)) : ""}${row.note ? `<small class="sh-note">${esc(row.note)}</small>` : ""}</li>`;
      }).join("")}</ol></section>`).join("");
    return { first, summary, list: list ? `<div class="sh-preview-list">${list}</div>` : "" };
  }

  function dialog(label, trigger) {
    const box = document.createElement("dialog");
    box.className = "sport-run sport-history";
    box.setAttribute("aria-label", label);
    box.tabIndex = -1;
    document.body.append(box);
    box.addEventListener("close", () => {
      box.remove();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    }, { once: true });
    box.showModal();
    box.focus({ preventScroll: true });
    return box;
  }

  const head = title => `<header class="sh-head">${closeButton("Назад")}<h2>${esc(title)}</h2></header>`;
  const foot = (left, right) => `<footer class="sr-foot sh-foot">${left}${right}</footer>`;
  const problem = reason => ({
    invalid_result: "Проверьте значения подходов.",
    invalid_event: "Проверьте значения подходов.",
    measurement_required: "Введите вес, повторы или время.",
    confirmation_required: "Подтвердите введённые измерения.",
    weight_required: "Введите вес.",
    stale_results_revision: "Есть более новая правка.",
    stale_active_result: "Подход изменился в другой вкладке.",
    invalid_transition: "Состояние тренировки изменилось.",
    session_closed: "Тренировка уже завершена.",
    local_storage: "Не удалось сохранить на устройстве.",
    sport_owner_changed: "Сменился аккаунт.",
    edit_already_pending: "Уже есть правка к отправке. Откройте тренировку заново.",
    editor_draft_changed: "В другой вкладке есть черновик. Этот ввод пока в открытом окне.",
  })[reason.message] || "Нет связи. Повторите.";

  function editor({ snapshot, sets, session, openSet, target, trigger, owner, save, reload, recovered, refresh, localDraft }) {
    const box = dialog("Правка тренировки", trigger);
    if (!recovered?.args && !recovered?.conflict) recovered = localDraft?.saved ?? recovered;
    const items = groups(snapshot, sets);
    let baseline = new Map(sets.map(row => [key(row), result(row)]));
    const drafts = new Map(recovered?.drafts ?? []);
    let pending = recovered?.args ?? null;
    let revision = recovered?.revision ?? session?.results_revision;
    let busy = false, closing = false;
    let conflict = !!recovered?.conflict || !!(session && !pending && revision !== session.results_revision);
    let localError = "";
    let localWrite = Promise.resolve();
    let message = conflict ? "Есть более новая правка." : pending ? "Правка ожидает отправки." : "";
    const opened = new Set(target ? [target] : []);
    if (recovered) for (const id of drafts.keys()) opened.add(id);
    const before = id => baseline.get(id) ?? result(null);
    for (const [id, row] of recovered?.baseline ?? []) baseline.set(id, row);
    const storageDraft = () => ({ args: pending, drafts: [...drafts], baseline: [...drafts.keys()].map(id => [id, before(id)]),
      revision: revision ?? null, conflict });
    function keepDraft(state) {
      if (!localDraft) return Promise.resolve();
      const write = localWrite.then(() => localDraft.write(state));
      localWrite = write.catch(() => {});
      return write;
    }
    function reportLocal(error) {
      localError = error ? problem(error) : "";
      const banner = box.querySelector("[data-sh-local]");
      if (!banner) return;
      banner.hidden = !localError;
      banner.textContent = localError;
    }

    function numeric(name, label, value, max, integer = true, min = 1) {
      return `<label><em>${label}</em><input name="${name}" type="number" min="${min}" max="${max}"
        inputmode="${integer ? "numeric" : "decimal"}" step="${integer ? "1" : "any"}" value="${esc(value)}" placeholder="—"></label>`;
    }
    function expanded(exercise, row) {
      const timed = exercise.mode === "timed";
      const weighted = exercise.bodyweight !== true || row.actual_kg != null;
      const options = (labels, selected) => Object.entries(labels).map(([value, label]) =>
        `<option value="${value}" ${String(selected) === value ? "selected" : ""}>${label}</option>`).join("");
      const basis = row.actual_weight_basis ?? exercise.load?.basis ?? "";
      return `<div class="sh-fields">
        <div class="sh-statuses" role="group" aria-label="Статус подхода">${["confirmed", "unconfirmed", "skipped"].map(status =>
          button("status", signs[status], "ghost-button", `data-value="${status}" aria-label="${statuses[status]}" aria-pressed="${row.status === status}"`)).join("")}</div>
        ${weighted ? `<div class="sh-metrics sh-weight">
          <label class="sh-basis"><em>Учёт веса</em><select name="actual_weight_basis">${options({ "": "—", ...bases }, basis)}</select></label>
          ${numeric("actual_kg", "Вес, кг", row.actual_kg, 2000, false, 0)}
          ${basis === "per_dumbbell" ? `<label><em>Гантели</em><select name="actual_units">${options({ "": "—", 1: "1", 2: "2" }, row.actual_units ?? "")}</select></label>` : ""}</div>` : ""}
        <div class="sh-metrics">
          ${!timed || row.actual_reps != null ? numeric("actual_reps", "Повторы", row.actual_reps, 1000) : ""}
          ${exercise.mode !== "reps" || row.actual_seconds != null ? numeric("actual_seconds", "Время, с", row.actual_seconds, 86400) : ""}
          ${!timed || row.rir != null ? `<label><em>Запас</em><select name="rir">${options({ "": "—", 0: "0", 1: "1", 2: "2", 3: "3+" }, row.rir ?? "")}</select></label>` : ""}
        </div>
        <label><em>Заметка</em><textarea name="note" maxlength="1000" rows="2">${esc(row.note)}</textarea></label></div>`;
    }
    function render() {
      const top = box.scrollTop;
      const banner = message ? `<div class="sh-message" role="status">${esc(message)}
        ${conflict ? button("rebase", "Обновить основу", "ghost-button", busy ? "disabled" : "") : ""}</div>` : "";
      box.innerHTML = `<section class="sr-screen">${head("Правка тренировки")}
        <div class="sh-content"><h3>${esc(snapshot.workout.title)}</h3>
          ${session ? `<p class="sh-muted">${esc([dateLabel(session), clock(session.elapsed_seconds)].filter(Boolean).join(" · "))}</p>` : ""}
          ${banner}<p class="sh-message" data-sh-local role="status" ${localError ? "" : "hidden"}>${esc(localError)}</p>
          ${items.map(({ exercise, rows }) => `<section class="sh-group"><header><strong>${esc(exercise.name)}</strong>
            ${planLabel(exercise) ? `<small>План · ${esc(planLabel(exercise))}</small>` : ""}</header>
            ${rows.map(({ slot }) => {
              const id = key(slot), current = drafts.get(id) ?? before(id);
              const locked = id === openSet;
              return `<details class="sh-set" data-set="${esc(id)}" ${opened.has(id) && !locked ? "open" : ""}>
                <summary aria-disabled="${locked}"><small>${slot.set_index}</small>
                  <span data-sh-status="${current.status}" aria-label="${locked ? "Текущий подход" : statuses[current.status]}">${signs[current.status]}</span>
                  <span data-sh-fact>${locked ? "Текущий подход" : esc(factLabel(current))}</span><span class="sh-chevron">${svg("right")}</span></summary>
                ${locked ? "" : `<fieldset ${busy || pending || conflict ? "disabled" : ""}>${expanded(exercise, current)}</fieldset>`}</details>`;
            }).join("")}</section>`).join("") || '<p class="sh-muted">Подходов нет</p>'}</div>
        ${foot(button(pending || conflict ? "close" : "discard", pending || conflict ? "Закрыть" : "Отмена",
          "ghost-button", busy ? "disabled" : ""),
          button("save", busy ? "Сохраняем…" : pending ? "Повторить" : session ? "Сохранить" : "Применить", "primary-button",
            busy || conflict || (!drafts.size && !pending) ? "disabled" : ""))}</section>`;
      box.scrollTop = top;
    }
    const dialogError = error => { message = problem(error); };
    function edit(section, name, value) {
      const id = section.dataset.set;
      const row = { ...(drafts.get(id) ?? before(id)), [name]: value };
      if (name === "status" && value !== "confirmed") {
        for (const field of fields.slice(1, -1)) row[field] = null;
      } else if (name === "actual_kg" && value == null) {
        row.actual_weight_basis = row.actual_units = null;
      } else if (name === "actual_kg" && row.actual_weight_basis == null) {
        row.actual_weight_basis = section.querySelector('[name="actual_weight_basis"]')?.value || null;
      } else if (name === "actual_weight_basis" && value !== "per_dumbbell") row.actual_units = null;
      if (equal(row, before(id))) drafts.delete(id);
      else drafts.set(id, row);
      const fact = section.querySelector("[data-sh-fact]");
      fact.textContent = factLabel(row);
      const submit = box.querySelector('[data-sh="save"]');
      submit.disabled = !drafts.size;
      keepDraft(drafts.size ? storageDraft() : null).then(() => reportLocal(null), reportLocal);
    }
    function changes() {
      return [...drafts].map(([id, row]) => {
        const [plan_exercise_id, set_index] = JSON.parse(id);
        const edited = { ...row, status: row.status === "missing" ? "unconfirmed" : row.status };
        const measured = edited.actual_kg != null || edited.actual_reps != null || edited.actual_seconds != null;
        if (edited.status === "confirmed" && !measured) throw Error("measurement_required");
        if (edited.status !== "confirmed" && (measured || edited.rir != null)) throw Error("confirmation_required");
        if (edited.actual_kg == null && (edited.actual_weight_basis != null || edited.actual_units != null)) throw Error("weight_required");
        return { plan_exercise_id, set_index, ...edited };
      });
    }
    async function rebase() {
      const latest = await reload();
      const next = new Map(latest.sets.map(row => [key(row), result(row)]));
      for (const [id, draft] of drafts) {
        const current = next.get(id) ?? result(null);
        const merged = { ...current };
        for (const field of fields) if (draft[field] !== before(id)[field]) merged[field] = draft[field];
        if (draft.status !== before(id).status && draft.status !== "confirmed") {
          for (const field of fields.slice(1, -1)) merged[field] = null;
        }
        if (merged.actual_kg == null) merged.actual_weight_basis = merged.actual_units = null;
        if (merged.actual_weight_basis !== "per_dumbbell") merged.actual_units = null;
        if (equal(merged, current)) drafts.delete(id);
        else drafts.set(id, merged);
      }
      baseline = next;
      revision = latest.revision;
      pending = null;
      conflict = false;
      message = drafts.size ? "Основа обновлена. Проверьте правку." : "Без изменений";
      await keepDraft(drafts.size ? storageDraft() : null);
      await refresh?.(null);
    }
    async function submit() {
      if (!owner.current()) throw Error("sport_owner_changed");
      return save({
        changes: pending ? null : changes(), baseline, revision, pending,
        persist: async (args, conflicted = false) => {
          const prior = pending?.event.id;
          pending = args;
          conflict = conflicted;
          await refresh?.(args || conflicted ? storageDraft() : null, prior);
        },
      });
    }
    box.addEventListener("toggle", event => {
      if (event.target.matches(".sh-set")) {
        if (event.target.open) opened.add(event.target.dataset.set);
        else opened.delete(event.target.dataset.set);
      }
    }, true);
    box.addEventListener("input", event => {
      const input = event.target;
      const section = input.closest(".sh-set");
      if (!section || !input.name || input.matches("select")) return;
      const numericInput = input.type === "number";
      edit(section, input.name, numericInput ? input.value === "" ? null : input.valueAsNumber : input.value || null);
    });
    box.addEventListener("change", event => {
      const input = event.target;
      if (!input.matches("select")) return;
      edit(input.closest(".sh-set"), input.name, input.value === "" ? null : input.name === "actual_weight_basis" ? input.value : Number(input.value));
      if (input.name === "actual_weight_basis") {
        render();
        [...box.querySelectorAll(".sh-set")].find(row => row.dataset.set === input.closest(".sh-set").dataset.set)
          ?.querySelector('[name="actual_weight_basis"]')?.focus({ preventScroll: true });
      }
    });
    async function close(discard = false) {
      if (busy) return;
      busy = true;
      try {
        if (discard) await keepDraft(null);
        else await localWrite;
        closing = true;
        box.close();
      } catch (error) { dialogError(error); }
      finally { busy = false; if (!closing) render(); }
    }
    box.addEventListener("cancel", event => { event.preventDefault(); close(); });
    box.addEventListener("click", async event => {
      if (event.target.closest('summary[aria-disabled="true"]')) { event.preventDefault(); return; }
      const control = event.target.closest("[data-sh]");
      if (!control || busy) return;
      const action = control.dataset.sh;
      if (action === "close" || action === "discard") { await close(action === "discard"); return; }
      if (action === "status") {
        const section = control.closest(".sh-set");
        const value = control.dataset.value;
        edit(section, "status", value);
        render();
        [...box.querySelectorAll(".sh-set")].find(row => row.dataset.set === section.dataset.set)
          ?.querySelector(`[data-value="${value}"]`)?.focus({ preventScroll: true });
        return;
      }
      if (action !== "save" && action !== "rebase") return;
      if (action === "save" && !pending && [...box.querySelectorAll("input")].some(input => !input.validity.valid)) {
        message = "Проверьте значения подходов.";
        render();
        return;
      }
      busy = true;
      render();
      try {
        if (action === "rebase") await rebase();
        else {
          await submit();
          await keepDraft(null).catch(() => {});
          closing = true;
          box.close();
        }
      } catch (error) {
        if (error.message === "stale_active_result") conflict = true;
        dialogError(error);
      } finally {
        busy = false;
        if (!closing) render();
      }
    });
    render();
    const focus = [...box.querySelectorAll(".sh-set")].find(node => node.dataset.set === target);
    if (focus) {
      focus.scrollIntoView({ block: "center" });
      focus.querySelector("summary")?.focus({ preventScroll: true });
    }
  }

  let surface;
  const request = (op, args) => window.SportRunReview.request(op, args);
  function list() {
    queueMicrotask(() => load());
    return '<section class="sp-block sh-history-feed" data-sh-feed aria-label="История"><p role="status">Загрузка…</p></section>';
  }

  const DAY_MS = 86400000;
  const shortDay = value => value ? new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" })
    .format(new Date(value + "T12:00:00")) : "";
  const oneDecimal = value => Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");

  function sessionSummary(detail) {
    const { session, projection } = detail;
    const rows = new Map(projection.sets.map(row => [key(row), row]));
    const facts = [];
    let total = 0;
    for (const block of session.plan_snapshot.workout.blocks) {
      for (const exercise of block.exercises) {
        total += exercise.sets;
        for (let n = 1; n <= exercise.sets; n++) {
          const row = rows.get(JSON.stringify([exercise.plan_exercise_id, n]));
          if (!row || row.status !== "confirmed") continue;
          if (row.actual_kg != null && row.actual_reps != null) {
            const units = row.actual_units ?? exercise.load?.units ?? 1;
            facts.push({ date: session.workout_date, name: exercise.name, kg: row.actual_kg, reps: row.actual_reps,
              units, volume: row.actual_kg * units * row.actual_reps, seconds: row.actual_seconds });
          } else if (row.actual_seconds != null) {
            facts.push({ date: session.workout_date, name: exercise.name, kg: null, reps: null, units: 1, volume: 0, seconds: row.actual_seconds });
          }
        }
      }
    }
    return { session, facts, confirmed: projection.sets.filter(row => row.status === "confirmed").length, total };
  }

  function aggregate(details) {
    const facts = details.flatMap(item => item.facts);
    const weighted = facts.filter(item => item.kg != null && item.reps != null);
    const map = new Map();
    for (const fact of weighted) {
      const item = map.get(fact.name) ?? { name: fact.name, points: new Map(), volume: 0 };
      const point = item.points.get(fact.date) ?? { date: fact.date, kg: 0, reps: 0, units: 1, volume: 0 };
      point.kg = Math.max(point.kg, fact.kg);
      point.reps = Math.max(point.reps, fact.reps);
      point.units = fact.units;
      point.volume += fact.volume;
      item.points.set(fact.date, point);
      item.volume += fact.volume;
      map.set(fact.name, item);
    }
    const list = [...map.values()].map(item => ({
      ...item, series: [...item.points.values()].sort((a, b) => a.date.localeCompare(b.date)),
    })).filter(item => item.series.length)
      .sort((a, b) => b.series.length - a.series.length || b.volume - a.volume);
    return { facts, weighted, list };
  }

  function plateauOf(list) {
    for (const item of list) {
      if (item.series.length < 4) continue;
      const result = window.SportCore?.exercisePlateau?.(item.series.map(point => ({
        date: point.date, status: "confirmed", kg: point.kg, reps: point.reps, seconds: null,
      })));
      if (!result?.plateau) continue;
      const series = item.series;
      const lastKg = series.at(-1).kg;
      let start = series.length - 1;
      while (start > 0 && Math.abs(series[start - 1].kg - lastKg) <= 0.001) start--;
      const points = series.slice(start);
      const weeks = Math.max(1, Math.round((Date.parse(series.at(-1).date) - Date.parse(series[start].date)) / (7 * DAY_MS)));
      return { item, result, weeks, points };
    }
    return null;
  }

  function chartSvg(item, metric) {
    const series = item.series.slice(-8);
    const values = series.map(point => metric === "volume" ? point.volume : point.kg);
    const width = 320, height = 154, left = 8, right = 10, top = 14, bottom = 30;
    const min = Math.min(...values), max = Math.max(...values);
    const span = max - min || Math.max(1, max * .12);
    const low = min - span * .18, high = max + span * .18;
    const dates = series.map(point => Date.parse(point.date + "T12:00:00"));
    const first = Math.min(...dates), last = Math.max(...dates);
    const x = date => left + (last === first ? (width - left - right) / 2 : (date - first) / (last - first) * (width - left - right));
    const y = value => top + (high - value) / (high - low) * (height - top - bottom);
    const grid = [0, .5, 1].map(step => {
      const value = high - (high - low) * step;
      const at = y(value);
      return `<line x1="${left}" x2="${width - right}" y1="${at.toFixed(1)}" y2="${at.toFixed(1)}" class="sh-grid-line"/>
        <text x="${left}" y="${(at - 3).toFixed(1)}" class="sh-axis">${Math.round(value)}</text>`;
    }).join("");
    const dots = series.map((point, index) => `<circle cx="${x(dates[index]).toFixed(1)}" cy="${y(values[index]).toFixed(1)}" r="4" class="sh-dot"/>`).join("");
    const line = series.length > 1
      ? `<polyline points="${series.map((point, index) => `${x(dates[index]).toFixed(1)},${y(values[index]).toFixed(1)}`).join(" ")}" class="sh-line"/>` : "";
    const label = `<text x="${x(dates.at(-1)).toFixed(1)}" y="${(y(values.at(-1)) - 10).toFixed(1)}" class="sh-last" text-anchor="middle">${Math.round(values.at(-1))}</text>`;
    const xLabels = series.length > 1
      ? `<text x="${left}" y="${height - 8}" class="sh-axis">${esc(shortDay(series[0].date))}</text>
         <text x="${width - right}" y="${height - 8}" class="sh-axis" text-anchor="end">${esc(shortDay(series.at(-1).date))}</text>` : "";
    return `<svg class="sh-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(item.name)}: ${metric === "kg" ? "вес" : "объём"}">
      ${grid}<line x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}" class="sh-axis-line"/>
      ${line}${dots}${label}${xLabels}</svg>`;
  }

  function paintFeed() {
    const mount = document.querySelector("[data-sh-feed]");
    if (!mount || !surface?.owner.current()) return;
    const { sessions, error, cursor, busy, details } = surface;
    const summaries = sessions.map(session => details.get(session.id)).filter(Boolean).map(sessionSummary);
    const all = aggregate(summaries);
    const weighted = all.weighted;
    const record = weighted.slice().sort((a, b) => b.kg - a.kg || b.reps - a.reps || b.date.localeCompare(a.date))[0];
    const recent = summaries.filter(item => {
      const at = Date.parse(item.session.workout_date + "T12:00:00");
      return Number.isFinite(at) && at >= Date.now() - 28 * DAY_MS;
    });
    const frequency = recent.length / 4;
    const plateau = plateauOf(all.list);
    const top = plateau?.item || all.list[0];
    const improvement = top && top.series.length > 1 ? top.series.at(-1).kg - top.series[0].kg : 0;
    const version = summaries.reduce((best, item) => Math.max(best, item.session.plan_version || 0), 0);
    const verdict = plateau
      ? `<b>${esc(plateau.item.name)} стоит ${plateau.weeks} нед.</b><span>по ${summaries.length} подтверждённым тренировкам</span>`
      : improvement > 0
        ? `<b>${esc(top.name)} +${oneDecimal(improvement)} кг</b><span>по ${summaries.length} подтверждённым тренировкам</span>`
        : `<b>${summaries.length === 1 ? "Одна тренировка" : `${summaries.length} тренировки`}</b><span>вывод появится после следующих</span>`;
    const recordTile = record
      ? `<div class="sh-tile"><span>Рекорд</span><b>${record.units > 1 ? `${record.units}×` : ""}${oneDecimal(record.kg)} кг</b><small>${esc(record.name)} · ${record.reps} · ${shortDay(record.date)}</small></div>` : "";
    const frequencyTile = summaries.length
      ? `<div class="sh-tile"><span>Частота</span><b>${oneDecimal(frequency)}</b><small>в неделю · 4 нед.${recent.length < 2 ? " · мало данных" : ""}</small></div>` : "";
    const metric = surface.metric === "volume" ? "volume" : "kg";
    const chart = top
      ? `<section class="sh-chart-card" aria-label="Динамика">
          <div class="sh-chart-head"><div><b>${esc(top.name)}</b><span>${metric === "volume" ? "объём, кг" : "вес, кг"}</span></div>
            <div class="sh-seg" role="group" aria-label="Показатель"><button type="button" data-action="sp-history-metric" data-metric="kg" aria-pressed="${metric === "kg"}">Вес</button><button type="button" data-action="sp-history-metric" data-metric="volume" aria-pressed="${metric === "volume"}">Объём</button></div></div>
          ${chartSvg(top, metric)}
          <p class="sh-chart-note">${top.series.length > 1 ? "Только подтверждённые подходы" : `Ещё ${2 - top.series.length} тренировки до линии`}</p>
          ${plateau ? `<details class="sh-plateau"><summary>Плато · ${plateau.weeks} нед.</summary><div><p>${plateau.item.series.slice(-3).map(point => `${esc(shortDay(point.date))} — ${oneDecimal(point.kg)} кг × ${point.reps}`).join(" · ")}</p><p class="sh-muted">Наблюдение, не диагноз.</p></div></details>` : ""}
        </section>` : "";
    const stats = summaries.length
      ? `<section class="sh-stats"><p class="sh-verdict">${verdict}</p><div class="sh-tiles">${recordTile}${frequencyTile}</div>${chart}</section>
        ${version ? `<p class="sh-plan-row"><span>План · v${version}</span><span>снимок тренировки</span></p>` : ""}` : "";
    mount.innerHTML = `${stats}<h2>Тренировки</h2>${sessions.length ? `<div class="sh-history-list">${sessions.map(session => {
      const summary = details.get(session.id);
      return `<button type="button" class="sh-history-row" data-action="sp-session-detail" data-id="${esc(session.id)}"><span><strong>${esc(session.title || "Тренировка")}</strong>
      <small>${esc(dateLabel(session))}${summary ? ` · ${summary.confirmed}/${summary.total} подходов` : ""}${session.difficulty != null ? ` · сложность ${session.difficulty}/10` : ""}</small></span><span>${clock(session.elapsed_seconds)}
      ${session.results_revision > 1 ? `<small>Правка · ${session.results_revision}</small>` : ""}</span>${svg("right")}</button>`;
    }).join("")}</div>` : ""}
      ${error ? `<p role="alert">${esc(error)}</p><button type="button" class="ghost-button" data-action="sp-session-more">Повторить</button>`
        : busy ? '<p role="status">Загрузка…</p>' : !sessions.length ? '<p>Тренировок нет</p>' : ""}
      ${cursor && !busy && !error ? '<button type="button" class="ghost-button" data-action="sp-session-more">Ещё</button>' : ""}`;
  }
  async function load({ more = false, reset = false } = {}) {
    if (!document.querySelector("[data-sh-feed]")) return;
    const owner = window.SportRunReview.owner();
    if (!owner) {
      document.querySelector("[data-sh-feed]").textContent = "Откройте Flow в своём аккаунте.";
      return;
    }
    if (reset || !surface?.owner.current()) surface = {
      owner, sessions: [], details: new Map(), cursor: null, ready: false, busy: false, error: "", metric: "kg",
    };
    const state = surface;
    if (state.busy || state.ready && !more) { paintFeed(); return; }
    state.busy = true;
    state.error = "";
    paintFeed();
    try {
      const reply = await request("list_sessions", { after: state.cursor, limit: 20 });
      if (!state.owner.current() || surface !== state) return;
      const seen = new Set(state.sessions.map(session => session.id));
      state.sessions.push(...reply.sessions.filter(session => !seen.has(session.id)));
      state.cursor = reply.next_cursor;
      state.ready = true;
      const pending = state.sessions.filter(session => !state.details.has(session.id)).slice(0, 20);
      if (pending.length) {
        const replies = await Promise.all(pending.map(async session => {
          try { return [session.id, await request("read_session", { session_id: session.id })]; }
          catch { return [session.id, null]; }
        }));
        if (!state.owner.current() || surface !== state) return;
        for (const [id, detail] of replies) {
          if (detail?.session && detail?.projection?.sets) state.details.set(id, detail);
        }
      }
    } catch (error) { state.error = problem(error); state.ready = true; }
    finally { state.busy = false; if (surface === state) paintFeed(); }
  }

  async function open(sessionId, trigger) {
    const owner = window.SportRunReview.owner();
    if (!owner) return;
    const box = dialog("Завершённая тренировка", trigger);
    const read = () => request("read_session", { session_id: sessionId });
    let shown;
    function paint() {
      const { session, projection } = shown;
      const info = preview(session.plan_snapshot, projection.sets, session.elapsed_seconds);
      box.innerHTML = `<section class="sr-screen">${head("Тренировка")}<div class="sh-content">
        <h3>${esc(session.plan_snapshot.workout.title)}</h3><p class="sh-muted">${esc(dateLabel(session))}
        ${session.results_revision > 1 ? ` · Правка · ревизия ${session.results_revision}` : ""}
        ${session.difficulty != null ? ` · Сложность ${session.difficulty}/10` : ""}</p>
        ${info.summary}${window.SportCoach?.slot(session.id) || ""}${info.list || '<p class="sh-muted">Подходов нет</p>'}</div>
        ${foot("", button("edit", info.first ? "Дополнить" : "Изменить", "primary-button"))}</section>`;
    }
    function refresh() {
      return load({ reset: true }).then(() => {
        // A tab opened later always reads fresh summaries.
        if (!document.querySelector("[data-sh-feed]")) surface = null;
      });
    }
    async function reload() {
      const reply = await read();
      if (!owner.current()) throw Error("sport_owner_changed");
      if (reply.session.status !== "completed") throw Error("invalid_transition");
      shown = reply;
      return { sets: reply.projection.sets, revision: reply.session.results_revision };
    }
    async function show() {
      box.innerHTML = `<section class="sr-screen">${head("Тренировка")}<div class="sh-content"><p role="status">Загрузка…</p></div></section>`;
      try { await reload(); if (box.open) paint(); }
      catch (error) {
        if (box.open) box.querySelector(".sh-content").innerHTML =
          `<p role="alert">${esc(problem(error))}</p>${button("read", "Повторить")}`;
      }
    }
    box.addEventListener("click", async event => {
      const control = event.target.closest("[data-sh]");
      if (!control) return;
      if (control.dataset.sh === "close") box.close();
      if (control.dataset.sh === "read") await show();
      if (control.dataset.sh !== "edit" || !shown || !owner.current()) return;
      const { session, projection } = shown;
      const runner = window.SportRunReview.acquire();
      if (!runner) return;
      editor({ snapshot: session.plan_snapshot, sets: projection.sets, session, owner, reload,
        target: preview(session.plan_snapshot, projection.sets).first, trigger: control,
        localDraft: runner.editorDraft(sessionId, "closed"),
        recovered: runner.getEdit(sessionId), refresh: (draft, expected) => runner.storeEdit(sessionId, draft, expected),
        save: async edit => {
          const receipt = await runner.saveEdit(sessionId, edit);
          if (!owner.current()) return;
          if (receipt?.session && receipt.projection.revision === receipt.session.results_revision) shown = receipt;
          else await reload().catch(() => null);
          window.SportCoach?.invalidate(sessionId);
          if (box.open) paint();
          await refresh();
          if (typeof toast === "function") toast(receipt ? "Сохранено" : "Без изменений");
        },
      });
    });
    await show();
  }

  window.SportHistory = { list, preview, editor, open, result, equal, invalidate: () => { surface = null; },
    stats: { sessionSummary, aggregate, plateauOf } };
  Object.assign(SP_ACTIONS, {
    "sp-session-detail": trigger => open(trigger.dataset.id, trigger),
    "sp-session-more": () => load({ more: true }),
    "sp-history-metric": control => {
      if (!surface) return;
      surface.metric = control.dataset.metric === "volume" ? "volume" : "kg";
      paintFeed();
    },
  });
})();
