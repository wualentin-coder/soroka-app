(function(global){
 'use strict';
 const OFFER_KEY='flow-song-quiz-offers-v1', remembered=new Map();
 const h=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const clean=value=>typeof value==='string'?value.replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\s+/g,' ').trim():'';
 const normalized=value=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const section=value=>/^[\[({].*[\])}]$/.test(value)||/^(?:intro|outro|verse|chorus|bridge|instrumental|music|припев|куплет|проигрыш|инструментал)(?:\s*\d+)?$/i.test(value);
 function eligible(track){
  const english=new Set(),russian=new Set(),rows=[];
  for(const line of Array.isArray(track?.lines)?track.lines:[]){
   const en=clean(line?.en),ru=clean(line?.ru),enKey=normalized(en),ruKey=normalized(ru).split(' ').sort().join(' ');
   if(en.length<4||en.length>180||ru.length<4||ru.length>220||!/[a-z]/i.test(en)||!/[а-яё]/i.test(ru)||enKey.split(' ').length<2||section(en)||section(ru)||/[♪♫♬]/u.test(en+ru)||english.has(enKey)||russian.has(ruKey))continue;
   english.add(enKey);russian.add(ruKey);rows.push({en,ru});
  }
  return rows;
 }
 function shuffle(items,random){
  const result=items.slice();
  for(let i=result.length-1;i>0;i--){const value=Number(random()),fraction=Number.isFinite(value)?Math.max(0,Math.min(.999999999999,value)):0;const j=Math.floor(fraction*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
 }
 function similarity(a,b){
  const left=new Set(normalized(a).split(' ')),right=new Set(normalized(b).split(' '));
  let overlap=0;for(const word of left)if(right.has(word))overlap++;
  return overlap/Math.max(left.size,right.size);
 }
 function buildQuestions(track,random=Math.random){
  const pool=shuffle(eligible(track),random);if(pool.length<3)return [];
  return pool.slice(0,3).map(row=>{
   const distractors=shuffle(pool.filter(other=>other!==row),random).sort((a,b)=>similarity(row.ru,a.ru)-similarity(row.ru,b.ru)).slice(0,2);
   const choices=shuffle([row.ru,...distractors.map(other=>other.ru)],random);
   return {en:row.en,ru:row.ru,choices,correctIndex:choices.indexOf(row.ru)};
  });
 }
 const canQuiz=track=>eligible(track).length>=3;
 function dayKey(timestamp){const date=new Date(timestamp);return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;}
 function trackKey(track){
  if(track.youtubeId)return 'youtube:'+track.youtubeId;if(track.id)return 'song:'+track.id;
  const text=clean(track.artist)+'|'+clean(track.title);let hash=2166136261;for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);return 'local:'+(hash>>>0).toString(36);
 }
 function create(options){
  const {getTrack,showSheet,closeSheet}=options,now=options.now||Date.now,random=options.random||Math.random,mayOffer=options.mayOffer||(()=>true);
  let storage=options.storage;if(storage===undefined){try{storage=global.localStorage;}catch{storage=null;}}
  let sessionTrack=null,anchor=null,listened=0,active=null,sequence=0;
  const hidden=()=>!!global.document?.hidden;
  const sameTrack=()=>!!sessionTrack&&getTrack()===sessionTrack;
  function cancel(){active=null;anchor=null;}
  function track(value){cancel();sessionTrack=value||null;listened=0;}
  function sample({time,playing,rate=1}){
   if(!sameTrack()||hidden()||!Number.isFinite(time)||time<0){anchor=null;return;}
   const at=Number(now()),speed=Number.isFinite(rate)&&rate>0?rate:1,previous=anchor;
   anchor={time,at,playing:!!playing,rate:speed};
   if(!previous||!previous.playing||!playing||previous.rate!==speed)return;
   const elapsed=(at-previous.at)/1000,delta=time-previous.time;
   // Count heard seconds rather than seek distance; speed changes and long event gaps re-anchor.
   if(elapsed>0&&elapsed<=5&&delta>0&&delta<=elapsed*speed*1.35+.25)listened+=Math.min(elapsed,delta/speed);
  }
  function readOffers(){
   try{const value=JSON.parse(storage?.getItem(OFFER_KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}
  }
  function offered(key,day){if(remembered.get(key)===day)return true;return readOffers()[key]===day;}
  function remember(key,day){
   for(const [id,date] of remembered)if(date!==day)remembered.delete(id);remembered.set(key,day);
   const records=Object.entries(readOffers()).filter(([id,date])=>date===day&&id!==key).slice(-199);records.push([key,day]);
   try{storage?.setItem(OFFER_KEY,JSON.stringify(Object.fromEntries(records)));}catch{/* The in-memory mark still suppresses repeat invitations. */}
  }
  function button(action,text,{className='',choice,disabled=false}={}){
   return `<button type="button" class="${className}" data-enm="${action}" data-quiz-session="${active.token}" data-quiz-question="${active.index}"${choice===undefined?'':` data-quiz-choice="${choice}"`}${disabled?' disabled':''}>${text}</button>`;
  }
  function render(){
   if(!active||!sameTrack()||hidden()){cancel();return false;}
   const root=body=>`<div class="enmq-root">${body}</div>`;
   let title,body;
   if(active.stage==='invite'){
    title='Проверим перевод?';
    body=`<p class="enmq-song">${h(active.title)}</p><p class="enmq-copy">Три строки из песни — выбери перевод каждой.</p><div class="enmq-actions">${button('quiz-start','Попробовать',{className:'enm-sheet-action'})}${button('quiz-later','Не сейчас',{className:'enm-sheet-action enm-secondary'})}</div>`;
   }else if(active.stage==='summary'){
    title='Перевод песни';
    body=`<div class="enmq-summary"><p class="enmq-eyebrow">Твой результат</p><p class="enmq-score">${active.score} из 3</p><p class="enmq-copy">Три строки разобраны. Можно вернуться к песне.</p></div>${button('quiz-done','К песне',{className:'enm-sheet-action'})}`;
   }else{
    title='Перевод песни';const question=active.questions[active.index],answered=active.answer!==null,correct=active.answer===question.correctIndex;
    const choices=question.choices.map((choice,index)=>{
     const status=!answered?'':index===question.correctIndex?' enmq-correct':index===active.answer?' enmq-wrong':'';
     const label=!answered?'':index===question.correctIndex?'Верный перевод':index===active.answer?'Твой ответ':'';
     return button('quiz-answer',`<span class="enmq-letter" aria-hidden="true">${['А','Б','В'][index]}</span><span lang="ru">${h(choice)}</span>${label?`<span class="enmq-choice-state">${label}</span>`:''}`,{className:'enmq-choice'+status,choice:index,disabled:answered});
    }).join('');
    body=`<div class="enmq-progress"><span class="enmq-bars" aria-hidden="true">${active.questions.map((_,index)=>`<i${index<=active.index?' class="enmq-filled"':''}></i>`).join('')}</span><span>${active.index+1} из 3</span></div><p class="enmq-prompt">Как перевести эту строку?</p><blockquote class="enmq-line" lang="en">${h(question.en)}</blockquote><div class="enmq-choices">${choices}</div>${answered?`<div class="enmq-feedback${correct?' enmq-feedback-correct':''}" role="status" aria-live="polite"><strong>${correct?'Верно':'Правильный перевод'}</strong><p lang="ru">${h(question.ru)}</p></div>${button('quiz-next',active.index===2?'Результат':'Дальше',{className:'enm-sheet-action'})}`:''}`;
   }
   try{showSheet(title,root(body));return true;}catch(error){cancel();throw error;}
  }
  function begin(value,questions,stage){active={token:String(++sequence),track:value,title:clean(value.title),questions,index:0,answer:null,score:0,stage};return render();}
  function ended({loop=false}={}){
   if(loop||active||!sameTrack()||hidden()||sessionTrack.importing||!mayOffer())return false;
   const duration=Number(sessionTrack.duration),minimum=Number.isFinite(duration)&&duration>0?Math.min(30,duration*.5):30;
   if(listened+.001<minimum)return false;
   const key=trackKey(sessionTrack),day=dayKey(Number(now()));if(offered(key,day))return false;
   const questions=buildQuestions(sessionTrack,random);if(questions.length!==3)return false;
   if(!begin(sessionTrack,questions,'invite'))return false;remember(key,day);return true;
  }
  function open(){
   const value=getTrack();if(!value||value.importing||hidden())return false;if(value!==sessionTrack)track(value);
   const questions=buildQuestions(value,random);return questions.length===3?begin(value,questions,'question'):false;
  }
  function handle(action,element){
   if(!['quiz-open','quiz-start','quiz-answer','quiz-next','quiz-later','quiz-done'].includes(action))return false;
   if(action==='quiz-open'){open();return true;}
   if(!active||!sameTrack()||hidden()){cancel();return true;}
   const data=element?.dataset||{};
   if(data.quizSession!==active.token||data.quizQuestion!==String(active.index))return true;
   if(action==='quiz-later'||action==='quiz-done'){cancel();closeSheet();return true;}
   if(action==='quiz-start'&&active.stage==='invite'){active.stage='question';render();return true;}
   if(active.stage!=='question')return true;
   if(action==='quiz-answer'&&active.answer===null&&/^[012]$/.test(data.quizChoice||'')){
    active.answer=Number(data.quizChoice);if(active.answer===active.questions[active.index].correctIndex)active.score++;render();
   }else if(action==='quiz-next'&&active.answer!==null){
    active.index++;active.answer=null;if(active.index===active.questions.length)active.stage='summary';render();
   }
   return true;
  }
  global.addEventListener?.('pagehide',cancel);
  return {track,sample,ended,open,handle,cancel};
 }
 global.FlowSongQuiz={create,buildQuestions,canQuiz};
})(globalThis);
