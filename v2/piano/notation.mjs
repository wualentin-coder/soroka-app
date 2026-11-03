const STEPS = [0,0,1,1,2,3,3,4,4,5,5,6];
const LETTERS = ['C','C','D','D','E','F','F','G','G','A','A','B'];
const NAMES = ['До','До♯','Ре','Ре♯','Ми','Фа','Фа♯','Соль','Соль♯','Ля','Ля♯','Си'];
const SHARPS = new Set([1,3,6,8,10]);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// Official Steinberg Bravura 1.482 metadata, commit 37b194378b710cc40e406ab6c4b07608bb9548ae.
// Bounds and anchors use SMuFL staff spaces (one space = 0.25em), y positive up.
export const MUSIC_FONT = 'Bravura';
export const MUSIC_GLYPHS = Object.freeze({
  gClef:{char:'\uE050',box:[0,-2.632,2.684,4.392]},
  fClef:{char:'\uE062',box:[-.02,-2.54,2.736,1.048]},
  noteheadWhole:{char:'\uE0A2',box:[0,-.5,1.688,.5]},
  noteheadHalf:{char:'\uE0A3',box:[0,-.5,1.18,.5]},
  noteheadBlack:{char:'\uE0A4',box:[0,-.5,1.18,.5]},
  accidentalSharp:{char:'\uE262',box:[0,-1.392,.996,1.4]},
  accidentalNatural:{char:'\uE261',box:[0,-1.34,.672,1.364]},
  augmentationDot:{char:'\uE1E7',box:[0,-.2,.4,.2]},
  flag8thUp:{char:'\uE240',box:[0,-3.24,1.056,.036],anchorY:-.04},
  flag8thDown:{char:'\uE241',box:[0,-.056,1.224,3.232],anchorY:.132},
  flag16thUp:{char:'\uE242',box:[0,-3.252,1.116,.008],anchorY:-.088},
  flag16thDown:{char:'\uE243',box:[0,-.036,1.164,3.248026],anchorY:.128},
  flag32ndUp:{char:'\uE244',box:[0,-3.248,1.044,.596],anchorY:.376},
  flag32ndDown:{char:'\uE245',box:[0,-.688,1.092,3.248],anchorY:-.448},
  flag64thUp:{char:'\uE246',box:[0,-3.248,1.044,1.388],anchorY:1.172},
  flag64thDown:{char:'\uE247',box:[0,-1.504,1.092,3.248],anchorY:-1.244},
});
const headName = value => !value.stem?'noteheadWhole':value.filled?'noteheadBlack':'noteheadHalf';
const flagName = note => note.value.flags?`flag${note.value.denominator}th${note.stemDirection==='up'?'Up':'Down'}`:null;
const headSize = (note,space) => MUSIC_GLYPHS[headName(note.value)].box[2]*space;
function musicGlyph(ctx,name,x,y,space) {
  ctx.font=`${space*4}px "${MUSIC_FONT}"`;ctx.textAlign='left';ctx.textBaseline='alphabetic';
  ctx.fillText(MUSIC_GLYPHS[name].char,x,y);
}

/** Absolute diatonic steps: C0 = 0, C4 = 28. No octave folding. */
export function pitchNotation(midi) {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) throw new RangeError('Notation needs a valid MIDI pitch.');
  const pitchClass = midi % 12, octave = Math.floor(midi / 12) - 1;
  return { midi, step: octave * 7 + STEPS[pitchClass], letter: LETTERS[pitchClass],
    sharp: SHARPS.has(pitchClass), name: NAMES[pitchClass], octave };
}

const VALUES = [];
for (const [denominator, beats] of [[1,4],[2,2],[4,1],[8,.5],[16,.25],[32,.125],[64,.0625]]) {
  for (const [factor, dots, tuplet] of [[1,0,null],[1.5,1,null],[2/3,0,3]]) {
    VALUES.push({ denominator, beats: beats * factor, filled: denominator >= 4,
      stem: denominator !== 1, flags: Math.max(0, Math.log2(denominator) - 2), dots, tuplet });
  }
}

