const buffers=new Map(),voices=new Set();let data={actions:{},fire:[]},previous=null,inspectCancelled=-Infinity;
let loading;
function prepare(){return loading??=fetch('/aim-audio/arcane/manifest.json').then(r=>{if(!r.ok)throw Error('Arcane audio manifest missing');return r.json();}).then(async manifest=>{
 data=manifest;const files=Object.entries(data.files);if(!files.length)return;
 const decoder=new AudioContext();try{await Promise.all(files.map(async([slot,file])=>{const r=await fetch('/aim-audio/arcane/'+file);if(!r.ok)throw Error('Arcane audio missing: '+file);buffers.set(slot,await decoder.decodeAudioData(await r.arrayBuffer()));}));}finally{await decoder.close();}
}).catch(error=>console.warn('Arcane audio:',error.message));}
if(window.__aimSheriffSkin==='arcane-sheriff')prepare();
function stop(actionsOnly=false){for(const voice of [...voices])if(!actionsOnly||voice.action){voices.delete(voice);try{voice.source.stop();}catch{}voice.source.disconnect();voice.gain.disconnect();}}
function play(slot,ctx,destination,{delay=0,offset=0,gain=.4,action=true}={}){
 const buffer=buffers.get(slot);if(!buffer||offset>=buffer.duration)return false;
 if(voices.size>=24){const old=voices.values().next().value;try{old.source.stop();}catch{}voices.delete(old);old.source.disconnect();old.gain.disconnect();}
 const source=ctx.createBufferSource(),volume=ctx.createGain(),voice={source,gain:volume,action};source.buffer=buffer;volume.gain.value=gain;source.connect(volume).connect(destination);voices.add(voice);
 source.onended=()=>{voices.delete(voice);source.disconnect();volume.disconnect();};source.start(ctx.currentTime+Math.max(0,delay),Math.max(0,offset));return true;
}
function schedule(action,at,seconds,audio){
 const cues=data.actions[action]||[];if(!cues.length)return;const output=audio?.ensure();if(!output)return;
 for(const cue of cues){const delay=at+cue.time-seconds;if(delay<-.12)continue;play(cue.slot,output.context,output.master,{delay,offset:Math.max(0,-delay)});}
}
function update(weapon,seconds,equipAt,reloadSince,events,audio,phase='running'){
 const active=weapon==='sheriff'&&window.__aimSheriffSkin==='arcane-sheriff';
 if(!active||phase!=='running'){stop(!active&&phase==='running');previous=null;return;}
 const rewound=previous&&seconds<previous.seconds;if(rewound){stop();previous=null;inspectCancelled=-Infinity;}
 const event=events?.at(-1),inspect=event?.inspect&&event.at>inspectCancelled&&event.at>=(equipAt??-Infinity)&&seconds-event.at<3.2?event.at:null,reload=reloadSince!=null&&reloadSince>=0?Math.round((seconds-reloadSince)*1000)/1000:null;
 const name=reload!=null?'reload':inspect!=null?'inspect':equipAt!=null&&seconds-equipAt<1.34?'equip':null,at=name==='reload'?reload:name==='inspect'?inspect:equipAt;
 if(name&&(previous?.name!==name||previous?.at!==at)){stop(true);if(seconds-at<.15||name==='reload')schedule(name,at,seconds,audio);}
 else if(!name&&previous?.name)stop(true);
 previous={seconds,name,at};
}
function playFire(ctx,destination){
 if(window.__aimSheriffSkin!=='arcane-sheriff')return false;
 inspectCancelled=previous?.seconds??inspectCancelled;stop(true);
 if(!buffers.has('fire-transient'))return false;
 for(const layer of data.fire)play(layer.slot,ctx,destination,{gain:layer.gain,action:false});return true;
}
window.__aimArcaneAudio={get ready(){return prepare();},update,playFire,stop:()=>{stop();previous=null;},info:()=>({loaded:[...buffers.keys()],voices:voices.size,fireReady:buffers.has('fire-transient')})};
addEventListener('pagehide',()=>{stop();previous=null;});document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();previous=null;}});
