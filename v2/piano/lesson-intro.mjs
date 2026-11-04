import { noteInfo } from './pitch.mjs?v=63e9fd53e452';
import { createScoreTimeline } from './score.mjs?v=63e9fd53e452';

const GROUP_WINDOW = .035, EPSILON = 1e-9;
const BLACK = new Set([1, 3, 6, 8, 10]);
const HAND_LABELS = { right: 'Правая рука', left: 'Левая рука', both: 'Обе руки' };
const LANDMARKS = ['белая слева от двух чёрных', 'левая из двух чёрных', 'белая между двумя чёрными', 'правая из двух чёрных',
  'белая справа от двух чёрных', 'белая слева от трёх чёрных', 'левая из трёх чёрных', 'белая между первой и второй из трёх чёрных',
  'средняя из трёх чёрных', 'белая между второй и третьей из трёх чёрных', 'правая из трёх чёрных', 'белая справа от трёх чёрных'];
const spokenName = midi => noteInfo(midi).name.replace('♯', '-диез');
const inferHand = lesson => /обе|две|очеред/iu.test(lesson.hand || '') ? 'both' : /лев/iu.test(lesson.hand || '') ? 'left' : 'right';

function sourceFrames(lesson, hand, octave) {
  const notes = lesson?.notes;
  if (!Array.isArray(notes) || !notes.length || notes.length > 5000) throw new TypeError('An intro needs between 1 and 5000 actual notes.');
  const sourceTempo = lesson.sourceTempo ?? lesson.tempo ?? 60;
  if (!Number.isFinite(sourceTempo) || sourceTempo <= 0) throw new RangeError('An intro needs a valid source tempo.');
  const timed = notes.some(note => note?.time !== undefined || note?.duration !== undefined);
  const timeline=timed?null:createScoreTimeline(notes,{tempo:sourceTempo});
  let offset = 0, previous = -Infinity;
  const frames = Array.from(notes, (note, index) => {
    const midi = note?.midi + octave * 12;
    if (!Number.isInteger(note?.midi) || !Number.isInteger(midi) || midi < 0 || midi > 127) throw new TypeError('An intro needs valid source pitches.');
    const beats = note.beats ?? (timed ? note.duration * sourceTempo / 60 : 1);
    if (!Number.isFinite(beats) || beats <= 0) throw new TypeError('An intro needs positive note values.');
    const time = timed ? note.time : timeline[index].time, duration = timed ? note.duration : beats * 60 / sourceTempo * .9;
    if (!Number.isFinite(time) || time < 0 || time < previous || !Number.isFinite(duration) || duration <= 0 || time + duration > 86400) throw new TypeError('An intro needs ordered source seconds.');
    previous = time; offset += beats * 60 / sourceTempo;
    const assignedHand = ['left', 'right'].includes(note.hand) ? note.hand : hand === 'both' ?
      lesson.id === 'course-alternate' ? index % 2 ? 'left' : 'right' : note.midi < 60 ? 'left' : 'right' : hand;
    return { ...note, midi, originalMidi: note.midi, name: noteInfo(midi).name, time, duration, beats, hand: assignedHand,
      lessonIndex: index, sourceIndex: note.sourceIndex ?? index, sourceTime: time, sourceDuration: duration };
  });
  return { frames, sourceTempo };
}

function groupsFor(frames) {
  const groups = [];
  for (const frame of frames) {
    const group = groups.at(-1);
    if (group && frame.time - group[0].time <= GROUP_WINDOW + EPSILON) group.push(frame);
    else groups.push([frame]);
  }
  return groups;
}

