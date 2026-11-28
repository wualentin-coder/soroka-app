import {prepareSnapshot, plannerDiff, plannerCollections,applyPlannerChanges} from './planner-model.mjs';

export const plannerSyncLimit = 200;

// The existing authenticated bridge owns credentials and HTTP/native fallback.
// This owner publishes server snapshots, never a fixture or a locally saved success.
export function createPlannerRuntime(host, {onState=()=>{}, onPhase=()=>{},outbox=null,canWrite=()=>true,onInvalidate=()=>{},snapshotCache=null,isOffline=()=>false}={}) {
  if (!host?.owner || !host?.isCurrent || !host?.request) throw new TypeError('planner_host_required');
  const copy=value=>structuredClone(value);
  let owner=null, generation=0, state=null, phase='idle', flight=null, pending=null, ids={},scope=null;
  let cacheOwner=null, usingOfflineSnapshot=false;
  const emit=value=>{phase=value;onPhase({phase,generation,pending:!!pending});};
  const publish=value=>{state=value;onState(value?copy(value):null);};
  const current=(lease,epoch)=>owner===lease&&generation===epoch&&host.isCurrent(lease);
  function invalidate(){generation++;owner=null;pending=null;flight=null;ids={};scope=null;cacheOwner=null;usingOfflineSnapshot=false;try{onInvalidate();}catch{}publish(null);emit('unauthorized');}
  const unsubscribe=host.subscribe?.(()=>{if(owner&&!host.isCurrent(owner))invalidate();});
  function lease(){const next=host.owner();if(!next)throw Error('planner_authorization_required');if(next!==owner){generation++;owner=next;pending=null;ids={};scope=null;cacheOwner=null;usingOfflineSnapshot=false;publish(null);}return {token:owner,epoch:generation};}
  function adopt(snapshot){
    const next=prepareSnapshot(snapshot,{searchHistory:state?.searchHistory||[]});
    snapshotCache?.write(cacheOwner, snapshot);
    usingOfflineSnapshot=false;publish(next);return copy(next);
  }
  function restoreOfflinePlan(){
    if(state)return null;
    const kept=snapshotCache?.read(cacheOwner);
    if(!kept)return null;
    const next=prepareSnapshot(kept);
    usingOfflineSnapshot=true;
    publish(next);
    emit('offline');
    return copy(next);
  }
  async function load(){
    if(flight||pending)throw Error('planner_write_pending');
    const {token,epoch}=lease();emit('loading');
    const operation={kind:'read'};flight=operation;
    try{
      const identity=snapshotCache && host.snapshotOwner ? await host.snapshotOwner(token).catch(()=>null) : null;
      if(!current(token,epoch))throw Error('planner_owner_changed');
      cacheOwner=identity;
      if(isOffline()){
        const kept=restoreOfflinePlan();
        if(kept)return kept;
      }
      if(outbox){const verified=await host.scope(token);if(!current(token,epoch)||!/^[a-f0-9]{64}$/.test(verified||''))throw Error('planner_verified_scope_required');scope=verified;}
      const snapshot=await host.request(token,{action:'planner_snapshot'});if(!current(token,epoch))throw Error('planner_owner_changed');const result=adopt(snapshot);
      const kept=outbox?.read(scope);if(kept){const next=copy(state);applyPlannerChanges(next,kept.changes,{});pending={owner:token,epoch,changes:kept.changes,next,outboxId:kept.id};}
      emit(pending?'pending':'ready');return result;
    }
    catch(error){
      if(owner===token&&generation===epoch){
        if(!host.isCurrent(token))invalidate();
        else if([401,403].includes(error?.status)){snapshotCache?.clear(cacheOwner);invalidate();}
        else {
          const unreachable=error instanceof TypeError && !error.message.startsWith('planner_full_snapshot_required')
            || error?.name==='AbortError' || [502,503,504].includes(error?.status);
          const kept=unreachable && restoreOfflinePlan();
          if(kept)return kept;
          emit(state?'offline':'error');
        }
      }
      throw error;
    }
    finally{if(flight===operation)flight=null;}
  }
  async function send(batch){
    const operation={kind:'write'};flight=operation;emit('processing');
    try{
      const answer=await host.request(batch.owner,{action:'planner_sync',changes:copy(batch.changes)});
      if(!current(batch.owner,batch.epoch)){if(owner===batch.owner&&generation===batch.epoch)invalidate();return false;}
      // Validate before replacing state or declaring any operation successful.
      const canonical=prepareSnapshot(answer?.snapshot,{searchHistory:state?.searchHistory||[]});
      if(!answer.ids||typeof answer.ids!=='object'||Array.isArray(answer.ids))throw Error('planner_ack_required');
      const nextIds={...ids};for(const [from,to] of Object.entries(answer.ids)){if(typeof to!=='string'||!to)throw Error('planner_id_map_invalid');nextIds[from]=to;}
      if(batch.outboxId)outbox.clear(scope,batch.outboxId);
      snapshotCache?.write(cacheOwner,answer.snapshot);
      ids=nextIds;pending=null;publish(canonical);
      if(answer.errors?.length){emit('rejected');return false;}
      emit('confirmed');return true;
    }catch(error){
      if(!current(batch.owner,batch.epoch)){if(owner===batch.owner&&generation===batch.epoch)invalidate();return false;}
      if(error?.status===401||error?.status===403){snapshotCache?.clear(cacheOwner);invalidate();return false;}
      // Keep the identical client IDs for createOnce after a lost HTTP ACK.
      // Explicit retry resends this batch; unrelated writes cannot overtake it.
      pending=batch;emit('pending');return false;
    }finally{if(flight===operation)flight=null;}
  }
  async function commit(change){
    if(!state||usingOfflineSnapshot||flight||pending||!owner||!host.isCurrent(owner)||!canWrite())return false;
    const next=copy(state);change(next);
    // A partial server ACK may already have allocated a client ID while another
    // record failed. A retained new-record form must update that accepted record.
    for(const [,list] of plannerCollections(next))for(let index=list.length-1;index>=0;index--){
      const record=list[index],mapped=ids[record.id];if(!mapped)continue;
      const canonical=list.findIndex((row,at)=>at!==index&&String(row.id)===String(mapped));
      if(canonical>=0){list[canonical]={...list[canonical],...record,id:mapped};list.splice(index,1);}else record.id=mapped;
    }
    const changes=plannerDiff(state,next);
    if(!changes.length)return true;
    if(changes.length>plannerSyncLimit||changes.filter(change=>change.op==='delete').length>12){emit('rejected');return false;}
    const batch={owner,epoch:generation,changes:copy(changes),next};
    if(outbox){try{batch.outboxId=outbox.write(scope,batch.changes);}catch{emit('storage-error');return false;}}
    return send(batch);
  }
  async function retry(change){
    if(!pending||flight||!current(pending.owner,pending.epoch)||!canWrite())return false;
    const original=pending,desired=copy(original.next);
    if(change)change(desired);
    const edits=plannerDiff(original.next,desired);
    if(!await send(original))return false;
    if(!current(original.owner,original.epoch)||!state)return false;
    if(!edits.length)return true;
    // A user may continue typing after a lost ACK. First settle the same createOnce
    // request, then replay only their subsequent field edits onto canonical IDs.
    const pools=new Map(plannerCollections(state)),beforePools=new Map(plannerCollections(original.next));
    const merged=copy(state),mergedPools=new Map(plannerCollections(merged));
    const fieldEdits=(base,wanted,target)=>{for(const key of new Set([...Object.keys(base||{}),...Object.keys(wanted||{})])){if(key==='id'||JSON.stringify(base?.[key])===JSON.stringify(wanted?.[key]))continue;if(Object.hasOwn(wanted,key))target[key]=copy(wanted[key]);else delete target[key];}};
    for(const edit of edits){
      if(edit.op==='replace'&&edit.col==='app'){
        for(const key of ['settings','savedSections']){merged[key]??={};fieldEdits(original.next[key],desired[key],merged[key]);}
        if(JSON.stringify(original.next.mapCategories)!==JSON.stringify(desired.mapCategories))merged.mapCategories=copy(desired.mapCategories);
        continue;
      }
      const list=mergedPools.get(edit.col),previous=beforePools.get(edit.col),id=ids[edit.id]||edit.id;
      if(!list||edit.op==='purge'||edit.op==='replace')return false;
      const at=list.findIndex(row=>String(row.id)===String(id));
      if(edit.op==='delete'){if(at>=0)list.splice(at,1);continue;}
      if(edit.op==='create'){if(at>=0)return false;list.push({...copy(edit.rec),id});continue;}
      if(at<0||!pools.has(edit.col))return false;
      fieldEdits(previous?.find(row=>String(row.id)===String(edit.id))||edit.prev,edit.rec,list[at]);
    }
    return commit(next=>Object.assign(next,merged));
  }
  async function incomeSplit(ids, apply) {
    if (!state || usingOfflineSnapshot || flight || pending || !owner || !host.isCurrent(owner) || apply && !canWrite()) return null;
    const token=owner, epoch=generation, operation={kind:'income-split'};
    flight=operation;
    try {
      const answer=await host.incomeSplit(token,ids,apply);
      if (!current(token,epoch)) return null;
      if (apply) {
        const snapshot=answer?.snapshot || await host.request(token,{action:'planner_snapshot'});
        if (!current(token,epoch)) return null;
        if (answer?.made && (!answer.task || !snapshot?.tasks?.some(row=>row.id===answer.task))) throw Error('planner_ack_required');
        adopt(snapshot);
      }
      return answer;
    } catch (error) {
      if (current(token,epoch) && [401,403].includes(error?.status)) { snapshotCache?.clear(cacheOwner);invalidate(); }
      throw error;
    } finally {
      if (flight===operation) flight=null;
    }
  }
  return Object.freeze({load,commit,retry,invalidate,incomeSplit,
    getState:()=>state?copy(state):null,
    resolveId:id=>ids[id]||id,
    get hasPendingFinance(){return pending?.changes.some(change=>change.col.startsWith('finance.'))===true;},
    get generation(){return generation;},get phase(){return phase;},get hasPending(){return !!pending;},
    get usingOfflineSnapshot(){return usingOfflineSnapshot;},
    dispose(){unsubscribe?.();invalidate();}
  });
}
