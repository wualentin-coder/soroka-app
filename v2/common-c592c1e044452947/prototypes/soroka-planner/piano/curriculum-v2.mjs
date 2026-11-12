/** Original short musical material. Legacy course IDs and results are not aliases. */
export const CURRICULUM_V2_VERSION = 'musical-actions-v2';

const POSITIONS = {
  rightC: {hand:'right',keys:[60,62,64,65,67]},
  rightHighC: {hand:'right',keys:[72,74,76,77,79]},
  leftC: {hand:'left',keys:[67,65,64,62,60]},
  leftLowC: {hand:'left',keys:[55,53,52,50,48]},
};
const copy=value=>structuredClone(value);
const handLabel=hand=>hand==='left'?'Левая рука':hand==='both'?'Обе руки':hand==='alternate'?'Руки по очереди':'Правая рука';
const byPitch=(midi,hand)=>hand==='left'?(midi<60?'leftLowC':'leftC'):(midi>=72?'rightHighC':'rightC');

// Each event is [MIDI, start beat, length in beats, hand, position?, rest before?].
// Explicit seconds retain a held bass underneath later right-hand attacks.
function score(events,tempo){
  const ordered=events.map((event,index)=>({event,index})).sort((a,b)=>a.event[1]-b.event[1]||a.index-b.index);
  let group=-1,previous=-1;
  return ordered.map(({event:[midi,at,beats,hand='right',positionId=byPitch(midi,hand),restBefore=0]})=>{
    if(at!==previous){group++;previous=at;}
    const position=POSITIONS[positionId],finger=position.keys.indexOf(midi)+1;
    if(!finger||position.hand!==hand)throw new Error('Musical event is outside its suggested hand position.');
    return {midi,beats,time:at*60/tempo,duration:beats*60/tempo,group,hand,finger,positionId,
      fingerProvenance:'suggested',...(restBefore?{restBefore}:{})};
  });
}
function line(pitches,{beats=[],rests=[],hand='right',hands=[],positions=[]}={}){
  let at=0;
  return pitches.map((midi,index)=>{
    const rest=rests[index]||0;at+=rest;
    const event=[midi,at,beats[index]||1,hands[index]||hand,positions[index]||byPitch(midi,hands[index]||hand),rest];
    at+=event[2];return event;
  });
}
const motif=(pitches,beats=[],rest=[],extra={})=>line(pitches,{beats,rests:rest,...extra});
const together=(pairs,beats=[],rests=[])=>{
  let at=0;
  return pairs.flatMap((pair,index)=>{
    at+=rests[index]||0;
    const events=pair.map((midi,member)=>[midi,at,beats[index]||1,member===0?'left':'right',undefined,member===0?rests[index]||0:0]);
    at+=beats[index]||1;return events;
  });
};

const MODULE_ROWS = [
  ['first-answers','Первые музыкальные ответы','Две клавиши превращаются в маленькую законченную фразу.'],
  ['pulse-and-air','Музыка дышит','Ровный шаг, длинный звук и настоящая пауза.'],
  ['hear-and-answer','Слышу и отвечаю','Короткие ответы на слух; пример всегда можно включить снова.'],
  ['five-key-stories','Истории в пяти клавишах','Новые Фа и Соль появляются внутри мелодий.'],
  ['left-voice','Голос левой руки','Левая находит собственную мелодию и низкую опору.'],
  ['moving-and-dialogue','Перенос и разговор','Руки отвечают друг другу; перенос происходит в паузе.'],
  ['playing-together','Первые созвучия','Два звука вместе, затем мелодия над редким басом.'],
  ['my-first-piece','Моя первая пьеса','Четыре знакомые фразы соединяются в восьмитактовую пьесу «Домой».'],
];

