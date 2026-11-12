// Optional wire adapter only. App owns the authenticated host lease, lifetime,
// profile and scoped native cache. No credentials, cache, synthetic model or ACK.
export const PIANO_NATIVE_OPERATIONS=Object.freeze(['progress_load','progress_save','composition_list','composition_get','composition_import']);
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value);
const profile=value=>typeof value==='string'&&/^piano-[a-f0-9]{24}$/.test(value);
const revision=value=>Number.isSafeInteger(value)&&value>=0&&value<=2147483647;
function failure(code,message){const error=new Error(message);error.code=code;return error;}
function requireValue(value,code,message){if(!value)throw failure(code,message);}
const metadata=value=>object(value)&&id(value.id)&&typeof value.title==='string'&&!!value.title.trim()&&value.title.length<=120&&value.private===true;
export function pianoNativeArgs(op,args={}){
 if(op==='storage_save')throw failure('piano_storage_is_device_local','Настройки и журнал сохраняет локальное хранилище профиля, а не сервер Piano.');
 requireValue(PIANO_NATIVE_OPERATIONS.includes(op),'piano_native_operation_required','Действие не поддерживается сервером Piano.');
 requireValue(object(args),'piano_native_args_required','Нужны данные действия Piano.');
 if(op==='progress_load'||op==='composition_list')return {};
 if(op==='progress_save'){
  requireValue(object(args.progress)&&revision(args.baseRevision)&&args.baseRevision<2147483647,'piano_native_progress_required','Нужны прогресс и его исходная версия.');
  // The child workspace attaches an8MB device-storage snapshot. The existing
  // backend accepts a1MB progress DTO; never forward the device cache/auth data.
  return {progress:structuredClone(args.progress),baseRevision:args.baseRevision};
 }
 if(op==='composition_get'){requireValue(id(args.id),'piano_native_id_required','Нужен идентификатор композиции.');return {id:args.id};}
 requireValue(object(args.composition)&&id(args.composition.id),'piano_native_composition_required','Нужна композиция с постоянным идентификатором.');
 return {composition:structuredClone(args.composition)};
}
export function pianoNativeReply(op,answer,args={}){
 requireValue(object(answer)&&!Object.hasOwn(answer,'error'),'piano_native_ack_invalid','Сервер Piano не подтвердил действие.');
 let valid=false;
 if(op==='progress_load')valid=profile(answer.profileId)&&revision(answer.revision)&&object(answer.progress);
 else if(op==='progress_save')valid=profile(answer.profileId)&&revision(args.baseRevision)&&answer.revision===args.baseRevision+1&&object(answer.progress);
 else if(op==='composition_list')valid=Array.isArray(answer.compositions)&&answer.compositions.length<=100&&answer.compositions.every(metadata)&&new Set(answer.compositions.map(row=>row.id)).size===answer.compositions.length;
 else if(op==='composition_import')valid=metadata(answer.metadata)&&answer.metadata.id===args.composition?.id;
 else if(op==='composition_get'){
  const piece=answer.composition;
  valid=object(piece)&&piece.id===args.id&&typeof piece.title==='string'&&!!piece.title.trim()&&
   Number.isFinite(piece.tempo)&&piece.tempo>0&&piece.tempo<=400&&Array.isArray(piece.tracks)&&piece.tracks.length>0&&piece.tracks.length<=64&&
   piece.tracks.some(track=>track?.id===piece.defaultTrack&&Array.isArray(track.notes)&&track.notes.length>0)&&
   Array.isArray(piece.notes)&&piece.notes.length>0&&Number.isFinite(piece.duration)&&piece.duration>0&&piece.duration<=3600;
 }
 requireValue(valid,'piano_native_ack_invalid','Сервер Piano вернул неподтверждённый результат.');
 // Preserve the canonical server progress/metadata. Do not normalize a partial
 // response into invented success, increment a revision, or turn409 into ACK.
 return structuredClone(answer);
}
/** Supply the existing captured authenticated call(op,args), e.g. the App host's
 * request method. owner/isCurrent/subscribe and storage_save stay with App.
 * request MUST bind the real native lease; this module does not establish one. */
export function createPianoRealProvider({request}={}){
 if(typeof request!=='function')throw new TypeError('piano_authenticated_request_required');
 return Object.freeze({async request(op,args={}){
  const wire=pianoNativeArgs(op,args),answer=await request(op,wire);
  return pianoNativeReply(op,answer,wire);
 }});
}
