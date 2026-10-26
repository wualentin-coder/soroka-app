/*
 * «Спорт» — то, чего не было в WooSport: свободная тренировка без программы,
 * замена упражнения в плане, рекорды, сводка недели, прогресс программы и
 * ближайшие занятия. Всё считается из того же состояния; варианты занятий
 * (WorkoutOption) строятся так же, как у программ, поэтому отметка подходов,
 * таймеры, завершение, история и экспорт для ИИ работают с ними без отдельного кода.
 *
 * state.freeWorkouts — занятия, заведённые вручную: { date, title, exercises[] };
 * ключ варианта `free|<id>`, упражнения с id `e1…`, подходы в programChecks.
 * state.exerciseSwaps — замены: `<ключ занятия>|<id упражнения>` (одно занятие)
 * или `<ключ программы>|name:<нормализованное название>` (вся программа).
 */

/** Свободные тренировки как варианты занятий. */
function spFreeOptions(state) {
  return Object.entries(state.freeWorkouts || {}).filter(([, w]) => !w.deleted).map(([id, w]) => ({
    key: `free|${id}`, date: w.date, kind: "main", programTitle: "Свободная тренировка", legacy: false, addedAt: w.createdAt,
    plan: { day_number: 0, routine_type: "main", title: w.title || "Свободная тренировка", focus: "", exercises: (w.exercises || []).map((e, i) => spFreeExercise(e, i)) },
  }));
}
function spFreeExercise(e, i) {
  const sets = Math.max(1, Number(e.sets) || 1);
  const timed = Number(e.seconds) > 0;
  return { id: `e${i + 1}`, name: e.name, sets, mode: timed ? "timed" : "reps", sets_reps: timed ? `${sets} × ${e.seconds} сек` : `${sets} × ${e.reps || "10"}`, hold: timed ? Number(e.seconds) : 0, rest: Number(e.rest ?? 90), technique: e.technique || "", bodyweight: e.bodyweight };
}

/** Замены упражнений поверх плана. Id упражнения не меняется — отмеченные подходы остаются. */
function spApplySwaps(options, state) {
  const swaps = state.exerciseSwaps || {};
  if (!Object.keys(swaps).length) return options;
  const C = SP();
  return options.map(option => {
    const program = C.optionProgramKey(option);
    let changed = false;
    const exercises = option.plan.exercises.map((e, i) => {
      const id = e.id ?? String(i);
      const swap = swaps[`${option.key}|${id}`] || swaps[`${program}|name:${C.exerciseKey(e.name)}`];
      if (!swap) return e;
      changed = true;
      return { ...e, name: swap.name, technique: swap.technique || "", video: undefined, muscles: swap.muscles, bodyweight: swap.bodyweight, swappedFrom: e.name };
    });
    return changed ? { ...option, plan: { ...option.plan, exercises } } : option;
  });
}

// ------------------------------------------------------------ рекорды

/** Лучший вес по каждому упражнению: больше килограммов, при равенстве — больше повторов. */
function spRecords(state) {
  const C = SP();
  const best = new Map();
  for (const entry of Object.values(state.workingWeights || {})) {
    const key = C.exerciseKey(entry.exercise);
    const was = best.get(key);
    if (!was || entry.kilograms > was.kilograms || (entry.kilograms === was.kilograms && (entry.reps || 0) > (was.reps || 0))) best.set(key, entry);
  }
  return [...best.values()].sort((a, b) => b.date.localeCompare(a.date));
}
function spRecordFor(state, name) {
  const key = SP().exerciseKey(name);
  return spRecords(state).find(r => SP().exerciseKey(r.exercise) === key) || null;
}

// ------------------------------------------------------------ неделя и программа

function spWeekStats(options, state) {
  const C = SP(), today = C.todayKey();
  const monday = C.startOfWeekKey(today);
  const days = Array.from({ length: 7 }, (_, i) => C.offsetDateKey(monday, i));
  const planned = options.filter(o => days.includes(o.date) && (o.kind === "main" || o.kind === "splits"));
  const byDate = new Map();
  for (const o of planned) { const k = `${o.date}|${o.kind}`; if (!byDate.has(k)) byDate.set(k, []); byDate.get(k).push(o); }
  let done = 0, seconds = 0;
  for (const variants of byDate.values()) {
    const finished = variants.find(o => C.optionCompletion(o, state) === 100);
    if (finished) { done++; seconds += C.workoutSeconds(state, finished) || 0; }
  }
  let marks = 0, due = 0;
  for (const date of days.filter(d => d <= today)) {
    const habits = Object.entries(state.customHabits || {}).filter(([, h]) => !h.archived && h.createdOn <= date);
    due += 2 + habits.length;
    if (state.showers?.[date]) marks++;
    if (state.warmups?.[date]) marks++;
    for (const [id, h] of habits) if (C.habitDone(state.habitChecks?.[id]?.[date], C.habitTarget(h)) >= C.habitTarget(h)) marks++;
  }
  return { planned: byDate.size, done, seconds, habits: due ? Math.round(marks / due * 100) : 0 };
}

