export function wavBase64(chunks, rate) {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const target = 16000;
  const ratio = rate / target;
  const out = new Int16Array(Math.floor(length / ratio));
  let pos = 0, index = 0;
  const all = new Float32Array(length);
  for (const c of chunks) { all.set(c, pos); pos += c.length; }
  for (let i = 0; i < out.length; i++) {
    // Усредняем отсчёты окна — простой фильтр перед прореживанием.
    const from = Math.floor(i * ratio), to = Math.min(length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = from; j < to; j++) sum += all[j];
    const v = Math.max(-1, Math.min(1, sum / Math.max(1, to - from)));
    out[index++] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const buffer = new ArrayBuffer(44 + out.length * 2);
  const view = new DataView(buffer);
  const str = (o, s) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF"); view.setUint32(4, 36 + out.length * 2, true); str(8, "WAVE"); str(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, target, true); view.setUint32(28, target * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, "data"); view.setUint32(40, out.length * 2, true);
  new Int16Array(buffer, 44).set(out);
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

