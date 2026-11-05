import { PracticeSession } from './session.mjs?v=0b58b5803e6f';
import { INTRODUCTORY_LESSONS, MUSICAL_LESSONS, MUSICAL_MODULE, PRACTICAL_LESSONS, PRACTICAL_MODULES, CURRICULUM_SKILLS, CURRICULUM_MODULE_SKILLS } from './curriculum-data.mjs?v=0b58b5803e6f';

export const MASTERY_METRIC = 'first-attempt-v1';
export const COURSE_PROGRESS_VERSION = 1;

const drill = (id, title, description, instruction, tip, pitches, extra = {}) => ({
  id, title, description, instruction, tip, type: 'drill', hand: 'Правая рука',
  author: 'Практический курс Flow', level: 'С нуля', minutes: '5–10 минут',
  notes: pitches.map((midi, index) => ({ midi, beats: extra.durations?.[index] ?? (extra.type === 'phrase' && index % 8 === 7 ? 2 : 1) })), ...extra,
});

// Preserve the IDs and note content of the first prototype's ten exercises.
// Expanded below into a practical path; scoring measures notes, not technique.
const FOUNDATION_LESSONS = [
  drill('course-do', 'Найди До', 'Одна клавиша, с которой начинается первая музыка.',
    'Найди пару чёрных клавиш. До — белая клавиша сразу слева от этой пары. Сравни её с примером и сыграй десять раз.',
    'Между повторами отпускай клавишу. Если До звучит выше или ниже примера, смени октаву в настройках.',
    [60,60,60,60,60,60,60,60,60,60]),
  drill('course-do-re', 'До и Ре', 'Две соседние белые клавиши и маленький мотив.',
    'Найди До. Ре — следующая белая клавиша справа. Послушай пример, затем сыграй последовательность без спешки.',
    'Не двигай всю руку после каждой ноты: обе клавиши находятся рядом.',
    [60,62,60,62,62,60,62,60,60,62]),
  drill('course-do-re-mi', 'Добавляем Ми', 'Три ноты, из которых уже складываются фразы.',
    'Ми — белая клавиша справа от пары чёрных. Теперь чередуй До, Ре и Ми по дорожке.',
    'Сначала найди три клавиши на синтезаторе. Можно прослушать каждую на экране до начала прохода.',
    [60,62,64,62,60,64,62,64,60,62]),
  drill('course-five', 'Пять знакомых нот', 'Поднимись по пяти клавишам и вернись назад.',
    'После Ми идут Фа и Соль. Сыграй До–Ре–Ми–Фа–Соль, затем вернись к До.',
    'Для правой руки можно поставить большой палец на До, а мизинец на Соль. Приложение проверяет ноты, а не пальцы.',
    [60,62,64,65,67,65,64,62,60,60]),
  drill('course-repeats', 'Повтори и смени ноту', 'Одинаковые ноты тоже требуют нового нажатия.',
    'Сыграй ноту два раза, отпуская клавишу между повторами. Затем переходи на соседнюю.',
    'Не удерживай педаль. Два нажатия должны быть отдельными звуками.',
    [60,60,62,62,64,64,65,65,67,67]),
  drill('course-steps', 'Маленькие шаги', 'Короткая фраза с движением вверх и вниз.',
    'Послушай весь пример. Найди первую ноту и сыграй фразу по одной ноте; дорожка будет ждать.',
    'Когда фраза получится, попробуй запомнить первые три ноты и посмотреть на свою руку.',
    [64,62,60,62,64,65,64,62,60,60]),
  drill('course-reach', 'Чуть дальше по клавиатуре', 'Доберись до Ля, Си и следующей До.',
    'Справа от Соль идут Ля, Си и новая До. Спокойно перенеси руку, когда привычных пяти клавиш уже не хватает.',
    'Соседние До звучат похоже, но одна выше другой. Сначала прослушай новую До на экране.',
    [67,69,71,72,71,69,67,65,64,60]),
  drill('course-left', 'Попробуй левой рукой', 'Те же знакомые клавиши, другая рука.',
    'Сыграй знакомую фразу левой рукой на тех же клавишах. Начни медленно; скорость сейчас не оценивается.',
    'Можно положить мизинец левой руки на До, а большой палец на Соль. Выбор пальцев проверь сам.',
    [60,64,67,64,60,62,65,62,60,60], { hand: 'Левая рука' }),
  drill('course-alternate', 'Руки по очереди', 'Одна рука отвечает другой, без одновременных звуков.',
    'Первые пять нот сыграй правой рукой, следующие пять — левой на тех же клавишах. Одновременно играет только одна рука.',
    'Смена руки — самостоятельная проверка. Микрофон слышит ноту и не определяет, какой рукой она сыграна.',
    [60,62,64,65,67,67,65,64,62,60], { type: 'phrase', hand: 'Руки по очереди' }),
  drill('course-phrase', 'Твоя первая целая фраза', 'Соедини знакомые движения в одну маленькую мелодию.',
    'Сначала послушай пример. Сыграй всю фразу спокойно, а после исполнения преподаватель разберёт результат.',
    'Это проверка найденных нот. Ритм, длительности и игра двумя руками одновременно пока не оцениваются.',
    [60,64,67,65,64,62,60,62,64,60], { type: 'phrase' }),
];

