const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function dialogHeader(title,id){return `<header class="dialog-header"><h2 id="${escape(id)}">${escape(title)}</h2><button class="dialog-close" type="button" aria-label="Закрыть"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18"/></svg></button></header>`;}
export const dialogHeaderSheet=new CSSStyleSheet();dialogHeaderSheet.replaceSync(`
.dialog-header{position:relative;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:2px 4px 16px;margin:0 0 12px}
.dialog-header::after{content:'';position:absolute;inset:auto 0 0;height:1px;background:linear-gradient(90deg,var(--fu-line),color-mix(in srgb,var(--fu-accent) 65%,var(--fu-line)) 52%,var(--fu-line));opacity:.75;pointer-events:none}
.dialog-header h2{font:600 22px/1.25 var(--fu-font);color:var(--fu-text);margin:0;min-width:0;overflow-wrap:anywhere}
.dialog-close{display:grid;place-items:center;flex:0 0 44px;width:44px;height:44px;padding:0;border:1px solid var(--fu-line);border-radius:14px;background:transparent;color:var(--fu-muted);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background-color 220ms ease,transform 220ms ease}
.dialog-close svg{display:block;width:20px;height:20px}.dialog-close:active{transform:scale(.96);background:color-mix(in srgb,var(--fu-accent) 8%,transparent)}.dialog-close:focus-visible{outline:2px solid var(--fu-accent);outline-offset:3px}
@media(prefers-reduced-motion:reduce){:host-context(html:not([data-motion=on])) .dialog-close{transition:none}}
:host-context([data-reduce=true]) .dialog-close{transition:none}
`);
