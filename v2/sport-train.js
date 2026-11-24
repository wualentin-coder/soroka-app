/*
 * «Спорт» — тренировка: карточка с упражнениями, машина подходов и таймеров,
 * полноэкранный режим и полоса таймера над нижним меню.
 *
 * Машина — перенос useWorkoutPhases из WooSport один к одному: prep (занять
 * позу) → hold (удержание) → rest (отдых между подходами) → between (перерыв
 * перед следующим упражнением). Одна на приложение и не привязана к экрану:
 * уходя на «Сегодня» или в другой раздел Flow, отсчёт идёт дальше, а полоса
 * висит над меню. Открытие упражнения показывает технику; подход подтверждается в режиме тренировки. Идущий
 * таймер переживает перезапуск приложения (timerStorage — только этот телефон).
 */

const spTimer = { session: null, phase: null, clock: null, lastTap: null, dismissed: false, runner: false, ticked: null, videoOpen: false, nativeToken: null };

/** Тренировка на экране регистрирует себя как текущую — если таймер не занят другой. */
function spTimerRegister(option, readOnly, finished) {
  if (window.flowSportRuntime?.register(option, readOnly, finished)) return;
  const C = SP();
  if (spTimer.phase && spTimer.session?.key !== option.key) return;
  if (spTimer.session?.key !== option.key) {
    spTimer.dismissed = false;
    spTimer.session = { key: option.key, option, readOnly, finished };
    // Восстановить таймер, если приложение перезапускали посреди подхода.
    if (!readOnly && !finished) {
      const native = window.sorokaSportTimer?.read();
      const saved = native?.key === option.key && native.phase ? native : C.loadTimer(option.key);
      if (native?.key === option.key) spTimer.nativeToken = native.token;
      if (saved && option.plan.exercises[saved.phase.index]) {
        spTimer.phase = saved.phase;
        spTimer.clock = C.Countdown.restore(saved.clock);
      } else if (saved) C.clearTimer();
    }
  } else spTimer.session = { key: option.key, option, readOnly, finished };
  if (finished && spTimer.phase) spSetPhase(null);
}
function spTimerGuard() {
  if (!spTimer.phase) return false;
  toast("Сначала остановите таймер упражнения");
  return true;
}
const spChecks = () => spTimer.session ? SP().optionChecks(spTimer.session.option, spState().state) : [];
function spSetPhase(next, existing) {
  const C = SP();
  spTimer.phase = next;
  spTimer.ticked = null;
  if (!next) { spClockActivity(false); window.sorokaSportTimer?.stop(); spTimer.nativeToken = null; spTimer.clock = null; C.clearTimer(); spOverlay(true); return; }
  spTimer.clock = existing || new C.Countdown(spSecondsFor(next));
  spTimer.nativeToken = crypto.randomUUID();
  if (!next.guided || !window.flowSportRuntime) C.saveTimer({ workout: spTimer.session.key, phase: next, clock: spTimer.clock.snapshot() });
  spPublishTimer();
  spOverlay(true);
}
function spNoteClock() {
  if (spTimer.phase && spTimer.clock) { if(!spTimer.phase.guided || !window.flowSportRuntime)SP().saveTimer({ workout: spTimer.session.key, phase: spTimer.phase, clock: spTimer.clock.snapshot() }); spPublishTimer(); }
}
function spNextUnfinished(after) {
  const C = SP(), plan = spTimer.session?.option.plan, checks = spChecks();
  if (!plan) return -1;
  for (let i = after + 1; i < plan.exercises.length; i++) {
    const sets = C.exerciseSets(plan.exercises[i]);
    if (C.completedSets(checks[i], sets) < sets) return i;
  }
  return -1;
}
const spIsHold = index => SP().holdSecondsFor(spTimer.session.option.plan.exercises[index]) > 0;
function spSecondsFor(phase) {
  const C = SP(), plan = spTimer.session.option.plan, exercise = plan.exercises[phase.index];
  if (phase.kind === "prep") return C.PREP_SECONDS;
  if (phase.kind === "hold") return C.holdSecondsFor(exercise);
  if (phase.kind === "between") { const next = spNextUnfinished(phase.index); return C.restBetweenExercisesFor(plan.exercises[next] || exercise, plan.routine_type); }
  return C.restSecondsFor(exercise, plan.routine_type);
}
function spCompleteSet(index, total, target) {
  const C = SP(), option = spTimer.session.option;
  spUpdate(prev => C.confirmWorkoutSet(prev, option, index, Math.max(C.completedSets(C.optionChecks(option, prev)[index], total), target))).catch(() => {});
}
function spCommitSet(index, total, before) {
  const C = SP(), plan = spTimer.session.option.plan;
  spCompleteSet(index, total, before + 1);
  if (before + 1 < total) {
    const seconds = C.restSecondsFor(plan.exercises[index], plan.routine_type);
    if (seconds > 0) return spSetPhase({ index, kind: "rest", setNumber: before + 1 });
    return spSetPhase(spIsHold(index) ? { index, kind: "prep", setNumber: before + 2 } : null);
  }
  const next = spNextUnfinished(index);
  const between = next === -1 ? 0 : C.restBetweenExercisesFor(plan.exercises[next], plan.routine_type);
  spSetPhase(between > 0 ? { index, kind: "between", setNumber: before + 1 } : null);
}
function spStartSet(index, total) {
  const C = SP(), session = spTimer.session;
  if (!session || session.readOnly || session.finished || spTimer.phase) return;
  C.unlockAudio();
  const current = C.completedSets(spChecks()[index], total);
  if (current >= total) return;
  const option = session.option;
  spUpdate(prev => C.startOption(prev, option)).catch(() => {});
  if (spIsHold(index)) return spSetPhase({ index, kind: "prep", setNumber: current + 1 });
  spCommitSet(index, total, current);
}
function spTap(index, total) {
  const now = Date.now();
  if (spTimer.lastTap?.index === index && now - spTimer.lastTap.at < 500) return;
  spTimer.lastTap = { index, at: now }; spTimer.dismissed = false;
  spStartSet(index, total);
}
function spPhaseDone(expected) {
  const C = SP(), running = spTimer.phase, session = spTimer.session;
  if (!running || running !== expected || !session || session.finished || session.readOnly) return;
  const plan = session.option.plan;
  if (running.kind === "rest" || running.kind === "between") {
    // Удержание после отдыха стартует само; повторения — нажатием (нажатие и есть отчёт).
    const nextIndex = running.kind === "rest" ? running.index : spNextUnfinished(running.index);
    if (nextIndex >= 0 && spIsHold(nextIndex)) {
      const total = C.exerciseSets(plan.exercises[nextIndex]);
      const done = C.completedSets(spChecks()[nextIndex], total);
      if (done < total) return spSetPhase({ index: nextIndex, kind: "prep", setNumber: done + 1 });
    }
    return spSetPhase(null);
  }
  if (running.kind === "prep") return spSetPhase({ index: running.index, kind: "hold", setNumber: running.setNumber });
  spCommitSet(running.index, C.exerciseSets(plan.exercises[running.index]), running.setNumber - 1);
}
function spShownIndex(phase, active) {
  if (!phase) return active;
  if (phase.kind !== "between") return phase.index;
  const next = spNextUnfinished(phase.index);
  return next >= 0 ? next : phase.index;
}
function spActiveIndex() {
  const C = SP(), plan = spTimer.session?.option.plan, checks = spChecks();
  return plan ? plan.exercises.findIndex((e, i) => C.completedSets(checks[i], C.exerciseSets(e)) < C.exerciseSets(e)) : -1;
}
const SP_PHASE_LABEL = { prep: "Готовься", hold: "Держи", rest: "Отдых", between: "Перерыв" };
const SP_SKIP_LABEL = { prep: "Начать сейчас", hold: "Засчитать сейчас", rest: "Пропустить отдых", between: "Пропустить перерыв" };
function spPhaseStatus(phase) {
  if (phase.kind === "prep") return `Подход ${phase.setNumber} · занимай позу`;
  if (phase.kind === "hold") return `Подход ${phase.setNumber} · держи позу`;
  if (phase.kind === "between") return "Упражнение закрыто · перерыв перед следующим";
  return `Подход ${phase.setNumber} отмечен · отдых запущен`;
}

// Счёт времени — по дедлайну, а не тиками: фоновая вкладка ничего не теряет.
setInterval(() => {
  spPollNativeTimer();
  const C = SP();
  if (!C || !spTimer.phase || !spTimer.clock) return;
  const expected = spTimer.phase, clock = spTimer.clock;
  const left = clock.remaining();
  if (clock.running && left > 0 && left <= 3 && spTimer.ticked !== left) { spTimer.ticked = left; C.playTick(); }
  if (clock.expire()) { C.phaseSound(expected.kind)(); spPhaseDone(expected); }
  spTimerPaint();
}, 200);

