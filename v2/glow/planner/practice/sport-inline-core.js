/* Sport 2.0 · inline Coach Eyes: v1 support and native rect contract. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SportInlineCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // 4.70: every Coach Eyes exercise runs in the inline panel — holds (plank,
  // carry) and counted repetitions. Same keys as native Exercise.key.
  const INLINE_KEYS = ["plank", "db_suitcase_carry", "curl", "pushup", "press", "squat", "lunge", "lateral",
    "row", "situp", "bridge", "db_romanian_deadlift", "db_rear_delt_fly", "db_overhead_triceps_extension"];
  const TIMED_KEYS = ["plank", "db_suitcase_carry"];
  const timed = (key) => TIMED_KEYS.includes(String(key || ""));

  function eligible({ key = null, phase = null, paused = false, hidden = false } = {}) {
    return INLINE_KEYS.includes(String(key || "")) && phase === "work" && !paused && !hidden;
  }

  function permission(value) {
    if (value === true || value === 1) return "granted";
    if (value === false || value === 0) return "denied";
    if (value && typeof value === "object") {
      return permission(value.permission ?? value.cameraPermission ?? value.permissionState ?? value.state);
    }
    const text = String(value ?? "").trim().toLocaleLowerCase("en");
    if (!text) return "unknown";
    if (/blocked/.test(text)) return "blocked";
    if (/not\s+(granted|allowed|authorized|authorised)/.test(text)) return "denied";
    if (/(denied|deny|never|rejected|forbidden|false|0)/.test(text)) return "denied";
    if (/(granted|allowed|authorized|authorised|true|1|yes)/.test(text)) return "granted";
    return "unknown";
  }

  /** Native inline event -> one of the panel states. Unknown payloads stay unknown. */
  function state(value) {
    let payload = value;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch { payload = value; }
    }
    const source = payload && typeof payload === "object" ? payload : {};
    const text = String(source.state ?? source.status ?? source.phase ?? source.mode ?? (typeof payload === "string" ? payload : ""))
      .toLocaleLowerCase("en");
    const access = permission(source.permission ?? source.cameraPermission ?? source.permissionState);
    let status = "unknown";
    if (/denied|deny|rejected|forbidden|revoked/.test(text)) status = "denied";
    else if (/busy|occupied|in.?use/.test(text)) status = "denied";
    else if (/unavailable|unsupported|disabled|not.?supported|error|failed/.test(text)) status = "unavailable";
    else if (/pain/.test(text)) status = "pain";
    else if (/manual/.test(text)) status = "manual";
    else if (/finished/.test(text)) status = "finished";
    else if (/paused/.test(text)) status = "paused";
    else if (/expand/.test(text)) status = "expanded";
    else if (/collapse/.test(text)) status = "collapsed";
    else if (/finishing/.test(text) || text === "finish") status = "finishing";
    else if (/hidden|closed|stopped|idle|inactive/.test(text)) status = "hidden";
    else if (/shown|visible|start|running|preview|ready|active/.test(text)) status = "shown";
    else if (access === "granted" || /granted|allowed|authorized/.test(text)) status = "granted";
    else if (source.visible === true || source.shown === true) status = "shown";
    else if (source.visible === false || source.shown === false) status = "hidden";
    if (source.expanded === true && status === "shown") status = "expanded";
    if (source.expanded === false && status === "expanded") status = "collapsed";
    return {
      status,
      permission: access,
      expanded: status === "expanded",
      collapsed: status === "collapsed",
      pain: typeof source.pain === "boolean" ? source.pain : null,
      raw: value,
    };
  }

  /**
   * CSS-pixel rect for the native panel; normalized keys are not invented.
   * [area] is the part of the screen where the panel may be seen (the scroll
   * area between header and footer): native clips the panel to it, so a
   * scrolled panel never covers the header or the «Подход выполнен» button.
   */
  function rect(bounds, area = null) {
    if (!bounds) return null;
    const left = Number(bounds.left ?? bounds.x ?? 0);
    const top = Number(bounds.top ?? bounds.y ?? 0);
    const width = Number(bounds.width ?? 0);
    const height = Number(bounds.height ?? 0);
    if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
    const x = Math.round(left), y = Math.round(top);
    const w = Math.round(width), h = Math.round(height);
    // Native reads x/y/w/h and multiplies CSS pixels by the display density.
    const out = { x, y, w, h, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h, unit: "css" };
    if (area) {
      const cx = Math.round(Number(area.left ?? area.x ?? 0)), cy = Math.round(Number(area.top ?? area.y ?? 0));
      const cw = Math.round(Number(area.width ?? 0)), ch = Math.round(Number(area.height ?? 0));
      if ([cx, cy, cw, ch].every(Number.isFinite) && cw > 0 && ch > 0) Object.assign(out, { cx, cy, cw, ch });
    }
    return out;
  }

  /** Same set, new place: only the rect changed, so native moves the panel instead of restarting it. */
  function sameSet(a, b) {
    return Boolean(a && b && a.key === b.key && a.sportId === b.sportId && a.set === b.set);
  }

  return { INLINE_KEYS, TIMED_KEYS, timed, eligible, rect, sameSet, permission, state };
});
