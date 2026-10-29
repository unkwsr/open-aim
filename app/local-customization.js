// Weapon skin choices, and the sounds that come with a skin (RGX and Gaia Vandal, BlastX
// Phantom, Singularity Sheriff, Araxys Operator, Prime Guardian).
(() => {
  if (window.__aimLocalAudio) return;
  const SKIN = 'es-vandal-skin';
  if(localStorage.getItem(SKIN)&&!['default-vandal','rgx-vandal-yellow','gaia-vandal-orange','gaia-vandal-white'].includes(localStorage.getItem(SKIN)))localStorage.setItem(SKIN,'default-vandal');
  if(localStorage.getItem('es-melee-skin')==='reaver-karambit')localStorage.setItem('es-melee-skin','damascus-karambit');
  window.__aimMeleeSkin = localStorage.getItem('es-melee-skin') || 'blackmarket-butterfly';
  if(localStorage.getItem('es-phantom-skin')&&!['default','blastx-phantom'].includes(localStorage.getItem('es-phantom-skin')))localStorage.setItem('es-phantom-skin','default');
  window.__aimPhantomSkin = localStorage.getItem('es-phantom-skin') || 'blastx-phantom';
  window.__aimSheriffSkin = localStorage.getItem('es-sheriff-skin') === 'default' ? 'default' : 'singularity-sheriff';
  window.__aimOperatorSkin = ['default','araxys-operator','rogue-operator'].includes(localStorage.getItem('es-operator-skin')) ? localStorage.getItem('es-operator-skin') : 'rogue-operator';
  window.__aimGuardianSkin = localStorage.getItem('es-guardian-skin') === 'prime-guardian' ? 'prime-guardian' : 'default';
  localStorage.setItem('es-classic-skin','default');
  window.__aimClassicSkin = 'default';
  window.__aimGhostSkin = localStorage.getItem('es-ghost-skin') === 'smite-ghost' ? 'smite-ghost' : 'default';
  window.__aimVandalSkin = localStorage.getItem(SKIN) || 'rgx-vandal-yellow';
  let decoder, killVoice, gaiaFireBuffer, araxysFireBuffer;
  const voices = new Set(), blastBuffers = new Map(), singularityBuffers = new Map(), araxysBuffers = new Map(), rgxBuffers = new Map(), gaiaKills = new Map();
  function context() { return decoder ||= new AudioContext(); }
  const ids = ['fire', 'kill1', 'kill2', 'kill3', 'kill4', 'kill5'];
  // RGX Vandal: the shot and kills 1-5 the player had imported, at the 0.46 volume they had set.
  const RGX_VOLUME = 0.46;
  const rgxReady = Promise.all(ids.map(async name=>{try{const response=await fetch('/media/rgx-vandal-yellow/'+name+'.wav');if(!response.ok)throw Error('Missing RGX sound '+name);rgxBuffers.set(name,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('RGX audio:',error);}}));
  const skinReady = fetch('/media/gaia-vandal-orange/fire.wav').then(r=>{if(!r.ok)throw Error('Gaia firing sound unavailable');return r.arrayBuffer();}).then(bytes=>context().decodeAudioData(bytes)).then(buffer=>{gaiaFireBuffer=buffer;}).catch(error=>console.warn('Gaia firing sound:',error));
  const gaiaKillsReady=Promise.all([1,2,3,4,5].map(async stage=>{try{const response=await fetch('/media/gaia-vandal-orange/kill'+stage+'.mp3');if(!response.ok)throw Error('Missing Gaia kill sound '+stage);gaiaKills.set('kill'+stage,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Gaia kill sound:',stage,error);}}));
  const blastReady = Promise.all(['fire','kill1','kill2','kill3','kill4','kill5'].map(async name=>{try{const response=await fetch('/media/blastx-phantom/'+name+(name==='fire'?'.wav':'.mp3'));if(!response.ok)throw Error('Missing BlastX sound '+name);blastBuffers.set(name,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('BlastX audio:',error);}}));
  const singularityReady = Promise.all(ids.map(async name=>{try{const response=await fetch('/media/singularity-sheriff/'+name+(name==='fire'?'.wav':'.mp3'));if(!response.ok)throw Error('Missing Singularity sound '+name);singularityBuffers.set(name,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Singularity audio:',error);}}));
  const araxysReady = fetch('/media/araxys-operator/fire.wav').then(r=>{if(!r.ok)throw Error('Araxys firing sound unavailable');return r.arrayBuffer();}).then(bytes=>context().decodeAudioData(bytes)).then(buffer=>{araxysFireBuffer=buffer;}).catch(error=>console.warn('Araxys firing sound:',error));
  const araxysKillsReady = Promise.all([1,2,3,4,5].map(async stage=>{try{const response=await fetch('/media/araxys-operator/kill'+stage+'.mp3');if(!response.ok)throw Error('Missing Araxys kill sound '+stage);araxysBuffers.set('kill'+stage,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Araxys kill sound:',stage,error);}}));
  const rogueBuffers=new Map();
  const rogueReady=Promise.all(ids.map(async name=>{try{const response=await fetch('/media/rogue-operator/'+name+(name==='fire'?'.wav':'.mp3'));if(!response.ok)throw Error('Missing Rogue sound '+name);rogueBuffers.set(name,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Rogue audio:',error);}}));
  const guardianBuffers=new Map(),guardianBuses=new WeakMap(),guardianVoices=new Set(),guardianActions=new Map();
  const guardianVolumes={fire:4,reload:1.5,kill:.65};
  let guardianWeapon=null,guardianEquip=null,guardianReload=null,guardianSeconds=-Infinity;
  const guardianReady=Promise.all(['fire','reload','kill1','kill2','kill3','kill4','kill5'].map(async name=>{try{const response=await fetch('/media/prime-guardian/'+name+(name.startsWith('kill')?'.mp3':'.wav'));if(!response.ok)throw Error('Missing Prime Guardian sound '+name);guardianBuffers.set(name,await context().decodeAudioData(await response.arrayBuffer()));}catch(error){console.warn('Prime Guardian audio:',error);}}));
  const ready = Promise.all([skinReady,gaiaKillsReady,blastReady,singularityReady,araxysReady,araxysKillsReady,rogueReady,rgxReady,guardianReady]);
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
  async function warmGuardian(audio){await guardianReady;if(window.__aimGuardianSkin!=='prime-guardian')return;const output=audio?.ensure();if(output)for(const name of ['fire','reload','kill'])guardianBus(output.context,output.master,name);}
  function updateGuardian(weapon,seconds,equipAt,reloadSince,audio,phase='running'){
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
  window.__aimLocalAudio = {
    ready,
    warmGuardian,updateGuardian,stopGuardian,
    guardianInfo:()=>({loaded:[...guardianBuffers.keys()],voices:guardianVoices.size,actions:[...guardianActions.keys()]}),
    playSkinFire: (ctx, destination, weapon='vandal') => weapon==='vandal'&&['gaia-vandal-orange','gaia-vandal-white'].includes(window.__aimVandalSkin) ? play('gaia-fire',ctx,destination,false,gaiaFireBuffer,0.55) : weapon==='vandal'&&window.__aimVandalSkin==='rgx-vandal-yellow' ? play('rgx-fire',ctx,destination,false,rgxBuffers.get('fire'),RGX_VOLUME) : weapon==='phantom'&&window.__aimPhantomSkin==='blastx-phantom' ? play('blastx-fire',ctx,destination,false,blastBuffers.get('fire'),1) : weapon==='sheriff'&&window.__aimSheriffSkin==='singularity-sheriff' ? play('singularity-fire',ctx,destination,false,singularityBuffers.get('fire'),1) : weapon==='operator'&&window.__aimOperatorSkin==='rogue-operator' ? play('rogue-fire',ctx,destination,false,rogueBuffers.get('fire'),1.15) : weapon==='operator'&&window.__aimOperatorSkin==='araxys-operator' ? play('araxys-fire',ctx,destination,false,araxysFireBuffer,1) : weapon==='guardian'&&window.__aimGuardianSkin==='prime-guardian' ? playGuardian('fire',ctx,destination) : false,
    playSkinKill: (ctx,destination,count,weapon) => {
      const slot='kill'+((Math.max(1,Math.floor(count))-1)%5+1);
      if(weapon==='vandal'&&['gaia-vandal-orange','gaia-vandal-white'].includes(window.__aimVandalSkin))return play('gaia-'+slot,ctx,destination,true,gaiaKills.get(slot),.65);
      if(weapon==='guardian'&&window.__aimGuardianSkin==='prime-guardian')return playGuardian(slot,ctx,destination);
      if(weapon==='vandal'&&window.__aimVandalSkin==='rgx-vandal-yellow')return play('rgx-'+slot,ctx,destination,true,rgxBuffers.get(slot),RGX_VOLUME);
      if(weapon==='phantom'&&window.__aimPhantomSkin==='blastx-phantom')return play('blastx-'+slot,ctx,destination,true,blastBuffers.get(slot),0.65);
      if(weapon==='sheriff'&&window.__aimSheriffSkin==='singularity-sheriff')return play('singularity-'+slot,ctx,destination,true,singularityBuffers.get(slot),0.65);
      if(weapon==='operator'&&window.__aimOperatorSkin==='araxys-operator')return play('araxys-'+slot,ctx,destination,true,araxysBuffers.get(slot),0.65);
      if(weapon==='operator'&&window.__aimOperatorSkin==='rogue-operator')return play('rogue-'+slot,ctx,destination,true,rogueBuffers.get(slot),0.52);
      return false;
    },
  };
  const css = document.createElement('style');
  // The Vandal firing and kill sound settings are hidden: each skin brings its own sounds.
  css.textContent = `[data-setting="fireKit"],[data-setting="killKit"]{display:none!important}.es-skin-select button{padding:7px 12px;background:#222b36;color:#eee;border:1px solid #48515f;cursor:pointer}.es-skin-select{display:flex;gap:6px;flex-wrap:wrap}.es-skin-select .is-active{background:#8e2435;border-color:#ff4655}.hall-choice.es-melee-row{flex-wrap:wrap!important;row-gap:10px}.es-melee-row>.hall-field-text,.es-melee-row>.es-skin-select{flex:1 1 100%!important;min-width:0}`;
  document.head.append(css);
  function addMeleeChoice() {
    const anchor=document.querySelector('.es-vandal-row');if(!anchor||document.querySelector('.es-melee-row'))return;
    const row=document.createElement('div');row.className='hall-field hall-choice es-melee-row';
    for(const a of anchor.attributes)if(a.name.startsWith('data-v-'))row.setAttribute(a.name,a.value);
    row.innerHTML='<span class="hall-field-text"><b>Melee skin</b><small>Existing agent arms. Equip, attacks and inspect (Y). Applied when entering a scene.</small></span><div class="es-skin-select" role="radiogroup" aria-label="Melee skin"></div>';
    for(const [id,label]of [['default','Default knife'],['silkleaf-fan','Silkleaf Fan'],['blackmarket-butterfly','Black Market Butterfly'],['prime-axe','Prime Axe'],['half-life-crowbar','Half Life Crowbar'],['orange-butterfly','Orange Butterfly'],['damascus-karambit','Karambit Damascus Steel']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.melee=id;b.setAttribute('role','radio');const active=window.__aimMeleeSkin===id;b.classList.toggle('is-active',active);b.setAttribute('aria-checked',String(active));b.onclick=()=>{localStorage.setItem('es-melee-skin',id);window.__aimMeleeSkin=id;for(const item of row.querySelectorAll('button')){const on=item===b;item.classList.toggle('is-active',on);item.setAttribute('aria-checked',String(on));}};row.lastChild.append(b);}anchor.after(row);
  }
  function addPhantomChoice() {
    const anchor=document.querySelector('.es-vandal-row');if(!anchor||document.querySelector('.es-phantom-row'))return;
    const row=document.createElement('div');row.className='hall-field hall-choice es-phantom-row';
    for(const a of anchor.attributes)if(a.name.startsWith('data-v-'))row.setAttribute(a.name,a.value);
    row.innerHTML='<span class="hall-field-text"><b>Phantom skin</b><small>Applied the next time you enter a scene.</small></span><div class="es-skin-select" role="radiogroup" aria-label="Phantom skin"></div>';
    for(const [id,label]of [['default','Default'],['blastx-phantom','BlastX']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.phantom=id;b.setAttribute('role','radio');const active=window.__aimPhantomSkin===id;b.classList.toggle('is-active',active);b.setAttribute('aria-checked',String(active));b.onclick=()=>{localStorage.setItem('es-phantom-skin',id);window.__aimPhantomSkin=id;for(const item of row.querySelectorAll('button')){const on=item===b;item.classList.toggle('is-active',on);item.setAttribute('aria-checked',String(on));}};row.lastChild.append(b);}anchor.after(row);
  }
  function addSheriffChoice() {
    const anchor=document.querySelector('.es-vandal-row');if(!anchor||document.querySelector('.es-sheriff-row'))return;
    const row=document.createElement('div');row.className='hall-field hall-choice es-sheriff-row';
    for(const a of anchor.attributes)if(a.name.startsWith('data-v-'))row.setAttribute(a.name,a.value);
    row.innerHTML='<span class="hall-field-text"><b>Sheriff skin</b><small>Applied the next time you enter a scene.</small></span><div class="es-skin-select" role="radiogroup" aria-label="Sheriff skin"></div>';
    for(const [id,label]of [['default','Default'],['singularity-sheriff','Singularity']]){
      const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.sheriff=id;button.setAttribute('role','radio');
      const active=window.__aimSheriffSkin===id;button.classList.toggle('is-active',active);button.setAttribute('aria-checked',String(active));
      button.onclick=()=>{localStorage.setItem('es-sheriff-skin',id);window.__aimSheriffSkin=id;for(const item of row.querySelectorAll('button')){const on=item===button;item.classList.toggle('is-active',on);item.setAttribute('aria-checked',String(on));}};
      row.lastChild.append(button);
    }
    anchor.after(row);
  }
  function addOperatorChoice() {
    const anchor=document.querySelector('.es-vandal-row');if(!anchor||document.querySelector('.es-operator-row'))return;
    const row=document.createElement('div');row.className='hall-field hall-choice es-operator-row';
    for(const a of anchor.attributes)if(a.name.startsWith('data-v-'))row.setAttribute(a.name,a.value);
    row.innerHTML='<span class="hall-field-text"><b>Operator skin</b><small>Applied the next time you enter a scene.</small></span><div class="es-skin-select" role="radiogroup" aria-label="Operator skin"></div>';
    for(const [id,label]of [['default','Default'],['araxys-operator','Araxys'],['rogue-operator','Rogue']]){
      const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.operator=id;button.setAttribute('role','radio');
      const active=window.__aimOperatorSkin===id;button.classList.toggle('is-active',active);button.setAttribute('aria-checked',String(active));
      button.onclick=()=>{localStorage.setItem('es-operator-skin',id);window.__aimOperatorSkin=id;for(const item of row.querySelectorAll('button')){const on=item===button;item.classList.toggle('is-active',on);item.setAttribute('aria-checked',String(on));}};
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
      button.onclick=()=>{localStorage.setItem('es-guardian-skin',id);window.__aimGuardianSkin=id;for(const item of row.querySelectorAll('button')){const on=item===button;item.classList.toggle('is-active',on);item.setAttribute('aria-checked',String(on));}};
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
      row.innerHTML='<span class="hall-field-text"><b>Weapon skin</b><small>Vandal appearance. Applied the next time you enter a scene.</small></span><div class="es-skin-select" role="radiogroup" aria-label="Weapon skin"></div>';
      let selected=localStorage.getItem(SKIN)||'rgx-vandal-yellow';
      for(const [id,label] of [['default-vandal','Default'],['rgx-vandal-yellow','RGX Yellow'],['gaia-vandal-orange','Gaia Orange'],['gaia-vandal-white','Gaia White']]) {
        const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('role','radio');
        const update=()=>{for(const item of row.querySelectorAll('button')){const on=item===b;item.classList.toggle('is-active',on);item.setAttribute('aria-checked',String(on));}};
        b.classList.toggle('is-active',selected===id);b.setAttribute('aria-checked',String(selected===id));
        b.onclick=()=>{localStorage.setItem(SKIN,id);window.__aimVandalSkin=id;[...native.querySelectorAll('button')].find(b=>b.textContent.trim()==='Vandal')?.click();update();};
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

