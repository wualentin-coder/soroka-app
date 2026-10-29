/*
 * «Спорт» — цели, профиль (анкета, фокус мышц, замеры, инвентарь, любимые,
 * история), настройки уведомлений, программы и импорт плана от ИИ.
 * Расчёты — sport-core.js (WooSport); здесь только экраны в стиле Flow.
 */

// ------------------------------------------------------------ цели

// «Цели» — весь прогресс: неделя, цели, тело, рекорды.
function spGoalsScreen() {
  const s = spState(), C = SP();
  const { visible } = spOptions();
  const week = spWeekStats(visible, s.state);
  const builtIn = C.visibleBuiltInGoals(s.state);
  const custom = C.activeCustomGoals(s.state);
  const weekCard = `<section class="sp-card"><div class="sp-card-head"><p class="sp-kicker">Эта неделя</p><span>${spDateShort(C.startOfWeekKey(C.todayKey()))} — ${spDateShort(C.offsetDateKey(C.startOfWeekKey(C.todayKey()), 6))}</span></div><dl class="sp-stats"><div><dt>Тренировок</dt><dd>${week.done}<small>из ${week.planned}</small></dd></div><div><dt>Время</dt><dd>${week.seconds ? C.formatDuration(week.seconds) : "—"}</dd></div><div><dt>Отметки</dt><dd>${week.habits}<small>%</small></dd></div></dl></section>`;
  const goals = `<section class="sp-card"><div class="sp-card-head"><p class="sp-kicker">Цели</p><button class="text-action" type="button" data-action="sp-goal-new">+ цель</button></div>${builtIn.map(key => spBuiltInGoal(key)).join("")}${custom.map(([id, goal]) => spCustomGoal(id, goal)).join("")}</section>`;
  return `${weekCard}${goals}${spBodyCard()}${spRecordsCard()}`;
}

/** Тело: главные замеры с изменением за месяц. Полный список — по «Все замеры». */
function spBodyCard() {
  const s = spState(), C = SP();
  const fields = C.measurementFields(s.state).filter(f => !f.archived);
  const order = ["Вес", "Талия", "Грудь", "Бёдра", "Бицепс"];
  const shown = fields.filter(f => C.measurementHistory(s.state, f.id).length).sort((a, b) => (order.indexOf(a.label) + 1 || 99) - (order.indexOf(b.label) + 1 || 99)).slice(0, 4);
  const rows = shown.map(field => {
    const points = C.measurementSeries(C.measurementHistory(s.state, field.id), field.unit);
    const latest = C.measurementHistory(s.state, field.id)[0];
    const base = C.baselinePoint(points, 30);
    const last = points[points.length - 1];
    const delta = base && last && base.id !== last.id ? last.numericValue - base.numericValue : null;
    return `<button type="button" class="sp-list-row" data-action="sp-measure-open" data-id="${spEsc(field.id)}"><span><b>${spEsc(field.label)}</b><small>${spEsc(C.measurementValue(latest.value, field.unit))}</small></span><small>${delta === null ? "" : `${delta > 0 ? "+" : ""}${delta.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} за месяц`}</small></button>`;
  }).join("");
  return `<section class="sp-card"><div class="sp-card-head"><p class="sp-kicker">Тело</p><button class="text-action" type="button" data-action="sp-profile-section" data-section="body">${rows ? "Все замеры" : "+ замер"}</button></div>${rows || `<p class="section-note">Вес, талия и другие замеры с изменением за месяц появятся здесь после первой записи.</p>`}</section>`;
}

