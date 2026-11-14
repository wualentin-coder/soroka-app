/* Source picker and visible, bounded playback for the native practice journal. */
(()=>{'use strict';
const h=value=>esc(String(value??''));
let picker=null,request=0,player=null,playing=null,localFile=null,localURL=null;
const difficultyCache=new Map();
function difficulty(){
 const scope=owner().lease.scope;
 if(!difficultyCache.has(scope)){let value=40;try{const saved=Number(localStorage.getItem('flow.english.lyrics.percent:'+scope));if(Number.isInteger(saved)&&saved>=10&&saved<=100&&saved%10===0)value=saved;}catch{}difficultyCache.set(scope,value);}
 return difficultyCache.get(scope);
}
function difficultyControl(){const value=difficulty();return `<label class="en-lyrics-difficulty"><span>Пропущено слов <output>${value}%</output></span><input type="range" min="10" max="100" step="10" value="${value}" data-lyrics-gap-percent aria-label="Процент пропущенных слов" aria-valuetext="${value}%"></label>`;}
const action=(label,name,attrs='',primary=false)=>`<button type="button" class="${primary?'primary-button':'ghost-button'}" data-action="en-training-media-${name}" ${attrs}>${label}</button>`;
const owner=()=>{const host=window.sorokaEnglishSession,lease=host?.captureOwner();if(!lease?.authorized||!host.isCurrent(lease))throw Error('english_owner_not_ready');return{host,lease};};
const current=c=>window.sorokaEnglishSession===c.host&&c.host.isCurrent(c.lease);
const failText=error=>({media_not_enough_words:'Выбери отрывок, в котором есть хотя бы три разных английских слова.',media_bad_lines:'Проверь английские строки и таймкоды.',lyrics_too_many_gaps:'В одной строке больше 100 пропусков. Раздели длинную строку субтитров.',lyrics_difficulty_unavailable:'На сервере ещё не доступна настройка сложности. Попробуй после обновления.',english_owner_not_ready:'Дождись подключения аккаунта.',practice_contract:'Сохранение практики пока недоступно.'}[error?.message]||error?.message||'Не удалось подготовить упражнение. Попробуй ещё раз.');
function stamp(value){const parts=value.replace(',','.').split(':').map(Number);return parts.reduce((sum,n)=>sum*60+n,0);}
function parseSubtitles(text){
 if(typeof text!=='string'||text.length>256000)throw Error('Слишком большой файл субтитров.');
 const lines=text.replace(/^\uFEFF/,'').replace(/\r/g,'').split('\n'),result=[];
 for(let i=0;i<lines.length;i++){
  const match=lines[i].match(/^\s*((?:\d{2,}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{2,}:)?\d{2}:\d{2}[.,]\d{3})/);
  if(!match)continue;const content=[];while(++i<lines.length&&lines[i].trim())content.push(lines[i]);
  const value=content.join(' ').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').trim(),[en,...ru]=value.split('|');
  const time=stamp(match[1]),end=stamp(match[2]);if(value&&time>=0&&end>time&&end<=86400)result.push({time,end,en:en.trim(),ru:ru.join('|').trim()});
 }
 if(!result.length)throw Error('Не вижу таймкодов SRT или VTT. Добавь субтитры с временными метками.');
 if(result.length>2000)throw Error('В субтитрах слишком много строк. Выбери файл короче.');
 return result.sort((a,b)=>a.time-b.time);
}
function timedLines(track){return(track.lines||[]).map((line,index,all)=>({...line,end:Number.isFinite(line.end)?line.end:Number.isFinite(all[index+1]?.time)?all[index+1].time:track.duration})).filter(line=>Number.isFinite(line.time)&&Number.isFinite(line.end)&&line.end>line.time&&typeof line.en==='string'&&line.en.trim());}
function attachPlayback(ex,track){
 if(ex.sourceMeta?.type!=='song'||!Array.isArray(track?.lines)||!window.FlowSongMedia?.phraseBounds)return;
 const offset=ex.sourceMeta.lyricOffset||0,all=track.lines,bounds=window.FlowSongMedia.phraseBounds(track);
 for(const q of ex.items||[]){
  const line=ex.sourceMeta.lines[q.sourceLine],index=all.findIndex(row=>row.en===line?.en&&row.time===line.time),range=bounds[index],clip=q.clips?.[0];if(!range||!clip)continue;
  const start=Math.max(0,range.start+offset),end=range.end+offset;
  if(Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end>start&&end-start<=120)q.playbackClip={...clip,start,end};
 }
}
function selectLines(lines,index,count){const chosen=lines.slice(index,index+count);if(!chosen.length||chosen.length!==count||chosen.at(-1).end-chosen[0].time>120)throw Error('Выбери отрывок не длиннее двух минут.');return chosen;}
function coverage(ranges,start,end){let total=0,last=start;for(const[from,to]of [...ranges].sort((a,b)=>a[0]-b[0])){const right=Math.min(end,to);total+=Math.max(0,right-Math.max(start,from,last));last=Math.max(last,right);}return total;}
async function fileIdentity(file){if(!file||file.size>128*1024*1024)throw Error('Выбери короткое видео до 128 МБ.');const bytes=await file.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);return{name:file.name,size:file.size,sha256:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')};}
function releaseFile(){if(localURL)URL.revokeObjectURL(localURL);localURL=null;localFile=null;}
function closePlayback(){const run=playing;if(!run)return;playing=null;const previous=run.focus;run.cancelled=true;run.media.pause();run.media.dispose();run.host.remove();document.getElementById('app').inert=false;player=null;if(previous?.isConnected)previous.focus();}
function stop(){request++;picker?.captionAbort?.abort();closePlayback();}
function leave(){stop();picker=null;releaseFile();}
function isPicker(p){return picker===p&&current(p.owner)&&ui.page==='english'&&enState().practiceView==='media';}
function paintError(p,error){if(!isPicker(p))return;window.FlowEnglishLyricsPractice?.cancelPrepared(undefined,false);p.error=failText(error);p.busy=false;render();}
function startSong(p){
 if(!isPicker(p)||p.busy)return;
 p.direct=true;p.index=0;p.count=0;
 for(const line of p.lines){if(p.count===12||line.end-p.lines[0].time>120)break;p.count++;}
 if(!p.count){paintError(p,Error('Для этого материала пока не готов текст. Выбери другой или обнови его в медиатеке.'));return;}
 prepare(p,'lyrics');
}
function openPicker(track,type='choice'){
 stop();const c=owner();picker={owner:c,type:track?'song':type,track:track||null,lines:track?timedLines(track):[],index:0,count:1,error:'',busy:false,videoView:'library',videos:null};
 const s=enState();s.ex=null;s.deck=null;s.tab='course';s.practiceView='media';render();if(track&&window.FlowEnglishLyricsPracticeCore)startSong(picker);else if(type==='songs'&&!window.FlowEnglishMusic?.screen)loadSongs(picker);else if(type==='youtube')loadVideos(picker);
}
async function loadSongs(p){const serial=++request;p.busy=true;render();try{const result=await enCall('songs');if(serial!==request||!isPicker(p))return;p.songs=result.items||result.songs||result||[];if(!Array.isArray(p.songs))p.songs=[];p.busy=false;render();}catch(error){if(serial===request)paintError(p,error);}}
async function loadSong(p,id){const serial=++request;p.busy=true;p.error='';render();try{const result=await enCall('song',{id});if(serial!==request||!isPicker(p))return;p.track=result.item||result.track||result;p.lines=timedLines(p.track);p.type='song';p.index=0;p.count=Math.min(3,p.lines.length)||1;p.busy=false;if(window.FlowEnglishLyricsPracticeCore)startSong(p);else render();}catch(error){if(serial===request)paintError(p,error);}}
function preview(p){try{return selectLines(p.lines,p.index,p.count).map(line=>`<p lang="en">${h(line.en)}</p>`).join('');}catch{return'<p class="section-note">Выбери более короткий отрывок.</p>';}}
window.enMediaPracticeScreen=function(){
 const p=picker;if(!p||!current(p.owner))return`<p>Выберите источник упражнения.</p>${action('Музыка и видео','catalog')}`;
 if(p.type==='choice'){
  const row=(type,title,sub,glyph)=>`<button type="button" class="en-dest" data-action="en-training-media-type" data-type="${type}"><span class="en-dest-icon" aria-hidden="true">${icon(glyph,'icon-sm')}</span><span class="en-dest-copy"><b>${title}</b><small>${sub}</small></span><span class="en-dest-arrow" aria-hidden="true">${icon('right','icon-sm')}</span></button>`;
  return `<section class="en-structured en-media-source"><button type="button" class="en-back" data-action="en-practice-back">${icon('left','icon-sm')}Вся практика</button><h2 class="en-catalog-title">По записи</h2><div class="en-dest-list">${row('songs','Песни из музыки','Выбрать из медиатеки','music')}${row('youtube','Видео с YouTube','Урок по английским субтитрам','film')}${row('file','Свой файл','Видео и субтитры','file')}</div></section>`;
 }
 if(p.type==='youtube'&&p.videoView!=='add')return videoLibrary(p);
 if(p.direct)return `<section class="en-structured en-media-source"><button type="button" class="en-back" data-action="en-training-media-catalog">${icon('left','icon-sm')}Выбрать другое</button><h2 class="en-catalog-title">${h(p.track.title)}</h2>${p.error?`<p role="alert">${h(p.error)}</p>${action('Повторить','song-retry')}`:'<p role="status">Открываем упражнение…</p>'}</section>`;
 if(p.type==='songs'&&window.FlowEnglishMusic?.screen)return `<section class="en-structured en-media-source lv-music"><button type="button" class="en-back" data-action="en-training-media-type" data-type="choice">${icon('left','icon-sm')}Выбор источника</button>${difficultyControl()}${window.FlowEnglishMusic.screen()}</section>`;
 const tabs='';
 let body='';
 if(p.type==='songs')body=p.busy?'<p role="status">Загружаем музыку…</p>':`<div class="en-steps">${(p.songs||[]).map(song=>action(`<b>${h(song.title)}</b><small>${h(song.artist)}</small>`,'song',`data-id="${h(song.id)}"`)).join('')||'<p>Сначала добавь песню в медиатеку.</p>'}</div>`;
 else{
  const importFields=p.type==='song'?`<h3>${h(p.track.title)}</h3><p class="section-note">${h(p.track.artist)}</p>`:`${p.type==='youtube'?`<label class="field"><span>Ссылка на YouTube</span><input name="url" type="url" value="${h(p.url||'')}" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="url" enterkeyhint="go" placeholder="https://youtu.be/…" ${p.busy?'disabled':''}></label>`:`<label class="field"><span>Видео</span><input name="video" type="file" accept="video/mp4,video/webm,video/*"></label>${p.file?`<p class="section-note">${h(p.file.name)}</p>`:''}`}${p.type==='youtube'?`<button type="button" class="primary-button" data-action="en-training-media-captions" ${p.busy?'disabled':''}>${p.busy?'Получаю субтитры…':'Добавить и начать'}</button><details class="en-media-manual"><summary class="ghost-button">Добавить субтитры вручную</summary>`:''}<label class="field"><span>Субтитры SRT / VTT</span><input name="subtitles" type="file" accept=".srt,.vtt,text/vtt,text/plain"></label><label class="field"><span>Или вставь субтитры</span><textarea name="subtitlesText" rows="3" maxlength="256000" placeholder="00:00:01.000 --&gt; 00:00:04.000&#10;English line | Перевод">${h(p.text||'')}</textarea></label>${action('Прочитать субтитры','parse')}<p class="section-note">Перевод необязателен. Текст берётся из твоих субтитров, без автоматического распознавания.</p>${p.type==='youtube'?'</details>':''}`;
  const selection=p.lines.length?`<div class="en-media-range"><label class="field"><span>С первой строки</span><select name="from">${p.lines.map((line,i)=>`<option value="${i}" ${p.index===i?'selected':''}>${Math.floor(line.time/60)}:${String(Math.floor(line.time%60)).padStart(2,'0')} · ${h(line.en.slice(0,70))}</option>`).join('')}</select></label><label class="field"><span>Строк</span><select name="count">${(window.FlowEnglishLyricsPracticeCore?[1,2,3,4,5,6,7,8,9,10,11,12]:[1,2,3,4,5,6]).map(n=>`<option ${p.count===n?'selected':''}>${n}</option>`).join('')}</select></label></div><div class="en-card" data-en-media-preview>${preview(p)}</div>${window.FlowEnglishLyricsPracticeCore?action(p.busy?'Готовим…':p.type==='song'?'По строкам песни':'По строкам видео','lyrics-prepare',p.busy?'disabled':'',true):''}${action(p.busy?'Готовим…':window.FlowEnglishLyricsPracticeCore?'Упражнение по фрагменту':'Начать упражнение','prepare',p.busy?'disabled':'',!window.FlowEnglishLyricsPracticeCore)}`:p.type==='song'?'<p>У этой песни пока нет таймкодов строк. Обнови текст в медиатеке или выбери другую песню.</p>':'';
  body=`<form data-en-media-source-form class="${p.type==='youtube'?'en-video-add-form':'en-media-file-form'}">${importFields}${p.type==='youtube'?'':selection}</form>`;
 }
 return `<section class="en-structured en-media-source"><button type="button" class="en-back" data-action="${p.type==='youtube'?'en-training-media-video-library':'en-training-media-type'}" data-type="choice">${icon('left','icon-sm')}${p.type==='youtube'?'Библиотека видео':'Выбор источника'}</button><h2 class="en-catalog-title">${p.type==='youtube'?'Добавить видео':p.type==='file'?'Свой файл':'Песни из музыки'}</h2>${tabs}${p.type==='youtube'?'':difficultyControl()}${p.error?`<p class="section-note" role="alert">${h(p.error)}</p>`:''}${body}</section>`;
};
function setDifficulty(value){if(!Number.isInteger(value)||value<10||value>100||value%10)return;const c=owner();difficultyCache.set(c.lease.scope,value);try{localStorage.setItem('flow.english.lyrics.percent:'+c.lease.scope,String(value));}catch{}}
async function videoCall(p,op,args={}){if(!isPicker(p))throw Error('english_owner_not_ready');const result=await p.owner.host.send(op,args,p.owner.lease);if(!isPicker(p))throw Error('english_owner_not_ready');if(!result||result.error)throw Error(typeof result?.error==='string'?result.error:'Не удалось загрузить библиотеку видео.');if(op==='videos'&&!Array.isArray(result.items)||['video','videosave'].includes(op)&&(!result.item?.videoId||!Array.isArray(result.item.lines))||op==='videoarchive'&&result.ok!==true)throw Error('Не удалось подтвердить действие. Попробуй ещё раз.');return result;}
const videoTime=value=>Math.floor(value/60)+':'+String(Math.floor(value%60)).padStart(2,'0');
function videoLibrary(p){
 const rows=(p.videos||[]).map(v=>`<article class="en-video-row"><button type="button" class="en-video-open" data-action="en-training-media-video-open" data-id="${h(v.videoId)}"><img src="https://i.ytimg.com/vi/${h(v.videoId)}/mqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer"><span><b>${h(v.title)}</b><small>${h(v.artist)}</small><small>${v.needsImport?'Из практики':v.position>0&&v.position<v.videoDuration-.5?'Продолжить · '+videoTime(v.position):videoTime(v.videoDuration)}</small></span></button><button type="button" class="icon-button en-video-delete" data-action="en-training-media-video-delete" data-id="${h(v.videoId)}" aria-label="Удалить видео">${icon('trash','icon-sm')}</button>${p.confirmDelete===v.videoId?`<div class="en-video-confirm"><p>Убрать видео из библиотеки?</p>${action('Убрать','video-confirm','data-id="'+h(v.videoId)+'"').replace('class="ghost-button"','class="ghost-button danger-button"')}${action('Оставить','video-keep')}</div>`:''}</article>`).join('');
 return `<section class="en-structured en-media-source en-video-library"><button type="button" class="en-back" data-action="en-practice-back">${icon('left','icon-sm')}Вся практика</button><div class="en-video-head"><h2 class="en-catalog-title">Мои видео</h2>${p.videos?.length?`<button type="button" class="icon-button" data-action="en-training-media-video-add" aria-label="Добавить видео">${icon('plus','icon-sm')}</button>`:''}</div>${p.error?`<p role="alert">${h(p.error)}</p>${action('Повторить','video-library')}`:''}${p.libraryLoading?'<p class="section-note" role="status">Загружаю библиотеку…</p>':rows||`<div class="en-video-empty"><p>Видео для практики будут здесь.</p>${action('Добавить видео','video-add','',true)}</div>`}</section>`;
}
async function loadVideos(p){const serial=(p.librarySerial||0)+1;p.librarySerial=serial;p.libraryLoading=true;p.error='';render();try{const result=await videoCall(p,'videos');if(p.librarySerial!==serial||p.type!=='youtube')return;p.videos=result.items||[];p.libraryLoading=false;if(p.videoView!=='add')render();}catch(error){if(p.librarySerial===serial&&isPicker(p)){p.libraryLoading=false;p.error=failText(error);if(p.videoView!=='add')render();}}}
function chooseVideoLines(p,video,position){p.video={...video,librarySaved:true};p.lines=timedLines({lines:video.lines,duration:video.videoDuration});p.index=p.lines.findIndex(line=>line.end>position);if(p.index<0)p.index=0;p.count=0;for(const line of p.lines.slice(p.index)){if(p.count===12||line.end-p.lines[p.index].time>120)break;p.count++;}if(!p.count)throw Error('Не найден подходящий фрагмент.');p.url='https://www.youtube.com/watch?v='+video.videoId;}
async function saveManualVideo(p){const serial=++request;p.busy=true;const typing=window.FlowEnglishLyricsPractice?.prepareInput();if(typing)typing.onCancel=()=>{if(serial===request){request++;p.busy=false;}};try{const link=FlowSongMedia.parseLink(p.url||''),video={videoId:link.id,title:'Видео с YouTube',artist:'',videoDuration:p.lines.at(-1).end,language:'en',automatic:false,lines:p.lines};const saved=await videoCall(p,'videosave',{video});if(serial!==request||typing&&!window.FlowEnglishLyricsPractice.inputPrepared(typing))return;chooseVideoLines(p,saved.item,link.start);p.busy=false;await prepare(p,'lyrics');}catch(error){if(serial===request)paintError(p,error);}}
async function openVideo(p,id){if(p.busy)return;const serial=++request;p.busy=true;p.error='';const typing=window.FlowEnglishLyricsPractice?.prepareInput();if(typing)typing.onCancel=()=>{if(serial!==request)return;request++;p.busy=false;};try{const result=await videoCall(p,'video',{videoId:id});if(serial!==request||!isPicker(p)||typing&&!window.FlowEnglishLyricsPractice.inputPrepared(typing))return;const video=result.item;chooseVideoLines(p,video,video.position<video.videoDuration-.5?video.position:0);p.busy=false;await prepare(p,'lyrics');}catch(error){if(serial===request)paintError(p,error);}}
async function archiveVideo(p,id){if(p.deleting)return;p.deleting=true;try{await videoCall(p,'videoarchive',{videoId:id});if(!isPicker(p))return;p.videos=(p.videos||[]).filter(v=>v.videoId!==id);p.confirmDelete=null;render();}catch(error){paintError(p,error);}finally{p.deleting=false;}}
function saveVideoProgress(ex,position,host,lease){if(!ex.videoLibraryId||!host?.isCurrent(lease))return;try{Promise.resolve(host.send('videoprogress',{videoId:ex.videoLibraryId,position:Math.min(position,ex.sourceMeta.end)},lease)).catch(()=>{});}catch{}}
function sourceForm(){return document.querySelector('[data-en-media-source-form]');}
function captureForm(p){if(p.direct)return;const form=sourceForm();if(!form)return;if(form.elements.url)p.url=form.elements.url.value;if(form.elements.subtitlesText)p.text=form.elements.subtitlesText.value;if(form.elements.from)p.index=Number(form.elements.from.value);if(form.elements.count)p.count=Number(form.elements.count.value);}
async function prepare(p,style){
 if(p.busy)return;captureForm(p);p.busy=true;p.error='';const serial=++request;render();
 const typing=style==='lyrics'?window.FlowEnglishLyricsPractice?.prepareInput():null;
 if(typing)typing.onCancel=()=>{if(serial!==request||!isPicker(p))return;request++;picker=null;const s=enState();if(s.tab==='course'){s.ex=null;s.practiceView='media';render();}};
 try{
  if(p.owner.host.capabilities?.practiceEvents!==true)throw Error('practice_contract');
  const lines=selectLines(p.lines,p.index,p.count),offset=p.type==='song'?(p.track.lyricOffset||0):0,start=Math.max(0,lines[0].time+offset),end=lines.at(-1).end+offset;
  let source;if(p.type==='song')source={type:'song',songId:p.track.id,start,end};
  else if(p.type==='youtube'){const link=FlowSongMedia.parseLink(p.url||'');if(p.video&&p.video.videoId!==link.id)throw Error('Ссылка изменилась. Получи субтитры нового видео.');source={type:'youtube',youtubeId:link.id,title:(p.video?.title||'Фрагмент видео').slice(0,300),start,end,lines};}
  else{if(!p.file)throw Error('Сначала выбери видео.');source={type:'file',file:p.file,title:p.file.name,start,end,lines};}
  const gapPercent=difficulty(),result=await enCall('practicesource',{source,seed:crypto.getRandomValues(new Uint32Array(1))[0],...(style==='lyrics'?{style,gapPercent}:{})});
  if(serial!==request||!isPicker(p)||typing&&!window.FlowEnglishLyricsPractice.inputPrepared(typing))return;
  if(style==='lyrics'&&(result.exercise?.gapPercent!==gapPercent||result.exercise?.contentRevision!==window.FlowEnglishLyricsPracticeCore?.revisions[gapPercent]))throw Error('lyrics_difficulty_unavailable');
  const accepted=englishAction('en-training-media-ready',{dataset:{},exercise:result.exercise,owner:p.owner,serial});
  if(accepted===false)throw Error('Не удалось сохранить упражнение на устройстве. Освободи память и попробуй ещё раз.');
 }catch(error){if(serial===request)paintError(p,error);}
}
async function loadVideoCaptions(p){
 if(p.busy||p.type!=='youtube')return;captureForm(p);p.error='';if(p.manual&&p.lines.length){saveManualVideo(p);return;}
 let link;try{link=FlowSongMedia.parseLink(p.url||'');}catch(error){paintError(p,error);return;}
 const serial=++request,controller=new AbortController();p.captionAbort=controller;p.video=null;p.lines=[];p.index=0;p.count=1;p.busy=true;render();
 const typing=window.FlowEnglishLyricsPractice?.prepareInput();
 if(typing)typing.onCancel=()=>{if(serial!==request||!isPicker(p))return;request++;controller.abort();p.busy=false;render();};
 try{
  const remote=window.FlowSongRemote?.create((op,args)=>p.owner.host.send(op,args,p.owner.lease));if(!remote?.prepareVideo)throw Error('Обнови приложение для загрузки субтитров.');
  let video=await remote.prepareVideo(link.id,{signal:controller.signal,onProgress:stage=>{const label=typing?.node.querySelector('[data-lyrics-wait] p');if(label)label.textContent=stage.label||'Получаю субтитры…';}});
  if(serial!==request||!isPicker(p)||typing&&!window.FlowEnglishLyricsPractice.inputPrepared(typing))return;
  const saved=await videoCall(p,'videosave',{video:{...video,title:String(video.title||'Видео с YouTube').slice(0,300),artist:String(video.artist||'').slice(0,200)}});if(serial!==request||!isPicker(p))return;video={...saved.item,librarySaved:true};
  p.video=video;p.lines=timedLines({lines:video.lines,duration:video.videoDuration});p.index=p.lines.findIndex(line=>line.end>link.start);if(p.index<0)throw Error('После выбранной позиции нет английских субтитров.');
  p.count=0;for(const line of p.lines.slice(p.index)){if(p.count===12||line.end-p.lines[p.index].time>120)break;p.count++;}
  if(!p.count)throw Error('Не найден подходящий фрагмент субтитров.');p.busy=false;render();
  await prepare(p,'lyrics');
 }catch(error){if(serial===request&&isPicker(p)&&!controller.signal.aborted)paintError(p,error);}
 finally{if(p.captionAbort===controller)p.captionAbort=null;}
}
function actionHandler(name,control){
 const d=control.dataset||{};
 if(name==='catalog'){openPicker();return true;}
 if(name==='catalog-songs'){openPicker(undefined,'songs');return true;}
 if(name==='catalog-video'){openPicker(undefined,'youtube');return true;}
 if(name==='return'){const s=enState(),id=s.ex?.sourceMeta?.songId;if(!id)return true;stop();s.ex=null;s.tab='read';s.mediaTab='music';render();window.flowEnglishSession.effect(()=>window.FlowEnglishMusic?.openSaved(id));return true;}
 if(name==='ready'){
  if(!picker||control.serial!==request||!current(control.owner)||!isPicker(picker))return true;
  if(control.owner.host.capabilities?.practiceEvents!==true)throw Error('practice_contract');
  const ex=control.exercise,isLyrics=!!window.FlowEnglishLyricsPracticeCore?.forRevision(ex?.contentRevision);if(ex?.practiceKind!=='media'||ex.contentRevision!==window.FlowEnglishMediaPracticeCore?.revision&&!isLyrics)throw Error('practice_content_changed');
  ex.sessionId=crypto.randomUUID();if(picker.video?.librarySaved)ex.videoLibraryId=picker.video.videoId;const s=enState();s.ex=structuredClone(ex);s.ex.autoPlay=isLyrics;if(s.ex.autoPlay)attachPlayback(s.ex,picker.track);s.deck=null;s.tab='course';window.flowEnglishSession.effect(()=>{if(s.ex.autoPlay&&window.FlowEnglishLyricsPractice?.keepPreparedDuring)window.FlowEnglishLyricsPractice.keepPreparedDuring(enStopPcm);else enStopPcm();picker=null;});render();return true;
 }
 const p=picker;if(!p||!current(p.owner))return true;
 if(name==='video-library'){p.videoView='library';p.error='';loadVideos(p);return true;}
 if(name==='video-add'){p.videoView='add';p.error='';p.lines=[];p.video=null;p.manual=false;p.url='';render();window.flowEnglishSession.effect(()=>sourceForm()?.elements.url?.focus({preventScroll:true}));return true;}
 if(name==='video-open'){const item=(p.videos||[]).find(v=>v.videoId===d.id);if(item?.needsImport){p.url='https://www.youtube.com/watch?v='+d.id;loadVideoCaptions(p);}else openVideo(p,d.id);return true;}
 if(name==='video-delete'){p.confirmDelete=d.id;render();return true;}
 if(name==='video-keep'){p.confirmDelete=null;render();return true;}
 if(name==='video-confirm'){archiveVideo(p,d.id);return true;}
 if(name==='captions'){loadVideoCaptions(p);return true;}
 if(name==='type'){p.captionAbort?.abort();captureForm(p);p.error='';p.busy=false;p.type=d.type;p.video=null;p.lines=[];p.index=0;p.count=1;request++;if(p.type==='songs'&&!window.FlowEnglishMusic?.screen)loadSongs(p);else if(p.type==='youtube'){p.videoView='library';loadVideos(p);}else render();return true;}
 if(name==='song'){loadSong(p,d.id);return true;}
 if(name==='song-retry'){startSong(p);return true;}
 if(name==='parse'){captureForm(p);try{p.lines=parseSubtitles(p.text||'');if(p.type==='youtube')p.manual=true;p.index=0;p.count=Math.min(3,p.lines.length);p.error='';}catch(error){p.error=failText(error);}render();return true;}
 if(name==='lyrics-prepare'){prepare(p,'lyrics');return true;}
 if(name==='prepare'){prepare(p);return true;}
 return true;
}
async function attachFile(file,source,guard=()=>true){const c=owner(),identity=await fileIdentity(file);if(!current(c)||!guard())throw Error('owner_changed');if(source&&['name','size','sha256'].some(key=>identity[key]!==source.file[key]))throw Error('Это другой файл. Выбери исходное видео упражнения.');releaseFile();localFile=identity;localURL=URL.createObjectURL(file);return identity;}
async function play(ex,key,slow=false){
 closePlayback();const serial=++request,c=owner(),source=ex.sourceMeta,q=window.FlowEnglishMediaPracticeCore.resolve(ex.items[ex.index],ex.branch||0),clip=q.clips?.[Number(key.split(':')[1])];
 const validRequest=()=>serial===request&&current(c)&&ui.page==='english'&&!document.hidden&&enState().ex?.sessionId===ex.sessionId&&enState().ex?.index===ex.index;
 if(!clip)throw Error('Не найден фрагмент.');
 if(source.type==='file'&&(!localURL||localFile?.sha256!==source.file.sha256)){
  const input=document.createElement('input');input.type='file';input.accept='video/*';input.setAttribute('aria-label','Выбрать исходное видео');input.addEventListener('change',async()=>{if(!validRequest())return;try{await attachFile(input.files?.[0],source,validRequest);if(validRequest())play(enState().ex,key,slow);}catch(error){if(validRequest())toast(failText(error));}},{once:true});input.click();return;
 }
 const host=document.createElement('section');host.className='en-media-playback';host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label','Прослушать фрагмент');
 host.innerHTML=`<div class="en-card"><div class="en-row"><b>${h(source.title)}</b><button type="button" class="icon-button" data-media-close aria-label="Вернуться к ответу">${icon('close','icon-sm')}</button></div><video controls playsinline preload="metadata"></video><div data-media-youtube></div><p class="section-note" role="status">${Math.round(clip.start)}–${Math.round(clip.end)} с${slow?' · медленнее':''}</p><button type="button" class="primary-button" data-media-play>Воспроизвести</button></div>`;
 document.body.append(host);document.getElementById('app').inert=true;const native=host.querySelector('video'),media=new FlowSongMedia(native);player=media;
 const track=source.youtubeId?{youtubeId:source.youtubeId,start:clip.start,watchUrl:'https://www.youtube.com/watch?v='+source.youtubeId}:{source:source.type==='file'?localURL:source.source,start:clip.start};
 if(!source.youtubeId&&!track.source){host.remove();document.getElementById('app').inert=false;throw Error('Источник записи недоступен.');}
 native.hidden=!!source.youtubeId;const run={host,media,focus:document.activeElement,cancelled:false,sid:ex.sessionId,index:ex.index,key,c,clip,ranges:[],anchor:null};playing=run;
 const valid=()=>playing===run&&!run.cancelled&&current(c)&&ui.page==='english'&&!document.hidden&&enState().ex?.sessionId===run.sid&&enState().ex?.index===run.index;
 function finish(){if(!valid())return;const heard=coverage(run.ranges,clip.start,clip.end)>=.9*(clip.end-clip.start);closePlayback();if(heard)englishAction('en-training-heard',{dataset:{sid:run.sid,index:String(run.index),key}});else toast('Фрагмент прослушан не целиком. Повтори или открой текст.');}
 media.addEventListener('timeupdate',()=>{
  if(!valid()){closePlayback();return;}const time=media.currentTime,now=Date.now(),last=run.anchor;
  if(last&&!media.paused){const elapsed=(now-last.at)/1000,delta=time-last.time;if(elapsed>0&&elapsed<=5&&delta>0&&delta<=elapsed*media.playbackRate*1.35+.25)run.ranges.push([last.time,time]);}
  run.anchor={time,at:now};if(time>=clip.end)finish();else if(time<clip.start-.25){media.currentTime=clip.start;run.anchor=null;media.pause();}
 });
 media.addEventListener('play',()=>{if(!valid()){closePlayback();return;}if(media.currentTime<clip.start||media.currentTime>=clip.end)media.currentTime=clip.start;run.anchor={time:media.currentTime,at:Date.now()};});
 media.addEventListener('pause',()=>{run.anchor=null;});media.addEventListener('ended',finish);
 media.addEventListener('error',()=>{if(valid())host.querySelector('[role=status]').textContent='Не удалось включить видео. Проверь доступ к источнику.';});
 let initialized=false;media.addEventListener('loadedmetadata',()=>{if(valid()&&!initialized){initialized=true;media.currentTime=clip.start;const rates=media.getRates();media.playbackRate=slow?(rates.filter(x=>x<1).sort((a,b)=>b-a)[0]||1):1;}});
 host.querySelector('[data-media-close]').onclick=closePlayback;
 host.querySelector('[data-media-play]').onclick=()=>media.play().catch(error=>{if(valid())host.querySelector('[role=status]').textContent=failText(error);});
 host.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closePlayback();}if(event.key==='Tab'){const nodes=[...host.querySelectorAll('button,video:not([hidden]),iframe')].filter(x=>!x.disabled),first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
 media.setTrack(track);media.mount(host.querySelector('[data-media-youtube]'));host.querySelector('[data-media-close]').focus();
}
document.addEventListener('change',async event=>{
 const field=event.target,p=picker;if(!p||!field.closest?.('[data-en-media-source-form]')||!current(p.owner))return;
 captureForm(p);
 if(field.name==='from'||field.name==='count'){const node=document.querySelector('[data-en-media-preview]');if(node)node.innerHTML=preview(p);return;}
 if(field.name==='video'){p.busy=true;const serial=++request;try{const identity=await attachFile(field.files?.[0],null,()=>serial===request&&isPicker(p));if(serial!==request||!isPicker(p))return;captureForm(p);p.file=identity;p.busy=false;p.error='';render();}catch(error){if(serial===request){captureForm(p);paintError(p,error);}}}
 if(field.name==='subtitles'){try{const serial=++request,file=field.files?.[0];if(!file||file.size>256000)throw Error('Выбери субтитры до 256 КБ.');const text=await file.text();if(serial!==request||!isPicker(p))return;p.text=text;p.lines=parseSubtitles(text);if(p.type==='youtube')p.manual=true;p.index=0;p.count=Math.min(3,p.lines.length);p.error='';render();}catch(error){paintError(p,error);}}
});
document.addEventListener('submit',event=>{if(event.target.matches?.('[data-en-media-source-form]')){event.preventDefault();if(picker){if(picker.type==='youtube'&&!picker.lines.length)loadVideoCaptions(picker);else prepare(picker,window.FlowEnglishLyricsPracticeCore?'lyrics':undefined);}}});
document.addEventListener('input',event=>{
 const field=event.target;if(!field.matches?.('[data-lyrics-gap-percent]'))return;
 const value=Number(field.value);if(!Number.isInteger(value)||value<10||value>100||value%10)return;
 const c=owner();difficultyCache.set(c.lease.scope,value);try{localStorage.setItem('flow.english.lyrics.percent:'+c.lease.scope,String(value));}catch{}
 field.setAttribute('aria-valuetext',value+'%');field.closest('.en-lyrics-difficulty').querySelector('output').textContent=value+'%';
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)closePlayback();});window.addEventListener('pagehide',leave);
window.sorokaEnglishSession?.subscribeInvalidation(()=>{leave();});
window.FlowEnglishMediaPractice={setDifficulty,saveVideoProgress,action:actionHandler,openSong(track){openPicker(track);},play,stop,difficultyControl,tools:{parseSubtitles,selectLines,coverage,timedLines,attachPlayback,fileIdentity,fileSource(source){return source?.type==='file'&&localFile?.sha256===source.file?.sha256&&localFile?.size===source.file?.size?localURL:null;}}};
})();