const MORE_LESSONS = [
  drill('course-fa', 'Находим Фа', 'Ещё одна клавиша — и уже четыре ноты под рукой.',
    'Найди три чёрные клавиши. Фа — белая сразу слева от этой тройки. Сыграй Ми–Фа, затем До–Ре–Ми–Фа и обратно.',
    'Между Ми и Фа нет чёрной клавиши. Ищи Фа по группе из трёх чёрных, а не считай от края синтезатора.',
    [64,65,64,65,60,62,64,65,65,64,62,60]),
  drill('course-first-answer', 'Первая музыкальная реплика', 'Четыре знакомые клавиши складываются в начало и ответ.',
    'Послушай две короткие части. В первой мелодия поднимается, во второй возвращается домой к До. Разучи каждую с подсказками, затем сыграй целиком.',
    'Не ускоряйся на знакомых нотах. После последней До спокойно отпусти клавишу и послушай, как закончилась фраза.',
    [60,62,64,65,64,62,60,60,62,64,65,64,62,60,60,60], { type: 'phrase' }),

  drill('course-skips', 'Через одну клавишу', 'Находим Ми и Соль без перебора соседних нот.',
    'Поставь правую руку над До–Ре–Ми–Фа–Соль. Сыграй До–Ми–Соль, затем Соль–Ми–До. Между звучащими клавишами иногда остаётся одна белая.',
    'Сначала посмотри на место назначения. Не нажимай промежуточную клавишу, если её нет в дорожке.',
    [60,64,67,64,60,64,67,67,65,62,65,62,60,64,62,60]),
  drill('course-five-checkpoint', 'Миниатюра в пяти нотах', 'Первая мелодия с шагами, повторами и небольшими скачками.',
    'Послушай мелодию целиком. Разучи первые восемь нот, затем вторые восемь. После этого пройди проверку без подсветки нужной клавиши.',
    'Если трудно, вернись к уроку «Через одну клавишу». Для зачёта нужна оценка от 8 из 10 за весь проход, а не восемь отдельных нот.',
    [60,64,67,67,65,64,62,60,62,65,64,62,60,64,62,60], { type: 'phrase' }),

  drill('course-question', 'Музыкальный вопрос', 'Запоминаем короткий рисунок, который не заканчивается на До.',
    'Послушай первую часть: До–Ре–Ми–Соль. Повтори её, затем сыграй окончание на Ре. Сейчас важнее узнавать рисунок, чем называть каждую ноту вслух.',
    'Повтори первые четыре ноты несколько раз до проверки. Длинная нота в примере даёт место вдохнуть, но длительность приложение пока не оценивает.',
    [60,62,64,67,64,62,64,62,60,62,64,67,65,64,62,62], { durations: [1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,2] }),
  drill('course-answer', 'Музыкальный ответ', 'Возвращаем мелодию к устойчивой последней ноте.',
    'Начни с Соль, спустись к Ми и закончи на До. Сравни звучание этого окончания с прошлым уроком. Найди места, где движение меняет направление.',
    'Перед началом найди Соль на своём инструменте. После ошибки возвращайся к той же ожидаемой ноте, вся мелодия не начинается заново.',
    [67,65,64,62,64,62,60,60,65,64,62,64,62,60,60,60]),
  drill('course-memory', 'Маленькая мелодия по памяти', 'Два знакомых рисунка соединяются без подсказки клавиши.',
    'Сначала разучи начало До–Ми–Соль–Ми, затем ответ Фа–Ми–Ре–До. Послушай обе части вместе и только после этого переходи к проверке.',
    'Смотри на клавиатуру синтезатора, когда переносишь пальцы. Экран нужен для места в мелодии, а не для постоянного поиска каждой клавиши.',
    [60,64,67,64,65,64,62,60,62,64,65,62,64,62,60,60]),
  drill('course-long-phrase', 'Из двух фраз — целая мелодия', 'Держим в голове начало, середину и возвращение.',
    'В примере три части по восемь нот. Первая поднимается, вторая отвечает, третья возвращает знакомое начало. Разучи части отдельно, затем собери проход.',
    'Не пытайся запомнить двадцать четыре названия. Запоминай направление и опорные До, Ми и Соль.',
    [60,62,64,67,65,64,62,60,64,65,67,65,64,62,64,62,60,64,67,64,65,64,62,60], { type: 'phrase' }),

  drill('course-left-neighbours', 'Левая: соседние клавиши', 'Уверенно находим знакомые пять нот другой рукой.',
    'Поставь левую руку над теми же До–Ре–Ми–Фа–Соль. Можно расположить мизинец на До, большой палец на Соль. Сыграй вниз и вверх по соседним клавишам.',
    'Клавиши не поменяли названия. Номера пальцев и положение руки приложение не определяет; следи, чтобы плечо и кисть не напрягались.',
    [67,65,64,62,60,62,64,65,67,65,64,62,60,62,64,60], { hand: 'Левая рука' }),
  drill('course-left-repeats', 'Левая: два отдельных звука', 'Учимся отпускать клавишу и заново нажимать её.',
    'Сыграй по два отдельных нажатия на До, Ми и Соль левой рукой, затем спустись по соседним клавишам. Между повторами звук должен успеть отделиться.',
    'Выключи SUSTAIN на Casio. Не нужно ударять сильнее: для повтора важно новое нажатие после отпускания.',
    [60,60,64,64,67,67,65,64,62,62,60,60,64,62,60,60], { hand: 'Левая рука' }),
  drill('course-left-broken', 'Левая: три опорные ноты', 'Основа будущего сопровождения — по одному звуку.',
    'Найди До, Ми и Соль. Сыграй их по очереди снизу вверх и обратно. Потом найди Ре, Фа и Ля и попробуй такой же рисунок на новом месте.',
    'Ля — белая между второй и третьей из трёх чёрных клавиш. Звуки играются по очереди: это не одновременный аккорд. Находи новое положение спокойно.',
    [60,64,67,64,60,64,67,60,62,65,69,65,62,65,69,62], { hand: 'Левая рука' }),
  drill('course-left-checkpoint', 'Левая играет мелодию', 'Не только упражнения: законченная фраза для левой руки.',
    'Послушай мелодию, найди начальную Соль и сыграй всё левой рукой. Разучи первую и вторую половины отдельно, затем сделай самостоятельный проход.',
    'Не помогай правой рукой в проверке этого урока. Приложение не может проверить выбор руки — это твоя собственная часть задания.',
    [67,64,60,62,64,65,64,62,60,64,67,65,64,62,60,60], { hand: 'Левая рука', type: 'phrase' }),

  drill('course-hand-question', 'Правая спрашивает, левая отвечает', 'Переключаем руки в конце короткой музыкальной реплики.',
    'Первую половину из восьми нот сыграй правой рукой. На следующих восьми нотах передай мелодию левой. Обе руки используют те же знакомые клавиши.',
    'Перед началом обе руки могут лежать на коленях. На смене спокойно освободи клавиши; одновременно звучать ничего не должно.',
    [60,62,64,67,65,64,62,62,67,65,64,62,64,62,60,60], { hand: 'Руки по очереди' }),
  drill('course-low-answer', 'Низкий ответ', 'Левая и правая получают собственные участки клавиатуры.',
    'Первые восемь нот — правая на знакомой До и соседях. Ответ сыграй левой на До на октаву ниже: найди следующую пару чёрных слева и белую перед ней.',
    'Нижняя До звучит ниже, хотя называется так же. Сначала прослушай и найди обе начальные До до включения микрофона.',
    [60,62,64,67,65,64,62,60,48,50,52,55,53,52,50,48], { hand: 'Руки по очереди' }),
  drill('course-dialogue', 'Диалог через две ноты', 'Более частая смена рук без одновременной игры.',
    'Чередуй короткие пары: две ноты справа, затем две ниже слева. Начальные До у рук находятся в соседних октавах. Послушай, какая пара отвечает какой.',
    'Удобнее подготовить каждую руку над её пятью клавишами заранее. Это упражнение на чередование; одновременную игру пока не оцениваем.',
    [60,64,48,52,62,65,50,53,64,67,52,55,62,60,50,48], { hand: 'Руки по очереди' }),
  drill('course-hands-checkpoint', 'Две руки, одна история', 'Собираем мелодический разговор из четырёх реплик.',
    'Сыграй по шесть нот правой, левой, правой и снова левой. Каждая рука остаётся в своей пятинотной позиции. Сначала разбери реплики, затем соедини их.',
    'Если теряется место смены рук, вернись в разучивание и слушай пример частями. Оценка проверяет найденные высоты, а не координацию по изображению рук.',
    [60,62,64,67,64,60,48,50,52,55,52,48,62,64,65,67,65,62,50,52,53,55,52,48], { hand: 'Руки по очереди', type: 'phrase' }),

  drill('course-octave-home', 'Две До — два ориентира', 'Находим тот же рисунок клавиш в соседней октаве.',
    'Найди две соседние группы из двух чёрных клавиш. До перед первой группой и До перед следующей похожи по звучанию, но вторая выше. Сыграй короткий рисунок внизу, затем наверху.',
    'Переноси всю руку на новое место вместо растягивания пальцев на октаву. Сравни начальную ноту с примером.',
    [60,62,64,60,72,74,76,72,60,64,62,60,72,76,74,72]),
  drill('course-upper-position', 'Мелодия от Соль', 'Новая позиция руки без счёта от До.',
    'Найди Соль между первой и второй из трёх чёрных клавиш. Подготовь рядом Ля, Си, До и Ре. Теперь знакомые движения звучат в другом участке.',
    'Не возвращайся к нижней До после каждой ноты. Первая Соль становится новым ориентиром на этот проход.',
    [67,69,71,72,74,72,71,69,67,71,74,71,72,71,69,67]),
  drill('course-position-change', 'Перенеси руку и продолжай', 'Две позиции в одной фразе.',
    'Сыграй первые восемь нот около До. Затем спокойно перенеси руку, чтобы продолжить от Соль. В разучивании дорожка дождётся переноса.',
    'Посмотри, где лежит следующая начальная Соль, ещё до старта. Не пытайся достать все ноты из неподвижной позиции.',
    [60,62,64,65,67,65,64,60,67,69,71,72,74,72,71,67]),
  drill('course-range-checkpoint', 'Мелодия шире ладони', 'Две октавы и знакомое возвращение домой.',
    'Послушай три части: начало около До, продолжение выше и возвращение. Разучи места переноса руки отдельно, затем сыграй весь путь.',
    'Перенос руки не должен превращаться в спешку. В этой версии скорость не влияет на оценку — сначала найди каждую ноту.',
    [60,64,67,69,67,65,64,60,67,71,74,76,74,72,71,67,72,71,69,67,65,64,62,60], { type: 'phrase' }),

  drill('course-first-black', 'Первая чёрная клавиша', 'До♯ — соседняя ступень между До и Ре.',
    'Найди До и Ре. Чёрная клавиша между ними — До-диез, на дорожке До♯. Попробуй До–До♯–Ре и обратно, затем включи этот переход в маленький рисунок.',
    'Диез означает соседнюю клавишу справа, даже если она чёрная. Сейчас учим один конкретный звук, все знаки запоминать не нужно.',
    [60,61,62,61,60,61,62,64,62,61,60,62,61,60,60,60]),
  drill('course-semitone', 'Самые близкие соседи', 'Ми–Фа на белых и Ми–Ре♯ на белой и чёрной.',
    'Найди Ми справа от пары чёрных клавиш. Справа соседняя белая Фа, слева — чёрная Ре-диез. Послушай и сравни два очень маленьких шага.',
    'Ре♯ — чёрная справа от Ре. Не путай её с обычной Ре: на экране знак ♯ остаётся частью названия нужной ноты.',
    [64,65,64,63,64,65,64,63,64,63,64,62,63,64,63,64]),
  drill('course-minor-colour', 'Другая окраска мелодии', 'Меняем одну ноту и слышим разницу.',
    'Сначала послушай рисунок До–Ми–Соль–Ми. Затем похожий До–Ми-бемоль–Соль–Ми-бемоль. Ми-бемоль — та же чёрная клавиша, которую здесь обозначаем Ре♯.',
    'Одна клавиша может иметь два названия в разных мелодиях. В этом упражнении ориентируйся по Ре♯ на дорожке и по звучанию примера.',
    [60,64,67,64,60,64,67,60,60,63,67,63,60,63,67,60]),
  drill('course-black-turn', 'Белая — чёрная — белая', 'Чёрная клавиша внутри обычной музыкальной фразы.',
    'Разучи поворот Ми–Ре♯–Ми, затем добавь Соль и Ре. Не останавливайся из-за цвета клавиши: это ещё одна нота той же мелодии.',
    'Потренируй три первые ноты отдельно до полного прохода. Клавиша чёрная, но нажимать её сильнее не нужно.',
    [64,63,64,67,64,62,60,62,64,63,64,67,65,64,62,60]),
  drill('course-black-checkpoint', 'Фраза с новым оттенком', 'Соединяем чёрные клавиши, шаги и скачки.',
    'Послушай мелодию целиком. Найди обе чёрные клавиши До♯ и Ре♯ заранее. Разбери две половины по восемь нот, затем пройди проверку.',
    'Если ошибаешься в одном повороте, повтори именно его в разучивании. Цель — оценка не ниже 8/10 за весь самостоятельный проход.',
    [60,61,62,64,63,64,67,64,62,61,60,62,63,64,62,60], { type: 'phrase' }),

  drill('course-elise-neighbours', 'Соседи для «К Элизе»', 'Поворот Ми–Ре♯ в верхнем участке клавиатуры.',
    'Найди высокую Ми и чёрную Ре♯ слева от неё. Сравни высоту с примером. Сыграй чередование спокойно, каждый раз отпуская клавишу.',
    'Это подготовка к узнаваемому началу Бетховена. Не учи всю пьесу сразу: сначала уверенно находи две соседние клавиши.',
    [76,75,76,75,76,75,76,75,76,75,76,76]),
  drill('course-elise-landing', 'От Ми к Си', 'После соседних клавиш — перенос к опорной ноте.',
    'После высокой Ми найди Си ниже неё, затем Ре и До между ними. Послушай, как мелодия спускается. Сыграй рисунок и вернись к начальной Ми.',
    'Си находится справа от тройки чёрных. Сначала найди все четыре клавиши без микрофона, чтобы перенос не был неожиданным.',
    [76,71,74,72,71,69,71,72,74,71,76,74,72,71,69,69]),
  drill('course-broken-accompaniment', 'Сопровождение по одному звуку', 'Левая готовит мягкую опору для будущей пьесы.',
    'Левой рукой найди низкие Ля, До и Ми. Сыграй их по очереди. Во второй части — Ми, Соль-диез и Си: Соль♯ — чёрная между Соль и Ля. Сначала прослушай каждую тройку на экране.',
    'Пока разучиваем сопровождение отдельно. Низкая Ля — белая между второй и третьей из трёх чёрных. Соединение с одновременной мелодией потребует другого режима проверки.',
    [57,60,64,60,57,60,64,57,52,56,59,56,52,56,59,52], { hand: 'Левая рука' }),
  drill('course-musical-arc', 'Большая фраза с возвращением', 'Тридцать две ноты: часть за частью, затем целиком.',
    'В этой мелодии четыре коротких части. Сначала послушай пример и разбери каждую по восемь нот. После этого сыграй целиком без подсветки нужной клавиши.',
    'Можно остановиться между попытками. Если устаёшь, лучше вернуться позже, чем много раз проходить фразу наугад.',
    [60,64,67,69,67,65,64,60,62,65,69,71,69,67,65,62,64,63,64,67,72,71,69,67,65,64,62,64,62,60,60,60], { type: 'phrase' }),
  drill('course-composition-ready', 'От упражнений — к пьесе', 'Самостоятельная мелодия со сменой позиции и чёрной клавишей.',
    'Сначала найди высокие Ми и Ре♯, затем Си, Ре, До и Ля ниже. Разучи первый поворот, среднюю часть и окончание. После проверки открой «Композиции» и начни «К Элизе» с короткой фразы.',
    'Освоение этого прохода не означает, что вся пьеса уже выучена. Дальше нужны фразы настоящей композиции, отдельная левая рука и постепенное соединение.',
    [76,75,76,75,76,71,74,72,69,72,76,72,71,74,76,74,72,71,69,71,72,74,71,69], { type: 'phrase' }),
];

