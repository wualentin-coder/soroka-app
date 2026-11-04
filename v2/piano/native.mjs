import {mountPianoPlayer} from './player.mjs?v=63e9fd53e452';
import {PLAYER_HTML} from './player-template.mjs?v=63e9fd53e452';
import {COMPOSITIONS,parseMidiComposition} from './compositions.mjs?v=63e9fd53e452';
import {COURSE} from './course.mjs?v=63e9fd53e452';
import * as learning from './learning-path.mjs?v=63e9fd53e452';
import * as learningGoals from './learning-goals.mjs?v=63e9fd53e452';
import {normalizePianoState,mergePianoState,toPianoProgress,samePianoProgress} from './state.mjs?v=63e9fd53e452';

export {COURSE,COMPOSITIONS,parseMidiComposition,learning,learningGoals,normalizePianoState,mergePianoState,toPianoProgress,samePianoProgress};
export {resetPianoProgress} from './state.mjs?v=63e9fd53e452';
export {createMicroLesson} from './microlearning.mjs?v=63e9fd53e452';
export {createSongMicroLesson} from './song-microlearning.mjs?v=63e9fd53e452';
export {getMicroRun} from './microlearning-progress.mjs?v=63e9fd53e452';
export {createCompositionStudy,normalizeStudyProgress,studySummary} from './composition-study.mjs?v=63e9fd53e452';
export {putCachedComposition,getCachedComposition,listCachedCompositions} from './composition-cache.mjs?v=63e9fd53e452';
export const pianoAsset=name=>new URL(name,import.meta.url).href;
export function createTeacherFetch(call){
  return async(url,options={})=>{
    const route=String(url).split('/').at(-1),operation=route==='speech'?'speak':route;
    if(!['status','review','reply','speak','transcribe'].includes(operation))return new Response('{}',{status:404});
    if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
    let abort;const interrupted=new Promise((_,reject)=>{abort=()=>reject(new DOMException('Aborted','AbortError'));options.signal?.addEventListener('abort',abort,{once:true});});
    try{
      const data=await Promise.race([call(operation,options.body?JSON.parse(options.body):{}),interrupted]);
      if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
      if(operation==='speak'){
        if(typeof data?.audioBase64!=='string'||data.audioBase64.length>4_000_000||!/^audio\//.test(data.mime||''))throw new Error('Неверный голосовой ответ.');
        const raw=atob(data.audioBase64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));return new Response(bytes,{headers:{'content-type':data.mime}});
      }
      return new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
    }catch(error){if(error.name==='AbortError')throw error;return new Response(JSON.stringify({error:error.message||'Преподаватель недоступен.'}),{status:503,headers:{'content-type':'application/json'}});}
    finally{options.signal?.removeEventListener('abort',abort);}
  };
}

export async function createNativePlayer(container,options){
  const root=container.attachShadow({mode:'open'});
  const styleURL=pianoAsset('player.css'),response=await fetch(styleURL,{cache:'no-store'});
  if(!response.ok)throw new Error('Не удалось загрузить оформление занятия.');
  let css=await response.text();css=css.replaceAll("url('./fonts/Bravura.woff2')",`url('${pianoAsset('fonts/Bravura.woff2')}')`);
  if(typeof FontFace==='function'){
    const font=new FontFace('Bravura',`url("${pianoAsset('fonts/Bravura.woff2')}")`);await font.load();document.fonts.add(font);
  }
  const style=document.createElement('style');style.textContent=css;root.append(style);
  const body=document.createElement('div');body.innerHTML=PLAYER_HTML.replaceAll('./icon.svg',pianoAsset('../assets/flow-vortex-magic.svg'));
  const brand=body.querySelector('.brand img'),mark=globalThis.flowDigitalBrand?.createMark?.();
  if(brand&&mark){mark.setAttribute('width',brand.getAttribute('width')||'36');mark.setAttribute('height',brand.getAttribute('height')||'36');mark.setAttribute('aria-hidden','true');brand.replaceWith(mark);}
  root.append(body);
  const engine=mountPianoPlayer(root,{...options,embedded:true,assetBase:pianoAsset('./'),teacherDependencies:{fetch:createTeacherFetch(options.call)}});
  const theme=new MutationObserver(()=>engine.redraw?.());theme.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-accent','data-palette']});
  return {...engine,destroy:()=>{theme.disconnect();engine.destroy();}};
}
