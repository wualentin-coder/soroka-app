/* Flow · Glow — меню «Ещё», композиция R.more из прототипа. */
(() => {
  'use strict';
  const renderMore = window.renderMorePage;
  const deviceGlyphs = {
    desktop: '<rect x="3" y="4.5" width="18" height="12" rx="2.5"/><path d="M9 20h6M12 16.5V20"/>',
    shield: '<path d="M12 3.5l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9v-5Z"/>',
  };
  const glyph = name => deviceGlyphs[name]
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${deviceGlyphs[name]}</svg>`
    : icon(name);

  function row(page, label, symbol, detail = '', progress = null) {
    const route = page === 'sites'
      ? 'data-action="navigate" data-category="sites" data-page="saved"'
      : `data-action="navigate" data-page="${page}"`;
    const meter = progress === null ? '' : `<span class="gw-mini" style="--v:${progress / 100}" aria-hidden="true"><i></i></span>`;
    return `<button class="rw" type="button" ${route}><span class="ic" aria-hidden="true">${glyph(symbol)}</span><span><b>${label}</b>${detail ? `<small>${esc(detail)}</small>` : ''}${meter}</span>${progress === null ? icon('right', 'chev') : `<span class="live">${progress}%</span>`}</button>`;
  }

  window.renderMorePage = function () {
    if (document.documentElement.dataset.flowSkin !== 'glow') return renderMore();

    const overdue = overdueTasks().length;
    const pc = ui.pc?.data;
    const current = pc && rmFresh(pc) ? pc.rmQueue?.jobs?.find(job => RM_ACTIVE.includes(job.status)) : null;
    const percent = current ? rmProgress(current) : null;
    const progress = Number.isFinite(percent) ? Math.round(percent) : null;

    return `<div class="gw gw-directory" role="region" aria-label="Ещё">
      <div class="glass list" role="group" aria-label="Дела и личное">
        ${row('finance', 'Финансы', 'wallet', rub(rubBalance()))}
        ${row('tasks', 'Все дела', 'list', `${openTasks().length} открыто${overdue ? ` · ${overdue} просрочено` : ''}`)}
        ${row('projects', 'Проекты', 'folder')}
        ${row('docs', 'Документы', 'file')}
        ${row('vault', 'Пароли', 'key')}
        ${row('archive', 'Архив и корзина', 'archive', `В корзине: ${data.trash.length}`)}
        ${row('inbox', 'Разобрать', 'inbox', `Ждут решения: ${inboxEntries().length}`)}
        ${row('sites', 'Мини-сайты', 'overview')}
      </div>
      <div class="gap" aria-hidden="true"></div>
      <div class="glass list" role="group" aria-label="Устройства и работа">
        ${row('render', 'Рендер', 'film', current?.name || 'Очередь рендеров', progress)}
        ${row('pc', 'Компьютер', 'desktop', pc?.on === false ? 'Выключен' : pc?.agent && rmFresh(pc) ? 'В сети' : '')}
        ${row('server', 'Сервер', 'server')}
        ${row('vpn', 'VPN', 'shield')}
      </div>
      <div class="gap" aria-hidden="true"></div>
      <div class="glass list" role="group" aria-label="Настройки и занятия">
        ${row('settings', 'Настройки', 'settings', 'Вид, уведомления и данные')}
        ${row('sport', 'Спорт', 'heart')}
        ${row('english', 'Английский', 'study')}
        ${row('piano', 'Пианино', 'piano')}
      </div>
    </div>`;
  };
})();
