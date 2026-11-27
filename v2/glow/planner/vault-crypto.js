/*
 * Пароли со сквозным шифрованием.
 *
 * Мастер-пароль знает только человек. Из него на устройстве (PBKDF2, 600 000
 * повторов) получается ключ, которым зашифрован закрытый ключ хранилища
 * (ECDH P-256). Сервер хранит открытый ключ, зашифрованный закрытый и соль —
 * прочитать пароли он не может. Бот шифрует пароль из чата открытым ключом,
 * открыть его можно на любом устройстве, где введён мастер-пароль.
 *
 * Конверт записи: { v: 1, epk, iv, ct } — одноразовый ключ ECDH, HKDF-SHA256
 * («flow-vault-v1») и AES-GCM. Тот же формат в supabase/functions/_shared/vault-e2e.ts.
 */
(function () {
  const subtle = globalThis.crypto.subtle;
  const ITERATIONS = 600000;
  const INFO = new TextEncoder().encode("flow-vault-v1");
  const EC = { name: "ECDH", namedCurve: "P-256" };

  const b64 = bytes => {
    const view = new Uint8Array(bytes);
    const chunks = [];
    // Document scans can be megabytes; spreading the entire array exceeds
    // the JavaScript engine's argument limit on phones and desktops.
    for (let at = 0; at < view.length; at += 0x8000) {
      chunks.push(String.fromCharCode(...view.subarray(at, at + 0x8000)));
    }
    return btoa(chunks.join("")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const unb64 = text => Uint8Array.from(atob(String(text).replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

  async function masterKey(master, salt, iterations) {
    const base = await subtle.importKey("raw", new TextEncoder().encode(master), "PBKDF2", false, ["deriveKey"]);
    return subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function wrap(privateKey, master, iterations = ITERATIONS) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const pkcs8 = await subtle.exportKey("pkcs8", privateKey);
    const ct = await subtle.encrypt({ name: "AES-GCM", iv }, await masterKey(master, salt, iterations), pkcs8);
    return { salt: b64(salt), iterations, wrappedKey: `${b64(iv)}.${b64(ct)}` };
  }

  /** Новое хранилище: пара ключей, закрытый — под мастер-паролем. */
  async function setup(master, iterations = ITERATIONS) {
    if (String(master).length < 8) throw new Error("vault_master_short");
    const pair = await subtle.generateKey(EC, true, ["deriveBits"]);
    return { publicKey: await subtle.exportKey("jwk", pair.publicKey), ...(await wrap(pair.privateKey, master, iterations)) };
  }

  /** Открыть хранилище: неверный мастер-пароль — ошибка vault_master_wrong. */
  async function unlock(master, state, extractable = false) {
    const [iv, ct] = String(state.wrappedKey).split(".");
    let pkcs8;
    try {
      pkcs8 = await subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await masterKey(master, unb64(state.salt), Number(state.iterations)), unb64(ct));
    } catch (_) { throw new Error("vault_master_wrong"); }
    return subtle.importKey("pkcs8", pkcs8, EC, extractable, ["deriveBits"]);
  }

  /** Сменить мастер-пароль: ключи те же, меняется только обёртка. */
  async function rewrap(oldMaster, newMaster, state) {
    if (String(newMaster).length < 8) throw new Error("vault_master_short");
    return wrap(await unlock(oldMaster, state, true), newMaster, Number(state.iterations) || ITERATIONS);
  }

  async function aesKey(privateKey, publicKey) {
    const shared = await subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
    const hkdf = await subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
    return subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: INFO }, hkdf, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }

  /** Зашифровать запись открытым ключом хранилища (так же делает бот). */
  async function encrypt(publicJwk, value) {
    const recipient = await subtle.importKey("jwk", publicJwk, EC, false, []);
    const eph = await subtle.generateKey(EC, true, ["deriveBits"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(eph.privateKey, recipient), new TextEncoder().encode(JSON.stringify(value)));
    return { v: 1, epk: await subtle.exportKey("jwk", eph.publicKey), iv: b64(iv), ct: b64(ct) };
  }

  async function decrypt(privateKey, envelope) {
    if (!envelope || envelope.v !== 1) throw new Error("vault_envelope");
    const epk = await subtle.importKey("jwk", envelope.epk, EC, false, []);
    const plain = await subtle.decrypt({ name: "AES-GCM", iv: unb64(envelope.iv) }, await aesKey(privateKey, epk), unb64(envelope.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }

  globalThis.FlowVault = { setup, unlock, rewrap, encrypt, decrypt, ITERATIONS };
})();