// Text, preparation and contrasting material are authored per lesson. None is a
// quota of repeated attacks; suggested fingering is not a measurement or expert sign-off.
const rows = [
  {id:'hello',title:'Поздоровайся двумя звуками',module:0,skill:'keyboard-landmarks',tempo:48,
    goal:'Найди До и Ре и сыграй маленькое приветствие с возвращением к До.',
    prepare:'До — белая слева от пары чёрных. Ре — белая между ними. Найди обе и сыграй До–Ре.',
    intro:'До — слева от двух чёрных, Ре — между ними. Сначала послушай приветствие, потом ответишь.',
    events:motif([60,62,60],[1,1,2]),prep:motif([60,62]),contrast:motif([62,60],[1,2]),
    contrastText:'Теперь начни с Ре и ответь на До. Услышь, как последний звук завершает реплику.',
    result:'Сыграй До–Ре–До без подсветки нужной клавиши; названия можно оставить.',
    mistake:'Если звук выше примера, ищи пару чёрных ближе к середине, а не у края клавиатуры.'},
  {id:'two-knocks',title:'Два стука и ответ',module:0,skill:'keyboard-landmarks',tempo:48,
    goal:'Отдели два повторных Ре и закончи ответ на До.',prepare:'Найди знакомые До и Ре. Сыграй Ре–До, каждый раз спокойно отпуская клавишу.',
    intro:'Два Ре — два отдельных звука. Отпусти клавишу между ними; в конце вернёмся к До.',
    events:motif([60,62,62,60],[1,1,1,2]),prep:motif([62,60]),contrast:motif([62,62,60],[1,1,1]),
    contrastText:'Послушай два коротких Ре и одно До. Повтори этот ответ без лишнего удара в конце.',
    result:'Сыграй всю реплику: До, два отдельных Ре, До.',mistake:'Удержание Ре не заменяет второе нажатие. Педаль пока отпущена.'},
  {id:'third-voice',title:'В приветствии появилась Ми',module:0,skill:'right-five',needs:['keyboard-landmarks'],tempo:48,
    goal:'Пройди от До к Ми и вернись по соседним клавишам.',prepare:'Ми — белая справа от пары чёрных. Большой палец можно поставить на До, средний — на Ми.',
    intro:'Добавим Ми — белую справа от двух чёрных. Мелодия поднимется и вернётся по тем же ступенькам.',
    events:motif([60,62,64,62,60],[1,1,1,1,2]),prep:motif([62,64]),contrast:motif([64,62,60],[1,1,1]),
    contrastText:'Начни сразу с Ми и спустись к До. Это обратная половина будущей фразы.',
    result:'Самостоятельно соедини подъём к Ми и спуск к До.',mistake:'Не нажимай две клавиши одним движением: здесь звуки идут по одному.'},
  {id:'little-home',title:'Маленькая история',module:0,skill:'phrase-shape',needs:['right-five'],tempo:48,
    goal:'Сыграй короткую фразу со скачком До–Ми и спокойным окончанием.',prepare:'Найди До и Ми, между ними остаётся Ре. Сначала сравни эти два звука.',
    intro:'Начнём с До, перепрыгнем через Ре к Ми и вернёмся домой. Послушай законченную историю.',
    events:motif([60,64,62,60],[1,1,1,3]),prep:motif([60,64]),contrast:motif([64,60,62],[1,2,1]),
    contrastText:'В другом ответе Ми сразу приходит к До, а затем появляется Ре. Заметь новое окончание.',
    result:'Сыграй свою первую целую фразу До–Ми–Ре–До.',mistake:'При переходе к Ми не добавляй промежуточную Ре.'},
  {id:'long-last-note',title:'Дай окончанию прозвучать',module:1,skill:'note-lengths',needs:['right-five'],tempo:48,kind:'rhythm',
    goal:'Соедини два коротких шага и два более длинных звука.',prepare:'Послушай До–Ми: первый звук на один счёт, второй на два. Считай ровно, не ускоряясь.',
    intro:'Короткий звук занимает один счёт, длинный — два. Сначала послушай, где мелодия задерживается.',
    events:motif([60,62,64,60],[1,1,2,2]),prep:motif([60,64],[1,2]),contrast:motif([60,64,62],[2,1,1]),
    contrastText:'Теперь длинный звук стоит в начале. Сохрани тот же ровный счёт после него.',
    result:'Сыграй всю фразу в спокойном темпе, оставив длинным звукам два счёта.',mistake:'Длинный звук не означает медленнее считать. Проверка слышит вступления, не отпускание.'},
  {id:'leave-space',title:'Оставь место тишине',module:1,skill:'rests',needs:['note-lengths'],tempo:48,kind:'rhythm',
    goal:'Пропусти один счёт перед Ми и продолжи фразу после тишины.',prepare:'Сыграй Ре, один счёт помолчи, затем Ми. В паузе клавиши отпущены, счёт продолжается.',
    intro:'Перед Ми будет один тихий счёт. Не заполняй его звуком; мелодия продолжится после паузы.',
    events:motif([60,62,64,60],[1,1,1,2],[0,0,1,0]),prep:motif([62,64],[1,1],[0,1]),contrast:motif([64,62,60],[1,1,1],[0,1,0]),
    contrastText:'В ответе пауза появилась перед Ре. Послушай новое место тишины и повтори.',
    result:'Сыграй целиком, вступив на Ми после одного тихого счёта.',mistake:'Не добавляй ещё одно Ре в паузе. Удержание и тишину оценивай также на слух.'},
  {id:'knock-and-hold',title:'Постучи и протяни',module:1,skill:'pulse',needs:['rests'],tempo:48,kind:'rhythm',
    goal:'Отдели два коротких Ми от длинного спуска к До.',prepare:'Два раза сыграй Ми отдельными нажатиями, затем длинное Ре на два счёта.',
    intro:'В начале два коротких Ми, затем длинные Ре и До. Счёт ровный, характер звуков меняется.',
    events:motif([64,64,62,60],[1,1,2,2]),prep:motif([64,64,62],[1,1,2]),contrast:motif([62,64,64],[2,1,1]),
    contrastText:'Поменяем порядок: сначала длинное Ре, затем два коротких Ми. Сохрани общий шаг.',
    result:'Сыграй два коротких Ми и законченный длинный ответ Ре–До.',mistake:'Повтор Ми требует отпустить клавишу; усиливать удар не нужно.'},
  {id:'two-bar-walk',title:'Прогулка на восемь счётов',module:1,skill:'phrase-shape',needs:['pulse'],tempo:48,kind:'rhythm',
    goal:'Пройди двухтактовую мелодию, не останавливая общий счёт.',prepare:'Сначала сыграй последние Ре–До–Ре. Это короткий поворот перед окончанием.',
    intro:'Две маленькие части живут на одном ровном счёте. В первой задержимся на Ми, вторая вернёт нас к До.',
    events:motif([60,62,64,62,60,62,60],[1,1,2,1,1,1,1]),prep:motif([62,60,62]),contrast:motif([64,62,60],[2,1,1]),
    contrastText:'Сравни длинную Ми и два коротких шага вниз. Это спокойный мост между частями.',
    result:'Соедини все восемь счётов одним проходом.',mistake:'На границе частей не начинай считать быстрее. После ошибки можно повторить весь короткий проход.'},
  {id:'hear-two',title:'Услышь ответ из двух нот',module:2,skill:'ear-copy',needs:['keyboard-landmarks'],tempo:48,kind:'echo',
    goal:'Сравни два знакомых звука и повтори услышанный ответ Ре–До.',prepare:'Сначала послушай одно Ре и найди его. Потом услышишь весь короткий ответ.',
    intro:'Ответ состоит всего из двух нот. Пример можно слушать столько, сколько нужно; угадывать не требуется.',
    events:motif([62,60],[1,2]),prep:motif([62]),contrast:motif([60,62],[2,1]),
    contrastText:'Другой ответ заканчивается выше. Послушай До–Ре и сравни направление с первым.',
    result:'Ещё раз послушай исходный ответ и сыграй его. Подсказку всегда можно вернуть.',mistake:'Если забыл начало, включи пример ещё раз. Это не проверка памяти.'},
  {id:'hear-three',title:'Три звука на слух',module:2,skill:'ear-copy',needs:['ear-copy','right-five'],tempo:48,kind:'echo',
    goal:'Повтори рисунок из трёх звуков: вверх через клавишу, затем немного вниз.',prepare:'Послушай опоры До и Ми; проверь их на клавиатуре перед целым ответом.',
    intro:'В трёх звуках сначала прыжок вверх, потом шаг вниз. Послушай и повтори; пример остаётся доступным.',
    events:motif([60,64,62],[1,1,2]),prep:motif([60,64]),contrast:motif([60,62,64],[1,2,1]),
    contrastText:'Сравни с тремя ступеньками вверх. Слышишь, что здесь нет прыжка?',
    result:'Повтори первоначальный трёхзвучный ответ после прослушивания.',mistake:'Не превращай прыжок До–Ми в три подряд идущие клавиши.'},
  {id:'hear-down',title:'Услышь спуск домой',module:2,skill:'ear-copy',needs:['ear-copy'],tempo:48,kind:'echo',
    goal:'Узнай и повтори короткое движение от Ми вниз к До.',prepare:'Послушай Ми–Ре и найди две соседние клавиши, от которых начнётся спуск.',
    intro:'На этот раз мелодия только спускается. Найди первую Ми, послушай весь ответ и повтори.',
    events:motif([64,62,60],[1,1,2]),prep:motif([64,62]),contrast:motif([60,62,64],[1,1,2]),
    contrastText:'А теперь послушай противоположное движение — вверх. Сравни, куда пришёл последний звук.',
    result:'Повтори услышанный спуск Ми–Ре–До без подсветки нужной клавиши.',mistake:'Высоко и низко — про звук, а не про положение руки на экране.'},
  {id:'hear-home',title:'Услышь начало и окончание',module:2,skill:'ear-copy',needs:['ear-copy','phrase-shape'],tempo:48,kind:'echo',
    goal:'Повтори четырёхзвучную реплику, которая возвращается к начальной До.',prepare:'Послушай До–Ре–Ми. Это знакомое начало; последний звук затем вернёт мелодию к До.',
    intro:'Услышь начало из трёх ступенек и возвращение к До. Четыре звука; повторный показ всегда рядом.',
    events:motif([60,62,64,60],[1,1,1,2]),prep:motif([60,62,64]),contrast:motif([64,62,60,62],[1,1,1,2]),
    contrastText:'Другой ответ заканчивается на Ре. Сравни открытое окончание с возвращением к До.',
    result:'Послушай исходную реплику и сыграй все четыре звука одним ответом.',mistake:'Не нужно запоминать названия вслух. Слушай направление и конечный звук.'},
  {id:'meet-fa',title:'Фа внутри мелодии',module:3,skill:'right-five',needs:['right-five'],tempo:48,
    goal:'Найди новую Фа в коротком повороте Ми–Фа–Ми.',prepare:'Фа — белая слева от трёх чёрных, рядом с Ми. Сначала сыграй Ми–Фа.',
    intro:'Ми и Фа стоят рядом, между ними нет чёрной. Новый звук сразу появится в маленьком повороте.',
    events:motif([64,65,64,62,60],[1,1,1,1,3]),prep:motif([64,65]),contrast:motif([65,64,65],[1,2,1]),
    contrastText:'Поверни в другую сторону: Фа–Ми–Фа. Подготовь безымянный палец, не сдвигая всю руку.',
    result:'Сыграй поворот и закончи спуск на До.',mistake:'Ищи Фа по группе трёх чёрных, не считай клавиши от края.'},
  {id:'meet-sol',title:'До, Ми и звонкая Соль',module:3,skill:'right-five',needs:['right-five'],tempo:48,
    goal:'Соедини До–Ми–Соль и вернись к Ми без промежуточных клавиш.',prepare:'Соль — белая между первой и второй из трёх чёрных. Сравни Ми и Соль.',
    intro:'До, Ми и Соль лежат через одну белую клавишу. Из них получится звонкий короткий мотив.',
    events:motif([60,64,67,64],[1,1,2,2]),prep:motif([64,67]),contrast:motif([67,64,60],[1,1,2]),
    contrastText:'Спустись по тем же опорам Соль–Ми–До, пропуская промежуточные клавиши.',
    result:'Сыграй звонкий мотив, оставив Соль и последней Ми по два счёта.',mistake:'Не растягивай кисть: пять знакомых клавиш помещаются в свободной позиции.'},
  {id:'turn-at-top',title:'Поворот на вершине',module:3,skill:'phrase-shape',needs:['right-five','phrase-shape'],tempo:48,
    goal:'Поднимись через Фа к Соль и вернись вниз другой дорогой.',prepare:'Сначала сыграй Ми–Фа–Соль. Все три клавиши рядом под третьим, четвёртым и пятым пальцами.',
    intro:'Мелодия доберётся до Соль и повернёт назад. Послушай, как путь вниз отличается от подъёма.',
    events:motif([64,65,67,65,64,62,60],[1,1,2,1,1,1,1]),prep:motif([64,65,67]),contrast:motif([67,64,65,62],[1,1,1,1]),
    contrastText:'Попробуй другой спуск: Соль–Ми–Фа–Ре. Не добавляй соседние клавиши между скачками.',
    result:'Соедини подъём, длинную вершину и возвращение к До.',mistake:'После длинной Соль движение продолжается; не считай её двумя нажатиями.'},
  {id:'five-key-piece',title:'Пьеска в пяти клавишах',module:3,skill:'phrase-shape',needs:['right-five','rests'],tempo:48,
    goal:'Сыграй две связанные реплики с коротким вдохом между ними.',prepare:'Разбери место ответа Фа–Ми–Ре. Перед ним будет один тихий счёт.',
    intro:'Две реплики используют все пять знакомых клавиш. Между ними маленький вдох, в конце — возвращение к До.',
    events:motif([60,64,67,65,64,62,60],[1,1,2,1,1,1,2],[0,0,0,1,0,0,0]),prep:motif([65,64,62]),contrast:motif([62,65,64,60],[1,1,1,2]),
    contrastText:'Сравни новый ответ Ре–Фа–Ми–До. В нём сначала маленький скачок, затем спуск.',
    result:'Исполни обе реплики вместе, оставив место тишине.',mistake:'Пауза разделяет реплики, но не отменяет спокойный общий счёт.'},
  {id:'left-hello',title:'Левая здоровается',module:4,skill:'left-five',needs:['keyboard-landmarks'],hand:'left',tempo:48,
    goal:'Сыграй знакомое приветствие левой рукой на средних До и Ре.',prepare:'Левый мизинец можно поставить на До, безымянный на Ре. Сначала сыграй Ре–До.',
    intro:'Та же клавиатура, теперь отвечает левая рука. Начнём двумя знакомыми клавишами без спешки.',
    events:motif([60,62,60],[1,2,2],[],{hand:'left'}),prep:motif([62,60],[],[],{hand:'left'}),contrast:motif([60,62,62],[2,1,1],[],{hand:'left'}),
    contrastText:'В другом приветствии два отдельных Ре стоят в конце. Правая пока отдыхает.',
    result:'Сыграй левой полное приветствие До–Ре–До.',mistake:'Микрофон не знает, какой рукой ты играешь. Проверь выбор руки сам.'},
  {id:'left-song',title:'Левая поёт три ноты',module:4,skill:'left-five',needs:['left-five'],hand:'left',tempo:48,
    goal:'Сыграй левой мелодию Ми–Ре–До–Ми с длинным окончанием.',prepare:'Средний палец левой можно оставить на Ми. Сначала спустись от Ми к Ре.',
    intro:'Левая сыграет собственную мелодию из трёх нот. Сначала маленький спуск, потом возвращение к Ми.',
    events:motif([64,62,60,64],[1,1,2,2],[],{hand:'left'}),prep:motif([64,62],[],[],{hand:'left'}),contrast:motif([60,64,62],[1,1,2],[],{hand:'left'}),
    contrastText:'Начни с До, поднимись к Ми и остановись на Ре. Это другой ответ теми же клавишами.',
    result:'Сыграй левой всю мелодию и спокойно закончи на Ми.',mistake:'Не подменяй неудобный палец правой рукой; можно повторить медленнее.'},
  {id:'left-low-home',title:'У левой появился низкий дом',module:4,skill:'bass-pattern',needs:['left-five'],hand:'left',tempo:48,
    goal:'Найди До на октаву ниже и сыграй низкий ответ До–Ми–До.',prepare:'Найди следующую пару чёрных слева. Нижняя До — белая перед ней; затем найди нижнюю Ми.',
    intro:'Нижняя До называется так же, но звучит ниже. Сначала найдём её по соседней паре чёрных клавиш.',
    events:motif([48,52,48],[2,1,3],[],{hand:'left'}),prep:motif([48,52],[],[],{hand:'left'}),contrast:motif([52,50,48],[1,1,2],[],{hand:'left'}),
    contrastText:'В нижней позиции спустись Ми–Ре–До. Названия знакомые, место на клавиатуре новое.',
    result:'Сыграй низкий ответ левой рукой, сверив первую До с примером.',mistake:'Не тяни руку от средней До к нижней: сначала целиком перенеси свободную руку.'},
  {id:'left-three-pillars',title:'Три опоры сопровождения',module:4,skill:'bass-pattern',needs:['bass-pattern'],hand:'left',tempo:48,
    goal:'Соедини нижние До, Ми и Соль по одному звуку и вернись к До.',prepare:'В нижней позиции мизинец можно оставить на До, средний на Ми, большой на Соль. Сравни Ми–Соль.',
    intro:'Низкие До, Ми и Соль будут опорами будущей пьесы. Пока играем их по одному, без аккорда.',
    events:motif([48,52,55,52,48],[1,1,2,1,3],[],{hand:'left'}),prep:motif([52,55],[],[],{hand:'left'}),contrast:motif([55,48,52],[2,1,1],[],{hand:'left'}),
    contrastText:'Начни с нижней Соль, затем До и Ми. Заранее приготовь мизинец для перехода вниз.',
    result:'Сыграй подъём по трём опорам и вернись к низкой До.',mistake:'Это последовательные звуки. Одновременно три клавиши нажимать пока не нужно.'},
  {id:'hands-answer',title:'Одна рука зовёт, другая отвечает',module:5,skill:'hand-changes',needs:['right-five','bass-pattern'],hand:'alternate',tempo:48,
    goal:'Передай короткий ответ от правой руки к левой в нижней позиции.',prepare:'Подготовь правую над средней До, левую над нижней. Сравни две До по очереди.',
    intro:'Правая сыграет вопрос, затем левая ответит ниже. Между руками есть один тихий счёт.',
    events:motif([60,64,52,48],[1,2,1,2],[0,0,1,0],{hands:['right','right','left','left']}),
    prep:motif([60,48],[1,1],[],{hands:['right','left']}),contrast:motif([62,60,48,52],[1,1,1,2],[0,0,1,0],{hands:['right','right','left','left']}),
    contrastText:'Поменяй вопрос на Ре–До, ответ — До–Ми внизу. Одновременно играет только одна рука.',
    result:'Сыграй вопрос справа и ответ слева, сохранив паузу между ними.',mistake:'Левая готовится заранее; не нужно переносить правую руку к нижним нотам.'},
  {id:'right-octave-trip',title:'Перенеси приветствие выше',module:5,skill:'position-shifts',needs:['keyboard-landmarks','rests'],tempo:48,
    goal:'Сыграй До–Ре в среднем регистре и повтори этот жест на октаву выше.',prepare:'Найди среднюю и следующую До справа по двум соседним парам чёрных. Сыграй их по очереди.',
    intro:'Во время паузы отпусти руку и перенеси её к следующей До справа. Растягивать пальцы на октаву не нужно.',
    events:motif([60,62,72,74,72],[1,1,1,1,2],[0,0,2,0,0]),prep:motif([60,72],[1,1],[0,2]),contrast:motif([72,74,72],[1,2,1]),
    contrastText:'Сначала сыграй приветствие только в верхнем месте. Затем вернёмся к переносу целиком.',
    result:'Перенеси свободную руку в паузе и закончи приветствие наверху.',mistake:'Не держи нижнюю До во время переноса. Найди новую пару чёрных до следующего вступления.'},
  {id:'left-octave-answer',title:'Левая отвечает ниже',module:5,skill:'position-shifts',needs:['left-five','position-shifts'],hand:'left',tempo:48,
    goal:'Перенеси левую руку вниз в паузе между двумя короткими ответами.',prepare:'Сравни среднюю и нижнюю До левой рукой. На перенос есть два спокойных счёта.',
    intro:'Левая начнёт в среднем месте и ответит октавой ниже. Переносим всю свободную руку во время тишины.',
    events:motif([64,60,52,50,48],[1,1,1,1,2],[0,0,2,0,0],{hand:'left'}),prep:motif([60,48],[1,1],[0,2],{hand:'left'}),contrast:motif([48,52,50],[1,1,2],[],{hand:'left'}),
    contrastText:'В нижней позиции сыграй До–Ми–Ре. Проверь место большого пальца до начала.',
    result:'Соедини средний ответ и низкий спуск, подготовив новую позицию в паузе.',mistake:'После переноса снова найди нижнюю До по чёрным клавишам, а не на ощупь из растяжки.'},
  {id:'four-line-dialogue',title:'Разговор из четырёх реплик',module:5,skill:'hand-changes',needs:['hand-changes','phrase-shape'],hand:'alternate',tempo:48,
    goal:'Свяжи четыре короткие реплики рук в одну музыкальную историю.',prepare:'Сыграй место передачи Ми справа — Ми слева. Руки уже стоят каждая в своём месте.',
    intro:'Четыре маленькие реплики сменяют друг друга. Руки остаются на своих местах, музыка движется между ними.',
    events:motif([60,64,52,48,62,64,50,48],[1,1,1,2,1,1,1,2],[],{hands:['right','right','left','left','right','right','left','left']}),
    prep:motif([64,52],[1,1],[],{hands:['right','left']}),contrast:motif([62,60,55,52],[1,1,1,2],[],{hands:['right','right','left','left']}),
    contrastText:'Сыграй новый вопрос Ре–До и низкий ответ Соль–Ми. Услышь смену регистра.',
    result:'Сыграй весь разговор без остановки перед каждой сменой руки.',mistake:'Здесь руки ещё не звучат одновременно. Дай одной закончить, прежде чем вступит другая.'},
  {id:'together-greeting',title:'Две руки встречаются',module:6,skill:'both-pulse',needs:['hand-changes','pulse'],hand:'both',tempo:44,
    goal:'Соедини два звука вместе и затем разведи руки к разным окончаниям.',prepare:'Сначала сравни нижнюю До левой и среднюю До правой по очереди. Затем послушай их вместе.',
    intro:'Ноты на одной вертикали нажимаются вместе. Всего три спокойных созвучия, без спешки.',
    events:together([[48,60],[48,62],[48,60]],[2,2,4]),prep:motif([48,60],[1,1],[],{hands:['left','right']}),contrast:together([[48,64],[48,60]],[2,2]),
    contrastText:'С тем же нижним До правая сначала играет Ми, затем До. Это два разных созвучия.',
    result:'Сыграй три созвучия, начиная обеими руками одновременно.',mistake:'Для независимой проверки созвучий нужен MIDI; через микрофон можно спокойно разучивать.'},
  {id:'bass-stays-melody-walks',title:'Бас держится, мелодия идёт',module:6,skill:'both-pulse',needs:['both-pulse','note-lengths'],hand:'both',tempo:44,
    goal:'Оставь нижнюю До звучать, пока правая проходит До–Ре–Ми.',prepare:'Правой сыграй До–Ре, пока левая только лежит над своей нижней До. Затем послушай общий пример.',
    intro:'Левая нажмёт бас один раз. Пока он звучит, правая сыграет три знакомые ноты по очереди.',
    events:[[48,0,4,'left'],[60,0,1,'right'],[62,1,1,'right'],[64,2,2,'right']],
    prep:motif([60,62]),contrast:[[48,0,4,'left'],[64,0,2,'right'],[62,2,1,'right'],[60,3,1,'right']],
    contrastText:'Над тем же басом мелодия теперь спускается. Не нажимай бас заново с каждой верхней нотой.',
    result:'Начни вместе и проведи правую мелодию над одним басом.',mistake:'Удержание баса приложение не измеряет. Послушай и сам проверь, что левая не повторяет каждый шаг.'},
  {id:'two-bass-colours',title:'Две низкие краски',module:6,skill:'song-building',needs:['both-pulse','bass-pattern'],hand:'both',tempo:44,
    goal:'Смени низкую До на Соль на границе двух коротких музыкальных частей.',prepare:'Левой отдельно сыграй нижние До–Соль, правой заранее найди Ми и Ре.',
    intro:'В первой части бас До, во второй — Соль. Правая отвечает двумя звуками над каждой опорой.',
    events:[[48,0,4,'left'],[64,0,2,'right'],[60,2,2,'right'],[55,4,4,'left'],[62,4,2,'right'],[60,6,2,'right']],
    prep:motif([48,55],[2,2],[],{hand:'left'}),contrast:[[55,0,4,'left'],[62,0,2,'right'],[64,2,2,'right']],
    contrastText:'На басе Соль правая сыграет Ре–Ми. Приготовь новую низкую опору до начала.',
    result:'Сыграй обе части, сменив бас только на их границе.',mistake:'Не меняй обе руки одинаково: вторая низкая опора Соль, а верхняя начинает с Ре.'},
  {id:'together-breath',title:'Общий вдох перед ответом',module:6,skill:'song-building',needs:['song-building','rests'],hand:'both',tempo:44,
    goal:'Отпусти обе руки в общей паузе и начни короткий ответ вместе.',prepare:'Сыграй одно созвучие До, один счёт помолчи и снова приготовь обе руки.',
    intro:'В середине обе руки замолкают на один счёт. После вдоха они снова вступают вместе.',
    events:[[48,0,2,'left'],[60,0,1,'right'],[64,1,1,'right'],[55,3,2,'left',undefined,1],[62,3,1,'right'],[60,4,1,'right']],
    prep:together([[48,60],[48,62]],[1,1],[0,1]),contrast:together([[55,62],[48,60]],[1,2],[0,1]),
    contrastText:'Сравни короткий ответ Соль–Ре и возвращение к двум До после паузы.',
    result:'Исполни две части с общей тишиной и совместным вступлением после неё.',mistake:'Пауза общая: нижнюю ноту тоже отпусти. Это часть собственного слухового контроля.'},
];