function spRecordsCard() {
  const s = spState(), C = SP();
  const records = spRecords(s.state).slice(0, s.open.records ? 50 : 5);
  if (!records.length) return `<section class="sp-card"><p class="sp-kicker">Рекорды</p><p class="section-note">Записывайте вес в строке упражнения — лучший результат по каждому появится здесь.</p></section>`;
  const total = spRecords(s.state).length;
  return `<section class="sp-card"><div class="sp-card-head"><p class="sp-kicker">Рекорды</p><span>${total} ${spPlural(total, "упражнение", "упражнения", "упражнений")}</span></div>${records.map(r => `<div class="sp-list-row"><span><b>${spEsc(r.exercise)}</b><small>${spDateShort(r.date)} · ${r.bodyweight ? "свой вес, за подход" : spEsc(C.WEIGHT_BASIS[r.basis || "per_dumbbell"]).toLocaleLowerCase()}</small></span><b>${r.bodyweight ? `${r.reps} повт.` : `${spKg(r.kilograms)} кг${r.reps ? ` × ${r.reps}` : ""}`}</b></div>`).join("")}${total > 5 ? `<button class="text-action" type="button" data-action="sp-toggle-open" data-key="records">${s.open.records ? "Свернуть" : `Все рекорды · ${total}`}</button>` : ""}</section>`;
}
function spTestHistory(tests, key) {
  return Object.keys(tests).map(Number).sort((a, b) => a - b).map(day => ({ day, value: tests[String(day)][key] })).filter(p => p.value !== undefined);
}
function spEstimate(points, target) {
  if (points.length && points[points.length - 1].value >= target) return "Цель достигнута";
  if (points.length < 2) return "После второго теста";
  const first = points[0], last = points[points.length - 1];
  const gain = last.day > first.day ? (last.value - first.value) / (last.day - first.day) : 0;
  if (gain <= 0) return "Нужен стабильный прогресс";
  return `≈ ${Math.ceil(Math.max(0, target - last.value) / gain)} дн.`;
}
function spGoalRow({ id, title, label, current, target, suffix, body }) {
  const percent = Math.min(100, ((current ?? 0) / target) * 100);
  const open = spState().open[`goal:${id}`];
  return `<div class="sp-goal ${percent >= 100 ? "done" : ""} ${open ? "open" : ""}"><button type="button" class="sp-goal-head" data-action="sp-toggle-open" data-key="goal:${spEsc(id)}" aria-expanded="${Boolean(open)}"><span><strong>${spEsc(title)}</strong><small>${percent >= 100 ? "Цель достигнута" : spEsc(label)}</small></span><span class="sp-goal-num"><b>${current ?? "—"}${spEsc(suffix)}</b><small>из ${target}${spEsc(suffix)}</small></span><span class="sp-progress"><i style="width:${percent}%"></i></span><small class="sp-goal-cap">${current === null ? "Запишите первый результат" : `${Math.round(percent)}% цели`}</small></button>${open ? `<div class="sp-goal-body">${body}</div>` : ""}</div>`;
}
function spGoalEntry(id, current, unit, editing) {
  const draft = spState().goalDraft?.[id] ?? "";
  return `<form class="sp-goal-entry" data-sp-form="goal" data-id="${spEsc(id)}"><div class="sp-stepper"><button type="button" data-action="sp-goal-step" data-id="${spEsc(id)}" data-d="-1" aria-label="Меньше">−</button><input name="value" inputmode="decimal" placeholder="—" value="${spEsc(draft)}" data-sp-goal-input="${spEsc(id)}" aria-label="Результат"><span>${spEsc(unit || "раз")}</span><button type="button" data-action="sp-goal-step" data-id="${spEsc(id)}" data-d="1" aria-label="Больше">+</button></div><button class="primary-button" type="submit">${editing ? "Сохранить правку" : "Записать"}</button></form>`;
}
function spGoalHistory(id, points, target, suffix, editing) {
  const open = spState().open[`goalhist:${id}`];
  const recent = [...points].reverse();
  const shown = open === "all" ? recent : recent.slice(0, 3);
  return `<details class="sp-details sp-goal-history" ${open ? "open" : ""}><summary data-action="sp-goal-hist" data-id="${spEsc(id)}">История · ${points.length}</summary>${points.length ? `<p class="section-note">Нажмите на замер, чтобы исправить</p>` : `<p class="section-note">Первый результат появится здесь после записи.</p>`}
    ${shown.map(p => `<button type="button" class="sp-measure ${editing === p.id ? "editing" : ""}" data-action="sp-goal-edit" data-id="${spEsc(id)}" data-point="${spEsc(p.id)}" data-value="${p.value}"><span>${spEsc(p.label)}</span><i><b style="width:${Math.min(100, p.value / target * 100)}%"></b></i><strong>${p.value}${spEsc(suffix)}</strong></button>`).join("")}
    ${points.length > 3 ? `<button class="text-action" type="button" data-action="sp-goal-hist-all" data-id="${spEsc(id)}">${open === "all" ? "Свернуть историю" : `Все замеры (${points.length})`}</button>` : ""}</details>`;
}
function spBuiltInGoal(key) {
  const s = spState(), C = SP();
  const goal = C.GOALS[key], target = C.goalTarget(s.state, key);
  const suffix = key === "splits" ? "°" : "";
  const points = spTestHistory(s.state.tests, key);
  const current = points.length ? points[points.length - 1].value : null;
  const previous = points.length > 1 ? points[points.length - 2].value : undefined;
  const growth = current !== null && previous !== undefined ? current - previous : null;
  const title = target === goal.target ? goal.title : key === "pullups" ? `${target} подтягиваний` : key === "pushups" ? `${target} отжиманий` : `Шпагат ${target}°`;
  const editing = s.goalEditing?.[key];
  const day = spDay();
  const label = d => spDateShort(C.dateKeyForDay(d, day));
  const body = `${spGoalEntry(key, current, suffix, editing !== undefined)}${editing !== undefined ? `<p class="section-note">Исправляется замер за ${label(Number(editing))}. <button class="text-action" type="button" data-action="sp-goal-edit-cancel" data-id="${key}">Новый результат за сегодня</button></p>` : ""}
    <div class="sp-stat-grid"><div><span>Прирост</span><b>${growth === null ? "—" : `${growth > 0 ? "+" : ""}${growth}${suffix}`}</b></div><div><span>Осталось</span><b>${current === null ? target : Math.max(0, target - current)}${suffix}</b></div><div><span>До цели ≈</span><b>${spEstimate(points, target)}</b></div></div>
    ${spGoalHistory(key, points.map(p => ({ id: String(p.day), label: label(p.day), value: p.value })), target, suffix, editing)}
    <button class="text-action" type="button" data-action="sp-goal-target" data-key="${key}">Изменить цель</button>`;
  return spGoalRow({ id: key, title, label: goal.label, current, target, suffix, body });
}
function spCustomGoal(id, goal) {
  const s = spState(), C = SP();
  const history = C.customGoalHistory(s.state, id);
  const current = C.latestCustomValue(s.state, id);
  const suffix = goal.unit ? ` ${goal.unit}` : "";
  const editing = s.goalEditing?.[id];
  const body = `${spGoalEntry(id, current, goal.unit || "ед.", editing !== undefined)}${editing !== undefined ? `<p class="section-note">Исправляется замер за ${spDateShort(editing)}. <button class="text-action" type="button" data-action="sp-goal-edit-cancel" data-id="${spEsc(id)}">Новый результат за сегодня</button></p>` : ""}
    ${spGoalHistory(id, history.map(p => ({ id: p.date, label: spDateShort(p.date), value: p.value })), goal.target, suffix, editing)}
    <button class="text-action" type="button" data-action="sp-goal-custom-edit" data-id="${spEsc(id)}">Изменить цель</button>`;
  return spGoalRow({ id, title: goal.name, label: "Своя цель", current, target: goal.target, suffix, body });
}
SP_FORMS.goal = form => {
  const s = spState(), C = SP(), id = form.dataset.id;
  const builtIn = Object.prototype.hasOwnProperty.call(C.GOALS, id);
  const value = C.validGoalResult(form.elements.value.value, builtIn ? id : undefined);
  if (value === null) return toast(id === "splits" ? "Угол от 0 до 180°" : builtIn ? "Целое число от 0 до 100 000" : "Число от 0 до 100 000");
  const editing = s.goalEditing?.[id];
  spUpdate(prev => builtIn ? C.logBuiltInGoal(prev, editing !== undefined ? Number(editing) : spDay(), id, value) : C.logCustomGoal(prev, id, value, editing ?? C.todayKey()))
    .then(() => toast("Результат сохранён")).catch(() => toast("Не сохранилось — попробуйте ещё раз"));
  s.goalDraft = { ...s.goalDraft, [id]: "" };
  if (s.goalEditing) delete s.goalEditing[id];
};
document.addEventListener("input", event => {
  const id = event.target.dataset?.spGoalInput;
  if (id) { const s = spState(); s.goalDraft = { ...s.goalDraft, [id]: event.target.value }; }
});
SP_SHEETS["goal-target"] = sheet => ({ title: `Цель: ${SP().GOALS[sheet.key].label}`, body: `<form data-sp-form="goal-target"><label class="field">Цель<input name="target" type="number" min="1" step="any" inputmode="decimal" required value="${SP().goalTarget(spState().state, sheet.key)}"></label><p class="section-note">Отметки прогресса пересчитаются по новой цели.</p><div class="sheet-actions"><button class="primary-button" type="submit">Сохранить</button></div></form>` });
SP_FORMS["goal-target"] = form => {
  const target = SP().validGoalTarget(form.elements.target.value), key = spState().sheet.key;
  if (target === null) return spSheetError("Цель — положительное число.");
  spUpdate(prev => ({ ...prev, goalTargets: { ...prev.goalTargets, [key]: target } })).catch(() => {});
  spClose();
};
SP_SHEETS["goal-custom"] = sheet => {
  const goal = sheet.id ? spState().state.customGoals?.[sheet.id] : null;
  return { title: sheet.id ? "Изменить цель" : "Своя цель", body: `<form data-sp-form="goal-custom"><label class="field">Название<input name="name" maxlength="60" required value="${spEsc(goal?.name || "")}" placeholder="Например, присед 100 кг"></label><div class="field-row"><label class="field">Единица<input name="unit" maxlength="12" value="${spEsc(goal?.unit || "")}" placeholder="кг, км, раз"></label><label class="field">Цель<input name="target" type="number" min="1" step="any" inputmode="decimal" required value="${goal?.target ?? ""}"></label></div><div class="sheet-actions">${sheet.id ? `<button class="ghost-button" type="button" data-action="sp-goal-remove" data-id="${spEsc(sheet.id)}">Убрать цель</button>` : ""}<button class="primary-button" type="submit">Сохранить</button></div></form>` };
};
SP_FORMS["goal-custom"] = form => {
  const C = SP(), sheet = spState().sheet;
  const target = C.validGoalTarget(form.elements.target.value), name = form.elements.name.value.trim();
  if (target === null) return spSheetError("Цель — положительное число.");
  if (!name) return spSheetError("Введите название цели.");
  const id = sheet.id || crypto.randomUUID();
  spUpdate(prev => ({ ...prev, customGoals: { ...prev.customGoals, [id]: { ...prev.customGoals?.[id], name, unit: form.elements.unit.value.trim(), target, createdOn: prev.customGoals?.[id]?.createdOn || C.todayKey() } } })).catch(() => {});
  spClose();
};
Object.assign(SP_ACTIONS, {
  "sp-goal-new": () => spOpen("goal-custom"),
  "sp-goal-custom-edit": control => spOpen("goal-custom", { id: control.dataset.id }),
  "sp-goal-target": control => spOpen("goal-target", { key: control.dataset.key }),
  "sp-goal-remove": control => { const id = control.dataset.id; spUpdate(prev => ({ ...prev, customGoals: { ...prev.customGoals, [id]: { ...prev.customGoals[id], archived: true } } })).catch(() => {}); spClose(); },
  "sp-goal-step": control => {
    const s = spState(), id = control.dataset.id;
    const input = document.querySelector(`[data-sp-goal-input="${CSS.escape(id)}"]`);
    const raw = input?.value.trim();
    const C = SP();
    const current = Object.prototype.hasOwnProperty.call(C.GOALS, id) ? (spTestHistory(s.state.tests, id).pop()?.value ?? 0) : (C.latestCustomValue(s.state, id) ?? 0);
    const base = raw ? Number(raw.replace(",", ".")) : current;
    if (!Number.isFinite(base)) return;
    const next = String(Math.max(0, Math.round((base + Number(control.dataset.d)) * 100) / 100));
    s.goalDraft = { ...s.goalDraft, [id]: next };
    if (input) input.value = next;
  },
  "sp-goal-edit": control => { const s = spState(); s.goalEditing = { ...s.goalEditing, [control.dataset.id]: control.dataset.point }; s.goalDraft = { ...s.goalDraft, [control.dataset.id]: control.dataset.value }; render(); },
  "sp-goal-edit-cancel": control => { const s = spState(); delete s.goalEditing?.[control.dataset.id]; s.goalDraft = { ...s.goalDraft, [control.dataset.id]: "" }; render(); },
  "sp-goal-hist": (control, event) => { event?.preventDefault(); const s = spState(), key = `goalhist:${control.dataset.id}`; s.open[key] = s.open[key] ? false : true; render(); },
  "sp-goal-hist-all": control => { const s = spState(), key = `goalhist:${control.dataset.id}`; s.open[key] = s.open[key] === "all" ? true : "all"; render(); },
});

// ------------------------------------------------------------ профиль