/** Display-only quantization; it never changes source onsets or playback. */
export function quantizeNoteValue(beats) {
  if (!Number.isFinite(beats) || beats <= 0) throw new RangeError('A note value needs positive beats.');
  let best = VALUES[0], distance = Infinity;
  for (const candidate of VALUES) {
    const error = Math.abs(Math.log2(beats / candidate.beats));
    if (error < distance - 1e-9) { best = candidate; distance = error; }
  }
  return { ...best, rawBeats: beats, approximate: Math.abs(best.beats - beats) / beats > .08 };
}

function noteHand(note, fallback) { return note?.hand === 'left' || note?.hand === 'right' ? note.hand : fallback; }

function nextSourceTimes(events) {
  const voices = new Map(), next = new Map();
  for (const event of events) {
    if (!Number.isFinite(event.source?.time)) continue;
    const key = `${event.hand}:${event.source.sourceTrack ?? event.source.track ?? event.source.channel ?? ''}`;
    if (!voices.has(key)) voices.set(key, []);
    voices.get(key).push(event);
  }
  for (const voice of voices.values()) {
    let previous = [];
    for (let first = 0; first < voice.length;) {
      const time = voice[first].source.time;
      let last = first + 1;
      while (last < voice.length && voice[last].source.time - time <= .035 + 1e-9) last++;
      for (const event of previous) next.set(event.index, time);
      previous = voice.slice(first, last); first = last;
    }
  }
  return next;
}

function noteBeats(event, nextTime, sourceTempo, tempo) {
  const source = event.source;
  // Intro frames can stretch source seconds without changing the written value.
  if (Number.isFinite(source?.beats) && source.beats > 0) return quantizeNoteValue(source.beats);
  let beats = Number.isFinite(source?.duration) && source.duration > 0 ? source.duration * sourceTempo / 60
      : event.duration * tempo / 60;
  // MIDI note-off can precede the following beat (piano articulation). Where
  // the gap is short and occupied at least 60%, show its simple onset value,
  // rather than falsely labeling every articulated quarter a triplet.
  if (Number.isFinite(source?.time) && Number.isFinite(source?.duration) && Number.isFinite(nextTime)) {
    const gap = nextTime - source.time, ratio = source.duration / gap, gapBeats = gap * sourceTempo / 60;
    if (gap > .035 && gapBeats <= 4 && ratio >= .6 && ratio <= 1.05) beats = gapBeats;
  }
  return quantizeNoteValue(beats);
}

function chordGeometry(group, staffs, space, headWidth) {
  for (const staff of staffs) {
    const chord = group.notes.filter(note => note.hand === staff.hand).sort((a,b) => a.step-b.step || a.index-b.index);
    if (!chord.length) continue;
    const direction = (chord[0].step + chord.at(-1).step) / 2 >= staff.bottomStep + 4 ? 1 : -1;
    const consistent = chord.every(note => note.value.denominator === chord[0].value.denominator && note.value.dots === chord[0].value.dots);
    let previous, shifted = false;
    for (const note of chord) {
      if (previous && note.step === previous.step) note.headOffset = previous.headOffset;
      else {
        shifted = previous && note.step - previous.step === 1 ? !shifted : false;
        note.headOffset = shifted ? -direction * headWidth * .94 : 0;
      }
      previous=note;
    }
    const top=Math.min(...chord.map(n=>n.y)),bottom=Math.max(...chord.map(n=>n.y));
    const leftHead=Math.min(0,...chord.map(n=>n.headOffset)),accidentalColumns=[];
    for (const note of chord) {
      note.stemDirection = direction < 0 ? 'up' : 'down';
      note.stemOffset = -direction * space * .53;
      note.stemStartY = (direction < 0 ? bottom : top) + direction * space * .168;
      note.stemEndY = (direction < 0 ? top : bottom) + direction * space * 3.5;
      note.drawStem = !consistent || note === chord[0];
      if (!consistent) {
        note.stemOffset = note.headOffset - direction * space * .53;
        note.stemStartY = note.y + direction * space * .168; note.stemEndY = note.y + direction * space * 3.5;
      }
      if (note.accidental) {
        let column = accidentalColumns.findIndex(steps => steps.every(step=>Math.abs(step-note.step)>=6));
        if (column < 0) { column=accidentalColumns.length;accidentalColumns.push([]); }
        accidentalColumns[column].push(note.step);
        const accidentalName=note.accidental==='sharp'?'accidentalSharp':'accidentalNatural';
        note.accidentalOffset=leftHead-headWidth*.5-space*.35-MUSIC_GLYPHS[accidentalName].box[2]*space-column*space*1.15;
      }
    }
  }
}

