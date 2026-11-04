/* The fluid star uses real input RMS; speaking motion follows the reply state. */
(() => {
  'use strict';
  if (document.documentElement.dataset.flowDesign === 'classic') return;
  const layer=document.querySelector('.flow-assistant-layer'),button=layer?.querySelector('.fa-star');
  if(!layer||!button)return;
  const canvas=document.createElement('canvas');canvas.className='fa-star-canvas';canvas.setAttribute('aria-hidden','true');
  const size=360,HEIGHT=300,dpr=Math.min(devicePixelRatio||1,2);canvas.width=size*dpr;canvas.height=HEIGHT*dpr;
  const ctx=canvas.getContext('2d');if(!ctx)return;button.append(canvas);button.classList.add('fa-canvas-ready');
  let frame=0,frames=0,smoothLevel=0,flight=null,entrances=[];
  const reduced=()=>window.flowDigital?.reducedMotion?.()??matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mix=(a,b,t)=>a.map((value,i)=>Math.round(value+(b[i]-value)*t));
  const rgb=(color,alpha=1)=>`rgba(${color.join(',')},${alpha})`;
  const luminance=color=>color.map(value=>{value/=255;return value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);}).reduce((sum,value,i)=>sum+value*[.2126,.7152,.0722][i],0);
  const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  let colors={accent:[255,163,92],hot:[255,219,177],deep:[219,105,35]};
  function backgroundAt(x,y){const target=document.elementsFromPoint(x,y).find(node=>!node.closest('.flow-assistant-layer,.assistant-fab,.digital-atmosphere,.edge-energy'));let chain=[];for(let node=target;node;node=node.parentElement)chain.unshift(node);let result=[16,17,19];for(const node of chain){const value=getComputedStyle(node).backgroundColor.match(/[\d.]+/g)?.map(Number);if(value?.length>=3){const alpha=value[3]??1;result=result.map((channel,i)=>Math.round(channel*(1-alpha)+value[i]*alpha));}}return result;}
  function refreshColor(){const source=window.flowPalette?.getState?.().rgb||getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').split(',').map(Number);const accent=source?.length===3&&source.every(Number.isFinite)?source:[255,163,92];colors={accent,hot:mix(accent,[255,246,224],.67),deep:mix(accent,[104,37,8],.28)};const fab=document.querySelector('.assistant-fab');if(fab){const box=fab.getBoundingClientRect(),background=backgroundAt(box.x+box.width/2,box.y+box.height/2);const mode=contrast(accent,background)<2.4?(luminance(background)>.18?'cutout':'lifted'):'normal';const body=mode==='cutout'?mix(accent,[45,22,13],.62):mode==='lifted'?mix(accent,[255,248,229],.55):accent;fab.dataset.contrast=mode;fab.style.setProperty('--star-body',rgb(body));fab.style.setProperty('--star-hot',rgb(mix(body,[255,245,224],.63)));fab.style.setProperty('--star-deep',rgb(mix(body,[81,31,12],.25)));fab.style.setProperty('--star-rim',mode==='cutout'?'rgba(255,246,229,.82)':rgb(colors.hot,.45));}if(!frame&&!layer.hidden)paint(true);}
  const W=360,H=300,CX=180,CY=150,MAX_PARTICLES=64; const color=rgb;
  let starState='ready',starRGB=colors.accent,starHot=colors.hot,starDeep=colors.deep,particles=[],clock=0,lastPaint=0,energy=0,hover=0,targetHover=0,px=0,py=0,targetX=0,targetY=0,emission=0,seed=6911,gradientPhase=0,lastReaction='',pose={};
  const visible=true,pageSuspended=false,disposed=false;
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
  if(disposed)return;lastReaction=kind;energy=Math.min(1.3,energy+(kind==='success'?.95:kind==='typing'?.23:.7));
  if(!reduced())burst(kind==='success'?'success':starState==='listen'?'listen':'speak',kind==='success'?24:kind==='typing'?2:kind==='hover'?5:12);
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
  const t=clock,stateLevel=Number(document.documentElement.style.getPropertyValue('--magic-level'))||0,level=['listen','speak'].includes(starState)?stateLevel:0;
  const frozen=!moving;energy*=frozen?1:Math.exp(-dt*3.8);hover+=(targetHover-hover)*Math.min(1,dt*6);px+=(targetX-px)*Math.min(1,dt*5);py+=(targetY-py)*Math.min(1,dt*5);
  const breathe=frozen?0:Math.sin(t*.9)*1.6,listen=starState==='listen',think=starState==='think',speak=starState==='speak',pause=starState==='pause';
  const response=(listen?level*6:speak?level*4:0),wave=frozen?0:Math.sin(t*(think?2.1:1.05));
  const centerX=px*.22+Math.sin(t*.65)*(think?3:1.2),centerY=py*.18+Math.cos(t*.8)*(listen?2.2:.8)-energy*2;
  let rays=[60+breathe+response+energy*8,60-breathe*.5+response*.7-energy*4,60+breathe*.3+response*.5+energy*3,60-breathe*.5+response*.9-energy*4];
  if(think){rays=[60+wave*5,60-wave*4,60-wave*3,60+wave*4];}if(speak){rays[1]+=Math.sin(t*4)*level*4;rays[3]-=Math.sin(t*4)*level*3;}if(pause)rays=[58,58,58,58];
  const x=CX+centerX,y=CY+centerY,hotAngle=t*(think?1.2:.55),reach=think?35:listen?26+level*12:speak?34:29,hx=x+Math.cos(hotAngle)*reach+px*.32,hy=y+Math.sin(hotAngle*.8)*reach+py*.32;
  gradientPhase=hotAngle;pose={rays:rays.map(n=>Number(n.toFixed(3))),center:[centerX,centerY],hotspot:[hx-x,hy-y]};
  ctx.clearRect(0,0,W,H);
  const field=ctx.createRadialGradient(x,y,12,x,y,139);field.addColorStop(0,color(starRGB,.1+energy*.055+level*.06));field.addColorStop(.43,color(starRGB,.045));field.addColorStop(1,color(starRGB,0));ctx.fillStyle=field;ctx.fillRect(0,0,W,H);
  orbit(x,y,-19*Math.PI/180,t*(Math.PI*2/9),false,breathe*.3);orbit(x,y,71*Math.PI/180,-t*(Math.PI*2/13)+1.8,false,breathe*.3);
  if(moving){const rate=pause?0:listen?16:think?12:speak?20:starState==='error'?2:starState==='success'?3:4;emission+=dt*rate;while(emission>=1){addParticle(starState);emission--;}
   for(const p of particles){p.life+=dt;if(p.mode==='listen'){p.r-=p.speed*dt;p.a+=dt*.16;p.x=Math.cos(p.a)*p.r;p.y=Math.sin(p.a)*p.r*.8;if(p.r<15)p.life=p.max;}else if(p.mode==='think'){p.r-=dt*7;p.a+=dt*p.spin;p.x=Math.cos(p.a)*p.r;p.y=Math.sin(p.a)*p.r*.65;}else if(['speak','success'].includes(p.mode)){p.r+=p.speed*dt;p.x=Math.cos(p.a)*p.r;p.y=Math.sin(p.a)*p.r*.85;}else{p.a+=p.spin*dt;p.x+=Math.sin(p.a)*dt*7;p.y-=dt*p.speed*.25;} }
   particles=particles.filter(p=>p.life<p.max&&p.r<175);
  }
  ctx.save();ctx.globalCompositeOperation='screen';for(const p of particles){const age=p.life/p.max,fade=Math.sin(Math.min(1,age)*Math.PI)*p.brightness*(pause?.25:1);if(fade<.02)continue;ctx.fillStyle=color(starHot,fade);ctx.shadowColor=color(starRGB,.8);ctx.shadowBlur=p.size*4;ctx.beginPath();ctx.arc(x+p.x,y+p.y,p.size*(.8+Math.sin(age*Math.PI)*.3),0,Math.PI*2);ctx.fill();}ctx.restore();
  const tension=.30+(frozen?0:Math.sin(t*.75)*.017)+(listen?level*.015:0);
  ctx.save();formPath(x,y,rays,tension);ctx.shadowColor=color(starRGB,.9);ctx.shadowBlur=19+level*14+energy*12;ctx.fillStyle=color(starRGB,.7);ctx.fill();ctx.restore();
  const body=ctx.createRadialGradient(hx,hy,2,x,y,88);body.addColorStop(0,color(starHot));body.addColorStop(.2,color(starHot));body.addColorStop(.52,color(starRGB));body.addColorStop(.9,color(starRGB.map((c,i)=>Math.round(c*.42+starDeep[i]*.58))));body.addColorStop(1,color(starDeep));
  formPath(x,y,rays,tension);ctx.fillStyle=body;ctx.fill();
  ctx.save();ctx.clip();ctx.globalCompositeOperation='screen';const width=68,shift=Math.sin(t*.48)*30;const caustic=ctx.createLinearGradient(x-width+shift,y-70,x+width+shift,y+70);caustic.addColorStop(0,color(starHot,0));caustic.addColorStop(.4,color(starHot,0));caustic.addColorStop(.52,color(starHot,.22+hover*.08));caustic.addColorStop(.66,color(starHot,0));caustic.addColorStop(1,color(starHot,0));ctx.fillStyle=caustic;ctx.fillRect(x-90,y-90,180,180);ctx.restore();
  ctx.save();formPath(x,y,rays,tension);ctx.clip();ctx.globalCompositeOperation='screen';
  for(let i=0;i<4;i++){const angle=i*Math.PI/2,travel=(t*(think?.9:speak?.65:.35)+i*.24)%1,alpha=.16+.16*(.5+.5*Math.sin(t*1.1+i*1.57))+level*.12;ctx.save();ctx.translate(x,y);ctx.rotate(angle);const sweep=ctx.createLinearGradient(0,0,70,0);sweep.addColorStop(0,color(starHot,0));sweep.addColorStop(Math.max(0,travel-.14),color(starHot,0));sweep.addColorStop(travel,color(starHot,alpha));sweep.addColorStop(Math.min(1,travel+.14),color(starHot,0));sweep.addColorStop(1,color(starHot,0));ctx.fillStyle=sweep;ctx.fillRect(0,-34,75,68);ctx.restore();}
  ctx.restore();
  formPath(x,y,rays,tension);ctx.strokeStyle=color(starHot,.2+level*.12+hover*.15);ctx.lineWidth=.75;ctx.stroke();
  const core=ctx.createRadialGradient(x-2+px*.1,y-3+py*.1,0,x,y,15+energy*4+level*3);core.addColorStop(0,color(starHot,.95));core.addColorStop(.3,color(starHot,.68));core.addColorStop(1,color(starHot,0));ctx.fillStyle=core;ctx.fillRect(x-30,y-30,60,60);
  orbit(x,y,-19*Math.PI/180,t*(Math.PI*2/9),true,breathe*.3);orbit(x,y,71*Math.PI/180,-t*(Math.PI*2/13)+1.8,true,breathe*.3);
 }
  function paint(still=false){const current=window.flowAssistant?.getState?.()||{};const next=({listening:'listen',thinking:'think',speaking:'speak',error:'error',success:'success'})[current.state]||'ready';if(next!==starState){starState=next;emission=0;energy=.5;}
    const now=performance.now(),dt=lastPaint?Math.min(.04,(now-lastPaint)/1000):1/60;lastPaint=now;
    ctx.setTransform(dpr,0,0,dpr,0,0);if(still)particles=[];draw(still?0:dt,!still);
  }
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function curvePoint(a,b,c,d,t){const q=1-t;return{x:q*q*q*a.x+3*q*q*t*b.x+3*q*t*t*c.x+t*t*t*d.x,y:q*q*q*a.y+3*q*q*t*b.y+3*q*t*t*c.y+t*t*t*d.y};}
  function makeRoute(start,end,width,height){const departure={x:width+155,y:Math.max(30,end.y-100)},arrival={x:-150,y:Math.max(20,end.y-Math.min(230,height*.33))};return{start,end,departure,arrival,width,height};}
  function routeAt(route,u){const {start,end,departure,arrival,width}=route;if(u<.26){const t=Math.pow(u/.26,1.8);return curvePoint(start,{x:start.x+65,y:start.y-20},{x:width+80,y:departure.y+70},departure,t);}if(u<.43){const t=(u-.26)/.17;return curvePoint(departure,{x:width+460,y:-850},{x:-490,y:-850},arrival,t);}const t=1-Math.pow(1-(u-.43)/.57,2.6);return curvePoint(arrival,{x:width*.08,y:arrival.y-12},{x:end.x-18,y:end.y-42},end,t);}
  function removeFlight(){if(!flight)return;flight.canvas.remove();flight=null;button.style.removeProperty('transform');button.style.removeProperty('opacity');button.style.removeProperty('filter');}
  // Light is a small cloud around the moving star. No connected path or strokes.
  function drawParticles(f,clock,fade){const c=f.ctx;c.setTransform(f.dpr,0,0,f.dpr,0,0);c.clearRect(0,0,f.width,f.height);f.particles=f.particles.filter(p=>clock-p.born<p.life);f.history=f.history.filter(p=>clock-p.time<180);c.save();c.globalCompositeOperation='lighter';for(let i=0;i<f.history.length;i+=3){const p=f.history[i],age=1-(clock-p.time)/180,radius=26+34*(1-age);const glow=c.createRadialGradient(p.x,p.y,0,p.x,p.y,radius);glow.addColorStop(0,rgb(colors.accent,.035*age*fade));glow.addColorStop(1,rgb(colors.accent,0));c.fillStyle=glow;c.fillRect(p.x-radius,p.y-radius,radius*2,radius*2);}for(const p of f.particles){const age=(clock-p.born)/p.life,x=p.x+p.dx*age,y=p.y+p.dy*age;const alpha=Math.sin(Math.PI*age)*p.alpha*fade;c.shadowColor=rgb(colors.accent);c.shadowBlur=7;c.fillStyle=rgb(p.hot?colors.hot:colors.accent,alpha);c.beginPath();c.arc(x,y,p.radius*(1-age*.5),0,Math.PI*2);c.fill();}c.restore();}
  function advanceFlight(clock){if(!flight)return;const f=flight,elapsed=clock-f.started;if(elapsed<f.duration){const u=clamp(elapsed/f.duration,0,1),p=routeAt(f.route,u),previous=f.position||p;const speed=Math.hypot(p.x-previous.x,p.y-previous.y)/Math.max(8,clock-f.lastTime)*1000;const arriving=clamp((u-.43)/.57,0,1),scale=u<.43?.36+.12*(u/.43):.64+.36*(1-Math.pow(1-arriving,2));const tilt=u<.43?u*.5:-.24*Math.pow(1-arriving,1.5);button.style.transform=`translate3d(${p.x-f.end.x}px,${p.y-f.end.y}px,0) rotate(${tilt}rad) scale(${scale})`;button.style.filter=`blur(${Math.min(1.6,speed/1800)}px)`;f.position=p;f.progress=u;f.lastTime=clock;f.offscreen=f.offscreen||p.x< -100||p.x>f.width+100||p.y< -100;if(p.x>-100&&p.x<f.width+100&&p.y>-100&&p.y<f.height+100){f.history.push({...p,time:clock});if(clock-f.lastParticle>32&&speed>35){const seed=f.emitted++*2.399,spread=15+Math.sin(seed*1.7)*13;f.particles.push({x:p.x+Math.cos(seed)*spread,y:p.y+Math.sin(seed)*spread,born:clock,life:420+(f.emitted%4)*70,dx:Math.cos(seed)*24,dy:Math.sin(seed)*24-10,radius:.7+(f.emitted%3)*.35,alpha:.22+(f.emitted%3)*.1,hot:f.emitted%3===0});f.lastParticle=clock;}}drawParticles(f,clock,1);
    }else{button.style.removeProperty('transform');button.style.removeProperty('filter');f.progress=1;drawParticles(f,clock,clamp(1-(elapsed-f.duration)/600,0,1));if(elapsed>=f.duration+600)removeFlight();}}
  function tick(){frame=0;if(layer.hidden||document.hidden)return;paint(reduced());if(!reduced()){advanceFlight(performance.now());frame=requestAnimationFrame(tick);}}
  function cancelEntrance(){removeFlight();entrances.forEach(animation=>animation.cancel());entrances=[];}
  function sync(){if(layer.hidden||reduced()||document.hidden)cancelEntrance();if(frame)cancelAnimationFrame(frame);frame=0;if(!layer.hidden&&!document.hidden)tick();}
  function launch(){cancelEntrance();refreshColor();if(layer.hidden){smoothLevel=0;sync();return;}if(reduced()){sync();return;}const stage=layer.querySelector('.fa-stage'),fab=document.querySelector('.assistant-fab');if(!stage||!fab)return;const a=fab.getBoundingClientRect(),b=button.getBoundingClientRect(),bounds=layer.getBoundingClientRect();const start={x:a.x+a.width/2-bounds.x,y:a.y+a.height/2-bounds.y},end={x:b.x+b.width/2-bounds.x,y:b.y+b.height/2-bounds.y};const trail=document.createElement('canvas');trail.className='fa-flight-particles';trail.setAttribute('aria-hidden','true');const width=bounds.width,height=bounds.height,ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(2200000/(width*height)));trail.width=Math.ceil(width*ratio);trail.height=Math.ceil(height*ratio);layer.insertBefore(trail,stage);const trailContext=trail.getContext('2d');if(!trailContext){trail.remove();sync();return;}const now=performance.now();flight={canvas:trail,ctx:trailContext,dpr:ratio,width,height,started:now,lastTime:now,lastParticle:now,duration:1480,start,end,route:makeRoute(start,end,width,height),history:[],particles:[],emitted:0,offscreen:false,position:start,progress:0};advanceFlight(now);
    entrances=[...stage.querySelectorAll('.fa-status,.fa-answer,.fa-controls')].map((node,index)=>node.animate([{opacity:0,translate:'0 6px'},{opacity:1,translate:'0 0'}],{duration:420,delay:980+index*65,fill:'backwards',easing:'cubic-bezier(.2,.7,.2,1)'}));const edge=layer.querySelector('.fa-screen-energy');if(edge)entrances.push(edge.animate([{opacity:0},{opacity:1,offset:.7},{opacity:.8}],{duration:900,easing:'ease-out'}));sync();}
  new MutationObserver(records=>{if(records.some(r=>r.attributeName==='hidden'))launch();else if(flight){cancelEntrance();sync();}}).observe(layer,{attributes:true,attributeFilter:['hidden','class','data-keyboard']});
  window.addEventListener('resize',()=>{if(flight){cancelEntrance();sync();}refreshColor();});
  let colorFrame=0;const scheduleColor=()=>{if(!colorFrame)colorFrame=requestAnimationFrame(()=>{colorFrame=0;refreshColor();});};window.addEventListener('scroll',scheduleColor,{passive:true});window.addEventListener('hashchange',scheduleColor);document.addEventListener('flow:palettechange',refreshColor);
  document.addEventListener('flow:effectschange',sync);document.addEventListener('visibilitychange',sync);window.addEventListener('pageshow',sync);window.addEventListener('pagehide',()=>{cancelEntrance();if(frame)cancelAnimationFrame(frame);frame=0;});
  button.addEventListener('pointerdown',()=>react('press'));
  window.flowAssistantVisual={react,getState:()=>({shape:pose,gradientPhase,liveParticles:particles.length,ringAngleDifference:90,frames,active:!!frame,canvasReady:true,flying:!!flight,flightProgress:flight?.progress??1,flightPosition:flight?{...flight.position}:null,particleCount:flight?.particles.length??0,exitedViewport:flight?.offscreen??false,accent:[...colors.accent],fabContrast:document.querySelector('.assistant-fab')?.dataset.contrast})};refreshColor();paint(true);sync();
})();
