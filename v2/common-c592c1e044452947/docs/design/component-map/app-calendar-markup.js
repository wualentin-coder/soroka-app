// Extracted from actual digital-pages.js. Regenerate with scripts/build-map-calendar.py.
export function calendarMarkup(ui,env){
 const {calendarDays,todayIso,monthName,cachedDate,localIso,parseDate,tasksOn,eventsOn,dayInfo,fullDate,word,esc}=env;
  function calendarDayMarkup(date) {
    const day=localIso(date),pending=tasksOn(day).filter(item=>!item.done).length,events=eventsOn(day).length;
    const info=typeof dayInfo==='function'?dayInfo(day):{},selected=day===ui.selected,today=day===todayIso(),outside=day.slice(0,7)!==ui.month.slice(0,7);
    const kind=info.holiday?'holiday':info.workday?'workday':info.off?'weekend':'ordinary';
    const label=[fullDate(day),selected?'выбрано':'',today?'сегодня':'',`${pending} ${word(pending,'задача','задачи','задач')}`,`${events} ${word(events,'событие','события','событий')}`,info.holiday||'',kind==='weekend'?'выходной день':'',info.workday?'рабочий день':''].filter(Boolean).join(', ');
    return `<button type="button" class="calendar-day dm-calendar-day${selected?' selected':''}${today?' today':''}${outside?' outside':''}${info.off?' is-off':''}" data-action="select-day" data-date="${day}" data-day-kind="${kind}"${info.holiday?` title="${esc(info.holiday)}"`:''} aria-label="${esc(label)}" aria-pressed="${selected}"><span>${date.getDate()}</span><span class="calendar-dots">${'<i title="Незавершённая задача"></i>'.repeat(Math.min(pending,events?2:3))}${events?'<i class="event-dot" title="События"></i>':''}</span></button>`;
  }
  const card=function(){
    const expanded=Boolean(ui.calendarExpanded),days=calendarDays(),selected=ui.selected||todayIso(),anchor=ui.calendarAnchor||selected;
    const period=expanded?monthName(ui.month):monthName(anchor.slice(0,7)+'-01');
    const shortDate=date=>cachedDate('short',localIso(date));
    const range=expanded?`Месяц целиком · ${new Date(parseDate(ui.month).getFullYear(),parseDate(ui.month).getMonth()+1,0).getDate()} дн.`:`${shortDate(days[0])} — ${shortDate(days.at(-1))} · неделя`;
    const selectedIndex=days.findIndex(date=>localIso(date)===selected),row=selectedIndex<0?0:Math.floor(selectedIndex/7),column=selectedIndex<0?3:selectedIndex%7;
    return `<section class="calendar-card dm-calendar-surface${expanded?' expanded':''}" tabindex="0" role="group" aria-label="${esc(period)} · ${esc(range)}. Листайте влево или вправо; с клавиатуры Page Up и Page Down." data-calendar-swipe data-calendar-scale="${expanded?'month':'week'}" style="--dm-calendar-column:${column};--dm-calendar-row:${row}"><div class="calendar-toolbar"><div class="segmented" aria-label="Вид календаря"><div class="dm-calendar-view-indicator" aria-hidden="true" hidden></div><button type="button" data-action="calendar-mode" data-mode="week" class="${!expanded?'active':''}" aria-pressed="${!expanded}">Неделя</button><button type="button" data-action="calendar-mode" data-mode="month" class="${expanded?'active':''}" aria-pressed="${expanded}">Месяц</button></div><button type="button" class="text-action" data-action="calendar-today">Сегодня</button></div><div class="calendar-weekdays" aria-hidden="true">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(name=>`<span>${name}</span>`).join('')}</div><div class="calendar-grid" aria-label="Дни ${expanded?'месяца':'недели'}"><div class="dm-calendar-week-band" aria-hidden="true" hidden></div><div class="dm-calendar-selection" aria-hidden="true" hidden></div>${days.map(calendarDayMarkup).join('')}</div><div class="calendar-handle" aria-hidden="true"><span></span></div></section>`;
  };
 return card();
}
