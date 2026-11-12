/* English host factory. Auth provenance and bound credentials belong to the common bridge. */
(() => {
  'use strict';
  if (window.flowEnglishHost) return;
  const required = ['captureAuth', 'isAuthCurrent', 'sendEnglishBound', 'subscribeInvalidation'];
  const completion = new Set(['unitdone', 'placed', 'ruledone']);
  const practice = new Set(['practiceevent','practiceword','practiceprogress','practicesource']);
  const error = reason => Error('english_' + reason);

  function create(source) {
    if (source?.version !== 1 || required.some(name => typeof source[name] !== 'function')) throw error('auth_contract');
    const auth = Object.fromEntries(required.map(name => [name, source[name].bind(source)]));
    const confirmedCapabilities = typeof source.confirmedCapabilities === 'function' ? source.confirmedCapabilities.bind(source) : () => null;
    const speechAbort = typeof source.speechAbort === 'function' ? source.speechAbort.bind(source) : () => false;
    const listeners = new Set(), revoked = new WeakSet(), epochs = new WeakSet();
    let binding = null, generation = 0, checking = false;

    function notify() {
      for (const listener of [...listeners]) {
        try { listener(); } catch (_) { /* One consumer cannot retain another consumer's old lease. */ }
      }
    }
    function invalidate() {
      generation++;
      if (binding) revoked.add(binding.context);
      binding = null;
      notify();
    }
    function valid(context) {
      if (!context || typeof context !== 'object' || !Object.isFrozen(context)) return false;
      const keys = Reflect.ownKeys(context), names = ['scope', 'epoch', 'authorized'];
      if (keys.length !== names.length || keys.some(key => !names.includes(key))) return false;
      if (names.some(name => !Object.hasOwn(Object.getOwnPropertyDescriptor(context, name), 'value'))) return false;
      return context.authorized === true &&
        typeof context.scope === 'string' && /^[a-f0-9]{64}$/.test(context.scope) &&
        context.epoch !== null && typeof context.epoch === 'object' && Object.isFrozen(context.epoch);
    }
    function captureOwner() {
      if (checking) return null;
      checking = true;
      const started = generation;
      let context = null;
      try {
        const candidate = auth.captureAuth();
        if (valid(candidate) && auth.isAuthCurrent(candidate) === true) context = candidate;
      } catch (_) {}
      checking = false;
      if (generation !== started) return null;
      if (binding?.context === context) return binding.lease;
      const changed = binding !== null;
      if (binding) revoked.add(binding.context);
      binding = null;
      if (context && !revoked.has(context) && !epochs.has(context.epoch)) {
        epochs.add(context.epoch);
        binding = {context, lease: Object.freeze({scope: context.scope, epoch: context.epoch, authorized: true})};
      }
      if (changed) { generation++; notify(); }
      return binding?.lease || null;
    }
    const isCurrent = lease => !!lease && captureOwner() === lease;
    function capability(name) {
      if (!captureOwner()) return false;
      try {
        const value = confirmedCapabilities(binding.context);
        return !!value && Object.isFrozen(value) && value.version === 2 && value[name] === true;
      } catch (_) { return false; }
    }
    async function send(op, args = {}, lease, options={}) {
      if (!isCurrent(lease)) throw error('owner_changed');
      const signal=options?.signal;
      if(signal&&(op!=='speech'||!speechAbort(binding.context)||typeof signal.aborted!=='boolean'||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))throw error('abort_read_only');
      if(signal?.aborted){const stopped=error('speech_cancelled');stopped.name='AbortError';throw stopped;}
      if (typeof op !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(op) || !args || typeof args !== 'object' || Array.isArray(args)) throw error('bad_request');
      if (completion.has(op) && !capability('completionAttempts')) throw error('completion_contract');
      if (practice.has(op) && !capability('practiceEvents')) throw error('practice_contract');
      if ((completion.has(op) || ['practiceevent','practiceword'].includes(op)) && (typeof args.attempt !== 'string' || !/^[A-Za-z0-9:._-]{1,80}$/.test(args.attempt))) throw error('bad_attempt');
      const current = binding, captured = JSON.parse(JSON.stringify(args));
      if (!isCurrent(lease) || binding !== current) throw error('owner_changed');
      try {
        const answer = await auth.sendEnglishBound(op, captured, current.context,signal?Object.freeze({signal}):undefined);
        if (!isCurrent(lease)) throw error('owner_changed');
        return answer;
      } catch (cause) {
        if (!isCurrent(lease)) throw error('owner_changed');
        if (cause?.status === 401 || ['unauthorized', 'reopen_app'].includes(cause?.message)) invalidate();
        throw cause;
      }
    }
    function subscribeInvalidation(listener) {
      if (typeof listener !== 'function') throw error('invalidation_listener');
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
    const capabilities = Object.freeze({get completionAttempts(){return capability('completionAttempts');},get practiceEvents(){return capability('practiceEvents');},get speechAbort(){return !!captureOwner()&&speechAbort(binding.context)===true;}});
    const host = Object.freeze({version: 2, capabilities, captureOwner, isCurrent, send, subscribeInvalidation});
    if (typeof auth.subscribeInvalidation(invalidate) !== 'function') throw error('auth_subscription');
    return host;
  }

  window.flowEnglishHost = Object.freeze({create});
})();