/** Активные программы: сколько занятий сделано, где мы по календарю, когда конец. */
function spProgramProgress(options, state) {
  const C = SP(), today = C.todayKey();
  const groups = new Map();
  for (const o of options) {
    if (o.historyOnly || o.key.startsWith("free|")) continue;
    const key = C.optionProgramKey(o);
    if (!groups.has(key)) groups.set(key, { key, title: o.programTitle, addedAt: o.addedAt, options: [] });
    groups.get(key).options.push(o);
  }
  return [...groups.values()].map(g => {
    const slots = new Map();
    for (const o of g.options.filter(o => o.kind !== "test")) slots.set(`${o.date}|${o.kind}`, [...(slots.get(`${o.date}|${o.kind}`) || []), o]);
    const dates = [...new Set(g.options.map(o => o.date))].sort();
    const done = [...slots.values()].filter(v => v.some(o => C.optionCompletion(o, state) === 100)).length;
    const first = dates[0], last = dates[dates.length - 1];
    const span = Math.round((C.dateFromKey(last) - C.dateFromKey(first)) / 86400000) + 1;
    const day = Math.max(0, Math.min(span, Math.round((C.dateFromKey(today) - C.dateFromKey(first)) / 86400000) + 1));
    return { ...g, sessions: slots.size, done, first, last, span, day, rank: C.programRank(g.key, g.addedAt, state) };
  }).filter(p => p.last >= today || p.done < p.sessions).sort((a, b) => a.rank - b.rank);
}

/** Ближайшие занятия после выбранной даты (по одному на дату и вид, с учётом выбора варианта). */
function spUpcoming(options, state, after, limit = 5) {
  const C = SP();
  const slots = [...new Set(options.filter(o => o.date > after).map(o => `${o.date}|${o.kind}`))].sort();
  return slots.slice(0, limit).map(slot => { const [date, kind] = slot.split("|"); return C.selectedOption(options, date, kind, state) || options.find(o => o.date === date && o.kind === kind); }).filter(Boolean);
}

// ------------------------------------------------------------ окна: свободная тренировка, замена

function spExerciseNames(state) {
  const C = SP();
  const names = new Map();
  for (const f of C.favoriteExercises(state)) names.set(C.exerciseKey(f.name), f.name);
  for (const s of C.exerciseStats(spOptions().visible, state)) names.set(C.exerciseKey(s.name), s.name);
  for (const m of C.gymMovements(state)) names.set(C.exerciseKey(m.name), m.name);
  return [...names.values()];
}