/** Цифры и кольцо таймера — без перерисовки страницы. */
function spTimerPaint() {
  if (!spTimer.clock) return;
  spClockActivity();
  const remaining = spTimer.clock.remaining();
  const text = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  for (const el of document.querySelectorAll("[data-sp-time]")) el.textContent = text;
  const total = Math.max(spSecondsTotal(), remaining, 1);
  const arc = document.querySelector("[data-sp-arc]");
  if (arc) arc.style.strokeDashoffset = String(2 * Math.PI * 52 * (1 - Math.max(0, Math.min(1, remaining / total))));
  for (const el of document.querySelectorAll("[data-sp-pause]")) el.innerHTML = spTimer.clock.running ? SP_ICON.pause : SP_ICON.resume;
  for (const el of document.querySelectorAll("[data-sp-pause-label]")) el.textContent = spTimer.clock.running ? "Пауза" : "Дальше";
}
function spSecondsTotal() {
  if (!spTimer.phase) return 1;
  spTimer.totals ||= new WeakMap();
  if (!spTimer.totals.has(spTimer.phase)) spTimer.totals.set(spTimer.phase, Math.max(spTimer.clock.remaining(), 1));
  return spTimer.totals.get(spTimer.phase);
}

// ------------------------------------------------------------ полоса и полноэкранный режим

let spOverlaySig = "";
/** Полоса над нижним меню (на любом экране Flow) или полноэкранный режим. */
function spOverlay(force = false) {
  const C = SP();
  let host = document.getElementById("sp-overlay");
  if (!host) { host = document.createElement("div"); host.id = "sp-overlay"; document.body.appendChild(host); }
  const session = spTimer.session;
  if (!C || !session || !spState().state) { if (host.innerHTML) host.innerHTML = ""; document.body.classList.remove("sp-has-bar", "sp-runner-open"); return; }
  const checks = spChecks();
  const active = spActiveIndex();
  const live = Boolean(spTimer.clock) || Boolean(spTimer.phase) || Boolean(window.flowSportAuto?.view()?.active);
  const inProgress = !session.finished && !session.readOnly && !spTimer.dismissed && live;
  const mode = spTimer.runner ? "runner" : inProgress ? "bar" : "";
  const sig = JSON.stringify([mode, spTimer.phase, checks, spTimer.videoOpen, ui.page, session.key, session.finished]);
  if (!force && sig === spOverlaySig) return;
  spOverlaySig = sig;
  document.body.classList.toggle("sp-has-bar", mode === "bar");
  document.body.classList.toggle("sp-runner-open", mode === "runner");
  host.innerHTML = mode === "runner" ? spRunnerHtml() : mode === "bar" ? spBarHtml(active) : "";
  spTimerPaint();
  if (mode) spFiguresNeeded();
}
setInterval(() => spOverlay(), 300);

function spBarHtml(active) {
  const C = SP(), plan = spTimer.session.option.plan, checks = spChecks(), phase = spTimer.phase;
  const index = phase ? spShownIndex(phase, active) : active;
  const exercise = plan.exercises[index];
  const total = exercise ? C.exerciseSets(exercise) : 0;
  const done = exercise ? C.completedSets(checks[index], total) : 0;
  const anyProgress = plan.exercises.some((e, i) => C.completedSets(checks[i], C.exerciseSets(e)) > 0);
  const controls = phase
    ? `<span class="sp-bar-actions"><button type="button" data-action="sp-pause" data-sp-pause aria-label="Пауза">${SP_ICON.pause}</button><button type="button" data-action="sp-skip" aria-label="Пропустить">${SP_ICON.skip}</button></span>`
    : exercise ? `<button type="button" class="sp-bar-mark" data-action="sp-runner" aria-label="Открыть тренировку">${SP_ICON.play}</button>` : "";
  return `<div class="sp-bar ${phase && (phase.kind === "hold" || phase.kind === "prep") ? "work" : ""}"><button type="button" class="sp-bar-open" data-action="sp-runner" aria-label="Открыть таймер">${phase ? `<span class="sp-bar-clock"><small>${SP_PHASE_LABEL[phase.kind]}</small><b data-sp-time>--:--</b></span>` : ""}<span class="sp-bar-name">${spEsc(exercise?.name || plan.title)}</span></button>${controls}<button type="button" class="sp-bar-close" data-action="sp-dismiss" aria-label="Прекратить тренировку">${icon("close", "icon-sm")}</button></div>`;
}

function spRunnerHtml() {
  const C = SP(), session = spTimer.session, plan = session.option.plan, checks = spChecks(), phase = spTimer.phase;
  const active = spActiveIndex();
  const doneCount = plan.exercises.filter((e, i) => C.completedSets(checks[i], C.exerciseSets(e)) >= C.exerciseSets(e)).length;
  const shown = spShownIndex(phase, active);
  const exercise = plan.exercises[shown];
  const allDone = active === -1 || !exercise;
  const head = `<header class="sp-runner-head"><div><small>${spEsc(plan.title)}</small><b>${allDone ? `${doneCount} из ${plan.exercises.length} закрыто` : `Упражнение ${shown + 1} из ${plan.exercises.length}`}</b><span class="sp-progress"><i style="width:${Math.round(doneCount / Math.max(1, plan.exercises.length) * 100)}%"></i></span></div><button class="icon-button" type="button" data-action="sp-runner-close" aria-label="Выйти из режима тренировки">${icon("close")}</button></header>`;
  if (allDone) {
    return `<div class="sp-runner" role="dialog" aria-modal="true">${head}<div class="sp-runner-body sp-runner-done"><div class="sp-done-mark">${icon("check")}</div><h2>Все упражнения закрыты</h2><p class="section-note">Можно завершать — подходы уже сохранены.</p><button class="primary-button sp-wide" type="button" data-action="sp-finish" data-close="1">Завершить тренировку</button><button class="ghost-button sp-wide" type="button" data-action="sp-runner-close">Выйти без завершения</button></div></div>`;
  }
  const total = C.exerciseSets(exercise), done = C.completedSets(checks[shown], total);
  const anyProgress = plan.exercises.some((e, i) => C.completedSets(checks[i], C.exerciseSets(e)) > 0);
  const video = C.exerciseVideoId(exercise);
  const tagged = C.knownMuscles(exercise.muscles?.primary).length || C.knownMuscles(exercise.muscles?.secondary).length;
  const upNext = phase?.kind === "rest" ? `Подход ${phase.setNumber + 1} из ${total}` : "";
  const R = 52, L = 2 * Math.PI * R;
  const zone = phase
    ? `<p class="sp-runner-status">${spPhaseStatus(phase)}</p><div class="sp-timer ${phase.kind === "hold" || phase.kind === "prep" ? "work" : ""}"><div class="sp-dial"><svg viewBox="0 0 120 120"><circle class="sp-dial-track" cx="60" cy="60" r="${R}"/><circle class="sp-dial-arc" data-sp-arc cx="60" cy="60" r="${R}" stroke-dasharray="${L}"/></svg><div class="sp-dial-clock"><small>${SP_PHASE_LABEL[phase.kind]}</small><b data-sp-time>--:--</b></div></div>
        <div class="sp-timer-controls"><button type="button" data-action="sp-adjust" data-d="-15">−15</button><button type="button" data-action="sp-pause"><span data-sp-pause-label>Пауза</span></button><button type="button" data-action="sp-adjust" data-d="15">+15</button></div>
        <div class="sp-timer-controls"><button type="button" class="wide" data-action="sp-skip">${SP_SKIP_LABEL[phase.kind]}</button>${phase.kind === "hold" || phase.kind === "prep" ? `<button type="button" data-action="sp-cancel-set">Отменить подход</button>` : ""}</div></div>${upNext ? `<p class="sp-runner-next"><span>Далее</span><b>${upNext}</b></p>` : ""}`
    : `<button class="primary-button sp-runner-go" type="button" data-action="sp-tap" data-i="${shown}">${C.holdSecondsFor(exercise) > 0 ? "Начать удержание" : "Выполнил подход"} · ${Math.min(done + 1, total)}/${total}</button>`;
  return `<div class="sp-runner" role="dialog" aria-modal="true">${head}<div class="sp-runner-body"><h2>${spEsc(exercise.name)}</h2><p class="sp-runner-scheme">${spEsc(exercise.sets_reps)}</p>${exercise.technique ? `<p class="sp-runner-tech">${spEsc(exercise.technique)}</p>` : ""}
      <div class="sp-runner-meta"><span>Подходы ${done}/${total}</span>${spLoadControl(session.option, shown)}</div><div class="sp-sets">${Array.from({ length: total }, (_, i) => `<i class="${i < done ? "on" : ""}"></i>`).join("")}</div>
      <section class="sp-card">${video ? spVideoHtml(video, exercise) : `<button class="text-action" type="button" data-action="sp-external" data-url="${spEsc(C.videoSearchUrl(exercise))}">Найти видео на YouTube →</button>`}</section>
      ${tagged ? `<section class="sp-card"><p class="sp-kicker">Мышцы</p>${spMuscleMap(exercise.muscles)}</section>` : ""}</div>
    <div class="sp-runner-zone">${zone}<div class="sp-runner-session"><button type="button" data-action="sp-finish" data-close="1">Завершить · ${doneCount}/${plan.exercises.length}</button><button type="button" data-action="sp-dismiss">Прекратить</button></div></div></div>`;
}