// Method references describe course paths and section practice, not these exercises.
// The lesson text and patterns above are our own; Beethoven preparation uses his
// public-domain melodic vocabulary. This is a first-stage solo-note course.
export const COURSE_METHOD_SOURCES = [
  { title: 'Simply Piano: Soloist and Chords', url: 'https://piano-help.hellosimply.com/en/articles/2791299-soloist-and-chords-choosing-a-course-path' },
  { title: 'Simply Piano: Best Practice Tips', url: 'https://piano-help.hellosimply.com/en/articles/2791126-best-practice-tips' },
  { title: 'Simply / JoyTunes: courses, song library and practice mode', url: 'https://partners.hellosimply.com/faq' },
];

const LEGACY_COURSE_MODULES = [
  { id: 'orientation', title: 'Ориентиры на клавиатуре', description: 'Найди первые клавиши и сыграй музыкальный ответ.',
    lessonIds: ['course-first-key','course-first-melody','course-do','course-do-re','course-do-re-mi','course-fa','course-first-answer'] },
  { id: 'five-notes', title: 'Пять нот — много музыки', description: 'Шаги, повторы и скачки в удобной позиции руки.',
    lessonIds: ['course-five','course-repeats','course-steps','course-skips','course-five-checkpoint'] },
  { id: 'phrases', title: 'От рисунка к мелодии', description: 'Разучивай небольшими частями и соединяй в целое.',
    lessonIds: ['course-question','course-answer','course-memory','course-long-phrase','course-phrase'] },
  { id: 'left-hand', title: 'Левая тоже играет', description: 'Знакомые клавиши, новые движения и отдельная мелодия.',
    lessonIds: ['course-left','course-left-neighbours','course-left-repeats','course-left-broken','course-left-checkpoint'] },
  { id: 'hands-dialogue', title: 'Руки отвечают друг другу', description: 'Чередуй руки и подготовь каждой свой участок.',
    lessonIds: ['course-alternate','course-hand-question','course-low-answer','course-dialogue','course-hands-checkpoint'] },
  { id: 'keyboard-range', title: 'Больше клавиатуры', description: 'Новые позиции, перенос руки и соседние октавы.',
    lessonIds: ['course-reach','course-octave-home','course-upper-position','course-position-change','course-range-checkpoint'] },
  { id: 'black-keys', title: 'Чёрные клавиши в музыке', description: 'Несколько новых звуков через знакомые мелодические движения.',
    lessonIds: ['course-first-black','course-semitone','course-minor-colour','course-black-turn','course-black-checkpoint'] },
  { id: 'to-compositions', title: 'Готовимся к «К Элизе»', description: 'Освой характерный поворот, перенос и отдельное сопровождение.',
    lessonIds: ['course-elise-neighbours','course-elise-landing','course-broken-accompaniment','course-musical-arc','course-composition-ready'] },
];

