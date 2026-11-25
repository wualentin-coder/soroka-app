/* Sport 2.0 · inline Coach Eyes: v1 support and native rect contract. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SportInlineCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // v1 inline is the plank only; every other supported exercise stays full-screen.
  const INLINE_KEYS = ["plank"];

  function eligible({ key = null, phase = null, paused = false, hidden = false } = {}) {
    return INLINE_KEYS.includes(String(key || "")) && phase === "work" && !paused && !hidden;
  }

  /** CSS-pixel rect for the native panel; normalized keys are not invented. */
  function rect(bounds) {
    if (!bounds) return null;
    const left = Number(bounds.left ?? bounds.x ?? 0);
    const top = Number(bounds.top ?? bounds.y ?? 0);
    const width = Number(bounds.width ?? 0);
    const height = Number(bounds.height ?? 0);
    if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
    const x = Math.round(left), y = Math.round(top);
    const w = Math.round(width), h = Math.round(height);
    return { x, y, width: w, height: h, left: x, top: y, right: x + w, bottom: y + h, unit: "px" };
  }

  return { INLINE_KEYS, eligible, rect };
});
