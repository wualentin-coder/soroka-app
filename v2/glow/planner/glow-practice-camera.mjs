import './practice/sport-inline-core.js';
import { coachEyesSportKeys } from './practice/coach-eyes-keys.mjs';
import { label } from './glow-practice-ui.mjs';

const nativeBridge = () => [window.SorokaAndroid, window.SorokaNative, window.FlowAndroid, window.FlowNative]
  .find(host => typeof host?.coachEyesInlineShow === 'function');
const parse = value => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return null; }
};

export function createPracticeCamera() {
  const core = window.SportInlineCore;
  let run;
  const current = value => value === run && value.form.isConnected && value.sheet.classList.contains('on') && value.active();
  function stopNative(value) {
    if (!value.configured) return;
    value.configured = false;
    value.position = null;
    try { value.host.coachEyesInlineClose?.(); } catch {}
    try { value.host.coachEyesInlineConfigure?.(false); } catch {}
  }
  function release(value) {
    clearTimeout(value.wait);
    value.events.abort();
    value.resize?.disconnect();
    if (value.frame) cancelAnimationFrame(value.frame);
    stopNative(value);
    value.video.srcObject = null;
    value.stream?.getTracks().forEach(track => track.stop());
  }
  function close(hide = false) {
    const value = run;
    if (!value) return;
    run = null;
    release(value);
    if (hide && value.form.isConnected && value.sheet.classList.contains('on')) closeSy();
  }
  function status(value, text) {
    if (current(value)) value.note.textContent = text;
  }
  function manual(value, note) {
    if (!current(value)) return;
    clearTimeout(value.wait);
    stopNative(value);
    value.finish.disabled = false;
    value.finish.hidden = true;
    value.measurement.hidden = false;
    value.note.textContent = note;
  }
  function receive(raw) {
    const value = run, payload = parse(raw);
    if (!value || !current(value) || !value.requested || payload?.schema !== 'coach-eyes.workout' || payload.version !== 1) return;
    const candidates = Array.isArray(payload.workouts) ? payload.workouts : [];
    const exercise = candidates.findLast(item => item.sportExerciseId
      ? item.sportExerciseId === value.catalogId : item.exerciseKey === value.coachKey);
    const data = Array.isArray(exercise?.sets) ? exercise.sets.at(-1) : null;
    const result = Math.round(Number(value.timed ? data?.holdSec : data?.reps));
    value.requested = false;
    if (Number.isInteger(result) && result >= 1 && result <= 1000) {
      value.form.elements.measurement.value = String(result);
      manual(value, 'Проверь результат камеры перед сохранением');
    } else manual(value, 'Камера не вернула результат для этого подхода. Введи его вручную');
  }
  function inlineState(raw) {
    const payload = parse(raw);
    if (payload?.schema === 'coach-eyes.workout') { receive(payload); return; }
    const value = run;
    if (!value?.host || !current(value)) return;
    const next = core.state(raw);
    if (next.status === 'granted' || next.permission === 'granted' && value.asking) {
      value.asking = false;
      clearTimeout(value.wait);
      scheduleNative(value);
    }
    if (['denied', 'unavailable', 'manual', 'pain'].includes(next.status)) {
      clearTimeout(value.wait);
      status(value, next.status === 'pain' ? 'Подход остановлен' : 'Камера недоступна. Результат можно ввести вручную');
      value.finish.hidden = true;
    }
  }
  // Both installed Android preview callbacks deliver metadata only.
  const previous = window.SportCoachEyes;
  window.SportCoachEyes = {
    receive(payload) { if (run) receive(payload); else previous?.receive?.(payload); },
    inlineState(payload) { if (run) inlineState(payload); else previous?.inlineState?.(payload); },
  };
  for (const target of [window, document]) {
    target.addEventListener('flow:coach-eyes-inline', event => inlineState(event.detail));
    target.addEventListener('flow:coach-eyes', event => receive(event.detail));
  }
  function nativePosition(value) {
    value.frame = 0;
    if (!current(value) || value.asking || value.requested || value.finish.disabled) return;
    const rect = core.rect(value.preview.getBoundingClientRect(), value.sheet.getBoundingClientRect());
    if (!rect) return;
    const next = JSON.stringify(rect);
    if (next === value.position) return;
    try {
      if (value.position && typeof value.host.coachEyesInlineMove !== 'function') return;
      const result = value.position ? value.host.coachEyesInlineMove(next)
        : value.host.coachEyesInlineShow(next, value.coachKey, value.catalogId);
      if (result === false || result?.ok === false) throw Error();
      value.position = next;
      value.finish.hidden = false;
      value.measurement.hidden = true;
      status(value, value.timed ? 'Камера измеряет удержание' : 'Камера считает повторы');
    } catch {
      manual(value, 'Не удалось открыть Coach Eyes. Введи результат вручную');
    }
  }
  function scheduleNative(value) {
    if (!value.frame) value.frame = requestAnimationFrame(() => nativePosition(value));
  }
  async function start(value) {
    value.start.disabled = true;
    if (value.host) {
      try {
        value.host.coachEyesInlineConfigure?.(true);
        value.configured = true;
        const permission = core.state(value.host.coachEyesInlinePermission?.()).permission;
        if (permission === 'blocked') throw Error('Разреши доступ к камере в настройках Android');
        if (permission !== 'granted' && typeof value.host.coachEyesInlineRequestPermission === 'function') {
          value.asking = true;
          status(value, 'Разреши доступ к камере');
          const reply = await value.host.coachEyesInlineRequestPermission();
          if (!current(value)) return;
          if (reply === false) throw Error('Доступ к камере отклонён');
          if (core.state(value.host.coachEyesInlinePermission?.()).permission !== 'granted' && value.asking) {
            value.wait = setTimeout(() => {
              value.asking = false;
              manual(value, 'Камера ждёт разрешения. Можно ввести результат вручную');
              value.start.disabled = false;
            }, 12000);
            return;
          }
        }
        value.asking = false;
        scheduleNative(value);
      } catch (error) {
        value.asking = false;
        status(value, error.message || 'Не удалось включить камеру');
        value.start.disabled = false;
      }
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Error('Камера недоступна в этом браузере');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (!current(value)) { stream.getTracks().forEach(track => track.stop()); return; }
      value.stream = stream;
      value.video.srcObject = stream;
      await value.video.play();
      if (current(value)) status(value, 'Предпросмотр камеры · введи результат подхода');
    } catch (error) {
      value.stream?.getTracks().forEach(track => track.stop());
      value.video.srcObject = null;
      if (!current(value)) return;
      status(value, error.name === 'NotAllowedError' ? 'Доступ к камере отклонён' : error.message || 'Не удалось включить камеру');
      value.start.disabled = false;
    }
  }
  function finish(value) {
    if (!current(value) || value.requested) return;
    value.requested = true;
    value.finish.disabled = true;
    status(value, 'Получаем результат камеры…');
    value.wait = setTimeout(() => {
      value.requested = false;
      manual(value, 'Результат камеры не получен. Введи его вручную');
    }, 4500);
    try {
      const reply = value.host.coachEyesInlineFinish?.();
      Promise.resolve(reply).then(receive).catch(() => {
        if (!current(value)) return;
        value.requested = false;
        manual(value, 'Результат камеры не получен. Введи его вручную');
      });
    } catch { value.requested = false; manual(value, 'Не удалось получить результат камеры'); }
  }
  function open({ session, catalogId, active, save }) {
    close();
    const coachKey = coachEyesSportKeys[catalogId];
    const host = coachKey ? nativeBridge() : null;
    const timed = session.exercise.mode === 'timed';
    openSy(`<form data-practice-camera><div class="syh">Камера<small>${label(session.exercise.name)} · ${session.set} из ${session.total}</small></div>
      <div class="glass glow-camera-preview" data-camera-preview><video autoplay muted playsinline aria-label="Предпросмотр камеры"></video></div>
      <p role="status" data-camera-note></p><div class="glow-practice-actions">
        <button type="button" class="btn glass" data-camera-start>Включить камеру</button>
        <button type="button" class="btn glass" data-camera-finish hidden>Закончить подход</button>
        <button type="button" class="btn glass" data-camera-close>Закрыть</button>
      </div>
      <div data-camera-measurement><label class="glass syq"><small>${timed ? 'Секунды' : 'Повторы'}</small>
        <input required name="measurement" type="number" min="1" max="1000" step="1" inputmode="numeric"></label>
      <button class="btn main sygo" type="submit">Сохранить подход</button></div></form>`, sheet => {
      const form = $('[data-practice-camera]', sheet);
      const value = run = { form, sheet, host, active, catalogId, coachKey, timed, events: new AbortController(),
        preview: $('[data-camera-preview]', form), video: $('video', form), note: $('[data-camera-note]', form),
        start: $('[data-camera-start]', form), finish: $('[data-camera-finish]', form), measurement: $('[data-camera-measurement]', form) };
      syOnClose = () => { if (run === value) close(); };
      if (host) {
        const moved = () => { if (value.position) scheduleNative(value); };
        document.addEventListener('scroll', moved, { capture: true, signal: value.events.signal });
        window.addEventListener('resize', moved, { signal: value.events.signal });
        value.resize = new ResizeObserver(moved);
        value.resize.observe(value.preview);
      }
      value.start.onclick = () => void start(value);
      value.finish.onclick = () => finish(value);
      $('[data-camera-close]', form).onclick = closeSy;
      form.onsubmit = async event => {
        event.preventDefault();
        if (!current(value)) return;
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        try { if (await save(Number(form.elements.measurement.value)) && run === value) closeSy(); }
        catch (error) { status(value, error.message); }
        finally { submit.disabled = false; }
      };
    });
  }
  return { open, close };
}
