const selected=()=>window.__aimVandalSkin?.startsWith('primordium-vandal');
let timelines,buffers=new Map(),loading,output,allowed=false,previous=null,inspectAt=null;
const voices=new Set();let rotation=0;
function stop(){for(const source of voices){try{source.stop()}catch{}source.disconnect()}voices.clear()}
export async function warm(audio){
 if(!selected())return;
 output=audio?.ensure();if(!output)return;
 loading??=(async()=>{const r=await fetch('/aim-audio/primordium-vandal/timelines.json');if(!r.ok)throw Error('Primordium timelines');timelines=await r.json();const files=new Set(Object.values(timelines).flatMap(rows=>rows.flatMap(r=>r.files)));await Promise.all([...files].map(async file=>{const r=await fetch('/aim-audio/primordium-vandal/'+file);if(!r.ok)throw Error(file);buffers.set(file,await output.context.decodeAudioData(await r.arrayBuffer()))}))})();
 await loading;
}
function play(kind,elapsed){
 stop();if(!output||!timelines)return;
 const {context:ctx,master}=output;
 for(const row of timelines[kind]||[]){const buffer=buffers.get(row.files[rotation++%row.files.length]);if(!buffer)continue;const offset=Math.max(0,elapsed-row.at);if(offset>=buffer.duration)continue;
 const source=ctx.createBufferSource();source.buffer=buffer;source.connect(master);voices.add(source);source.onended=()=>{voices.delete(source);source.disconnect()};source.start(ctx.currentTime+Math.max(0,row.at-elapsed),offset)}
}
export function update(weapon,seconds,equipAt,reloadSince,audio,phase){
 const settings=audio?.settings?.current;
 allowed=selected()&&weapon==='vandal'&&phase==='running'&&settings?.enabled!==false&&!(settings?.volume<=0);
 if(!allowed){stop();previous=null;inspectAt=null;return}
 if(!output)return;
 const rewind=previous&&seconds<previous.seconds;
 if(rewind){stop();inspectAt=null}
 const reloading=reloadSince!=null&&reloadSince>=0;
 if(reloading&&(!previous?.reloading||reloadSince<previous.reloadSince-.001))play('reload',reloadSince);
 else if(!reloading&&(!previous||equipAt!==previous.equipAt||rewind)){
  // Equipping stays silent; also cancel any old action on weapon handoff.
  stop();
 }else if(previous?.reloading&&!reloading)stop();
 previous={seconds,equipAt,reloadSince,reloading};
}
export function frame(state){
 if(!allowed)return;
 const event=state.melee?.at(-1),shot=state.shots?.at(-1);
 if(event?.inspect&&event.at!==inspectAt&&state.reloadSince==null&&(!shot||shot.at<event.at)){
  inspectAt=event.at;const elapsed=state.seconds-event.at;if(elapsed>=0&&elapsed<5)play('inspect',elapsed);
 }
 if(inspectAt!=null&&((shot&&shot.at>=inspectAt)||state.reloadSince!=null||state.jett?.dash||state.jett?.updraft||state.jett?.smoke)){stop();inspectAt=null}
}
export function info(){return{loaded:buffers.size,voices:voices.size,allowed}}
addEventListener('pagehide',stop);