// ------------------------------------------------------------ видео техники

function spVideoHtml(videoId, exercise) {
  const C = SP();
  const playing = spTimer.videoOpen === videoId;
  return `<div class="sp-video" data-sp-video>${playing
    ? `<iframe title="Техника: ${spEsc(exercise.name)}" src="${C.youtubeEmbedUrl(videoId)}&autoplay=1" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
    : `<button type="button" class="sp-video-poster" data-action="sp-video-play" data-id="${spEsc(videoId)}" aria-label="Смотреть технику"><img src="${C.youtubeThumbnailUrl(videoId)}" alt="" onload="if(this.naturalWidth<=120)this.closest('[data-sp-video]').classList.add('missing')" onerror="this.closest('[data-sp-video]').classList.add('missing')"><span>${SP_ICON.play}</span><small>Смотреть технику</small></button>`}
    <p class="sp-video-missing">Видео недоступно — ссылка больше не открывается.</p>
    <div class="sp-video-actions">${playing ? `<button class="text-action" type="button" data-action="sp-video-full">На весь экран</button>` : ""}<button class="text-action" type="button" data-action="sp-external" data-url="${spEsc(C.videoSearchUrl(exercise))}">Больше видео ↗</button>${playing ? `<button class="text-action" type="button" data-action="sp-external" data-url="https://www.youtube.com/watch?v=${spEsc(videoId)}">Открыть в YouTube ↗</button>` : ""}</div></div>`;
}
function spExternal(url) {
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) tg.openLink(url); else window.open(url, "_blank", "noopener,noreferrer");
}

// ------------------------------------------------------------ карта мышц (рисунок WooSport, лениво)

let spFiguresLoading = false;
function spFiguresNeeded() {
  if (window.SportFigures || spFiguresLoading) return;
  spFiguresLoading = true;
  const script = document.createElement("script");
  script.src = "./assets/sport-figures.js";
  script.onload = () => { spOverlay(true); spRerender(true); };
  script.onerror = () => { spFiguresLoading = false; };
  document.head.appendChild(script);
}
const SP_SHAPE_FOR = { neck: ["TRAPS"], traps: ["TRAPS"], delts_front: ["SHOULDERS"], delts_side: ["SHOULDERS"], delts_rear: ["SHOULDERS"], chest: ["CHEST_UPPER", "CHEST_MID", "CHEST_LOWER"], chest_upper: ["CHEST_UPPER"], chest_mid: ["CHEST_MID"], chest_lower: ["CHEST_LOWER"], lats: ["BACK"], mid_back: ["BACK"], lower_back: ["BACK"], biceps: ["BICEPS"], triceps: ["TRICEPS"], forearms: ["FOREARMS"], abs: ["ABS_UPPER", "ABS_LOWER"], abs_upper: ["ABS_UPPER"], abs_lower: ["ABS_LOWER"], obliques: ["OBLIQUES"], glutes: ["GLUTES"], quads: ["QUADRICEPS"], hamstrings: ["HAMSTRINGS"], adductors: ["QUADRICEPS"], hip_flexors: ["QUADRICEPS"], calves: ["CALVES"] };
const SP_MUSCLES_FOR_SHAPE = { ABS_UPPER: ["abs_upper"], ABS_LOWER: ["abs_lower"], BACK: ["lats", "mid_back", "lower_back"], BICEPS: ["biceps"], CALVES: ["calves"], CHEST_UPPER: ["chest_upper"], CHEST_MID: ["chest_mid"], CHEST_LOWER: ["chest_lower"], FOREARMS: ["forearms"], GLUTES: ["glutes"], HAMSTRINGS: ["hamstrings"], OBLIQUES: ["obliques"], QUADRICEPS: ["quads", "adductors", "hip_flexors"], SHOULDERS: ["delts_front", "delts_side", "delts_rear"], TRAPS: ["neck", "traps"], TRICEPS: ["triceps"] };
function spFigureSvg(primary, secondary, viewBox, interactive) {
  const F = window.SportFigures;
  const names = Object.keys(F.MUSCLE_SHAPES);
  const skin = F.SILHOUETTE.map(part => `<path class="sp-skin is-${part.tone}" d="${part.d}"/>`).join("");
  // Сначала нерабочие, потом помогающие, сверху — рабочие: соседние мышцы на рисунке перекрываются.
  const layer = st => names.filter(n => st === "primary" ? primary.has(n) : st === "secondary" ? secondary.has(n) && !primary.has(n) : !primary.has(n) && !secondary.has(n))
    .map(n => F.MUSCLE_SHAPES[n].paths.map((d, i) => `<path class="sp-zone is-${st}" d="${d}"${interactive && i === 0 ? ` data-action="sp-muscle-shape" data-shape="${n}"` : interactive ? ` data-action="sp-muscle-shape" data-shape="${n}"` : ""}/>`).join("")).join("");
  return `<svg class="sp-figure ${interactive ? "interactive" : ""}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${skin}${layer("idle")}${layer("secondary")}${layer("primary")}</svg>`;
}
function spShapes(ids) { return new Set(ids.flatMap(id => SP_SHAPE_FOR[id] || [])); }
function spMuscleMap(muscles) {
  const C = SP();
  if (!window.SportFigures) { spFiguresNeeded(); return `<p class="section-note">Загрузка карты…</p>`; }
  const primary = C.knownMuscles(muscles?.primary), secondary = C.knownMuscles(muscles?.secondary).filter(id => !primary.includes(id));
  return `<div class="sp-map">${spFigureSvg(spShapes(primary), spShapes(secondary), window.SportFigures.FIGURE_VIEWBOX, false)}<ul class="sp-legend-list">${primary.map(id => `<li class="primary"><i></i>${spEsc(C.muscleLabel(id))}</li>`).join("")}${secondary.map(id => `<li class="secondary"><i></i>${spEsc(C.muscleLabel(id))}</li>`).join("")}</ul></div>`;
}
function spMuscleGlyph(muscles) {
  const C = SP();
  const primary = C.knownMuscles(muscles?.primary), secondary = C.knownMuscles(muscles?.secondary).filter(id => !primary.includes(id));
  if (!primary.length && !secondary.length) return "";
  if (!window.SportFigures) { spFiguresNeeded(); return ""; }
  const F = window.SportFigures;
  const P = spShapes(primary), S = spShapes(secondary);
  const focus = [...(P.size ? P : S)];
  const front = focus.filter(n => F.MUSCLE_SHAPES[n].front).length, back = focus.filter(n => F.MUSCLE_SHAPES[n].back).length;
  const side = back > front ? "back" : "front";
  const crop = s => {
    const boxes = focus.map(n => F.MUSCLE_SHAPES[n][s]).filter(Boolean);
    if (!boxes.length) return null;
    let [x1, y1, x2, y2] = boxes[0];
    for (const b of boxes.slice(1)) { x1 = Math.min(x1, b[0]); y1 = Math.min(y1, b[1]); x2 = Math.max(x2, b[2]); y2 = Math.max(y2, b[3]); }
    x1 -= 14; y1 -= 14; x2 += 14; y2 += 14;
    let w = Math.max(66, x2 - x1), h = Math.max(66, y2 - y1);
    if (w / h > 0.9) h = w / 0.9; else w = h * 0.9;
    const cx = Math.min(535 - w / 2, Math.max(w / 2, (x1 + x2) / 2)), cy = Math.min(462 - h / 2, Math.max(h / 2, (y1 + y2) / 2));
    return `${cx - w / 2} ${cy - h / 2} ${w} ${h}`;
  };
  const viewBox = crop(side) || crop(side === "front" ? "back" : "front");
  return viewBox ? `<span class="sp-glyph">${spFigureSvg(P, S, viewBox, false)}</span>` : "";
}

// ------------------------------------------------------------ экран «Тренировка»

