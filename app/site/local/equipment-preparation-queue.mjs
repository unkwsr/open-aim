// One latest-choice job, detached from Resume and serialized with itself.
// Only prepare while the shop/pause leaves render resources safe to warm.
export function createEquipmentPreparationQueue({allowed,prepare,onError=()=>{},delayMs=90}){
 let latest=null,active=null,scheduled=false,disposed=false;
 const completed=new Set();
 function pump(){
  scheduled=false;
  if(disposed||active||!latest||!allowed())return;
  const job=latest;latest=null;active=job;
  const valid=()=>!disposed&&!job.cancelled&&active===job&&!latest&&allowed();
  Promise.resolve().then(async()=>{
   if(!valid())return;
   if(await prepare(job.value,valid)!==false&&valid()){
    completed.add(job.key);
    // Bound identity/settings history; actual models follow the engine cache.
    if(completed.size>16)completed.delete(completed.values().next().value);
   }
  }).catch(error=>{if(error?.name!=='AbortError')onError(error,job.value);})
   .finally(()=>{active=null;if(latest)schedule();});
 }
 function schedule(){if(!scheduled&&!disposed){scheduled=true;setTimeout(pump,delayMs);}}
 return {
  request(key,value,reusable=true){
   if(disposed||!allowed())return;
   if(!reusable)completed.delete(key);
   // Selecting an already-complete choice must still supersede an older job.
   if(completed.has(key)){latest=null;if(active&&active.key!==key)active.cancelled=true;return;}
   if(active?.key===key&&!active.cancelled){latest=null;return;}
   latest={key,value};if(active)active.cancelled=true;schedule();
  },
  dispose(){disposed=true;latest=null;completed.clear();},
 };
}
