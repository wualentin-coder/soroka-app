function timerFromText(text) {
  let best = 0;
  for (const m of String(text).matchAll(/(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?\s*(час|ч\b|мин|сек)/gi)) {
    const n = Number((m[2] || m[1]).replace(",", "."));
    const unit = m[3].toLowerCase();
    const sec = unit.startsWith("ч") ? n * 3600 : unit.startsWith("м") ? n * 60 : n;
    if (sec > best) best = sec;
  }
  return best >= 10 ? Math.round(best) : null;
}

function cookSteps(item) {
  if (Array.isArray(item.cook) && item.cook.length) return item.cook.map(s => ({ text: String(s.text || ""), timer: Number(s.timer) || null, uses: Array.isArray(s.uses) ? s.uses : [] }));
  return (item.steps || []).filter(s => s && !/^не указан/i.test(s.trim())).map(text => ({ text, timer: timerFromText(text), uses: [] }));
}

// ------------------------------------------------------------ режим готовки


export { cookSteps };