// «Тренировка» — программа: где вы в ней, занятие выбранного дня целиком и что
// дальше по плану. Дата — из той же полосы недели, что на «Сегодня».
function sp2Duration(option) {
  const C = SP();
  const actual = C.workoutSeconds(spState().state, option);
  if (actual > 0) return C.formatDuration(actual);
  const plan = option.plan;
  if (!plan.exercises.some(e => Number(e.execution_seconds) > 0 || C.holdSecondsFor(e) > 0)) return "";
  const seconds = C.estimateWorkoutSeconds(plan);
  return seconds > 0 ? `≈ ${C.formatDuration(seconds)}` : "";
}
function sp2Programs(options) {
  // Только действующий план Sport 2.0: легаси-каталог не должен возвращать
  // выбор программы, когда в базе разрешён ровно один active.
  return spProgramProgress(options.filter(option => option.sport2PlanId), spState().state, true)
    .filter(program => program.options.some(o => o.kind !== "test"));
}
function sp2ProgramStart(program) {
  return program.options.map(o => o.originalDate || o.date).sort()[0];
}
function sp2SelectedProgram(options, date) {
  const s = spState(), C = SP(), programs = sp2Programs(options);
  const option = C.selectedOption(options, date, "main", s.state) || C.selectedOption(options, date, "splits", s.state);
  return programs.find(p => option && p.key === C.optionProgramKey(option)) || programs[0];
}
function sp2ProgramOverview(options) {
  const s = spState(), C = SP(), today = C.todayKey();
  const programs = sp2Programs(options);
  const program = programs.find(p => p.key === s.sport2Program) || sp2SelectedProgram(options, today);
  if (!program) return `<section class="sp2-f-card sp2-f-plan"><h1>Программы ещё нет</h1><button type="button" class="ghost-button" data-action="sp-import-open">Добавить программу</button></section>`;
  const start = sp2ProgramStart(program);
  const current = sp2WeekNumber(start, today);
  const scheduled = program.options.filter(o => o.kind !== "test");
  const weeks = new Map();
  for (const option of (scheduled.length ? scheduled : program.options)) {
    const number = sp2WeekNumber(start, option.originalDate || option.date);
    if (!weeks.has(number)) weeks.set(number, []);
    weeks.get(number).push(option);
  }
  const entries = [...weeks].sort(([a], [b]) => a - b);
  const total = entries.at(-1)[0];
  const complete = items => items.filter(option => sp2Completed(option, s.state)).length;
  const rows = option => {
    const moved = option.originalDate && option.originalDate !== option.date;
    const done = sp2Completed(option, s.state);
    const conflicting = options.filter(o => o.date === option.date && o.kind === option.kind && !o.historyOnly).length > 1;
    const status = done ? "Выполнено" : conflicting ? "Есть варианты тренировки" : option.date === today ? "Сегодня, открыть тренировку" : "Открыть состав тренировки";
    const duration = sp2Duration(option);
    return `<button class="sp2-f-workrow" type="button" data-action="sp-2-workout" data-key="${spEsc(option.key)}" data-current="${option.date === today}" data-done="${done}">
      <span class="sp2-f-workday"><small>${sp2DayName(option.date)}</small><b>${Number(option.date.slice(8))}</b></span>
      <span class="sp2-f-workname"><strong>${spEsc(option.plan.title)}</strong>${duration ? `<small>${duration}</small>` : ""}${moved ? `<small>${spDateShort(option.date)} · с ${spDateShort(option.originalDate)}</small>` : ""}</span>
      <span class="sp2-f-status" role="img" aria-label="${status}" title="${status}">${done ? icon("check") : conflicting ? icon("more") : option.date === today ? SP_ICON.play : icon("right")}</span></button>`;
  };
  const groups = entries.map(([number, items]) => {
    const first = C.offsetDateKey(start, (number - 1) * 7);
    const key = `sport2-week:${program.key}:${number}`;
    const open = s.open[key] ?? number === current;
    return `<section class="sp2-f-card sp2-f-wgroup" data-current="${number === current}"><button type="button" class="sp2-f-whead" data-action="sp-2-week-open" data-key="${spEsc(key)}" data-open="${open}" aria-expanded="${open}">
      <span><b>Неделя ${number}</b><small>${spDateShort(first)} – ${spDateShort(C.offsetDateKey(first, 6))}</small></span>
      <span class="sp2-f-wcount" aria-label="${items.length} ${spPlural(items.length, "занятие", "занятия", "занятий")}">${items.length}</span>${icon(open ? "up" : "down")}</button>
      ${open ? `<div class="sp2-f-wlist">${items.slice().sort((a, b) => a.date.localeCompare(b.date)).map(rows).join("")}</div>` : ""}</section>`;
  }).join("");
  const picker = programs.length > 1 ? `<div class="sp2-f-program-pick">
    <button class="sp2-f-program-trigger" type="button" data-action="sp-2-program-menu" aria-expanded="${Boolean(s.sport2ProgramOpen)}" aria-label="Выбрать программу">Выбрать программу ${icon(s.sport2ProgramOpen ? "up" : "down")}</button>
    ${s.sport2ProgramOpen ? `<div class="sp2-f-program-options" role="group" aria-label="Программы">${programs.map(p => `<button type="button" data-action="sp-2-program-pick" data-key="${spEsc(p.key)}" aria-pressed="${p.key === program.key}">${spEsc(p.title)}</button>`).join("")}</div>` : ""}</div>` : "";
  return `<section class="sp2-f-card sp2-f-plan">
    <div class="sp2-f-planhead"><h1>${spEsc(program.title)}</h1><button class="sp2-f-icon" type="button" data-action="sp-programs" aria-label="Действия с программами">${icon("more")}</button></div>
    ${picker}
    <div class="sp2-f-planline" aria-hidden="true">${entries.map(([number, items]) => `<i class="${number === current ? "current" : ""}" style="--sp2-progress:${100 * complete(items) / items.length}%"></i>`).join("")}</div>
    <div class="sp2-f-weekfoot"><span>${current >= 1 && current <= total ? `Нед. <b>${current}</b>/${total}` : current < 1 ? `Старт ${spDateShort(start)}` : `${total} ${spPlural(total, "неделя", "недели", "недель")}`}</span>
    <span>${icon("calendar")} <b>${scheduled.length}</b> ${spPlural(scheduled.length, "занятие", "занятия", "занятий")}</span></div>
  </section>${groups}`;
}
SP_ACTIONS["sp-2-week-open"] = control => {
  spState().open[control.dataset.key] = control.dataset.open !== "true";
  render();
  const button = [...document.querySelectorAll('[data-action="sp-2-week-open"]')].find(el => el.dataset.key === control.dataset.key);
  button?.focus({ preventScroll: true });
};
SP_ACTIONS["sp-2-program-menu"] = () => {
  const s = spState();
  s.sport2ProgramOpen = !s.sport2ProgramOpen;
  render();
  document.querySelector('[data-action="sp-2-program-menu"]')?.focus({ preventScroll: true });
};
SP_ACTIONS["sp-2-program-pick"] = control => {
  const s = spState();
  s.sport2Program = control.dataset.key;
  s.sport2ProgramOpen = false;
  render();
  document.querySelector('[data-action="sp-2-program-menu"]')?.focus({ preventScroll: true });
};

function sp2Preview(options) {
  const s = spState();
  return s.tab === "workout" && SP().isSport2Enabled(s.state) ? options.find(o => o.key === s.workoutPreviewKey) : undefined;
}
function sp2WorkoutScreen() {
  const s = spState(), { visible } = spOptions();
  return `<div class="sp-day-workout">${spDayWorkout(visible, s.date, s.kind)}</div>
    <button class="text-action" type="button" data-action="sp-rules">Правила ${s.kind === "splits" ? "растяжки" : "тренировки"}</button>`;
}

function spTrainingScreen() {
  const s = spState(), C = SP();
  const { visible } = spOptions();
  if (C.isSport2Enabled(s.state)) return sp2ProgramOverview(visible);
  const hasSplits = visible.some(o => o.kind === "splits");
  s.kind = spAutoKind(visible, s.date);
  const upcoming = spUpcoming(visible, s.state, s.date);
  const next = upcoming.length ? `<section class="sp-block"><div class="sp-block-head"><h2>Дальше</h2><span>${upcoming.length}</span></div>${upcoming.map(o => `<button type="button" class="sp-agenda-row" data-action="sp-date" data-date="${o.date}"><span><b>${spDateShort(o.date)}</b><strong>${spEsc(o.plan.title)}</strong><small>${o.kind === "splits" ? "Растяжка" : o.kind === "test" ? "Тест" : "Сила"}</small></span><span>${o.kind === "test" ? "" : C.formatDuration(C.estimateWorkoutSeconds(o.plan))}</span></button>`).join("")}</section>` : "";
  return `${spWeekStrip(visible)}${hasSplits ? `<div class="sp-segment sp-kind-switch" role="group" aria-label="Направление"><button type="button" class="${s.kind === "main" ? "active" : ""}" data-action="sp-kind" data-kind="main">Сила</button><button type="button" class="${s.kind === "splits" ? "active" : ""}" data-action="sp-kind" data-kind="splits">Растяжка</button></div>` : ""}
    <div class="sp-day-workout">${spDayWorkout(visible, s.date, s.kind)}</div>${next}
    <div class="sp-row-actions sp-center"><button class="text-action" type="button" data-action="sp-free-new">+ Свободная тренировка</button><button class="text-action" type="button" data-action="sp-rules">Правила ${s.kind === "splits" ? "растяжки" : "тренировки"}</button></div>`;
}
/**
 * Сила или растяжка — по дню, а не всегда «Сила»: в день только с растяжкой
 * сразу растяжка; есть оба — сила, а сделана сила — растяжка. Выбрали сами —
 * держим выбор для этого дня.
 */
