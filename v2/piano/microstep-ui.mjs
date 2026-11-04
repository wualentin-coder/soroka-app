import {pitchNotation} from './notation.mjs?v=ee88d828b262';

const FINGERS=['','большой','указательный','средний','безымянный','мизинец'];
const POINTS=[[9,29],[22,13],[36,8],[50,13],[63,22]];
const text=(value,max)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
const hand=value=>['right','Правая рука'].includes(value)?'right':['left','Левая рука'].includes(value)?'left':null;

export const MICROSTEP_HTML=`<section id="microstep-panel" class="microstep-panel" role="group" aria-labelledby="microstep-title" aria-describedby="microstep-instruction" data-phase="ready" hidden>
  <div class="microstep-copy"><div class="microstep-heading"><span id="microstep-count" class="microstep-count"></span><h3 id="microstep-title"></h3><span id="microstep-cue" class="microstep-cue" hidden></span><small id="microstep-help-status" class="microstep-help-status"></small></div><p id="microstep-instruction" class="microstep-instruction"></p></div>
  <div id="microstep-hand" class="microstep-hand" role="img" hidden><svg viewBox="0 0 72 44" aria-hidden="true"><path class="microstep-palm" d="M10 37Q5 33 8 29L16 25L18 16Q20 10 24 15L28 25L31 11Q34 4 38 10L41 24L46 15Q49 9 53 15L55 29L60 23Q65 19 67 24L64 37Q48 44 29 40Z"/>${POINTS.map(([x,y],index)=>`<g data-microstep-finger="${index+1}"><circle cx="${x}" cy="${y}" r="7"/><text x="${x}" y="${y}" dominant-baseline="central" text-anchor="middle">${index+1}</text></g>`).join('')}</svg></div>
  <div class="microstep-actions" role="group" aria-label="Управление текущим шагом"><button id="microstep-help" class="microstep-help" type="button" aria-describedby="microstep-help-status">Подсказка</button><button id="microstep-repeat" class="microstep-icon-button" type="button" aria-label="Повторить текущий шаг" title="Повторить шаг"><svg class="icon" aria-hidden="true"><use href="#i-repeat"/></svg></button><button id="microstep-skip" class="microstep-skip" type="button" aria-label="Пропустить текущий шаг без зачёта" title="Пропустить без зачёта" hidden>Пропустить</button></div>
  <div id="microstep-progress" class="microstep-progress" role="progressbar" aria-label="Этапы текущего урока" aria-valuemin="0" aria-valuemax="1" aria-valuenow="0"><span></span></div>
</section>`;

/** Scene position is not a grade: selecting the last unfinished step is below 100%. */
export function microstepViewModel(model){
  const hidden={visible:false,title:'',instruction:'',count:'',cue:null,allowHelp:false,allowSkip:false,phase:'ready',progress:0,total:1,completed:0};
  if(!model||model.visible!==true||!Number.isSafeInteger(model.total)||model.total<1||model.total>1000||
    !Number.isSafeInteger(model.index)||model.index<0||model.index>=model.total||!['ready','playing','complete'].includes(model.phase))return hidden;
  const source=model.cue,validCue=source&&Number.isInteger(source.midi)&&source.midi>=0&&source.midi<=127;
  const finger=validCue&&Number.isInteger(source.finger)&&source.finger>=1&&source.finger<=5?source.finger:null;
  const side=validCue?hand(source.hand):null;
  const cue=validCue?{midi:source.midi,name:source.showName===false?'':text(source.name,32)||pitchNotation(source.midi).name,
    staffText:text(source.staffText,100),finger,hand:side,position:text(source.position,80)}:null;
  if(cue){cue.badge=[cue.name,finger?`${finger} — ${FINGERS[finger]}`:''].filter(Boolean).join(' · ');
    cue.description=['Подсказка',cue.name,cue.staffText,finger?`${finger} — ${FINGERS[finger]}`:'',side?side==='left'?'левая рука':'правая рука':'',cue.position].filter(Boolean).join('. ');}
  const completed=model.index+(model.phase==='complete'?1:0);
  return {visible:true,title:text(model.title,120)||'Текущий шаг',instruction:text(model.instruction,300),
    count:`Шаг ${model.index+1} из ${model.total}`,phase:model.phase,total:model.total,completed,progress:completed/model.total,
    helpLabel:text(model.helpLabel,60)||'Подсказка',cue,allowHelp:model.allowHelp===true,allowSkip:model.allowSkip===true};
}

