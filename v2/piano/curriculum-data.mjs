const lesson = (id, title, instruction, pitches, { skillIds, prerequisites = [], kind = 'notes', hand = 'Правая рука',
  beats = [], rests = [], tempo = 56, tip = 'Сначала послушай короткий показ. Затем повтори без спешки; после ошибки разбираем маленькое место.',
  readiness = 'Сыграй короткий рисунок самостоятельно, затем вернись к нему в другой день.', ...extra } = {}) => ({
  id: `course-${id}`, title, description: instruction.split('. ')[0] + '.', instruction, tip, readiness,
  introSpeech: instruction.split('. ')[0].length <= 130 ? instruction.split('. ')[0] + '. Сначала покажу.' :
    instruction.slice(0,instruction.lastIndexOf(' ',125)) + '. Сначала покажу.',
  hand, skillIds, prerequisites, practiceKind: kind, tempo, type: ['echo', 'recall', 'reading'].includes(kind) ? 'phrase' : 'drill',
  author: 'Практический курс Flow', level: 'С нуля', hintPolicy: { target: !['recall', 'reading', 'echo'].includes(kind), names: kind !== 'reading', preview: kind !== 'reading' },
  notes: pitches.map((midi, index) => ({ midi, beats: beats[index] ?? 1, hand: hand === 'Левая рука' ? 'left' : 'right',
    ...(rests[index] > 0 ? { restBefore: rests[index] } : {}) })), ...extra,
});
const grouped = (id, title, instruction, groups, { skillIds, prerequisites, beats = [], hand = 'Обе руки', rests = [], ...extra } = {}) => ({
  ...lesson(id, title, instruction, [], { skillIds, prerequisites, hand, kind: 'coordination', type: 'phrase', ...extra }),
  polyphonic: true, requiresMidiForAssessment: true,
  notes: groups.flatMap((pitches, group) => pitches.map((midi, index) => ({ midi, group, beats: beats[group] ?? 1,
    hand: hand === 'Левая рука' ? 'left' : hand === 'Правая рука' ? 'right' : index === 0 ? 'left' : 'right',
    ...(index === 0 && rests[group] > 0 ? { restBefore: rests[group] } : {}) }))),
  evaluation: 'Совместные высоты и вступления. Через микрофон — тренировка без независимого зачёта; точная проверка с MIDI. Пальцы и удержание не оцениваются.',
});

// New IDs keep all earlier exercise/report signatures intact. The traditional
// three-note tune is entered here directly, without importing a modern score.
export const INTRODUCTORY_LESSONS = [
  lesson('first-key', 'Первая клавиша — До', 'Найди пару чёрных клавиш ближе к середине Casio. До — белая сразу слева от пары. Сравни с примером и сыграй пять отдельных До без спешки.', [60,60,60,60,60],
    { skillIds: ['keyboard-landmarks'], tempo: 40, learningRoute: 'guided-check', optionalFlow: true,
      introSpeech: 'До — белая клавиша слева от двух чёрных. Сначала покажу пять отдельных нажатий.',
      tip: 'Отпускай клавишу между нажатиями. Сейчас можно искать и исправляться: музыка подождёт.',
      readiness: 'Найди До самостоятельно. Совпадение ритма пока не требуется.' }),
  lesson('first-melody', 'Первая мелодия · Hot Cross Buns', 'Большой палец правой руки положи на До, указательный — на Ре, средний — на Ми. Сыграй начало знакомой песенки: Ми–Ре–До, затем ещё раз Ми–Ре–До. Послушай окончание каждой тройки.', [64,62,60,64,62,60],
    { skillIds: ['keyboard-landmarks'], tempo: 44, beats: [1,1,2,1,1,2], learningRoute: 'guided-check', optionalFlow: true,
      type: 'phrase', author: 'Английская народная мелодия · учебный фрагмент Flow',
      introSpeech: 'Три соседние клавиши: До, Ре и Ми. Послушай песенку Ми–Ре–До и повтори её два раза.',
      tip: 'Каждую тройку начинай средним пальцем на Ми. Пальцы приложение не видит; следи за удобством руки сам.',
      readiness: 'Сыграй шесть звуков самостоятельно. Проверку точного ритма можно попробовать отдельно.' }),
];