const SP_SECTIONS = { profile: "Анкета", body: "Замеры", equipment: "Инвентарь", favorites: "Любимые упражнения", history: "История" };
// «Профиль» — всё про вас и все настройки раздела в одном месте.
function spProfileScreen() {
  const s = spState(), C = SP(), state = s.state;
  const profile = state.trainingProfile || {};
  const gaps = C.profileGaps(state);
  const today = C.todayKey();
  const tgName = window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "";
  const name = profile.name?.trim() || tgName || "Профиль";
  const years = C.ageFromBirthDate(profile.birthDate, today) ?? (profile.age?.trim() ? Number(profile.age) : null);
  const selected = C.knownMuscles(state.targetMuscles);
  const { all, visible } = spOptions();
  const programs = C.programSummaries(s.catalog, all, state).filter(p => (state.programLifecycle?.[p.key]?.status ?? "active") === "active");
  const progressByProgram = new Map(spProgramProgress(all, state, true).map(p => [p.key, p]));
  const archived = C.programSummaries(s.catalog, all, state).filter(p => state.programLifecycle?.[p.key]?.status === "archived").length;
  const journal = C.workoutJournal(visible, state);
  const owned = C.EQUIPMENT.filter(item => C.hasEquipment(state, item.id));
  const liked = C.favoriteExercises(state);
  const n = C.notificationSettings(state.notificationSettings);
  const on = ["shower", "workout"].filter(k => n[k].enabled).length + Object.values(state.customHabits || {}).filter(h => !h.archived && C.habitNotifies(h) && C.habitReminders(h).length).length;
  const row = (action, title, note, need, extra = "") => `<button type="button" ${action}><span><strong>${title}</strong>${note ? `<small>${note}</small>` : ""}${extra}</span>${need ? '<i class="sp-dot"></i>' : ""}${icon("arrow", "icon-sm")}</button>`;
  return `<section class="sp-card sp-hero-card"><button type="button" class="sp-hero" data-action="sp-profile-section" data-section="profile"><span class="sp-avatar">${spEsc((profile.name?.trim() || tgName) ? name.slice(0, 1).toUpperCase() : "?")}</span><span><strong>${spEsc(years !== null ? `${name}, ${years}` : name)}</strong><small>${gaps.profile ? "Анкета не заполнена" : "Анкета"}</small></span>${gaps.profile ? '<i class="sp-dot"></i>' : ""}${icon("arrow", "icon-sm")}</button>
      <button type="button" class="sp-muscle-card" data-action="sp-muscles-open"><span class="sp-muscle-thumb">${window.SportFigures ? spFigureSvg(spShapes(selected), new Set(), window.SportFigures.FIGURE_VIEWBOX, false) : (spFiguresNeeded(), "")}</span><span><strong>Фокус тренировок</strong><small>${spEsc(C.muscleNames(selected) || "Выберите мышцы, которые хотите развивать")}</small></span>${gaps.muscles ? '<i class="sp-dot"></i>' : ""}</button></section>
    <section class="sp-card"><div class="sp-card-head"><p class="sp-kicker">Программы</p>${archived ? `<button class="text-action" type="button" data-action="sp-programs" data-archive="1">Архив · ${archived}</button>` : ""}</div>
      ${programs.length ? programs.map(p => {
        const dates = [...p.dates].sort(), progress = progressByProgram.get(p.key);
        const percent = progress ? Math.round(progress.done / Math.max(1, progress.sessions) * 100) : 0;
        const day = progress ? progress.day > 0 ? `день ${progress.day} из ${progress.span}` : `старт ${spDateShort(progress.first)}` : "";
        return `<button type="button" class="sp-list-row sp-program-profile" data-action="sp-programs"><span><b>${spEsc(p.title)}</b><small>${dates.length ? `${spDateShort(dates[0])} — ${spDateShort(dates[dates.length - 1])}` : ""}</small>${progress ? `<span class="sp-progress" role="progressbar" aria-label="Прогресс программы ${spEsc(p.title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></span><small>Сделано ${progress.done} из ${progress.sessions} · ${day}</small>` : ""}</span>${icon("arrow", "icon-sm")}</button>`;
      }).join("") : `<p class="section-note">Пока нет. Ниже — составить с ИИ по вашим данным.</p>`}
      <button class="primary-button sp-wide" type="button" data-action="sp-import-open">Новая программа с ИИ</button></section>
    <div class="sp-card sp-links">
      ${row('data-action="sp-profile-section" data-section="body"', "Замеры", gaps.measurements.length ? `не хватает: ${gaps.measurements.map(f => f.label.toLocaleLowerCase()).join(", ")}` : "вес, обхваты, свои параметры", gaps.measurements.length > 0)}
      ${row('data-action="sp-profile-section" data-section="equipment"', "Инвентарь и рабочие веса", gaps.equipment ? "не указан" : "", gaps.equipment, gaps.equipment ? "" : `<span class="sp-facts">${owned.map(item => `<span title="${spEsc(item.label)}">${spEquipIcon(item.id)}${item.weighed && C.equipmentKg(state, item.id) ? `<b>${C.equipmentKg(state, item.id)} кг</b>` : ""}</span>`).join("")}</span>`)}
      ${row('data-action="sp-profile-section" data-section="favorites"', "Любимые упражнения", liked.length ? liked.slice(0, 3).map(i => spEsc(i.name)).join(", ") + (liked.length > 3 ? ` и ещё ${liked.length - 3}` : "") : "отмечаются в окне упражнения", false)}
      ${row('data-action="sp-profile-section" data-section="history"', "История занятий", journal.length ? `${journal.length} ${spPlural(journal.length, "занятие", "занятия", "занятий")}` : "пока пусто", false)}
      ${row('data-action="sp-sizes"', "Размеры одежды", "по меркам стопы, талии, груди и росту", false)}
      ${row('data-action="sp-reminders"', "Напоминания", on ? `${on} ${spPlural(on, "включено", "включено", "включено")} · ${spEsc(n.timeZone)}` : "все выключены", false)}
    </div>`;
}
SP_SHEETS.profile = () => {
  const C = SP(), profile = spState().state.trainingProfile || {};
  const row = field => {
    const value = profile[field.key] || "";
    const set = Boolean(String(value).trim());
    let control;
    if (field.date) control = `<input type="date" name="${field.key}" max="${C.todayKey()}" value="${spEsc(value)}">`;
    else if (field.choice) control = `<div class="sp-choice">${field.choice.map(option => `<label class="${value === option ? "on" : ""}"><input type="radio" name="${field.key}" value="${spEsc(option)}" ${value === option ? "checked" : ""}>${spEsc(option)}</label>`).join("")}</div>`;
    else if (field.slider) {
      const sl = field.slider, current = set ? Number(value) : sl.default;
      control = `<div class="sp-scale"><small>${spEsc(sl.ends?.[0] ?? sl.min)}</small><input type="range" name="${field.key}" min="${sl.min}" max="${sl.max}" step="${sl.step ?? 1}" value="${current}" data-sp-slider="${field.key}" ${set ? "" : 'data-untouched="1"'}><small>${spEsc(sl.ends?.[1] ?? sl.max)}</small></div>${field.scale ? `<p class="section-note" data-sp-scale="${field.key}">${set ? spEsc(field.scale(current)) : "Не выбрано — программа решит сама"}</p>` : ""}`;
    } else if (field.health) control = `<textarea name="${field.key}" maxlength="2000" rows="2" placeholder="Свободным текстом">${spEsc(value)}</textarea>`;
    else control = `<input name="${field.key}" maxlength="120" value="${spEsc(value)}" placeholder="Не указано">`;
    const answer = field.slider ? `<b data-sp-answer="${field.key}">${set ? String(value).replace(".", ",") : "не указано"}</b>` : field.date ? `<b>${set && C.ageFromBirthDate(value) !== null ? `${C.ageFromBirthDate(value)} ${spPlural(C.ageFromBirthDate(value), "год", "года", "лет")}` : set ? "" : "не указано"}</b>` : `<b>${set ? "" : "не указано"}</b>`;
    return `<div class="sp-profile-row ${set ? "set" : ""}"><div class="sp-profile-row-head"><span>${spEsc(field.label)}</span>${answer}${set ? `<button class="text-action" type="button" data-action="sp-profile-clear" data-key="${field.key}" aria-label="Не указывать">×</button>` : ""}</div>${control}</div>`;
  };
  const asked = C.PROFILE_FIELDS.filter(f => !f.health), health = C.PROFILE_FIELDS.filter(f => f.health);
  return { title: "Анкета", body: `<p class="section-note">Контекст для плана. Всё добровольно: нетронутое поле уходит как «не указано», а не как ноль. Рост и вес — в «Замерах».</p><form data-sp-form="profile">${asked.map(row).join("")}<details class="sp-details"><summary>Здоровье и ограничения <small>по желанию</small></summary><p class="section-note">Приложение не ставит диагнозы. Эти поля не попадают в экспорт без отдельной галочки.</p>${health.map(row).join("")}</details><div class="sheet-actions"><button class="primary-button" type="submit">Сохранить профиль</button></div></form>` };
};
document.addEventListener("input", event => {
  const key = event.target.dataset?.spSlider;
  if (!key) return;
  delete event.target.dataset.untouched;
  const C = SP(), field = C.PROFILE_FIELDS.find(f => f.key === key);
  const answer = document.querySelector(`[data-sp-answer="${key}"]`); if (answer) answer.textContent = String(event.target.value).replace(".", ",");
  const scale = document.querySelector(`[data-sp-scale="${key}"]`); if (scale && field?.scale) scale.textContent = field.scale(Number(event.target.value));
});
SP_FORMS.profile = form => {
  const C = SP();
  const profile = { ...(spState().state.trainingProfile || {}) };
  for (const field of C.PROFILE_FIELDS) {
    const el = form.elements[field.key];
    if (!el) continue;
    if (field.slider) { if (el.dataset.untouched) continue; profile[field.key] = el.value; continue; }
    profile[field.key] = (el.value ?? "").trim();
  }
  spUpdate(prev => ({ ...prev, trainingProfile: { ...profile, updatedAt: new Date().toISOString() } })).then(() => toast("Профиль сохранён")).catch(() => toast("Не сохранилось — проверьте связь"));
  spClose();
};