const curriculumModules = new Map([...LEGACY_COURSE_MODULES, MUSICAL_MODULE, ...PRACTICAL_MODULES].map(module => [module.id, module]));
export const COURSE_MODULES = ['orientation','first-music','pulse-and-space','five-notes','listen-and-remember','phrases','left-hand',
  'hands-dialogue','hands-together','keyboard-range','black-keys','simple-accompaniment','to-compositions'].map(id => curriculumModules.get(id));
const byId = new Map([...INTRODUCTORY_LESSONS, ...MUSICAL_LESSONS, ...FOUNDATION_LESSONS, ...MORE_LESSONS, ...PRACTICAL_LESSONS].map(lesson => [lesson.id, lesson]));
export const COURSE = COURSE_MODULES.flatMap((module, moduleIndex) => module.lessonIds.map((id, lessonIndex) => {
  const lesson = byId.get(id);
  if (!lesson) throw new Error(`Missing course lesson: ${id}`);
  const skillIds = lesson.skillIds || [CURRICULUM_MODULE_SKILLS[module.id]];
  const prerequisites = lesson.prerequisites || CURRICULUM_SKILLS.find(skill => skill.id === skillIds[0])?.prerequisites || [];
  return { ...lesson, moduleId: module.id, moduleTitle: module.title,
    moduleDescription: module.description, moduleIndex, lessonIndex,
    skillIds: [...skillIds], prerequisites: [...prerequisites], practiceKind: lesson.practiceKind || 'notes',
    readiness: lesson.readiness || 'Сыграй фразу без подсказки клавиши. Чтобы проверить, что она запомнилась, повтори её в другой день.',
    hintPolicy: lesson.hintPolicy || { target: true, names: true, preview: true },
    objective: lesson.description, minutes: lesson.type === 'phrase' ? '5–10' : '3–7',
    steps: [lesson.instruction, lesson.tip, 'Разучи с подсказками, затем пройди проверку. Для освоения нужна оценка от 8/10 за самостоятельный проход.'],
    evaluation: lesson.evaluation || (lesson.practiceKind === 'rhythm' ? 'В режиме «В темпе» оцениваются высоты и вступления; удержание, пальцы и выбор руки не оцениваются.' : 'Высоты нот; аппликатура, удержание и выбор руки не оцениваются.'),
  };
})).map((lesson, index, lessons) => ({ ...lesson, nextId: lessons[index + 1]?.id ?? null }));

