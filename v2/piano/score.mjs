const MAX_NOTES = 5000;
const MAX_SECONDS = 86400;

function positive(value, name) {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and positive.`);
  return value;
}

function boundedSeconds(value, name, allowZero = false) {
  if (!Number.isFinite(value) || value > MAX_SECONDS || (allowZero ? value < 0 : value <= 0)) {
    throw new RangeError(`${name} must be ${allowZero ? 'non-negative' : 'positive'} and within one day.`);
  }
  return value;
}

/**
 * Shared seconds for preview audio and falling note bars, starting at the first
 * source note. MIDI timing retains rests and overlaps; course beats use the
 * existing 70% note gate. Source objects and their order remain unchanged.
 */
export function createScoreTimeline(notes, { tempo = 60, preserveTiming = false, sourceTempo = 60 } = {}) {
  if (!Array.isArray(notes)) throw new TypeError('Score notes must be an array.');
  if (notes.length > MAX_NOTES) throw new RangeError('Score has more than 5000 notes.');
  positive(tempo, 'Tempo'); positive(sourceTempo, 'Source tempo');
  if (typeof preserveTiming !== 'boolean') throw new TypeError('preserveTiming must be boolean.');
  const secondsPerBeat = 60 / tempo, speed = tempo / sourceTempo;
  if (!Number.isFinite(secondsPerBeat) || !Number.isFinite(speed) || speed <= 0) throw new RangeError('Unsupported score tempo.');
  let offset = 0, firstTime = null, previousTime = -Infinity, previousGroup=null,groupStart=0;
  const usedGroups=new Set();
  return Array.from(notes, (note, index) => {
    if (!note || !Number.isInteger(note.midi) || note.midi < 0 || note.midi > 127) {
      throw new TypeError(`Note ${index} needs a valid MIDI pitch.`);
    }
    let time, duration;
    if (preserveTiming) {
      const sourceTime = boundedSeconds(note.time, `Note ${index} time`, true);
      const sourceDuration = boundedSeconds(note.duration, `Note ${index} duration`);
      if (sourceTime < previousTime) throw new RangeError('Source notes must be ordered by time.');
      previousTime = sourceTime;
      firstTime ??= sourceTime;
      time = (sourceTime - firstTime) / speed;
      duration = sourceDuration / speed;
    } else {
      const beatDuration = positive(note.beats, `Note ${index} beats`) * secondsPerBeat;
      const rest=note.restBefore??0,group=note.group;
      if(!Number.isFinite(rest)||rest<0||rest>64)throw new RangeError('Invalid rest before note.');
      if(group!==undefined&&(!Number.isSafeInteger(group)||group<0))throw new RangeError('Invalid onset group.');
      if(group!==undefined&&group===previousGroup){if(rest)throw new RangeError('A chord member cannot insert a rest.');time=groupStart;}
      else{if(group!==undefined&&usedGroups.has(group))throw new RangeError('Onset groups must be contiguous.');time=offset+rest*secondsPerBeat;groupStart=time;if(group!==undefined)usedGroups.add(group);}
      duration = beatDuration * .7;
      offset = Math.max(offset,time+beatDuration);previousGroup=group??null;
      boundedSeconds(offset, 'Score length', true);
    }
    boundedSeconds(time, `Note ${index} scaled time`, true);
    boundedSeconds(duration, `Note ${index} scaled duration`);
    boundedSeconds(time + duration, 'Score length', true);
    return { midi: note.midi, time, duration, index };
  });
}