function spAutoKind(options, date) {
  const s = spState(), C = SP();
  if (s.kindPick?.date === date) return s.kindPick.kind;
  const pick = kind => C.selectedOption(options, date, kind, s.state);
  const main = pick("main"), splits = pick("splits");
  if (!main) return splits ? "splits" : "main";
  // Только после «Завершить»: все подходы отмечены, а кнопку ещё не нажали — силовую не уводим с экрана.
  const done = Boolean(s.state.workouts?.[main.key]);
  const splitsDone = splits && Boolean(s.state.workouts?.[splits.key]);
  return done && splits && !splitsDone ? "splits" : "main";
}
function spDayWorkout(options, date, kind) {
  const s = spState(), C = SP();
  const variants = options.filter(o => o.date === date && o.kind === kind);
  if (!variants.length) {
    if (C.withinProgram(options, date) && kind === "main") return `<section class="sp-quiet-state"><p class="sp-kicker">Отдых</p><h2>День восстановления</h2><p class="section-note">Сегодня мышцы растут — не в зале, а между тренировками.</p><ul class="sp-rest"><li><b>Двигайся легко</b><span>Прогулка, велосипед в спокойном темпе. Полный покой восстанавливает хуже, чем лёгкое движение.</span></li><li><b>Разомнись</b><span>Утренняя разминка остаётся: она короткая и не мешает восстановлению.</span></li><li><b>Выспись</b><span>Сон — главный инструмент восстановления.</span></li><li><b>Ешь и пей как обычно</b><span>Белок и вода нужны в дни отдыха не меньше.</span></li></ul><p class="section-note">Крепатура через день-два — нормально. Резкая боль в суставе — нет.</p></section>`;
    return `<section class="sp-quiet-state"><p>${kind === "splits" ? "Растяжка" : "Тренировка"} на эту дату ещё не добавлена.</p><button class="ghost-button" type="button" data-action="sp-import-open">Добавить программу</button></section>`;
  }
  const newest = variants.length > 1 ? variants.reduce((best, o) => (o.addedAt || "") > (best.addedAt || "") ? o : best).addedAt : undefined;
  const chosen = sp2Preview(variants) || C.selectedOption(options, date, kind, s.state);
  const picker = variants.length > 1 ? `<section class="sp-block"><div class="sp-block-head"><h2>Вариант тренировки</h2><span>${variants.length}</span></div><p class="section-note">Подходы каждого варианта сохраняются отдельно.</p>${variants.map(o => `<button type="button" class="sp-variant ${chosen?.key === o.key ? "on" : ""}" data-action="sp-choose" data-key="${spEsc(o.key)}"><span><strong>${spEsc(o.plan.title)}</strong>${newest && o.addedAt === newest && !o.key.startsWith("free|") ? `<em>Новая программа</em>` : ""}<small>${spEsc(o.programTitle)}</small></span><b>${C.optionCompletion(o, s.state) === 100 ? "✓" : chosen?.key === o.key ? "Выбран" : "Выбрать"}</b></button>`).join("")}</section>` : "";
  if (!chosen) return picker;
  const readOnly = date > C.todayKey() || Boolean(chosen.historyOnly);
  const finished = Boolean(s.state.workouts?.[chosen.key]);
  spTimerRegister(chosen, readOnly, finished);
  const warmup = chosen.warmup ? (() => {
    const list = chosen.warmup.exercises || [];
    const seconds = list.reduce((sum, e) => sum + (C.holdSecondsFor(e) || e.execution_seconds || 0) * C.exerciseSets(e), 0);
    const done = Boolean(s.state.warmups?.[chosen.date]);
    const duration = seconds ? (seconds < 60 ? `${seconds} сек` : C.formatDuration(seconds)) : "";
    return `<details class="sp-details sp-warmup"><summary><span><b>Разминка</b><small>${list.length} ${spPlural(list.length, "упражнение", "упражнения", "упражнений")}${duration ? ` · ${duration}` : ""}</small></span>${done ? `<i class="sp-warmup-done" aria-label="Отмечено">${icon("check", "icon-sm")}</i>` : ""}</summary><ol class="sp-steps-list">${list.map((e, i) => `<li><span>${spEsc(e.name)}</span><b>${spEsc(e.sets_reps)}</b>${e.technique || C.hasVideo(e) ? `<button class="icon-button" type="button" data-action="sp-technique" data-from="warmup" data-i="${i}" aria-label="Техника">${SP_ICON.technique}</button>` : ""}</li>`).join("")}</ol></details>`;
  })() : "";
  return `${picker}${chosen.historyOnly ? `<p class="section-note">История сохранена. План убран из расписания; запись доступна только для просмотра.</p>` : ""}${warmup}${spWorkoutCard(chosen, readOnly, finished)}`;
}

function spKg(value) { return (Number.isInteger(value) ? String(value) : value.toFixed(1)).replace(".", ","); }

