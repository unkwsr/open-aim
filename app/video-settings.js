(()=>{
 if(window.__aimVideoControls)return;window.__aimVideoControls=true;
 const presets=[120,144,165,240,360];
 let lastCustom=240;
 try{const n=Number(localStorage.getItem('aim-frame-custom-fps-v1'));if(Number.isInteger(n)&&n>=30&&n<=1000)lastCustom=n;}catch{}
 function add(){
  const anchor=document.querySelector('[data-setting="frameMode"]'),parent=anchor?.parentElement;
  if(!parent||parent.querySelector('.aim-frame-controls')||!window.__aimVideoSettings)return;
  parent.classList.add('aim-video-panel');
  const scoped=[...anchor.attributes].filter(a=>a.name.startsWith('data-v-')).map(a=>a.name);
  const state=()=>window.__aimVideoSettings.read(),patch=value=>window.__aimVideoSettings.patch(value);
  if(state().renderEveryNthFrame!==1)patch({renderEveryNthFrame:1});
  const initialMode=state().frameMode;
  let mode=state().frameMode==='refresh'?'refresh':state().maxFps>0?'custom':'unlimited';
  if(state().maxFps>0)lastCustom=state().maxFps;
  const group=document.createElement('div');group.className='aim-frame-controls';group.dataset.setting='frameLimit';group.dataset.focus='frameRate';
  group.innerHTML='<div class="hall-field hall-choice"><span class="hall-field-text"><span class="hall-field-head"><b>Frame rate limit</b></span><small>Choose how often the game renders.</small></span><div class="hall-choice-options" role="radiogroup" aria-label="Frame rate limit"></div></div><div class="aim-frame-custom" hidden><label>FPS <input type="number" min="30" max="1000" step="1" inputmode="numeric" aria-label="Custom frame rate limit"></label><div class="hall-choice-options aim-frame-presets" role="group" aria-label="FPS presets"></div><small class="aim-frame-error" role="status"></small></div><small class="aim-frame-status"></small><small class="aim-frame-notice" hidden>Applies from the next round.</small>';
  for(const el of group.querySelectorAll('*'))for(const attr of scoped)el.setAttribute(attr,'');
  const options=group.querySelector('[role=radiogroup]'),custom=group.querySelector('.aim-frame-custom'),input=group.querySelector('input'),error=group.querySelector('.aim-frame-error');
  for(const [id,label] of [['unlimited','Unlimited'],['refresh','Match display'],['custom','Custom']]){
   const button=document.createElement('button');button.type='button';button.role='radio';button.dataset.mode=id;button.textContent=label;
   for(const attr of scoped)button.setAttribute(attr,'');
   button.onclick=()=>{mode=id;patch({frameMode:id==='refresh'?'refresh':'unlimited',renderEveryNthFrame:1,maxFps:id==='custom'?lastCustom:0});error.textContent='';input.removeAttribute('aria-invalid');render();};options.append(button);
  }
  function commit(value){
   const n=Number(value);if(!String(value).trim()||!Number.isInteger(n)||n<30||n>1000){error.textContent='Enter a whole number from 30 to 1000.';input.setAttribute('aria-invalid','true');return false;}
   lastCustom=n;try{localStorage.setItem('aim-frame-custom-fps-v1',String(n))}catch{}input.removeAttribute('aria-invalid');error.textContent='';patch({frameMode:'unlimited',renderEveryNthFrame:1,maxFps:n});render();return true;
  }
  input.onchange=()=>commit(input.value);
  input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();commit(input.value);input.blur();}};
  for(const fps of presets){const button=document.createElement('button');button.type='button';button.textContent=String(fps);button.dataset.fps=fps;for(const attr of scoped)button.setAttribute(attr,'');button.onclick=()=>{input.value=fps;commit(fps)};group.querySelector('.aim-frame-presets').append(button);}
  const readout=document.createElement('div');readout.className='hall-field hall-choice aim-meter-choice';readout.dataset.setting='frameMeter';
  readout.innerHTML='<span class="hall-field-text"><b>Performance counter</b><small>Game FPS, frame time and 1% low.</small></span><div class="hall-choice-options" role="radiogroup" aria-label="Performance counter"></div>';
  for(const el of [readout,...readout.querySelectorAll('*')])for(const attr of scoped)el.setAttribute(attr,'');
  for(const [on,label]of [[false,'Off'],[true,'On']]){const b=document.createElement('button');b.type='button';b.role='radio';b.textContent=label;b.dataset.on=String(on);for(const attr of scoped)b.setAttribute(attr,'');b.onclick=()=>window.__aimFrameMeter?.setEnabled(on);readout.lastElementChild.append(b);}
  function render(){
   if(!group.isConnected)return;
   const s=state();mode=s.frameMode==='refresh'?'refresh':s.maxFps>0?'custom':'unlimited';
   if(s.renderEveryNthFrame!==1){patch({renderEveryNthFrame:1});return;}
   custom.hidden=mode!=='custom';if(document.activeElement!==input)input.value=s.maxFps>0?s.maxFps:lastCustom;
   for(const b of options.children){const selected=b.dataset.mode===mode;b.classList.toggle('is-active',selected);b.setAttribute('aria-checked',String(selected));}
   for(const b of group.querySelectorAll('[data-fps]')){const selected=mode==='custom'&&Number(b.dataset.fps)===s.maxFps;b.classList.toggle('is-active',selected);b.setAttribute('aria-pressed',String(selected));}
   const displays=window.aimDesktop?.displays||[],display=displays.find(d=>d.current)||displays.find(d=>d.primary),hz=display?.hz;
   group.querySelector('.aim-frame-status').textContent=`Display detected: ${hz?hz+' Hz':'unavailable'} · Selected limit: ${mode==='refresh'?'Match display':mode==='unlimited'?'Unlimited':s.maxFps+' FPS'}`;
   group.querySelector('.aim-frame-notice').hidden=s.frameMode===initialMode;
   for(const b of readout.querySelectorAll('button')){const on=window.__aimFrameMeter?.enabled()??true,selected=b.dataset.on===String(on);b.classList.toggle('is-active',selected);b.setAttribute('aria-checked',String(selected));}
  }
  anchor.before(group);const nativeMeter=parent.querySelector('[data-setting="showPerformance"]');(nativeMeter||anchor).before(readout);
  let section=group.previousElementSibling;while(section&&!section.matches('.hall-dialog-section'))section=section.previousElementSibling;
  if(section){const note=document.createElement('small');note.className='aim-video-local';note.textContent='Video settings are saved on this PC.';section.after(note);}
  const update=()=>{if(group.isConnected)render();else{removeEventListener('aim-video-settings-change',update);removeEventListener('aim-frame-meter-change',update)}};
  addEventListener('aim-video-settings-change',update);addEventListener('aim-frame-meter-change',update);render();
 }
 let queued=false;window.__aimWatchPage(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;add()})},{childList:true,subtree:true});add();
})();