// Eight original 4/4 bars, not an imported or edited commercial song.
const pieceMelody = [
  ...motif([60,62,64],[1,1,2]),
  ...motif([64,62,60],[1,1,2]).map(event=>[event[0],event[1]+4,...event.slice(2)]),
  ...motif([62,64,65],[1,1,2]).map(event=>[event[0],event[1]+8,...event.slice(2)]),
  ...motif([64,62,60],[1,1,2]).map(event=>[event[0],event[1]+12,...event.slice(2)]),
  ...motif([64,65,67],[1,1,2]).map(event=>[event[0],event[1]+16,...event.slice(2)]),
  ...motif([67,65,64],[1,1,2]).map(event=>[event[0],event[1]+20,...event.slice(2)]),
  ...motif([62,64,62],[1,1,2]).map(event=>[event[0],event[1]+24,...event.slice(2)]),
  ...motif([60],[4]).map(event=>[event[0],event[1]+28,...event.slice(2)]),
];
const pieceBass=[48,48,55,48,48,48,55,48].map((midi,bar)=>[midi,bar*4,4,'left']);
const phraseEvents=(start,end)=>[...pieceBass,...pieceMelody].filter(event=>event[1]>=start&&event[1]<end).map(event=>[event[0],event[1]-start,...event.slice(2)]);
rows.push(
  {id:'home-first-question',title:'«Домой»: первая реплика',module:7,skill:'song-building',needs:['song-building'],hand:'both',tempo:44,
    goal:'Соедини первые два такта пьесы: подъём к Ми и спокойный спуск к До.',prepare:'Правой сыграй начало До–Ре–Ми. Левая готовит нижнюю До на начало каждого такта.',
    intro:'Начинаем свою пьесу «Домой». Два первых такта: мелодия поднимается и возвращается, бас поддерживает начало.',
    events:phraseEvents(0,8),prep:motif([60,62,64],[1,1,2]),contrast:[[48,0,4,'left'],[64,0,1,'right'],[62,1,1,'right'],[60,2,2,'right']],
    contrastText:'Отдельно сыграй ответ сверху вниз над одним басом. Потом соедини его с началом.',
    result:'Исполни первые два такта пьесы обеими руками.',mistake:'Повтор баса нужен только в начале такта, не с каждой нотой мелодии.'},
  {id:'home-answer',title:'«Домой»: ответ с новой краской',module:7,skill:'song-building',needs:['song-building'],hand:'both',tempo:44,
    goal:'Сыграй третий и четвёртый такты: Фа над низкой Соль, затем возвращение к До.',prepare:'Правой сравни Ми–Фа, левой заранее найди низкую Соль. Это новая краска знакомого ответа.',
    intro:'Во втором ответе появится Фа, а снизу — Соль. Затем обе партии вернут мелодию домой.',
    events:phraseEvents(8,16),prep:motif([64,65]),contrast:[[55,0,4,'left'],[62,0,1,'right'],[64,1,1,'right'],[65,2,2,'right']],
    contrastText:'Сыграй только первый такт ответа на басе Соль. Заметь, как Фа задерживается на два счёта.',
    result:'Сыграй два такта ответа, спокойно сменив Соль в басе на До.',mistake:'Верхняя Фа не меняет положение всей правой руки: она остаётся среди знакомых пяти клавиш.'},
  {id:'home-higher-return',title:'«Домой»: вершина и возвращение',module:7,skill:'song-building',needs:['song-building'],hand:'both',tempo:44,
    goal:'Сыграй последние четыре такта: подъём к Соль и длинное окончание на До.',prepare:'Правой разбери Ми–Фа–Соль. Затем отдельно найди заключительную До, которую держат четыре счёта.',
    intro:'Последняя часть доберётся до Соль и вернётся к длинной До. Это четыре маленьких такта, знакомые движения.',
    events:phraseEvents(16,32),prep:motif([64,65,67],[1,1,2]),contrast:phraseEvents(24,32),
    contrastText:'Сначала сыграй два заключительных такта: короткий поворот и длинное окончание обеими руками.',
    result:'Исполни последнюю половину пьесы с длинным последним созвучием.',mistake:'Последняя До — одно нажатие на четыре счёта. Удержание проверь сам по слуху и руке.'},
  {id:'home-whole',title:'«Домой»: моя первая целая пьеса',module:7,skill:'song-building',needs:['song-building'],hand:'both',tempo:44,
    goal:'Исполни всю восьмитактовую пьесу из четырёх изученных реплик.',prepare:'Сыграй стык середины: окончание на До и начало следующего подъёма. Остальные части уже знакомы.',
    intro:'Теперь вся пьеса «Домой»: начало, ответ, вершина и возвращение. Дорожка остаётся доступной; играть наизусть не нужно.',
    events:[...pieceBass,...pieceMelody],prep:motif([60,64,65],[2,1,1]),contrast:phraseEvents(12,20),
    contrastText:'Соедини два такта на стыке частей. После спокойной До мелодия сразу начинает новый подъём.',
    result:'Сыграй всю пьесу с выбранным видом дорожки; в конце послушай длинное общее До.',
    mistake:'Не начинай сначала из-за одной ошибки. При необходимости можно вернуться к отдельной реплике.',
    piece:{id:'flow-home-original-v2',title:'Домой',bars:8,beatsPerBar:4,rights:'original-flow',author:'Flow',durationBeats:32}},
);