function spWorkoutCard(option, readOnly, finished) {
  const s = spState(), C = SP(), plan = option.plan;
  const future = option.date > C.todayKey() && !option.historyOnly;
  const futureRun = future && option.kind === "main";
  const futureCopy = futureRun ? spTodayCopyKey(option) : "";
  const futureLabel = futureCopy && s.state.workoutTimes?.[futureCopy] ? "Продолжить" : "Выполнить сегодня";
  const checks = C.optionChecks(option, s.state);
  const total = plan.exercises.length;
  const done = plan.exercises.filter((e, i) => C.completedSets(checks[i], C.exerciseSets(e)) >= C.exerciseSets(e)).length;
  const doneSets = plan.exercises.reduce((sum, e, i) => sum + C.completedSets(checks[i], C.exerciseSets(e)), 0);
  const totalSets = plan.exercises.reduce((sum, e) => sum + C.exerciseSets(e), 0);
  const allDone = total > 0 && done === total;
  const active = finished || readOnly ? -1 : plan.exercises.findIndex((e, i) => C.completedSets(checks[i], C.exerciseSets(e)) < C.exerciseSets(e));
  const phase = spTimer.session?.key === option.key ? spTimer.phase : null;
  const shown = phase ? spShownIndex(phase, active) : active;
  const expanded = !finished || s.open[`workout:${option.key}`];
  const seconds = C.workoutSeconds(s.state, option);
  const splits = plan.routine_type === "splits";
  const free = option.key.startsWith("free|");
  const head = finished
    ? `<div class="sp-workout-done"><button type="button" class="sp-workout-done-main" data-action="sp-toggle-open" data-key="workout:${spEsc(option.key)}"><small>${icon("check", "icon-sm")}${splits ? "Растяжка завершена" : "Тренировка завершена"} · ${doneSets}/${totalSets} подходов${seconds ? ` · ${C.formatDuration(seconds)}` : ""}</small><strong>${spEsc(plan.title)}</strong></button><button class="text-action" type="button" data-action="sp-unfinish" ${readOnly ? "disabled" : ""}>Отменить</button></div>`
    : `<div class="sp-workout-head"><div class="sp-workout-meta"><span>${splits ? "Растяжка" : "Тренировка"}</span><span>${free ? "Свободная тренировка" : spEsc(option.programTitle)}</span></div><h2>${spEsc(plan.title)}</h2>${option.originalDate && option.originalDate !== option.date ? `<p class="section-note">Перенесено с ${spDateShort(option.originalDate)} · порядок сохранён</p>` : ""}${plan.focus ? `<p class="section-note">${spEsc(plan.focus)}</p>` : ""}${free ? `<button class="text-action" type="button" data-action="sp-free-edit" data-id="${spEsc(option.key.slice(5))}">Изменить</button>` : ""}</div>`;
  const startLabel = doneSets > 0 || spTimer.session?.key === option.key ? "Продолжить" : "Начать";
  const progress = finished && !expanded ? "" : `<div class="sp-workout-progress"><span class="sp-progress" role="progressbar" aria-label="Выполнено подходов" aria-valuemin="0" aria-valuemax="${totalSets}" aria-valuenow="${doneSets}"><i style="width:${totalSets ? Math.round(doneSets / totalSets * 100) : 0}%"></i></span><div class="sp-workout-foot"><span>${doneSets} из ${totalSets} подходов${!readOnly && !allDone ? ` · ≈ ${C.formatDuration(C.estimateWorkoutSeconds(plan))}` : ""}</span>${!readOnly && !allDone ? `<button class="primary-button" type="button" data-action="sp-runner">${startLabel}</button>` : futureRun ? `<button class="primary-button" type="button" data-action="sp-run-day" data-key="${spEsc(option.key)}">${futureLabel}</button>` : ""}</div></div>`;
  const rows = expanded ? plan.exercises.map((e, i) => {
    const sets = C.exerciseSets(e), doneSets = C.completedSets(checks[i], sets), complete = doneSets >= sets;
    const disabled = readOnly || finished || (phase !== null && phase.index !== i);
    const kitId = C.exerciseEquipment(e.name);
    const repsText = e.sets_reps.replace(/^\s*\d+\s*[×xх]\s*/i, "");
    const liked = C.isFavorite(s.state, e.name);
    const reset = doneSets > 0 && !readOnly && !finished ? `<button type="button" class="sp-chip sp-ex-reset" data-action="sp-reset-ex" data-i="${i}" ${disabled ? "disabled" : ""} aria-label="Сбросить подходы: ${spEsc(e.name)}">${SP_ICON.reset}<b>Сброс</b></button>` : "";
    const glyph = spMuscleGlyph(e.muscles);
    return `<div class="sp-ex ${complete ? "done" : ""} ${!finished && !readOnly && i === shown ? "active" : ""}">
      <button type="button" class="sp-ex-tap" data-action="sp-exercise" data-i="${i}" aria-label="Техника: ${spEsc(e.name)}"><span class="sp-ex-num">${complete ? icon("check", "icon-sm") : String(i + 1).padStart(2, "0")}</span><span class="sp-ex-main"><strong>${spEsc(e.name)}${liked ? ` <i class="sp-liked">${SP_ICON.heartOn}</i>` : ""}</strong><small><span class="sp-ex-kit" aria-hidden="true">${spEquipIcon(kitId || (C.isBodyweight(e) ? "bodyweight" : "sets"))}</span>Подходы ${doneSets}/${sets} · ${spEsc(repsText)}${e.swappedFrom ? " · замена" : ""}</small></span></button>
      <div class="sp-ex-side">${glyph ? `<button type="button" class="sp-glyph-open" data-action="sp-exercise" data-i="${i}" aria-label="Карта мышц">${glyph}</button>` : ""}</div>
      ${splits && !reset ? "" : `<div class="sp-ex-result">${splits ? "" : spResultLine(option, i, readOnly)}${reset}</div>`}</div>`;
  }).join("") : "";
  const finish = !finished && expanded && !futureRun ? `<button class="primary-button sp-wide ${allDone ? "" : "soft"}" type="button" data-action="sp-finish" ${readOnly || phase ? "disabled" : ""}>${readOnly ? (option.historyOnly ? "История · только просмотр" : "План на будущий день") : `Завершить ${splits ? "растяжку" : "тренировку"}`}</button>` : "";
  return `<section class="sp-workout-surface ${finished ? "is-finished" : ""}">${head}${progress}${rows ? `<div class="sp-ex-list">${rows}</div>` : ""}${expanded && !readOnly ? `<button class="sp-add-ex" type="button" data-action="sp-extra-open" data-key="${spEsc(option.key)}" ${phase ? "disabled" : ""}>+ упражнение</button>` : ""}${finish}</section>`;
}
/** Справа — фигурка мышц, под ней «Сброс»: карточка сделанного упражнения той же высоты, что и остальные. */
function spExSide(e, i, canReset, disabled) {
  const C = SP();
  const glyph = C.knownMuscles(e.muscles?.primary).length || C.knownMuscles(e.muscles?.secondary).length
    ? `<button type="button" class="sp-glyph-open" data-action="sp-exercise" data-i="${i}" aria-label="Карта мышц">${spMuscleGlyph(e.muscles)}</button>` : "";
  const reset = canReset ? `<button type="button" class="sp-chip sp-ex-reset" data-action="sp-reset-ex" data-i="${i}" ${disabled ? "disabled" : ""}>${SP_ICON.reset}<b>Сброс</b></button>` : "";
  return glyph || reset ? `<div class="sp-ex-side">${glyph}${reset}</div>` : "";
}
function spCurrentOption() {
  const s = spState(), C = SP();
  const { visible } = spOptions();
  return sp2Preview(visible) || C.selectedOption(visible, s.date, s.kind, s.state);
}

// ------------------------------------------------------------ окна тренировки

SP_SHEETS.technique = sheet => {
  const C = SP(), s = spState();
  const exercise = sheet.exercise;
  const video = C.exerciseVideoId(exercise);
  const liked = C.isFavorite(s.state, exercise.name);
  const record = spRecordFor(s.state, exercise.name);
  const actions = sheet.option ? `<div class="sp-ex-sheet-actions"><button class="ghost-button" type="button" data-action="sp-swap-open">Заменить</button>${s.kind !== "splits" ? `<button class="primary-button" type="button" data-action="sp-weight-from-sheet">Записать подходы</button>` : ""}</div>` : "";
  const action = sheet.option ? `<button type="button" class="icon-button sp-sheet-like ${liked ? "on" : ""}" data-action="sp-like-sheet" aria-label="${liked ? "Убрать из любимых" : "В любимые"}" aria-pressed="${liked}">${liked ? SP_ICON.heartOn : SP_ICON.heart}</button>` : "";
  return { title: exercise.name, action, body: `<p class="sp-runner-scheme">${spEsc(exercise.sets_reps)}${exercise.swappedFrom ? ` · вместо «${spEsc(exercise.swappedFrom)}»` : ""}</p>${record ? `<p class="section-note">Рекорд: ${record.bodyweight ? `${record.reps} повт. за подход` : `${spKg(record.kilograms)} кг${record.reps ? ` × ${record.reps}` : ""}`} · ${spDateShort(record.date)}</p>` : ""}${actions}${exercise.technique ? `<p class="sp-tech">${spEsc(exercise.technique)}</p>` : ""}${video ? spVideoHtml(video, exercise) : `<button class="text-action" type="button" data-action="sp-external" data-url="${spEsc(C.videoSearchUrl(exercise))}">Найти видео на YouTube →</button>`}${spMuscleMap(exercise.muscles)}` };
};
SP_SHEETS.rules = () => {
  const C = SP(), kind = spState().kind;
  const rules = kind === "splits" ? C.STRETCHING_RULES : C.TRAINING_RULES;
  return { title: kind === "splits" ? "Правила растяжки" : "Правила тренировки", body: `<ul class="sp-rules">${rules.map(r => `<li>${spEsc(r)}</li>`).join("")}</ul>` };
};
SP_SHEETS.muscles = sheet => ({ title: sheet.exercise.name, body: spMuscleMap(sheet.exercise.muscles) });
function spLoadControl(option, index) {
  const C = SP(), exercise = option.plan.exercises[index];
  const sum = spSetsSummary(option, index);
  const readOnly = option.historyOnly || option.date > C.todayKey();
  const ic = C.isBodyweight(exercise) ? spEquipIcon("sets") : spEquipIcon("load");
  return readOnly ? `<span class="sp-set-count">${spEsc(sum.text)}</span>` : `<button type="button" class="sp-chip sp-load" data-action="sp-weight" data-i="${index}" aria-label="Подходы: ${spEsc(exercise.name)}">${ic}<b>${spEsc(sum.text)}</b></button>`;
}

