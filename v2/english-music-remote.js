/* Server import transport. The official media player remains in the browser. */
(function(global){
 'use strict';
 const version='server-20261101', videoIdPattern=/^[A-Za-z0-9_-]{11}$/;
 const validDuration=value=>Number.isFinite(value)&&value>0&&value<=7200;
 const stopped=signal=>{if(signal.aborted)throw signal.reason||new DOMException('Отменено','AbortError');};
 function wait(ms,signal){
  stopped(signal);
  return new Promise((resolve,reject)=>{
   const finish=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);resolve();};
   const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason||new DOMException('Отменено','AbortError'));};
   const timer=setTimeout(finish,ms);signal.addEventListener('abort',abort,{once:true});
  });
 }
 function request(call,op,args,signal,timeout){
  stopped(signal);
  return new Promise((resolve,reject)=>{
   let timer;
   const finish=(fn,value)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);fn(value);};
   const abort=()=>finish(reject,signal.reason||new DOMException('Отменено','AbortError'));
   signal.addEventListener('abort',abort,{once:true});
   timer=setTimeout(()=>finish(reject,new Error('Сервер долго не отвечает. Попробуй ещё раз.')),timeout);
   Promise.resolve().then(()=>{stopped(signal);return call(op,args);}).then(value=>finish(resolve,value),error=>finish(reject,error));
  });
 }
 function create(call,settings={}){
  if(typeof call!=='function')throw new Error('Не подключён сервер музыки.');
  const config={pollMs:800,requestMs:12000,totalMs:150000,durationWaitMs:5000,durationPollMs:100,...settings};
  async function duration(options,signal){
   if(typeof options.getVideoDuration!=='function')return validDuration(options.videoDuration)?options.videoDuration:undefined;
   const until=Date.now()+config.durationWaitMs;
   while(true){
    stopped(signal);
    let value;try{value=options.getVideoDuration();}catch{return undefined;}
    if(validDuration(value))return value;
    if(Date.now()>=until)return validDuration(options.videoDuration)?options.videoDuration:undefined;
    await wait(Math.min(config.durationPollMs,until-Date.now()),signal);
   }
  }
  async function run(videoId,options={},translationOnly=false,captions=false){
   if(!videoIdPattern.test(videoId))throw new Error('Некорректная ссылка YouTube.');
   const life=new AbortController(), abort=()=>life.abort(options.signal.reason);
   options.signal?.addEventListener('abort',abort,{once:true});
   if(options.signal?.aborted)abort();
   const timeout=setTimeout(()=>life.abort(new Error('Обработка заняла слишком много времени. Открой песню позже или повтори загрузку.')),config.totalMs);
   const signal=life.signal;
   let signature='',metadataKey='';
   try{
    stopped(signal);
    let seconds;
    if(!translationOnly&&!captions){
     options.onProgress?.({stage:'metadata',status:'running',label:'Подключаю видео'});
     seconds=await duration(options,signal);
    }
    const started=await request(call,captions?'videocaptions':translationOnly?'songimportretry':'songimport',
     translationOnly?{videoId}:{videoId,...(seconds?{videoDuration:seconds}:{}),force:options.force===true},signal,config.requestMs);
    stopped(signal);
    if(!started?.jobId)throw new Error('Сервер не подтвердил загрузку песни.');
    while(true){
     const response=await request(call,'songimportstatus',{jobId:started.jobId},signal,config.requestMs);
     stopped(signal);
     const job=response?.job;
     if(!job||!['queued','running','partial','done','error'].includes(job.status))throw new Error('Не удалось получить состояние загрузки. Повтори попытку.');
     options.onProgress?.({stage:job.stage||job.status,status:job.status,label:job.label||
      (job.status==='queued'?'Песня в очереди':job.stage==='translation'?'Готовлю перевод':'Готовлю текст'),events:job.events||[],error:job.error});
     stopped(signal);
     if(job.result){
      const result=job.result;
      if(result.videoId!==videoId||!Array.isArray(result.lines)||!result.lines.length||result.lines.length>(captions?2000:500))throw new Error('Получен текст другого видео. Повтори загрузку.');
      const key=JSON.stringify([result.title,result.artist]);
      if(key!==metadataKey){metadataKey=key;await options.onMetadata?.({title:result.title,artist:result.artist});stopped(signal);}
      const next=JSON.stringify(result);
      if(next!==signature){signature=next;await options.onResult?.(result,job);stopped(signal);}
     }
     if(job.status==='done'||job.status==='partial'){
      if(!job.result)throw new Error('Источник не вернул текст песни.');
      return job.status==='partial'?{...job.result,translationError:job.error||'Перевод пока недоступен. Английский текст сохранён.'}:job.result;
     }
     if(job.status==='error')throw new Error(job.error||'Не получилось найти текст песни.');
     await wait(config.pollMs,signal);
    }
   }finally{clearTimeout(timeout);options.signal?.removeEventListener('abort',abort);}
  }
  return {prepare:(videoId,options)=>run(videoId,options),prepareVideo:(videoId,options)=>run(videoId,options,false,true),retryTranslate:(videoId,options)=>run(videoId,options,true)};
 }
 global.FlowSongRemote={version,create,shouldRefresh:track=>!!track?.youtubeId&&!!track.lyricResult&&track.lyricResult.importerVersion!==version};
})(globalThis);
