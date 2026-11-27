/* Headless original/cached reader. Server owns pagination and bookmarks; no second progress store. */
const DEFAULTS=Object.freeze({theme:'dark',size:19,lh:1.7,font:'serif',bright:1,contrast:1,tr:false});
const fail=reason=>Error('english_reader_'+reason),copy=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const marksDTO=value=>{if(!Array.isArray(value)||value.length>2000||value.some(word=>typeof word!=='string'||word.length>300))throw fail('bad_marks');return[...value];};
const attemptDTO=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9:._-]{1,80}$/.test(value))throw fail('bad_attempt');return value;};
function selectedWord(book,word,index){
 if(typeof word!=='string'||!/^[A-Za-z]+(?:['’–-][A-Za-z]+)*$/.test(word)||word.length>40)throw fail('bad_word');
 if(!integer(index,0,book.body.split(/\n\s*\n/).length-1))throw fail('bad_paragraph');const paragraph=paragraphs(book)[index];if(paragraph.language!=='en')throw fail('bad_paragraph');
 const normalize=value=>value.toLowerCase().replace(/’/g,"'"),tokens=paragraph.text.matchAll(/\p{L}[\p{L}\p{M}]*(?:['’–-]\p{L}[\p{L}\p{M}]*)*/gu);
 const token=[...tokens].find(token=>normalize(token[0])===normalize(word));if(!token)throw fail('word_not_in_paragraph');
 const text=paragraph.text,position=token.index;let from=position,to=position+token[0].length;
 while(from>0&&!/[.!?]/.test(text[from-1]))from--;while(to<text.length&&!/[.!?]/.test(text[to]))to++;if(to<text.length)to++;
 const sentence=text.slice(from,to).trim();if(sentence.length>300)throw fail('sentence_too_long');return{word:token[0].toLowerCase(),sentence};
}
function appearance(value,patch=false){
 if(!value||typeof value!=='object'||Array.isArray(value))throw fail('bad_appearance');const result=patch?{}:{...DEFAULTS};
 for(const [key,item]of Object.entries(value)){
  if(!Object.hasOwn(DEFAULTS,key))throw fail('bad_appearance');
  const valid=key==='theme'?['dark','black','sepia','light'].includes(item):key==='font'?['serif','sans'].includes(item):key==='tr'?typeof item==='boolean':typeof item==='number'&&Number.isFinite(item)&&(key==='size'?integer(item,14,30):key==='lh'?item>=1.3&&item<=2.2:key==='bright'?item>=.4&&item<=1.2:item>=.6&&item<=1.5);
  if(!valid)throw fail('bad_appearance');result[key]=item;
 }return result;
}
function pageDTO(raw,id){
 if(!raw||raw.id!==id||!integer(raw.pages,1,10000)||!integer(raw.page,0,raw.pages-1)||typeof raw.title!=='string'||raw.title.length>2000||typeof raw.body!=='string'||raw.body.length>3000000||!Array.isArray(raw.marks)||raw.marks.length>2000||raw.marks.some(word=>typeof word!=='string'||word.length>300))throw fail('bad_page');
 const blocks=raw.body.split(/\n\s*\n/);let tr=null;if(Array.isArray(raw.tr)&&raw.tr.length===blocks.length&&raw.tr.every(text=>typeof text==='string')&&raw.tr.reduce((n,text)=>n+text.length,0)<=6000000)tr=[...raw.tr];
 return{id:raw.id,title:raw.title,author:typeof raw.author==='string'?raw.author:null,level:typeof raw.level==='string'?raw.level:null,page:raw.page,pages:raw.pages,body:raw.body,tr,marks:[...raw.marks],trAll:raw.trAll===true,trPages:integer(raw.trPages,0,raw.pages)?raw.trPages:0,...(raw.bookmark?.saved===true&&raw.bookmark.confirmed===true&&raw.bookmark.page===raw.page?{bookmark:{saved:true,confirmed:true,page:raw.page}}:{}),...(raw.part&&integer(raw.part.from,0,raw.pages)&&integer(raw.part.to,0,raw.pages)&&integer(raw.part.ready,0,raw.pages)?{part:{from:raw.part.from,to:raw.part.to,ready:raw.part.ready}}:{})};
}
function paragraphs(book){
 if(!book)return[];const blocks=book.body.split(/\n\s*\n/),ru=blocks.map(text=>(text.match(/[а-яё]/gi)||[]).length>(text.match(/[a-z]/gi)||[]).length);
 return blocks.map((text,index)=>({index,text,language:ru[index]?'ru':'en',pairedWith:!ru[index]&&ru[index+1]?index+1:null,translation:ru[index]?null:ru[index+1]?blocks[index+1]:book.tr?.[index]||null,translationSource:ru[index]?null:ru[index+1]?'paired':book.tr?.[index]?'cached':null}));
}
export function createEnglishReaderController({host,ready=()=>{},notify=()=>{},preferences,isActive=()=>true}={}){
 if(host?.version!==2||['captureOwner','isCurrent','send','subscribeInvalidation'].some(key=>typeof host[key]!=='function')||typeof ready!=='function'||typeof notify!=='function'||typeof isActive!=='function')throw fail('bad_host');
 let owner=null,catalog=null,book=null,word=null,lastImport=null,deleted=null,prefs={...DEFAULTS},error=null,bookmark={supported:false,confirmed:false,status:'not-requested',page:null},generation=0,disposed=false,cacheChars=0;
 const cache=new Map(),pending=new Map();
 const enabled=()=>!disposed&&host.capabilities?.reader===true;
 const allowed=key=>enabled()&&host.capabilities?.[key]===true;
 const capabilities=()=>Object.freeze({reader:enabled(),original:enabled(),cachedTranslations:enabled(),bookmarks:allowed('readerBookmarks'),bookmarkAcknowledgement:allowed('readerBookmarks')&&bookmark.confirmed===true,marks:allowed('readerMarks'),translation:allowed('readerTranslation'),wordLearning:allowed('readerWordLearning'),import:allowed('readerImport'),delete:allowed('readerDelete'),appearance:enabled(),appearancePersistent:enabled()&&typeof preferences?.write==='function'});
 function clear(paint=true){generation++;for(const job of pending.values())job.abort.abort();pending.clear();cache.clear();cacheChars=0;owner=null;catalog=null;book=null;word=null;lastImport=null;deleted=null;prefs={...DEFAULTS};error=null;bookmark={supported:false,confirmed:false,status:'not-requested',page:null};if(paint&&!disposed)notify();}
 function valid(lease,epoch=generation){try{return!disposed&&isActive()===true&&owner===lease&&epoch===generation&&host.isCurrent(lease)===true;}catch{return false;}}
 function getSnapshot(){if(owner&&!valid(owner))clear(false);return freeze({owner:owner?.scope??null,catalog:copy(catalog),book:copy(book),word:copy(word),lastImport:copy(lastImport),deleted:copy(deleted),paragraphs:paragraphs(book),appearance:{...prefs},bookmark:{...bookmark},loading:pending.size>0,pending:[...pending.keys()],error,capabilities:capabilities()});}
 function paint(lease,epoch){if(valid(lease,epoch))notify();}
 function capture(){
  if(disposed)throw fail('disposed');if(!enabled())throw fail('unsupported');if(isActive()!==true)throw fail('inactive');ready();const lease=host.captureOwner();
  if(!lease?.authorized||! /^[a-f0-9]{64}$/.test(lease.scope)||host.isCurrent(lease)!==true){clear(false);throw fail('owner_changed');}
  if(owner!==lease){clear(false);owner=lease;if(typeof preferences?.read==='function')try{const loaded=preferences.read(lease);if(loaded?.then)throw fail('preferences_contract');prefs=appearance(loaded??{});}catch{error='english_reader_preferences_unavailable';}}
  if(!valid(lease))throw fail('owner_changed');return lease;
 }
 function cancelRequests(){generation++;for(const job of pending.values())job.abort.abort();pending.clear();}
 function remember(value){
  const key=value.id+':'+value.page,cost=value.body.length+(value.tr||[]).reduce((n,text)=>n+text.length,0);if(cache.has(key)){cacheChars-=cache.get(key).cost;cache.delete(key);}if(cost>8000000)return;
  cache.set(key,{value:copy(value),cost});cacheChars+=cost;while(cache.size>80||cacheChars>8000000){const key=cache.keys().next().value;cacheChars-=cache.get(key).cost;cache.delete(key);}
 }
 async function request(op,args,key,accept,quiet=false){
  const lease=capture(),epoch=generation;pending.get(key)?.abort.abort();const job={abort:new AbortController()};pending.set(key,job);paint(lease,epoch);
  try{if(!valid(lease,epoch)||pending.get(key)!==job||job.abort.signal.aborted)throw fail('stale_request');const response=await host.send(op,copy(args),lease);if(!valid(lease,epoch)||pending.get(key)!==job||job.abort.signal.aborted)throw fail('stale_request');if(response?.error)throw Error(response.error);return accept(response,lease);}
  catch(cause){if(!quiet&&valid(lease,epoch)&&pending.get(key)===job){error=cause.message;paint(lease,epoch);}throw cause;}
  finally{if(pending.get(key)===job){pending.delete(key);paint(lease,epoch);}}
 }
 async function peek(page){
  capture();if(!book||!integer(page,0,book.pages-1))return null;const id=book.id,key=id+':'+page;if(cache.has(key))return copy(cache.get(key).value);
  return request('book',{id,page,peek:true},'peek:'+key,response=>{const value=pageDTO(response,id);if(value.page!==page)throw fail('bad_page');remember(value);return copy(value);},true);
 }
 function install(value,requested){book=copy(value);word=null;deleted=null;const confirmed=requested&&value.bookmark?.confirmed===true;bookmark={supported:capabilities().bookmarks,confirmed:confirmed?true:requested?null:false,status:confirmed?'saved':requested?'unverified':'not-requested',page:value.page};error=null;remember(value);return copy(value);}
 function updateBook(patch){cache.clear();cacheChars=0;book={...book,...copy(patch)};remember(book);catalog=null;error=null;}
 async function open(id,page){
  const lease=capture();if(!integer(id,1,Number.MAX_SAFE_INTEGER)||page!==undefined&&!integer(page,0,9999))throw fail('bad_page');cancelRequests();const epoch=generation;
  const key=id+':'+page,cached=page!==undefined?cache.get(key)?.value:null,write=capabilities().bookmarks;
  let result;if(cached&&!write){result=install(cached,false);paint(owner,generation);}else result=await request('book',{id,...(page===undefined?{}:{page}),...(!write?{peek:true}:{})},'view',response=>install(pageDTO(response,id),write));
  if(!valid(lease,epoch))throw fail('stale_request');void peek(result.page+1).catch(()=>{});void peek(result.page-1).catch(()=>{});return result;
 }
 async function command(name,args={}){
  if(disposed)throw fail('disposed');
  if(name==='reader.close'){clear();return true;}
  const lease=capture();
  if(name==='reader.catalog')return request('books',{},'catalog',response=>{if(!response||!Array.isArray(response.items)||response.items.length>1000||response.items.some(item=>!item||!integer(item.id,1,Number.MAX_SAFE_INTEGER)||typeof item.title!=='string'||item.title.length>2000||!integer(item.pages,0,10000)||!integer(item.page,0,Math.max(0,item.pages-1))||!integer(item.marks,0,2000)))throw fail('bad_catalog');catalog=copy(response);error=null;return copy(catalog);});
  if(name==='reader.open')return open(args.id,args.page);
  if(name==='reader.peek')return peek(args.page);
  if(name==='reader.goto'||name==='reader.turn'){if(!book)throw fail('not_open');const page=name==='reader.goto'?args.page:book.page+args.delta;if(name==='reader.turn'&&![-1,1].includes(args.delta)||!integer(page,0,book.pages-1))throw fail('bad_page');return open(book.id,page);}
  const required={'reader.translate':'readerTranslation','reader.translationMode':'readerTranslation','reader.word':'readerWordLearning','reader.unmark':'readerMarks','reader.import':'readerImport','reader.delete':'readerDelete'}[name];
  if(required){
   if(!allowed(required))throw fail('unsupported_command');
   if(name==='reader.import'){
    const attempt=attemptDTO(args.attempt);if(typeof args.title!=='string'||!args.title.trim()||args.title.length>200||args.author!==undefined&&(typeof args.author!=='string'||args.author.length>120)||typeof args.text!=='string'||args.text.length>3000000||args.text.trim().length<200)throw fail('bad_import');
    cancelRequests();const epoch=generation,result=await request('bookadd',{title:args.title,author:args.author??'',text:args.text,attempt},'import',response=>{if(!integer(response?.id,1,Number.MAX_SAFE_INTEGER)||!integer(response.pages,1,10000))throw fail('bad_import_ack');lastImport={id:response.id,pages:response.pages};catalog=null;cache.clear();cacheChars=0;error=null;return copy(lastImport);});
    if(!valid(lease,epoch))throw fail('stale_request');await open(result.id,0);return result;
   }
   if(!book)throw fail('not_open');const id=book.id;
   if(name==='reader.translate'){
    const n=args.page??book.page;if(!integer(n,0,book.pages-1))throw fail('bad_page');const epoch=generation,original=n===book.page?copy(book):await peek(n);if(!valid(lease,epoch))throw fail('stale_request');cancelRequests();
    return request('booktr',{id,page:n},'translation',response=>{if(response?.page!==n||!Array.isArray(response.tr)||response.tr.length!==original.body.split(/\n\s*\n/).length||response.tr.some(t=>typeof t!=='string')||response.tr.reduce((sum,t)=>sum+t.length,0)>6000000)throw fail('bad_translation');const translated={...original,tr:[...response.tr],...(integer(response.trPages,0,original.pages)?{trPages:response.trPages}:{})};if(book?.id===id&&book.page===n)updateBook({tr:translated.tr,trPages:translated.trPages});else remember(translated);error=null;return{page:n,tr:[...response.tr],...(response.saved===true?{saved:true}:{})};});
   }
   if(name==='reader.translationMode'){
    if(typeof args.on!=='boolean')throw fail('bad_translation_mode');cancelRequests();return request('booktrall',{id,on:args.on},'translationMode',response=>{if(response?.saved!==true||response.trAll!==args.on||response.pages!==book.pages||!integer(response.trPages,0,book.pages)||!response.part||!integer(response.part.from,0,book.pages)||!integer(response.part.to,response.part.from,book.pages)||!integer(response.part.ready,0,response.part.to-response.part.from))throw fail('bad_translation_ack');updateBook({trAll:response.trAll,trPages:response.trPages,part:response.part});return copy(response);});
   }
   if(name==='reader.word'){
    const attempt=attemptDTO(args.attempt),selection=selectedWord(book,args.word,args.paragraphIndex);cancelRequests();return request('bookword',{id,...selection,attempt},'word',response=>{if(response?.receipt?.version!==1||response.receipt.operation!=='word'||response.receipt.attempt!==attempt||response.word!==selection.word||!integer(response.saved,1,Number.MAX_SAFE_INTEGER)||response.deck!==null&&!integer(response.deck,1,Number.MAX_SAFE_INTEGER)||typeof response.lemma!=='string'||!response.lemma.trim()||response.lemma.length>40||typeof response.ru!=='string'||!response.ru.trim()||response.ru.length>80)throw fail('bad_word_receipt');const marks=marksDTO(response.marks);updateBook({marks});word={...copy(response),...selection,paragraphIndex:args.paragraphIndex};return copy(word);});
   }
   if(name==='reader.unmark'){
    if(typeof args.word!=='string'||!args.word||args.word.length>300||!book.marks.includes(args.word))throw fail('bad_word');cancelRequests();return request('bookunmark',{id,word:args.word},'unmark',response=>{const marks=marksDTO(response?.marks);if(response.vocabularySaved!==false||marks.includes(args.word))throw fail('bad_unmark_ack');updateBook({marks});word=null;return{marks,vocabularySaved:false};});
   }
   if(name==='reader.delete'){
    if(args.id!==undefined&&args.id!==id)throw fail('bad_book');cancelRequests();return request('bookdelete',{id},'delete',response=>{if(response?.ok!==true||response.id!==id||response.deleted!==true)throw fail('bad_delete_ack');book=null;word=null;catalog=null;cache.clear();cacheChars=0;bookmark={supported:capabilities().bookmarks,confirmed:false,status:'not-requested',page:null};deleted={ok:true,id,deleted:true};error=null;return copy(deleted);});
   }
  }
  if(name==='reader.appearance'||name==='reader.resetAppearance'){
   const next=name==='reader.resetAppearance'?{...DEFAULTS}:{...prefs,...appearance(args.patch,true)},epoch=generation,token={abort:new AbortController()};pending.get('appearance')?.abort.abort();pending.set('appearance',token);
   const isCurrent=()=>valid(lease,epoch)&&pending.get('appearance')===token&&!token.abort.signal.aborted;
   try{if(typeof preferences?.write==='function')await preferences.write(copy(next),{owner:lease,isCurrent});if(!isCurrent())throw fail('stale_request');prefs=next;error=null;return{appearance:copy(prefs),persistent:typeof preferences?.write==='function'};}
   catch(cause){if(isCurrent())error=cause.message;throw cause;}
   finally{if(pending.get('appearance')===token){pending.delete('appearance');paint(lease,epoch);}}
  }
  throw fail('unsupported_command');
 }
 const release=host.subscribeInvalidation(()=>clear());
 return Object.freeze({enabled,capabilities,getSnapshot,command,cancel(){if(!disposed)clear();},dispose(){if(disposed)return;clear(false);disposed=true;release?.();}});
}
