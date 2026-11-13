// Drawing/reaction equations reused from digital-assistant-visual.js; no voice or AI owner.
export function createStarReactions(assistant,win){
 const document=win.document,button=assistant._star,canvas=document.createElement('canvas');canvas.className='s26-live-star';canvas.setAttribute('aria-hidden','true');button.append(canvas);
 const dpr=Math.min(win.devicePixelRatio||1,1.25);canvas.width=360*dpr;canvas.height=300*dpr;const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable');
 const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t)),rgb=(c,a=1)=>`rgba(${c.join(',')},${a})`;
 const probe=document.createElement('span');probe.style.color='var(--fu-accent)';assistant.shadowRoot.append(probe);ctx.fillStyle=win.getComputedStyle(probe).color;ctx.fillRect(0,0,1,1);const accent=Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3);ctx.clearRect(0,0,1,1);probe.remove();
 const colors={accent,hot:mix(accent,[255,246,224],.67),deep:mix(accent,[104,37,8],.28)};
 let phase='idle',levelTarget=.45,smoothLevel=0,frame=0,timer=0,cueUntil=0,inputCues=0,inputCue=null,heroTimer=0,heroAnimation=null,frames=0,gradients=0,lastLevel=0,cacheHits=0,staticKey='',paintMs=0,maxPaintMs=0;
 const reduced=()=>assistant.quiet()||win.matchMedia('(prefers-reduced-motion:reduce)').matches;
 const canRender=()=>assistant.isOpen&&!assistant.closing&&!document.hidden;const livePhase=()=>['listening','thinking','speaking'].includes(phase);
  const W=360,H=300,CX=180,CY=150,MAX_PARTICLES=64; const color=rgb;
  const radial=(...args)=>{gradients++;return ctx.createRadialGradient(...args);},linear=(...args)=>{gradients++;return ctx.createLinearGradient(...args);};
  let starState='ready',starRGB=colors.accent,starHot=colors.hot,starDeep=colors.deep,particles=[],clock=0,lastPaint=0,energy=0,hover=0,targetHover=0,px=0,py=0,targetX=0,targetY=0,emission=0,seed=6911,gradientPhase=0,lastReaction='',pose={};
  const visible=true;let disposed=false,pageSuspended=false;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
 function addParticle(mode,burst=false){
  if(particles.length>=MAX_PARTICLES)particles.shift();
  const arm=Math.floor(random()*4)*Math.PI/2,a=burst?arm+(random()-.5)*.7:random()*Math.PI*2;
  const inward=mode==='listen',spiral=mode==='think',outward=mode==='speak'||mode==='success'||burst;
  const radius=inward?100+random()*37:spiral?80+random()*40:outward?25+random()*25:70+random()*60;
  particles.push({mode,a,r:radius,x:Math.cos(a)*radius,y:Math.sin(a)*radius,life:0,max:inward?1.5+random()*.7:outward?.75+random()*.7:2.6+random()*2,size:(burst?1.3:.7)+random()*1.3,speed:(burst?48:inward?48:outward?38:8)+random()*24,spin:spiral?.9+random()*.6:(random()-.5)*.2,brightness:.4+random()*.6});
 }
 function burst(mode,count=14){if(reduced()||!visible||document.hidden||pageSuspended)return;for(let i=0;i<count;i++)addParticle(mode,true);}
 function react(kind='press'){
  if(disposed||!canRender())return;lastReaction=kind;
  // Text feedback is a short composited opacity cue, never a canvas draw loop.
  if(kind==='typing'&&!livePhase()){if(heroTimer||heroAnimation){inputCues++;return;}inputCue?.cancel();inputCue=reduced()?null:canvas.animate([{opacity:.82},{opacity:1}],{duration:140});inputCues++;return;}
  energy=Math.min(1.3,energy+(kind==='success'?.95:.7));
  if(!reduced()){burst(kind==='success'?'success':starState==='listen'?'listen':'speak',kind==='success'?24:12);cueUntil=performance.now()+(kind==='success'?550:280);}
  sync();
 }
 function formPath(x,y,rays,tension){
  const [top,right,bottom,left]=rays,k=tension;ctx.beginPath();ctx.moveTo(x,y-top);
  ctx.bezierCurveTo(x+top*.08,y-top*k,x+right*k,y-right*.08,x+right,y);
  ctx.bezierCurveTo(x+right*k,y+right*.08,x+bottom*.08,y+bottom*k,x,y+bottom);
  ctx.bezierCurveTo(x-bottom*.08,y+bottom*k,x-left*k,y+left*.08,x-left,y);
  ctx.bezierCurveTo(x-left*k,y-left*.08,x-top*.08,y-top*k,x,y-top);ctx.closePath();
 }
 function orbit(x,y,angle,phase,front=false,amplitude=1){
  const rx=85+amplitude,ry=24+amplitude*.2;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();
  ctx.ellipse(0,0,rx,ry,0,front?0:Math.PI,front?Math.PI:Math.PI*2);ctx.strokeStyle=color(starRGB,front?.34:.18);ctx.lineWidth=.8;ctx.stroke();
  if(front===(Math.sin(phase)>0)){const gx=Math.cos(phase)*rx,gy=Math.sin(phase)*ry;ctx.shadowColor=color(starRGB,.9);ctx.shadowBlur=10;ctx.fillStyle=color(starHot,.94);ctx.beginPath();ctx.arc(gx,gy,1.6,0,Math.PI*2);ctx.fill();}ctx.restore();
 }
 function draw(dt,moving){
  starRGB=colors.accent;starHot=colors.hot;starDeep=colors.deep;frames++;if(moving)clock+=dt;
  const t=clock,stateLevel=levelTarget;
  if(!moving)smoothLevel=stateLevel;else smoothLevel+=(stateLevel-smoothLevel)*Math.min(1,dt*(stateLevel>smoothLevel?12:4));
  const level=['listen','speak'].includes(starState)?smoothLevel:0;lastLevel=level;
  const frozen=!moving;energy*=frozen?1:Math.exp(-dt*3.8);hover+=(targetHover-hover)*Math.min(1,dt*6);px+=(targetX-px)*Math.min(1,dt*5);py+=(targetY-py)*Math.min(1,dt*5);
  const breathe=frozen?0:Math.sin(t*.9)*2.4,listen=starState==='listen',think=starState==='think',speak=starState==='speak',pause=starState==='pause';
  const response=(listen?level*6:speak?level*4:0),wave=frozen?0:Math.sin(t*(think?2.1:1.05));
  const centerX=px*.22+Math.sin(t*.65)*(think?3:2),centerY=py*.18+Math.cos(t*.8)*(listen?2.2:.8)-energy*2;
  let rays=[60+breathe+response+energy*8,60-breathe*.5+response*.7-energy*4,60+breathe*.3+response*.5+energy*3,60-breathe*.5+response*.9-energy*4];
  if(think){rays=[60+wave*5,60-wave*4,60-wave*3,60+wave*4];}if(speak){rays[1]+=Math.sin(t*4)*level*4;rays[3]-=Math.sin(t*4)*level*3;}if(pause)rays=[58,58,58,58];
  const x=CX+centerX,y=CY+centerY,hotAngle=t*(think?1.2:.55),reach=think?35:listen?26+level*12:speak?34:29,hx=x+Math.cos(hotAngle)*reach+px*.32,hy=y+Math.sin(hotAngle*.8)*reach+py*.32;
  gradientPhase=hotAngle;pose={rays:rays.map(n=>Number(n.toFixed(3))),center:[centerX,centerY],hotspot:[hx-x,hy-y]};
  ctx.clearRect(0,0,W,H);
  const field=radial(x,y,12,x,y,139);field.addColorStop(0,color(starRGB,.1+energy*.055+level*.06));field.addColorStop(.43,color(starRGB,.045));field.addColorStop(1,color(starRGB,0));ctx.fillStyle=field;ctx.fillRect(0,0,W,H);
  orbit(x,y,(-19+Math.sin(t*.35)*3)*Math.PI/180,t*(Math.PI*2/9),false,breathe*.3);orbit(x,y,(71+Math.sin(t*.35)*3)*Math.PI/180,-t*(Math.PI*2/13)+1.8,false,breathe*.3);
  if(moving){const rate=pause?0:listen?3+level*13:think?7:speak?4+level*12:starState==='error'?2:starState==='success'?3:.8;emission+=dt*rate;while(emission>=1){addParticle(starState);emission--;}
   for(const p of particles){p.life+=dt;if(p.mode==='listen'){p.r-=p.speed*dt;p.a+=dt*.16;p.x=Math.cos(p.a)*p.r;p.y=Math.sin(p.a)*p.r*.8;if(p.r<15)p.life=p.max;}else if(p.mode==='think'){p.r-=dt*7;p.a+=dt*p.spin;p.x=Math.cos(p.a)*p.r;p.y=Math.sin(p.a)*p.r*.65;}else if(['speak','success'].includes(p.mode)){p.r+=p.speed*dt;p.x=Math.cos(p.a)*p.r;p.y=Math.sin(p.a)*p.r*.85;}else{p.a+=p.spin*dt;p.x+=Math.sin(p.a)*dt*7;p.y-=dt*p.speed*.25;} }
   particles=particles.filter(p=>p.life<p.max&&p.r<175);
  }
  ctx.save();ctx.globalCompositeOperation='screen';for(const p of particles){const age=p.life/p.max,fade=Math.sin(Math.min(1,age)*Math.PI)*p.brightness*(pause?.25:1);if(fade<.02)continue;ctx.fillStyle=color(starHot,fade);ctx.shadowColor=color(starRGB,.8);ctx.shadowBlur=p.size*4;ctx.beginPath();ctx.arc(x+p.x,y+p.y,p.size*(.8+Math.sin(age*Math.PI)*.3),0,Math.PI*2);ctx.fill();}ctx.restore();
  const tension=.30+(frozen?0:Math.sin(t*.75)*.017)+(listen?level*.015:0);
  ctx.save();formPath(x,y,rays,tension);ctx.shadowColor=color(starRGB,.9);ctx.shadowBlur=19+level*14+energy*12;ctx.fillStyle=color(starRGB,.7);ctx.fill();ctx.restore();
  const body=radial(hx,hy,2,x,y,88);body.addColorStop(0,color(starHot));body.addColorStop(.2,color(starHot));body.addColorStop(.52,color(starRGB));body.addColorStop(.9,color(starRGB.map((c,i)=>Math.round(c*.42+starDeep[i]*.58))));body.addColorStop(1,color(starDeep));
  formPath(x,y,rays,tension);ctx.fillStyle=body;ctx.fill();
  ctx.save();ctx.clip();ctx.globalCompositeOperation='screen';const width=68,shift=Math.sin(t*.48)*30;const caustic=linear(x-width+shift,y-70,x+width+shift,y+70);caustic.addColorStop(0,color(starHot,0));caustic.addColorStop(.4,color(starHot,0));caustic.addColorStop(.52,color(starHot,.22+hover*.08));caustic.addColorStop(.66,color(starHot,0));caustic.addColorStop(1,color(starHot,0));ctx.fillStyle=caustic;ctx.fillRect(x-90,y-90,180,180);ctx.restore();
  ctx.save();formPath(x,y,rays,tension);ctx.clip();ctx.globalCompositeOperation='screen';
  for(let i=0;i<4;i++){const angle=i*Math.PI/2,travel=(t*(think?.9:speak?.65:.35)+i*.24)%1,alpha=.16+.16*(.5+.5*Math.sin(t*1.1+i*1.57))+level*.12;ctx.save();ctx.translate(x,y);ctx.rotate(angle);const sweep=linear(0,0,70,0);sweep.addColorStop(0,color(starHot,0));sweep.addColorStop(Math.max(0,travel-.14),color(starHot,0));sweep.addColorStop(travel,color(starHot,alpha));sweep.addColorStop(Math.min(1,travel+.14),color(starHot,0));sweep.addColorStop(1,color(starHot,0));ctx.fillStyle=sweep;ctx.fillRect(0,-34,75,68);ctx.restore();}
  ctx.restore();
  formPath(x,y,rays,tension);ctx.strokeStyle=color(starHot,.2+level*.12+hover*.15);ctx.lineWidth=.75;ctx.stroke();
  const core=radial(x-2+px*.1,y-3+py*.1,0,x,y,15+energy*4+level*3);core.addColorStop(0,color(starHot,.95));core.addColorStop(.3,color(starHot,.68));core.addColorStop(1,color(starHot,0));ctx.fillStyle=core;ctx.fillRect(x-30,y-30,60,60);
  orbit(x,y,(-19+Math.sin(t*.35)*3)*Math.PI/180,t*(Math.PI*2/9),true,breathe*.3);orbit(x,y,(71+Math.sin(t*.35)*3)*Math.PI/180,-t*(Math.PI*2/13)+1.8,true,breathe*.3);
 }
  function paint(still=false){const current={state:phase};const next=({listening:'listen',thinking:'think',speaking:'speak',error:'error',success:'success'})[current.state]||'ready';const key=still?JSON.stringify([next,colors,['listen','speak'].includes(next)?Number(document.documentElement.style.getPropertyValue('--magic-level'))||0:0]):'';if(still&&staticKey===key){cacheHits++;return;}staticKey=key;if(next!==starState){starState=next;emission=0;energy=.5;}
    const now=performance.now(),dt=lastPaint?Math.min(.1,(now-lastPaint)/1000):1/60;lastPaint=now;
    const started=performance.now();ctx.setTransform(dpr,0,0,dpr,0,0);if(still)particles=[];draw(still?0:dt,!still);const elapsed=performance.now()-started;paintMs+=elapsed;maxPaintMs=Math.max(maxPaintMs,elapsed);
  }

 function stop(){if(frame)win.cancelAnimationFrame(frame);if(timer)win.clearTimeout(timer);frame=timer=0;}
 function tick(){frame=0;if(!canRender())return;if(reduced()){energy=0;staticKey='';paint(true);return;}paint(false);timer=win.setTimeout(()=>{timer=0;frame=win.requestAnimationFrame(tick);},livePhase()||performance.now()<cueUntil?34:70);}
 function sync(){stop();if(!canRender()){inputCue?.cancel();return;}if(reduced()){inputCue?.cancel();energy=0;staticKey='';paint(true);}else frame=win.requestAnimationFrame(tick);}
 const zone=button.parentElement;
 const aim=event=>{const box=zone.getBoundingClientRect();targetHover=1;targetX=Math.max(-16,Math.min(16,(event.clientX-box.x-box.width/2)*.3));targetY=Math.max(-16,Math.min(16,(event.clientY-box.y-box.height/2)*.3));};
 const leave=()=>{targetHover=0;targetX=targetY=0;};
 zone.addEventListener('pointermove',aim);zone.addEventListener('pointerleave',leave);
 const observer=new win.MutationObserver(sync);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion','data-reduce']});observer.observe(assistant._overlay,{attributes:true,attributeFilter:['hidden','inert']});
 const query=win.matchMedia('(prefers-reduced-motion:reduce)');query.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);sync();
 return{react,setState(value){if(!['idle','listening','thinking','speaking'].includes(value))return;phase=value;lastPaint=0;sync();},setLevel(value){levelTarget=Math.max(0,Math.min(1,Number(value)||0));if(reduced())sync();},getState:()=>({phase,level:lastLevel,levelTarget,gradientPhase,ringTilt:Math.sin(clock*.35)*3,ringHighlights:[clock*(Math.PI*2/9),-clock*(Math.PI*2/13)+1.8],ringAngleDifference:90,frames,inputCues,lastReaction,shape:pose,particles:particles.length,active:!!(frame||timer),canvasReady:true}),dispose(){disposed=true;zone.removeEventListener('pointermove',aim);zone.removeEventListener('pointerleave',leave);stop();inputCue?.cancel();observer.disconnect();query.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);canvas.remove();}};
}
