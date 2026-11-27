/* Shared, local-only ink layer. Versioned strokes travel with the note's body,
   through the existing conflict/draft/save contract, never as executable SVG. */
(() => {
 'use strict';
 const marker=/\n?<!--flow-ink:v1:([A-Za-z0-9+/=]+)-->/g, states=new WeakMap();
 function valid(strokes){return Array.isArray(strokes)&&strokes.length<=160&&strokes.every(s=>Number.isInteger(s.a)&&s.a>=0&&s.a<10000&&/^#[\da-f]{6}$/i.test(s.c)&&[1,2,4,8,14].includes(s.w)&&typeof s.m==='boolean'&&Array.isArray(s.p)&&s.p.length<=500&&s.p.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=50000)));}
 function unpack(text){let ink=[];const body=String(text||'').replace(marker,(raw,b64)=>{try{const v=JSON.parse(atob(b64));if(!valid(v))return raw;ink=v;return '';}catch{return raw;}});return {body,ink};}
 function pack(body,ink){return body+(ink.length?'\n<!--flow-ink:v1:'+btoa(JSON.stringify(ink))+'-->':'');}
 function metadata(text){const v=unpack(text);return {body:v.body,html:v.ink.length?`<span class="note-ink-data" hidden contenteditable="false" data-ink="${btoa(JSON.stringify(v.ink))}"></span>`:''};}
 function read(editor){const data=editor.querySelector('.note-ink-data');try{const s=JSON.parse(atob(data?.dataset.ink||'W10='));return valid(s)?s:[];}catch{return [];}}
 function strokes(editor){return states.get(editor)?.strokes||read(editor);}
 function blocks(editor){return [...editor.children].filter(n=>!n.classList.contains('note-ink-data')&&!n.classList.contains('note-ink-layer'));}
 function mount(editor){
  if(states.has(editor))return states.get(editor);
  const s={strokes:read(editor),undo:[],redo:[],active:false,tool:'pen',color:'#73a6ff',width:2,current:null};states.set(editor,s);
  for(const stale of editor.parentElement.querySelectorAll(':scope > .note-ink-tools'))stale.remove();
  const layer=document.createElementNS('http://www.w3.org/2000/svg','svg');layer.classList.add('note-ink-layer');layer.setAttribute('contenteditable','false');layer.setAttribute('aria-hidden','true');editor.append(layer);s.layer=layer;
  const panel=document.createElement('div');panel.className='note-ink-tools';panel.hidden=true;panel.setAttribute('role','toolbar');panel.setAttribute('aria-label','Рисование поверх текста');editor.parentElement.insertBefore(panel,editor);s.panel=panel;
  const button=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;panel.append(b);return b;};
  for(const [tool,label]of [['pen','Перо'],['marker','Маркер'],['eraser','Ластик']]){const b=button(label,()=>{s.tool=tool;for(const n of panel.querySelectorAll('[data-ink-tool]'))n.setAttribute('aria-pressed',String(n.dataset.inkTool===tool));});b.dataset.inkTool=tool;b.setAttribute('aria-pressed',String(tool==='pen'));}
  const color=document.createElement('input');color.type='color';color.value=s.color;color.setAttribute('aria-label','Цвет пера');color.oninput=()=>s.color=color.value;panel.append(color);
  const width=document.createElement('select');width.setAttribute('aria-label','Толщина пера');for(const n of [1,2,4,8,14]){const o=document.createElement('option');o.value=n;o.textContent=n+' px';width.append(o);}width.value=2;width.onchange=()=>s.width=Number(width.value);panel.append(width);
  const undo=button('↶',()=>history(false)),redo=button('↷',()=>history(true));undo.setAttribute('aria-label','Отменить штрих');redo.setAttribute('aria-label','Вернуть штрих');
  const status=document.createElement('span');status.className='note-ink-status';status.setAttribute('role','status');panel.append(status);
  button('Готово',()=>activate(false));
  function activate(on){s.active=on;panel.hidden=!on;editor.dataset.inking=String(on);editor.contentEditable=on?'false':'true';document.querySelectorAll('[data-note-ink]').forEach(b=>b.setAttribute('aria-pressed',String(on)));if(on)document.activeElement?.blur();draw();}
  s.activate=activate;
  function changed(){let meta=editor.querySelector('.note-ink-data');if(!meta){meta=document.createElement('span');meta.className='note-ink-data';meta.hidden=true;meta.contentEditable='false';editor.append(meta);}meta.dataset.ink=btoa(JSON.stringify(s.strokes));window.syncRichNote?.();draw();}
  function history(forward){const from=forward?s.redo:s.undo,to=forward?s.undo:s.redo;if(!from.length)return;to.push(JSON.stringify(s.strokes));s.strokes=JSON.parse(from.pop());changed();}
  s.history=history;
  function snapshot(){s.undo.push(JSON.stringify(s.strokes));if(s.undo.length>30)s.undo.shift();s.redo=[];}
  function geometry(){const r=editor.getBoundingClientRect();return {r,unit:Math.max(1,r.width)/1000,blocks:blocks(editor)};}
  function point(e,g,anchor){return [Math.round((e.clientX-g.r.left)/g.unit),Math.round((e.clientY-anchor)/g.unit)];}
  function draw(){
   const g=geometry();layer.replaceChildren();layer.setAttribute('viewBox',`0 0 ${g.r.width} ${Math.max(editor.scrollHeight,g.r.height)}`);layer.style.height=Math.max(editor.scrollHeight,g.r.height)+'px';
   for(const stroke of [...s.strokes,...(s.current?[s.current]:[])]){const block=g.blocks[stroke.a]||g.blocks.at(-1);const top=block?block.getBoundingClientRect().top-g.r.top:0;const p=document.createElementNS(layer.namespaceURI,'polyline');p.setAttribute('points',stroke.p.map(([x,y])=>`${x*g.unit},${top+y*g.unit}`).join(' '));p.setAttribute('fill','none');p.setAttribute('stroke',stroke.c);p.setAttribute('stroke-width',String(stroke.w));p.setAttribute('stroke-opacity',stroke.m?'.3':'1');p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');layer.append(p);}
   undo.disabled=!s.undo.length;redo.disabled=!s.redo.length;
  }
  let start=null;
  layer.onpointerdown=e=>{if(!s.active||e.button!==0)return;e.preventDefault();layer.setPointerCapture(e.pointerId);const g=geometry();let a=g.blocks.findIndex(b=>b.getBoundingClientRect().bottom>=e.clientY);if(a<0)a=Math.max(0,g.blocks.length-1);const top=g.blocks[a]?.getBoundingClientRect().top||g.r.top;start={g,top,id:e.pointerId};
   if(s.tool==='eraser'){const before=s.strokes.length;snapshot();s.strokes=s.strokes.filter(st=>{const b=g.blocks[st.a]||g.blocks.at(-1),t=b?.getBoundingClientRect().top||g.r.top;return !st.p.some(([x,y])=>Math.hypot(g.r.left+x*g.unit-e.clientX,t+y*g.unit-e.clientY)<18);});if(before===s.strokes.length)s.undo.pop();changed();return;}
   s.current={a,c:s.color,w:s.tool==='marker'?14:s.width,m:s.tool==='marker',p:[point(e,g,top)]};draw();};
  layer.onpointermove=e=>{if(!start||start.id!==e.pointerId||editor.dataset.busy==='true')return;e.preventDefault();if(s.tool==='eraser'){const g=geometry(),next=s.strokes.filter(st=>{const b=g.blocks[st.a]||g.blocks.at(-1),t=b?.getBoundingClientRect().top||g.r.top;return !st.p.some(([x,y])=>Math.hypot(g.r.left+x*g.unit-e.clientX,t+y*g.unit-e.clientY)<18);});if(next.length!==s.strokes.length){snapshot();s.strokes=next;changed();}return;}if(!s.current)return;const p=point(e,start.g,start.top),last=s.current.p.at(-1);if(Math.hypot(p[0]-last[0],p[1]-last[1])<2)return;if(s.current.p.length<500)s.current.p.push(p);draw();};
  layer.onpointerup=e=>{if(!start||start.id!==e.pointerId)return;if(s.current){if(s.current.p.length===1)s.current.p.push([s.current.p[0][0]+.1,s.current.p[0][1]]);const next=[...s.strokes,s.current];if(next.length>160||pack('',next).length>35000){status.textContent='Слишком много штрихов — удалите лишние';}else{snapshot();s.strokes=next;status.textContent='';}s.current=null;changed();}start=null;};
  layer.onpointercancel=()=>{s.current=null;start=null;draw();};
  const resize=new ResizeObserver(()=>requestAnimationFrame(()=>{if(editor.isConnected)draw();else{resize.disconnect();panel.remove();}}));resize.observe(editor);draw();return s;
 }
 document.addEventListener('click',e=>{if(!e.target.closest('[data-note-ink]'))return;e.preventDefault();e.stopImmediatePropagation();const editor=document.querySelector('.note-rich');if(editor){const s=mount(editor);s.activate(!s.active);}},true);
 document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||!['z','y'].includes(e.key.toLowerCase()))return;const editor=document.querySelector('.note-rich');if(!editor||editor.closest('[hidden]')||editor.dataset.busy==='true')return;const s=states.get(editor);if(s&&(s.active||(!e.target.closest('textarea,input,[contenteditable="true"]')&&s.undo.length))){e.preventDefault();e.stopImmediatePropagation();s.history(e.key.toLowerCase()==='y'||e.shiftKey);}},true);
 let pending=false;new MutationObserver(records=>{if(!records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.note-rich')||n.querySelector?.('.note-rich')))))return;if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;document.querySelectorAll('.note-rich').forEach(mount);});}).observe(document.documentElement,{childList:true,subtree:true});
 window.flowNoteInk={unpack,pack,metadata,strokes,mount,preserve:(text,original)=>pack(unpack(text).body,unpack(original).ink)};
})();
