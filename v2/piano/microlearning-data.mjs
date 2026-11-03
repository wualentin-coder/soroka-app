// Original Flow teaching patterns; these are not imported song arrangements.
export const MICROLESSONS=Object.freeze({
  'course-first-key':{family:'landmark',targets:[60],motif:[0,2],
    cue:'До — белая слева от двух чёрных. Нажми и отпусти.',
    contrast:[60,60],contrastText:'Та же До: два отдельных нажатия.',contrastGoal:'release'},
  'course-first-melody':{family:'notes',targets:[60,62,64],motif:[0,3],
    cue:'Сначала найдём три соседние клавиши по одной.',
    contrast:[60,62,60,62],contrastText:'До и Ре: линия и место рядом с ней.',transfer:[60,64,62,60]},
  'course-do-re-mi':{family:'notes',targets:[64],motif:[0,4],
    cue:'Ми — на нижней линии стана, третий палец правой.',
    contrast:[62,64,62,64],contrastText:'Ре ниже линии, Ми на линии.',transfer:[64,60,62,64]},
  'course-music-step':{family:'notes',targets:[65,67],motif:[0,3],
    cue:'Добавим Фа и Соль по отдельности; рука остаётся на месте.',
    contrast:[64,65,64,65],contrastText:'С линии Ми — в промежуток Фа.',transfer:[65,64,67,60]},
  'course-repeats':{family:'release',targets:[60],motif:[0,4],
    cue:'Каждый повтор — новое нажатие после отпускания.',
    contrast:[60,60,62,62],contrastText:'Отпусти между повторами, затем смени ноту.',contrastGoal:'release',transfer:[62,62,60,64]},
  'course-steps':{family:'steps',targets:[],motif:[0,4],
    cue:'Соседняя нота на стане — соседняя белая клавиша.',
    contrast:[60,62,64,62],contrastText:'Проследи маленькие шаги вверх и обратно.',transfer:[65,64,62,64]},
  'course-skips':{family:'skips',targets:[],motif:[0,4],
    cue:'Через одну белую: приготовь нужную клавишу без перебора.',
    contrast:[60,64,60,64],contrastText:'До и Ми: пропусти одну белую клавишу.',transfer:[64,60,67,64]},
  'course-music-pulse':{family:'rhythm',targets:[],motif:[0,3],
    cue:'После длинного звука считай два раза до нового нажатия.',
    contrast:[64,64,64],contrastBeats:[1,2,1],contrastText:'Один счёт, два счёта, снова один.',contrastGoal:'pulse',
    transfer:[64,64,64,64],transferBeats:[1,1,2,1]},
  'course-music-space':{family:'rest',targets:[],motif:[2,5],
    cue:'Пауза — пустой счёт; пульс продолжается.',
    contrast:[64,64,64],contrastBeats:[1,1,1],contrastRests:[0,1,0],contrastText:'На пустом счёте не нажимай новую клавишу.',contrastGoal:'rest',
    transfer:[64,64,64,64],transferBeats:[1,1,2,1],transferRests:[0,0,1,0]},
  'course-music-echo':{family:'memory',targets:[],motif:[0,3],
    cue:'Послушай короткую часть, затем повтори без дорожки.',
    transfer:[65,64,62,60]},
  'course-music-read':{family:'reading',targets:[],
    cue:'До — на добавочной линии, Ре ниже стана, Ми на линии.',
    guide:[60,62,64,65],contrast:[64,65,64,62],contrastText:'Ми на линии, Фа над ней: прочитай другой рисунок.',transfer:[65,62,60,64]},
  'course-left':{family:'notes',targets:[60,62,64],motif:[0,3],
    cue:'Левая рука: мизинец на До, большой приготовь над Соль.',
    contrast:[60,62,60,62],contrastText:'Те же До и Ре, теперь удобной левой рукой.',transfer:[64,60,62,64]},
  'course-left-neighbours':{family:'steps',targets:[67],motif:[0,4],
    cue:'Левая: большой на Соль; соседние клавиши уже знакомы.',
    contrast:[67,65,64,65],contrastText:'Шагни вниз по белым и вернись на соседнюю.',transfer:[65,62,64,60]},
});

export const MICRO_CUES=Object.freeze({
  60:{name:'До',keyboard:'белая слева от двух чёрных'},
  62:{name:'Ре',keyboard:'белая между двумя чёрными'},
  64:{name:'Ми',keyboard:'белая справа от двух чёрных'},
  65:{name:'Фа',keyboard:'белая слева от трёх чёрных'},
  67:{name:'Соль',keyboard:'белая после первой из трёх чёрных'},
});

// Module-specific scaffolds use the lesson's own complete attacks, not new songs.
export const MICRO_MODULE_CUES=Object.freeze({
  'orientation':{focus:'landmark',warmup:'Найди клавиши по соседним группам чёрных.',motif:'Соедини знакомые клавиши в короткий ответ.'},
  'first-music':{focus:'phrase',warmup:'Найди начало и спокойно приготовь руку.',motif:'Сыграй маленькую музыкальную реплику.'},
  'pulse-and-space':{focus:'pulse',warmup:'Найди клавиши; пока можно играть без спешки.',motif:'Считай ровно, включая длинные звуки и тишину.'},
  'five-notes':{focus:'direction',warmup:'Приготовь пять знакомых белых клавиш.',motif:'Следи за повторами, шагами и небольшими скачками.'},
  'listen-and-remember':{focus:'memory',warmup:'Послушай маленькую часть и запомни направление.',motif:'Повтори часть без нового показа.'},
  'phrases':{focus:'phrase',warmup:'Найди начало короткой музыкальной реплики.',motif:'Собери эту часть; затем соединим её с остальными.'},
  'left-hand':{focus:'left',warmup:'Приготовь левую руку над нужными клавишами.',motif:'Сыграй эту часть левой; не напрягай кисть.'},
  'hands-dialogue':{focus:'hand-change',warmup:'Приготовь обе руки для игры по очереди.',motif:'Следи за сменой рук из задания; ноты идут по одной.'},
  'hands-together':{focus:'coordination',warmup:'Приготовь клавиши каждой руки для общего вступления.',motif:'Ноты одного столбика начинают звучать вместе.'},
  'keyboard-range':{focus:'register',warmup:'Найди новую позицию по группам чёрных клавиш.',motif:'Заранее посмотри, куда перенести руку.'},
  'black-keys':{focus:'accidental',warmup:'Найди нужную чёрную клавишу и белые рядом.',motif:'Сравни соседние звуки; не пропускай знак у ноты.'},
  'simple-accompaniment':{focus:'bass',warmup:'Приготовь бас или созвучие из этой части.',motif:'Собери опорные звуки; столбик нот звучит вместе.'},
  'to-compositions':{focus:'phrase',warmup:'Приготовь опорные клавиши короткого поворота.',motif:'Разучи поворот отдельно, затем продолжи фразу.'},
});

// These boundaries restate the original Flow lesson instructions. They are
// directions for the learner, never a claim that audio detected either hand.
export const MICRO_HAND_BLOCKS=Object.freeze({
  'course-alternate':5,'course-hand-question':8,'course-low-answer':8,
  'course-dialogue':2,'course-hands-checkpoint':6,
});