// Фокус мышц

SP_SHEETS["muscle-targets"] = sheet => {
  const C = SP();
  sheet.draft ||= C.knownMuscles(spState().state.targetMuscles);
  const draft = sheet.draft;
  const map = window.SportFigures ? `<div class="sp-target-map">${spFigureSvg(spShapes(draft), new Set(), window.SportFigures.FIGURE_VIEWBOX, true)}</div>` : (spFiguresNeeded(), `<p class="section-note">Загрузка карты…</p>`);
  return { title: "Фокус тренировок", wide: true, body: `${map}${C.MUSCLE_SELECTION_GROUPS.map(group => `<section class="sp-target-group"><div><h3>${spEsc(group.label)}</h3><span>${group.muscles.filter(id => draft.includes(id)).length}/${group.muscles.length}</span></div><div class="sp-target-options">${group.muscles.map(id => `<button type="button" class="${draft.includes(id) ? "on" : ""}" data-action="sp-muscle-toggle" data-id="${id}">${spEsc(C.muscleLabel(id))}</button>`).join("")}</div></section>`).join("")}
    <p class="section-note">Нажмите на цветную область карты или на пункт списка. Выбранное — приоритеты для ИИ, а не готовая программа.</p>
    <div class="sheet-actions"><button class="ghost-button" type="button" data-action="sp-muscle-all">Все</button><button class="ghost-button" type="button" data-action="sp-muscle-none">Снять</button><button class="primary-button" type="button" data-action="sp-muscle-save">Сохранить · ${draft.length}</button></div>` };
};
Object.assign(SP_ACTIONS, {
  "sp-profile-section": control => { const section = control.dataset.section; if (section === "profile") spOpen("profile"); else spOpen("section", { section }); spState().tab = spState().tab; },
  "sp-profile-clear": control => {
    const key = control.dataset.key;
    spUpdate(prev => ({ ...prev, trainingProfile: { ...prev.trainingProfile, [key]: "" } })).catch(() => {});
  },
  "sp-muscles-open": () => spOpen("muscle-targets"),
  "sp-muscle-toggle": control => { const sheet = spState().sheet, C = SP(), id = control.dataset.id; sheet.draft = C.toggleMuscle(sheet.draft, id, !sheet.draft.includes(id)); render(); },
  "sp-muscle-shape": control => {
    const sheet = spState().sheet, C = SP();
    if (sheet?.kind !== "muscle-targets") return;
    const ids = SP_MUSCLES_FOR_SHAPE[control.dataset.shape] || [];
    const on = !ids.every(id => sheet.draft.includes(id));
    sheet.draft = ids.reduce((list, id) => C.toggleMuscle(list, id, on), C.knownMuscles(sheet.draft));
    render();
  },
  "sp-muscle-all": () => { spState().sheet.draft = SP().MUSCLE_GROUPS.map(g => g.id); render(); },
  "sp-muscle-none": () => { spState().sheet.draft = []; render(); },
  "sp-muscle-save": () => { const draft = SP().knownMuscles(spState().sheet.draft); spUpdate(prev => ({ ...prev, targetMuscles: draft })).catch(() => {}); spClose(); },
});

// Разделы профиля: замеры, инвентарь, любимые, история — одной шторкой.
SP_SHEETS.section = sheet => {
  const body = sheet.section === "body" ? spMeasurements(sheet) : sheet.section === "equipment" ? spEquipment() : sheet.section === "favorites" ? spFavorites() : spHistory(sheet);
  return { title: SP_SECTIONS[sheet.section], wide: true, body };
};

