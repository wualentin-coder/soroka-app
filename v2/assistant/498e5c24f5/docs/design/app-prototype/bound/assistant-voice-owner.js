/** Hold/release voice uses the existing PCM/WAV→STT owner, then the normal submit path. */
export function createAssistantVoice({element,getVoice,getSection,isCurrent,setModel}){
 let active=null;
 const current=record=>active===record&&isCurrent(record.epoch)&&record.session===element.session&&record.section===getSection()&&element.isOpen&&!element.closing&&!document.hidden;
 const paint=(phase,error='',busy=false)=>{setModel({phase,error,busy,response:null});element.emit('flow-assistant-stage',{phase});};
 function cancel(){const record=active;active=null;if(record)record.voice.cancel();}
 function fail(record,message){if(!current(record))return;active=null;paint('idle',message||'Не получилось распознать речь. Попробуй ещё раз.');}
 function onVoice(event){const record=active;if(!record||!current(record))return;const state=event.detail?.state;
  if(state==='requesting'||state==='listening'){if(record.phase!==state){record.phase=state;paint(state);}}
  else if(state==='transcribing'){record.phase=state;paint('transcribing','',true);}
  else if(state==='idle'&&record.phase!=='transcribing'){active=null;paint('idle');}
 }
 const visibility=()=>{if(document.hidden&&active){cancel();paint('idle');}};
 document.addEventListener('visibilitychange',visibility);
 document.addEventListener('flow:voice',onVoice);
 return{
  async start(request){
   const voice=getVoice();if(active||voice.getState().active){element.settle(request.requestId,{ok:false,error:'Сначала заверши текущую запись голоса.'});return;}
   const record={voice,epoch:request.ownerEpoch,session:request.session,section:request.context.key,phase:'requesting',requestId:request.requestId};active=record;paint('requesting');
   try{await voice.start(text=>{if(!current(record))return;active=null;paint('idle');element.request('flow-assistant-submit',{text,voice:true});},'Удерживай микрофон и говори',{inline:true,onError:message=>fail(record,message)});
    if(current(record))element.settle(request.requestId,{ok:true});
   }catch{fail(record,'Микрофон не включился. Проверь разрешение на запись звука.');}
  },
  async stop(request){const record=active;element.settle(request.requestId,{ok:true});if(record)element.settle(record.requestId,{ok:true});if(!record||!current(record))return;
   if(request.cancelled){cancel();paint('idle');return;}
   try{await record.voice.finish(true);if(record.phase!=='transcribing'&&isCurrent(record.epoch)&&record.session===element.session&&record.section===getSection()&&element.isOpen&&!element.closing&&element.model.phase==='idle'&&!element.model.error)paint('idle','Удерживай микрофон, пока говоришь.');}catch{fail(record,'Не получилось распознать речь. Попробуй ещё раз.');}
  },
  cancel,
  dispose(){cancel();document.removeEventListener('flow:voice',onVoice);document.removeEventListener('visibilitychange',visibility);}
 };
}