/** Owns only its DOM/listeners; the player owns assistance, transitions and scores. */
export function createMicrostepView(root,{onHelp,onSkip,onRepeat}={}){
  const panel=root?.matches?.('#microstep-panel')?root:root?.querySelector?.('#microstep-panel');
  if(!panel)throw new TypeError('Microstep markup must be mounted before creating its view.');
  const find=selector=>{const node=panel.querySelector(selector);if(!node)throw new TypeError(`Missing microstep control: ${selector}`);return node;};
  const title=find('#microstep-title'),instruction=find('#microstep-instruction'),count=find('#microstep-count'),
    cue=find('#microstep-cue'),diagram=find('#microstep-hand'),progress=find('#microstep-progress'),fill=progress.querySelector('span'),
    help=find('#microstep-help'),helpStatus=find('#microstep-help-status'),skip=find('#microstep-skip'),repeat=find('#microstep-repeat');
  const fingers=[...panel.querySelectorAll('[data-microstep-finger]')],palm=diagram.querySelector('.microstep-palm');
  let view=microstepViewModel(null),destroyed=false;
  const handlers=[[help,()=>{if(!destroyed&&view.visible&&view.allowHelp)onHelp?.();}],
    [skip,()=>{if(!destroyed&&view.visible&&view.allowSkip)onSkip?.();}],
    [repeat,()=>{if(!destroyed&&view.visible)onRepeat?.();}]];
  for(const [node,handler]of handlers)node.addEventListener('click',handler);
  const content=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
  function render(model){
    if(destroyed)return false;view=microstepViewModel(model);panel.hidden=!view.visible;
    panel.dataset.phase=view.phase;content(title,view.title);content(instruction,view.instruction);content(count,view.count);
    instruction.title=view.instruction;title.title=view.title;help.hidden=!view.allowHelp;skip.hidden=!view.allowSkip;
    content(help,'Подсказка');help.setAttribute('aria-label','Показать подсказку');content(helpStatus,view.visible?view.helpLabel||'':'');
    progress.setAttribute('aria-valuemax',String(view.total));progress.setAttribute('aria-valuenow',String(view.completed));
    progress.setAttribute('aria-valuetext',view.visible?`${view.count}${view.phase==='complete'?'. Шаг завершён.':'. Текущий шаг.'}`:'');
    fill.style.transform=`scaleX(${view.progress})`;
    content(cue,view.cue?.badge||'');cue.hidden=!view.cue;cue.title=view.cue?.description||'';
    const showHand=!!(view.cue?.finger&&view.cue.hand&&view.phase==='ready');diagram.hidden=!showHand;
    if(showHand){diagram.setAttribute('aria-label',view.cue.description);palm.setAttribute('transform',view.cue.hand==='left'?'translate(72 0) scale(-1 1)':'');
      for(const group of fingers){const number=Number(group.dataset.microstepFinger),[baseX,y]=POINTS[number-1],x=view.cue.hand==='left'?72-baseX:baseX;
        group.dataset.active=String(number===view.cue.finger);group.querySelector('circle').setAttribute('cx',String(x));
        const label=group.querySelector('text');label.setAttribute('x',String(x));label.setAttribute('y',String(y));}}
    else diagram.removeAttribute('aria-label');
    const active=root.activeElement||panel.ownerDocument?.activeElement;
    if(view.visible&&(active===help&&help.hidden||active===skip&&skip.hidden))repeat.focus?.({preventScroll:true});
    return view.visible;
  }
  function destroy(){if(destroyed)return;render(null);destroyed=true;for(const [node,handler]of handlers)node.removeEventListener('click',handler);}
  render(null);return {render,destroy};
}
