// Presentation follows the player's authored cues; it never advances or grades a note.
export function handPalette(accent='') {
  const rgb=accent.startsWith('#')?accent.slice(1).match(/.{2}/g)?.slice(0,3).map(v=>parseInt(v,16)):accent.match(/[\d.]+/g)?.slice(0,3).map(Number);
  return rgb?.length===3&&rgb[0]>rgb[2]*1.2&&rgb[0]>rgb[1]*.9?'#76a9ff':'#f2c14e';
}
const names=['','большой','указательный','средний','безымянный','мизинец'];
const path='M38 111 30 94Q24 80 17 68Q12 60 16 56Q20 53 25 59L35 70 30 30Q29 22 34 21Q39 20 40 28L46 54 42 12Q42 5 48 5Q54 6 54 12L57 52 59 15Q60 9 65 11Q69 12 69 18L69 55 75 30Q77 24 82 26Q87 28 84 35L78 74Q74 93 68 109';
const points=[[18,60],[34,28],[48,12],[64,17],[80,33]];
const handMarkup=hand=>`<div class="scene-hand" data-hand="${hand}"><svg viewBox="0 0 100 120" aria-hidden="true"><g class="scene-hand-outline"><path d="${path}"/>${points.map(([x,y],i)=>`<g class="scene-tip" data-finger="${i+1}" transform="translate(${x} ${y})"><circle r="7"/><text>${i+1}</text></g>`).join('')}</g></svg><div><small>${hand==='left'?'ЛЕВАЯ РУКА':'ПРАВАЯ РУКА'}</small><strong></strong><span></span></div></div>`;
export function createPracticeScene(root,{snapshot=()=>({}),onHelp=()=>{},onSkip=()=>{},onRecalibrate=()=>{},onPaletteChange=()=>{}}={}) {
  const $=s=>root.querySelector(s),panel=$('.practice-panel'),field=$('.score-stage');
  const caption=document.createElement('div');caption.className='scene-caption';caption.innerHTML='<span></span><span></span>';panel.append(caption);
  const chip=document.createElement('div');chip.className='scene-teacher';chip.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 3C35 25 39 29 61 32 39 35 35 39 32 61 29 39 25 35 3 32 25 29 29 25 32 3Z"/><ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(-35 32 32)"/><ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(55 32 32)"/></svg><span></span>';field.append(chip);
  const hands=document.createElement('div');hands.className='scene-hands';hands.setAttribute('aria-hidden','true');hands.innerHTML=handMarkup('left')+handMarkup('right');field.append(hands);
  const legend=document.createElement('div');legend.className='scene-hand-legend';legend.setAttribute('aria-label','Цвета рук');legend.innerHTML='<span><i></i>Левая</span><span><i></i>Правая</span>';field.append(legend);
  const help=document.createElement('button');help.id='scene-help';help.type='button';help.className='secondary-button';help.textContent='Разобрать с подсказкой';help.addEventListener('click',onHelp);$('#settings-dialog .settings-actions').append(help);
  const skip=document.createElement('button');skip.id='scene-skip';skip.type='button';skip.className='secondary-button';skip.textContent='Пропустить без зачёта';skip.addEventListener('click',onSkip);$('#settings-dialog .settings-actions').append(skip);
  const recalibrate=document.createElement('button');recalibrate.id='scene-calibrate';recalibrate.type='button';recalibrate.className='secondary-button';recalibrate.textContent='Настроить микрофон заново';recalibrate.addEventListener('click',onRecalibrate);$('#settings-pane-sound .settings-column').append(recalibrate);
  const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
  const hidden=(node,value)=>{if(node.hidden!==value)node.hidden=value;};
  let frame=0,disposed=false,lastHint='',dismissedHint='',previousDismissed=false;
  const keyHands=new WeakMap();
  function update(){
    frame=0;if(disposed)return;
    const state=snapshot(),hint=$('#finger-hint'),map=$('.phrase-keyboard-map'),dismissed=map?.dataset.dismissed==='true';
    hidden(help,!state.canHelp);
    hidden(skip,!state.canSkip);hidden(recalibrate,!state.canRecalibrate);
    if(dismissed&&!previousDismissed)dismissedHint=lastHint;
    if(!dismissed&&previousDismissed)dismissedHint='';previousDismissed=dismissed;
    const accent=getComputedStyle(root.host||root).getPropertyValue('--accent').trim(),left=handPalette(accent);
    if(panel.style.getPropertyValue('--hand-left')!==left)panel.style.setProperty('--hand-left',left);
    // Canvas reads from the shadow host; keep both surfaces on the same palette.
    const host=root.host||root;if(host.style.getPropertyValue('--hand-left')!==left){host.style.setProperty('--hand-left',left);onPaletteChange();}
    text(caption.children[0],$('#lesson-title')?.textContent||'');text(caption.children[1],state.stageTitle||$('#step-label')?.textContent||'');
    const live=$('#stage-state')?.textContent||'',message=state.instruction&&!/Нужна|Слышу|Рано|Поздно|ошиб/i.test(live)?state.instruction:live;text(chip.querySelector('span'),message);
    hidden(chip,!!state.intro||['calibrating','coaching','countdown'].includes(state.phase)||state.transitioning||!$('#demo-banner')?.hidden);
    const blocked=panel.classList.contains('memory-task')||panel.classList.contains('hide-target')||state.intro||state.transitioning;
    const cue=state.cue,signature=hint?.hidden?'':hint?.textContent||'';
    if(!signature) {lastHint='';dismissedHint='';}else lastHint=signature;
    const eligible=!!signature&&!blocked&&signature!==dismissedHint;
    for(const key of root.querySelectorAll('.piano-key')){
      const hand=key.classList.contains('target-left')?'left':key.classList.contains('pressed')?keyHands.get(key)||'right':'right';
      keyHands.set(key,hand);if(key.dataset.sceneHand!==hand)key.dataset.sceneHand=hand;
    }
    const fingers=[...root.querySelectorAll('.piano-key[data-finger]')].map(key=>({finger:Number(key.dataset.finger),hand:key.classList.contains('target-left')?'left':'right'}));
    for(const row of hands.children){
      const hand=row.dataset.hand,entry=fingers.find(f=>f.hand===hand&&f.finger>=1&&f.finger<=5);
      hidden(row,!entry);if(!entry)continue;
      text(row.querySelector('strong'),`${entry.finger} · ${names[entry.finger]}`);
      const position=(cue?.position?.text||'').split('.')[0].replace(/^(Правая|Левая):\s*/,'').replace(', ',' · ');
      text(row.querySelector('span'),cue?.hand===hand?(cue.movement?'Перенос руки · ':'')+(cue.provenance==='suggested'?'Предложенная аппликатура':position):'');
      for(const tip of row.querySelectorAll('.scene-tip'))tip.classList.toggle('active',Number(tip.dataset.finger)===entry.finger);
    }
    hidden(hands,!eligible||!fingers.length);hands.classList.toggle('scene-suggested',cue?.provenance==='suggested');
    hidden(legend,state.hand!=='both');
  }
  function queue(){if(!disposed&&!frame)frame=requestAnimationFrame(update);}
  const observer=new MutationObserver(queue);observer.observe(panel,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden','data-finger','data-dismissed','data-notation']});
  const themes=new MutationObserver(queue);themes.observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-theme','data-accent','data-palette','data-flow-design']});
  queue();return {destroy(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();themes.disconnect();help.removeEventListener('click',onHelp);help.remove();skip.removeEventListener('click',onSkip);skip.remove();recalibrate.removeEventListener('click',onRecalibrate);recalibrate.remove();caption.remove();chip.remove();hands.remove();legend.remove();}};
}
