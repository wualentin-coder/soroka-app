/* Approved Flow vortex. Geometry stays fixed; light follows the current theme. */
(() => {
  'use strict';
  if (document.documentElement.dataset.flowDesign === 'classic') return;
  if (window.flowDigitalBrand) return;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const selector = 'img.brand-mark, .splash-mark img';
  const root = document.documentElement;
  const scriptURL = document.currentScript?.src || document.baseURI;
  const assetBase = new URL('.', scriptURL);
  const revisions = {
    'flow-vortex-magic.svg': 'a2e75fa07f',
    'flow-vortex-magic-mono.svg': '39172c27a3',
  };
  const pending = new Set();
  const abort = new AbortController();
  let source = null;
  let mono = null;
  let bodyObserver = null;
  let rootObserver = null;
  let queued = false;
  let disposed = false;
  let instances = 0;
  let replacements = 0;
  let assetError = false;
  let lastFavicon = '';

  function parse(text) {
    const xml = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'svg' || xml.documentElement.namespaceURI !== SVG_NS) {
      throw new Error('Invalid Flow vector');
    }
    return xml.documentElement;
  }

  function cloneVector(template) {
    const svg = template.cloneNode(true);
    const prefix = `flow-vortex-${++instances}-`;
    const ids = new Map();
    for (const node of [svg, ...svg.querySelectorAll('[id]')]) {
      if (!node.id) continue;
      const previous = node.id;
      ids.set(previous, prefix + previous);
      node.id = prefix + previous;
    }
    for (const node of [svg, ...svg.querySelectorAll('*')]) {
      for (const attribute of [...node.attributes]) {
        let value = attribute.value;
        for (const [oldId, newId] of ids) {
          value = value.split(`url(#${oldId})`).join(`url(#${newId})`)
            .split(`url("#${oldId}")`).join(`url("#${newId}")`)
            .split(`url('#${oldId}')`).join(`url('#${newId}')`);
          if (attribute.localName === 'href' && value === '#' + oldId) value = '#' + newId;
        }
        if (attribute.name === 'aria-labelledby' || attribute.name === 'aria-describedby') {
          value = value.split(/\s+/).map(id => ids.get(id) || id).join(' ');
        }
        if (value !== attribute.value) node.setAttributeNS(attribute.namespaceURI, attribute.name, value);
      }
    }
    return document.importNode(svg, true);
  }

  function replace(image) {
    if (!source || !image.isConnected || !image.matches(selector)) return;
    const svg = cloneVector(source);
    svg.setAttribute('class', `${image.getAttribute('class') || ''} flow-vortex-mark`.trim());
    svg.setAttribute('data-flow-brand', 'vortex');
    svg.setAttribute('focusable', 'false');
    svg.removeAttribute('aria-labelledby');
    svg.removeAttribute('aria-describedby');
    const label = image.getAttribute('aria-label') || image.getAttribute('alt');
    if (label) {
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', label);
    } else {
      svg.removeAttribute('role');
      svg.setAttribute('aria-hidden', 'true');
    }
    for (const name of ['width', 'height', 'style', 'title']) {
      if (image.hasAttribute(name)) svg.setAttribute(name, image.getAttribute(name));
    }
    if (image.closest('.splash-mark')) {
      const style = getComputedStyle(image);
      if (!svg.hasAttribute('width')) svg.setAttribute('width', String(parseFloat(style.width) || 64));
      if (!svg.hasAttribute('height')) svg.setAttribute('height', String(parseFloat(style.height) || 64));
    }
    svg.style.color = 'var(--accent, currentColor)';
    svg.style.setProperty('--flow-logo-accent', 'var(--accent, currentColor)');
    svg.style.setProperty('--flow-logo-hot', 'color-mix(in srgb, var(--accent, currentColor) 32%, var(--text, #fff))');
    svg.style.setProperty('--flow-logo-deep', 'color-mix(in srgb, var(--accent, currentColor) 24%, var(--page, #101820))');
    svg.style.borderRadius = '0';
    svg.style.boxShadow = 'none';
    svg.style.overflow = 'visible';
    image.replaceWith(svg);
    replacements++;
  }

  function favicon() {
    if (!mono || disposed) return;
    const marker = document.querySelector('svg[data-flow-brand]');
    const style = getComputedStyle(root);
    const color = (marker ? getComputedStyle(marker).color : style.getPropertyValue('--accent').trim()) || style.color;
    if (!color || color === lastFavicon || !CSS.supports('color', color)) return;
    const icon = mono.cloneNode(true);
    icon.setAttribute('color', color);
    icon.style.color = color;
    const href = 'data:image/svg+xml,' + encodeURIComponent(new XMLSerializer().serializeToString(icon));
    let link = document.querySelector('link[rel~="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.append(link);
    }
    link.type = 'image/svg+xml';
    link.href = href;
    lastFavicon = color;
  }

  function flush() {
    queued = false;
    if (disposed) return;
    for (const image of pending) if (!image.isConnected || (!source && assetError)) pending.delete(image);
    if (source) {
      for (const image of pending) replace(image);
      pending.clear();
    }
    favicon();
  }

  function schedule() {
    if (queued || disposed) return;
    queued = true;
    queueMicrotask(flush);
  }

  function collect(node) {
    if (node.nodeType !== 1) return false;
    let found = false;
    if (node.matches(selector)) { pending.add(node); found = true; }
    for (const image of node.querySelectorAll(selector)) { pending.add(image); found = true; }
    return found;
  }

  function refresh() {
    if (disposed || !document.body) return;
    collect(document.body);
    schedule();
  }

  async function asset(name) {
    const url = new URL('assets/' + name, assetBase);
    const revision = revisions[name];
    url.searchParams.set('v', revision?.startsWith('__') ? '20261103-digital-magic-1' : revision);
    const response = await fetch(url, { signal: abort.signal });
    if (!response.ok) throw new Error('Flow vector unavailable');
    return parse(await response.text());
  }

  async function load() {
    const results = await Promise.allSettled([asset('flow-vortex-magic.svg'), asset('flow-vortex-magic-mono.svg')]);
    if (disposed) return;
    source = results[0].status === 'fulfilled' ? results[0].value : null;
    mono = results[1].status === 'fulfilled' ? results[1].value : null;
    assetError = results.some(result => result.status === 'rejected');
    // Failed requests retain the existing image; a later app render must not blank it.
    if (!source) pending.clear();
    refresh();
  }

  function start() {
    if (disposed || !document.body) return;
    bodyObserver = new MutationObserver(records => {
      let found = false;
      for (const record of records) for (const node of record.addedNodes) found = collect(node) || found;
      if (found) schedule();
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    rootObserver = new MutationObserver(schedule);
    rootObserver.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-palette', 'data-accent', 'data-flow-design', 'style', 'class'] });
    refresh();
    void load();
  }

  function dispose() {
    disposed = true;
    bodyObserver?.disconnect();
    rootObserver?.disconnect();
    abort.abort();
    pending.clear();
    document.removeEventListener('DOMContentLoaded', start);
    window.removeEventListener('pageshow', refresh);
    window.removeEventListener('pagehide', onPageHide);
  }

  function onPageHide(event) { if (!event.persisted) dispose(); }
  window.flowDigitalBrand = {
    createMark: () => source ? cloneVector(source) : null,
    refresh,
    dispose,
    getState: () => ({ ready: !!source, faviconReady: !!mono, replacements, instances, assetError, disposed })
  };
  window.addEventListener('pageshow', refresh);
  window.addEventListener('pagehide', onPageHide);
  if (document.readyState === 'loading' && !document.body) document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
