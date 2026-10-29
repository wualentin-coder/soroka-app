/* Server-owned resumable draft; only the existing import action saves a plan. */
let spAiPoll = null;
function spAiSheet(sheet) {
  const profile = spState().state?.trainingProfile || {},
    busy = sheet.generating || sheet.saving || sheet.chat?.busy;
  return {
    title: "Новая программа с ИИ",
    body: `<section class="sp-group sp-ai-create">
    ${
      sheet.chat
        ? spAiChatView(sheet)
        : `<p class="section-note">Ассистент уточнит пожелания и составит программу по вашей анкете и фактическим подходам за последние 7 дней.</p>
    <fieldset class="sp-ai-fields" ${busy ? "disabled" : ""}>
      <div class="field-row"><label class="field">Начало<input type="date" data-sp-ai="start" value="${
          spEsc(sheet.start || SP().todayKey())
        }" min="${SP().todayKey()}" required></label><label class="field">Окончание<input type="date" data-sp-ai="end" value="${
          spEsc(
            sheet.end || SP().offsetDateKey(sheet.start || SP().todayKey(), 6),
          )
        }" min="${
          spEsc(sheet.start || SP().todayKey())
        }" required></label></div>
      <div><p class="sp-kicker">Направление</p><div class="sp-ai-directions" role="group" aria-label="Направление программы">${
          [["profile", "По анкете"], ["main", "Сила"], ["splits", "Растяжка"]]
            .map(([key, title]) =>
              `<button type="button" data-action="sp-ai-direction" data-key="${key}" aria-pressed="${
                (sheet.direction || "profile") === key
              }">${title}</button>`
            ).join("")
        }</div></div>
      <p class="section-note">${
          spEsc(
            profile.schedule
              ? `${profile.schedule} занятий в неделю`
              : "Частоту уточнит ассистент",
          )
        }${
          profile.sessionMinutes
            ? ` · ${spEsc(profile.sessionMinutes)} мин`
            : ""
        } · <button type="button" class="text-action" data-action="sp-profile-section" data-section="profile">Анкета</button></p>
      <label class="sp-check-line"><input type="checkbox" data-sp-ai="health" ${
          sheet.withHealth ? "checked" : ""
        }>Учитывать сведения о здоровье из анкеты</label>
    </fieldset>`
    }
    ${
      sheet.generating
        ? `<div class="sp-ai-status" role="status" aria-live="polite">Подготавливаю программу…<small>${
          sheet.totalWeeks
            ? `Готово недель: ${
              sheet.completedWeeks || 0
            } из ${sheet.totalWeeks}. `
            : ""
        }Можно закрыть окно — подготовка продолжится.</small></div><button type="button" class="ghost-button sp-wide" data-action="sp-ai-cancel" ${
          sheet.cancelling || sheet.starting ? "disabled" : ""
        }>${
          sheet.cancelling ? "Останавливаю…" : "Остановить подготовку"
        }</button>`
        : ""
    }
    ${
      sheet.aiError
        ? `<p class="sp-error" role="alert">${spEsc(sheet.aiError)}</p>`
        : ""
    }
    ${
      sheet.unknown
        ? `<button type="button" class="ghost-button sp-wide" data-action="sp-ai-refresh" ${
          sheet.checking ? "disabled" : ""
        }>${sheet.checking ? "Проверяю…" : "Проверить состояние"}</button>`
        : sheet.canRetry && !sheet.generating
        ? '<button type="button" class="primary-button sp-wide" data-action="sp-ai-resume">Продолжить подготовку</button>'
        : !sheet.chat && !sheet.generating
        ? `<button type="button" class="${
          sheet.preview ? "ghost-button" : "primary-button"
        } sp-wide" data-action="sp-ai-generate">${
          sheet.chatDraft
            ? "Продолжить обсуждение"
            : sheet.preview
            ? "Обсудить другой вариант"
            : "Составить программу"
        }</button>`
        : ""
    }
    ${sheet.preview ? spAiPreview(sheet) : ""}
    ${!sheet.chat && !sheet.generating ? spAiManualImport(sheet, busy) : ""}
  </section>`,
  };
}
function spAiManualImport(sheet, busy) {
  return `<details class="sp-details"><summary>Импорт готовой программы</summary><div class="sp-ai-manual"><p class="section-note">Загрузите готовый план или вставьте ответ другого ИИ.</p>
    <label class="field">Файл .json<input type="file" accept=".json,application/json" data-sp-import-file ${
    busy ? "disabled" : ""
  }></label>
    <label class="field">Текст программы<textarea rows="5" spellcheck="false" data-sp-import-text ${
    busy ? "disabled" : ""
  }>${spEsc(sheet.generated ? "" : sheet.text || "")}</textarea></label>
    <button class="ghost-button sp-wide" type="button" data-action="sp-import-check" ${
    !sheet.text?.trim() || busy ? "disabled" : ""
  }>Проверить</button>
    <details class="sp-details"><summary>Инструкция для другого ИИ</summary>${
    spExport(sheet)
  }<button class="ghost-button sp-wide" type="button" data-action="sp-export-copy">Скопировать инструкцию + данные</button>${
    sheet.packet
      ? `<label class="field">Инструкция и данные<textarea rows="5" readonly>${
        spEsc(sheet.packet)
      }</textarea></label>`
      : ""
  }</details>
  </div></details>`;
}
function spAiPreview(sheet) {
  const preview = sheet.preview, plan = SP().parsePlan(sheet.text);
  return `<section class="sp-preview sp-ai-preview"><p class="sp-kicker">Проверьте перед добавлением</p><h3>${
    spEsc(preview.title)
  }</h3><p class="section-note">${spDateShort(preview.dates[0])} — ${
    spDateShort(preview.dates.at(-1))
  } · новых занятий: ${preview.added}</p>
    ${
    preview.alternatives
      ? `<p class="section-note">На занятые даты добавятся варианты. Прежние занятия останутся.</p>`
      : ""
  }
    ${
    plan.workouts.map((w) =>
      `<details class="sp-details"><summary>${spDateShort(w.date)} · ${
        spEsc(w.title)
      }</summary><p class="section-note">${spEsc(w.focus)}</p>${
        w.blocks.map((b) =>
          `<p class="sp-kicker">${
            spEsc(b.title)
          }</p><ul class="sp-ai-exercises">${
            b.exercises.map((e) =>
              `<li><b>${spEsc(e.name)}</b><span>${e.sets} × ${
                e.mode === "reps"
                  ? spEsc(e.reps)
                  : e.mode === "timed"
                  ? `${e.work_seconds} с`
                  : spEsc(e.target)
              }${
                e.weight_kg !== undefined
                  ? ` · ${e.weight_kg} кг (${
                    spEsc(
                      {
                        per_dumbbell: "на гантель",
                        total: "общий вес",
                        machine: "тренажёр",
                        additional: "дополнительно",
                      }[e.weight_basis],
                    )
                  })`
                  : ""
              }</span><small>${spEsc(e.technique)}</small></li>`
            ).join("")
          }</ul>`
        ).join("")
      }</details>`
    ).join("")
  }
    ${
    preview.timezone !== preview.myZone
      ? `<p class="section-note">Пояс программы: ${
        spEsc(preview.timezone)
      }; ваш: ${spEsc(preview.myZone)}.</p>`
      : ""
  }
    ${
    preview.added
      ? `<button class="primary-button sp-wide" type="button" data-action="sp-import-save" ${
        sheet.saving || sheet.generating || sheet.chat?.busy ||
          sheet.chat?.draft?.trim()
          ? "disabled"
          : ""
      }>${sheet.saving ? "Добавляю…" : "Добавить программу"}</button>`
      : '<p class="section-note">Все занятия уже добавлены.</p>'
  }</section>`;
}
function spAiOpen() {
  clearTimeout(spAiPoll);
  const s = spState();
  if (s.aiBuilder) {
    s.sheet = s.aiBuilder;
    s.sheetError = "";
    render();
  } else {
    spOpen("import", {
      start: SP().todayKey(),
      end: SP().offsetDateKey(SP().todayKey(), 6),
      direction: "profile",
      checking: true,
      unknown: true,
    });
    s.aiBuilder = s.sheet;
  }
  if (
    !s.sheet.chat && !s.sheet.chatDraft || s.sheet.generating || s.sheet.unknown
  ) {
    spAiRefresh(s.sheet);
  }
}
function spAiAccept(sheet, answer) {
  if (!answer || answer.error && !answer.status) {
    throw new Error(answer?.error || "Нет ответа сервера");
  }
  if(sheet.requestId&&answer.requestId&&sheet.requestId!==answer.requestId){
    sheet.generating=false;sheet.unknown=false;sheet.canRetry=false;
    sheet.aiError=['queued','running'].includes(answer.status)?'Сейчас готовится другая программа. Дождитесь завершения и повторите.':'Новый запрос ещё не подтверждён. Можно повторить подготовку — ваши условия сохранены.';
    return;
  }
  sheet.generating = ["queued", "running"].includes(answer.status);
  sheet.unknown = false;
  sheet.aiError = answer.status === "failed" ? answer.error : "";
  if (answer.requestId) sheet.requestId = answer.requestId;
  sheet.completedWeeks = answer.completedWeeks || 0;
  sheet.totalWeeks = answer.totalWeeks;
  sheet.canRetry = Boolean(answer.canRetry);
  if ((sheet.generating || sheet.canRetry) && !sheet.chat && answer.options) {
    Object.assign(sheet, answer.options);
    sheet.chat = {
      messages: answer.messages || [],
      choices: [],
      preferences: answer.preferences || {},
      ready: true,
      draft: "",
    };
  }
  if (answer.status === "failed" && !sheet.canRetry) sheet.requestId = null;
  if (answer.status === "ready" && (!sheet.text || sheet.generated)) {
    try {
      const preview = spImportCheck(answer.json);
      sheet.text = answer.json;
      sheet.preview = preview;
      sheet.generated = true;
    } catch (error) {
      sheet.aiError = error.message ||
        "Черновик больше не подходит. Составьте новый вариант.";
      sheet.requestId = null;
      sheet.generated = false;
      sheet.text = "";
      sheet.preview = null;
    }
  }
  if (sheet.generating && spState().sheet === sheet) {
    spAiPoll = setTimeout(() => spAiRefresh(sheet), 3000);
  }
}
async function spAiRefresh(sheet) {
  if (spState().sheet !== sheet || sheet.fetching) return;
  const state = () =>
    JSON.stringify([
      sheet.generating,
      sheet.unknown,
      sheet.checking,
      sheet.aiError,
      sheet.completedWeeks,
      sheet.totalWeeks,
      sheet.canRetry,
      sheet.preview,
      sheet.text,
      !!sheet.chat,
    ]);
  const before = state();
  sheet.fetching = true;
  sheet.checking = true;
  try {
    spAiAccept(sheet, await spCall("generation"));
  } catch (_) {
    sheet.aiError =
      "Не удалось проверить черновик. Проверьте связь и повторите.";
    sheet.unknown = true;
    sheet.generating = false;
  } finally {
    sheet.fetching = false;
    sheet.checking = false;
    if (state() !== before) spAiPaint(sheet);
  }
}
document.addEventListener("input", (event) => {
  const key = event.target.dataset?.spAi, sheet = spState().sheet;
  if (!key || sheet?.kind !== "import" || sheet.generating) return;
  if (key === "start") {
    sheet.start = event.target.value;
    const end = document.querySelector('[data-sp-ai="end"]');
    if (end) end.min = sheet.start;
  }
  if (key === "end") sheet.end = event.target.value;
  if (key === "health") sheet.withHealth = event.target.checked;
  if (key === "answer" && sheet.chat) {
    sheet.chat.draft = event.target.value;
    event.target.style.height = "auto";
    event.target.style.height =
      Math.max(44, Math.min(96, event.target.scrollHeight)) + "px";
    for (
      const button of document.querySelectorAll(
        '[data-action="sp-ai-prepare"],[data-action="sp-import-save"]',
      )
    ) button.disabled = !!sheet.chat.draft.trim() || sheet.chat.busy;
  }
});
Object.assign(SP_ACTIONS, {
  "sp-ai-direction": (control) => {
    const sheet = spState().sheet;
    if (sheet.generating || sheet.saving) return;
    sheet.direction = control.dataset.key;
    render();
  },
  "sp-ai-refresh": () => spAiRefresh(spState().sheet),
  "sp-ai-prepare": async () => {
    const s = spState(), sheet = s.sheet;
    if (
      sheet?.kind !== "import" || sheet.generating || sheet.saving ||
      sheet.unknown || !sheet.chat?.ready || sheet.chat.busy ||
      sheet.chat.draft?.trim()
    ) return;
    if (s.demo) {
      return spSheetError(
        "Составление программы доступно в подключённом приложении Flow.",
      );
    }
    sheet.generating = true;
    sheet.starting = true;
    sheet.aiError = "";
    sheet.unknown = false;
    // A lost start response is retried with this id, never a second AI task.
    if (sheet.generated) sheet.requestId = null;
    sheet.requestId ||= crypto.randomUUID();
    render();
    try {
      await spFlush();
      const context = SP().buildTrainingContext(
        s.state,
        spOptions().visible,
        spDay(),
        7,
        Boolean(sheet.withHealth),
        true,
      );
      const answer = await spCall("generate", {
        requestId: sheet.requestId,
        context,
        start: sheet.start || SP().todayKey(),
        end: sheet.end || SP().offsetDateKey(sheet.start || SP().todayKey(), 6),
        direction: sheet.direction || "profile",
        messages: sheet.chat.messages.map((m) => ({
          role: m.role,
          text: m.text,
        })),
        preferences: sheet.chat.preferences || {},
      });
      sheet.text = "";
      sheet.preview = null;
      sheet.generated = false;
      spAiAccept(sheet, answer);
    } catch (error) {
      sheet.generating = false;
      sheet.unknown = true;
      sheet.aiError = error.message ||
        "Не удалось связаться. Проверьте состояние перед повтором.";
    } finally {
      sheet.starting = false;
      spAiPaint(sheet);
    }
  },
});
