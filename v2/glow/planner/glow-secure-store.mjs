import './vault-crypto.js';

const idOf = value => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw Error('secure_id');
  return id;
};
const sameEnvelope = (a, b) => a && b && ['v', 'iv', 'ct'].every(key => a[key] === b[key])
  && ['crv', 'kty', 'x', 'y'].every(key => a.epk?.[key] === b.epk?.[key]);
const sameWrap = (a, b) => a?.setup === true && ['salt', 'iterations', 'wrappedKey'].every(key => a[key] === b[key]);
const editableError = error => error?.status >= 400 && error.status < 500 && ![408, 429].includes(error.status);

export function createSecureStore(getHost, onLock, timeoutMinutes = () => 5) {
  let epoch = 0;
  let hosts = null;
  let key, keys, timer, pending, pendingWrap, stop, opening;

  function lock() {
    epoch++;
    clearTimeout(timer);
    key = keys = null;
    onLock?.();
  }
  function touch() {
    clearTimeout(timer);
    timer = setTimeout(lock, timeoutMinutes() * 60_000);
  }
  async function connect() {
    if (hosts?.vault.isCurrent() && hosts.docs.isCurrent()) return hosts;
    const reset = () => {
      stop?.();
      hosts = pending = pendingWrap = null;
      lock();
    };
    if (hosts) reset();
    opening ||= (async () => {
      const [vault, docs] = await Promise.all([getHost('vault'), getHost('docs')]);
      if (!vault.isCurrent() || !docs.isCurrent() || vault.owner.scope !== docs.owner.scope || vault.owner.epoch !== docs.owner.epoch) throw Error('secure_session');
      hosts = { vault, docs };
      stop = vault.subscribe(() => { if (!vault.isCurrent()) reset(); });
      return hosts;
    })();
    try { return await opening; } finally { opening = null; }
  }
  async function invoke(kind, op, args, lease = epoch) {
    const host = (await connect())[kind];
    if (epoch !== lease || !host.isCurrent()) throw Error('secure_session');
    const reply = await host.request(op, args);
    if (epoch !== lease || !host.isCurrent()) throw Error('secure_session');
    if (reply?.error) throw Error('secure_remote');
    return reply;
  }
  function unlocked(lease = epoch) {
    if (!key || epoch !== lease || !hosts?.vault.isCurrent()) throw Error('secure_locked');
    touch();
  }
  async function state(lease = epoch) {
    const value = await invoke('vault', 'state', {}, lease);
    if (typeof value?.setup !== 'boolean' || value.setup &&
        (value.publicKey?.crv !== 'P-256' || !Number.isInteger(value.iterations) || value.iterations < 100_000 || value.iterations > 5_000_000 ||
          typeof value.salt !== 'string' || typeof value.wrappedKey !== 'string')) throw Error('secure_state');
    return value;
  }
  async function list(kind) {
    const lease = epoch;
    unlocked(lease);
    const answer = await invoke(kind, 'list', {}, lease);
    if (!Array.isArray(answer?.items)) throw Error('secure_list');
    return answer.items.map(row => ({ ...row, id: idOf(row.id) }));
  }
  async function open(master, setup = false) {
    const lease = epoch;
    let current = await state(lease);
    if (!current.setup && setup) {
      const records = await Promise.all([invoke('vault', 'list', {}, lease), invoke('docs', 'list', {}, lease)]);
      if (records.some(answer => !Array.isArray(answer?.items) || answer.items.length)) throw Error('secure_state');
      const draft = await FlowVault.setup(master);
      try { await invoke('vault', 'setup', draft, lease); }
      catch (error) { if (editableError(error)) throw error; }
      current = await state(lease);
      if (!sameWrap(current, draft)) throw Error('secure_unconfirmed');
    }
    if (!current.setup) throw Error('secure_not_setup');
    const privateKey = await FlowVault.unlock(master, current);
    if (epoch !== lease || !hosts?.vault.isCurrent()) throw Error('secure_session');
    key = privateKey;
    keys = current;
    touch();
  }
  async function raw(kind, id, lease) {
    const answer = await invoke(kind, 'get', { id }, lease);
    if (idOf(answer?.id) !== id || !answer.envelope) throw Error('secure_record');
    return answer;
  }
  async function read(kind, id) {
    const lease = epoch;
    unlocked(lease);
    const row = await raw(kind, id, lease);
    const currentKey = key;
    const secret = await FlowVault.decrypt(currentKey, row.envelope);
    unlocked(lease);
    if (!secret || typeof secret !== 'object' || Array.isArray(secret)) throw Error('secure_record');
    if (kind === 'vault') return { ...secret, id, service: row.service };
    let doc = { ...secret, id, kind: row.kind, title: row.title, _serverUpdatedAt: row.updated_at };
    const imports = [];
    for (const item of row.imports || []) {
      imports.push({ id: idOf(item.id), payload: await FlowVault.decrypt(currentKey, item.envelope) });
      unlocked(lease);
    }
    if (imports.length && globalThis.FlowDocumentImports) {
      for (const item of imports) {
        try {
          const merged = FlowDocumentImports.merge(doc, [item]);
          doc = { ...merged.doc, _serverImportIds: [...(doc._serverImportIds || []), ...merged.ids] };
        } catch (error) {
          if (error.message !== 'docs_too_large') throw error;
          doc._serverImportBlocked = true;
          break;
        }
      }
    }
    return doc;
  }
  async function reconcile(kind, args, lease) {
    const field = kind === 'docs' ? 'title' : 'service';
    const matches = [];
    const rows = args.id ? [{ id: args.id }] : (await list(kind)).filter(item => item[field] === args[field]);
    if (rows.length > 32) throw Error('secure_unconfirmed');
    for (const entry of rows) {
      const row = await raw(kind, entry.id, lease);
      if (row[field] === args[field] && sameEnvelope(args.envelope, row.envelope)) matches.push(row);
    }
    if (matches.length !== 1) throw Error('secure_unconfirmed');
    return matches[0];
  }
  async function save(kind, draft) {
    const lease = epoch;
    unlocked(lease);
    if (pending) {
      const recovered = await reconcile(pending.kind, pending.args, lease);
      pending = null;
      return { id: idOf(recovered.id), recovered: true };
    }
    const docs = kind === 'docs';
    const secret = docs ? Object.fromEntries(Object.entries(draft).filter(([name]) =>
      !['id', 'kind', 'title'].includes(name) && !name.startsWith('_server'))) : { login: draft.login, password: draft.password, note: draft.note };
    if (JSON.stringify(secret).length > (docs ? 8_000_000 : 12_000)) throw Error('secure_size');
    const envelope = await FlowVault.encrypt(keys.publicKey, secret);
    unlocked(lease);
    const fields = docs ? { title: draft.title, kind: draft.kind } : { service: draft.service };
    const args = { ...fields, envelope, ...(draft.id ? { id: idOf(draft.id) } : {}),
      ...(docs && draft._serverUpdatedAt ? { if_updated_at: draft._serverUpdatedAt } : {}),
      ...(docs && draft._serverImportIds?.length ? { import_ids: draft._serverImportIds.map(idOf) } : {}) };
    pending = { kind, args };
    try {
      const reply = await invoke(kind, 'save', args, lease);
      const id = idOf(reply?.id);
      if (args.id && args.id !== id) throw Error('secure_unconfirmed');
      pending = null;
      return { id, updatedAt: reply.updated_at };
    } catch (error) {
      if (editableError(error)) { pending = null; throw error; }
      if (lease === epoch) {
        try {
          const recovered = await reconcile(kind, args, lease);
          pending = null;
          return { id: idOf(recovered.id), updatedAt: recovered.updated_at };
        } catch { /* Keep encrypted write for readback on retry. */ }
      }
      throw Error('secure_unconfirmed');
    }
  }
  async function remove(kind, id) {
    const lease = epoch;
    unlocked(lease);
    const answer = await invoke(kind, 'delete', { id }, lease);
    if (answer?.ok !== true) throw Error('secure_unconfirmed');
  }
  async function rewrap(oldMaster, newMaster) {
    const lease = epoch;
    const current = await state(lease);
    if (!current.setup) throw Error('secure_not_setup');
    const host = hosts.vault;
    if (!pendingWrap) {
      const next = await FlowVault.rewrap(oldMaster, newMaster, current);
      pendingWrap = { ...next, publicKey: current.publicKey };
      try { await invoke('vault', 'rewrap', next, lease); }
      catch (error) { if (editableError(error)) { pendingWrap = null; throw error; } }
    }
    const actual = await state(lease);
    if (!sameWrap(actual, pendingWrap) || ['x', 'y'].some(axis => actual.publicKey[axis] !== pendingWrap.publicKey[axis])) throw Error('secure_unconfirmed');
    await FlowVault.unlock(newMaster, actual);
    if (lease !== epoch || !host.isCurrent()) throw Error('secure_session');
    const cleanup = await host.clearDeviceAccess();
    if (cleanup?.ok !== true || lease !== epoch || !host.isCurrent()) throw Error('secure_cleanup');
    pendingWrap = null;
    lock();
  }
  async function biometric(op, master) {
    const lease = epoch;
    const current = await state(lease);
    const host = hosts.vault;
    if (!current.setup || !host.biometric) return { available:false, enrolled:false };
    if (op === 'save') {
      await FlowVault.unlock(master, current);
      if (lease !== epoch) throw Error('secure_session');
    }
    const answer = await host.biometric(op, master);
    if (lease !== epoch || !host.isCurrent()) throw Error('secure_session');
    if (op === 'read') {
      if (typeof answer !== 'string' || !answer) throw Error('biometric_unavailable');
      await open(answer);
    }
    return answer;
  }
  return { state, open, list, read, save, remove, rewrap, biometric, lock, get isUnlocked() { return !!key; } };
}