rows.push(
  {id:'read-middle-do',title:'По желанию: где До на стане',module:3,skill:'treble-reading',needs:['right-five'],optionalRoute:'reading',kind:'reading',tempo:48,
    goal:'Свяжи среднюю До на добавочной линейке с её клавишей и соседней Ре.',prepare:'Средняя До стоит на короткой добавочной линейке под станом, Ре — под нижней линейкой. Сравни их без звукового ответа.',
    intro:'Ноты можно изучать отдельно. Средняя До — на короткой добавочной линейке под станом, Ре — чуть выше.',
    events:motif([62,60,62],[1,2,1]),prep:motif([60,62]),contrast:motif([62,60],[2,1]),
    contrastText:'Прочитай другой порядок двух знакомых нот. Здесь сначала Ре, затем До.',
    result:'Прочитай короткий рисунок на стане без предварительного проигрывания ответа.',mistake:'Это необязательная ветка. К пьесе можно продолжить с падающими нотами.'},
  {id:'read-three-steps',title:'По желанию: шаги на стане',module:3,skill:'treble-reading',needs:['right-five'],optionalRoute:'reading',kind:'reading',tempo:48,
    goal:'Различи на стане До, Ре и Ми и прочитай их в новом порядке.',prepare:'Ми — на нижней линейке скрипичного стана; Ре — под ней; До — на короткой добавочной линейке.',
    intro:'Ми лежит на нижней линейке скрипичного стана. Сравни три знакомые высоты, затем прочитаешь новый порядок.',
    events:motif([64,60,62],[1,2,1]),prep:motif([60,62]),contrast:motif([62,64],[2,1]),
    contrastText:'Прочитай только Ре–Ми. Заметь движение от промежутка к линейке.',
    result:'Прочитай весь новый порядок трёх знакомых нот без подсветки клавиш.',mistake:'Считай положение относительно нижней Ми, а не количество нарисованных значков.'},
  {id:'read-low-home',title:'По желанию: низкая До на стане',module:4,skill:'bass-reading',needs:['left-five','bass-pattern'],optionalRoute:'reading',kind:'reading',hand:'left',tempo:48,
    goal:'Свяжи нижние До, Ре и Ми с басовым станом.',prepare:'Нижняя До — во втором промежутке снизу басового стана, Ре — на средней линейке, Ми — в промежутке над ней.',
    intro:'Для левой есть басовый стан. Нижняя До — во втором промежутке снизу; рядом знакомые Ре и Ми.',
    events:motif([50,48,52],[1,2,1],[],{hand:'left'}),prep:motif([48,50],[],[],{hand:'left'}),contrast:motif([52,50],[2,1],[],{hand:'left'}),
    contrastText:'Прочитай нижние Ми–Ре. Две соседние высоты занимают промежуток и линейку.',
    result:'Прочитай низкий трёхзвучный рисунок левой рукой без звукового ответа заранее.',mistake:'Положение До здесь другое, чем в скрипичном стане; клавиатура сохраняет те же названия.'},
);

