/* Bind the prototype directory to the existing Flow routes and data. */
(() => {
  'use strict';
  if (document.documentElement.dataset.flowSkin !== 'glow') return;
  const { more, practice } = window.flowGlowTemplates;
  const number = (count, forms) => `${count} ${word(count, ...forms)}`;

  window.renderMorePage = function () {
    const overdue = overdueTasks().length;
    const pc = ui.pc?.data;
    const current = pc && rmFresh(pc) ? pc.rmQueue?.jobs?.find(job => RM_ACTIVE.includes(job.status)) : null;
    const percent = current ? rmProgress(current) : null;
    const services = ui.server?.data?.services;
    const vpnDevices = ui.vpn?.data?.clients?.filter(client => client.enabled).length;
    const payments = data.finance.payments.some(payment => payment.status === 'pending' && payment.nextOn === offsetIso(1));
    const docs = ui.docs?.list?.length;
    const model = {
      finance: rub(rubBalance()) + (payments ? ' · платёж завтра' : ''),
      tasks: `${openTasks().length} открыто${overdue ? ` · ${overdue} просрочено` : ''}`,
      projects: `${data.projects.length} активных`,
      docs: docs == null ? 'Под замком' : number(docs, ['документ', 'документа', 'документов']),
      vault: 'Под замком',
      archive: `В корзине: ${data.trash.length}`,
      render: {title:esc(current?.name || 'Очередь рендеров'), progress:Number.isFinite(percent) ? Math.round(percent) : null},
      pc: pc?.on === false ? 'Выключен' : pc?.agent && rmFresh(pc) ? 'В сети' : '',
      server: services && Object.values(services).length && Object.values(services).every(service => service.active) ? 'Все службы работают' : '',
      vpn: vpnDevices == null ? '' : number(vpnDevices,['устройство','устройства','устройств']),
    };
    return `<div class="gw gw-directory" role="region" aria-label="Ещё">${more(model)}</div>`;
  };

  const livePage = window.extendedPage;
  window.extendedPage = function (page) {
    if (!['sport', 'english', 'piano'].includes(page)) return livePage(page);
    const english = typeof enState === 'function' ? enState()?.today?.plan?.doneToday : undefined;
    const status = [
      ['sport', 'dumbbell', 'Спорт', typeof spPracticeStatus === 'function' && spPracticeStatus().status === 'done'],
      ['english', 'book', 'Английский', english === true],
      ['piano', 'piano', 'Пианино', window.FlowPiano?.practiceStatus?.().status === 'done'],
    ].map(([id, glyph, title, done]) => [id, glyph, title, done ? 'Сделано' : 'Открыть', done ? 1 : 0, done ? 'ok' : '']);
    return `<div class="gw gw-practice-tabs">${practice(status, page)}</div>${livePage(page)}`;
  };
  document.addEventListener('click', event => {
    const tab = event.target.closest?.('.gw-practice-tabs [data-prac]');
    if (!tab) return;
    navigate(tab.dataset.prac);
    if (event.detail === 0) document.querySelector('.gw-practice-tabs .pr.on')?.focus({preventScroll:true});
  });
})();
