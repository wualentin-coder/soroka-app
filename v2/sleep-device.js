/* Health Connect is available only through the Android app's origin-bound bridge. */
(() => {
  if (window.sorokaSleepDevice) return;
  const bridge = window.FlowHealth;
  const available = typeof bridge?.postMessage === "function";
  const pending = new Map();
  let serial = 0;
  const unavailable = () => ({ available: false, enabled: false, status: "unsupported", provider: "health-connect" });
  const failure = message => new Error(message || "Не удалось связаться с приложением. Попробуйте ещё раз.");

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
    const id = `sleep${++serial}`;
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
  window.sorokaSleepDevice = {
    available,
    state: () => request("state"),
    action: name => ["connect", "sync", "disconnect", "settings"].includes(name)
      ? request(name) : Promise.reject(failure("Неизвестное действие подключения.")),
  };
})();
