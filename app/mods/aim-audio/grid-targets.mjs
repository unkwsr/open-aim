const URL='/aim-audio/grid-targets/01-saya-spawn.ogg';
let bytes;
const contexts=new WeakMap();
function state(context){
 let value=contexts.get(context);
 if(!value){value={buffer:null,pending:null,voices:new Set()};contexts.set(context,value);}
 return value;
}
export function warmGridTargetAudio(context){
 const value=state(context);
 if(value.buffer)return Promise.resolve(value.buffer);
 if(!value.pending){
  bytes??=fetch(URL).then(response=>{if(!response.ok)throw Error('Grid target audio unavailable');return response.arrayBuffer();}).catch(error=>{bytes=null;throw error});
  value.pending=bytes.then(data=>context.decodeAudioData(data.slice(0))).then(buffer=>value.buffer=buffer).catch(error=>{value.pending=null;throw error});
 }
 return value.pending;
}
export function playGridTargetAudio(context,destination){
 const value=state(context);
 if(!value.buffer){warmGridTargetAudio(context).catch(()=>{});return false;}
 while(value.voices.size>=16){const oldest=value.voices.values().next().value;value.voices.delete(oldest);try{oldest.stop()}catch{}oldest.disconnect();}
 const source=context.createBufferSource();source.buffer=value.buffer;source.connect(destination);value.voices.add(source);
 source.onended=()=>{value.voices.delete(source);source.disconnect();};source.start(context.currentTime);return true;
}
export function clearGridTargetAudio(context){
 const value=contexts.get(context);if(!value)return;
 for(const source of value.voices){try{source.stop()}catch{}source.disconnect();}value.voices.clear();
}
function hitIds(shot){
 const ids=new Set();for(const hit of shot.pellets??[shot]){if(hit.hitActorId!=null)ids.add(hit.hitActorId);for(const also of hit.also??[])if(also.actorId!=null)ids.add(also.actorId);}
 return ids;
}
export function isGridTargetHit(shot,actors,templates){
 const ids=hitIds(shot);
 return actors.some(actor=>ids.has(actor.id)&&templates.has(actor.templateId));
}
export function hasBotHit(shot,actors,templates){
 const ids=hitIds(shot);return actors.some(actor=>ids.has(actor.id)&&!templates.has(actor.templateId));
}
export function isGridTargetActor(id,actors,templates){
 return actors.some(actor=>actor.id===id&&templates.has(actor.templateId));
}
