/* Generated from docs/design/glow-prototype/index.html. Run node scripts/build-glow-templates.mjs. */
(() => {
  "use strict";
  const I=(d,extra='')=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const ic={
  back:I('<path d="M15 5l-7 7 7 7"/>'), chev:I('<path d="M9 6l6 6-6 6"/>'), plus:I('<path d="M12 5v14M5 12h14"/>'), search:I('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'),
  check:I('<path d="M5 12.5l4.5 4.5L19 7.5"/>','stroke-width="3"'),
  piano:I('<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M8.5 5v8M12 5v8M15.5 5v8M7 13h3M10.5 13h3M14 13h3"/>'),
  book:I('<path d="M4 19V6a2 2 0 0 1 2-2h12v13H6a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h12"/><path d="M9 8h5"/>'),
  dumbbell:I('<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>'),
  inbox:I('<path d="M4 13l2.5-7h11L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M4 13h4l1.5 2.5h5L16 13h4"/>'),
  list:I('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
  folder:I('<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>'),
  file:I('<path d="M7 3.5h7l4.5 4.5v12a1 1 0 0 1-1 1h-10.5a1 1 0 0 1-1-1v-15.5a1 1 0 0 1 1-1Z"/><path d="M14 3.5V8h4.5"/>'),
  key:I('<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2"/>'),
  archive:I('<rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>'),
  desktop:I('<rect x="3" y="4.5" width="18" height="12" rx="2.5"/><path d="M9 20h6M12 16.5V20"/>'),
  film:I('<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M8 4.5v15M16 4.5v15M3.5 9.5H8M3.5 14.5H8M16 9.5h4.5M16 14.5h4.5"/>'),
  server:I('<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01"/>'),
  shield:I('<path d="M12 3.5l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9v-5Z"/>'),
  gear:I('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/>'),
  cart:I('<path d="M3.5 4.5h2l2 11h10l2-8H7"/><circle cx="9" cy="19.5" r="1.2"/><circle cx="17" cy="19.5" r="1.2"/>'),
  cup:I('<path d="M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z"/><path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2M11 3.5v2"/>'),
  car:I('<path d="M5 16.5V12l2-5h10l2 5v4.5M3.5 12h17"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/>'),
  wallet:I('<path d="M4 7.5a2 2 0 0 1 2-2h11v4"/><rect x="4" y="9.5" width="16" height="10" rx="2.5"/><path d="M16 14.5h.01"/>'),
  reset:I('<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/>'),
  up:I('<path d="M12 4v16M6 10l6-6 6 6"/>'),
  pin2:I('<path d="M9 3.5h6l-1 5.5 3.5 3.5h-11L10 9Z"/><path d="M12 12.5v8"/>'),
  pinned:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3.5h6l-1 5.5 3.5 3.5h-11L10 9Z"/><path d="M12 12.5v8" fill="none"/></svg>',
  note:I('<path d="M6 3.5h8l4.5 4.5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15.5a1 1 0 0 1 1-1Z"/><path d="M8.5 12h7M8.5 16h5"/>'),
  check2:I('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 12.5l2.8 2.8L16.5 9"/>'),
  bowl:I('<path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0Z"/><path d="M9 7.5c0-1.5 1-1.5 1-3M13.5 7.5c0-1.5 1-1.5 1-3"/>'),
  pin:I('<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>'),
  ticket:I('<path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2.5 2.5 0 0 0 0-5Z"/><path d="M14 6v12" stroke-dasharray="2 2.5"/>'),
  card:I('<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M3 10h18M7 14.5h4"/>'),
};
  const LI = I;
  const settingIcons = { desktop:ic.desktop, sun:LI('<circle cx="12" cy="12" r="3.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>'), bell:LI('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'), bot:LI('<rect x="4.5" y="8" width="15" height="11" rx="3.5"/><path d="M12 8V4.5M9 13h.01M15 13h.01"/><circle cx="12" cy="4" r="1"/>'), phone:LI('<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>'), link:LI('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>'), face:LI('<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9.5v1M15 9.5v1M12 9.5v3.5h-1M9.5 15.5c1.4 1 3.6 1 5 0"/>'), data:LI('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 16.5v2a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2"/>') };
  const syChev = () => ic.chev.replace("<svg", '<svg class="chev"');
  const STG=[['look','home'],['notif','bot','phone'],['links','ai'],['sec','data']];
  const goRows=a=>a.map(([g,i,t,s])=>`<button class="rw" data-action="navigate" data-page="${g}"><span class="ic">${ic[i]}</span><span><b>${t}</b><small>${s}</small></span>${ic.chev.replace('<svg','<svg class="chev"')}</button>`).join('');
  const more=model=>`
  <div class="glass list">
    <button class="rw" data-action="navigate" data-page="finance"><span class="ic">${ic.wallet}</span><span><b>Финансы</b><small>${model.finance}</small></span>${ic.chev.replace('<svg','<svg class="chev"')}</button>
    ${[['tasks','list','Все дела',()=>model.tasks],['projects','folder','Проекты',()=>model.projects],
      ['docs','file','Документы',()=>model.docs],['vault','key','Пароли',()=>model.vault],['archive','archive','Архив и корзина',()=>model.archive]]
      .map(([g,i,t,s])=>`<button class="rw" data-action="navigate" data-page="${g}"><span class="ic">${ic[i]}</span><span><b>${t}</b><small>${s()}</small></span>${ic.chev.replace('<svg','<svg class="chev"')}</button>`).join('')}</div>
  <div class="gap"></div>
  <div class="glass list">
    <button class="rw" data-action="navigate" data-page="render"><span class="ic">${ic.film}</span><span><b>Рендер</b><small>${model.render.title}</small>${model.render.progress == null ? "" : `<span class="gw-mini" style="--v:${model.render.progress / 100}"><i id="gw-miniR"></i></span>`}</span>${model.render.progress == null ? ic.chev.replace("<svg", '<svg class="chev"') : `<span class="live" id="gw-liveR">${model.render.progress}%</span>`}</button>
    ${goRows([['pc','desktop','Компьютер',model.pc],['server','server','Сервер',model.server],['vpn','shield','VPN',model.vpn]])}
  </div>
  <div class="glass list" style="margin-top:10px">${goRows([['settings','gear','Настройки','Вид, уведомления и данные']])}</div>`;
  const settings=({account,sections})=>`
  <div class="glass sta"><span class="ic pcic" style="--c:var(--a3)"><b>${account.initial}</b></span><span><b>${account.name}</b><small>${account.detail}</small></span></div>
  ${STG.map(g=>`<div class="glass list stgrp">${g.map(k=>{const p=sections[k];return `<button class="rw syset" data-stp="${k}" style="--c:${p.c}"><span class="ic">${settingIcons[p.i]}</span><span><b>${p.t}</b></span><span class="stv2">${p.summary}${syChev()}</span></button>`}).join('')}</div>`).join('')}`;
  const practice=(PRAC,selected)=>`
  <div class="practice" id="gw-prac">${PRAC.map(([p,i,t,s,l,st])=>
    `<button class="pr press${selected===p?' on':''}" data-prac="${p}" aria-label="${t}, ${s}"><span class="plate-w" style="--lvl:${l};display:block"><span class="halo"></span><span class="plate"><span class="fill"></span><i class="st ${st}"></i>${ic[i].replace('<svg','<svg class="glyph"')}<b>${t}</b></span></span></button>`).join('')}</div>`;
  window.flowGlowTemplates = Object.freeze({
    more, settings, practice, settingsRoutes:{"look":{"title":"Внешний вид","icon":"sun","color":"#ff8a5c"},"home":{"title":"Главный экран","icon":"desktop","color":"#6cb6ff"},"notif":{"title":"Уведомления","icon":"bell","color":"#ff6b6b"},"bot":{"title":"Бот","icon":"bot","color":"#5ac8fa"},"phone":{"title":"Телефон","icon":"phone","color":"#5dff9e"},"links":{"title":"Подключения","icon":"link","color":"#a78bff"},"ai":{"title":"Модели ИИ","icon":"bot","color":"#ffb547"},"sec":{"title":"Безопасность","icon":"face","color":"#5dff9e"},"data":{"title":"Данные","icon":"data","color":"#6cb6ff"}}, dock:{"today":{"label":"План","svg":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"><rect x=\"3.5\" y=\"5\" width=\"17\" height=\"15\" rx=\"4\"/><path d=\"M3.5 10h17M8 3v4M16 3v4\"/></svg>"},"saved":{"label":"Сохранённое","svg":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linejoin=\"round\"><path d=\"M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1Z\"/></svg>"},"practice":{"label":"Занятия","svg":"<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.8.3 1.6 1 2.6 2 3.1C11.6 8.6 11 5.8 12 3Z\"/></svg>"},"more":{"label":"Ещё","svg":"<svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><circle cx=\"6\" cy=\"12\" r=\"1.8\"/><circle cx=\"12\" cy=\"12\" r=\"1.8\"/><circle cx=\"18\" cy=\"12\" r=\"1.8\"/></svg>"}},
  });
})();
