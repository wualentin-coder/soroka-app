/* Часы → Health Connect. Мост существует только в Android-приложении Flow. */
(() => {
  if (window.SportHealth) return;
  const bridge = window.FlowSportHealth;
  const available = typeof bridge?.postMessage === "function";
  const pending = new Map();
  let serial = 0;
  let state = null;
  let busy = "";
  const failure = message => new Error(message || "Не удалось связаться с приложением. Попробуйте ещё раз.");
  const unavailable = () => ({ available: false, enabled: false, status: "unsupported", provider: "health-connect" });

  if (available) bridge.onmessage = event => {
    let reply;
    try { reply = JSON.parse(String(event.data)); } catch (_) { return; }
    const task = pending.get(reply?.id);
    if (!task) return;
    pending.delete(reply.id);
    clearTimeout(task.timer);
    if (reply.ok === true && reply.state && typeof reply.state === "object" && !Array.isArray(reply.state)) task.resolve(reply.state);
    else task.reject(failure(typeof reply.error === "string" ? reply.error : ""));
  };

  function request(action) {
    if (!available) return Promise.resolve(unavailable());
    const id = `sport${++serial}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(failure("Приложение не ответило. Закройте системное окно и попробуйте ещё раз."));
      }, action === "connect" ? 180000 : action === "sync" ? 90000 : 15000);
      pending.set(id, { resolve, reject, timer });
      try { bridge.postMessage(JSON.stringify({ id, action })); }
      catch (_) { clearTimeout(timer); pending.delete(id); reject(failure()); }
    });
  }

  addEventListener("pagehide", () => {
    for (const task of pending.values()) { clearTimeout(task.timer); task.reject(failure("Окно приложения закрыто.")); }
    pending.clear();
  });

  addEventListener("flow:sport-health", event => {
    if (!event.detail || typeof event.detail !== "object") return;
    state = event.detail;
    repaint();
  });

  function repaint() {
    if (window.spState?.().sheet?.kind === "health") window.render?.();
  }

  async function load(force = false) {
    if (!available) { state = unavailable(); return state; }
    if (state && !force) return state;
    try { state = await request("state"); } catch (_) { /* состояние покажем по кнопке */ }
    repaint();
    return state;
  }

  async function run(action) {
    if (!available) { toast?.("Часы подключаются только в приложении Flow на Android."); return; }
    busy = action;
    repaint();
    try {
      state = await request(action);
      if (action === "sync") toast?.(state?.status === "error" ? (state.error || "Синхронизация не удалась") : "Синхронизация завершена");
    } catch (error) {
      toast?.(error.message || "Не получилось. Попробуйте ещё раз.");
    } finally {
      busy = "";
      repaint();
    }
  }

  const STATUS = {
    unsupported: "Health Connect недоступен на этом телефоне.",
    install: "Нужно обновить Health Connect в Play Маркете.",
    permission: "Нет разрешения на тренировки и пульс.",
    ready: "Подключено.",
    syncing: "Читаю тренировки…",
    error: "Синхронизация не удалась.",
  };
  const stamp = value => {
    const date = new Date(String(value || ""));
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };
  function body() {
    if (!available) {
      return `<p class="section-note">Часы подключаются в приложении Flow на Android: здесь нет доступа к Health Connect. Откройте Flow на телефоне, раздел «Спорт → Настройки → Часы».</p>`;
    }
    const s = state || unavailable();
    const counts = `Добавлено ${s.added || 0} · обновлено ${s.updated || 0}${s.skipped ? ` · без изменений ${s.skipped}` : ""}${s.invalid ? ` · не прочитано ${s.invalid}` : ""}`;
    const last = stamp(s.lastSuccessAt);
    const buttons = s.enabled
      ? `<div class="sheet-actions"><button class="primary-button" type="button" data-action="sp-health-sync" ${busy ? "disabled" : ""}>${busy === "sync" ? "Синхронизирую…" : "Синхронизировать"}</button><button class="ghost-button" type="button" data-action="sp-health-settings">Настройки Health Connect</button></div>
        <button class="text-action" type="button" data-action="sp-health-off" ${busy ? "disabled" : ""}>Отключить</button>`
      : `<div class="sheet-actions"><button class="primary-button" type="button" data-action="sp-health-connect" ${busy ? "disabled" : ""}>${busy === "connect" ? "Жду разрешение…" : "Подключить Health Connect"}</button>${s.status === "install" ? `<button class="ghost-button" type="button" data-action="sp-health-settings">Открыть Play Маркет</button>` : ""}</div>`;
    return `<p class="sp-health-state"><strong>${spEsc?.(STATUS[s.status] || "Не подключено") || (STATUS[s.status] || "Не подключено")}</strong>${s.error ? `<small>${spEsc?.(s.error) || s.error}</small>` : ""}</p>
      <p class="section-note">Flow читает из Health Connect тренировки и пульс за последние 14 дней. Записи Mi Fitness остаются на месте; в Flow они хранятся как данные источника, а не как ваш результат.</p>
      ${s.enabled && last ? `<p class="section-note">Последняя синхронизация: ${last}${counts ? ` · ${counts}` : ""}.</p>` : ""}
      ${s.enabled && s.status === "permission" ? `<p class="section-note">Разрешение отозвано в Health Connect. Подключите заново.</p>` : ""}
      ${s.enabled && s.status === "permission" ? `<div class="sheet-actions"><button class="primary-button" type="button" data-action="sp-health-connect">Подключить заново</button></div>` : buttons}
      ${!s.enabled ? `<p class="section-note">Mi Band передаёт тренировки в Mi Fitness, Mi Fitness — в Health Connect. Flow читает их оттуда и ничего не пишет обратно.</p>` : ""}`;
  }

  window.SportHealth = {
    available,
    status: () => state,
    load,
    connect: () => run("connect"),
    sync: () => run("sync"),
    disconnect: () => run("disconnect"),
    settings: () => run("settings"),
  };

  if (typeof SP_SHEETS === "object") {
    SP_SHEETS.health = () => ({ title: "Часы", body: body() });
    SP_ACTIONS["sp-health"] = () => { if (typeof spOpen === "function") spOpen("health"); void load(true); };
    SP_ACTIONS["sp-health-connect"] = () => { void run("connect"); };
    SP_ACTIONS["sp-health-sync"] = () => { void run("sync"); };
    SP_ACTIONS["sp-health-off"] = () => { void run("disconnect"); };
    SP_ACTIONS["sp-health-settings"] = () => { void run("settings"); };
  }
})();
