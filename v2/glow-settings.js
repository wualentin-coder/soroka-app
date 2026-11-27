/* Flow · Glow — группы и подстраницы настроек по R.settings и R.setp. */
(() => {
  'use strict';
  if (document.documentElement.dataset.flowSkin !== 'glow') return;

  const {settings, settingsRoutes} = window.flowGlowTemplates;
  const routes = {look:'appearance', home:'home', notif:'notifications', bot:'bot', phone:'phone', links:'connections', ai:'assistant', sec:'security', data:'data'};
  const panes = new Map(Object.entries(routes).map(([key, route]) => [route, settingsRoutes[key].title]));
  const list = html => `<div class="glass list gw-settings-panel">${html}</div>`;
  const body = group => [...(group?.children || [])].filter(node => node.tagName !== 'H2').map(node => node.outerHTML).join('');
  const markup = nodes => nodes.filter(Boolean).map(node => node.outerHTML).join('');
  const row = (title, glyph, attrs) => `<button type="button" class="rw" ${attrs}><span class="ic" aria-hidden="true">${icon(glyph)}</span><span><b>${title}</b></span>${icon('right', 'chev')}</button>`;
  const settingRow = (parent, key) => parent?.querySelector(`[data-setting="${key}"]`)?.closest('.settings-row');

  function settingsOverview() {
    const telegram = window.Telegram?.WebApp;
    const user = telegram?.initDataUnsafe?.user;
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Flow';
    const palette = window.flowGlow?.palette || '';
    const values = {
      look: palette.charAt(0).toUpperCase() + palette.slice(1),
      home: {today:'План', saved:'Сохранённое', finance:'Финансы', more:'Ещё'}[data.settings.startPage] || 'План',
      notif: data.settings.digest || '',
      bot: telegram?.initData ? 'Подключён' : '',
      phone: phoneState()?.linked ? 'Подключён' : '',
      ai: data.settings.manualOnly ? 'Ввод вручную' : '',
    };
    const sections = Object.fromEntries(Object.entries(settingsRoutes).map(([id, meta]) => [id, {
      t:meta.title, i:meta.icon, c:meta.color, summary:esc(values[id] || ''),
    }]));
    return settings({
      account: {
        initial:esc([...name][0]?.toUpperCase() || ''),
        name:esc(name),
        detail:telegram?.initData ? 'Telegram подключён' : window.SorokaAndroid ? 'Flow для Android' : '',
      },
      sections,
    });
  }

  function settingsBody(key, {native, appearance, workspace, storage, assistant, sensory}) {
    const bot = native.find(group => group.querySelector('[data-setting=context]'));
    const phone = native.find(group => group.querySelector('.phone-panel'));
    const connections = native.find(group => group.querySelector('[data-action=en-browser-open]'));
    switch (key) {
      case 'appearance': {
        appearance?.querySelector('[data-settings-accent]')?.remove();
        sensory?.querySelector('[data-directory-motion-source]')?.remove();
        sensory?.querySelector('[data-directory-effect-summary]')?.remove();
        sensory?.querySelector('[data-directory-motion-system]')?.remove();
        const density = settingRow(workspace, 'density');
        if (density) appearance?.querySelector('.list-panel')?.append(density);
        return list(body(appearance)) + list(body(sensory));
      }
      case 'home': return list(markup([settingRow(workspace, 'startPage')]));
      case 'notifications': return list(`<div class="list-panel">${markup(['digest','digestEvening','quietFrom','notifyShower','notifyHabits','notifyEnglish'].map(key => settingRow(bot,key)))}</div>`);
      case 'bot': return list(`<div class="list-panel">${markup([settingRow(bot,'context'), bot?.querySelector('.settings-status')?.closest('.settings-row')])}</div>`);
      case 'phone': return list(phone ? body(phone) : '<p class="gw-settings-note">Настройки телефона доступны в Flow для Android.</p>');
      case 'connections': return list(body(connections));
      case 'assistant': return list(body(assistant));
      case 'security': return list(row('Пароли', 'key', 'data-action="navigate" data-page="vault"'));
      case 'data': return list(body(storage));
    }
    return settingsOverview();
  }

  window.flowMagicUI.glowSettings = sections => {
    const route = settingsRoute();
    const pane = panes.has(route) ? route : '';
    const back = pane ? 'data-gw-settings-back' : 'data-action="navigate" data-page="more"';
    return `<div class="gw gw-settings" data-settings-pane="${pane}">
      <header class="gw-settings-heading">
        <button type="button" class="ib glass" ${back} aria-label="${pane ? 'К настройкам' : 'В меню «Ещё»'}">${icon('left')}</button>
        <h1>${panes.get(pane) || 'Настройки'}</h1>
      </header>
      ${settingsBody(pane, sections)}
    </div>`;
  };

  document.addEventListener('click', event => {
    const control = event.target.closest?.('.gw-settings [data-stp], .gw-settings [data-gw-settings-back]');
    if (!control) return;
    if (control.hasAttribute('data-gw-settings-back')) {
      if (history.state?.glowSettingsParent) history.back();
      else location.replace('#settings');
      return;
    }
    const route = routes[control.dataset.stp];
    if (route) location.hash = `settings/${route}`;
  });

  window.addEventListener('hashchange', event => {
    if (ui.page !== 'settings') return;
    const previous = new URL(event.oldURL).hash;
    if (previous !== '#settings' && !settingsRoute(previous)) return;
    if (previous === '#settings' && settingsRoute()) history.replaceState({ ...history.state, glowSettingsParent:true }, '');
    render();
    window.scrollTo({ top:0, behavior:'instant' });
    focusRouteHeading();
  });
})();