function presentation({support=0,reading=false,ear=false}={}){
  return {target:support===0&&!reading&&!ear,names:support<3&&!reading&&!ear,staff:reading,falling:!reading,
    preview:!reading,fingers:support<3&&!ear};
}
function makeLesson(row,index){
  const id='v2-'+row.id,moduleId='v2-'+MODULE_ROWS[row.module][0],kind=row.kind||'notes';
  const notes=score(row.events,row.tempo),polyphonic=notes.some((note,index)=>index&&note.group===notes[index-1].group);
  const transitionIndices=notes.flatMap((note,index)=>index&&note.hand===notes[index-1].hand&&note.positionId!==notes[index-1].positionId?[index]:[]);
  const reading=kind==='reading',ear=kind==='echo',rhythm=kind==='rhythm';
  const assessmentCriteria={metric:rhythm?'timed-notes-v1':'first-attempt-v1',minimumFirstAttemptRatio:.8,
    requiresCanonicalWhole:true,requiresUnassisted:true,holdMeasured:false,fingersMeasured:false,handMeasured:false,
    simultaneousMeasured:false,independentReceiptRequires:polyphonic?'midi':'mic-or-midi'};
  const stage=(stageId,purpose,title,instruction,events,support,assessment=false)=>({
    id:stageId,purpose,title,instruction,notes:assessment?copy(notes):score(events,row.tempo),mode:assessment?(rhythm?'flow':'check'):'learn',
    presentation:presentation({support,reading,ear}),assessment,supportLevel:support,replayAllowed:!reading,
    transitionIndices:assessment?copy(transitionIndices):[],
    ...(assessment?{sourceRange:{start:0,end:notes.length}}:{}),goal:{type:kind,pitches:[...new Set(events.map(event=>event[0]))],objective:row.goal},
  });
  const authoredMicrosteps=[
    stage('prepare','orient','Готовим музыкальный жест',row.prepare,row.prep,0),
    stage('contrast','contrast',reading?'Другой рисунок на стане':ear?'Слушаем другой ответ':'Пробуем другой ответ',row.contrastText,row.contrast,1),
    stage('whole','whole','Мой самостоятельный результат',row.result,row.events,3,true),
  ];
  return {id,title:row.title,moduleId,moduleTitle:MODULE_ROWS[row.module][1],moduleDescription:MODULE_ROWS[row.module][2],
    moduleIndex:row.module,lessonIndex:rows.slice(0,index).filter(item=>item.module===row.module).length,
    description:row.goal,objective:row.goal,instruction:row.goal,preparation:row.prepare,introSpeech:row.intro,
    tip:row.mistake,commonMistake:row.mistake,readiness:row.result,steps:[row.prepare,row.contrastText,row.result],
    type:'phrase',practiceKind:kind,hand:handLabel(row.hand),tempo:row.tempo,sourceTempo:row.tempo,preserveTiming:true,notes,
    skillIds:[row.skill],prerequisites:row.needs||[],lessonPrerequisiteIds:[],prerequisitePolicy:'recommendation-only',learningRoute:'guided-check',
    author:'Flow — оригинальный учебный материал',level:'С нуля',minutes:index<12?'1–3':'2–5',minutesIsEstimate:true,
    phraseDurationSeconds:Math.max(...notes.map(note=>note.time+note.duration)),
    guidedMusicSeconds:authoredMicrosteps.reduce((sum,stage)=>sum+Math.max(...stage.notes.map(note=>note.time+note.duration)),0),
    defaultNotation:reading?'staff':'falling',memoryRequired:false,replayAllowed:!reading,hintPolicy:{target:!reading&&!ear,names:!reading&&!ear,preview:!reading},
    assessmentCriteria,authoredMicrosteps,transitionIndices,
    fingering:{provenance:'suggested',label:'Предложенные пальцы для свободной пятинотной позиции',positions:copy(POSITIONS),
      limitations:'Не проверено преподавателем на руке ученика; звук не подтверждает пальцы, удержание или свободу кисти.'},
    evaluation:polyphonic?'MIDI проверяет высоты групп нот. Одновременность, удержание, пальцы и выбор руки не измеряются; микрофон — для практики.':
      rhythm?'Проверяются высоты и моменты вступлений. Удержание, пальцы и выбор руки не измеряются.':'Проверяются услышанные высоты. Ритм, удержание, пальцы и выбор руки не измеряются.',
    ...(polyphonic?{polyphonic:true,requiresMidiForAssessment:true}:{}),...(row.optionalRoute?{optionalRoute:row.optionalRoute}:{}),...(row.piece?{piece:copy(row.piece)}:{}),
  };
}