const pulse = [
  lesson('pulse-even', 'Найди ровный пульс', 'Слушай четыре счёта. Играй одну До на каждый следующий счёт, не догоняя пропущенную ноту.', Array(8).fill(60),
    { skillIds: ['pulse'], prerequisites: ['keyboard-landmarks'], kind: 'rhythm', readiness: 'Восемь ровных вступлений на одной клавише без подсказки высоты.' }),
  lesson('pulse-two-counts', 'Один звук — два счёта', 'До держится два счёта, Ре — один. Считай вслух и не нажимай длинную До повторно на втором счёте.', [60,62,64,60,62,64,62,60],
    { skillIds: ['note-lengths'], prerequisites: ['pulse'], kind: 'rhythm', beats: [2,1,1,2,1,1,2,2], tip: 'Приложение проверяет момент нового нажатия. Продолжительность удержания проверь по показу сам.' }),
  lesson('pulse-long-short', 'Короткий и длинный ответ', 'Повтори рисунок с длинными окончаниями. Продолжай внутренний счёт, пока звучит длинная нота.', [60,62,64,64,62,60,62,60],
    { skillIds: ['note-lengths'], prerequisites: ['pulse'], kind: 'rhythm', beats: [1,1,2,1,1,2,1,2] }),
  lesson('pulse-one-rest', 'На паузе тоже считаем', 'После двух До пропусти один счёт в тишине. Не останавливай внутренний пульс: следующая До вступит после паузы.', Array(8).fill(60),
    { skillIds: ['rests'], prerequisites: ['note-lengths'], kind: 'rhythm', rests: [0,0,1,0,1,0,1,0] }),
  lesson('pulse-silence', 'Тишина между репликами', 'Сыграй До–Ре–Ми, посчитай один пустой счёт и ответь Ми–Ре–До. Во второй части пауза длится два счёта.', [60,62,64,64,62,60,62,60],
    { skillIds: ['rests'], prerequisites: ['note-lengths'], kind: 'rhythm', rests: [0,0,0,1,0,0,2,0], beats: [1,1,2,1,1,2,1,2] }),
  lesson('pulse-paired-eighths', 'Два звука на один счёт', 'Между соседними счётами сыграй две одинаковые До: раз-и, два-и. Начни медленно и отпускай клавишу между ударами.', Array(12).fill(60),
    { skillIds: ['eighths'], prerequisites: ['rests'], kind: 'rhythm', tempo: 48, beats: Array(12).fill(.5) }),
  lesson('pulse-mixed-values', 'Шаги и короткие пары', 'Сначала два обычных шага, затем короткая пара До–Ре внутри одного счёта. Сравни рисунок на слух и повтори.', [60,62,60,62,64,62,60,62,64,60],
    { skillIds: ['eighths'], prerequisites: ['rests'], kind: 'rhythm', tempo: 48, beats: [1,1,.5,.5,2,1,.5,.5,1,2] }),
  lesson('pulse-eighth-check', 'Ритм без дорожки высот', 'Повтори знакомый ритм на одной До: длинные звуки, короткие пары и пустой счёт. На паузе не нажимай ничего.', Array(10).fill(60),
    { skillIds: ['eighths', 'rests'], prerequisites: ['rests'], kind: 'rhythm', tempo: 48, beats: [1,.5,.5,2,1,.5,.5,1,1,2], rests: [0,0,0,0,1,0,0,0,1,0] }),
];
const listening = [
  lesson('ear-up', 'Услышь движение вверх', 'Послушай три звука До–Ре–Ми. После показа экран скроет ответ: найди ту же последовательность на синтезаторе.', [60,62,64],
    { skillIds: ['ear-copy'], prerequisites: ['keyboard-landmarks'], kind: 'echo' }),
  lesson('ear-down', 'Услышь движение вниз', 'Послушай три звука Ми–Ре–До. Найди первую Ми, затем повтори направление без подсказки следующей клавиши.', [64,62,60],
    { skillIds: ['ear-copy'], prerequisites: ['keyboard-landmarks'], kind: 'echo' }),
  lesson('ear-answer', 'Короткое эхо', 'Послушай До–Ми–Ре–До, затем повтори четыре звука по памяти. Если забыл, послушаем ещё раз и начнём новую попытку.', [60,64,62,60],
    { skillIds: ['ear-copy'], prerequisites: ['keyboard-landmarks'], kind: 'echo' }),
  lesson('memory-four', 'Запомни четыре звука', 'Посмотри и послушай Соль–Ми–Ре–До. После показа ноты исчезнут. Сыграй короткую фразу, не подглядывая.', [67,64,62,60],
    { skillIds: ['memory-short'], prerequisites: ['right-five'], kind: 'recall' }),
  lesson('memory-repeat', 'Повтор внутри памяти', 'Запомни До–До–Ми–Ре–До. Две первые До — два отдельных нажатия, даже когда экран не показывает следующую ноту.', [60,60,64,62,60],
    { skillIds: ['memory-short'], prerequisites: ['right-five'], kind: 'recall' }),
  lesson('memory-six', 'Две короткие мысли', 'Послушай До–Ми–Соль и Фа–Ре–До. Запомни две тройки вместо шести названий; затем сыграй без изображения нот.', [60,64,67,65,62,60],
    { skillIds: ['memory-short'], prerequisites: ['right-five'], kind: 'recall' }),
  lesson('read-three-unseen', 'Прочитай новый рисунок', 'Сначала спокойно посмотри на нотный стан. Здесь только До, Ре и Ми. Сыграй новый рисунок без показа и названий над нотами.', [60,64,62,62,60,64,62,60],
    { skillIds: ['treble-reading'], prerequisites: ['right-five'], kind: 'reading' }),
  lesson('read-five-unseen', 'Прочитай в пяти нотах', 'Перед игрой найди первую ноту на стане и посмотри, куда идёт мелодия. Играют только знакомые До–Соль, названия скрыты.', [64,65,67,64,62,65,64,60],
    { skillIds: ['treble-reading'], prerequisites: ['right-five'], kind: 'reading' }),
];
const together = [
  grouped('coord-together-c', 'Две До вступают вместе', 'Подготовь левую До ниже и правую До выше. На каждом счёте нажми обе одновременно, затем отпусти перед следующим вступлением.', Array.from({ length: 6 }, () => [48,60]),
    { skillIds: ['both-pulse'], prerequisites: ['hand-changes','pulse'], tempo: 48 }),
  grouped('coord-move-right', 'Левая опора, правая движется', 'Левая каждый раз находит нижнюю До. Правая играет До–Ре–Ми–Ре. Ноты на одной вертикали начинают вместе.', [[48,60],[48,62],[48,64],[48,62],[48,60],[48,64],[48,62],[48,60]],
    { skillIds: ['both-pulse'], prerequisites: ['hand-changes','pulse'], tempo: 48 }),
  grouped('coord-move-left', 'Правая опора, левая движется', 'Правая повторяет верхнюю До, левая идёт До–Ре–Ми–Ре ниже. Сначала найди каждую пару, затем соедини их в общий пульс.', [[48,60],[50,60],[52,60],[50,60],[48,60],[52,60],[50,60],[48,60]],
    { skillIds: ['both-pulse'], prerequisites: ['hand-changes','pulse'], tempo: 48 }),
  lesson('coord-bass-read', 'Читаем нижнюю партию', 'Басовый ключ отмечает Фа на второй линейке сверху. Найди нижние До–Ре–Ми по стану и сыграй левой рукой без подписей.', [48,50,52,50,48,52,50,48],
    { skillIds: ['bass-reading'], prerequisites: ['left-five'], kind: 'reading', hand: 'Левая рука', tempo: 52 }),
  grouped('coord-common-rest', 'Общая пауза двух рук', 'Обе руки отвечают парами. Между репликами посчитай один пустой счёт; следующая пара вступает вместе после тишины.', [[48,60],[48,62],[52,64],[48,60],[50,62],[52,64]],
    { skillIds: ['both-pulse','rests'], prerequisites: ['hand-changes','rests'], tempo: 48, rests: [0,0,0,1,0,1] }),
  grouped('coord-opposite', 'Встречное движение', 'Правая идёт вверх До–Ре–Ми, левая вниз Соль–Фа–Ми. Не растягивай руки: у каждой свой участок из пяти белых.', [[55,60],[53,62],[52,64],[53,62],[55,60],[53,62],[52,64],[55,60]],
    { skillIds: ['both-pulse'], prerequisites: ['hand-changes','pulse'], tempo: 48 }),
  grouped('coord-long-answer', 'Длинное совместное окончание', 'Сыграй пары нот в общем счёте. Последнюю пару каждой реплики держи два счёта; приложение проверит вступление, удержание проверь сам.', [[48,60],[50,62],[52,64],[48,60],[53,65],[52,64],[50,62],[48,60]],
    { skillIds: ['both-pulse','note-lengths'], prerequisites: ['hand-changes','note-lengths'], tempo: 48, beats: [1,1,2,2,1,1,1,2] }),
  grouped('coord-checkpoint', 'Маленькая пьеса двумя руками', 'Соедини восемь знакомых пар: сначала отдельно каждая рука, затем вместе. Сохраняй общий счёт и закончи спокойно.', [[48,60],[48,64],[55,67],[53,65],[52,64],[50,62],[55,62],[48,60]],
    { skillIds: ['both-pulse'], prerequisites: ['hand-changes','pulse'], tempo: 48, beats: [1,1,2,1,1,1,1,2] }),
];
const accompaniment = [
  lesson('accomp-bass-home', 'Басовые опоры До и Соль', 'Найди нижнюю До слева от двух чёрных и Соль справа в том же участке. Сыграй их по очереди левой рукой, не растягивая кисть.', [48,55,48,55,48,55,55,48],
    { skillIds: ['bass-pattern'], prerequisites: ['left-five','pulse'], hand: 'Левая рука', tempo: 52 }),
  lesson('accomp-bass-shape', 'Бас с возвращением', 'Левая играет До–Ми–Соль–Ми и возвращается на До. Узнай знакомый рисунок ниже по клавиатуре и повтори его без показа.', [48,52,55,52,48,52,55,48],
    { skillIds: ['bass-pattern'], prerequisites: ['left-five','pulse'], hand: 'Левая рука', tempo: 52, position: 'Левая в До–Соль: мизинец на До, средний на Ми, большой на Соль.' }),
  grouped('accomp-open-fifth', 'Два басовых звука вместе', 'Нижние До и Соль можно сыграть одновременно левой рукой. Подготовь их заранее; нажимай легко и освобождай руку между повторами.', Array.from({ length: 6 }, () => [48,55]),
    { skillIds: ['chord-shapes'], prerequisites: ['bass-pattern'], hand: 'Левая рука', tempo: 48 }),
  grouped('accomp-major-shape', 'Первое созвучие До', 'Правая собирает До–Ми–Соль одновременно. Можно поставить пальцы 1–3–5. Сначала найди все три клавиши, затем нажми вместе.', Array.from({ length: 6 }, () => [60,64,67]),
    { skillIds: ['chord-shapes'], prerequisites: ['right-five'], hand: 'Правая рука', tempo: 48, position: 'Правая: большой на До, средний на Ми, мизинец на Соль.' }),
  grouped('accomp-minor-shape', 'Сравни два настроения', 'Послушай созвучия До–Ми–Соль и Ля–До–Ми. Найди второе положение заранее, затем спокойно чередуй их без спешки.', [[60,64,67],[57,60,64],[60,64,67],[57,60,64]],
    { skillIds: ['chord-shapes'], prerequisites: ['right-five'], hand: 'Правая рука', tempo: 48, beats: [2,2,2,2] }),
  grouped('accomp-changes', 'Созвучие и возвращение', 'Найди До–Ми–Соль, затем Соль–Си–Ре ниже. Переноси руку целиком и вернись к первому созвучию. Здесь важнее удобное положение, чем скорость.', [[60,64,67],[55,59,62],[60,64,67],[55,59,62],[60,64,67]],
    { skillIds: ['chord-shapes'], prerequisites: ['right-five'], hand: 'Правая рука', tempo: 48, beats: [2,2,2,2,2] }),
  grouped('accomp-bass-melody', 'Бас поддерживает мелодию', 'Левая находит нижние опоры, правая играет короткую мелодию выше. Разбери каждую партию отдельно и соедини их на общем счёте.', [[48,64],[48,65],[55,67],[55,65],[48,64],[50,62],[55,62],[48,60]],
    { skillIds: ['song-building'], prerequisites: ['both-pulse','bass-pattern'], tempo: 48, beats: [1,1,2,1,1,1,1,2] }),
  grouped('accomp-miniature', 'Моя первая аранжировка', 'Левая играет одну басовую опору, правая — два звука вместе. Соедини знакомые положения; затем попробуй сыграть целиком без подсказки клавиш.', [[48,60,64],[53,60,65],[55,59,62],[48,60,64]],
    { skillIds: ['song-building'], prerequisites: ['both-pulse','bass-pattern','chord-shapes'], tempo: 48, beats: [2,2,2,2] }),
];