// Замеры
function spMeasurements(sheet) {
  const C = SP(), state = spState().state;
  const fields = C.measurementFields(state);
  if (sheet.field) return spMeasureField(sheet, fields.find(f => f.id === sheet.field));
  const cards = fields.filter(f => Boolean(f.archived) === Boolean(sheet.archived)).sort((a, b) => Number(C.isRequiredField(b)) - Number(C.isRequiredField(a))).map(field => {
    const series = C.measurementHistory(state, field.id);
    return `<button type="button" class="sp-metric" data-action="sp-measure-open" data-id="${spEsc(field.id)}"><span>${C.isRequiredField(field) && !series.length ? '<i class="sp-dot"></i>' : ""}${spEsc(field.label)}</span><b>${series[0] ? spEsc(C.measurementValue(series[0].value, field.unit)) : "—"}</b><small>${series.length ? `${series.length} ${spPlural(series.length, "запись", "записи", "записей")}` : "Добавить первый"}</small></button>`;
  }).join("");
  return `<div class="sp-toolbar-line"><span class="section-note">Нажмите на параметр — график и история</span><button class="text-action" type="button" data-action="sp-measure-archive">${sheet.archived ? "Активные" : "Архив"}</button></div><div class="sp-metrics">${cards}</div><button class="ghost-button sp-wide" type="button" data-action="sp-field-new">+ Свой параметр</button>`;
}
function spSizes() {
  const C = SP(), state = spState().state;
  const { foot, waist, chest, height } = C.sizingMeasurements(state);
  const length = C.pantsLength(height.value);
  const rows = [
    ["Обувь", [foot], C.shoeSizeRu(foot.value), C.shoeSize(foot.value), "EU"],
    ["Брюки", [waist, height], C.pantsSizeRu(waist.value), C.pantsSize(waist.value), "EU"],
    ["Футболка", [chest], C.topSizeRu(chest.value), C.topSize(chest.value), "INT"],
  ];
  return `<p class="section-note">Российский размер — крупно, EU / INT — рядом. Нажмите на мерку, чтобы обновить её.</p>
    ${rows.map(([label, measures, ru, other, system]) => `<div class="sp-size"><div><b>${label}</b>${measures.map(m => `<button type="button" class="text-action" data-action="sp-measure-open" data-id="${spEsc(m.field.id)}">${spEsc(m.field.label)}: ${m.raw ? spEsc(C.measurementValue(m.raw, m.field.unit)) : "указать"}</button>`).join("")}${label === "Брюки" ? `<small>${length ? `${length} · ${length === "Short" ? "укороченные" : length === "Tall" ? "удлинённые" : "стандартные"}` : "Укажите рост для подбора длины"}</small>` : ""}</div><div class="sp-size-result"><small>RU</small><strong>${ru ? `≈ ${ru}` : "—"}</strong><span>${system} · ${other ? `≈ ${other}` : "—"}</span></div></div>`).join("")}
    <p class="section-note">Ориентир по мужским сеткам adidas. Это оценка по меркам, а не точный перевод между системами; перед покупкой сверяйте сетку конкретной модели.</p>`;
}
function spMeasureField(sheet, field) {
  const C = SP(), state = spState().state;
  if (!field) return "";
  const rows = C.measurementHistory(state, field.id);
  return `<button class="text-action" type="button" data-action="sp-measure-back">${icon("left", "icon-sm")}Все замеры</button><h3 class="sp-subtitle">${spEsc(field.label)}</h3>${spMeasureChart(rows, field, sheet)}
    <form class="sp-quick" data-sp-form="measure-quick"><input name="value" inputmode="decimal" maxlength="80" placeholder="${field.unit ? `Значение, ${spEsc(field.unit)}` : "Значение"}" aria-label="Новое значение"><button class="primary-button" type="submit">Записать</button></form>
    <div class="sp-row-actions"><button class="text-action" type="button" data-action="sp-entry-edit" data-field="${spEsc(field.id)}">Записать другой датой</button><button class="text-action" type="button" data-action="sp-field-edit" data-id="${spEsc(field.id)}">${field.sizingMeasure ? "Единицы измерения" : "Название / единицы"}</button>${!C.isRequiredField(field) ? `<button class="text-action" type="button" data-action="sp-field-archive" data-id="${spEsc(field.id)}">${field.archived ? "Вернуть параметр" : "Убрать в архив"}</button>` : ""}</div>
    <div class="sp-list">${rows.map(row => `<div class="sp-list-row"><span><time>${row.legacyDate ? row.legacyDate.split("-").reverse().join(".") : new Date(row.recordedAt).toLocaleString("ru-RU")}</time><b>${spEsc(C.measurementValue(row.value, field.unit))}</b></span><span><button class="text-action" type="button" data-action="sp-entry-edit" data-field="${spEsc(field.id)}" data-row="${spEsc(row.id)}">Изменить</button><button class="text-action danger" type="button" data-action="sp-entry-delete" data-row="${spEsc(row.id)}" data-field="${spEsc(field.id)}">Удалить</button></span></div>`).join("") || `<p class="section-note">Пока нет записей.</p>`}</div>`;
}
function spMeasureChart(rows, field, sheet) {
  const C = SP();
  const points = C.measurementSeries(rows, field.unit);
  const latest = points[points.length - 1];
  if (!latest) return "";
  const windowDays = sheet.windowDays ?? C.BASELINE_WINDOWS[0].days;
  const baseline = C.baselinePoint(points, windowDays) || points[0];
  const delta = latest.numericValue - baseline.numericValue;
  const changed = baseline.id !== latest.id && Number.isFinite(delta);
  const num = v => v.toLocaleString("ru-RU", { maximumSignificantDigits: 10 });
  const values = points.map(p => p.numericValue), min = Math.min(...values), max = Math.max(...values);
  const scale = Math.max(Math.abs(min), Math.abs(max), 1), range = max / scale - min / scale;
  const width = Math.max(300, 80 + (points.length - 1) * 64);
  const x = i => points.length === 1 ? width / 2 : 44 + i * (width - 72) / (points.length - 1);
  const y = v => range ? 136 - ((v / scale - min / scale) / range) * 104 : 84;
  const short = p => new Date(p.recordedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  return `<section class="sp-chart"><div class="sp-chart-sum"><div><small>Последний замер</small><strong>${spEsc(C.measurementValue(latest.value, field.unit))}</strong></div><div><small>${changed ? `Изменение с ${short(baseline)}` : "Изменение"}</small><strong>${changed ? `${delta > 0 ? "+" : ""}${num(delta)}${field.unit ? ` ${spEsc(field.unit)}` : ""}` : "—"}</strong></div></div>
    <div class="sp-segment small">${C.BASELINE_WINDOWS.map(w => `<button type="button" class="${windowDays === w.days ? "active" : ""}" data-action="sp-measure-window" data-days="${w.days}">${w.label}</button>`).join("")}</div>
    <div class="sp-chart-scroll" data-sp-strip><svg width="${width}" height="174" viewBox="0 0 ${width} 174">${[32, 84, 136].map(at => `<line class="sp-grid" x1="44" x2="${width - 28}" y1="${at}" y2="${at}"/>`).join("")}<text class="sp-axis" x="4" y="${range ? 24 : 76}">${num(max)}</text>${range > 0 ? `<text class="sp-axis" x="4" y="151">${num(min)}</text>` : ""}${points.length > 1 ? `<polyline class="sp-line" points="${points.map((p, i) => `${x(i)},${y(p.numericValue)}`).join(" ")}"/>` : ""}${points.map((p, i) => `<circle class="sp-point" cx="${x(i)}" cy="${y(p.numericValue)}" r="5"/><text class="sp-axis" x="${x(i)}" y="167" text-anchor="middle">${short(p)}</text>`).join("")}</svg></div>
    <p class="section-note">${points.length === 1 ? "Добавьте ещё один замер, чтобы увидеть изменение." : "Каждая точка — отдельный замер по порядку."}</p></section>`;
}
SP_FORMS["measure-quick"] = form => {
  const value = form.elements.value.value.trim(), sheet = spState().sheet;
  if (!value) return toast("Введите значение");
  spUpdate(prev => ({ ...prev, measurementEntries: { ...prev.measurementEntries, [crypto.randomUUID()]: { fieldId: sheet.field, value, recordedAt: new Date().toISOString() } } })).catch(() => {});
  form.reset();
};
SP_SHEETS.entry = sheet => {
  const C = SP(), state = spState().state;
  const field = C.measurementFields(state).find(f => f.id === sheet.field);
  const row = sheet.row ? C.measurementHistory(state, sheet.field).find(r => r.id === sheet.row) : null;
  return { title: `Замер: ${field?.label || ""}`, body: `<form data-sp-form="entry"><label class="field">Значение<input name="value" maxlength="80" required value="${spEsc(row?.value || "")}" placeholder="Например, 178 или −1,5 / −2"></label><label class="field">Дата и время<input type="datetime-local" name="date" required max="${C.localDateTimeValue()}" value="${C.localDateTimeValue(row?.recordedAt)}"></label><div class="sheet-actions"><button class="ghost-button" type="button" data-action="sp-entry-back">Назад</button><button class="primary-button" type="submit">Сохранить замер</button></div></form>` };
};
SP_FORMS.entry = form => {
  const C = SP(), s = spState(), sheet = s.sheet;
  const value = form.elements.value.value.trim(), time = new Date(form.elements.date.value).getTime();
  if (!value || !Number.isFinite(time) || time > Date.now()) return spSheetError("Введите значение и дату не позднее текущего момента.");
  const original = sheet.row ? C.measurementHistory(s.state, sheet.field).find(r => r.id === sheet.row) : null;
  const id = original && !original.legacyDate ? original.id : crypto.randomUUID();
  spUpdate(prev => { const next = original?.legacyDate ? C.removeMeasurement(prev, original) : prev; return { ...next, measurementEntries: { ...next.measurementEntries, [id]: { fieldId: sheet.field, value, recordedAt: new Date(time).toISOString() } } }; }).catch(() => {});
  s.sheet = { kind: "section", section: "body", field: sheet.field }; render();
};
SP_SHEETS.field = sheet => {
  const C = SP(), field = sheet.id ? C.measurementFields(spState().state).find(f => f.id === sheet.id) : null;
  return { title: "Параметр замера", body: `<form data-sp-form="field"><label class="field">Название<input name="label" maxlength="50" required ${field?.sizingMeasure ? "readonly" : ""} value="${spEsc(field?.label || "")}" placeholder="Например, зрение"></label><label class="field">Единицы<input name="unit" maxlength="12" value="${spEsc(field?.unit || "")}" placeholder="см, кг, дптр или пусто"></label><p class="section-note">Единицы — подпись. Изменение подписи не пересчитывает старые значения.</p><div class="sheet-actions"><button class="primary-button" type="submit">Сохранить параметр</button></div></form>` };
};
SP_FORMS.field = form => {
  const C = SP(), s = spState(), sheet = s.sheet;
  const fields = C.measurementFields(s.state);
  const existing = sheet.id ? fields.find(f => f.id === sheet.id) : null;
  const label = form.elements.label.value.trim();
  if (!label) return spSheetError("Введите название параметра.");
  const id = existing?.id || crypto.randomUUID();
  if (fields.some(f => f.id !== id && f.label.toLocaleLowerCase() === label.toLocaleLowerCase())) return spSheetError("Такой параметр уже есть, в том числе в архиве.");
  const field = { ...(existing || { id }), label: existing?.sizingMeasure ? existing.label : label, unit: form.elements.unit.value.trim() };
  spUpdate(prev => { const current = C.measurementFields(prev); return { ...prev, measurementFields: current.some(f => f.id === id) ? current.map(f => f.id === id ? field : f) : [...current, field] }; }).catch(() => {});
  s.sheet = { kind: "section", section: "body", field: id }; render();
};
Object.assign(SP_ACTIONS, {
  "sp-measure-open": control => { const s = spState(); s.sheet = { kind: "section", section: "body", field: control.dataset.id }; render(); },
  "sp-measure-back": () => { const s = spState(); s.sheet = { kind: "section", section: "body" }; render(); },
  "sp-measure-archive": () => { const sheet = spState().sheet; sheet.archived = !sheet.archived; render(); },
  "sp-measure-window": control => { spState().sheet.windowDays = Number(control.dataset.days); render(); },
  "sp-field-new": () => spOpen("field"),
  "sp-field-edit": control => spOpen("field", { id: control.dataset.id }),
  "sp-field-archive": control => {
    const C = SP(), id = control.dataset.id;
    spUpdate(prev => ({ ...prev, measurementFields: C.measurementFields(prev).map(f => f.id === id ? { ...f, archived: !f.archived } : f) })).catch(() => {});
    const s = spState(); s.sheet = { kind: "section", section: "body" }; render();
  },
  "sp-entry-edit": control => spOpen("entry", { field: control.dataset.field, row: control.dataset.row }),
  "sp-entry-back": () => { const s = spState(); s.sheet = { kind: "section", section: "body", field: s.sheet.field }; render(); },
  "sp-entry-delete": control => {
    const C = SP(), s = spState();
    const row = C.measurementHistory(s.state, control.dataset.field).find(r => r.id === control.dataset.row);
    if (!row) return;
    if (!confirm(`Удалить запись «${row.value}»?`)) return;
    spUpdate(prev => C.removeMeasurement(prev, row)).catch(() => {});
  },
});

// Инвентарь
function spEquipment() {
  const C = SP(), state = spState().state;
  const place = state.trainingPlace;
  const home = C.EQUIPMENT.filter(item => item.id !== "gym").map(item => {
    const owned = C.hasEquipment(state, item.id), kg = C.equipmentKg(state, item.id), kind = C.equipmentKind(state, item.id);
    return `<div class="sp-equip ${owned ? "on" : ""}"><label class="sp-equip-check"><input type="checkbox" data-sp-equip="${item.id}" ${owned ? "checked" : ""}>${spEquipIcon(item.id)}<span><strong>${spEsc(item.label)}</strong>${item.hint ? `<small>${spEsc(item.hint)}</small>` : ""}</span></label>${item.weighed && owned ? `<input class="sp-equip-kg" type="number" min="0" max="${C.MAX_EQUIPMENT_KG}" step="any" inputmode="decimal" placeholder="кг" value="${kg ?? ""}" data-sp-equip-kg="${item.id}">` : ""}${item.kinds && owned ? `<div class="sp-choice">${item.kinds.map(v => `<button type="button" class="${kind === v.id ? "on" : ""}" data-action="sp-equip-kind" data-id="${item.id}" data-kind="${v.id}">${spEsc(v.label)}</button>`).join("")}</div>` : ""}</div>`;
  }).join("");
  const gym = place && place.where !== "home" ? `<section class="sp-group"><p class="sp-kicker">02 · Рабочие веса в зале</p><p class="section-note">Что помните — то и впишите. Без этого ИИ спрашивает их отдельно, а сам придумывать не должен.</p>${C.gymMovements(state).map(m => { const last = C.latestWeight(state, m.name); return `<form class="sp-gym-row" data-sp-form="gym" data-name="${spEsc(m.name)}" data-basis="${m.basis}"><span><strong>${spEsc(m.name)}</strong><small>${spEsc(C.WEIGHT_BASIS[m.basis])}</small></span><input name="kg" type="number" min="0" max="2000" step="any" inputmode="decimal" placeholder="кг" value="${last ? last.kilograms : ""}"><input name="reps" type="number" min="1" max="1000" inputmode="numeric" placeholder="раз" value="${last?.reps || ""}"><button class="icon-button" type="submit" aria-label="Сохранить">${icon("check", "icon-sm")}</button>${m.id ? `<button class="icon-button" type="button" data-action="sp-gym-remove" data-id="${spEsc(m.id)}" aria-label="Убрать">${icon("close", "icon-sm")}</button>` : ""}</form>`; }).join("")}
    <form class="sp-gym-new" data-sp-form="gym-new"><input name="name" maxlength="160" placeholder="Своё упражнение"><select name="basis">${Object.entries(C.WEIGHT_BASIS).map(([id, label]) => `<option value="${id}" ${id === "total" ? "selected" : ""}>${spEsc(label)}</option>`).join("")}</select><button class="ghost-button" type="submit">Добавить</button></form></section>` : "";
  return `<p class="section-note">Отметьте, что доступно для тренировок. Зал и домашний инвентарь сохраняются независимо.</p>
    <section class="sp-group"><p class="sp-kicker">01 · Где занимаетесь</p><div class="sp-place">${C.TRAINING_PLACES.map(o => `<button type="button" class="${place?.where === o.id ? "on" : ""}" data-action="sp-place" data-id="${o.id}"><strong>${spEsc(o.label)}</strong><small>${spEsc(o.hint)}</small></button>`).join("")}</div>
    ${place?.where === "mixed" ? `<div class="sp-choice days">${C.WEEKDAYS.map((label, i) => `<button type="button" class="${(place.gymDays || []).includes(i + 1) ? "on" : ""}" data-action="sp-gym-day" data-day="${i + 1}">${label}</button>`).join("")}</div>` : ""}</section>
    ${gym}<section class="sp-group"><p class="sp-kicker">03 · Дом</p>${home}</section>`;
}
document.addEventListener("change", event => {
  const C = SP();
  const id = event.target.dataset?.spEquip;
  if (id) spUpdate(prev => ({ ...prev, equipment: { ...C.equipmentOf(prev), [id]: { ...C.equipmentOf(prev)[id], has: event.target.checked } } })).catch(() => {});
  const kgId = event.target.dataset?.spEquipKg;
  if (kgId) {
    const kg = C.validEquipmentKg(event.target.value);
    if (kg === undefined) { toast(`Вес — число от 0 до ${C.MAX_EQUIPMENT_KG} кг`); return; }
    spUpdate(prev => { const { kg: _old, ...rest } = C.equipmentOf(prev)[kgId] || { has: true }; return { ...prev, equipment: { ...C.equipmentOf(prev), [kgId]: { ...rest, has: true, ...(kg === null ? {} : { kg }) } } }; }).catch(() => {});
  }
});
SP_FORMS.gym = form => {
  const C = SP(), kilograms = form.elements.kg.value, reps = form.elements.reps.value;
  const kg = Number(kilograms.replace(",", "."));
  if (!kilograms.trim() || !Number.isFinite(kg)) return toast("Укажите вес");
  const entry = C.gymEntry(form.dataset.name, form.dataset.basis, kg, reps.trim() ? Number(reps) : undefined);
  try { C.validateWorkingWeight(entry); } catch (error) { return toast(error.message); }
  spUpdate(prev => C.recordWorkingWeight(prev, entry)).then(() => toast("Вес записан")).catch(() => {});
};
SP_FORMS["gym-new"] = form => {
  const C = SP(), name = form.elements.name.value.trim();
  try { const next = C.addGymMovement(spState().state, { name, basis: form.elements.basis.value }); spUpdate(() => next).catch(() => {}); }
  catch (error) { toast(error.message); }
};
Object.assign(SP_ACTIONS, {
  "sp-place": control => {
    const C = SP(), where = control.dataset.id;
    spUpdate(prev => ({ ...prev, trainingPlace: prev.trainingPlace?.where === where ? undefined : { where, ...(where === "mixed" && prev.trainingPlace?.gymDays ? { gymDays: prev.trainingPlace.gymDays } : {}) }, equipment: { ...C.equipmentOf(prev), gym: { ...C.equipmentOf(prev).gym, has: prev.trainingPlace?.where === where ? false : where !== "home" } } })).catch(() => {});
  },
  "sp-gym-day": control => {
    const day = Number(control.dataset.day);
    spUpdate(prev => { const cur = prev.trainingPlace?.gymDays || []; const days = cur.includes(day) ? cur.filter(d => d !== day) : [...cur, day].sort((a, b) => a - b); return { ...prev, trainingPlace: { where: "mixed", ...(days.length ? { gymDays: days } : {}) } }; }).catch(() => {});
  },
  "sp-equip-kind": control => {
    const C = SP(), id = control.dataset.id, kind = control.dataset.kind;
    spUpdate(prev => { const cur = C.equipmentOf(prev)[id] || { has: true }; const { kind: _old, ...rest } = cur; return { ...prev, equipment: { ...C.equipmentOf(prev), [id]: cur.kind === kind ? { ...rest, has: true } : { ...rest, has: true, kind } } }; }).catch(() => {});
  },
  "sp-gym-remove": control => spUpdate(prev => SP().removeGymMovement(prev, control.dataset.id)).catch(() => {}),
});

// Любимые
function spFavorites() {
  const C = SP(), liked = C.favoriteExercises(spState().state);
  if (!liked.length) return `<p class="section-note">Пока ничего не отмечено. Сердце стоит в строке упражнения, рядом с «Техникой» и «Весом»: отмеченные уходят в выгрузку для ИИ — он ставит их в план чаще.</p>`;
  return `<p class="section-note">Уходят в выгрузку для ИИ: он ставит их в план чаще, если это не мешает цели.</p><div class="sp-list">${liked.map(item => `<div class="sp-list-row"><span>${SP_ICON.heartOn}<b>${spEsc(item.name)}</b><small>отмечено ${item.addedOn.split("-").reverse().join(".")}</small></span><button class="icon-button" type="button" data-action="sp-unlike" data-key="${spEsc(item.key)}" aria-label="Убрать">${icon("close", "icon-sm")}</button></div>`).join("")}</div>`;
}
SP_ACTIONS["sp-unlike"] = control => spUpdate(prev => SP().removeFavorite(prev, control.dataset.key)).catch(() => {});

// История
function spHistory(sheet) {
  const C = SP(), state = spState().state, options = spOptions().visible;
  const view = sheet.view || "sessions";
  const tabs = `<div class="sp-segment small"><button type="button" class="${view === "sessions" ? "active" : ""}" data-action="sp-history-view" data-view="sessions">Занятия</button><button type="button" class="${view === "exercises" ? "active" : ""}" data-action="sp-history-view" data-view="exercises">По упражнениям</button></div>`;
  if (view === "sessions") {
    const workouts = C.workoutJournal(options, state);
    return `${tabs}<p class="section-note">Занятия и отмеченные подходы появляются здесь сами.</p>${workouts.length ? workouts.map(w => `<details class="sp-details"><summary>${spDateShort(w.date)} · ${spEsc(w.title)}</summary><p class="section-note">${spEsc(w.program)} · ${w.consciouslyFinished ? "завершена" : "частично выполнена"}${w.seconds ? ` · ${C.formatDuration(w.seconds)}` : ""}${w.status === "archived" ? " · план в архиве" : w.status === "deleted" ? " · план удалён" : ""}</p>${w.exercises.map(e => `<p class="sp-history-line"><span>${spEsc(e.name)}</span><b>${e.completedSets}/${e.plannedSets}</b></p>`).join("")}</details>`).join("") : `<p class="section-note">История пока пуста. Отметьте подход или завершите тренировку — она появится здесь.</p>`}`;
  }
  const stats = C.exerciseStats(options, state);
  return `${tabs}<p class="section-note">Сколько раз выполнено и как менялся рабочий вес. Упражнения объединяются по названию.</p>${stats.length ? stats.map(stat => {
    const weights = stat.weights, last = weights[weights.length - 1], first = weights[0];
    const mixed = new Set(weights.map(w => w.basis || "per_dumbbell")).size > 1;
    const peak = Math.max(...weights.map(w => w.kilograms), 1);
    const delta = last && first ? last.kilograms - first.kilograms : 0;
    return `<details class="sp-details"><summary>${spEsc(stat.name)} <small>${stat.sessions} ${spPlural(stat.sessions, "раз", "раза", "раз")}</small></summary><p class="section-note">Подходов: ${stat.completedSets} из ${stat.plannedSets} · последний раз ${spDateShort(stat.lastDate)}</p>
      ${weights.length ? `<div class="sp-weights"><p><span>${spEsc(C.WEIGHT_BASIS[last.basis || "per_dumbbell"])}</span><b>${spKg(last.kilograms)} кг${weights.length > 1 && !mixed && delta ? ` <em class="${delta > 0 ? "up" : "down"}">${delta > 0 ? "+" : "−"}${spKg(Math.abs(delta))}</em>` : ""}</b></p>${weights.slice(-8).map(w => `<div class="sp-weight-bar"><span>${spDateShort(w.date)}</span><i><b style="width:${Math.max(6, w.kilograms / peak * 100)}%"></b></i><strong>${spKg(w.kilograms)} кг${w.reps ? ` × ${w.reps}` : ""}</strong></div>`).join("")}</div>` : `<p class="section-note">Вес ещё не записан.</p>`}
</details>`;
  }).join("") : `<p class="section-note">Пока нечего показать. Отметьте подход или запишите вес.</p>`}`;
}
SP_ACTIONS["sp-history-view"] = control => { spState().sheet.view = control.dataset.view; render(); };

// ------------------------------------------------------------ настройки, программы, экспорт

SP_SHEETS.reminders = () => {
  const C = SP(), s = spState();
  const n = C.notificationSettings(s.state.notificationSettings);
  const zones = [...new Set([n.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone, "Europe/Moscow", "Europe/Kaliningrad", "Europe/Samara", "Asia/Yekaterinburg", "Asia/Omsk", "Asia/Krasnoyarsk", "Asia/Irkutsk", "Asia/Yakutsk", "Asia/Vladivostok", "Asia/Magadan", "Asia/Kamchatka", "Europe/Berlin", "UTC"])];
  const habits = Object.entries(s.state.customHabits || {}).filter(([, h]) => !h.archived);
  return { title: "Напоминания", body: `<form data-sp-form="notifications">${["shower", "workout"].map(kind => `<div class="sp-notify"><span>${kind === "wake" ? "Подъём" : kind === "shower" ? "Контрастный душ" : "Тренировка дня"}</span><input type="time" name="${kind}-time" value="${n[kind].time}" required><label class="sp-toggle"><input type="checkbox" name="${kind}-on" ${n[kind].enabled ? "checked" : ""}><span></span></label></div>`).join("")}
    ${habits.length ? `<p class="sp-kicker">Свои привычки</p>${habits.map(([id, h]) => `<button type="button" class="sp-list-row" data-action="sp-habit-edit" data-id="${spEsc(id)}"><span><b>${spEsc(h.name)}</b><small>${C.habitReminders(h).length ? C.habitReminders(h).map(r => r.time).join(", ") + (C.habitNotifies(h) ? "" : " · без сообщений") : "без напоминаний"}</small></span>${icon("arrow", "icon-sm")}</button>`).join("")}` : ""}
    <label class="field">Часовой пояс<select name="zone">${zones.map(z => `<option ${z === n.timeZone ? "selected" : ""}>${spEsc(z)}</option>`).join("")}</select></label>
    <p class="section-note">Приходят от бота Flow. Выполненное не напоминаем. Подъём и сон — в разделе «Сон».</p><button class="primary-button sp-wide" type="submit">Сохранить</button></form>` };
};
SP_SHEETS.programs = sheet => ({ title: sheet.archive ? "Архив программ" : "Программы", body: spProgramManager(sheet) });
SP_SHEETS.sizes = () => ({ title: "Размеры одежды", body: spSizes() });
SP_FORMS.notifications = form => {
  const C = SP(), get = name => form.elements[name];
  const settings = { timeZone: get("zone").value };
  for (const kind of ["shower", "workout"]) settings[kind] = { enabled: get(`${kind}-on`).checked, time: get(`${kind}-time`).value };
  settings.wake = { ...C.notificationSettings(spState().state.notificationSettings).wake, enabled: false };
  if (![settings.wake.time, settings.shower.time, settings.workout.time].every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t))) return spSheetError("Укажите время в формате ЧЧ:ММ.");
  try { new Intl.DateTimeFormat("ru-RU", { timeZone: settings.timeZone }); } catch (_) { return spSheetError("Неизвестный часовой пояс."); }
  spUpdate(prev => ({ ...prev, notificationSettings: C.notificationSettings(settings) })).then(() => toast("Напоминания сохранены")).catch(() => toast("Не сохранилось — проверьте связь"));
  spClose();
};
function spProgramManager(sheet) {
  const C = SP(), s = spState();
  const { all } = spOptions();
  const list = C.programSummaries(s.catalog, all, s.state);
  const status = key => s.state.programLifecycle?.[key]?.status ?? "active";
  const archive = Boolean(sheet.archive);
  const shown = list.filter(p => status(p.key) === (archive ? "archived" : "active"));
  const archivedCount = list.filter(p => status(p.key) === "archived").length;
  const rows = shown.map((p, i) => {
    const dates = [...p.dates].sort();
    const open = sheet.program === p.key;
    return `<div class="sp-program ${open ? "open" : ""}"><div class="sp-program-head">${!archive && shown.length > 1 ? `<b>${i + 1}</b>` : ""}<button type="button" data-action="sp-program-open" data-key="${spEsc(p.key)}"><strong>${spEsc(p.title)}</strong><small>${dates.length ? `${spDateShort(dates[0])} — ${spDateShort(dates[dates.length - 1])} · ${dates.length} ${spPlural(dates.length, "занятие", "занятия", "занятий")}` : "нет занятий"}</small></button>${!archive && i > 0 ? `<button class="icon-button" type="button" data-action="sp-program-raise" data-key="${spEsc(p.key)}" aria-label="Поднять выше">↑</button>` : ""}</div>
      ${open ? `<p class="section-note">Добавлена: ${p.addedAt ? new Date(p.addedAt).toLocaleDateString("ru-RU") : "дата не сохранена"}</p><div class="sp-row-actions"><button class="text-action" type="button" data-action="sp-program-status" data-key="${spEsc(p.key)}" data-status="${archive ? "active" : "archived"}">${archive ? "Вернуть из архива" : "В архив"}</button><button class="text-action danger" type="button" data-action="sp-program-delete" data-key="${spEsc(p.key)}">Удалить план</button></div>` : ""}</div>`;
  }).join("");
  return `${!archive && shown.length > 1 ? `<p class="section-note">Сверху — приоритетная: если планы совпали по датам, показывается она; прошедшие дни остаются за прежней программой.</p>` : ""}${rows || `<p class="section-note">${archive ? "Архив пуст." : "Нет активных программ."}</p>`}
    ${archive || archivedCount ? `<button class="text-action" type="button" data-action="sp-program-archive">${archive ? "К активным программам" : `Архив · ${archivedCount}`}</button>` : ""}
    <button class="ghost-button sp-wide" type="button" data-action="sp-import-open">Новая программа с ИИ</button>`;
}
function spExport(sheet) {
  return `<label class="field">Период истории<select data-sp-export="period"><option value="30" ${sheet.period === "30" || !sheet.period ? "selected" : ""}>30 дней</option><option value="90" ${sheet.period === "90" ? "selected" : ""}>90 дней</option><option value="all" ${sheet.period === "all" ? "selected" : ""}>Вся история</option></select></label>
    <label class="sp-check-line"><input type="checkbox" data-sp-export="profile" ${sheet.withProfile !== false ? "checked" : ""}>Данные профиля: анкета, замеры, инвентарь, фокус</label>
    <label class="sp-check-line"><input type="checkbox" data-sp-export="health" ${sheet.withHealth ? "checked" : ""} ${sheet.withProfile === false ? "disabled" : ""}>Здоровье и дополнительные замеры</label>`;
}
document.addEventListener("change", event => {
  const key = event.target.dataset?.spExport;
  if (!key) return;
  const sheet = spState().sheet;
  if (key === "period") sheet.period = event.target.value;
  if (key === "profile") { sheet.withProfile = event.target.checked; if (!sheet.withProfile) sheet.withHealth = false; }
  if (key === "health") sheet.withHealth = event.target.checked;
  sheet.packet = ""; render();
});
async function spPacket(options = {}) {
  const C = SP(), s = spState();
  return C.trainingPacket(s.state, spOptions().visible, spDay(), options);
}
async function spCopyPacket(options) {
  try {
    const packet = await spPacket(options);
    const copied = await SP().copyText(packet);
    toast(copied ? "Скопировано — вставьте в ИИ одним сообщением" : "Буфер недоступен — текст в предпросмотре");
    return packet;
  } catch (_) { toast("Не получилось собрать инструкцию — проверьте связь"); return ""; }
}
Object.assign(SP_ACTIONS, {
  "sp-programs": control => spOpen("programs", { archive: control.dataset.archive === "1" }),
  "sp-reminders": () => spOpen("reminders"),
  "sp-sizes": () => spOpen("sizes"),
  "sp-program-open": control => { const sheet = spState().sheet; sheet.program = sheet.program === control.dataset.key ? null : control.dataset.key; render(); },
  "sp-program-archive": () => { const sheet = spState().sheet; sheet.archive = !sheet.archive; sheet.program = null; render(); },
  "sp-program-raise": control => {
    const C = SP(), s = spState(), { all } = spOptions();
    const keys = C.programSummaries(s.catalog, all, s.state).filter(p => (s.state.programLifecycle?.[p.key]?.status ?? "active") === "active").map(p => p.key);
    spUpdate(prev => C.raiseProgram(prev, keys, control.dataset.key)).catch(() => {});
  },
  "sp-program-status": control => spUpdate(prev => SP().changeProgramStatus(prev, control.dataset.key, control.dataset.status)).catch(() => {}),
  "sp-program-delete": control => {
    if (!confirm("Удалить план из расписания? Занятия, подходы и веса останутся в истории. Вернуть удалённый план нельзя — для нового понадобится новый ID.")) return;
    spUpdate(prev => SP().changeProgramStatus(prev, control.dataset.key, "deleted")).catch(() => {});
  },
  "sp-export-copy": async () => {
    const sheet = spState().sheet;
    const packet = await spCopyPacket({ periodDays: sheet.period === "all" ? null : Number(sheet.period || 30), profile: sheet.withProfile !== false, health: Boolean(sheet.withHealth) });
    if (packet && spState().sheet === sheet) { sheet.packet = packet; render(); }
  },
  "sp-copy-packet": () => spAiOpen(),
});

