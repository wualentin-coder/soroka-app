const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

/** Pixel geometry only: the session remains the authority for accepted timing. */
export function practiceVisualGeometry({height,windowSeconds=.28}={}){
  if(!Number.isFinite(height)||height<=0||!Number.isFinite(windowSeconds)||windowSeconds<0||windowSeconds>2)throw new RangeError('Practice geometry needs a positive height and a bounded timing window.');
  const strikeInsetPx=Math.min(24,height/2),pxPerSecond=clamp(height/3.5,48,110);
  return {strikeY:height-strikeInsetPx,strikeInsetPx,pxPerSecond,
    windowHalfPx:Math.min(24,strikeInsetPx,windowSeconds*pxPerSecond),
    lineWidthPx:4,minNoteHeightPx:24,barWidthRatio:.88,barMaxWidthPx:88};
}

/** Shares the rendered keyboard's normalized key position; no second MIDI grid. */
export function noteBarBounds({keyPosition,canvasWidth,noteTime,duration,playhead,geometry}={}){
  if(!keyPosition||!Number.isFinite(keyPosition.center)||!Number.isFinite(keyPosition.width)||keyPosition.center<0||keyPosition.center>1||keyPosition.width<=0||keyPosition.width>1||
    !Number.isFinite(canvasWidth)||canvasWidth<=0||!Number.isFinite(noteTime)||!Number.isFinite(duration)||duration<0||!Number.isFinite(playhead)||
    !geometry||!Number.isFinite(geometry.strikeY)||!Number.isFinite(geometry.pxPerSecond)||geometry.pxPerSecond<=0||
    !Number.isFinite(geometry.minNoteHeightPx)||geometry.minNoteHeightPx<=0||!Number.isFinite(geometry.barWidthRatio)||geometry.barWidthRatio<=0||geometry.barWidthRatio>1||
    !Number.isFinite(geometry.barMaxWidthPx)||geometry.barMaxWidthPx<=0)throw new RangeError('A note bar needs the actual key position and finite score geometry.');
  const x=keyPosition.center*canvasWidth,width=Math.min(geometry.barMaxWidthPx,keyPosition.width*canvasWidth*geometry.barWidthRatio),
    height=Math.max(geometry.minNoteHeightPx,duration*geometry.pxPerSecond),bottom=geometry.strikeY+(playhead-noteTime)*geometry.pxPerSecond;
  return {x,y:bottom-height,width,height,bottom,radius:Math.min(7,width/3)};
}