function glyphBounds(note, space, headWidth, headHeight, showNames) {
  const width=headSize(note,space), direction=note.stemDirection==='up'?-1:1;
  let left=note.headOffset-width*.5-1,right=note.headOffset+width*.5+1;
  let top=note.y-space*.5-1,bottom=note.y+space*.5+1;
  const includeGlyph=(name,x,y)=>{const [x1,y1,x2,y2]=MUSIC_GLYPHS[name].box;left=Math.min(left,x+x1*space-1);right=Math.max(right,x+x2*space+1);top=Math.min(top,y-y2*space-1);bottom=Math.max(bottom,y-y1*space+1);};
  if (note.ledgerLines.length) {left=Math.min(left,note.headOffset-width*.5-space*.4-1);right=Math.max(right,note.headOffset+width*.5+space*.4+1);}
  if (note.accidental) includeGlyph(note.accidental==='sharp'?'accidentalSharp':'accidentalNatural',note.accidentalOffset,note.y);
  if (note.value.stem && note.drawStem) {
    left=Math.min(left,note.stemOffset-1);right=Math.max(right,note.stemOffset+1);
    top=Math.min(top,note.stemStartY,note.stemEndY);bottom=Math.max(bottom,note.stemStartY,note.stemEndY);
    const name=flagName(note);if(name)includeGlyph(name,note.stemOffset-space*.06,note.stemEndY+MUSIC_GLYPHS[name].anchorY*space);
  }
  if (note.value.dots) right=Math.max(right,note.headOffset+width*.5+space*.8);
  if (note.value.tuplet) { left=Math.min(left,note.stemOffset-5);right=Math.max(right,note.stemOffset+5);top=Math.min(top,note.stemEndY+direction*space*.8-6);bottom=Math.max(bottom,note.stemEndY+direction*space*.8+6); }
  if (showNames) { const nameHalf=note.name.length*Math.min(11,space*.8)*.36;left=Math.min(left,note.headOffset-nameHalf);right=Math.max(right,note.headOffset+nameHalf);bottom=Math.max(bottom,note.y+space*1.1+11); }
  return {left,right,top,bottom};
}

function positionAtTime(groups, time, nominalSpeed) {
  if (!groups.length) return time*nominalSpeed;
  const first=groups[0],last=groups.at(-1);
  if (time < first.time) return first.anchor+(time-first.time)*nominalSpeed;
  if (time >= last.endTime) return last.anchor+(time-last.endTime)*nominalSpeed;
  let low=0,high=groups.length-1;
  while(low<high) { const middle=Math.ceil((low+high)/2);if(groups[middle].time<=time)low=middle;else high=middle-1; }
  const group=groups[low],next=groups[low+1];
  if (time <= group.endTime || !next) return group.anchor;
  return group.anchor+(next.anchor-group.anchor)*(time-group.endTime)/(next.time-group.endTime);
}