export class MasterySession extends PracticeSession {
  constructor(notes, now = 0) {
    if (!Array.isArray(notes) || !notes.length || notes.some(n => !n || !Number.isInteger(n.midi) || n.midi < 0 || n.midi > 127 || !Number.isFinite(n.beats) || n.beats <= 0)) {
      throw new TypeError('MasterySession needs valid notes with positive durations.');
    }
    super(notes, now);
    this.targetOutcomes = notes.map(() => null);
    this.assisted = false;
  }

  get firstAttemptCorrect() { return this.targetOutcomes.filter(outcome => outcome === 1).length; }
  get scoreOutOf10() { return Math.floor(this.firstAttemptCorrect * 100 / this.notes.length) / 10; }
  get passed() { return this.finished && this.firstAttemptCorrect * 10 >= this.notes.length * 8; }

  play(midi, now) {
    if (this.finished || this.paused || !Number.isInteger(midi) || midi < 0 || midi > 127) return { kind: 'ignored' };
    const targetIndex = this.index;
    const firstAttempt = this.targetOutcomes[targetIndex] === null;
    if (firstAttempt) this.targetOutcomes[targetIndex] = midi === this.expected ? 1 : 0;
    return { ...super.play(midi, now), targetIndex, firstAttempt, targetOutcome: this.targetOutcomes[targetIndex] };
  }

