// Melodies in the public domain; these sparse teaching arrangements are Flow's.
// Source times are seconds at 60 BPM. No notes from the owner's MIDI are used.
function melody(id, pitches, values, starts) {
  let time = 0;
  return pitches.map((midi, sourceIndex) => {
    const beats = values[sourceIndex] || 1;
    const note = { id: `${id}/melody/${sourceIndex}`, midi, beats, time, duration: beats * .94,
      track: 'melody', sourceIndex, velocity: .7, phraseStart: starts.includes(sourceIndex) };
    time += beats;
    return note;
  });
}
function teachingSong({ id, title, author, description, pitches, values = {}, starts, bass, goalSkills }) {
  const notes = melody(id, pitches, values, starts);
  const left = bass.map((midi, sourceIndex) => ({ id: `${id}/bass/${sourceIndex}`, midi,
    beats: 4, time: sourceIndex * 4, duration: 3.7, track: 'bass', sourceIndex, velocity: .42 }));
  return { id, title, author, description, arrangementVersion: 'flow-teaching-arrangement-v1',
    source: 'builtin-arrangement', status: 'ready', level: 'Учебная версия', tempo: 60,
    sourceLabel: 'Общедоступная мелодия · учебная аранжировка Flow', sourceLicense: 'Public-domain melody; Flow teaching arrangement',
    arrangementLabel: 'Мелодия и простые басовые опоры', goalSkills,
    defaultTrack: 'melody', hand: 'right', notes,
    duration: Math.max(...notes.map(n => n.time + n.duration)),
    timeSignatures: [{ numerator: 4, denominator: 4, ticks: 0 }],
    tracks: [{ id: 'melody', name: 'Правая рука · мелодия', channel: 0, notes },
      { id: 'bass', name: 'Левая рука · басовые опоры', channel: 1, notes: left }] };
}

const joyPitches = [64,64,65,67,67,65,64,62,60,60,62,64,64,62,62,
  64,64,65,67,67,65,64,62,60,60,62,64,62,60,60];
const starA = [60,60,67,67,69,69,67,65,65,64,64,62,62,60];
const starB = [67,67,65,65,64,64,62,67,67,65,65,64,64,62];

export const BEGINNER_SONGS = [
  teachingSong({ id: 'joy-beginner', title: 'Ода к радости · первая тема', author: 'Людвиг ван Бетховен',
    description: 'Восемь тактов знакомой темы. Правая играет мелодию, левая добавляет по одной басовой опоре. Упрощённая учебная версия Flow.',
    pitches: joyPitches, values: { 12: 1.5, 13: .5, 14: 2, 27: 1.5, 28: .5, 29: 2 },
    starts: [0,8,15,23], bass: [48,43,48,43,48,43,43,48],
    goalSkills: ['right-five','pulse','left-five','both-pulse'] }),
  teachingSong({ id: 'star-beginner', title: 'Маленькая звезда · двумя руками', author: 'Традиционная мелодия',
    description: 'Вся знакомая мелодия из трёх частей. Сначала руки отдельно, затем вместе с редкими басовыми опорами. Учебная версия Flow.',
    pitches: [...starA,...starB,...starA], values: { 6: 2, 13: 2, 20: 2, 27: 2, 34: 2, 41: 2 },
    starts: [0,7,14,21,28,35], bass: [48,48,41,48,43,48,43,43,48,48,41,48],
    goalSkills: ['right-five','position-shift','pulse','left-five','both-pulse'] }),
];