function courseConcept(lesson, frames) {
  if(lesson.introSpeech)return {id:lesson.practiceKind||'practical-step',label:lesson.title,speech:lesson.introSpeech};
  const first = frames[0], firstName = spokenName(first.midi), black = frames.find(frame => BLACK.has(frame.midi % 12));
  if (lesson.id === 'course-do') return { id: 'keyboard-landmark', label: 'Находим До',
    speech: `${firstName} — ${LANDMARKS[first.midi % 12]}. Сначала покажу клавишу и два отдельных нажатия, затем попробуешь сам.` };
  if (lesson.id === 'course-do-re') return { id: 'white-neighbours', label: 'Две соседние клавиши',
    speech: 'До — белая слева от двух чёрных, Ре — следующая белая справа. Покажу, как перейти с одной на другую.' };
  if (lesson.id === 'course-do-re-mi') return { id: 'treble-clef', label: 'Первое знакомство с нотами',
    speech: 'Скрипичный ключ отмечает Соль на второй линейке снизу. Чем выше нота на стане, тем выше звук. Покажу До, Ре и Ми.' };
  if (lesson.id === 'course-fa') return { id: 'keyboard-landmark', label: 'Находим Фа',
    speech: 'Фа — белая клавиша слева от трёх чёрных. В показе перейдём с Ми на Фа и вернёмся обратно.' };
  if (lesson.id === 'course-repeats' || /repeat/iu.test(lesson.id || '')) return { id: 'repeated-release', label: 'Повторяем отдельным нажатием',
    speech: 'Одинаковую ноту нужно нажать заново. Отпусти клавишу между звуками, как в показе. Удержание не заменяет повтор.' };
  if (lesson.id === 'course-left') return { id: 'bass-clef', label: 'Ноты для левой руки',
    speech: 'У басового ключа точки окружают линейку Фа — вторую сверху. Сейчас разберём знакомые звуки левой рукой.' };
  if (lesson.moduleId === 'left-hand') return { id: 'left-pattern', label: 'Знакомая мелодия левой рукой',
    speech: 'Названия клавиш не меняются: теперь играет левая рука. Сначала послушай короткий рисунок, потом повтори его.' };
  if (lesson.moduleId === 'hands-dialogue') return { id: 'alternating-hands', label: 'Руки отвечают по очереди',
    speech: 'В этом рисунке руки отвечают по очереди. Дай одной закончить, затем вступает другая. Покажу место смены рук.' };
  if (lesson.moduleId === 'black-keys' || lesson.id?.includes('elise-neighbours')) return { id: 'black-key', label: 'Новый звук рядом',
    speech: black ? `${spokenName(black.midi)} — ${LANDMARKS[black.midi % 12]}. Диез поднимает ноту на ближайшую клавишу справа. Покажу этот поворот.` :
      'Рядом с белыми есть чёрные клавиши. Сейчас сравним настоящие звуки этой фразы, затем повторишь рисунок.' };
  if (lesson.moduleId === 'phrases' && frames.some(frame => frame.beats >= 2)) return { id: 'duration-pulse', label: 'Один счёт и два счёта',
    speech: 'Считай ровно: раз-два. Более длинную ноту держи дольше, не ускоряя счёт. Сейчас сравним короткий и длинный звук.' };
  if (lesson.moduleId === 'keyboard-range') return { id: 'keyboard-range', label: 'Переносим руку',
    speech: 'Мелодия может выйти за привычные пять клавиш. Сначала найди следующую опору и спокойно перенеси руку, как в показе.' };
  if (lesson.id === 'course-skips') return { id: 'white-key-skip', label: 'Переход через клавишу',
    speech: 'Между До и Ми есть ещё одна белая — Ре. Сейчас покажу переход через неё, чтобы не искать следующую ноту наугад.' };
  return { id: lesson.moduleId === 'to-compositions' ? 'musical-pattern' : 'shared-pulse', label: 'Короткий музыкальный рисунок',
    speech: `Сначала послушай несколько настоящих нот этой фразы. Начинаем с ${firstName}; потом повторишь тот же рисунок в удобном темпе.` };
}