  skip(now) {
    if (this.finished || this.paused) return { kind: 'ignored' };
    const targetIndex = this.index;
    this.targetOutcomes[targetIndex] = 0;
    return { ...super.skip(now), targetIndex, firstAttempt: false, targetOutcome: 0 };
  }

  markAssisted() {
    if (!this.finished) this.assisted = true;
    if (!this.finished && this.targetOutcomes[this.index] === null) this.targetOutcomes[this.index] = 0;
  }

  report(now) {
    return { ...super.report(now), metric: MASTERY_METRIC,
      firstAttemptCorrect: this.firstAttemptCorrect, scoreOutOf10: this.scoreOutOf10,
      passed: this.passed, assisted: this.assisted, targetOutcomes: [...this.targetOutcomes] };
  }
}

const integer = (value, max = 1000000) => Number.isInteger(value) && value >= 0 && value <= max ? value : 0;
const score = value => Number.isFinite(value) && value >= 0 && value <= 10 ? value : 0;
const timestamp = value => Number.isFinite(value) && value >= 0 && value <= 8640000000000000 ? value : 0;
const emptyStatus = () => ({ attempts: 0, bestScore: 0, lastScore: 0, passed: false,
  failedStreak: 0, needsBreakdown: false, lastAt: 0 });

export function normalizeCourseProgress(value) {
  const progress = { version: COURSE_PROGRESS_VERSION, metric: MASTERY_METRIC, lessons: {} };
  if (!value || value.version !== COURSE_PROGRESS_VERSION || value.metric !== MASTERY_METRIC || !value.lessons || typeof value.lessons !== 'object') return progress;
  for (const lesson of COURSE) {
    const entry = value.lessons[lesson.id];
    if (!entry || typeof entry !== 'object') continue;
    const attempts = integer(entry.attempts), bestScore = score(entry.bestScore);
    const failedStreak = Math.min(attempts, integer(entry.failedStreak));
    progress.lessons[lesson.id] = { attempts, bestScore, lastScore: score(entry.lastScore),
      passed: entry.passed === true && attempts > 0 && bestScore >= 8,
      failedStreak, needsBreakdown: failedStreak >= 3, lastAt: timestamp(entry.lastAt) };
  }
  return progress;
}