export const PRACTICAL_MODULES = [
  { id: 'pulse-and-space', title: 'Пульс, тишина и короткие пары', description: 'Держим счёт на знакомых клавишах.', lessons: pulse },
  { id: 'listen-and-remember', title: 'Слушаю, запоминаю, читаю', description: 'Убираем подсказки и пробуем новый рисунок.', lessons: listening },
  { id: 'hands-together', title: 'Две руки в одном пульсе', description: 'Совместные вступления вместо угадывания рук.', lessons: together },
  { id: 'simple-accompaniment', title: 'Бас, созвучия и моя музыка', description: 'Собираем короткую аранжировку из понятных движений.', lessons: accompaniment },
].map(({ lessons, ...module }) => ({ ...module, lessonIds: lessons.map(item => item.id) }));
export const PRACTICAL_LESSONS = [...pulse, ...listening, ...together, ...accompaniment];

export const CURRICULUM_SKILLS = [
  ['keyboard-landmarks','Нахожу первые клавиши',[],['course-do-re-mi']],
  ['pulse','Сохраняю ровный пульс',['keyboard-landmarks'],['course-pulse-even']],
  ['note-lengths','Различаю один и два счёта',['pulse'],['course-pulse-long-short']],
  ['rests','Продолжаю счёт в тишине',['note-lengths'],['course-pulse-silence']],
  ['eighths','Два звука на один счёт',['rests'],['course-pulse-eighth-check']],
  ['right-five','Играю пять нот правой',['keyboard-landmarks'],['course-five-checkpoint']],
  ['ear-copy','Повторяю короткое эхо',['keyboard-landmarks'],['course-ear-answer']],
  ['memory-short','Вспоминаю короткую фразу',['right-five'],['course-memory-six']],
  ['treble-reading','Читаю простой новый рисунок',['right-five'],['course-read-three-unseen']],
  ['phrase-shape','Соединяю музыкальные реплики',['right-five','note-lengths'],['course-long-phrase']],
  ['left-five','Играю знакомые ноты левой',['right-five'],['course-left-checkpoint']],
  ['bass-reading','Читаю нижнюю партию',['left-five'],['course-coord-bass-read']],
  ['hand-changes','Передаю мелодию между руками',['left-five'],['course-hands-checkpoint']],
  ['both-pulse','Соединяю руки на общем счёте',['hand-changes','pulse'],['course-coord-checkpoint']],
  ['position-shift','Нахожу новое положение руки',['right-five'],['course-range-checkpoint']],
  ['black-keys','Нахожу соседние чёрные клавиши',['position-shift'],['course-black-checkpoint']],
  ['bass-pattern','Узнаю басовый рисунок',['left-five','pulse'],['course-accomp-bass-shape']],
  ['chord-shapes','Собираю простые созвучия',['right-five'],['course-accomp-changes']],
  ['song-building','Собираю свою аранжировку',['both-pulse','bass-pattern','chord-shapes'],['course-accomp-miniature']],
].map(([id,title,prerequisites,checkpointIds]) => ({ id, title, prerequisites, checkpointIds }));

export const CURRICULUM_MODULE_SKILLS = { orientation: 'keyboard-landmarks', 'five-notes': 'right-five', phrases: 'phrase-shape',
  'left-hand': 'left-five', 'hands-dialogue': 'hand-changes', 'keyboard-range': 'position-shift', 'black-keys': 'black-keys', 'to-compositions': 'song-building' };
