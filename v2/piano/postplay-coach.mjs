const text=(value,limit=700)=>typeof value==='string'?value.slice(0,limit).replace(/\s+/g,' ').trim():'';
const sentences=value=>text(value).match(/[^.!?]+[.!?]?/g)?.map(value=>value.trim()).filter(Boolean)||[];
const concise=value=>{
  const seen=new Set();
  return sentences(value).filter(value=>{const key=value.toLowerCase().replace(/[.!?]+$/u,'');if(/^вс[её] понятно$/i.test(key)||seen.has(key))return false;seen.add(key);return true;}).slice(0,2).join(' ');
};
const command=value=>text(value,800).toLowerCase().replace(/ё/g,'е').replace(/[.,!?;:«»"“”]/g,' ').replace(/\s+/g,' ').trim();
const YES=new Set(['да','понятно','все понятно','да понятно','да все понятно']);
const REPEAT=new Set(['повтори','повторить','повторим','еще раз','давай еще раз','повтори еще раз']);
const closed=()=>({open:false,state:'idle',advice:'',status:'',question:null,repair:null,reply:'',recording:false});

/** Coordinates a teaching pause; it never awards progress or starts recording. */
export function createPostplayCoach({teacher,onUpdate=()=>{},onClose=()=>{},onContinue=()=>{},onRepeat=()=>{},onRepair=()=>{},voice=()=>true,isActive=()=>true,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  if(!teacher)throw new TypeError('A teacher is required for the teaching pause.');
  let generation=0,view=closed(),context=null;
  const pending=new Set();
  function emit(patch){view={...view,...patch};onUpdate({...view});}
  function stopWork(){
    generation++;
    for(const stop of [...pending])stop();
    try{teacher.cancel?.();}catch{}
    return generation;
  }
  function cancel(){
    const wasOpen=view.open;stopWork();context=null;
    emit(closed());if(wasOpen)onClose();
    return Promise.resolve(wasOpen);
  }
  function active(epoch){
    if(epoch!==generation||!view.open)return false;
    let present=false;try{present=isActive()===true;}catch{}
    if(!present){cancel();return false;}return true;
  }
  function wait(work,milliseconds,epoch,{cancelOnTimeout=true}={}){
    return new Promise(resolve=>{
      if(!active(epoch)){resolve({kind:'cancelled'});return;}
      let settled=false,timer;
      const finish=result=>{
        if(settled)return;settled=true;clearTimer(timer);pending.delete(stop);
        resolve(active(epoch)?result:{kind:'cancelled'});
      };
      const stop=()=>finish({kind:'cancelled'});pending.add(stop);
      timer=setTimer(()=>{
        if(!active(epoch)){finish({kind:'cancelled'});return;}
        if(cancelOnTimeout)try{teacher.cancel?.();}catch{}
        finish({kind:'timeout'});
      },milliseconds);
      if(work)try{Promise.resolve(work()).then(value=>finish({kind:'ok',value}),error=>finish({kind:'error',error}));}catch(error){finish({kind:'error',error});}
    });
  }
  function begin(patch){const epoch=stopWork();emit(patch);return epoch;}
  function response(value){return combine(concise(value?.text),instruction(value));}
  function instruction(value){
    return sentences(text(value?.text,1600)).find(value=>/^(сыграй|повтори|попробуй|дождись|готовь|сохраняй|держи|начни|уменьши|снизь|разбери|послушай|проверь|вернись|отпусти|найди)(?=\s|[,.!?;:]|$)/iu.test(value))||'';
  }
  function combine(factual,addition){
    if(!addition)return factual;
    const first=sentences(factual)[0]||factual,extra=sentences(addition)[0];
    return extra&&!sentences(factual).some(value=>value.toLowerCase()===extra.toLowerCase())?`${first} ${extra}`:factual;
  }
  async function speak(epoch){
    if(!active(epoch))return false;
    let enabled=false;try{enabled=voice()===true;}catch{}
    if(!enabled){emit({state:'idle',status:'Совет на экране.',recording:false});return active(epoch);}
    emit({state:'speaking',status:'Преподаватель говорит…',recording:false});
    if(!active(epoch))return false;
    const result=await wait(()=>teacher.speak(`${view.advice}${view.question?' '+view.question:''}`),9000,epoch);
    if(!active(epoch))return false;
    const success=result.kind==='ok'&&result.value===true;
    emit({state:'idle',status:success?'': 'Голос недоступен. Совет на экране.',recording:false});
    return active(epoch);
  }
  async function show({feedback,lesson,report,autoContinue=false}={}){
    cancel();
    const advice=concise(feedback?.text)||'Повтори короткий участок спокойно.';
    context={feedback,lesson,report};
    const complex=feedback?.valid===true&&feedback.askUnderstanding===true;
    const epoch=generation;
    emit({open:true,state:complex?'preparing':'idle',advice,status:complex?'Готовлю короткий разбор…':'',question:complex?text(feedback.question,80)||'Всё понятно?':null,repair:feedback?.repair||null,reply:'',recording:false});
    if(!active(epoch))return false;
    const automatic=autoContinue===true&&feedback?.valid===true&&!complex;
    const readingTime=automatic?wait(null,1200,epoch,{cancelOnTimeout:false}):null;
    if(complex){
      const result=await wait(()=>teacher.review({lesson,report}),2500,epoch);
      if(!active(epoch))return false;
      const addition=result.kind==='ok'?instruction(result.value):'';
      emit({advice:combine(advice,addition),status:addition?'':'Короткий разбор на экране.'});
    }
    if(!await speak(epoch)||!active(epoch))return false;
    if(automatic){await readingTime;if(!active(epoch))return false;return continueAction();}
    return true;
  }
  function action(callback,argument){
    if(!active(generation))return Promise.resolve(false);
    const next=generation+1;cancel();
    // A close callback may itself replace the lesson and teaching pause.
    if(generation!==next)return Promise.resolve(false);
    try{Promise.resolve(callback(argument)).catch(()=>{});}catch{return Promise.resolve(false);}
    return Promise.resolve(true);
  }
  function continueAction(){return action(onContinue);}
  function repeat(){return action(onRepeat);}
  function repair(){return view.repair?action(onRepair,view.repair):repeat();}
  async function reply(question,{explanation=false}={}){
    if(!active(generation)||!context)return false;
    const saved=context,previous=view.advice;
    const epoch=begin({state:'preparing',status:'Объясняю…',recording:false});
    if(!active(epoch))return false;
    const result=saved.feedback?.valid===true?await wait(()=>teacher.review({lesson:saved.lesson,report:saved.report},{question,previousResponse:previous}),2500,epoch):{kind:'unavailable'};
    if(!active(epoch))return false;
    const answer=result.kind==='ok'?response(result.value):'';
    const fallback=explanation?'Повтори только короткий участок медленнее. Затем вернись к целой фразе.':saved.feedback.text;
    emit({advice:answer||concise(fallback)||previous,state:answer?'idle':'error',status:answer?'':'Ответ недоступен. Можно повторить или продолжить.',recording:false});
    return speak(epoch);
  }
  function explain(){return reply('Объясни проще: как повторить этот участок, опираясь только на измеренный результат.',{explanation:true});}
  async function record(){
    if(!active(generation)||!context||view.recording)return false;
    const epoch=begin({state:'listening',status:'Скажи ответ. Запись до 8 секунд.',recording:true,reply:''});
    if(!active(epoch))return false;
    const result=await wait(()=>teacher.recordReply({seconds:8}),20000,epoch);
    if(!active(epoch))return false;
    if(result.kind!=='ok'||!text(result.value,800)){
      emit({state:'error',status:'Не удалось разобрать ответ. Можно ответить кнопкой.',recording:false});return false;
    }
    const transcript=text(result.value,800),intent=command(transcript);
    emit({reply:transcript,recording:false,state:'idle',status:''});
    if(!active(epoch))return false;
    if(YES.has(intent))return continueAction();
    if(REPEAT.has(intent))return repair();
    return reply(transcript);
  }
  function stopRecording(){
    if(!active(generation)||!view.recording)return Promise.resolve(false);
    let stopped;try{stopped=teacher.stopRecording?.();}catch{stopped=false;}
    if(stopped===false){begin({state:'idle',status:'Запись остановлена. Можно ответить кнопкой.',recording:false});return Promise.resolve(false);}
    emit({state:'preparing',status:'Распознаю ответ…',recording:false});return Promise.resolve(true);
  }
  return {show,continue:continueAction,repeat,repair,explain,record,stopRecording,cancel};
}
