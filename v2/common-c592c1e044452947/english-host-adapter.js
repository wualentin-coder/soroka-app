const flags=['completionAttempts','practiceEvents','speechAbort','swipes','grades','lessons','preferences','rules','serverChecking','reader','readerBookmarks','readerImport','readerDelete','readerMarks','readerTranslation','readerWordLearning','conversation','conversationErrors','conversationWrites'];
const requirements={swipe:'swipes',grade:'grades',lesson:'lessons',exercise:'lessons',unitdone:'completionAttempts',placed:'completionAttempts',ruledone:'completionAttempts',newwords:'preferences',unit:'preferences',rule:'rules',check:'serverChecking',books:'reader',book:'reader',chat:'conversation',debrief:'conversation',word:'conversation'};
const verified=lease=>!!lease&&Object.isFrozen(lease)&&lease.authorized===true&&/^[a-f0-9]{64}$/.test(lease.scope||'')&&lease.epoch!==null&&typeof lease.epoch==='object'&&Object.isFrozen(lease.epoch);

/** Facade over an ORIGINAL authenticated v2 host. No credentials, scope synthesis or DTO fallback. */
export function bindEnglishHost(source){
 if(source?.version!==2||['captureOwner','isCurrent','send','subscribeInvalidation'].some(name=>typeof source[name]!=='function'))throw Error('english_real_host_required');
 const capture=source.captureOwner.bind(source),current=source.isCurrent.bind(source),send=source.send.bind(source);
 const captureOwner=()=>{const lease=capture();return verified(lease)&&current(lease)===true?lease:null;};
 const isCurrent=lease=>verified(lease)&&current(lease)===true&&captureOwner()===lease;
 const capabilities={};for(const flag of flags)Object.defineProperty(capabilities,flag,{enumerable:true,get:()=>!!captureOwner()&&source.capabilities?.[flag]===true});Object.freeze(capabilities);
 if(!captureOwner())throw Error('english_verified_owner_required');
 return Object.freeze({version:2,capabilities,captureOwner,isCurrent,subscribeInvalidation:source.subscribeInvalidation.bind(source),async send(op,args,lease,options){
  if(!isCurrent(lease))throw Error('english_owner_changed');
  const required=requirements[op];if(required&&capabilities[required]!==true)throw Error('english_'+required+'_unavailable');
  if(op==='book'&&capabilities.readerBookmarks!==true&&args?.peek!==true)throw Error('english_bookmark_unverified');
  const response=await send(op,args,lease,options);if(!isCurrent(lease))throw Error('english_owner_changed');return response;
 }});
}

/** Authored practice MP3 only. A real provider URL never falls back to a specimen clip. */
export function englishLocalAsset(core,clip,{explicitOnly=false,base=location.origin}={}){
 const asset=clip.asset||clip.audioAsset||(!explicitOnly&&core.audio(clip.audioText||clip.word||clip.text||''));
 if(typeof asset!=='string')throw Error('Для этого фрагмента нет подключённой записи.');
 const url=new URL(asset,new URL('/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/',base));
 const assetRoot=new URL('/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/assets/',base);
 if(url.origin!==new URL(base).origin||!url.pathname.startsWith(assetRoot.pathname)||!/^en-practice-[a-f0-9]+\.mp3$/.test(url.pathname.slice(assetRoot.pathname.length))||url.search||url.hash)throw Error('Источник аудио не подключён.');
 return url.href;
}