/** Positions share the supplied transport. Fixed playhead means fixed geometry. */
export function layoutNotation(notes, timeline, { width, height, playhead = 0, index = 0,
  expectedNotes, hand, sourceTempo = 60, tempo = 60, preview = false, showNames = false } = {}) {
  if (!Array.isArray(notes) || !Array.isArray(timeline) || timeline.length > 5000) throw new TypeError('Notation needs bounded score arrays.');
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(playhead) ||
      !Number.isFinite(sourceTempo) || sourceTempo <= 0 || !Number.isFinite(tempo) || tempo <= 0) throw new RangeError('Invalid notation geometry or tempo.');
  if (width <= 0 || height <= 0) return { staffs: [], notes: [], cursorX: 0, lineSpacing: 0, pixelsPerSecond: 0, clefGutter: 0 };
  const fallback = hand === 'left' ? 'left' : 'right';
  const events = timeline.map((event, ordinal) => {
    if (!event || !Number.isFinite(event.time) || !Number.isFinite(event.duration) || event.duration <= 0) throw new RangeError('Notation needs valid timeline seconds.');
    const sourceIndex = Number.isInteger(event.index) && event.index >= 0 && event.index < notes.length ? event.index : ordinal;
    const source = notes[sourceIndex] ?? event, pitch = pitchNotation(event.midi ?? source.midi);
    return { index: ordinal, sourceIndex, source, pitch, midi: pitch.midi,
      hand: noteHand(source, fallback), time: event.time, duration: event.duration };
  });
  const hands = new Set(events.map(event => event.hand));
  if (!hands.size) hands.add(fallback);
  const definitions = hands.has('right') && hands.has('left')
    ? [{ hand: 'right', clef: 'treble', bottomStep: 30 }, { hand: 'left', clef: 'bass', bottomStep: 18 }]
    : [{ hand: hands.has('left') ? 'left' : 'right', clef: hands.has('left') ? 'bass' : 'treble', bottomStep: hands.has('left') ? 18 : 30 }];
  let topStep = Math.max(...definitions.map(staff => staff.bottomStep + 8)) + 4;
  let bottomStep = Math.min(...definitions.map(staff => staff.bottomStep)) - 4;
  for (const event of events) {
    const definition = definitions.find(staff => staff.hand === event.hand);
    const up = event.pitch.step < definition.bottomStep + 4;
    topStep = Math.max(topStep, event.pitch.step + (up ? 8 : 3));
    bottomStep = Math.min(bottomStep, event.pitch.step - (up ? 3 : 8));
  }
  const margin = clamp(height * .075, 6, 18), halfSpacing = Math.max(.5,Math.floor(Math.min(9,(height-margin*2)/(topStep-bottomStep))*2)/2);
  const minimumLineSpacing=10;
  let minimumHeight=Math.max(100,Math.ceil((topStep-bottomStep)*minimumLineSpacing/2/.85));
  while(minimumHeight-2*clamp(minimumHeight*.075,6,18)<(topStep-bottomStep)*minimumLineSpacing/2)minimumHeight++;
  const contentHeight = (topStep - bottomStep) * halfSpacing, offsetY = Math.round((height - contentHeight)) / 2;
  const yFor = step => offsetY + (topStep - step) * halfSpacing;
  const lineSpacing = halfSpacing * 2;
  const staffs = definitions.map(staff => ({ ...staff, topStep: staff.bottomStep + 8,
    top: yFor(staff.bottomStep + 8), bottom: yFor(staff.bottomStep), middleY: yFor(staff.bottomStep + 4),
    lines: Array.from({ length: 5 }, (_, line) => yFor(staff.bottomStep + 8 - line * 2)) }));
  const pixelsPerSecond=clamp(width/5.8,72,180),clefGutter=Math.max(42,lineSpacing*3.8+10);
  const headWidth=lineSpacing*1.18,headHeight=lineSpacing,minimumOnsetSpacing=48;
  const selected = clamp(Number.isInteger(index) ? index : 0, 0, events.length);
  const gateTime = events[selected]?.time;
  const pending = new Set(Array.isArray(expectedNotes) ? expectedNotes : events[selected] ? [events[selected].midi] : []);
  const next = nextSourceTimes(events), accidentals = new Map();
  const engraved = events.map(event => {
    const staffIndex = staffs.findIndex(staff => staff.hand === event.hand), staff = staffs[staffIndex];
    const y = yFor(event.pitch.step);
    const ledgerLines = [];
    for (let step = staff.bottomStep - 2; step >= event.pitch.step; step -= 2) ledgerLines.push(yFor(step));
    for (let step = staff.topStep + 2; step <= event.pitch.step; step += 2) ledgerLines.push(yFor(step));
    const accidentalKey = `${event.hand}:${event.pitch.letter}:${event.pitch.octave}`;
    const accidental = event.pitch.sharp ? 'sharp' : accidentals.get(accidentalKey) ? 'natural' : null;
    accidentals.set(accidentalKey, event.pitch.sharp);
    const inGroup = gateTime !== undefined && Math.abs(event.time - gateTime) <= .035 + 1e-9;
    const active = preview ? event.time <= playhead + .015 && event.time + event.duration > playhead : inGroup && pending.has(event.midi);
    const played = preview ? event.time + event.duration <= playhead : event.index < selected || inGroup && !pending.has(event.midi);
    return { index: event.index, sourceIndex: event.sourceIndex, midi: event.midi, name: event.pitch.name,
      hand: event.hand, staffIndex, time: event.time, duration: event.duration,
      step:event.pitch.step,y,ledgerLines,accidental,headOffset:0,stemDirection:event.pitch.step>=staff.bottomStep+4?'down':'up',
      groupTime:Number.isFinite(event.source.time)?event.source.time:event.time,
      introGroup:Number.isInteger(event.source.group)?event.source.group:null,
      value: noteBeats(event, next.get(event.index), sourceTempo, tempo), active, played };
  });
  const groups=[];
  for (const note of engraved) {
    let group=groups.at(-1);
    const sameGroup=group&&(note.introGroup!==null&&group.introGroup!==null?note.introGroup===group.introGroup:note.groupTime-group.groupTime<=.035+1e-9);
    if (!sameGroup) {group={time:note.time,endTime:note.time,groupTime:note.groupTime,introGroup:note.introGroup,notes:[],anchor:0};groups.push(group);}
    group.notes.push(note);group.endTime=note.time;note.groupIndex=groups.length-1;
  }
  const pendingGroup=engraved[selected]?.groupIndex;
  if (!preview) for (const note of engraved) {
    const inGroup=note.groupIndex===pendingGroup;
    note.active=inGroup&&pending.has(note.midi);note.played=note.index<selected||inGroup&&!pending.has(note.midi);
  }
  for (let i=0;i<groups.length;i++) {
    const group=groups[i];chordGeometry(group,staffs,lineSpacing,headWidth);
    for (const note of group.notes) note.localBounds=glyphBounds(note,lineSpacing,headWidth,headHeight,showNames);
    group.left=Math.min(...group.notes.map(n=>n.localBounds.left));group.right=Math.max(...group.notes.map(n=>n.localBounds.right));
    if (i) {const previous=groups[i-1];group.anchor=previous.anchor+Math.max(minimumOnsetSpacing,(group.time-previous.endTime)*pixelsPerSecond,previous.right-group.left+12);}
  }
  const reservedLeft=groups.length?-Math.min(...groups.map(group=>group.left)):24;
  const cursorX=Math.max(width*.25,Math.min(width*.65,clefGutter+reservedLeft+12));
  const scroll=positionAtTime(groups,playhead,pixelsPerSecond),placed=[];
  for (const group of groups) for (const note of group.notes) {
    const x=cursorX+group.anchor-scroll,headX=x+note.headOffset;
    const glyph={left:x+note.localBounds.left,right:x+note.localBounds.right,top:note.localBounds.top,bottom:note.localBounds.bottom};
    if(glyph.left<clefGutter+2 || glyph.left>width)continue;
    const {localBounds,...visible}=note;
    placed.push({...visible,x,headX,stemX:x+note.stemOffset,accidentalX:note.accidental?x+note.accidentalOffset:null,glyphBounds:glyph});
  }
  return { staffs, notes: placed, cursorX, lineSpacing, pixelsPerSecond, clefGutter,
    headWidth,headHeight,width,height,showNames,minimumOnsetSpacing,minimumHeight,minimumLineSpacing,readable:lineSpacing>=minimumLineSpacing,
    onsetPositions:groups.map(group=>({time:group.time,endTime:group.endTime,x:cursorX+group.anchor-scroll})) };
}