/** Voice is returned separately: the caller speaks first, then plays frames. */
export function createLessonIntro(lesson, { kind = 'course', hand = inferHand(lesson || {}), part = 1, whole = false, octave = 0,complete=false } = {}) {
  const connection=kind==='composition'&&lesson?.kind==='connection'&&Number.isInteger(lesson.fromPart)&&lesson.fromPart>=1&&Number.isInteger(lesson.toPart)&&lesson.toPart>=lesson.fromPart;
  if (!['course', 'composition'].includes(kind) || !Object.hasOwn(HAND_LABELS, hand) || ![-1, 0, 1].includes(octave) ||
      !whole && !connection && (!Number.isInteger(part) || part < 1)) throw new TypeError('Invalid lesson intro options.');
  const { frames: source, sourceTempo } = sourceFrames(lesson, hand, octave), groups = groupsFor(source);
  const concept = kind === 'course' ? courseConcept(lesson, source) : { id: whole ? 'whole-arrangement' : hand === 'both' ? 'shared-pulse' : 'composition-pattern',
    label: connection?`Соединяем фразы ${lesson.fromPart}–${lesson.toPart}`:whole ? 'Соединяем изученные участки' : `${HAND_LABELS[hand]} · участок ${part}` };
  let start = 0;
  if (kind === 'course' && concept.id === 'duration-pulse') start = Math.max(0, groups.findIndex(group => group.some(frame => frame.beats >= 2)) - 1);
  if (kind === 'course' && concept.id === 'black-key') start = Math.max(0, groups.findIndex(group => group.some(frame => BLACK.has(frame.midi % 12))) - 1);
  if (concept.id === 'alternating-hands') start = Math.max(0, groups.findIndex((group, index) => index && group[0].hand !== groups[index - 1][0].hand) - 1);
  if (kind === 'composition' && hand === 'both') start = Math.max(0, groups.findIndex(group => new Set(group.map(frame => frame.hand)).size > 1));
  const chosen = complete?groups.slice(0,12):groups.slice(start, start + (lesson.id === 'course-do' || lesson.id === 'course-do-re' ? 2 : whole ? 4 : 3));
  const gaps = chosen.slice(1).map((group, index) => group[0].time - chosen[index][0].time).filter(gap => gap > GROUP_WINDOW);
  const smallest = gaps.length ? Math.min(...gaps) : Math.min(...chosen.flat().map(frame => frame.duration));
  const firstTime = chosen[0][0].time,span=Math.max(...chosen.flat().map(f=>f.time+f.duration))-firstTime;
  const demoScale = Math.min(Math.max(1, Math.min(4, .65 / smallest)),19/span);
  const frames = chosen.flatMap((group, groupIndex) => group.map(frame => ({ ...frame, group: groupIndex,
    time: (frame.time - firstTime) * demoScale, duration: frame.duration * demoScale })));
  const names = frames.slice(0, 3).map(frame => spokenName(frame.midi)).join(', ');
  const present = new Set(source.map(frame => frame.hand));
  let spoken = concept.speech;
  if (kind === 'composition') spoken = whole ? 'Теперь соедини всю учебную аранжировку. Начни спокойно, сохраняя общий счёт. Покажу короткий пример, затем сыграешь сам.' :
    connection ? `Соедини знакомые фразы ${lesson.fromPart}–${lesson.toPart}. Не останавливай общий счёт между ними. Покажу начало, затем сыграешь весь участок.` :
    hand === 'right' ? `Сначала этот участок правой рукой: ${names}. Посмотри на ноты и клавиши в показе, затем повторишь сам.` :
    hand === 'left' ? `Теперь тот же участок левой рукой: ${names}. Правая пока отдыхает. Сначала короткий показ, затем твоя очередь.` :
    present.size < 2 ? `Здесь играет только ${present.has('left') ? 'левая' : 'правая'} рука; другая отдыхает. Сохраним общий счёт и повторим знакомые звуки.` :
    'Соедини знакомый участок обеими руками. У них общий счёт: ноты на одной вертикали нажимай вместе. Сначала покажу.';
  if (spoken.length > 150) spoken = `${HAND_LABELS[hand]}. Сначала покажу ${names}; затем повторишь эти звуки сам. Дорожка подождёт нужную клавишу.`;
  return { title: String(lesson.title || 'Короткий показ').slice(0, 120), subtitle: concept.label, spoken,
    frames, concept: concept.id, showNotation: kind !== 'course' || !['course-do', 'course-do-re'].includes(lesson.id),
    beats: frames.map(frame => frame.beats), clef: hand === 'both' ? 'grand' : hand === 'left' ? 'bass' : 'treble',
    hand, demoScale, tempo: sourceTempo / demoScale, duration: Math.max(...frames.map(frame => frame.time + frame.duration)) };
}

/** Teach staff landmarks without playing the unseen assessment's answer. */
export function createNotationGuide(lesson,{octave=0}={}){
  if(typeof lesson?.notationGuide!=='string'||!lesson.notationGuide.trim())return null;
  const plan=createLessonIntro({id:'staff-landmarks-guide',title:'Ориентиры на нотном стане',practiceKind:'landmarks',
    introSpeech:lesson.notationGuide.slice(0,150),tempo:48,hand:'Правая рука',
    notes:[60,62,64,65].map(midi=>({midi,beats:1}))},{kind:'course',hand:'right',octave,complete:true});
  return {...plan,subtitle:'Линия, промежуток и клавиша',concept:'staff-landmarks',showNotation:true};
}
