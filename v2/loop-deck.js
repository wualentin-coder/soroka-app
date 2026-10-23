class LoopDeck {
  constructor(track,{count,index,card,onChange}) {
    this.track=track;this.count=count;this.position=index;this.card=card;this.onChange=onChange;
    this.velocity=0;this.frame=0;this.base=null;this.drag=null;this.ignoreClickUntil=0;
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.abort=new AbortController();const options={signal:this.abort.signal};
    track.addEventListener('pointerdown',e=>this.down(e),options);
    track.addEventListener('pointermove',e=>this.move(e),options);
    track.addEventListener('pointerup',e=>this.up(e),options);
    track.addEventListener('pointercancel',e=>this.up(e,true),options);
    track.addEventListener('lostpointercapture',e=>{if(this.drag)this.up(e,true);},options);
    track.addEventListener('click',e=>{if(performance.now()<this.ignoreClickUntil){e.preventDefault();e.stopImmediatePropagation();}},{...options,capture:true});
    track.addEventListener('wheel',e=>{
      const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.shiftKey?e.deltaY:0;
      if(!delta||count<2)return;e.preventDefault();this.stop();
      this.position+=delta*(e.deltaMode===1?16:1)/this.step;
      this.paint();clearTimeout(this.wheelTimer);this.wheelTimer=setTimeout(()=>this.settle(),100);
    },{...options,passive:false});
    this.paint();
  }
  wrap(n){return ((n%this.count)+this.count)%this.count;}
  get width(){return Math.min(250,Number(this.track.dataset.widthLimit)||Infinity,this.track.clientWidth*(innerHeight<760?.51:.57));}
  get step(){return this.width-25;}
  stop(){cancelAnimationFrame(this.frame);this.frame=0;this.velocity=0;clearTimeout(this.wheelTimer);}
  paint(){
    const base=Math.floor(this.position),nearest=Math.round(this.position);
    if(base!==this.base){
      this.base=base;const slots=this.count===1?[0]:Array.from({length:7},(_,i)=>base+i-3);
      this.track.innerHTML=slots.map(slot=>this.card(this.wrap(slot),slot)).join('');
    }
    const width=this.width,step=this.step;
    this.track.style.height=`${width*1.5+(innerHeight<760?162:170)}px`;
    for(const node of this.track.children){
      const slot=Number(node.dataset.slot),distance=slot-this.position,depth=Math.min(Math.abs(distance),2);
      node.style.width=`${width}px`;
      node.style.transform=`translate3d(calc(-50% + ${distance*step}px), ${depth*14}px, 0) scale(${1-depth*.075})`;
      node.style.opacity=String(Math.max(0,1-Math.max(0,depth-.15)*.2));
      node.style.visibility=Math.abs(distance)>2.3?'hidden':'visible';
      node.style.zIndex=String(100-Math.round(Math.abs(distance)*20));
      node.classList.toggle('active',slot===nearest);
      const hidden=Math.abs(distance)>1.6;node.setAttribute('aria-hidden',String(hidden));
      node.querySelectorAll('button').forEach(b=>b.tabIndex=slot===nearest?0:-1);
    }
    this.onChange(this.wrap(nearest));
  }
  down(e){
    if(e.button!==0||this.count<2||this.drag)return;
    this.stop();this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastAt:performance.now(),start:this.position,moved:false};
  }
  move(e){
    const d=this.drag;if(!d||d.id!==e.pointerId)return;
    const dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.moved){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){this.drag=null;this.settle();return;}
      if(Math.abs(dx)<7)return;
      d.moved=true;this.track.setPointerCapture(e.pointerId);this.track.classList.add('dragging');
    }
    const now=performance.now(),dt=Math.max(8,now-d.lastAt);
    this.velocity=this.velocity*.25+(-(e.clientX-d.lastX)/dt*1000/this.step)*.75;
    this.position=d.start-dx/this.step;d.lastX=e.clientX;d.lastAt=now;this.paint();
  }
  up(e,cancelled=false){
    const d=this.drag;if(!d||d.id!==e.pointerId)return;
    this.drag=null;this.track.classList.remove('dragging');
    if(this.track.hasPointerCapture(e.pointerId))this.track.releasePointerCapture(e.pointerId);
    if(d.moved)this.ignoreClickUntil=performance.now()+350;
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
        this.position+=this.velocity*dt;this.velocity*=Math.exp(-5.8*dt);
        if(Math.abs(this.velocity)<.22){phase='snap';target=Math.round(this.position);}
      }else{
        this.velocity+=(-180*(this.position-target)-27*this.velocity)*dt;
        this.position+=this.velocity*dt;
        if(Math.abs(this.position-target)<.0008&&Math.abs(this.velocity)<.008){
          this.position=this.wrap(target);this.velocity=0;this.paint();this.frame=0;return;
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
  destroy(){this.stop();this.abort.abort();}
}