function trebleClef(ctx, x, staff, space) {
  musicGlyph(ctx,'gClef',x,staff.bottom-space,space);
}

function bassClef(ctx, x, staff, space) {
  musicGlyph(ctx,'fClef',x,staff.top+space,space);
}

function drawNote(ctx, note, layout, color) {
  const space=layout.lineSpacing,width=headSize(note,space),x=note.headX;
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=Math.max(1,space*.16);
  for(const y of note.ledgerLines){ctx.beginPath();ctx.moveTo(x-width*.5-space*.4,y);ctx.lineTo(x+width*.5+space*.4,y);ctx.stroke();}
  if(note.accidental)musicGlyph(ctx,note.accidental==='sharp'?'accidentalSharp':'accidentalNatural',note.accidentalX,note.y,space);
  musicGlyph(ctx,headName(note.value),x-width*.5,note.y,space);
  const direction = note.stemDirection === 'up' ? -1 : 1;
  const stemX=note.stemX,stemEnd=note.stemEndY;
  if (note.value.stem && note.drawStem) {
    ctx.lineWidth=Math.max(.8,space*.12);ctx.lineCap='butt';ctx.beginPath();ctx.moveTo(stemX,note.stemStartY);ctx.lineTo(stemX,stemEnd);ctx.stroke();
    const name=flagName(note);if(name)musicGlyph(ctx,name,stemX-space*.06,stemEnd+MUSIC_GLYPHS[name].anchorY*space,space);
  }
  if (note.value.dots) {
    const onLine = note.ledgerLines.some(y=>Math.abs(y-note.y)<.01) || layout.staffs[note.staffIndex].lines.some(y=>Math.abs(y-note.y)<.01);
    musicGlyph(ctx,'augmentationDot',x+width*.5+space*.4,note.y-(onLine?space*.5:0),space);
  }
  if (note.value.tuplet) {
    ctx.font = `600 ${clamp(space*.85,8,12)}px "Segoe UI",sans-serif`; ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('3',stemX,note.value.stem?stemEnd+direction*space*.8:note.y-space*1.4);
  }
  if (layout.showNames) {
    ctx.font=`600 ${clamp(space*.8,8,11)}px "Segoe UI",sans-serif`;ctx.textAlign='center';ctx.textBaseline='top';
    ctx.fillText(note.name,x,note.y+space*1.1);
  }
}