// AI generation and optional manual import share the same validated preview.
SP_SHEETS.import = sheet => spAiSheet(sheet);

document.addEventListener("input", event => {
  if (!event.target.matches?.("[data-sp-import-text]")) return;
  const sheet = spState().sheet;
  const had = Boolean(sheet.text?.trim());
  sheet.text = event.target.value; sheet.generated = false; sheet.preview = null; spState().sheetError = "";
  const button = document.querySelector('[data-action="sp-import-check"]'); if (button) button.disabled = !sheet.text.trim();
  if (had !== Boolean(sheet.text.trim())) return;
});
document.addEventListener("change", async event => {
  if (!event.target.matches?.("[data-sp-import-file]")) return;
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > SP().MAX_IMPORT_BYTES) return spSheetError("Файл больше 2 МиБ.");
  try { const sheet = spState().sheet; const text = await file.text(); if (spState().sheet !== sheet) return; sheet.text = text; sheet.generated = false; sheet.preview = null; render(); }
  catch (_) { spSheetError("Не удалось прочитать файл. Попробуйте вставить текст."); }
});
function spImportCheck(text) {
  const C = SP(), s = spState();
  const input = C.parsePlan(text);
  const status = s.state.programLifecycle?.[`v2|${input.program.id}`]?.status;
  if (status === "deleted") throw new Error("Этот план удалён. Для новой программы используйте новый program.id; старая история останется.");
  if (status === "archived") throw new Error("Эта программа в архиве. Сначала верните её в «Программах» или используйте новый program.id.");
  const result = C.mergeCatalog(s.catalog, input);
  const occupied = new Set(spOptions().all.map(o => `${o.date}|${o.kind}`));
  let alternatives = 0;
  for (const w of input.workouts) {
    if (C.hasOwn(s.catalog, input.program.id) && C.hasOwn(s.catalog[input.program.id].workouts, w.id)) continue;
    const slot = `${w.date}|${w.kind}`;
    if (occupied.has(slot)) alternatives++;
    occupied.add(slot);
  }
  return { added: result.added, duplicates: result.duplicates, alternatives, title: input.program.title, dates: input.workouts.map(w => w.date).sort(), timezone: input.program.timezone, myZone: C.notificationSettings(s.state.notificationSettings).timeZone };
}
Object.assign(SP_ACTIONS, {
  "sp-import-open": () => spAiOpen(),
  "sp-import-check": () => {
    const sheet = spState().sheet;
    try { sheet.preview = spImportCheck(sheet.text || ""); spState().sheetError = ""; render(); }
    catch (error) { sheet.preview = null; spSheetError(error.message || "Не удалось прочитать JSON"); }
  },
  "sp-import-save": async () => {
    const s = spState(), sheet = s.sheet;
    if (!sheet.preview || sheet.saving || sheet.generating) return;
    sheet.saving = true; render();
    try {
      spImportCheck(sheet.text);
      const answer = await spCall("import", { json: sheet.text });
      if (!answer || answer.error) throw new Error(answer?.error || "Сервер не подтвердил импорт. Можно безопасно повторить.");
      s.catalog = answer.catalog || s.catalog;
      if (answer.state) { s.state = SP().applyStateChanges(answer.state, s.pending); spRevision++; }
      toast(answer.added ? `Добавлено занятий: ${answer.added}` : "Этот план уже добавлен");
      if (s.sheet === sheet) { s.sheet = null; s.tab = "training"; } render();
    } catch (error) { sheet.saving = false; if (s.sheet === sheet) spSheetError(error.message); }
  },
});
