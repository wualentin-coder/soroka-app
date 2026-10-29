function spAiChatView(sheet) {
  const chat = sheet.chat, busy = chat.busy || sheet.generating || sheet.saving;
  return `<div class="sp-ai-chat-meta"><span>${spDateShort(sheet.start)} — ${
    spDateShort(sheet.end || SP().offsetDateKey(sheet.start, 6))
  }</span><button type="button" class="text-action" data-action="sp-ai-edit" ${
    busy ? "disabled" : ""
  }>Изменить период</button></div>
    <section class="sp-ai-chat ${sheet.generating?'is-generating':''}" aria-label="Диалог о программе тренировок">
      <div class="en-chat-head"><span class="sp-ai-avatar">${SP_ICON.dumbbell}</span><div><b>Тренер Flow</b><span class="en-chat-status">${
    chat.busy
      ? "Думает над ответом…"
      : sheet.generating
      ? "Готовит программу"
      : chat.ready
      ? "Условия согласованы"
      : "Уточнит программу под вас"
  }</span></div><button type="button" class="icon-button" data-action="sp-ai-chat-reset" aria-label="Начать диалог заново" title="Начать диалог заново" ${
    busy ? "disabled" : ""
  }>${icon("reset")}</button></div>
      <div class="sp-ai-messages" role="log" aria-label="Сообщения ассистента">${
    chat.messages.map((m) =>
      `<div class="sp-ai-message ${
        m.role === "user" ? "me" : "ai"
      }"><span class="sp-ai-bubble">${spEsc(m.text)}</span></div>`
    ).join("")
  }
        ${
    chat.busy
      ? '<div class="sp-ai-thinking" role="status" aria-label="Ассистент думает"><i></i><i></i><i></i></div>'
      : ""
  }
        ${
    !chat.busy && !chat.ready && !sheet.generating && chat.choices?.length
      ? `<div class="sp-ai-choices" role="group" aria-label="Варианты ответа">${
        chat.choices.map((text, i) =>
          `<button type="button" data-action="sp-ai-answer" data-index="${i}">${
            spEsc(text)
          }</button>`
        ).join("")
      }</div>`
      : ""
  }
        ${
    chat.error
      ? `<p class="sp-error" role="alert">${
        spEsc(chat.error)
      }</p><button type="button" class="ghost-button sp-wide" data-action="sp-ai-consult-retry">Повторить ответ</button>`
      : ""
  }
      </div>
      <form class="sp-ai-compose" data-sp-form="ai-chat"><textarea rows="1" maxlength="2000" name="answer" data-sp-ai="answer" aria-label="Свой ответ ассистенту" placeholder="Свой ответ или пожелание…" ${
    busy ? "disabled" : ""
  }>${
    spEsc(chat.draft || "")
  }</textarea><button type="submit" class="icon-button" aria-label="Отправить ответ" ${
    busy ? "disabled" : ""
  }>${icon("arrow")}</button></form>
    </section>
    ${
    chat.ready && !sheet.generating && !sheet.preview && !sheet.canRetry
      ? `<button type="button" class="primary-button sp-wide" data-action="sp-ai-prepare" ${
        chat.busy || chat.draft?.trim() || sheet.unknown ? "disabled" : ""
      }>Подготовить план</button>`
      : ""
  }`;
}
function spAiPaint(sheet, scroll = false) {
  if (spState().sheet !== sheet) return;
  const old = document.querySelector(".sp-ai-messages"),
    top = old?.scrollTop ?? sheet.chat?.scrollTop ?? 0;
  const bottom = old
    ? old.scrollHeight - old.clientHeight - old.scrollTop < 40
    : false;
  render();
  requestAnimationFrame(() => {
    const box = document.querySelector(".sp-ai-messages");
    if (box && spState().sheet === sheet) {
      box.scrollTop = scroll || bottom ? box.scrollHeight : top;
      if (sheet.chat) sheet.chat.scrollTop = box.scrollTop;
    }
  });
}
function spAiContext(sheet) {
  const s = spState();
  return SP().buildTrainingContext(
    s.state,
    spOptions().visible,
    spDay(),
    7,
    Boolean(sheet.withHealth),
    true,
  );
}
async function spAiAsk(sheet) {
  const chat = sheet.chat;
  if (!chat || chat.busy || sheet.generating) return;
  chat.busy = true;
  chat.error = "";
  chat.ready = false;
  spAiPaint(sheet, true);
  try {
    const reply = await spCall("consult", {
      context: spAiContext(sheet),
      start: sheet.start,
      end: sheet.end,
      direction: sheet.direction || "profile",
      preferences: chat.preferences || {},
      messages: chat.messages.map((m) => ({ role: m.role, text: m.text })),
    });
    if (sheet.chat !== chat) return;
    if (
      !reply || reply.error || typeof reply.message !== "string" ||
      typeof reply.ready !== "boolean" || !Array.isArray(reply.choices) ||
      reply.choices.length > 3
    ) throw new Error("Не получилось прочитать ответ ассистента.");
    chat.messages.push({ role: "assistant", text: reply.message });
    chat.choices = reply.choices;
    chat.ready = reply.ready;
    chat.preferences = reply.preferences || {};
    if (["profile", "main", "splits"].includes(chat.preferences.direction)) {
      sheet.direction = chat.preferences.direction;
    }
    sheet.chatConfig = JSON.stringify([
      sheet.start,
      sheet.end,
      sheet.direction || "profile",
      !!sheet.withHealth,
    ]);
  } catch (error) {
    if (sheet.chat === chat) {
      chat.error =
        String(error.message || "").startsWith("Диалог слишком длинный")
          ? "Диалог получился длинным. Начните новый кнопкой в шапке."
          : "Ассистент не ответил. Ваш ответ сохранён — попробуйте ещё раз.";
    }
  } finally {
    chat.busy = false;
    spAiPaint(sheet, true);
  }
}
async function spAiChatSend(sheet, text) {
  const chat = sheet.chat;
  if (
    !chat || chat.busy || sheet.generating || !text.trim() ||
    text.trim().length > 2000
  ) return;
  chat.messages.push({ role: "user", text: text.trim() });
  chat.draft = "";
  chat.choices = [];
  chat.ready = false;
  sheet.preview = null;
  sheet.text = "";
  sheet.generated = false;
  sheet.requestId = null;
  sheet.canRetry = false;
  await spAiAsk(sheet);
}
Object.assign(SP_ACTIONS, {
  "sp-ai-chat-reset": () => {
    const sheet = spState().sheet;
    if (sheet.generating || sheet.chat?.busy) return;
    sheet.chat = null;
    sheet.chatDraft = null;
    return SP_ACTIONS["sp-ai-generate"]();
  },
  "sp-ai-generate": async () => {
    const s = spState(), sheet = s.sheet;
    if (
      sheet?.kind !== "import" || sheet.generating || sheet.saving ||
      sheet.unknown || sheet.chat?.busy
    ) return;
    if (s.demo) {
      return spSheetError("Ассистент доступен в подключённом приложении Flow.");
    }
    const start = sheet.start || SP().todayKey(),
      end = sheet.end || SP().offsetDateKey(start, 6);
    if (
      start < SP().todayKey() || start > SP().offsetDateKey(SP().todayKey(), 90)
    ) {
      return spSheetError(
        "Начало программы — от сегодня до трёх месяцев вперёд.",
      );
    }
    if (!start || !end || end < start) {
      return spSheetError("Окончание программы должно быть не раньше начала.");
    }
    sheet.start = start;
    sheet.end = end;
    const config = JSON.stringify([
      start,
      end,
      sheet.direction || "profile",
      !!sheet.withHealth,
    ]);
    if (sheet.chatDraft) {
      sheet.chat = sheet.chatDraft;
      sheet.chatDraft = null;
      if (sheet.chatConfig === config) {
        spAiPaint(sheet, true);
        return;
      }
      sheet.chat.messages.push({
        role: "user",
        text: `Изменяю параметры программы: ${
          ({ profile: "по целям анкеты", main: "сила", splits: "растяжка" })[
            sheet.direction || "profile"
          ]
        }, период ${start} — ${end}. Остальные пожелания сохраняются.`,
      });
      sheet.chat.preferences = {
        ...sheet.chat.preferences,
        direction: sheet.direction || "profile",
      };
    } else {sheet.chat = {
        messages: [],
        choices: [],
        preferences: {},
        ready: false,
        draft: "",
      };}
    sheet.chatConfig = config;
    sheet.text = "";
    sheet.preview = null;
    sheet.generated = false;
    sheet.aiError = "";
    sheet.requestId = null;
    sheet.canRetry = false;
    await spAiAsk(sheet);
  },
  "sp-ai-answer": (control) => {
    const sheet = spState().sheet;
    const text = sheet.chat?.choices?.[Number(control.dataset.index)];
    if (text) return spAiChatSend(sheet, text);
  },
  "sp-ai-consult-retry": () => spAiAsk(spState().sheet),
  "sp-ai-edit": () => {
    const sheet = spState().sheet;
    if (sheet.generating || sheet.chat?.busy) return;
    sheet.chatDraft = sheet.chat;
    sheet.chat = null;
    sheet.aiError = "";
    sheet.canRetry = false;
    sheet.requestId = null;
    spAiPaint(sheet);
  },
  "sp-ai-resume": async () => {
    const sheet = spState().sheet;
    if (!sheet.canRetry || sheet.generating) return;
    sheet.generating = true;
    sheet.aiError = "";
    spAiPaint(sheet);
    try {
      spAiAccept(
        sheet,
        await spCall("generate", { requestId: sheet.requestId, retry: true }),
      );
    } catch (_) {
      sheet.generating = false;
      sheet.unknown = true;
      sheet.aiError = "Не удалось продолжить. Проверьте состояние черновика.";
    } finally {
      spAiPaint(sheet);
    }
  },
  "sp-ai-cancel": async () => {
    const sheet = spState().sheet;
    if (sheet.cancelling || sheet.starting) return;
    sheet.cancelling = true;
    spAiPaint(sheet);
    try {
      const answer = await spCall("cancel_generation", {
        requestId: sheet.requestId,
      });
      if (answer.requestId !== sheet.requestId || answer.status !== "failed") {
        throw new Error("Подготовка уже изменилась.");
      }
      spAiAccept(sheet, answer);
      sheet.generating = false;
      sheet.canRetry = false;
      sheet.unknown = false;
      sheet.aiError = "";
      sheet.requestId = null;
    } catch (_) {
      sheet.aiError = "Не удалось остановить подготовку. Проверьте связь.";
    } finally {
      sheet.cancelling = false;
      spAiPaint(sheet);
    }
  },
});
SP_FORMS["ai-chat"] = (form) =>
  spAiChatSend(spState().sheet, form.elements.answer.value);