/** Draws at the caller's existing DPR transform, without owning any clock. */
export function drawNotation(ctx, { notes, timeline, accent='#68d1c9', leftColor='#8facdf',
  ink='#dce8ed', muted='#9caeb7', line='#4c606b', waiting=false, ...options } = {}) {
  const layout = layoutNotation(notes,timeline,options);
  if (!layout.staffs.length) return layout;
  ctx.save(); ctx.strokeStyle=line;ctx.fillStyle=ink;ctx.lineWidth=1;ctx.globalAlpha=1;
  for (const staff of layout.staffs) for (const y of staff.lines) {
    ctx.beginPath();ctx.moveTo(6,y);ctx.lineTo(layout.width,y);ctx.stroke();
  }
  ctx.strokeStyle=ink;ctx.globalAlpha=.24;
  for (const staff of layout.staffs) for (const y of staff.lines) {
    ctx.beginPath();ctx.moveTo(6,y);ctx.lineTo(layout.width,y);ctx.stroke();
  }
  if (layout.staffs.length===2) {
    ctx.beginPath();ctx.moveTo(6,layout.staffs[0].top);ctx.lineTo(6,layout.staffs[1].bottom);ctx.stroke();
  }
  ctx.globalAlpha=1;ctx.strokeStyle=ink;
  for (const staff of layout.staffs) {
    if (staff.clef==='treble') trebleClef(ctx,11,staff,layout.lineSpacing);
    else bassClef(ctx,11,staff,layout.lineSpacing);
  }
  ctx.strokeStyle=accent;ctx.lineWidth=waiting?2:1;ctx.globalAlpha=waiting?.9:.45;
  ctx.beginPath();ctx.moveTo(layout.cursorX,5);ctx.lineTo(layout.cursorX,layout.height-5);ctx.stroke();
  ctx.save();ctx.beginPath();ctx.rect(layout.clefGutter,0,Math.max(0,layout.width-layout.clefGutter),layout.height);ctx.clip();
  for (const note of layout.notes) {
    ctx.globalAlpha=note.played?.24:note.active?1:.84;
    drawNote(ctx,note,layout,note.active?(note.hand==='left'?leftColor:accent):note.played?muted:ink);
  }
  ctx.restore();ctx.restore();
  return layout;
}
