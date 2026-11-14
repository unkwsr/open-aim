// Event-linked first-person Jett samples. Missing events intentionally stay silent.
// Neon's sounds (neon.mjs) ride on the same audio object: the game only creates this one.
import { createNeonAudio } from './neon.mjs';
import { createNeonHud } from '../local/neon-hud.mjs';
import { createChamberHud } from '../local/chamber-hud.mjs';
export const JETT_AUDIO_FILES=['prime','updraft','equip','throw','dash','smoke-throw','smoke-flight','smoke-form','smoke-loop','equip-weapon','equip-dash','equip-smoke','burst-1','burst-2','burst-3','burst-4','burst-5','burst-last'];
const FILES=JETT_AUDIO_FILES,bytes=new Map(),contexts=new WeakMap();
function cache(context){let value=contexts.get(context);if(!value){value={buffers:null,pending:null};contexts.set(context,value);}return value;}
export function warmJettAudio(context){
 const value=cache(context);if(value.buffers)return Promise.resolve(value.buffers);
 if(!value.pending)value.pending=Promise.all(FILES.map(async name=>{
  if(!bytes.has(name))bytes.set(name,fetch('/aim-audio/jett/'+name+'.wav').then(r=>{if(!r.ok)throw Error('Jett audio '+r.status);return r.arrayBuffer();}).catch(e=>{bytes.delete(name);throw e;}));
  return[name,await context.decodeAudioData((await bytes.get(name)).slice(0))];
 })).then(entries=>value.buffers=Object.fromEntries(entries)).catch(e=>{value.pending=null;throw e;});
 return value.pending;
}
export function createJettAudio({ensure,settings}){
 const voices=new Set(),seen=new Set(),loops=new Map(),played={};let lastTick=-1,disposed=false,previous=null,firstEquip=true;
 const enabled=()=>{const s=settings();return s.enabled!==false&&s.volume>0;};
 function clear(reset=true){for(const voice of [...voices])voice.finish(true);if(reset){seen.clear();lastTick=-1;previous=null;firstEquip=true;}}
 function play(name,{loopKey=null,offset=0,level=.4,point=null,player=null}={}){
  if(disposed||!enabled())return null;const audio=ensure();if(!audio||audio.context.state==='closed')return null;
  const buffers=cache(audio.context).buffers;if(!buffers){warmJettAudio(audio.context).catch(()=>{});return null;}
  if(!buffers[name])return null;
  // One-shots cannot evict a persistent cloud loop and cause a restart each tick.
  while([...voices].filter(v=>!v.loopKey).length>=12)[...voices].find(v=>!v.loopKey).finish(true);
  if(loopKey&&loops.size>=4)loops.values().next().value.finish(true);
  const source=audio.context.createBufferSource(),gain=audio.context.createGain(),pan=point?audio.context.createStereoPanner():null;source.buffer=buffers[name];source.loop=!!loopKey;gain.gain.value=level;source.connect(gain);if(pan){gain.connect(pan);pan.connect(audio.master);}else gain.connect(audio.master);
  const voice={name,loopKey,update(position,pawn){if(!position||!pawn?.position)return;const dx=position.x-pawn.position.x,dy=position.y-pawn.position.y-1.5,dz=position.z-pawn.position.z,d=Math.hypot(dx,dy,dz);gain.gain.setTargetAtTime(level/(1+d/12),audio.context.currentTime,.02);pan?.pan.setTargetAtTime(Math.max(-1,Math.min(1,(dx*Math.cos(pawn.yaw??0)-dz*Math.sin(pawn.yaw??0))/Math.max(.1,d))),audio.context.currentTime,.02);},finish(stop=false){if(!voices.delete(voice))return;source.onended=null;if(stop)try{source.stop();}catch{}source.disconnect();gain.disconnect();pan?.disconnect();if(loopKey&&loops.get(loopKey)===voice)loops.delete(loopKey);}};
  voices.add(voice);if(loopKey)loops.set(loopKey,voice);voice.update(point,player);source.onended=()=>voice.finish();source.start(audio.context.currentTime,Math.max(0,offset)%source.buffer.duration);played[name]=(played[name]??0)+1;return voice;
 }
 function once(name,tick,options){const key=name+':'+tick;if(seen.has(key))return;seen.add(key);if(seen.size>64)seen.delete(seen.values().next().value);play(name,options);}
 function loop(name,key,offset,point,player){let voice=loops.get(key);if(!voice)voice=play(name,{loopKey:key,offset,point,player,level:.18});voice?.update(point,player);}
 const hide=()=>{if(document.hidden)clear(false);};
 if(typeof document!=='undefined')document.addEventListener('visibilitychange',hide);
 const neon=createNeonAudio({ensure,settings}),neonHud=createNeonHud(),chamberHud=createChamberHud();
 return{
  warm(){neon.warm().catch(e=>console.warn('Neon audio:',e));if(disposed||!enabled())return Promise.resolve();const a=ensure();return a?warmJettAudio(a.context):Promise.resolve();},
  phase(phase){neon.phase(phase);if(phase!=='running')neonHud.hide(),chamberHud.hide();if(phase!=='running'||!enabled())clear(false);},
  observe(snapshot,events=[]){
   neon.observe(snapshot,events);if(!disposed)try{neonHud.update(snapshot.neon,snapshot.tick);}catch(e){neonHud.failed??=(console.warn('Neon HUD:',e),true);}
   if(!disposed)try{chamberHud.update(snapshot.chamber,snapshot.tick);}catch(e){chamberHud.failed??=(console.warn('Chamber HUD:',e),true);}
   if(disposed)return;if(snapshot.tick<lastTick)clear();lastTick=snapshot.tick;
   const p=snapshot.player,tick=snapshot.tick;
   if(!snapshot.jett||p.health!==undefined&&p.health<=0){clear(false);return;}
   if(!enabled())clear(false);
   if(p.twPhase===1&&p.twSince===tick)once('prime',tick);
   if(p.twPhase===3&&p.twSince===tick)once('dash',tick);
   if(p.upAt===tick)once('updraft',tick);
   if(p.bsActive===1&&p.equipTick===tick){once(firstEquip?'equip':'equip-weapon',tick);firstEquip=false;}
   else if(p.bsActive===1&&previous?.bsActive===1){
    if(previous.twPhase===3&&p.twPhase!==3)once('equip-dash',tick);
    if(previous.cbBlock>lastTick-1&&p.cbBlock<=tick)once('equip-smoke',tick);
   }
   if(p.bsActive===1){for(const shot of events){if(shot.kind!=='shot'||shot.tick!==tick)continue;
    if(p.bsLastBurst===tick){const count=Math.max(1,Math.min(5,shot.pellets?.length??5));
     // Event graph bank is not supplied. This base + selected count + tail mix
     // is an explicit trainer approximation, with no generic gun fallback.
     once('throw',tick,{level:.22});once('burst-'+count,tick,{level:.25});once('burst-last',tick,{level:.22});
    }else once('throw',tick);
   }}
   if(p.cbPhase===1&&p.cbSince===tick)once('smoke-throw',tick);
   const cb=snapshot.jett.cloudburst,keep=new Set(),rate=128;
   if(cb?.ball&&p.cbPhase===2){const key='flight';keep.add(key);loop('smoke-flight',key,(tick-(p.cbSince??tick))/rate,cb.ball,p);}
   for(const zone of cb?.zones??[]){const born=tick-zone.ageTicks,key='cloud:'+born;keep.add(key);if(zone.ageTicks===0)once('smoke-form',born,{level:.32,point:zone,player:p});loop('smoke-loop',key,zone.ageTicks/rate,zone,p);}
   for(const[key,voice]of loops)if(!keep.has(key))voice.finish(true);
   previous={bsActive:p.bsActive,twPhase:p.twPhase,cbBlock:p.cbBlock};
  },
  clear(reset){neon.clear(reset);clear(reset);},
  dispose(){neon.dispose();neonHud.dispose();chamberHud.dispose();if(disposed)return;disposed=true;clear();if(typeof document!=='undefined')document.removeEventListener('visibilitychange',hide);},
  stats:()=>({activeVoices:voices.size,loops:loops.size,seen:seen.size,disposed,played:{...played},neon:neon.stats()}),
 };
}