// Результат по подходам: у упражнения с весом — вес и повторения каждого
// подхода, без веса (подтягивания, отжимания) — повторения по подходам.
const spRepsUnit = e => (SP().holdSecondsFor(e) > 0 ? "сек" : "повт.");
function spPreviousResult(exercise, workout) {
  const logs = SP().previousSetLogs(spState().state, exercise.name, workout)
    .filter(l => Number.isFinite(l.actualReps) && l.actualReps > 0);
  if (!logs.length) return null;
  const unit = spRepsUnit(exercise);
  const sameWeight = logs.every(l => l.kilograms === logs[0].kilograms && l.basis === logs[0].basis);
  const values = logs.map(l => `${l.actualReps}`).join(' · ');
  const weight = l => l.kilograms === null ? '' : `${spKg(l.kilograms)} кг${SP().WEIGHT_BASIS[l.basis] ? ` (${SP().WEIGHT_BASIS[l.basis].toLocaleLowerCase()})` : ''} × `;
  const label = sameWeight ? `${weight(logs[0])}${values} ${unit}`
    : logs.map(l => `${weight(l)}${l.actualReps} ${unit}`).join(' · ');
  return { logs, label, date: logs[0].date, basis: logs.find(l => l.basis)?.basis || '' };
}
function spSetsSummary(option, index) {
  const C = SP(), s = spState(), e = option.plan.exercises[index], unit = spRepsUnit(e);
  const logs = C.exerciseSetLogs(s.state, option, index);
  const weighted = !C.isBodyweight(e);
  const reps = list => list.map(l => l.actualReps).join(" · ");
  if (logs.length) {
    if (!weighted || logs.every(l => l.kilograms === null)) return { text: `${reps(logs)} ${unit}`, mine: true };
    const kgs = [...new Set(logs.map(l => l.kilograms ?? 0))];
    return { text: kgs.length === 1 ? `${spKg(kgs[0])} кг × ${reps(logs)}` : `${logs.map(l => `${spKg(l.kilograms ?? 0)}×${l.actualReps}`).join(" · ")} кг`, mine: true };
  }
  if (weighted) {
    const load = C.workoutLoad(s.state, option, index);
    return load ? { text: `${spKg(load.kilograms)} кг${load.actualReps ? ` × ${load.actualReps} ${unit}` : ""}`, hint: load.source !== "selected" } : { text: "Записать вес и повторения", empty: true };
  }
  const prev = C.previousSetLogs(s.state, e.name, option.key);
  return prev.length ? { text: `В прошлый раз ${reps(prev)} ${unit}`, hint: true } : { text: "Записать повторения", empty: true };
}
function spResultLine(option, index, readOnly) {
  const C = SP(), e = option.plan.exercises[index], sum = spSetsSummary(option, index);
  const ic = C.isBodyweight(e) ? spEquipIcon("sets") : spEquipIcon("load");
  if (readOnly && sum.empty) return "";
  return `<button type="button" class="sp-ex-meta sp-ex-load ${sum.empty ? "empty" : sum.hint ? "hint" : ""}" data-action="sp-weight" data-i="${index}" ${readOnly ? "disabled" : ""} aria-label="Подходы: ${spEsc(e.name)}"><span class="sp-ex-kit" aria-hidden="true">${ic}</span><span class="sp-set-count">${spEsc(sum.text)}</span></button>`;
}
/** Повторения по плану: «3 × 8–12» → 8, «4 × 10» → 10. */
const spPlanReps = e => Number(String(e.sets_reps || "").match(/[×xх]\s*(\d+)/i)?.[1]) || 10;
function spOpenWeight(option, index) {
  const C = SP(), s = spState(), exercise = option?.plan.exercises[index];
  if (!exercise) return;
  const weighted = !C.isBodyweight(exercise);
  const mine = C.exerciseSetLogs(s.state, option, index);
  const previous = spPreviousResult(exercise, option.key);
  const load = weighted ? C.workoutLoad(s.state, option, index) : null;
  const todayLoad = load?.source === 'previous' ? null : load;
  const reps = todayLoad?.actualReps || C.holdSecondsFor(exercise) || spPlanReps(exercise), kg = todayLoad?.kilograms ?? 0;
  const from = mine;
  const sets = from.length
    ? from.map(l => ({ reps: l.actualReps || reps, kg: weighted ? l.kilograms ?? kg : null }))
    : Array.from({ length: C.exerciseSets(exercise) }, () => ({ reps, kg: weighted ? kg : null }));
  spOpen("weight", { exercise, option: option.key, index, weighted, basis: mine.find(l => l.basis)?.basis || todayLoad?.basis || "", sets, previous });
}
SP_SHEETS.weight = sheet => {
  const unit = spRepsUnit(sheet.exercise) === "сек" ? "сек" : "повт.";
  const rows = sheet.sets.map((set, k) => `<div class="sp-setlog-row"><span class="sp-setlog-n">${k + 1}</span>
    ${sheet.weighted ? `<label class="sp-setlog-kg"><input type="number" min="0" max="2000" step="0.5" inputmode="decimal" value="${set.kg ?? 0}" data-sp-set="kg" data-k="${k}" aria-label="Вес, подход ${k + 1}"><small>кг</small></label>` : ""}
    <div class="sp-stepper sp-setlog-reps"><button type="button" data-action="sp-set-step" data-k="${k}" data-d="-1" aria-label="Меньше">−</button><input type="number" min="1" max="1000" step="1" inputmode="numeric" value="${set.reps}" data-sp-set="reps" data-k="${k}" aria-label="Повторения, подход ${k + 1}"><span>${unit}</span><button type="button" data-action="sp-set-step" data-k="${k}" data-d="1" aria-label="Больше">+</button></div>
    ${sheet.sets.length > 1 ? `<button type="button" class="icon-button" data-action="sp-set-del" data-k="${k}" aria-label="Убрать подход ${k + 1}">${icon("close", "icon-sm")}</button>` : ""}</div>`).join("");
  return { title: "Подходы", body: `<p class="section-note">${spEsc(sheet.exercise.name)} · план ${spEsc(sheet.exercise.sets_reps)}</p>${sheet.previous ? `<div class="sp-previous-result"><span><small>В прошлый раз · ${spEsc(spDateShort(sheet.previous.date))}</small><b>${spEsc(sheet.previous.label)}</b></span><button type="button" class="text-action" data-action="sp-set-copy-previous">Повторить</button></div>` : ''}
    <div class="sp-setlog">${rows}</div>
    ${sheet.sets.length < SP().MAX_LOGGED_SETS ? `<button class="text-action" type="button" data-action="sp-set-add">+ Подход</button>` : ""}
    <button class="primary-button sp-wide" type="button" data-action="sp-weight-save">Сохранить</button>` };
};
document.addEventListener("input", event => {
  const field = event.target.dataset?.spSet;
  if (!field) return;
  const sets = spState().sheet?.sets, k = Number(event.target.dataset.k);
  if (!sets?.[k]) return;
  // Поправили подход — нижние подходы с тем же старым значением идут следом:
  // вес выставляют один раз, а не в каждой строке. Без перерисовки — поле не прыгает под пальцем.
  const was = String(sets[k][field]);
  sets[k][field] = event.target.value;
  for (let i = k + 1; i < sets.length && String(sets[i][field]) === was; i++) {
    sets[i][field] = event.target.value;
    const input = document.querySelector(`[data-sp-set="${field}"][data-k="${i}"]`);
    if (input) input.value = event.target.value;
  }
});

document.addEventListener("input", event => {
  if (event.target.matches?.("[data-sp-reps-number], [data-sp-reps-range]")) {
    spState().sheet.reps = event.target.value;
    const number = document.querySelector("[data-sp-reps-number]"), range = document.querySelector("[data-sp-reps-range]");
    if (event.target === range && number) number.value = event.target.value;
    if (event.target === number && range) { range.max = Math.max(50, Math.min(1000, Number(event.target.value) || 1)); range.value = event.target.value || 1; }
    return;
  }
  if (!event.target.matches?.("[data-sp-kg-range], [data-sp-kg-number]")) return;
  const sheet = spState().sheet;
  sheet.kg = Number(event.target.value);
  const other = document.querySelector(event.target.matches("[data-sp-kg-number]") ? "[data-sp-kg-range]" : "[data-sp-kg-number]"); if (other) other.value = sheet.kg;
});

