class MidiInputError extends Error { constructor(code, message) { super(message); this.code = code; } }
const midiError = (code, message) => new MidiInputError(code, message);
const noDevice = () => midiError('no_device', 'MIDI-синтезатор не найден. Подключи Casio по USB и попробуй ещё раз.');
const connectionError = () => midiError('connection_failed', 'Не удалось подключить MIDI. Проверь USB-подключение и попробуй снова.');

/** Explicit, user-started Web MIDI input. No SysEx, device logging or outputs. */
export function createMidiInput({ onNote = () => {}, onDisconnect = () => {},
  requestAccess = globalThis.navigator?.requestMIDIAccess?.bind(globalThis.navigator) } = {}) {
  let epoch = 0, active = false, access = null, stateListener = null, operation = null, lastConnected = false;
  const bindings = new Map();
  const current = token => active && token === epoch;
  const usable = input => input && input.type !== 'output' && input.state === 'connected';
  const connected = () => [...bindings].some(([input, binding]) => usable(input) && binding.ready);

  function closeOwned(input, binding) {
    if (!binding.openedByUs || bindings.has(input)) return;
    try { Promise.resolve(input.close?.()).catch(() => {}); } catch {}
  }

  function unbind(input) {
    const binding = bindings.get(input); if (!binding) return;
    bindings.delete(input); binding.held.clear();
    input.removeEventListener?.('midimessage', binding.listener);
    closeOwned(input, binding);
  }

  function detach() {
    if (access && stateListener) access.removeEventListener?.('statechange', stateListener);
    stateListener = null; access = null; lastConnected = false;
    for (const input of [...bindings.keys()]) unbind(input);
  }

  function bind(input, token) {
    if (bindings.has(input)) return bindings.get(input);
    const binding = { held: new Set(), ready: false, openedByUs: input.connection !== 'open', opening: null, listener: null };
    binding.listener = event => {
      if (!current(token) || bindings.get(input) !== binding || !usable(input)) return;
      const bytes = event?.data;
      if (!bytes || bytes.length < 3) return;
      const [status, note, velocity] = bytes;
      if (!Number.isInteger(status) || status < 0x80 || status > 0xef ||
          !Number.isInteger(note) || note < 0 || note > 127 ||
          !Number.isInteger(velocity) || velocity < 0 || velocity > 127) return;
      const command = status & 0xf0, channel = status & 0x0f, key = channel * 128 + note;
      if (command === 0x80 || (command === 0x90 && velocity === 0)) { binding.held.delete(key); return; }
      if (command === 0xb0 && (note === 120 || note === 123)) {
        for (const held of binding.held) if (Math.floor(held / 128) === channel) binding.held.delete(held);
        return;
      }
      if (command !== 0x90 || !velocity || binding.held.has(key)) return;
      binding.held.add(key); onNote(note);
    };
    bindings.set(input, binding);
    input.addEventListener('midimessage', binding.listener);
    // Defer opening until the binding exists, including if open emits statechange.
    binding.opening = Promise.resolve().then(async () => {
      if (!current(token) || bindings.get(input) !== binding) return false;
      try {
        if (input.connection !== 'open') await input.open?.();
        if (!current(token) || bindings.get(input) !== binding || !usable(input)) {
          closeOwned(input, binding); return false;
        }
        binding.ready = true; return true;
      } catch {
        if (bindings.get(input) === binding) unbind(input);
        else closeOwned(input, binding);
        return false;
      }
    });
    return binding;
  }

  async function refresh(token, notifyDisconnect = false) {
    if (!current(token) || !access) return false;
    const ports = new Set([...access.inputs.values()].filter(usable));
    for (const input of [...bindings.keys()]) if (!ports.has(input)) unbind(input);
    const opening = [...ports].map(input => bind(input, token).opening);
    await Promise.all(opening);
    if (!current(token)) return false;
    const hasInput = connected();
    const lostInput = lastConnected && !hasInput;
    lastConnected = hasInput;
    if (notifyDisconnect && lostInput) onDisconnect();
    return hasInput;
  }

  function stop() {
    epoch++; active = false;
    const pending = operation; operation = null;
    pending?.cancel(false);
    detach();
  }

  function start() {
    if (operation) return operation.promise;
    if (active && connected()) return Promise.resolve(true);
    stop();
    const token = ++epoch; active = true;
    let cancel;
    const cancelled = new Promise(resolve => { cancel = resolve; });
    const pending = { promise: null, cancel };
    operation = pending;
    const work = (async () => {
      try {
        if (typeof requestAccess !== 'function') throw midiError('unsupported', 'В этом браузере нет MIDI. Открой приложение в Chrome и подключи синтезатор по USB.');
        const acquired = await requestAccess({ sysex: false });
        if (!current(token)) return false;
        if (!acquired?.inputs || typeof acquired.inputs.values !== 'function' || typeof acquired.addEventListener !== 'function') throw connectionError();
        if (![...acquired.inputs.values()].some(usable)) throw noDevice();
        access = acquired;
        stateListener = () => { refresh(token, true).catch(() => {}); };
        access.addEventListener('statechange', stateListener);
        if (!await refresh(token)) {
          if (!current(token)) return false;
          throw connectionError();
        }
        return true;
      } catch (error) {
        if (!current(token)) return false;
        active = false; detach();
        if (error instanceof MidiInputError) throw error;
        if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
          throw midiError('permission_denied', 'Нет доступа к MIDI. Разреши его в настройках сайта и попробуй снова.');
        }
        throw connectionError();
      }
    })();
    pending.promise = Promise.race([work, cancelled]).finally(() => { if (operation === pending) operation = null; });
    return pending.promise;
  }

  return { start, stop, get connected() { return active && connected(); },
    get heldNotes() {
      if (!active) return [];
      const pitches = new Set();
      for (const [input, binding] of bindings) {
        if (usable(input) && binding.ready) for (const held of binding.held) pitches.add(held % 128);
      }
      return [...pitches].sort((a, b) => a - b);
    } };
}
