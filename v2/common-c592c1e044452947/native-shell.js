import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/native-window.js';

// The existing Android geometry remains authoritative, including the user's
// accepted camera calibration. Only its projection onto the shared shell differs.
export function attachNativeShell({frame,chrome}){
 let queued=0,sheets=false,fallbackRadii=null;
 const sheet=new CSSStyleSheet();sheet.replaceSync(':host([native-camera]) .orb-button{left:var(--shell-camera-x);top:var(--shell-hit-y);transform:none}:host([native-camera]) .orb{position:absolute;left:22px;top:var(--shell-orb-y);transform:translate(-50%,-50%)}:host([native-camera]) .brand,:host([native-camera]) .settings{top:var(--shell-hit-y)}');
 function paint(){queued=0;const root=document.documentElement,phone=frame.shadowRoot?.querySelector('.phone'),header=chrome.shadowRoot?.querySelector('.app-header');if(!phone||!header)return;
  const native=root.dataset.flowNative==='true',css=getComputedStyle(root);
  if(native){const corners=['top-left','top-right','bottom-right','bottom-left'];fallbackRadii??=corners.map(name=>parseFloat(getComputedStyle(phone).getPropertyValue('border-'+name+'-radius'))||0);const radii=corners.map((name,index)=>{const supplied=css.getPropertyValue('--native-corner-'+name).trim();return Math.max(0,supplied?parseFloat(supplied)||0:fallbackRadii[index]);});if(root.dataset.nativeKeyboard==='true')radii[2]=radii[3]=0;phone.style.borderRadius=radii.map(value=>value+'px').join(' ');
   const{width:w,height:h}=phone.getBoundingClientRect(),edge=phone.querySelector('.edge'),rect=edge?.querySelector('rect');if(edge&&rect){let path=edge.querySelector('.native-contour');if(!path){path=document.createElementNS('http://www.w3.org/2000/svg','path');path.classList.add('native-contour');path.setAttribute('pathLength','100');path.style.vectorEffect='non-scaling-stroke';edge.append(path);}const[tl,tr,br,bl]=radii.map(value=>Math.max(0,Math.min(value-1,(w-2)/2,(h-2)/2)));path.setAttribute('d',`M${1+tl} 1H${w-1-tr}Q${w-1} 1 ${w-1} ${1+tr}V${h-1-br}Q${w-1} ${h-1} ${w-1-br} ${h-1}H${1+bl}Q1 ${h-1} 1 ${h-1-bl}V${1+tl}Q1 1 ${1+tl} 1Z`);rect.style.display='none';}
   const head=frame.shadowRoot.querySelector('.bound-header'),nav=frame.shadowRoot.querySelector('.bound-nav');head.style.paddingTop='0px';nav.style.paddingBottom=`calc(10px + ${root.dataset.nativeKeyboard==='true'?'0px':css.getPropertyValue('--native-safe-bottom')||'0px'})`;
  }else{phone.style.removeProperty('border-radius');phone.querySelector('.native-contour')?.remove();phone.querySelector('.edge rect')?.style.removeProperty('display');}
  if(!sheets){chrome.shadowRoot.adoptedStyleSheets=[...chrome.shadowRoot.adoptedStyleSheets,sheet];sheets=true;}
  const camera=native&&root.dataset.nativeCamera==='true'&&root.dataset.nativeCameraEdge==='top';chrome.toggleAttribute('native-camera',camera);
  if(camera){const box=header.getBoundingClientRect(),x=parseFloat(css.getPropertyValue('--native-camera-x')),y=parseFloat(css.getPropertyValue('--native-camera-center-y'));if(Number.isFinite(x)&&Number.isFinite(y)){const localY=y-box.top,hit=Math.max(0,localY-22);chrome.style.setProperty('--shell-camera-x',(x-box.left-22)+'px');chrome.style.setProperty('--shell-hit-y',hit+'px');chrome.style.setProperty('--shell-orb-y',(localY-hit)+'px');}}
 }
 const schedule=()=>{if(!queued)queued=requestAnimationFrame(paint);};
 addEventListener('flow:windowgeometry',schedule);addEventListener('resize',schedule);const observer=new ResizeObserver(schedule);observer.observe(frame);schedule();
 return{route(page){if(document.documentElement.dataset.flowNative==='true')try{window.SorokaNative?.pianoRotation?.(page==='piano');}catch{}schedule();},dispose(){observer.disconnect();removeEventListener('flow:windowgeometry',schedule);removeEventListener('resize',schedule);cancelAnimationFrame(queued);}};
}
