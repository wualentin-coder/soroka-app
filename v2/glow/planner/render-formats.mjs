function rmTemplateBitrate(name) {
  const m=String(name || '').trim().match(/^H\.?264(?:\W.*?)?[\s_-](\d+(?:[.,]\d+)?)\s*M(?:bps|bits?(?:\/s|ps)?)$/i), n=m ? Number(m[1].replace(',','.')) : 0;
  return n>=1 && n<=400 ? n : 0;
}

function rmFrameSummary(text) {
  const intervals = String(text || "").split(",").map(part => {
    const m = part.trim().match(/^(-?\d+)(?:-(-?\d+))?$/);
    if (!m) throw Error("Проверьте диапазон кадров");
    const a = Number(m[1]), b = Number(m[2] ?? m[1]);
    if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || b < a) throw Error("Конец диапазона раньше начала");
    return [a,b];
  }).sort((a,b) => a[0]-b[0]);
  const merged = [];
  for (const pair of intervals) {
    const last = merged.at(-1);
    if (last && pair[0] <= last[1]+1) last[1] = Math.max(last[1],pair[1]); else merged.push([...pair]);
  }
  const count = merged.reduce((n,[a,b]) => n+b-a+1,0);
  if (count > 10000000) throw Error("Слишком большой диапазон кадров");
  return {count,segments:merged.length};
}

function rmEffectiveMedia(target,form,app='ae') {
  const a=target.audit || {}, warnings=[];
  const template=String(form.ae_template || '');
  let divisor=app==='ae'?{full:1,half:2,quarter:4}[form.ae_resolution]:1;
  if (!divisor) {
    const resolution=String(a.resolution || '').trim().toLowerCase();
    divisor=/^(full|полное|полный|1)$/.test(resolution)?1:/^(half|половина|половинное|½|2)$/.test(resolution)?2:/^(quarter|четверть|¼|4)$/.test(resolution)?4:0;
  }
  const transformed=[a.resize,a.crop].some(x=>x && !/^(off|false|выкл\.?|нет|0)$/i.test(String(x).trim()));
  const explicit=template.startsWith('@flow:');
  const known=divisor && (explicit || !transformed && !template) && Number(a.width)>0 && Number(a.height)>0;
  if (!known && a.width && a.height) warnings.push(`Композиция ${a.width}×${a.height}; итоговый размер подтвердит AE${transformed?' (resize/crop в Output Module)':''}.`);
  if (template && !explicit && !(rmTemplateBitrate(template) && form.ae_backend==='background')) warnings.push('Параметры выбранного Output Module подтвердит AE. Нестандартное видео рендерится одним процессом, чтобы сохранить кодек и прозрачность.');
  const formats={'@flow:mp4':'MP4 · H.264','@flow:mov-alpha':'MOV · ProRes 4444 + альфа','@flow:png':'PNG · секвенция + альфа','@flow:exr':'EXR · секвенция + альфа','@flow:hap':'MOV · HAP','@flow:hap-alpha':'MOV · HAP + альфа'};
  const format=template ? formats[template] || `Шаблон: ${template}` : a.format || 'Формат из проекта';
  return {width:known?Math.floor(Number(a.width)/divisor):null,height:known?Math.floor(Number(a.height)/divisor):null,format,warnings};
}


export { rmFrameSummary, rmEffectiveMedia };
