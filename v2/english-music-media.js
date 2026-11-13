(function(global){
/* Visible official YouTube player; native files and YouTube share the lesson clock. */
function parseYouTubeLink(value) {
 let url;try{url=new URL(/^https?:\/\//i.test(value.trim())?value.trim():'https://'+value.trim());}catch{throw new Error('Проверь ссылку на YouTube.');}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('Нужна обычная ссылка на видео YouTube.');
 const host=url.hostname.toLowerCase().replace(/^www\./,''),parts=url.pathname.split('/').filter(Boolean);
 let id='';
 if(host==='youtu.be')id=parts[0]||'';
 else if(['youtube.com','m.youtube.com','music.youtube.com'].includes(host))id=parts[0]==='watch'?url.searchParams.get('v')||'':['shorts','embed','live'].includes(parts[0])?parts[1]||'':'';
 else if(host==='youtube-nocookie.com'&&parts[0]==='embed')id=parts[1]||'';
 else throw new Error('Это не ссылка на YouTube. Вставь youtube.com или youtu.be.');
 if(!/^[A-Za-z0-9_-]{11}$/.test(id))throw new Error('Не вижу видео в ссылке. Ссылка на канал или плейлист не подойдёт.');
 const stamp=url.searchParams.get('t')||url.searchParams.get('start')||new URLSearchParams(url.hash.slice(1)).get('t')||'';
 let start=0;
 if(/^\d+(?:\.\d+)?s?$/.test(stamp))start=Math.floor(parseFloat(stamp));
 else {const m=stamp.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);if(m&&stamp)start=+(m[1]||0)*3600+ +(m[2]||0)*60+ +(m[3]||0);}
 return {id,start,url:`https://www.youtube.com/watch?v=${id}${start?'&t='+start+'s':''}`};
}
let youtubeAPI;
function loadYouTubeAPI(){
 if(window.YT?.Player)return Promise.resolve();
 if(youtubeAPI)return youtubeAPI;
 youtubeAPI=new Promise((resolve,reject)=>{
  const tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';
  const timer=setTimeout(()=>{tag.remove();youtubeAPI=null;reject(new Error('YouTube не ответил. Проверь соединение и попробуй ещё раз.'));},12000);
  window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);resolve();};
  tag.onerror=()=>{clearTimeout(timer);tag.remove();youtubeAPI=null;reject(new Error('Не удалось подключиться к YouTube.'));};document.head.append(tag);
 });return youtubeAPI;
}
class SongMedia extends EventTarget {
 constructor(native,options={}){super();this.native=native;this.options={controls:options.controls!==false,autoplay:options.autoplay===true};this.kind='audio';this.player=null;this.ready=false;this.status=-1;this.generation=0;this.message=null;this._rate=1;this._muted=false;
  for(const name of ['loadedmetadata','timeupdate','play','pause','ended','error','ratechange'])native.addEventListener(name,()=>{if(this.kind==='audio')this.dispatchEvent(new Event(name));});
 }
 get currentTime(){return this.kind==='youtube'?(this.ready?this.player.getCurrentTime():this.track?.start||0):this.native.currentTime;}
 set currentTime(value){if(this.kind==='youtube'){if(this.ready)this.player.seekTo(value,true);else this.pendingSeek=value;}else this.native.currentTime=value;}
 get duration(){return this.kind==='youtube'?(this.ready?this.player.getDuration():0):this.native.duration;}
 get paused(){return this.kind==='youtube'?this.status!==1:this.native.paused;}
 get playbackRate(){return this.kind==='youtube'?(this.ready?this.player.getPlaybackRate():this._rate):this.native.playbackRate;}
 set playbackRate(value){this._rate=value;if(this.kind==='youtube'){if(this.ready)this.player.setPlaybackRate(value);}else this.native.playbackRate=value;}
 get error(){return this.kind==='youtube'?(this.message?{message:this.message}:null):this.native.error;}
 get src(){return this.kind==='youtube'?this.track.watchUrl:this.native.src;}
 get muted(){return this.kind==='youtube'?this._muted:this.native.muted;}
 set muted(value){this._muted=value;if(this.kind==='youtube'){if(this.ready)value?this.player.mute():this.player.unMute();}else this.native.muted=value;}
 getRates(){return this.kind==='youtube'?(this.ready?this.player.getAvailablePlaybackRates():[1]):[1,.85,.7,1.15];}
 emit(name){this.dispatchEvent(new Event(name));}
 fail(message){this.message=message;this.status=-1;this.emit('error');this.emit('pause');}
 setTrack(track){
  this.dispose();this.track=track;this.kind=track.youtubeId?'youtube':'audio';this.message=null;
  if(!this.options.controls)this.native.controls=false;this.native.autoplay=this.options.autoplay;this.native.playsInline=true;this.native.disablePictureInPicture=!this.options.controls;
  if(this.kind==='youtube'){this.native.removeAttribute('src');this.native.load();this.pendingSeek=track.start||0;}
  else{this.native.src=track.source;this.native.load();}
 }
 async mount(node){
  if(this.kind!=='youtube'||this.player||this.loading)return;
  const generation=this.generation;this.loading=true;
  this.readyPromise=new Promise(resolve=>this.resolveReady=resolve);
  try{
   await loadYouTubeAPI();if(generation!==this.generation||!node.isConnected)return;
   const start=this.pendingSeek||this.track.start||0;
   this.player=new YT.Player(node,{host:'https://www.youtube.com',width:'100%',height:'200',videoId:this.track.youtubeId,
    playerVars:{playsinline:1,origin:location.origin,autoplay:this.options.autoplay?1:0,controls:this.options.controls?1:0,fs:this.options.controls?1:0,disablekb:this.options.controls?0:1,start,rel:0},
    events:{
     onReady:()=>{
      if(generation!==this.generation)return;
      this.ready=true;this.framePermissions();
      if(this._muted)this.player.mute();else if(this.options.autoplay&&!this.options.controls)this.player.unMute();
      if(this.pendingSeek)this.player.seekTo(this.pendingSeek,true);
      this.pendingSeek=null;this.resolveReady?.(true);this.emit('loadedmetadata');this.emit('timeupdate');
      this.timer=setInterval(()=>{if(this.status===1)this.emit('timeupdate');},200);
     },
     onStateChange:event=>{if(generation!==this.generation)return;this.status=event.data;if(event.data===1)this.message=null;if(this.duration>0)this.emit('loadedmetadata');this.emit(event.data===1?'play':event.data===0?'ended':'pause');this.emit('timeupdate');},
     onPlaybackRateChange:()=>{if(generation===this.generation)this.emit('ratechange');},
     onAutoplayBlocked:()=>{if(generation===this.generation){if(this.options.controls){this.fail('Браузер остановил запуск. Нажми Play прямо на видео.');return;}this.message='Нажми ▶ в упражнении, чтобы включить звук.';this.status=2;this.emit('autoplayblocked');this.emit('pause');}},
     onError:event=>{if(generation!==this.generation)return;const messages={2:'Не удалось открыть это видео.',5:'Браузер не смог воспроизвести видео.',100:'Видео удалено или недоступно.',101:'Автор запретил воспроизведение на других сайтах.',150:'Автор запретил воспроизведение на других сайтах.',153:'YouTube не разрешил запуск в этом окне. Открой видео на YouTube.'};this.resolveReady?.(false);this.fail(messages[event.data]||'YouTube не смог воспроизвести видео.');}
    }});
   this.framePermissions();
  }catch(error){if(generation===this.generation){this.resolveReady?.(false);this.fail(error.message);}}
  finally{if(generation===this.generation)this.loading=false;}
 }
 framePermissions(){const frame=this.player?.getIframe();if(!frame)return;frame.setAttribute('title','Видео песни на YouTube');frame.setAttribute('referrerpolicy','strict-origin-when-cross-origin');const permissions=(frame.getAttribute('allow')||'').split(';').map(x=>x.trim()).filter(x=>x&&!/^autoplay(?:\s|$)/.test(x));frame.setAttribute('allow',[...permissions,'autoplay'].join('; '));}
 async getMetadata(){
  const generation=this.generation;if(this.kind!=='youtube')return null;
  if(!this.ready){if(!this.readyPromise||!await this.readyPromise)return null;}
  if(generation!==this.generation||!this.ready)return null;
  const data=this.player?.getVideoData?.();
  return data?.video_id===this.track?.youtubeId?{video_id:data.video_id,title:data.title,author:data.author}:null;
 }
 async play(){
  if(this.kind==='audio')return this.native.play();
  const generation=this.generation;
  if(!this.ready){if(!this.readyPromise)throw new Error('Плеер ещё загружается');let timer;const ready=await Promise.race([this.readyPromise,new Promise(resolve=>{timer=setTimeout(()=>resolve(false),13000);})]);clearTimeout(timer);if(generation!==this.generation){const error=Error('Воспроизведение отменено');error.name='AbortError';throw error;}if(!ready){this.fail(this.message||'YouTube не ответил. Попробуй подключиться ещё раз.');throw new Error(this.message);}}
  this.message=null;if(!this.options.controls&&!this._muted)this.player.unMute();this.player.playVideo();
 }
 pause(){this.native.pause();if(this.ready&&this.player)this.player.pauseVideo();}
 dispose(){this.native.pause();clearInterval(this.timer);this.generation++;this.resolveReady?.(false);this.readyPromise=null;this.player?.destroy();this.player=null;this.ready=false;this.loading=false;this.status=-1;}
}

SongMedia.parseLink=parseYouTubeLink;global.FlowSongMedia=SongMedia;
})(globalThis);