export const CURRICULUM_V2=rows.map(makeLesson);
export const CURRICULUM_V2_RECOMMENDED=CURRICULUM_V2.filter(lesson=>!lesson.optionalRoute);
// Explicit sequential lesson dependencies do not claim lasting skill mastery.
CURRICULUM_V2_RECOMMENDED.forEach((lesson,index,lessons)=>{
  lesson.nextId=lessons[index+1]?.id||null;
  lesson.lessonPrerequisiteIds=index?[lessons[index-1].id]:[];
});
CURRICULUM_V2.filter(lesson=>lesson.optionalRoute).forEach(lesson=>{lesson.nextId=null;});
export const CURRICULUM_V2_MODULES=MODULE_ROWS.map(([id,title,description],index)=>({id:'v2-'+id,title,description,
  lessonIds:CURRICULUM_V2.filter(lesson=>lesson.moduleIndex===index).map(lesson=>lesson.id),
  recommendedLessonIds:CURRICULUM_V2_RECOMMENDED.filter(lesson=>lesson.moduleIndex===index).map(lesson=>lesson.id)}));
export const CURRICULUM_V2_GUIDES=Object.fromEntries(CURRICULUM_V2.map(lesson=>[lesson.id,{
  objective:lesson.objective,preparation:lesson.preparation,commonMistake:lesson.commonMistake,
  assessmentCriteria:copy(lesson.assessmentCriteria),stages:copy(lesson.authoredMicrosteps),transitionIndices:copy(lesson.transitionIndices),
}]));
export const CURRICULUM_V2_SKILLS=[
  ['keyboard-landmarks','Две клавиши и первый ответ',[]],['right-five','Мелодия в пяти клавишах',['keyboard-landmarks']],
  ['phrase-shape','Начало и окончание фразы',['right-five']],['note-lengths','Короткий и длинный звук',['right-five']],
  ['rests','Тишина внутри мелодии',['note-lengths']],['pulse','Общий спокойный счёт',['note-lengths']],
  ['ear-copy','Короткий ответ на слух',['keyboard-landmarks']],['left-five','Левая играет мелодию',['keyboard-landmarks']],
  ['bass-pattern','Низкие музыкальные опоры',['left-five']],['hand-changes','Руки отвечают по очереди',['right-five','left-five']],
  ['position-shifts','Перенос свободной руки',['keyboard-landmarks']],['both-pulse','Вступление двух рук',['hand-changes','pulse']],
  ['song-building','Целая пьеса из знакомых реплик',['both-pulse','bass-pattern']],
  ['treble-reading','По желанию: скрипичный стан',['right-five']],['bass-reading','По желанию: басовый стан',['left-five']],
].map(([id,title,prerequisites])=>({id,title,prerequisites,
  lessonIds:CURRICULUM_V2.filter(lesson=>lesson.skillIds.includes(id)).map(lesson=>lesson.id),
  checkpointIds:CURRICULUM_V2.filter(lesson=>lesson.skillIds.includes(id)).slice(-1).map(lesson=>lesson.id)}));

export const CURRICULUM_V2_METHOD_SOURCES=[
  {title:'Faber Piano Adventures: Primer — Things To Know',url:'https://pianoadventures.com/piano-books/basic-piano-adventures/primer/things-to-know/',
    use:'Ориентиры клавиатуры, шаги и скачки как музыкальные рисунки; материал и порядок уроков здесь авторские.'},
  {title:'Faber Piano Adventures: Teaching FAQs',url:'https://pianoadventures.com/piano-books/basic-faqs/teaching/',
    use:'Короткий показ, слушание и подготовка перед самостоятельной попыткой; это не доказательство эффективности конкретного приложения.'},
  {title:'ABRSM: Piano Practical Grades 2025 & 2026',url:'https://www.abrsm.org/sites/default/files/2024-06/Piano%202025%20%26%202026%20Prac%20syllabus%2020240524_access.pdf',
    use:'Разделение исполнения, чтения и слуховых задач; этот начальный маршрут не эквивалент экзамену или квалификации ABRSM.'},
];
