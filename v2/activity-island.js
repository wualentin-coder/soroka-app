(function () {
  "use strict";
  const ONLINE_MS = 60000;
  const finite = value => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value)) ? Number(value) : null;
  const percent = value => { const n = finite(value); return n === null ? null : Math.round(Math.max(0, Math.min(100, n))); };
  const escape = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  let zoneFormatter = null, formatterZone = null;
  const eventTimes = new WeakMap();
  function zonedParts(at, timezone) {
    try {
      if (!zoneFormatter || formatterZone !== timezone) {
        zoneFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
        formatterZone = timezone;
      }
      return Object.fromEntries(zoneFormatter.formatToParts(at).map(p => [p.type, p.value]));
    }
    catch (_) { return null; }
  }
  function localDay(at,timezone){const p=zonedParts(at,timezone);return p?`${p.year}-${p.month}-${p.day}`:'';}
  function validDay(value){const at=Date.parse(`${value}T12:00:00Z`);return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(at)&&new Date(at).toISOString().slice(0,10)===value;}
  function annualDay(year,month,day){return new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10);}
  function eventOccurrence(event, timezone,now=Date.now(),today='') {
    const repeat=event.repeat??event.repeatRule??event.repeat_rule,yearly=repeat==='yearly',day=yearly?(today||localDay(now,timezone)):'';
    const cached = eventTimes.get(event);
    if (cached && cached.timezone === timezone && cached.due === event.due && cached.time === event.time && cached.startsAt === event.startsAt&&cached.repeat===repeat&&cached.day===day&&!(yearly&&!cached.value?.allDay&&cached.value?.at<now)) return cached.value;
    let value=null;
    const explicit=event.startsAt?Date.parse(event.startsAt):null;
    if(event.startsAt&&!yearly){if(Number.isFinite(explicit))value={at:explicit,due:validDay(event.due)?event.due:localDay(explicit,timezone),time:event.time||'',allDay:false};}
    else{
      const parts=event.startsAt&&Number.isFinite(explicit)?zonedParts(explicit,timezone):null;
      let due=event.due||(parts?`${parts.year}-${parts.month}-${parts.day}`:''),time=event.time||(parts?`${parts.hour}:${parts.minute}`:''),allDay=!time;
      if(validDay(due)&&timezone&&(!time||/^\d{2}:\d{2}$/.test(time))&&(!yearly||day)){
        const [,month,date]=due.split('-').map(Number),year=Number(day.slice(0,4));
        if(yearly){due=annualDay(year,month,date);if(due<day)due=annualDay(year+1,month,date);}
        let at=calculateEventStart(due,time||'00:00',timezone);
        if(yearly&&!allDay&&at!==null&&at<now){due=annualDay(Number(due.slice(0,4))+1,month,date);at=calculateEventStart(due,time,timezone);}
        if(at!==null)value={at,due,time,allDay};
      }
    }
    eventTimes.set(event, { timezone, due: event.due, time: event.time, startsAt: event.startsAt,repeat,day,value });
    return value;
  }
  function eventStart(event,timezone,now=Date.now()){return eventOccurrence(event,timezone,now)?.at??null;}
  function calculateEventStart(due,time,timezone) {
    const target = Date.parse(`${due}T${time}:00Z`);
    if (!Number.isFinite(target)) return null;
    let at = target;
    for (let i = 0; i < 3; i++) {
      const parts = zonedParts(at, timezone);
      if (!parts) return null;
      const wall = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
      at += target - wall;
    }
    const p = zonedParts(at, timezone);
    return p && `${p.year}-${p.month}-${p.day}` === due && `${p.hour}:${p.minute}` === time ? at : null;
  }
  function model({ section = "Flow", pc = null, data = {}, now = Date.now(), unavailable = false }) {
    const r = pc?.render || {};
    const seen = Date.parse(pc?.agentSeen);
    const renderAt = r.at ? Date.parse(r.at) : seen;
    const fresh = !unavailable && pc?.agent === true && Number.isFinite(seen) && now - seen >= -5000 && now - seen < ONLINE_MS
      && Number.isFinite(renderAt) && now - renderAt >= -30000 && now - renderAt < 90000;
    const active = r.rendering === true;
    const jobs=pc?.rmQueue?.jobs||[];
    const job=jobs.find(item=>['rendering','delivering'].includes(item.status))||jobs.find(item=>item.status==='paused');
    const queueStamp=Date.parse(pc?.rmQueue?.at||pc?.rmQueue?.observed_at||pc?.agentSeen);
    const queueFresh=!unavailable&&pc?.agent===true&&pc?.rmQueue?.service?.available!==false&&Number.isFinite(seen)&&now-seen>=-5000&&now-seen<ONLINE_MS&&Number.isFinite(queueStamp)&&now-queueStamp>=-30000&&now-queueStamp<90000;
    const day = zonedParts(now, data.timezone);
    const today = day ? `${day.year}-${day.month}-${day.day}` : "";
    const events = (data.events || []).map(event=>{const occurrence=eventOccurrence(event,data.timezone,now,today);return occurrence?{...event,...occurrence}:null;}).filter(e=>e&&(e.allDay?e.due>=today:e.at>=now)).sort((a,b)=>a.at-b.at).slice(0,3);
    const imminent=events.find(event=>!event.allDay&&event.at-now<=3600000);
    const tasks = (data.tasks || []).filter(t => !t.done && (t.priority === "high" || (today && t.due && t.due < today))).sort((a, b) => Number(b.priority === "high") - Number(a.priority === "high") || String(a.due || "9999").localeCompare(String(b.due || "9999"))).slice(0, 3);
    let kind = "idle", label = section, progress = null;
    if (job) {
      const app=job.app==='karma'?'Karma':job.app==='ae'?'AE':'Рендер';
      kind=!queueFresh?'disconnected':job.status==='paused'?'pause':'render';
      progress=queueFresh?queueProgress(job):null;
      label=!queueFresh?'ПК · нет связи':job.status==='paused'?'Рендер · пауза':job.status==='delivering'?(progress===null?'Перенос в облако':`В облако · ${progress}%`):progress===null?`${app} · ${job.stage||'рендер'}`:`${app} · ${progress}%`;
    } else if (active) {
      if (!fresh) { kind = "disconnected"; label = "ПК · нет связи"; }
      else { kind = "render"; progress = percent(r.percent); const app = r.app === "Karma" ? "Karma" : "AE"; label = progress === null ? `${app} · рендер` : `${app} · ${progress}%`; }
    } else if (imminent) {
      kind = "event"; label = `Через ${Math.max(1, Math.ceil((imminent.at - now) / 60000))} мин`;
    }
    const render = job?{fresh:queueFresh,app:job.app==='karma'?'Karma':job.app==='ae'?'After Effects':'Рендер',queue:true,title:job.name||'Рендер',frame:finite(job.done),frames:finite(job.total),eta:queueFresh&&job.status!=='paused'?finite(job.eta):null,elapsed:null}:active ? { fresh, app:r.app||'After Effects',title: r.comp || r.app || "After Effects", frame: finite(r.frame), frames: finite(r.frames), eta: fresh ? finite(r.eta) : null, elapsed: fresh && finite(r.since) !== null ? Math.max(0, Math.round(now / 1000 - Number(r.since))) : null } : null;
    return { kind, label, progress, render,queueFresh,imminentId:imminent?.id, job:job?{id:job.id,name:job.name,status:job.status,fresh:queueFresh}:null, events, tasks, interval: active || (pc?.rmQueue?.jobs || []).some(j => ["queued","paused","rendering","delivering"].includes(j.status)) ? 3000 : 15000 };
  }
  function queueProgress(job){
    if(typeof window.rmProgress==='function')return percent(window.rmProgress(job));
    if(job.status==='delivering')return finite(job.delivery?.total)>0?percent(Number(job.delivery.files||0)/Number(job.delivery.total)*100):null;
    if(job.stage&&(/склей|кодир|сборк|провер|подготов|открыва|копир|исходник/i.test(job.stage)||!job.done&&!job.stage.startsWith('рендер')))return null;
    return percent(job.percent);
  }
  function createProcesses({now=Date.now}={}){
    const entries=new Map();
    function update(value){
      if(!value||typeof value.id!=='string'||!value.id||value.id.length>96)return false;
      const old=entries.get(value.id);
      if(value.active===false){if(value.token&&old?.token&&old.token!==value.token)return false;return entries.delete(value.id);}
      if(!['timer','pause','music','practice','think','success','error'].includes(value.kind))return false;
      const entry={id:value.id,token:String(value.token||''),kind:value.kind,label:String(value.label||'Flow').slice(0,160),progress:percent(value.progress),route:['sport','english','piano','saved','render','today'].includes(value.route)?value.route:'today',priority:Number(value.priority)||0,element:value.element||null,expires:Number.isFinite(value.ttl)&&value.ttl>0?now()+value.ttl:Infinity};
      const changed=!old||['token','kind','label','progress','route','priority'].some(key=>old[key]!==entry[key]);
      entries.set(value.id,entry);if(entries.size>16)entries.delete(entries.keys().next().value);
      return changed;
    }
    function all(){const at=now();for(const [id,item]of entries)if(item.expires<=at||item.element?.isConnected===false)entries.delete(id);return [...entries.values()].sort((a,b)=>b.priority-a.priority);}
    return {update,all,current:()=>all()[0]||null,clear:()=>entries.clear(),nextExpiry:()=>Math.min(Infinity,...all().map(item=>item.expires))};
  }
  function createPresentation({changed=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,hidden=()=>false}={}){
    let key='',timer=null,orb=true;
    const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;};
    const set=value=>{orb=value;changed(orb);};
    function peek(delay=1800){cancel();if(hidden()){set(true);return;}set(false);timer=setTimer(()=>{timer=null;set(true);},delay);}
    return{update(next,{quiet=false,open=false,active=true}={}){const different=key!==next;key=next;if(!active||hidden()){cancel();set(true);}else if(open){cancel();set(false);}else if(different&&!quiet)peek();else changed(orb);},peek,collapse(){cancel();set(true);},suspend(){cancel();set(true);},getState:()=>({key,orb,pending:timer!==null})};
  }
  function createStateSource(fetchState, { now = Date.now, hidden = () => document.hidden, publish = () => {} } = {}) {
    let snapshot = null, at = 0, pending = null, generation = 0;
    return {
      snapshot: () => snapshot,
      invalidate: () => { generation++; at = -Infinity; },
      read() {
        if (hidden()) return snapshot ? Promise.resolve(snapshot) : Promise.reject(new Error("hidden"));
        if (pending) return pending;
        const ttl = snapshot?.render?.rendering || snapshot?.rmQueue?.jobs?.some(j => ["queued","paused","rendering","delivering"].includes(j.status)) ? 3000 : 15000;
        if (snapshot && now() - at < ttl) return Promise.resolve(snapshot);
        const requestedGeneration = generation;
        pending = Promise.resolve().then(fetchState).then(value => {
          if (!value || value.error) throw new Error(value?.error || "PC state unavailable");
          snapshot = value; at = requestedGeneration === generation ? now() : -Infinity;
          if (requestedGeneration === generation) publish(value);
          return value;
        }).finally(() => { pending = null; });
        return pending;
      },
    };
  }
  function createPoller({ read, paint, hidden, setTimer = setTimeout, clearTimer = clearTimeout }) {
    let timer = null, pending = false, stopped = false;
    const cancel = () => { if (timer !== null) clearTimer(timer); timer = null; };
    async function tick() {
      cancel();
      if (stopped || hidden() || pending) return;
      pending = true;
      try { await read(); } catch (_) {}
      finally { pending = false; if (!stopped && !hidden()) timer = setTimer(tick, paint()); }
    }
    return { start: tick, visibility() { cancel(); if (!hidden()) void tick(); }, stop() { stopped = true; cancel(); } };
  }
  let controller = null;
  const processes=createProcesses();
  function mount(pill, options) {
    if (!controller) controller = createController(options);
    controller.attach(pill, options.section, options);
    return controller;
  }
  function createController(options) {
    const leavingLayers=new Set();
    let pill = null, section = "Flow", layer = null, shown = null, pc = null, unavailable = false, page = options.page(), lastPanelHTML="", feedback=null, feedbackTimer=0, captureId=null, lastVoicePaint=0,suspended=false,knownRender='';
    const magic=()=>document.documentElement?.dataset.flowDesign==='magic';
    const hidden=()=>document.hidden||suspended;
    const presentation=createPresentation({hidden,changed:orb=>{
      if(!pill?.isConnected||!magic())return;
      pill.dataset.islandOrb=String(orb);
      const bar=pill.closest('.dm-topbar');
      if(bar){
        bar.dataset.islandOrb=String(orb);
        if(!bar.querySelector('.island-canopy')){
          const canopy=document.createElement('span');canopy.className='island-canopy';canopy.setAttribute('aria-hidden','true');
          canopy.innerHTML='<svg viewBox="0 0 1000 72" preserveAspectRatio="none"><path class="island-canopy-fill" d="M0 0H240C310 0 290 64 400 64H600C710 64 690 0 760 0H1000V-8H0Z"/><path class="island-canopy-rim" d="M0 0H240C310 0 290 64 400 64H600C710 64 690 0 760 0H1000"/></svg>';
          bar.prepend(canopy);
        }
        window.FlowIslandSurface?.sync(bar,pill);
      }
    }});
    const current = () => {
      const state=model({section,pc,data:options.data(),unavailable}),list=processes.all(),process=list[0];
      state.renderProgress=state.progress;
      state.processes=list;
      const identity=state.job?'job:'+state.job.id:state.render?'legacy:'+state.render.app+':'+state.render.title:'';
      if(state.render?.fresh)knownRender=identity;else if(!state.render||knownRender!==identity)knownRender='';
      if(process&&(process.priority>30||!['render','pause','disconnected'].includes(state.kind)||state.kind==='disconnected'&&!knownRender)){state.kind=process.kind;state.label=process.label;state.progress=process.progress;state.process=process;}
      const nearby=window.flowCardIsland?.getCurrent?.(),nearbyCount=window.flowCardIsland?.getState?.().count||0;
      if(nearby&&!layer&&(!process||process.priority<200)){state.cardBase={kind:state.kind,label:state.label,progress:state.progress,fresh:state.process?true:state.render?.fresh??true};state.kind='card';state.label=nearbyCount>1?nearbyCount+' карты':nearby.title;state.progress=null;state.card={...nearby,count:nearbyCount};state.process=null;}
      state.attention=state.kind!=='idle'&&(state.kind!=='disconnected'||knownRender);
      return state;
    };
    function close(restoreFocus = true,peek = true,immediate = false) {
      if(immediate)for(const leaving of leavingLayers){
        leaving.querySelector('.activity-island-card')?.getAnimations?.().forEach(animation=>animation.cancel());
        leaving.remove();leavingLayers.delete(leaving);
      }
      if (!layer) return;
      const leaving=layer;layer=null;shown=null;lastPanelHTML="";
      leaving.style.pointerEvents='none';leaving.inert=true;leaving.setAttribute('aria-hidden','true');
      const card=leaving.querySelector('.activity-island-card');
      if(!immediate&&magic()&&!hidden()&&!window.flowDigital?.reducedMotion?.()&&card?.animate){
        const current=getComputedStyle(card),from={opacity:current.opacity,translate:current.translate,scale:current.scale};
        card.getAnimations().filter(animation=>animation.id==='flow-island-open').forEach(animation=>animation.cancel());
        const exit=card.animate([from,{opacity:0,translate:'0 -8px',scale:'.98'}],{duration:220,easing:'cubic-bezier(.4,0,1,1)'});
        leavingLayers.add(leaving);
        exit.finished.catch(()=>{}).finally(()=>{leavingLayers.delete(leaving);leaving.remove();});
      }else leaving.remove();
      pill?.setAttribute("aria-expanded", "false");
      if(magic()){if(peek&&current().attention)presentation.peek(1200);else presentation.collapse();}
      if (restoreFocus) pill?.focus({ preventScroll: true });
      if(!hidden())paint({quiet:true});
    }
    const duration = value => value === null ? "" : `${Math.round(value / 60)} мин`;
    function panel(state) {
      const render = state.render;
      const controls=state.job?.fresh&&typeof window.rmAction==='function'?`<div class="island-render-controls">${state.job.status==='delivering'?'':`<button type="button" data-island-command="${state.job.status==='paused'?'rm-resume':'rm-pause'}">${state.job.status==='paused'?'Продолжить':'Пауза'}</button>`}<button type="button" data-island-command="rm-cancel">Остановить</button></div>`:'';
      const facts = render ? [render.fresh && render.frame !== null && render.frames !== null ? `${render.queue?'Готово':'Кадр'} ${render.frame} из ${render.frames}` : "", render.elapsed !== null ? `Идёт ${duration(render.elapsed)}` : "", render.eta !== null ? `Осталось ~${duration(render.eta)}` : ""].filter(Boolean).join(" · ") : "";
      return `<header><strong>Сейчас в Flow</strong><button type="button" data-island-close aria-label="Закрыть">×</button></header>${magic()?`<p class="island-now">${escape(state.label)}</p>`:''}${render ? `<section class="island-render"><small>${render.fresh ? escape(render.app) : "Связь с ПК потеряна"}</small><b>${escape(render.title)}</b>${state.renderProgress===null?"":`<span>${state.renderProgress}%</span>`}${facts ? `<p>${escape(facts)}</p>` : ""}</section>` : ""}${state.processes?.length?`<section><h3>Процессы</h3>${state.processes.map((item,i)=>`<button type="button" data-island-process="${i}"><b>${escape(item.label)}</b><small>${item.progress===null?'Открыть':item.progress+'% · открыть'}</small></button>`).join('')}</section>`:''}${state.events.length ? `<section><h3>Ближайшее</h3>${state.events.map((event, i) => `<button type="button" data-island-event="${i}"><b>${escape(event.title)}</b><small>${escape(event.due || "")} ${escape(event.allDay ? "Весь день" : event.time || "")}</small></button>`).join("")}</section>` : ""}${state.tasks.length ? `<section><h3>Важные дела</h3>${state.tasks.map((task, i) => `<button type="button" data-island-task="${i}"><b>${escape(task.title)}</b><small>${escape(task.due || "Без срока")}</small></button>`).join("")}</section>` : ""}${controls}${!render && !state.processes?.length && !state.events.length && !state.tasks.length ? "<p class=\"island-empty\">Сейчас всё спокойно.</p>" : ""}<button type="button" class="island-pins" data-island-pins>Закреплённое <span>→</span></button>`;
    }
    function paint({quiet=false}={}) {
      const state = current();
      if(feedback){state.kind=feedback.kind;state.label=feedback.label;state.progress=null;}
      if (pill?.isConnected) {
        let currentLabel=state.label;
        if(!magic()){
          const label=state.kind==='idle'&&section==='Flow'?'Flow рядом':state.label;if(pill.textContent!==label)pill.textContent=label;
        }else{
        const route=typeof ui==='undefined'?'':ui.page;
        const names={today:'План',tasks:'Дела',saved:'Сохранённое',finance:'Финансы',more:'Ещё',settings:'Настройки',piano:'Пианино',english:'Английский',sport:'Спорт',pc:'Компьютер',render:'Рендер',vpn:'VPN',server:'Сервер',projects:'Проекты',metrics:'Показатели',docs:'Документы',vault:'Пароли',archive:'Архив',inbox:'Входящие'};
        const category=route==='saved'&&ui.savedCategory!=='overview'?ui.savedCategory:'';
        const sectionName=category&&typeof SAVED_NAMES!=='undefined'?(SAVED_NAMES[category]||names[route]):names[route];
        const label=state.kind==='idle'&&sectionName?sectionName:state.label;
        currentLabel=label;
        let mark=pill.querySelector('.island-section-symbol');const shape=category&&typeof savedIcon==='function'?savedIcon(category):({today:'calendar',tasks:'check',saved:'bookmark',finance:'wallet',more:'overview',settings:'settings',piano:'piano',english:'study',sport:'weight',pc:'desktop',render:'film',vpn:'key',server:'server',projects:'project',metrics:'chart',docs:'file',vault:'key',archive:'archive',inbox:'inbox'}[route]||'spark');
        if(!mark){mark=document.createElement('span');mark.className='island-section-symbol';mark.setAttribute('aria-hidden','true');pill.prepend(mark);}
        const processShape={card:'loyalty',render:'film',pause:'pause',event:'calendar',timer:'clock',music:'music',practice:'piano',listen:'mic',think:'spark',speak:'music',success:'check',error:'bell',return:'spark'}[state.kind];
        const markKey=processShape?'process:'+state.kind:route+category+':section';
        if(mark.dataset.route!==markKey){mark.dataset.route=markKey;mark.innerHTML=processShape==='loyalty'?'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h8l10 10-7 7L3 10V4Z"/><circle cx="7" cy="8" r="1"/><path d="m11 12 5 5m-1-5h.01M12 17h.01"/></svg>':processShape==='spark'?'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1C13 9 15 11 23 12C15 13 13 15 12 23C11 15 9 13 1 12C9 11 11 9 12 1Z"/></svg>':processShape?(typeof icon==='function'?icon(processShape):''):!category&&typeof window.flowMagicObject==='function'?window.flowMagicObject(route):(typeof icon==='function'?icon(shape):'');}
        let text=pill.querySelector('.island-label');if(!text){text=document.createElement('span');text.className='island-label';pill.replaceChildren(text);}
        if(!mark.isConnected)pill.prepend(mark);
        if(text.textContent!==label)text.textContent=label;
        if(!pill.querySelector('.island-orb')){const orb=document.createElement('span');orb.className='island-orb';orb.setAttribute('aria-hidden','true');orb.innerHTML='<svg class="island-orb-progress" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" pathLength="100"/></svg>';pill.append(orb);}
        const context=[state.kind,state.card?.id||'',state.card?.count||'',state.process?.id||'',state.process?.token||'',!feedback&&!state.process&&!state.card?state.job?.id||'':'',!feedback&&!state.process&&!state.card?state.job?.status||'':'',feedback?.kind==='think'?captureId||'':'',state.kind==='event'?state.imminentId||'':''].join('|');
        presentation.update(context,{quiet,open:Boolean(layer)||Boolean(window.flowCardIsland?.getState?.().open),active:Boolean(feedback)||state.attention});
        }
        pill.setAttribute('aria-expanded',String(Boolean(layer)||Boolean(window.flowCardIsland?.getState?.().open)));
        if(pill.dataset.activity!==state.kind)pill.dataset.activity = state.kind;
        pill.dataset.progressKnown = String(state.progress !== null);
        const ring=pill.querySelector('.island-orb-progress');if(ring){ring.hidden=state.progress===null;ring.querySelector('circle')?.setAttribute('stroke-dasharray',`${state.progress??0} 100`);}
        pill.style.setProperty("--island-progress", `${state.progress ?? 0}%`);
        pill.setAttribute("aria-label", `${currentLabel}${state.kind==='pause'&&state.progress!==null?' · '+state.progress+'%':''} — текущая активность. Открыть подробности`);
        window.FlowIslandSurface?.sync(pill.closest('.dm-topbar'),pill);
      }
      if (layer) {
        shown = state;
        const card = layer.querySelector(".activity-island-card");
        const html = panel(state);
        if (lastPanelHTML !== html) {
          lastPanelHTML=html;
          const focus = document.activeElement;
          const selector = focus?.hasAttribute("data-island-command") ? `[data-island-command="${focus.dataset.islandCommand}"]` : focus?.getAttribute("data-island-event") !== null && focus?.hasAttribute("data-island-event") ? `[data-island-event="${focus.dataset.islandEvent}"]` : focus?.hasAttribute("data-island-task") ? `[data-island-task="${focus.dataset.islandTask}"]` : focus?.hasAttribute("data-island-pins") ? "[data-island-pins]" : "[data-island-close]";
          const inside = card.contains(focus), top = card.scrollTop;
          card.innerHTML = html; card.scrollTop = top;
          if (inside) card.querySelector(selector)?.focus({ preventScroll: true });
        }
      }
      if (typeof CustomEvent === "function") document.dispatchEvent(new CustomEvent("flow:activity", { detail: { kind:state.kind, progress:state.progress, label:state.label, fresh:feedback||state.process?true:state.render?.fresh??true, ...(state.kind==='card'?{baseActivity:state.cardBase}:{}) } }));
      return state.interval;
    }
    function pulse(kind,label,timeout=0,source=null){
      const different=feedback?.kind!==kind||feedback?.label!==label;
      clearTimeout(feedbackTimer);feedback={kind,label,source};paint();if(different&&magic()&&!layer)presentation.peek();
      if(pill?.isConnected&&!window.flowDigital?.reducedMotion?.()&&!document.hidden){
        pill.getAnimations?.().filter(a=>a.id==='flow-island-cue').forEach(a=>a.cancel());
        const a=pill.animate?.([{boxShadow:'0 0 0 transparent'},{boxShadow:'0 0 18px rgba(var(--accent-rgb),.3)',offset:.3},{boxShadow:'0 0 0 transparent'}],{duration:650,easing:'ease-out'});if(a)a.id='flow-island-cue';
      }
      if(timeout)feedbackTimer=setTimeout(()=>{feedback=null;paint({quiet:true});},timeout);
    }
    document.addEventListener('flow:assistantphase',event=>{
      const value=event.detail||{};if(value.open)close(false,false,true);if(value.open===false){pulse('return','Я рядом',1800);return;}
      if(value.open&&value.opened){pulse('return','Ассистент Flow',1800);return;}
      const phase={listening:['listen','Слушаю'],thinking:['think','Обрабатываю'],speaking:['speak','Отвечаю'],success:['success','Готово'],error:['error','Нужна проверка']}[value.state];
      if(phase)pulse(...phase,value.state==='success'?1800:0);else if(value.open&&value.state==='idle'){clearTimeout(feedbackTimer);feedback=null;paint({quiet:true});}
    });
    document.addEventListener('flow:voice',event=>{const value=event.detail||{};if(value.state==='listening'){
      // Actual microphone level only; at most ten light updates per second.
      const now=performance.now();if(now-lastVoicePaint<100)return;lastVoicePaint=now;
      pill?.style.setProperty('--island-level',String(Math.max(0,Math.min(1,Number(value.level)||0))));
    }else pill?.style.setProperty('--island-level','0');});
    document.addEventListener('flow:composecapture',event=>{const v=event.detail||{};
      if(v.phase==='submitting'){captureId=v.requestId;pulse('think','Передаю в Flow');}
      else if(v.requestId===captureId&&captureId!=null){if(v.phase==='result'){captureId=null;const empty=!String(v.reply||'').trim()&&!(Array.isArray(v.records)&&v.records.length);pulse(empty?'error':'success',empty?'Ответ не получен':'Готово',empty?3200:2200);}else if(v.phase==='error'){captureId=null;pulse('error','Не отправилось',3200);}else if(v.phase==='pending'){captureId=null;pulse('return','Ответ придёт в чат',2400);}}
      else if(v.phase==='closed'&&!v.retain){const pending=captureId!==null;captureId=null;if(pending&&feedback?.kind==='think'){clearTimeout(feedbackTimer);feedback=null;paint({quiet:true});}}
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden){close(false,false,true);clearTimeout(feedbackTimer);feedback=null;presentation.suspend();pill?.style.setProperty('--island-level','0');}});
    function toggle() {
      if (layer) { close(); return; }
      if(pill?.dataset.activity==='card'&&window.flowCardIsland?.getCurrent?.()){window.flowCardIsland.open(pill);return;}
      layer = document.createElement("div"); layer.className = "activity-island-layer";
      layer.innerHTML = '<section class="activity-island-card" role="region" aria-label="Текущая активность" tabindex="-1"></section>';
      document.body.appendChild(layer);
      pill?.setAttribute("aria-expanded", "true");
      paint();position();
      const card=layer.querySelector('.activity-island-card');
      if(magic()&&!hidden()&&!window.flowDigital?.reducedMotion?.()){
        const entrance=card.animate?.([{opacity:0,translate:'0 -12px',scale:'.97'},{opacity:1,translate:'0 0',scale:'1'}],{duration:520,easing:'cubic-bezier(.22,1,.36,1)'});
        if(entrance)entrance.id='flow-island-open';
      }
      card.focus({ preventScroll: true });
      layer.addEventListener("click", event => {
        const target = event.target.closest("button, .activity-island-scrim");
        if (!target) return;
        if (target.matches("[data-island-close], .activity-island-scrim")) { close(); return; }
        if(target.hasAttribute('data-island-command')){const job=shown.job;if(job?.fresh&&typeof window.rmAction==='function')window.rmAction(target.dataset.islandCommand,{dataset:{id:String(job.id),name:job.name||'Рендер'}});return;}
        if (target.hasAttribute("data-island-pins")) { close(false); options.pinned(); return; }
        if(target.hasAttribute('data-island-process')){const process=shown.processes?.[Number(target.dataset.islandProcess)];if(process&&typeof navigate==='function'){close(false);navigate(process.route);if(typeof ui!=='undefined'&&ui.page==='sport'&&process.route==='sport')window.sorokaOpenSport?.();}return;}
        const state = shown;
        const task = target.hasAttribute("data-island-task");
        const index = Number(task ? target.dataset.islandTask : target.dataset.islandEvent);
        const record = (task ? state.tasks : state.events)[index];
        if (record) { close(false); options.open(task ? "task" : "event", record.id); }
      });
    }
    document.addEventListener("keydown", event => {
      if (!layer) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close(); }

    }, true);
    function position(){if(!layer||!pill?.getBoundingClientRect)return;const r=pill.getBoundingClientRect(),width=Math.min(360,innerWidth-24),top=magic()?r.bottom+6:r.top;layer.style.setProperty('--island-left',`${Math.max(12,Math.min(innerWidth-width-12,r.left+r.width/2-width/2))}px`);layer.style.setProperty('--island-top',`${top}px`);layer.style.setProperty('--island-width',`${width}px`);layer.style.setProperty('--island-available-height',`${Math.max(80,(window.visualViewport?.height||innerHeight)-top-12)}px`);}
    document.addEventListener('pointerdown',event=>{if(layer&&!layer.contains(event.target)&&!pill?.contains(event.target))close(false);},true);
    window.addEventListener?.('resize',position);window.addEventListener?.('scroll',position,{passive:true});
    window.addEventListener?.('flow:windowgeometry',position);
    window.visualViewport?.addEventListener('resize',position);
    const poller = createPoller({ hidden, paint, read: async () => {
      if (typeof window.sorokaPc !== "function") return;
      try {
        const prior=current().job;pc = await window.sorokaPc({ op: "state" }); unavailable = false;
        const next=current(),finished=prior&&(pc?.rmQueue?.jobs||[]).find(job=>String(job.id)===String(prior.id));
        if(feedback?.source==='render'&&next.job){clearTimeout(feedbackTimer);feedback=null;}
        if(prior?.fresh&&next.queueFresh&&finished&&(!feedback||feedback.source==='render')){
          if(finished.status==='failed'||finished.status==='done'&&[finished.delivery?.status,finished.delivery?.phase].includes('failed'))pulse('error','Рендер требует проверки',0,'render');
          else if(finished.status==='done')pulse('success','Рендер готов',1800,'render');
        }
      }
      catch (_) { unavailable = true; }
    } });
    document.addEventListener("visibilitychange", () => poller.visibility());
    window.addEventListener?.('flow:suspend',()=>{close(false,false,true);suspended=true;presentation.suspend();poller.visibility();});
    window.addEventListener?.('flow:resume',()=>{suspended=false;poller.visibility();});
    window.addEventListener?.('pagehide',()=>presentation.suspend());
    void poller.start();
    document.addEventListener('flow:cardislandchange',()=>{if(!hidden())paint();});
    return { attach(next, title, nextOptions) {
      if(nextOptions)options=nextOptions;
      const changed=page!==options.page();if(changed){close(false,false);page=options.page();}
      pill = next; section = title || "Flow";
      pill.classList.add("activity-island"); pill.setAttribute("aria-haspopup", "false"); pill.setAttribute("aria-expanded", String(Boolean(layer)));
      if (!pill.dataset.islandBound) { pill.dataset.islandBound = "true"; pill.addEventListener("click", toggle); }
      position();paint();
    }, close,refresh:(quiet=false)=>paint({quiet}),getState:()=>({...presentation.getState(),activity:current().kind,panelOpen:Boolean(layer)}) };
  }
  function processSignal(name,value={}){
    const token=String(value.token||'').slice(0,96),active=value.active!==false;
    if(name==='sport'){
      if(!active)return{id:'sport',token,active:false};
      const remaining=finite(value.remaining),total=finite(value.total);
      if(remaining===null||remaining<0||total===null||total<=0||typeof value.running!=='boolean')return null;
      const seconds=Math.ceil(remaining),paused=value.running===false;
      return{id:'sport',token,kind:paused?'pause':'timer',route:'sport',label:paused?'Таймер · пауза':`${String(value.stage||'Таймер').slice(0,45)} · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`,progress:percent((total-remaining)/total*100),priority:80,ttl:3500};
    }
    if(name==='music'){
      if(!active||['ended','closed'].includes(value.state))return{id:'english-music',token,active:false};
      if(!['play','pause','error'].includes(value.state))return null;
      const error=value.state==='error',paused=value.state==='pause';
      return{id:'english-music',token,kind:error?'error':paused?'pause':'music',label:error?'Не удалось включить музыку':paused?'Музыка · пауза':`Музыка · ${String(value.title||'воспроизведение').slice(0,100)}`,progress:null,route:'english',priority:error?200:10,ttl:error?4500:0};
    }
    if(name==='import'){
      if(!active||value.state==='cancelled')return{id:'music-import',token,active:false};
      if(!['working','success','error'].includes(value.state))return null;
      const terminal=['success','error'].includes(value.state);
      return{id:'music-import',token,kind:terminal?value.state:'think',label:String(value.label||'Импорт музыки').slice(0,120),progress:terminal?null:percent(value.progress),route:'english',priority:terminal?200:100,ttl:terminal?4000:0};
    }
    return null;
  }
  function connectProcesses(){
    let expiry=0,serial=0,suspended=false;const mediaIds=new WeakMap();
    function schedule(){clearTimeout(expiry);expiry=0;if(document.hidden||suspended)return;const at=processes.nextExpiry();if(Number.isFinite(at))expiry=setTimeout(()=>{expiry=0;processes.all();controller?.refresh(true);schedule();},Math.max(1,at-Date.now()+1));}
    function update(value){if(!value)return;const changed=processes.update(value);schedule();if(changed&&!document.hidden&&!suspended)controller?.refresh();}
    for(const [name,event]of [['sport','flow:sport-clock'],['music','flow:media'],['import','flow:import']])document.addEventListener(event,e=>update(processSignal(name,e.detail)));
    document.addEventListener('flow:audiofocus',event=>{if(event.detail?.owner==='piano-practice')update({id:'piano-practice',kind:'practice',label:'Практика пианино',route:'piano',priority:5,active:event.detail.active===true});});
    for(const event of ['play','pause','ended','emptied','error'])document.addEventListener(event,e=>{
      const media=e.target;if(typeof HTMLMediaElement==='undefined'||!(media instanceof HTMLMediaElement)||media.id==='enm-audio')return;
      if(!mediaIds.has(media)){if(!['play','error'].includes(event))return;mediaIds.set(media,'media-'+(++serial));}const id=mediaIds.get(media),error=event==='error';
      update({id,kind:error?'error':event==='pause'?'pause':'music',label:error?'Медиа не загрузилось':event==='pause'?'Воспроизведение · пауза':media.tagName==='VIDEO'?'Воспроизводится видео':'Воспроизводится аудио',route:typeof ui!=='undefined'&&ui.page==='piano'?'piano':'english',element:media,active:!['ended','emptied'].includes(event),priority:error?200:10,ttl:error?4500:0});
    },true);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(expiry);expiry=0;}else{processes.all();controller?.refresh(true);schedule();}});
    window.addEventListener?.('flow:suspend',()=>{suspended=true;clearTimeout(expiry);expiry=0;});
    window.addEventListener?.('flow:resume',()=>{suspended=false;processes.all();controller?.refresh(true);schedule();});
    window.addEventListener?.('pagehide',()=>{clearTimeout(expiry);processes.clear();});
  }
  window.FlowActivity = { model, eventStart, percent, createPresentation,createProcesses,processSignal,createStateSource, createPoller, mount };
  if(typeof document!=='undefined'&&document.addEventListener)connectProcesses();
})();