export function courseLessonStatus(progress, id) {
  return normalizeCourseProgress(progress).lessons[id] ?? emptyStatus();
}

export function recommendedCourseLesson(progress) {
  const normalized = normalizeCourseProgress(progress);
  return COURSE.find(lesson => !normalized.lessons[lesson.id]?.passed) ?? COURSE.at(-1);
}

export function recordCourseAttempt(progress, id, report, { demo = false, at = Date.now() } = {}) {
  const normalized = normalizeCourseProgress(progress);
  const lesson = COURSE.find(item => item.id === id);
  if (demo || !lesson || !report?.finished || report.metric !== MASTERY_METRIC || report.total !== lesson.notes.length ||
      !Array.isArray(report.targetOutcomes) || report.targetOutcomes.length !== report.total ||
      report.targetOutcomes.some(outcome => outcome !== 0 && outcome !== 1)) return normalized;
  const correct = report.targetOutcomes.reduce((sum, outcome) => sum + outcome, 0);
  if (correct !== report.firstAttemptCorrect) return normalized;
  const result = Math.floor(correct * 100 / report.total) / 10;
  const passed = correct * 10 >= report.total * 8;
  const previous = normalized.lessons[id] ?? emptyStatus();
  const failedStreak = passed ? 0 : previous.failedStreak + 1;
  normalized.lessons[id] = { attempts: Math.min(previous.attempts + 1, 1000000),
    bestScore: Math.max(previous.bestScore, result), lastScore: result,
    passed: previous.passed || passed, failedStreak, needsBreakdown: failedStreak >= 3,
    lastAt: timestamp(at) };
  return normalized;
}
