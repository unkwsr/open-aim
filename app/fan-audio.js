// Custom melee audio follows simulation events, not render frames. Decode each asset once.
(() => {
  if(window.__aimMeleeAudio)return;
  const packs={
    'prime-axe':{folder:'prime-axe',files:{equip:'equip.wav',attack1:'attack1.wav',attack2:'attack2.wav',attack3:'attack3.wav'}},
    'silkleaf-fan':{folder:'silkleaf-fan',files:{equip:'equip.wav',inspect:'inspect.wav',attack1:'attack1.wav',attack2:'attack2.wav'}},
    'blackmarket-butterfly':{folder:'blackmarket-butterfly',files:{equip:'equip.wav',inspect:'inspect.wav',attack1:'attack1.wav',attack1Recovery:'attack1-recovery.wav',attack2RightClick:'attack2-rightclick.wav'}}
  },buffers=new Map(),voices=new Map();
  let weapon=null,skin=null,equipTick=null,lastAction=-Infinity,lastSeconds=-Infinity,wasPaused=false;
  const decoder=new AudioContext();
  const assets=Object.entries(packs).flatMap(([skin,pack])=>Object.entries(pack.files).map(([name,file])=>({skin,name,url:'/media/'+pack.folder+'/'+file})));
  const ready=Promise.all(assets.map(async asset=>{try{const response=await fetch(asset.url);if(!response.ok)throw Error('Missing melee sound '+asset.url);buffers.set(asset.skin+':'+asset.name,await decoder.decodeAudioData(await response.arrayBuffer()));}catch(e){console.warn('Melee audio:',e);}})).finally(()=>decoder.close());
  function stop(channel){const voice=voices.get(channel);if(voice){voices.delete(channel);try{voice.stop();}catch{}}}
  function stopAll(){if(!voices.size)return;for(const channel of voices.keys())stop(channel);}
  function play(selected,name,audio,elapsed=0,delay=0,channel=name){const buffer=buffers.get(selected+':'+name);if(!buffer)return;const relative=elapsed-delay;if(relative>=buffer.duration)return;const output=audio?.ensure();if(!output)return;
    const source=output.context.createBufferSource();source.__aimSlot=selected+':'+name;source.buffer=buffer;source.connect(output.master);const key=selected+':'+channel;voices.set(key,source);source.onended=()=>{source.disconnect();if(voices.get(key)===source)voices.delete(key);};source.start(relative<0?output.context.currentTime-relative:0,Math.max(0,relative));
  }
  function update(currentWeapon,seconds,currentEquipTick,actions,audio,phase='running'){
    const choice=window.__aimMeleeSkin==='half-life-crowbar'?'prime-axe':window.__aimMeleeSkin==='orange-butterfly'?'blackmarket-butterfly':window.__aimMeleeSkin;const selected=(currentWeapon==='melee'||currentWeapon==='knife')&&packs[choice]?choice:null;
    if(!selected){stopAll();weapon=currentWeapon;skin=null;equipTick=currentEquipTick;lastSeconds=seconds;lastAction=-Infinity;wasPaused=false;return;}
    if(phase!=='running'){stopAll();wasPaused=true;lastSeconds=seconds;return;}
    const rewound=seconds<lastSeconds; if(rewound){stopAll();lastAction=-Infinity;}
    const entering=weapon!==currentWeapon||skin!==selected||rewound;
    if(entering||currentEquipTick!==equipTick){stopAll();play(selected,'equip',audio);lastAction=-Infinity;}
    weapon=currentWeapon;skin=selected;equipTick=currentEquipTick;lastSeconds=seconds;
    const event=actions?.[actions.length-1];
    if(event&&event.at<=seconds&&event.at>lastAction){lastAction=event.at;const elapsed=seconds-event.at;stopAll();
      // Suppress stale history when equipping/resuming; preserve sub-frame offsets.
      if(!wasPaused&&elapsed<.15){
        if(event.inspect)play(selected,'inspect',audio,elapsed);
        else if(event.heavy)play(selected,selected==='blackmarket-butterfly'?'attack2RightClick':'attack2',audio,elapsed);
        else if(selected==='prime-axe')play(selected,'attack'+((event.combo??0)%3+1),audio,elapsed);
        else if(selected==='blackmarket-butterfly'){
          play(selected,'attack1',audio,elapsed);
          // The supplied "after left click" cue begins when the initial slash clip ends.
          play(selected,'attack1Recovery',audio,elapsed,buffers.get(selected+':attack1')?.duration??.58,'attack1Recovery');
        }else play(selected,(event.combo??0)%2?'attack2':'attack1',audio,elapsed);
      }
    }
    wasPaused=false;
  }
  window.__aimMeleeAudio={ready,update,stop:stopAll,info:()=>({loaded:[...buffers.keys()],active:[...voices.keys()]})};
  window.__aimFanAudio=window.__aimMeleeAudio;
  addEventListener('pagehide',stopAll);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAll();});
})();
