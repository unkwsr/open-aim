// Render the original hurt sound once during scenario preparation. Each hit
// still plays at its original time and through the existing master gain.
const cache=new WeakMap();
export function warmHurtSound(context,native){
 let entry=cache.get(context);if(entry)return entry.pending;
 entry={buffer:null,pending:null};cache.set(context,entry);
 entry.pending=(async()=>{
  const offline=new OfflineAudioContext(1,Math.ceil(context.sampleRate*.24),context.sampleRate);
  native(offline,offline.destination,0);
  entry.buffer=await offline.startRendering();
 })().catch(error=>{cache.delete(context);console.warn('Hurt sound preparation:',error);});
 return entry.pending;
}
export function playHurtSound(context,destination,time,native){
 const buffer=cache.get(context)?.buffer;
 if(!buffer){native(context,destination,time);return;}
 const source=context.createBufferSource();source.buffer=buffer;source.connect(destination);
 source.onended=()=>{source.onended=null;source.disconnect();};source.start(time);
}
export const hurtSoundReady=context=>!!cache.get(context)?.buffer;
