/* Sport 2.0 · E8 foundations: цель, опыт, домашний инвентарь и ограничения.
   Только реальные сохранённые значения; пустое поле — «не указано». */
(() => {
  "use strict";
  const esc = window.esc || ((value) => String(value ?? ""));
  const C = () => window.SportCore;
  const current = () => C().readSport2Profile(spState().state.sport2Profile);
  const summary = () => C().sport2ProfileSummary(spState().state.sport2Profile);

  function card() {
    const profile = current(), info = summary();
    if (!profile.filled) {
      return `<section class="sp2-e8 sp2-e8-empty">
        <div><p class="sp-kicker">Тренер учитывает</p><h2>Профиль не заполнен</h2>
        <p class="section-note">Цель, опыт, инвентарь и ограничения меняют программу, анализ и замены.</p></div>
        <button class="primary-button" type="button" data-action="sp2-profile-open">Заполнить</button></section>`;
    }
    const effect = info.goal || info.experience || info.equipment || info.limits;
    return `<section class="sp2-e8">
      <div class="sp2-e8-head"><p class="sp-kicker">Тренер учитывает</p><button class="text-action" type="button" data-action="sp2-profile-open">Изменить</button></div>
      <div class="sp2-e8-rows">
        <div><span>Цель</span><b>${esc(info.goal || "не указана")}</b></div>
        <div><span>Опыт</span><b>${esc(info.experience || "не указан")}</b></div>
        <div><span>Инвентарь</span><b>${esc(info.equipment || "не указан")}</b></div>
        <div><span>Ограничения</span><b>${esc(info.limits)}</b></div>
      </div>
      <div class="sp2-e8-effect"><span>Как это влияет</span><p>${esc(effect)}</p></div>
      <p class="sp2-e8-note">Профиль уходит тренеру вместе с фактическими подходами. Ограничения также блокируют замены в E14.</p>
    </section>`;
  }

  function draftOf(sheet) {
    if (!sheet.draft) {
      const profile = current();
      sheet.draft = {
        goal: profile.goal, experience: profile.experience,
        equipment: [...profile.equipment], limits: [...profile.limits],
      };
    }
    return sheet.draft;
  }

  const choices = (items, selected, action) => items.map((item) => `<button type="button" class="sp2-e8-choice" data-action="${action}" data-id="${esc(item.id)}" aria-pressed="${selected === item.id}"><b>${esc(item.label)}</b><small>${esc(item.effect || "")}</small></button>`).join("");
  const chips = (items, selected, action) => items.map((item) => `<button type="button" class="sp2-e8-chip" data-action="${action}" data-id="${esc(item.id)}" aria-pressed="${selected.includes(item.id)}">${esc(item.label)}</button>`).join("");

  SP_SHEETS["sport2-profile"] = (sheet) => {
    const draft = draftOf(sheet);
    return {
      title: "Профиль тренера",
      body: `<p class="section-note">Четыре поля, которые меняют программу. Пустое поле честно означает «не указано».</p>
        <section class="sp2-e8-sec"><h3>Цель</h3><div class="sp2-e8-choices">${choices(C().SPORT2_GOALS, draft.goal, "sp2p-goal")}</div></section>
        <section class="sp2-e8-sec"><h3>Опыт</h3><div class="sp2-e8-choices">${choices(C().SPORT2_EXPERIENCE, draft.experience, "sp2p-exp")}</div></section>
        <section class="sp2-e8-sec"><h3>Домашний инвентарь</h3><p class="section-note">Свой вес доступен всегда.</p><div class="sp2-e8-chips">${chips(C().SPORT2_EQUIPMENT, draft.equipment, "sp2p-equip")}</div></section>
        <section class="sp2-e8-sec"><h3>Ограничения</h3><p class="section-note">Не диагноз: при боли и онемении упражнение исключается.</p><div class="sp2-e8-chips">${chips(C().SPORT2_LIMITS, draft.limits, "sp2p-limit")}<button type="button" class="sp2-e8-chip" data-action="sp2p-limit-none" aria-pressed="${draft.limits.length === 0}">Нет</button></div></section>
        <div class="sheet-actions"><button class="ghost-button" type="button" data-action="sp2p-reset">Сбросить</button><button class="primary-button" type="button" data-action="sp2p-save">Сохранить</button></div>`,
    };
  };

  const toggle = (list, id) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id];

  Object.assign(SP_ACTIONS, {
    "sp2-profile-open": () => spOpen("sport2-profile"),
    "sp2p-goal": (control) => {
      const sheet = spState().sheet;
      if (!sheet || sheet.kind !== "sport2-profile") return;
      const draft = draftOf(sheet);
      draft.goal = draft.goal === control.dataset.id ? null : control.dataset.id;
      render();
    },
    "sp2p-exp": (control) => {
      const sheet = spState().sheet;
      if (!sheet || sheet.kind !== "sport2-profile") return;
      const draft = draftOf(sheet);
      draft.experience = draft.experience === control.dataset.id ? null : control.dataset.id;
      render();
    },
    "sp2p-equip": (control) => {
      const sheet = spState().sheet;
      if (!sheet || sheet.kind !== "sport2-profile") return;
      const draft = draftOf(sheet);
      draft.equipment = toggle(draft.equipment, control.dataset.id);
      render();
    },
    "sp2p-limit": (control) => {
      const sheet = spState().sheet;
      if (!sheet || sheet.kind !== "sport2-profile") return;
      const draft = draftOf(sheet);
      draft.limits = toggle(draft.limits, control.dataset.id);
      render();
    },
    "sp2p-limit-none": () => {
      const sheet = spState().sheet;
      if (!sheet || sheet.kind !== "sport2-profile") return;
      draftOf(sheet).limits = [];
      render();
    },
    "sp2p-reset": () => {
      const sheet = spState().sheet;
      if (!sheet || sheet.kind !== "sport2-profile") return;
      sheet.draft = { goal: null, experience: null, equipment: [], limits: [] };
      render();
    },
    "sp2p-save": () => {
      const sheet = spState().sheet;
      if (!sheet || sheet.kind !== "sport2-profile") return;
      const draft = draftOf(sheet);
      const profile = {
        ...(draft.goal ? { goal: draft.goal } : {}),
        ...(draft.experience ? { experience: draft.experience } : {}),
        equipment: [...draft.equipment],
        limits: [...draft.limits],
      };
      spUpdate((prev) => ({ ...prev, sport2Profile: profile })).catch(() => toast("Не сохранилось — проверьте связь"));
      spClose();
      toast("Профиль обновлён · анализ пересчитан");
    },
  });

  window.SportE8 = { card, current, summary };
})();
