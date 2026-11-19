// Weapon skin choices, and the sounds that come with a skin (RGX, Gaia and Champions Vandal, BlastX
// Recon and Helix Phantom, Singularity Sheriff, Prime Guardian).
(() => {
  if (window.__aimLocalAudio) return;
  window.__aimPlayerModel = localStorage.getItem('es-player-model') || 'jett';
  const SKIN = 'es-vandal-skin';
  const savedVandal = localStorage.getItem(SKIN);
  if (['kuronami-vandal-white', 'kuronami-vandal-purple'].includes(savedVandal)) localStorage.setItem(SKIN, 'kuronami-vandal-standard');
  else if(savedVandal&&!['default-vandal','champions-vandal','rgx-vandal-yellow','rgx-vandal-blue','gaia-vandal-orange','gaia-vandal-white','gaia-vandal-blue','primordium-vandal','primordium-vandal-cobalt','kuronami-vandal-standard','kuronami-vandal-black-red'].includes(savedVandal))localStorage.setItem(SKIN,'default-vandal');
  const savedMelee = localStorage.getItem('es-melee-skin');
  if (savedMelee === 'reaver-karambit') localStorage.setItem('es-melee-skin', 'damascus-karambit');
  else if (['silkleaf-fan', 'orange-butterfly'].includes(savedMelee)) localStorage.setItem('es-melee-skin', 'default');
  window.__aimMeleeSkin = localStorage.getItem('es-melee-skin') || 'default';
  if(localStorage.getItem('es-phantom-skin')&&!['default','blastx-phantom','recon-phantom','recon-phantom-red','helix-phantom-purple'].includes(localStorage.getItem('es-phantom-skin')))localStorage.setItem('es-phantom-skin','default');
  window.__aimPhantomSkin = localStorage.getItem('es-phantom-skin') || 'blastx-phantom';
  window.__aimSheriffSkin = ['singularity-sheriff','arcane-sheriff'].includes(localStorage.getItem('es-sheriff-skin')) ? localStorage.getItem('es-sheriff-skin') : 'default';
  const operatorSkinKey = 'es-operator-skin';
  const savedOperator = localStorage.getItem(operatorSkinKey);
  window.__aimOperatorSkin = savedOperator === 'rogue-operator' ? savedOperator : 'default';
  if (savedOperator !== null && savedOperator !== window.__aimOperatorSkin) {
    localStorage.setItem(operatorSkinKey, window.__aimOperatorSkin);
  }
  window.__aimGuardianSkin = localStorage.getItem('es-guardian-skin') === 'prime-guardian' ? 'prime-guardian' : 'default';
  localStorage.setItem('es-classic-skin','default');
  window.__aimClassicSkin = 'default';
  window.__aimGhostSkin = localStorage.getItem('es-ghost-skin') === 'smite-ghost' ? 'smite-ghost' : 'default';
  window.__aimVandalSkin = localStorage.getItem(SKIN) || 'rgx-vandal-yellow';
  const primordiumReady=import('/local/primordium-audio.mjs').then(module=>window.__aimPrimordiumAudio=module);
  let decoder, killVoice, gaiaFireBuffer;
  const voices = new Set(), blastBuffers = new Map(), singularityBuffers = new Map(), rgxBuffers = new Map(), gaiaKills = new Map();
  function lazyAudio(load){let promise;return {then(resolve,reject){return (promise??=load()).then(resolve,reject)}};}
  function context() { return decoder ||= new AudioContext(); }
  const ids = ['fire', 'kill1', 'kill2', 'kill3', 'kill4', 'kill5'];
  // RGX Vandal: the shot and kills 1-5 the player had imported, at the 0.46 volume they had set.
  const RGX_VOLUME = 0.46;
  const rgxReady = lazyAudio(()=>Promise.all(ids.map(async name=>{try{const response=await fetch('/media/rgx-vandal-yellow/'+name+'.wav');if(!response.ok)throw Error('Missing RGX sound '+name);rgxBuffers.set(name,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('RGX audio:',error);}})));
  const skinReady = lazyAudio(()=>fetch('/media/gaia-vandal-orange/fire.wav').then(r=>{if(!r.ok)throw Error('Gaia firing sound unavailable');return r.arrayBuffer();}).then(bytes=>context().decodeAudioData(bytes)).then(buffer=>{gaiaFireBuffer=buffer;}).catch(error=>console.warn('Gaia firing sound:',error)));
  const gaiaKillsReady= lazyAudio(()=>Promise.all([1,2,3,4,5].map(async stage=>{try{const response=await fetch('/media/gaia-vandal-orange/kill'+stage+'.mp3');if(!response.ok)throw Error('Missing Gaia kill sound '+stage);gaiaKills.set('kill'+stage,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Gaia kill sound:',stage,error);}})));
  const blastReady = lazyAudio(()=>Promise.all(['fire','kill1','kill2','kill3','kill4','kill5'].map(async name=>{try{const response=await fetch('/media/blastx-phantom/'+name+(name==='fire'?'.wav':'.mp3'));if(!response.ok)throw Error('Missing BlastX sound '+name);blastBuffers.set(name,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('BlastX audio:',error);}})));
  const reconBuffers=new Map();
  const reconReady= lazyAudio(()=>Promise.all([1,2,3,4,5].map(async stage=>{try{const response=await fetch('/media/recon-phantom/kill'+stage+'.mp3');if(!response.ok)throw Error('Missing Recon kill sound '+stage);reconBuffers.set('kill'+stage,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Recon kill sound:',stage,error);}})));
  const helixKillBuffers=new Map();
  let helixFireBuffer;
  // default-kills-v1 (14 Nov 2026): kill sequence (sound + banner picture, 1-5 kills) for every gun whose skin has
  // no kill set of its own (default skins, Smite Ghost, Classic, Spectre, Bucky...) and for Headhunter, Tour de
  // Force and Blade Storm. Files in site/media/default-kills/. Melee is left alone.
  const defaultKillBuffers=new Map();
  const defaultKillIcons=[1,2,3,4,5].map(stage=>{const icon=new Image();icon.decoding='async';icon.src='/media/default-kills/kill'+stage+'.png';return icon;});
  const defaultKillsReady=lazyAudio(()=>Promise.all([1,2,3,4,5].map(async stage=>{try{const response=await fetch('/media/default-kills/kill'+stage+'.mp3');if(!response.ok)throw Error('Missing default kill sound '+stage);defaultKillBuffers.set('kill'+stage,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Default kill sound:',stage,error);}})));
  const helixKillIcons=[1,2,3,4,5].map(stage=>{const icon=new Image();icon.decoding='async';icon.src='/media/helix-phantom-purple/kill'+stage+'.png';return icon;});
  const helixKillsReady=lazyAudio(()=>Promise.all([1,2,3,4,5].map(async stage=>{try{const response=await fetch('/media/helix-phantom-purple/kill'+stage+'.mp3');if(!response.ok)throw Error('Missing Helix kill sound '+stage);helixKillBuffers.set('kill'+stage,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Helix kill sound:',stage,error);}})));
  const kuronamiKillBuffers=new Map();
  const kuronamiFireBuffers=[];let kuronamiFireIndex=0;
  const kuronamiKillIcons=[1,2,3,4,5].map(stage=>{const icon=new Image();icon.decoding='async';icon.src='/media/kuronami-vandal-white/kill'+stage+'.png';return icon;});
  const kuronamiKillsReady=lazyAudio(()=>Promise.all([1,2,3,4,5].map(async stage=>{try{const response=await fetch('/media/kuronami-vandal-white/kill'+stage+'.mp3');if(!response.ok)throw Error('Missing Kuronami kill sound '+stage);kuronamiKillBuffers.set('kill'+stage,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Kuronami kill sound:',stage,error);}})));
  const kuronamiFireReady=lazyAudio(()=>Promise.all([1,2,3,4,5].map(async stage=>{try{const response=await fetch('/media/kuronami-vandal-white/fire'+stage+'.wav');if(!response.ok)throw Error('Missing Kuronami firing layer '+stage);kuronamiFireBuffers[stage-1]=await context().decodeAudioData(await response.arrayBuffer());}catch(error){console.warn('Kuronami fire sound:',stage,error);}})));
  const helixFireReady=lazyAudio(()=>fetch('/media/helix-phantom-purple/fire.wav').then(response=>{if(!response.ok)throw Error('Missing Helix fire sound');return response.arrayBuffer();}).then(bytes=>context().decodeAudioData(bytes)).then(buffer=>{helixFireBuffer=buffer;}).catch(error=>console.warn('Helix fire sound:',error)));
  const championsBuffers=new Map();
  const championsReady= lazyAudio(()=>Promise.all(['fire','kill1','kill2','kill3','kill4','kill5'].map(async name=>{try{const response=await fetch('/media/champions-vandal/'+name+(name==='fire'?'.wav':'.mp3'));if(!response.ok)throw Error('Missing Champions sound '+name);championsBuffers.set(name,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Champions audio:',name,error);}})));
  const singularityReady = lazyAudio(()=>Promise.all(ids.map(async name=>{try{const response=await fetch('/media/singularity-sheriff/'+name+(name==='fire'?'.wav':'.mp3'));if(!response.ok)throw Error('Missing Singularity sound '+name);singularityBuffers.set(name,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Singularity audio:',error);}})));
  const rogueBuffers=new Map();
  const rogueReady= lazyAudio(()=>Promise.all(ids.map(async name=>{try{const response=await fetch('/media/rogue-operator/'+name+(name==='fire'?'.wav':'.mp3'));if(!response.ok)throw Error('Missing Rogue sound '+name);rogueBuffers.set(name,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Rogue audio:',error);}})));
  const guardianBuffers=new Map(),guardianBuses=new WeakMap(),guardianVoices=new Set(),guardianActions=new Map();
  const guardianVolumes={fire:4,reload:1.5,kill:.65};
  let guardianWeapon=null,guardianEquip=null,guardianReload=null,guardianSeconds=-Infinity;
  const guardianReady= lazyAudio(()=>Promise.all(['fire','reload','kill1','kill2','kill3','kill4','kill5'].map(async name=>{try{const response=await fetch('/media/prime-guardian/'+name+(name.startsWith('kill')?'.mp3':'.wav'));if(!response.ok)throw Error('Missing Prime Guardian sound '+name);guardianBuffers.set(name,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Prime Guardian audio:',error);}})));
  const tourFireBuffers=[];let tourFireIndex=0;
  const tourReady= lazyAudio(()=>Promise.all([1,2,3,4,5].map(async number=>{try{const response=await fetch('/media/tour-de-force/fire-'+number+'.wav');if(!response.ok)throw Error('Missing Tour de Force firing sound '+number);tourFireBuffers[number-1]=await context().decodeAudioData(await response.arrayBuffer());}catch(error){console.warn('Tour de Force audio:',error);}})));
  /* aim-bucky-altfire: Bucky right-click shot, 3 takes built by previews/bucky-alt/build-sound.py */
  const buckyAltBuffers=[];let buckyAltIndex=0;
  const buckyAltReady=lazyAudio(()=>Promise.all([1,2,3].map(async number=>{try{const response=await fetch('/media/bucky-alt/fire-'+number+'.wav');if(!response.ok)throw Error('Missing Bucky alt-fire sound '+number);buckyAltBuffers[number-1]=await context().decodeAudioData(await response.arrayBuffer());}catch(error){console.warn('Bucky alt-fire audio:',error);}})));
  const primordiumKills=new Map();
  const arcaneKills=new Map();
  const arcaneKillsReady=lazyAudio(()=>Promise.all([1,2,3,4,5].map(async stage=>{try{const response=await fetch('/media/arcane-sheriff-kills/kill'+stage+'.mp3');if(!response.ok)throw Error('Missing Arcane kill '+stage);arcaneKills.set('kill'+stage,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Arcane kill sound:',stage,error);}})));
  let primordiumFireBuffer;
  const primordiumFireReady= lazyAudio(()=>fetch('/media/primordium-vandal/fire.wav').then(r=>{if(!r.ok)throw Error('Missing Primordium fire');return r.arrayBuffer();}).then(bytes=>context().decodeAudioData(bytes)).then(buffer=>{primordiumFireBuffer=buffer;}).catch(error=>console.warn('Primordium fire sound:',error)));
  const primordiumKillsReady= lazyAudio(()=>Promise.all([1,2,3,4,5].map(async stage=>{try{const response=await fetch('/media/primordium-vandal/kill'+stage+'.mp3');if(!response.ok)throw Error('Missing Primordium kill '+stage);primordiumKills.set('kill'+stage,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Primordium kill sound:',stage,error);}})));
  window.__aimPrepareSkinAudio=()=>prepareSelectedAudio();
  function prepareSelectedAudio(){
    const jobs=[tourReady,buckyAltReady,defaultKillsReady];
    const vandal=window.__aimVandalSkin,phantom=window.__aimPhantomSkin,sheriff=window.__aimSheriffSkin,operator=window.__aimOperatorSkin;
    if(vandal?.startsWith('rgx-vandal-'))jobs.push(rgxReady);
    if(vandal?.startsWith('gaia-vandal-'))jobs.push(skinReady,gaiaKillsReady);
    if(vandal==='champions-vandal')jobs.push(championsReady);
    if(vandal?.startsWith('primordium-vandal'))jobs.push(primordiumFireReady,primordiumKillsReady);
    if(vandal?.startsWith('kuronami-vandal-'))jobs.push(kuronamiFireReady,kuronamiKillsReady);
    if(phantom==='blastx-phantom')jobs.push(blastReady);
    if(phantom?.startsWith('recon-phantom'))jobs.push(reconReady);
    if(phantom==='helix-phantom-purple')jobs.push(helixKillsReady,helixFireReady);
    if(sheriff==='singularity-sheriff')jobs.push(singularityReady);
    if(sheriff==='arcane-sheriff')jobs.push(arcaneKillsReady,window.__aimArcaneAudio?.ready);
    if(operator==='rogue-operator')jobs.push(rogueReady);
    if(window.__aimGuardianSkin==='prime-guardian')jobs.push(guardianReady);
    return Promise.all(jobs);
  }
  const ready=prepareSelectedAudio();
  function guardianBus(ctx,destination,name){let buses=guardianBuses.get(destination);if(!buses){buses=new Map();guardianBuses.set(destination,buses);}let gain=buses.get(name);if(!gain){gain=ctx.createGain();gain.gain.value=guardianVolumes[name];gain.connect(destination);buses.set(name,gain);}return gain;}
  function stopGuardianAction(name){const source=guardianActions.get(name);if(source){guardianActions.delete(name);guardianVoices.delete(source);try{source.stop();}catch{}source.disconnect();if(killVoice===source)killVoice=null;}}
  function stopGuardian(){for(const source of guardianVoices){try{source.stop();}catch{}source.disconnect();if(killVoice===source)killVoice=null;}guardianVoices.clear();guardianActions.clear();}
  function playGuardian(name,ctx,destination,elapsed=0){
    const buffer=guardianBuffers.get(name);if(!buffer||elapsed>=buffer.duration||ctx.state==='closed')return false;
    const isKill=name.startsWith('kill'),channel=isKill?'kill':name;
    if(name==='fire')stopGuardianAction('reload');else stopGuardianAction(channel);
    if(isKill&&killVoice){try{killVoice.stop();}catch{}}
    if(guardianVoices.size>=8){const activeKill=guardianActions.get('kill');let oldest;for(const voice of guardianVoices)if(voice!==activeKill){oldest=voice;break;}if(oldest){guardianVoices.delete(oldest);try{oldest.stop();}catch{}oldest.disconnect();}}
    const source=ctx.createBufferSource();source.__aimSlot='prime-guardian-'+name;source.buffer=buffer;source.connect(guardianBus(ctx,destination,channel));guardianVoices.add(source);if(name!=='fire')guardianActions.set(channel,source);if(isKill)killVoice=source;
    source.onended=()=>{source.disconnect();guardianVoices.delete(source);if(guardianActions.get(channel)===source)guardianActions.delete(channel);if(killVoice===source)killVoice=null;};source.start(0,Math.max(0,elapsed));return true;
  }
  async function warmGuardian(audio){await prepareSelectedAudio();await (await primordiumReady).warm(audio);if(window.__aimGuardianSkin!=='prime-guardian')return;await guardianReady;const output=audio?.ensure();if(output)for(const name of ['fire','reload','kill'])guardianBus(output.context,output.master,name);}
  function updateGuardian(weapon,seconds,equipAt,reloadSince,audio,phase='running'){window.__aimPrimordiumAudio?.update(weapon,seconds,equipAt,reloadSince,audio,phase);
    const selected=weapon==='guardian'&&window.__aimGuardianSkin==='prime-guardian';
    const rewound=seconds<guardianSeconds,settings=audio?.settings?.current,muted=settings&&(settings.enabled===false||settings.volume<=0);
    if(settings?.killSound===false)stopGuardianAction('kill');
    if(phase!=='running'||muted||rewound)stopGuardian();
    if(!selected||phase!=='running'||muted){if(phase==='running'&&!muted&&!rewound)stopGuardianAction('reload');guardianWeapon=selected?weapon:null;guardianEquip=equipAt;guardianReload=reloadSince;guardianSeconds=seconds;return;}
    const entering=guardianWeapon!==weapon||rewound;
    if(entering||guardianEquip!==equipAt)stopGuardianAction('reload');
    const reloading=reloadSince!=null&&reloadSince>=0;
    if(reloading&&(entering||guardianReload==null||reloadSince<guardianReload-.0001)){const output=audio?.ensure();if(output)playGuardian('reload',output.context,output.master,reloadSince);}
    else if(!reloading)stopGuardianAction('reload');
    if(guardianVoices.size&&audio?.settings?.current&&(audio.settings.current.enabled===false||audio.settings.current.volume<=0))stopGuardian();
    guardianWeapon=weapon;guardianEquip=equipAt;guardianReload=reloadSince;guardianSeconds=seconds;
  }
  addEventListener('pagehide',stopGuardian);
  function play(id, ctx, destination, isKill, buffer, volume) {
    if (!buffer) return false;
    const source = ctx.createBufferSource(), gain = ctx.createGain();
    source.__aimSlot = id; source.buffer = buffer; gain.gain.value = volume;
    source.connect(gain); gain.connect(destination);
    if (isKill && killVoice) { try { killVoice.stop(); } catch {} }
    if (voices.size >= 24) { try { voices.values().next().value.stop(); } catch {} }
    voices.add(source); if (isKill) killVoice = source;
    source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); if (killVoice === source) killVoice = null; };
    source.start(); return true;
  }
  let skinKillIcon,skinKillCanvas,skinKillTimer;
  function showSkinKillIcon(stage,icons){
    const canvas=document.querySelector('canvas[data-role="kill-banner"]');
    if(!canvas||getComputedStyle(canvas).display==='none')return;
    const icon=icons[stage-1];
    if(!icon.complete||!icon.naturalWidth)return;
    const bounds=canvas.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return;
    clearTimeout(skinKillTimer);
    skinKillIcon?.remove();
    if(skinKillCanvas&&skinKillCanvas!==canvas)skinKillCanvas.style.removeProperty('visibility');
    skinKillCanvas=canvas;
    canvas.style.visibility='hidden';
    const image=document.createElement('img');
    image.src=icon.src;
    image.alt='';
    image.setAttribute('aria-hidden','true');
    image.style.cssText=`position:fixed;left:${bounds.left}px;top:${bounds.top}px;width:${bounds.width}px;height:${bounds.height}px;object-fit:contain;pointer-events:none;z-index:100;`;
    document.body.append(image);
    skinKillIcon=image;
    skinKillTimer=setTimeout(()=>{image.remove();if(skinKillIcon===image)skinKillIcon=null;if(skinKillCanvas===canvas){canvas.style.removeProperty('visibility');skinKillCanvas=null;}},2300);
  }
  window.__aimLocalAudio = {
    get ready(){return prepareSelectedAudio();},
    warmGuardian,updateGuardian,stopGuardian,
    guardianInfo:()=>({loaded:[...guardianBuffers.keys()],voices:guardianVoices.size,actions:[...guardianActions.keys()]}),
    playSkinFire: (ctx, destination, weapon='vandal') => {if(weapon==='bucky-alt')return play('bucky-alt-fire',ctx,destination,false,buckyAltBuffers[buckyAltIndex++%3],.5);if(weapon==='vandal'&&window.__aimVandalSkin?.startsWith('kuronami-vandal-'))return play('kuronami-fire',ctx,destination,false,kuronamiFireBuffers[kuronamiFireIndex++%5],0.8);return weapon==='vandal'&&window.__aimVandalSkin?.startsWith('primordium-vandal') ? play('primordium-fire',ctx,destination,false,primordiumFireBuffer,.65) : weapon==='sheriff'&&window.__aimSheriffSkin==='arcane-sheriff' ? (window.__aimArcaneAudio?.playFire(ctx,destination)??false) : weapon==='tourdeforce' ? play('tour-de-force-fire',ctx,destination,false,tourFireBuffers[tourFireIndex++%5],.85) : weapon==='vandal'&&window.__aimVandalSkin?.startsWith('gaia-vandal-') ? play('gaia-fire',ctx,destination,false,gaiaFireBuffer,0.55) : weapon==='vandal'&&window.__aimVandalSkin?.startsWith('rgx-vandal-') ? play('rgx-fire',ctx,destination,false,rgxBuffers.get('fire'),RGX_VOLUME) : weapon==='vandal'&&window.__aimVandalSkin==='champions-vandal' ? play('champions-fire',ctx,destination,false,championsBuffers.get('fire'),0.75) : weapon==='phantom'&&window.__aimPhantomSkin==='blastx-phantom' ? play('blastx-fire',ctx,destination,false,blastBuffers.get('fire'),1) : weapon==='phantom'&&window.__aimPhantomSkin==='helix-phantom-purple' ? play('helix-fire',ctx,destination,false,helixFireBuffer,1) : weapon==='sheriff'&&window.__aimSheriffSkin==='singularity-sheriff' ? play('singularity-fire',ctx,destination,false,singularityBuffers.get('fire'),1) : weapon==='operator'&&window.__aimOperatorSkin==='rogue-operator' ? play('rogue-fire',ctx,destination,false,rogueBuffers.get('fire'),1.15) : weapon==='guardian'&&window.__aimGuardianSkin==='prime-guardian' ? playGuardian('fire',ctx,destination) : false;},
    playSkinKill: (ctx,destination,count,weapon) => {
      const slot='kill'+((Math.max(1,Math.floor(count))-1)%5+1);
      if(weapon==='sheriff'&&window.__aimSheriffSkin==='arcane-sheriff')return play('arcane-'+slot,ctx,destination,true,arcaneKills.get(slot),.65);
      if(weapon==='vandal'&&window.__aimVandalSkin?.startsWith('primordium-vandal'))return play('primordium-'+slot,ctx,destination,true,primordiumKills.get(slot),.65);
      if(weapon==='vandal'&&window.__aimVandalSkin?.startsWith('gaia-vandal-'))return play('gaia-'+slot,ctx,destination,true,gaiaKills.get(slot),.65);
      if(weapon==='guardian'&&window.__aimGuardianSkin==='prime-guardian')return playGuardian(slot,ctx,destination);
      if(weapon==='vandal'&&window.__aimVandalSkin?.startsWith('rgx-vandal-'))return play('rgx-'+slot,ctx,destination,true,rgxBuffers.get(slot),RGX_VOLUME);
      if(weapon==='vandal'&&window.__aimVandalSkin==='champions-vandal')return play('champions-'+slot,ctx,destination,true,championsBuffers.get(slot),0.65);
      if(weapon==='vandal'&&window.__aimVandalSkin?.startsWith('kuronami-vandal-')){
        showSkinKillIcon(Number(slot.slice(4)),kuronamiKillIcons);
        return play('kuronami-'+slot,ctx,destination,true,kuronamiKillBuffers.get(slot),0.65);
      }
      if(weapon==='phantom'&&window.__aimPhantomSkin==='blastx-phantom')return play('blastx-'+slot,ctx,destination,true,blastBuffers.get(slot),0.65);
      if(weapon==='phantom'&&['recon-phantom','recon-phantom-red'].includes(window.__aimPhantomSkin))return play('recon-'+slot,ctx,destination,true,reconBuffers.get(slot),0.65);
      if(weapon==='phantom'&&window.__aimPhantomSkin==='helix-phantom-purple'){
        showSkinKillIcon(Number(slot.slice(4)),helixKillIcons);
        return play('helix-'+slot,ctx,destination,true,helixKillBuffers.get(slot),0.65);
      }
      if(weapon==='sheriff'&&window.__aimSheriffSkin==='singularity-sheriff')return play('singularity-'+slot,ctx,destination,true,singularityBuffers.get(slot),0.65);
      if(weapon==='operator'&&window.__aimOperatorSkin==='rogue-operator')return play('rogue-'+slot,ctx,destination,true,rogueBuffers.get(slot),0.52);
      // default-kills-v1: everything else except melee.
      if(!weapon||weapon==='melee'||weapon==='knife')return false;
      showSkinKillIcon(Number(slot.slice(4)),defaultKillIcons);
      return play('default-'+slot,ctx,destination,true,defaultKillBuffers.get(slot),0.65);
    },
  };
  const css = document.createElement('style');
  // The Vandal firing and kill sound settings are hidden: each skin brings its own sounds.
  css.textContent = `[data-setting="fireKit"],[data-setting="killKit"]{display:none!important}.es-skin-select button{padding:7px 12px;background:#222b36;color:#eee;border:1px solid #48515f;cursor:pointer}.es-skin-select{display:flex;gap:6px;flex-wrap:wrap}.es-skin-select .is-active{background:#8e2435;border-color:#ff4655}.hall-choice:is(.es-melee-row,.es-vandal-row){flex-wrap:wrap!important;row-gap:10px}:is(.es-melee-row,.es-vandal-row)>:is(.hall-field-text,.es-skin-select){flex:1 1 100%!important;min-width:0}`;
  document.head.append(css);
  function addMeleeChoice() {
    const anchor=document.querySelector('.es-vandal-row');if(!anchor||document.querySelector('.es-melee-row'))return;
    const row=document.createElement('div');row.className='hall-field hall-choice es-melee-row';
    for(const a of anchor.attributes)if(a.name.startsWith('data-v-'))row.setAttribute(a.name,a.value);
    row.innerHTML='<span class="hall-field-text"><b>Melee skin</b><small>Existing agent arms. Equip, attacks and inspect (Y). Applied when entering a scene.</small></span><div class="es-skin-select" role="radiogroup" aria-label="Melee skin"></div>';
    for(const [id,label]of [['default','Default knife'],['blackmarket-butterfly','Black Market Butterfly'],['prime-axe','Prime Axe'],['soulstrife','Soulstrife Scythe'],['kuronami','Kuronami no Yaiba'],['champions-2024-blade','Champions 2024 Blade'],['half-life-crowbar','Half Life Crowbar'],/* xenohunter-knife */['xenohunter-knife','Xenohunter Knife'],['damascus-karambit','Champions 2021 Karambit'],['champions-2021-karambit-mvp','Champions 2021 Karambit (MVP)'],...[
      ['standard','Standard'], ['purple-red','CN'], ['pacific','Pacific'], ['americas','Americas'], ['green','EMEA']
    ].flatMap(([color, label]) => {
      const id = 'vct-2026-sigil-' + color;
      return [[id, 'VCT 2026 Sigil (' + label + ')'], [id + '-mvp', 'VCT 2026 Sigil (' + label + ' MVP)']];
    })]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.melee=id;b.setAttribute('role','radio');const active=window.__aimMeleeSkin===id;b.classList.toggle('is-active',active);b.setAttribute('aria-checked',String(active));b.onclick=()=>{localStorage.setItem('es-melee-skin',id);window.__aimMeleeSkin=id;for(const item of row.querySelectorAll('button')){const on=item===b;item.classList.toggle('is-active',on);item.setAttribute('aria-checked',String(on));}};row.lastChild.append(b);}anchor.after(row);
  }
  function addPhantomChoice() {
    const anchor=document.querySelector('.es-vandal-row');if(!anchor||document.querySelector('.es-phantom-row'))return;
    const row=document.createElement('div');row.className='hall-field hall-choice es-phantom-row';
    for(const a of anchor.attributes)if(a.name.startsWith('data-v-'))row.setAttribute(a.name,a.value);
    row.innerHTML='<span class="hall-field-text"><b>Phantom skin</b><small>Applied the next time you enter a scene.</small></span><div class="es-skin-select" role="radiogroup" aria-label="Phantom skin"></div>';
    for(const [id,label]of [['default','Default'],['blastx-phantom','BlastX'],['recon-phantom','Recon'],['recon-phantom-red','Recon Red Camo'],['helix-phantom-purple','Helix Purple']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.phantom=id;b.setAttribute('role','radio');const active=window.__aimPhantomSkin===id;b.classList.toggle('is-active',active);b.setAttribute('aria-checked',String(active));b.onclick=()=>{localStorage.setItem('es-phantom-skin',id);window.__aimPhantomSkin=id;prepareSelectedAudio();for(const item of row.querySelectorAll('button')){const on=item===b;item.classList.toggle('is-active',on);item.setAttribute('aria-checked',String(on));}};row.lastChild.append(b);}anchor.after(row);
  }
  function addSheriffChoice() {
    const anchor=document.querySelector('.es-vandal-row');if(!anchor||document.querySelector('.es-sheriff-row'))return;
    const row=document.createElement('div');row.className='hall-field hall-choice es-sheriff-row';
    for(const a of anchor.attributes)if(a.name.startsWith('data-v-'))row.setAttribute(a.name,a.value);
    row.innerHTML='<span class="hall-field-text"><b>Sheriff skin</b><small>Applied the next time you enter a scene.</small></span><div class="es-skin-select" role="radiogroup" aria-label="Sheriff skin"></div>';
    for(const [id,label]of [['default','Default'],['singularity-sheriff','Singularity'],['arcane-sheriff','Arcane']]){
      const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.sheriff=id;button.setAttribute('role','radio');
      const active=window.__aimSheriffSkin===id;button.classList.toggle('is-active',active);button.setAttribute('aria-checked',String(active));
      button.onclick=()=>{localStorage.setItem('es-sheriff-skin',id);window.__aimSheriffSkin=id;prepareSelectedAudio();for(const item of row.querySelectorAll('button')){const on=item===button;item.classList.toggle('is-active',on);item.setAttribute('aria-checked',String(on));}};
      row.lastChild.append(button);
    }
    anchor.after(row);
  }
  function addOperatorChoice() {
    const anchor=document.querySelector('.es-vandal-row');if(!anchor||document.querySelector('.es-operator-row'))return;
    const row=document.createElement('div');row.className='hall-field hall-choice es-operator-row';
    for(const a of anchor.attributes)if(a.name.startsWith('data-v-'))row.setAttribute(a.name,a.value);
    row.innerHTML='<span class="hall-field-text"><b>Operator skin</b><small>Applied the next time you enter a scene.</small></span><div class="es-skin-select" role="radiogroup" aria-label="Operator skin"></div>';
    for(const [id,label]of [['default','Default'],['rogue-operator','Rogue']]){
      const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.operator=id;button.setAttribute('role','radio');
      const active=window.__aimOperatorSkin===id;button.classList.toggle('is-active',active);button.setAttribute('aria-checked',String(active));
      button.onclick=()=>{localStorage.setItem('es-operator-skin',id);window.__aimOperatorSkin=id;prepareSelectedAudio();for(const item of row.querySelectorAll('button')){const on=item===button;item.classList.toggle('is-active',on);item.setAttribute('aria-checked',String(on));}};
      row.lastChild.append(button);
    }
    anchor.after(row);
  }
  function addGuardianChoice() {
    const anchor=document.querySelector('.es-vandal-row');if(!anchor||document.querySelector('.es-guardian-row'))return;
    const row=document.createElement('div');row.className='hall-field hall-choice es-guardian-row';
    for(const a of anchor.attributes)if(a.name.startsWith('data-v-'))row.setAttribute(a.name,a.value);
    row.innerHTML='<span class="hall-field-text"><b>Guardian skin</b><small>Applied the next time you enter a scene.</small></span><div class="es-skin-select" role="radiogroup" aria-label="Guardian skin"></div>';
    for(const [id,label]of [['default','Default'],['prime-guardian','Prime']]){
      const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.guardian=id;button.setAttribute('role','radio');
      const active=window.__aimGuardianSkin===id;button.classList.toggle('is-active',active);button.setAttribute('aria-checked',String(active));
      button.onclick=()=>{localStorage.setItem('es-guardian-skin',id);window.__aimGuardianSkin=id;prepareSelectedAudio();for(const item of row.querySelectorAll('button')){const on=item===button;item.classList.toggle('is-active',on);item.setAttribute('aria-checked',String(on));}};
      row.lastChild.append(button);
    }
    anchor.after(row);
  }
  function addGhostChoice() {
    const anchor=document.querySelector('.es-vandal-row');if(!anchor||document.querySelector('.es-ghost-row'))return;
    const row=document.createElement('div');row.className='hall-field hall-choice es-ghost-row';
    for(const a of anchor.attributes)if(a.name.startsWith('data-v-'))row.setAttribute(a.name,a.value);
    row.innerHTML='<span class="hall-field-text"><b>Ghost skin</b><small>Applied the next time you enter a scene.</small></span><div class="es-skin-select" role="radiogroup" aria-label="Ghost skin"></div>';
    for(const [id,label]of [['default','Default'],['smite-ghost','Smite']]){
      const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.ghost=id;button.setAttribute('role','radio');
      const active=window.__aimGhostSkin===id;button.classList.toggle('is-active',active);button.setAttribute('aria-checked',String(active));
      button.onclick=()=>{localStorage.setItem('es-ghost-skin',id);window.__aimGhostSkin=id;for(const item of row.querySelectorAll('button')){const on=item===button;item.classList.toggle('is-active',on);item.setAttribute('aria-checked',String(on));}};
      row.lastChild.append(button);
    }
    anchor.after(row);
  }
  function mount() {
    addMeleeChoice();addPhantomChoice();addSheriffChoice();addOperatorChoice();addGuardianChoice();addGhostChoice();
    const native = [...document.querySelectorAll('.hall-field')].find(el => {
      const buttons=[...el.querySelectorAll('button')].map(b=>b.textContent.trim());
      return buttons.includes('Vandal') && buttons.includes('AK-47');
    });
    if (native && !native.nextElementSibling?.classList.contains('es-vandal-row')) {
      native.style.display='none';
      const row=document.createElement('div'); row.className='hall-field hall-choice es-vandal-row';
      for(const a of native.attributes) if(a.name.startsWith('data-v-'))row.setAttribute(a.name,'');
      row.innerHTML='<span class="hall-field-text"><b>Vandal skin</b><small>Applied the next time you enter a scene.</small></span><div class="es-skin-select" role="radiogroup" aria-label="Weapon skin"></div>';
      let selected=localStorage.getItem(SKIN)||'rgx-vandal-yellow';
      for(const [id,label] of [['default-vandal','Default'],['champions-vandal','Champions 2021'],['rgx-vandal-yellow','RGX Yellow'],['rgx-vandal-blue','RGX Blue'],['gaia-vandal-orange','Gaia Orange'],['gaia-vandal-white','Gaia White'],['gaia-vandal-blue','Gaia Blue'],['primordium-vandal','Primordium'],['primordium-vandal-cobalt','Primordium Cobalt'],['kuronami-vandal-standard','Kuronami Standard'],['kuronami-vandal-black-red','Kuronami Black']]) {
        const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('role','radio');
        const update=()=>{for(const item of row.querySelectorAll('button')){const on=item===b;item.classList.toggle('is-active',on);item.setAttribute('aria-checked',String(on));}};
        b.classList.toggle('is-active',selected===id);b.setAttribute('aria-checked',String(selected===id));
        b.onclick=()=>{localStorage.setItem(SKIN,id);window.__aimVandalSkin=id;prepareSelectedAudio();[...native.querySelectorAll('button')].find(b=>b.textContent.trim()==='Vandal')?.click();update();};
        row.lastChild.append(b);
      }
      native.after(row);addMeleeChoice();addPhantomChoice();addSheriffChoice();addOperatorChoice();addGuardianChoice();addGhostChoice();
    }
  }
  let queued=false;
  window.__aimWatchPage(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;mount();});},{subtree:true,childList:true});
  mount();
  addEventListener('pagehide',()=>{for(const s of voices)try{s.stop();}catch{} decoder?.close();});
})();