Object.assign(SP_ACTIONS, {
  "sp-kind": control => { if (spTimerGuard()) return; const s = spState(); s.kind = control.dataset.kind; s.kindPick = { date: s.date, kind: s.kind }; render(); },
  "sp-day-shift": control => { if (spTimerGuard()) return; const s = spState(); s.date = SP().offsetDateKey(s.date, Number(control.dataset.d)); render(); },
  "sp-choose": control => {
    if (spTimerGuard()) return;
    const option = spOptions().visible.find(o => o.key === control.dataset.key);
    if (option && spState().tab === "workout") spState().workoutPreviewKey = option.key;
    if (option) spUpdate(prev => SP().chooseOption(prev, option)).catch(() => {});
  },
  "sp-tap": control => {
    if (!spTimer.session) return;
    const i = Number(control.dataset.i);
    spTap(i, SP().exerciseSets(spTimer.session.option.plan.exercises[i]));
    spOverlay(true); render();
  },
  "sp-runner": () => { if (!spTimer.session) return; const session = spTimer.session; if (!session.readOnly && !session.finished) spUpdate(prev => SP().startOption(prev, session.option)).catch(() => {}); spTimer.runner = true; spTimer.dismissed = false; spOverlay(true); },
  "sp-runner-close": () => { spTimer.runner = false; spTimer.videoOpen = false; spOverlay(true); render(); },
  "sp-dismiss": () => { if (spTimer.phase) spSetPhase(null); spTimer.dismissed = true; spTimer.runner = false; spOverlay(true); render(); },
  "sp-pause": () => { const c = spTimer.clock; if (!c) return; if (c.running) c.pause(); else c.resume(); spNoteClock(); spTimerPaint(); },
  "sp-adjust": control => { const c = spTimer.clock; if (!c) return; c.adjust(Number(control.dataset.d)); spNoteClock(); spTimerPaint(); },
  "sp-skip": () => { const p = spTimer.phase; if (!p) return; spTimer.clock?.finish(); spPhaseDone(p); render(); },
  "sp-cancel-set": () => { if (spTimer.phase && spTimer.clock?.finish()) spSetPhase(null); render(); },
  "sp-finish": control => {
    const option = spTimer.session?.option || spCurrentOption();
    if (!option) return;
    if (spTimer.phase) spSetPhase(null);
    spUpdate(prev => SP().finishOption(prev, option, true)).catch(() => {});
    if (control.dataset.close) spTimer.runner = false;
    spOverlay(true); render();
  },
  "sp-unfinish": () => { const option = spCurrentOption(); if (option) spUpdate(prev => SP().finishOption(prev, option, false)).catch(() => {}); },
  "sp-reset-ex": control => { if (spTimer.phase) return; const option = spCurrentOption(); if (option) spUpdate(prev => SP().setOptionExercise(prev, option, Number(control.dataset.i), 0)).catch(() => {}); },
  "sp-like": control => { const option = spCurrentOption(); const e = option?.plan.exercises[Number(control.dataset.i)]; if (e) spUpdate(prev => SP().toggleFavorite(prev, e.name)).catch(() => {}); },
  "sp-exercise": control => {
    const option = spCurrentOption();
    const exercise = option?.plan.exercises[Number(control.dataset.i)];
    if (!exercise) return;
    spTimer.videoOpen = false;
    spOpen("technique", { exercise, option: option.key, program: SP().optionProgramKey(option), id: exercise.id ?? control.dataset.i, index: Number(control.dataset.i) });
  },
  "sp-swap-open": () => {
    const sheet = spState().sheet;
    spOpen("swap", { from: sheet.exercise.name, original: sheet.exercise.swappedFrom || sheet.exercise.name, swapped: Boolean(sheet.exercise.swappedFrom), option: sheet.option, program: sheet.program, id: sheet.id });
  },
  "sp-weight-from-sheet": () => { const sheet = spState().sheet; spOpenWeight(spOptions().all.find(o => o.key === sheet.option), sheet.index); },
  "sp-like-sheet": () => { const sheet = spState().sheet; spUpdate(prev => SP().toggleFavorite(prev, sheet.exercise.name)).catch(() => {}); },
  "sp-rules": () => spOpen("rules"),
  "sp-technique": control => {
    const option = spCurrentOption();
    const list = control.dataset.from === "warmup" ? option?.warmup?.exercises : option?.plan.exercises;
    const exercise = list?.[Number(control.dataset.i)];
    if (exercise) { spTimer.videoOpen = false; spOpen("technique", { exercise }); }
  },
  "sp-muscles": control => { const e = spCurrentOption()?.plan.exercises[Number(control.dataset.i)]; if (e) spOpen("muscles", { exercise: e }); },
  "sp-weight": control => { spOpenWeight(spTimer.runner ? spTimer.session?.option : spCurrentOption(), Number(control.dataset.i)); },
  "sp-weight-basis": control => { spState().sheet.basis = control.dataset.basis; render(); },
  "sp-kg": control => { const sheet = spState().sheet; sheet.kg = Math.max(0, Math.round((sheet.kg + Number(control.dataset.d)) * 2) / 2); render(); },
  "sp-reps": control => { const sheet = spState().sheet; sheet.reps = sheet.reps === "" ? 1 : Math.max(1, Math.min(1000, Number(sheet.reps) + Number(control.dataset.d))); render(); },
  "sp-set-step": control => { const set = spState().sheet.sets[Number(control.dataset.k)]; set.reps = Math.max(1, Math.min(1000, (Number(set.reps) || 0) + Number(control.dataset.d))); render(); },
  "sp-set-add": () => { const sets = spState().sheet.sets, last = sets[sets.length - 1]; sets.push({ ...last }); render(); },
  "sp-set-del": control => { spState().sheet.sets.splice(Number(control.dataset.k), 1); render(); },
  "sp-set-copy-previous": () => {
    const sheet = spState().sheet;
    if (sheet?.kind !== 'weight' || !sheet.previous) return;
    sheet.sets = sheet.previous.logs.map(l => ({ reps: l.actualReps, kg: sheet.weighted ? l.kilograms ?? 0 : null }));
    sheet.basis = sheet.previous.basis;
    render();
  },
  "sp-weight-save": async () => {
    const C = SP(), sheet = spState().sheet;
    const option = spOptions().all.find(o => o.key === sheet.option) || (spTimer.session?.option.key === sheet.option ? spTimer.session.option : null);
    if (!option) return spSheetError("Тренировка не найдена — откройте её заново.");
    const sets = sheet.sets.map(x => ({ reps: Math.round(Number(x.reps)), kilograms: sheet.weighted ? Number(String(x.kg).replace(",", ".")) : null }));
    try { C.validateSets(sets); } catch (error) { return spSheetError(error.message); }
    try { await spUpdate(prev => C.recordSets(prev, option, sheet.index, sets, sheet.basis || undefined)); if (spState().sheet === sheet) spClose(); }
    catch (error) { if (error?.message === "outbox_storage") spSheetError("Не удалось сохранить подходы. Освободите место и повторите."); else if (spState().sheet === sheet) spClose(); }
  },
  "sp-video-play": control => { spTimer.videoOpen = control.dataset.id; spOverlay(true); if (spState().sheet) render(); },
  "sp-video-full": control => { const box = control.closest("[data-sp-video]"); box?.requestFullscreen?.().catch(() => box.classList.add("expanded")); },
  "sp-external": control => spExternal(control.dataset.url),
});
// Уход из Flow на минуту не должен оставлять «Сегодня» без полосы: перерисовка
// полосы и после смены страницы приложения.
window.addEventListener("hashchange", () => setTimeout(() => spOverlay(true), 50));

// Native owns only the current wall-clock interval. Completing sets remains in the workout state.
function spClockActivity(active = true) {
  if (typeof CustomEvent !== 'function' || !document.dispatchEvent) return;
  if (active && (!spTimer.phase || !spTimer.clock || !spTimer.session)) return;
  const detail = active ? { active, token: spTimer.nativeToken, stage: SP_PHASE_LABEL[spTimer.phase.kind], remaining: spTimer.clock.remaining(), total: Math.max(1, spSecondsFor(spTimer.phase), spTimer.clock.remaining()), running: spTimer.clock.running } : { active, token: spTimer.nativeToken };
  const signature = JSON.stringify(detail), now = Date.now();
  if (signature === spTimer.islandSnapshot?.signature && now - spTimer.islandSnapshot.at < 1000) return;
  spTimer.islandSnapshot = { signature, at: now };
  document.dispatchEvent(new CustomEvent('flow:sport-clock', { detail }));
}
function spPublishTimer() {
  if (!spTimer.phase || !spTimer.clock || !spTimer.session) return;
  spClockActivity();
  const exercise = spTimer.session.option.plan.exercises[spTimer.phase.index];
  const ok = window.sorokaSportTimer?.update({ key: spTimer.session.key, token: spTimer.nativeToken,
    date: spTimer.session.option.date, kind: spTimer.session.option.kind, title: exercise.name, stage: SP_PHASE_LABEL[spTimer.phase.kind], total: Math.max(1, spSecondsFor(spTimer.phase)),
    phase: spTimer.phase, clock: spTimer.clock.snapshot() });
  if (window.sorokaSportTimer?.available && !ok) toast("Не удалось показать таймер в уведомлении. Проверьте разрешение уведомлений Flow.");
}
function spPollNativeTimer() {
  if (!spTimer.phase || !spTimer.clock || !spTimer.nativeToken || !window.sorokaSportTimer?.available) return;
  const saved = window.sorokaSportTimer.read();
  if (saved?.token !== spTimer.nativeToken || saved?.key !== spTimer.session?.key || !saved.clock) return;
  const local = spTimer.clock.snapshot();
  if (local.deadline !== saved.clock.deadline || local.pausedMs !== saved.clock.pausedMs) {
    spTimer.clock = SP().Countdown.restore(saved.clock);
    SP().saveTimer({ workout: saved.key, phase: spTimer.phase, clock: saved.clock });
  }
}

// Coach Eyes: единый приёмник события. Разбор и лист подхода — в sport-run.js.
function flowCoachEyesReceive(payload, attempt = 0) {
  if (!payload) return;
  const receive = window.SportCoachEyes?.receive;
  if (typeof receive === "function") { receive(payload); return; }
  if (attempt < 25) setTimeout(() => flowCoachEyesReceive(payload, attempt + 1), 200);
}
window.addEventListener("flow:coach-eyes", event => flowCoachEyesReceive(event.detail));
if (window.__flowCoachEyes) flowCoachEyesReceive(window.__flowCoachEyes);
