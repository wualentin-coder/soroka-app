// Keys are written in finger order: thumb (1) to little finger (5).
// A change of row means release/reposition, not a demand to stretch a fixed hand.
const C=[60,62,64,65,67], D=[62,64,65,67,69], F=[65,67,69,71,72], G=[67,69,71,72,74];
const A=[69,71,72,74,76], AD=[69,71,72,75,76], HI=[72,74,76,77,79];
const EB=[60,63,64,65,67], CH=[60,61,62,64,65], DE=[60,62,63,64,67];
const LC=[67,65,64,62,60], LOW=[55,53,52,50,48], BASS=[48,47,45,43,41];
const at=(start,keys,kind='shift')=>({start,keys,kind});
const right=(...positions)=>({right:positions});
const left=(...positions)=>({left:positions});

const homeIds=[
  'course-first-key','course-first-melody','course-do','course-do-re','course-do-re-mi','course-fa','course-first-answer',
  'course-music-step','course-music-pulse','course-music-space','course-music-echo','course-music-read',
  'course-pulse-even','course-pulse-two-counts','course-pulse-long-short','course-pulse-one-rest','course-pulse-silence',
  'course-pulse-paired-eighths','course-pulse-mixed-values','course-pulse-eighth-check',
  'course-five','course-repeats','course-steps','course-skips','course-five-checkpoint',
  'course-ear-up','course-ear-down','course-ear-answer','course-memory-four','course-memory-repeat','course-memory-six',
  'course-read-three-unseen','course-read-five-unseen','course-question','course-answer','course-memory','course-long-phrase','course-phrase',
  'course-accomp-major-shape',
];

export const COURSE_FINGERINGS=Object.freeze({
  ...Object.fromEntries(homeIds.map(id=>[id,right(at(0,C))])),
  'course-left':left(at(0,LC)),
  'course-left-neighbours':left(at(0,LC)),
  'course-left-repeats':left(at(0,LC)),
  'course-left-broken':left(at(0,LC),at(8,[69,67,65,64,62])),
  'course-left-checkpoint':left(at(0,LC)),
  'course-alternate':{right:[at(0,C)],left:[at(0,LC)],handBlock:5},
  'course-hand-question':{right:[at(0,C)],left:[at(0,LC)],handBlock:8},
  'course-low-answer':{right:[at(0,C)],left:[at(0,LOW)],handBlock:8},
  'course-dialogue':{right:[at(0,C)],left:[at(0,LOW)],handBlock:2},
  'course-hands-checkpoint':{right:[at(0,C)],left:[at(0,LOW)],handBlock:6},
  'course-coord-together-c':{right:[at(0,C)],left:[at(0,LOW)]},
  'course-coord-move-right':{right:[at(0,C)],left:[at(0,LOW)]},
  'course-coord-move-left':{right:[at(0,C)],left:[at(0,LOW)]},
  'course-coord-bass-read':left(at(0,LOW)),
  'course-coord-common-rest':{right:[at(0,C)],left:[at(0,LOW)]},
  'course-coord-opposite':{right:[at(0,C)],left:[at(0,LOW)]},
  'course-coord-long-answer':{right:[at(0,C)],left:[at(0,LOW)]},
  'course-coord-checkpoint':{right:[at(0,C)],left:[at(0,LOW)]},
  'course-reach':right(at(0,G),at(7,C)),
  'course-octave-home':right(at(0,C),at(4,HI),at(8,C),at(12,HI)),
  'course-upper-position':right(at(0,G)),
  'course-position-change':right(at(0,C),at(8,G)),
  'course-range-checkpoint':right(at(0,C),at(2,F,'thumb-cross'),at(6,C,'thumb-cross'),
    at(8,G),at(10,HI,'thumb-cross'),at(14,G,'thumb-cross'),at(20,C,'thumb-cross')),
  'course-first-black':right(at(0,CH)),
  'course-semitone':right(at(0,[62,63,64,65,67])),
  'course-minor-colour':right(at(0,C),at(8,[60,62,63,65,67],'adjustment')),
  'course-black-turn':right(at(0,EB),at(5,C,'adjustment'),at(8,EB,'adjustment'),at(12,C,'adjustment')),
  'course-black-checkpoint':right(at(0,CH),at(3,DE,'adjustment'),at(8,CH,'adjustment'),at(11,DE,'adjustment')),
  'course-accomp-bass-home':left(at(0,LOW)),
  'course-accomp-bass-shape':left(at(0,LOW)),
  'course-accomp-open-fifth':left(at(0,LOW)),
  'course-accomp-minor-shape':right(at(0,C),at(3,[57,59,60,62,64]),at(6,C),at(9,[57,59,60,62,64])),
  'course-accomp-changes':right(at(0,C),at(3,[55,57,59,60,62]),at(6,C),at(9,[55,57,59,60,62]),at(12,C)),
  'course-accomp-bass-melody':{right:[at(0,C)],left:[at(0,LOW)]},
  'course-accomp-miniature':{right:[at(0,C),at(7,[55,57,59,60,62]),at(10,C)],left:[at(0,LOW)]},
  'course-elise-neighbours':right(at(0,AD)),
  'course-elise-landing':right(at(0,A)),
  'course-broken-accompaniment':left(at(0,[64,62,60,59,57]),at(8,[59,57,56,54,52])),
  'course-musical-arc':right(at(0,C),at(2,F,'thumb-cross'),at(6,C,'thumb-cross'),at(8,D),at(11,G),
    at(14,C,'thumb-cross'),at(16,EB,'adjustment'),at(20,G),at(24,C,'thumb-cross')),
  'course-composition-ready':right(at(0,AD),at(5,A,'adjustment')),
});

const star=right(at(0,C),at(2,D),at(13,C),at(30,D),at(41,C));
const furRight=right(at(0,AD),at(5,A,'adjustment'),at(9,C),at(11,A,'thumb-cross'),
  at(13,[64,68,69,71,72]),at(18,AD),at(23,A,'adjustment'),at(27,C),at(29,A,'thumb-cross'),at(31,[64,67,69,71,72]));
const furBass=[45,52,57,40,52,56,45,52,57,45,52,57,40,52,56,45,52,57].map((midi,index)=>
  at(index,midi===45?[52,50,48,47,45]:midi===57?[57,55,53,52,50]:midi===40?[47,45,44,42,40]:
    midi===56?[57,56,54,52,50]:index===4||index===13?[55,53,52,50,48]:[53,52,50,48,47]));

export const SONG_FINGERINGS=Object.freeze({
  'joy-beginner':{melody:right(at(0,C)),bass:left(at(0,BASS))},
  'star-beginner':{melody:star,bass:left(at(0,BASS))},
  'fur-elise':{theme:furRight,'original-1':{...left(...furBass),end:18}},
  joy:{melody:right(at(0,C))},
  star:{melody:star},
});