SP_SHEETS.free = sheet => {
  const s = spState(), C = SP();
  const existing = sheet.id ? s.state.freeWorkouts?.[sheet.id] : null;
  sheet.draft ||= { title: existing?.title || "Свободная тренировка", date: existing?.date || s.date, exercises: existing?.exercises?.map(e => ({ ...e })) || [{ name: "", sets: 3, reps: "10", seconds: "", rest: 90 }] };
  const d = sheet.draft;
  const names = spExerciseNames(s.state);
  return { title: sheet.id ? "Свободная тренировка" : "Новая свободная тренировка", wide: true, body: `<form data-sp-form="free"><div class="field-row"><label class="field">Название<input name="title" maxlength="80" value="${spEsc(d.title)}"></label><label class="field">Дата<input type="date" name="date" value="${spEsc(d.date)}" max="${C.offsetDateKey(C.todayKey(), 60)}"></label></div>
    <p class="sp-kicker">Упражнения</p>
    ${d.exercises.map((e, i) => `<div class="sp-free-ex"><input name="name${i}" list="sp-names" maxlength="160" required placeholder="Упражнение" value="${spEsc(e.name)}"><div class="sp-free-nums"><label>Подходы<input name="sets${i}" type="number" min="1" max="20" inputmode="numeric" value="${e.sets}"></label><label>Повторы<input name="reps${i}" maxlength="10" placeholder="10" value="${spEsc(e.reps || "")}"></label><label>или сек<input name="sec${i}" type="number" min="0" max="3600" inputmode="numeric" placeholder="—" value="${e.seconds || ""}"></label><label>Отдых, с<input name="rest${i}" type="number" min="0" max="600" inputmode="numeric" value="${e.rest ?? 90}"></label></div>${d.exercises.length > 1 ? `<button class="text-action danger" type="button" data-action="sp-free-del" data-i="${i}">Убрать</button>` : ""}</div>`).join("")}
    <datalist id="sp-names">${names.map(n => `<option value="${spEsc(n)}">`).join("")}</datalist>
    <button class="text-action" type="button" data-action="sp-free-add">+ Ещё упражнение</button>
    <p class="section-note">Подсказки — из любимых, истории и рабочих весов. Отмечается подходами и таймерами, как занятие программы, и попадает в историю и выгрузку для ИИ.</p>
    <div class="sheet-actions">${sheet.id ? `<button class="ghost-button" type="button" data-action="sp-free-remove" data-id="${spEsc(sheet.id)}">Удалить</button>` : ""}<button class="primary-button" type="submit">Сохранить</button></div></form>` };
};
function spFreeDraftFromForm() {
  const form = document.querySelector('[data-sp-form="free"]'), d = spState().sheet?.draft;
  if (!form || !d) return;
  d.title = form.elements.title.value; d.date = form.elements.date.value;
  d.exercises = d.exercises.map((e, i) => ({ name: form.elements[`name${i}`].value, sets: form.elements[`sets${i}`].value, reps: form.elements[`reps${i}`].value, seconds: form.elements[`sec${i}`].value, rest: form.elements[`rest${i}`].value }));
}
SP_FORMS.free = () => {
  spFreeDraftFromForm();
  const s = spState(), C = SP(), sheet = s.sheet, d = sheet.draft;
  const exercises = d.exercises.map(e => ({ name: String(e.name).trim().slice(0, 160), sets: Math.max(1, Math.min(20, Math.round(Number(e.sets) || 1))), reps: String(e.reps || "").trim().slice(0, 10), seconds: Math.max(0, Math.round(Number(e.seconds) || 0)), rest: Math.max(0, Math.min(600, Math.round(Number(e.rest) || 0))) })).filter(e => e.name);
  if (!exercises.length) return spSheetError("Добавьте хотя бы одно упражнение.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return spSheetError("Укажите дату.");
  const id = sheet.id || crypto.randomUUID().slice(0, 12);
  spUpdate(prev => {
    const next = { ...prev, freeWorkouts: { ...prev.freeWorkouts, [id]: { ...prev.freeWorkouts?.[id], title: String(d.title).trim().slice(0, 80) || "Свободная тренировка", date: d.date, exercises, createdAt: prev.freeWorkouts?.[id]?.createdAt || new Date().toISOString() } } };
    const option = sheet.id ? null : spFreeOptions(next).find(o => o.key === `free|${id}`);
    return option ? C.chooseOption(next, option) : next;
  }).catch(() => {});
  s.date = d.date; s.sheet = null; s.tab = "training"; render();
};

SP_SHEETS.swap = sheet => {
  const s = spState(), names = spExerciseNames(s.state).filter(n => n !== sheet.from && n !== sheet.original);
  return { title: "Заменить упражнение", body: `<p class="section-note">Вместо «${spEsc(sheet.from)}». Подходы и схема остаются из плана, уже отмеченное не пропадает.</p><form data-sp-form="swap"><label class="field">Новое упражнение<input name="name" list="sp-swap-names" maxlength="160" required placeholder="Например, тяга резинки к поясу"></label><datalist id="sp-swap-names">${names.map(n => `<option value="${spEsc(n)}">`).join("")}</datalist><label class="field">Как делать (необязательно)<textarea name="technique" rows="2" maxlength="1000"></textarea></label><label class="sp-check-line"><input type="checkbox" name="all" checked>Во всей программе, а не только сегодня</label><div class="sheet-actions">${sheet.swapped ? `<button class="ghost-button" type="button" data-action="sp-swap-undo">Вернуть как в плане</button>` : ""}<button class="primary-button" type="submit">Заменить</button></div></form>` };
};
SP_FORMS.swap = form => {
  const s = spState(), C = SP(), sheet = s.sheet;
  const name = form.elements.name.value.trim();
  if (!name) return spSheetError("Введите упражнение.");
  const key = form.elements.all.checked ? `${sheet.program}|name:${C.exerciseKey(sheet.original)}` : `${sheet.option}|${sheet.id}`;
  spUpdate(prev => ({ ...prev, exerciseSwaps: { ...prev.exerciseSwaps, [key]: { name: name.slice(0, 160), technique: form.elements.technique.value.trim().slice(0, 1000), changedAt: new Date().toISOString() } } })).catch(() => {});
  spClose();
};

Object.assign(SP_ACTIONS, {
  "sp-free-new": () => spOpen("free"),
  "sp-free-edit": control => spOpen("free", { id: control.dataset.id }),
  "sp-free-add": () => { spFreeDraftFromForm(); spState().sheet.draft.exercises.push({ name: "", sets: 3, reps: "10", seconds: "", rest: 90 }); render(); },
  "sp-free-del": control => { spFreeDraftFromForm(); spState().sheet.draft.exercises.splice(Number(control.dataset.i), 1); render(); },
  "sp-free-remove": control => {
    const id = control.dataset.id;
    if (!confirm("Удалить свободную тренировку? Отмеченные подходы тоже пропадут.")) return;
    spUpdate(prev => { const { [id]: _gone, ...rest } = prev.freeWorkouts || {}; return { ...prev, freeWorkouts: rest }; }).catch(() => {});
    spClose();
  },
  "sp-swap-undo": () => {
    const s = spState(), C = SP(), sheet = s.sheet;
    const keys = [`${sheet.option}|${sheet.id}`, `${sheet.program}|name:${C.exerciseKey(sheet.original)}`];
    spUpdate(prev => { const next = { ...(prev.exerciseSwaps || {}) }; for (const k of keys) delete next[k]; return { ...prev, exerciseSwaps: next }; }).catch(() => {});
    spClose();
  },
});
