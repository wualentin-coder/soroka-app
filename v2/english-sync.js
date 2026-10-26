// Learning answers survive a lost connection and an application restart.
const EN_OUTBOX_KEY = "flow.english.outbox.v1";
let enOutbox = (() => { try { const v = JSON.parse(localStorage.getItem(EN_OUTBOX_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (_) { return []; } })();
let enSyncRunning = false, enSyncTimer = null;
const enSyncWaiters = new Map();
function enStoreOutbox() { localStorage.setItem(EN_OUTBOX_KEY, JSON.stringify(enOutbox)); }
function enQueue(op, args) {
  if (typeof window.sorokaEnglish !== "function") return enCall(op, args);
  const id = crypto.randomUUID();
  const entry = { id, op, args: { ...args, attempt: args.attempt || id } };
  enOutbox.push(entry);
  try { enStoreOutbox(); } catch (_) {
    enOutbox.pop(); toast("Не хватает места для сохранения ответа. Освободите память и повторите.");
    const rejected = Promise.reject(new Error("outbox_storage")); rejected.accepted = false; return rejected;
  }
  const result = new Promise((resolve, reject) => enSyncWaiters.set(id, { resolve, reject }));
  enFlush();
  return result;
}
function enRecord(op, args) {
  const result = enQueue(op, args); result.catch(() => {});
  return result.accepted !== false;
}
async function enFlush() {
  if (enSyncRunning || enSyncTimer || !enOutbox.length || typeof window.sorokaEnglish !== "function") return;
  clearTimeout(enSyncTimer); enSyncRunning = true;
  try {
    while (enOutbox.length) {
      const item = enOutbox[0];
      let answer;
      try { answer = await enCall(item.op, item.args); }
      catch (error) {
        if (!["not_found", "bad_unit", "unknown_op"].includes(error?.message)) throw error;
        enOutbox.shift(); enStoreOutbox();
        enSyncWaiters.get(item.id)?.reject(error); enSyncWaiters.delete(item.id);
        toast("Один ответ не удалось отправить: учебная карточка больше недоступна.");
        continue;
      }
      if (answer?.error) throw new Error(answer.error);
      enOutbox.shift(); enStoreOutbox();
      enSyncWaiters.get(item.id)?.resolve(answer); enSyncWaiters.delete(item.id);
    }
  } catch (_) { enSyncTimer = setTimeout(() => { enSyncTimer = null; enFlush(); }, 10000); }
  finally { enSyncRunning = false; enRerender(); }
}
function enSyncBanner() { return enOutbox.length ? `<p class="section-note" role="status">Ответы сохранены на устройстве · ожидают отправки: ${enOutbox.length}</p>` : ""; }
function enSyncWake() { clearTimeout(enSyncTimer); enSyncTimer = null; enFlush(); }
window.addEventListener("online", enSyncWake);
document.addEventListener("visibilitychange", () => { if (!document.hidden) enSyncWake(); });
