class LoopDeck {
  constructor(track,{count,index,card,onChange,onAction,actionLabel,warmImages=false}) {
    this.track=track;this.count=count;this.position=index;this.card=card;this.onChange=onChange;
    this.onAction=onAction;
    this.actionLabel=actionLabel;
    this.warmImages=warmImages;
    this.velocity=0;this.frame=0;this.base=null;this.drag=null;this.ignoreClickUntil=0;this.lift=0;
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.abort=new AbortController();const options={signal:this.abort.signal};
    track.addEventListener('dragstart',e=>e.preventDefault(),options);
    track.addEventListener('pointerdown',e=>this.down(e),options);
    track.addEventListener('pointermove',e=>this.move(e),options);
    track.addEventListener('pointerup',e=>this.up(e),options);
    track.addEventListener('pointercancel',e=>this.up(e,true),options);
    track.addEventListener('pointerleave',e=>{if(this.drag&&!this.drag.moved)this.up(e,true);},options);
    // Touch transfers implicit capture from the pressed button to this track.
    track.addEventListener('lostpointercapture',e=>{if(e.target===track&&this.drag&&!track.hasPointerCapture(e.pointerId))this.up(e,true);},options);
    track.addEventListener('click',e=>{if(performance.now()<this.ignoreClickUntil){e.preventDefault();e.stopImmediatePropagation();}},{...options,capture:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.cancelGesture();},options);
    window.addEventListener('blur',()=>this.cancelGesture(),options);
    window.addEventListener('pagehide',()=>this.cancelGesture(),options);
    window.addEventListener('flow:suspend',()=>this.cancelGesture(),options);
    track.addEventListener('wheel',e=>{
      const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.shiftKey?e.deltaY:0;
      if(!delta||count<2)return;e.preventDefault();if(this.spinning)return;this.stop();
      this.position+=delta*(e.deltaMode===1?16:1)/this.step;
      this.requestPaint();clearTimeout(this.wheelTimer);this.wheelTimer=setTimeout(()=>this.settle(),100);
    },{...options,passive:false});
    this.measure();this.paint();
    if(typeof ResizeObserver==='function'){
      this.resizeObserver=new ResizeObserver(()=>{const before=this.measuredWidth;this.measure();if(this.measuredWidth!==before)this.paint();});
      this.resizeObserver.observe(track);
    }
  }
  wrap(n){return ((n%this.count)+this.count)%this.count;}
  itemIndex(slot){return this.spinMap?.get(slot) ?? this.wrap(slot);}
  measure(){this.measuredWidth=Math.min(480,innerWidth*.8,this.track.clientWidth*.94);}
  get width(){return this.measuredWidth??Math.min(480,innerWidth*.8,this.track.clientWidth*.94);}
  get step(){return this.width-25;}
  requestPaint(){if(!this.paintFrame)this.paintFrame=requestAnimationFrame(()=>{this.paintFrame=0;this.paint();});}
  rebase(position){
    const shift=Math.round(position-this.position);
    for(const node of this.track?.children||[])node.dataset.slot=String(Number(node.dataset.slot)+shift);
    this.position=position;this.base=null;
  }
  stop(){
    clearTimeout(this.actionTimer);this.actionTimer=0;
    if(this.paintFrame)cancelAnimationFrame(this.paintFrame);this.paintFrame=0;
    cancelAnimationFrame(this.frame);this.frame=0;this.velocity=0;clearTimeout(this.wheelTimer);
    if(this.spinMap){const nearest=Math.round(this.position),index=this.itemIndex(nearest);this.rebase(this.position+index-nearest);this.spinMap=null;}
    this.spinning=false;
  }
  cancelGesture(){
    const drag=this.drag;this.drag=null;this.stop();this.lift=0;
    this.track.classList.remove('dragging');delete this.track.dataset.cardAction;
    if(drag&&this.track.hasPointerCapture(drag.id))this.track.releasePointerCapture(drag.id);
    this.ignoreClickUntil=performance.now()+350;this.position=Math.round(this.position);this.paint();
  }
  systemGestureStart(y){
    const viewport=window.visualViewport,bottom=viewport?viewport.height+viewport.offsetTop:innerHeight;
    const insets=window.flowNativeInsets,nativeBottom=insets?.width>0?Math.max(0,insets.bottom||0)*innerWidth/insets.width:0;
    return y>=bottom-Math.max(52,nativeBottom+16);
  }
  paint(){
    if(this.paintFrame)cancelAnimationFrame(this.paintFrame);this.paintFrame=0;
    const base=Math.floor(this.position),nearest=Math.round(this.position);
    if(base!==this.base){
      this.base=base;const slots=this.count===1?[0]:Array.from({length:7},(_,i)=>base+i-3);
      const wanted=new Set(slots),existing=new Map();
      for(const node of [...this.track.children]){
        const slot=Number(node.dataset.slot);
        if(!wanted.has(slot)||Number(node.dataset.index)!==this.itemIndex(slot))node.remove();
        else existing.set(slot,node);
      }
      // Keep decoded posters and their controls mounted as the window moves.
      for(const slot of slots)if(!existing.has(slot)){
        this.track.insertAdjacentHTML('beforeend',this.card(this.itemIndex(slot),slot));
        if(this.warmImages)for(const image of this.track.lastElementChild.querySelectorAll('img')){
          // Hidden edge cards must be ready before entering the visible window.
          // This is bounded by the seven mounted slots, never the whole library.
          image.loading='eager';image.decoding='async';image.decode?.().catch(()=>{});
        }
      }
    }
    const width=this.width,step=this.step;
    const height=Number(this.track.dataset.heightLimit)||width*1.5+240;
    if(this.paintedHeight!==height){this.track.style.height=`${height}px`;this.track.style.setProperty('--movie-poster-height',`${height-240}px`);this.paintedHeight=height;}
    for(const node of this.track.children){
      const slot=Number(node.dataset.slot),distance=slot-this.position,depth=Math.min(Math.abs(distance),2);
      if(node.style.width!==`${width}px`)node.style.width=`${width}px`;
      const lift=slot===nearest?(this.drag?.axis==='y'?Math.max(-95,Math.min(95,this.drag.dy||0)):(this.lift||0)):0;
      node.style.transform=`translate3d(calc(-50% + ${distance*step}px), ${depth*14+lift}px, 0) scale(${1-depth*.075})`;
      node.style.opacity=String(Math.max(0,1-Math.max(0,depth-.15)*.2));
      node.style.visibility=Math.abs(distance)>2.3?'hidden':'visible';
      // Only the front card crossing changes stacking order. Updating z-index
      // for every subpixel of motion forced the posters to repaint while swiping.
      const stacking=String(100-Math.abs(slot-nearest));if(node.style.zIndex!==stacking)node.style.zIndex=stacking;
      const active=slot===nearest;if(node._deckActive!==active){node._deckActive=active;node.classList.toggle('active',active);node.querySelectorAll('button').forEach(b=>b.tabIndex=active?0:-1);}
      const hidden=String(Math.abs(distance)>1.6);if(node.getAttribute('aria-hidden')!==hidden)node.setAttribute('aria-hidden',hidden);
    }
    const index=this.itemIndex(nearest);if(this.notifiedIndex!==index){this.notifiedIndex=index;this.onChange(index);}
  }
  down(e){
    if(e.button!==0||(!this.onAction&&this.count<2)||this.drag||this.spinning)return;
    if(this.onAction&&this.systemGestureStart(e.clientY))return;
    this.stop();this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastAt:performance.now(),start:this.position,moved:false};
    // A tap must keep its button target. Capture in move(), just before repainting a drag.
  }
  move(e){
    const d=this.drag;if(!d||d.id!==e.pointerId)return;
    const dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.moved){
      if(Math.max(Math.abs(dx),Math.abs(dy))<10)return;
      d.axis=Math.abs(dy)>Math.abs(dx)?'y':'x';
      if(d.axis==='y'&&!this.onAction || d.axis==='x'&&this.count<2){this.drag=null;this.settle();return;}
      d.moved=true;this.track.setPointerCapture(e.pointerId);this.track.classList.add('dragging');
    }
    if(d.axis==='y'){
      d.dy=dy;this.track.dataset.cardAction=this.actionLabel?.(dy<0?'viewed':'menu',this.itemIndex(Math.round(this.position))) || (dy<0?'Просмотрено':'Действия');this.requestPaint();return;
    }
    const now=performance.now(),dt=Math.max(8,now-d.lastAt);
    this.velocity=this.velocity*.25+(-(e.clientX-d.lastX)/dt*1000/this.step)*.75;
    this.position=d.start-dx/this.step;d.lastX=e.clientX;d.lastAt=now;this.requestPaint();
  }
  up(e,cancelled=false){
    const d=this.drag;if(!d||d.id!==e.pointerId)return;
    this.drag=null;this.track.classList.remove('dragging');
    delete this.track.dataset.cardAction;
    if(this.track.hasPointerCapture(e.pointerId))this.track.releasePointerCapture(e.pointerId);
    if(d.moved)this.ignoreClickUntil=performance.now()+350;
    if(d.axis==='y'){
      const action=!cancelled && Math.abs(d.dy||0)>78 ? (d.dy<0?'viewed':'menu') : null;
      this.lift=Math.max(-95,Math.min(95,d.dy||0));
      const from=this.lift,to=action?(d.dy<0?-160:160):0,start=performance.now();
      const finish=()=>{this.actionTimer=0;this.lift=0;this.paint();if(action&&!(typeof document!=='undefined'&&document.hidden))this.onAction?.(action,this.wrap(Math.round(this.position)));};
      // A system home gesture may release the pointer before the app loses focus.
      // Keep its cancellation window even when visual motion is disabled.
      if(this.reduced){this.lift=0;this.paint();if(action)this.actionTimer=setTimeout(finish,240);else finish();return;}
      const tick=now=>{
        const t=Math.min(1,(now-start)/240);this.lift=from+(to-from)*(1-Math.pow(1-t,3));this.paint();
        if(t<1)this.frame=requestAnimationFrame(tick);else {this.frame=0;finish();}
      };
      this.frame=requestAnimationFrame(tick);return;
    }
    if(cancelled||performance.now()-d.lastAt>100)this.velocity=0;
    if(this.reduced){this.position=Math.round(this.position);this.paint();return;}
    this.velocity=Math.max(-12,Math.min(12,this.velocity));this.animate(Math.abs(this.velocity)>.22?'coast':'snap');
  }
  settle(){this.velocity=0;this.animate('snap');}
  animate(phase,target=Math.round(this.position)){
    cancelAnimationFrame(this.frame);
    if(this.reduced){this.position=target;this.paint();return;}
    let previous=performance.now();
    const tick=now=>{
      const dt=Math.min(.025,Math.max(.001,(now-previous)/1000));previous=now;
      if(phase==='coast'){
        this.position+=this.velocity*dt;this.velocity*=Math.exp(-2.5*dt);
        if(Math.abs(this.velocity)<.22){phase='snap';target=Math.round(this.position);}
      }else{
        this.velocity+=(-180*(this.position-target)-27*this.velocity)*dt;
        this.position+=this.velocity*dt;
        if(Math.abs(this.position-target)<.0008&&Math.abs(this.velocity)<.008){
          this.rebase(this.wrap(target));this.velocity=0;this.paint();this.frame=0;return;
        }
      }
      this.paint();this.frame=requestAnimationFrame(tick);
    };
    this.frame=requestAnimationFrame(tick);
  }
  select(index,slot,smooth=true){
    this.stop();const target=slot??Math.round(this.position)+this.wrap(index-Math.round(this.position)+Math.floor(this.count/2))-Math.floor(this.count/2);
    if(!smooth){this.position=target;this.paint();}else this.animate('snap',target);
  }
  nudge(direction){this.stop();this.animate('snap',Math.round(this.position)+direction);}
  spinTo(index,duration=2400,onDone=()=>{}){
    this.stop();index=this.wrap(index);
    if(this.reduced||this.count<2||duration<120){this.position=index;this.base=null;this.paint();onDone();return;}
    const start=this.position,first=Math.floor(start),last=Math.round(start)+(Math.random()<.5?-12:12);
    this.spinMap=new Map();
    // A bounded reel keeps large libraries from requesting hundreds of posters.
    for(let slot=Math.min(first,last)-3;slot<=Math.max(first,last)+3;slot++)this.spinMap.set(slot,Math.abs(slot-start)<=3?this.wrap(slot):Math.floor(Math.random()*this.count));
    for(let offset=-3;offset<=3;offset++)this.spinMap.set(last+offset,this.wrap(index+offset));
    this.base=null;this.spinning=true;const began=performance.now();
    const tick=now=>{
      const t=Math.min(1,Math.max(0,(now-began)/duration));
      this.position=start+(last-start)*(1-Math.pow(1-t,3));this.paint();
      if(t<1)this.frame=requestAnimationFrame(tick);
      else {this.rebase(index);this.spinMap=null;this.spinning=false;this.frame=0;this.paint();onDone();}
    };
    this.frame=requestAnimationFrame(tick);
  }
  destroy(){
    const drag=this.drag;this.drag=null;this.stop();this.lift=0;
    this.track.classList.remove('dragging');delete this.track.dataset.cardAction;
    if(drag&&this.track.hasPointerCapture(drag.id))this.track.releasePointerCapture(drag.id);
    this.resizeObserver?.disconnect();this.abort.abort();
  }
}
