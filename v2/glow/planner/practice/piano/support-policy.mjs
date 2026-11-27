const validLevel=value=>Number.isInteger(value)&&value>=0&&value<=3;

export function supportLevel(stage){
  if(validLevel(stage?.supportLevel))return stage.supportLevel;
  const p=stage?.presentation||{};
  return p.target?0:p.names?1:p.fingers?2:3;
}

export function isSupportAnchor(stage,{index=0,afterPause=false,transition=false}={}){
  return index===0||afterPause===true||transition===true||Array.isArray(stage?.transitionIndices)&&stage.transitionIndices.includes(index);
}

export function resolveSupport(stage,context={}){
  if(stage?.assessment&&context.independentRhythm===true)return {target:false,names:false,staff:false,falling:false,fingers:false,preview:false,pulse:true};
  const original=stage?.presentation||{},base=supportLevel(stage);
  const level=validLevel(context.helpLevel)?Math.min(base,context.helpLevel):base;
  const hidden=!original.target&&!original.names&&!original.staff&&!original.falling;
  const fingers=level<2||level===2&&isSupportAnchor(stage,context);
  return {...original,target:level===0,names:level<=1,
    staff:level<3?true:original.staff===true,
    falling:original.falling===true,fingers:hidden&&level===3?false:fingers,
    preview:stage?.assessment?stage.replayAllowed===true:original.preview===true};
}

export function nextHelpLevel(stage,current=supportLevel(stage)){
  return Math.max(0,(validLevel(current)?Math.min(current,supportLevel(stage)):supportLevel(stage))-1);
}

export function supportLabel(stage,level=supportLevel(stage)){
  if(level===0)return 'Полная подсказка';
  if(level===1)return 'Названия и пальцы';
  if(level===2)return 'Ориентир в трудном месте';
  const p=stage?.presentation||{};return p.staff?'Только нотный стан':'По памяти';
}
