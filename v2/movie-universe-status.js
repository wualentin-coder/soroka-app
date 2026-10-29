const universeOperations=new Map();
let universeOperationTimer=null;
function universeOperationStart(key,title,detail=''){
  universeOperations.set(key,{title,detail,at:Date.now()});
  if(!universeOperationTimer)universeOperationTimer=setInterval(()=>{
    for(const node of document.querySelectorAll('[data-mu-elapsed]')){
      const op=universeOperations.get(node.dataset.muElapsed);if(op)node.textContent=`${Math.floor((Date.now()-op.at)/1000)} с`;
    }
  },1000);
}
function universeOperationEnd(key){
  universeOperations.delete(key);if(!universeOperations.size){clearInterval(universeOperationTimer);universeOperationTimer=null;}
}
function renderUniverseOperations(inSheet=false){
  if(ui.sheet?.kind?.startsWith('universe-')&&!inSheet)return '';
  return [...universeOperations].map(([key,op])=>`<div class="mu-operation" role="status" aria-live="polite"><span class="mu-spinner" aria-hidden="true"></span><span><b>${esc(op.title)}</b>${op.detail?`<small>${esc(op.detail)}</small>`:''}</span><small data-mu-elapsed="${esc(key)}" aria-hidden="true">${Math.floor((Date.now()-op.at)/1000)} с</small></div>`).join('');
}
