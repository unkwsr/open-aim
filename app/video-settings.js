(()=>{
 if(window.__aimVideoControls)return;window.__aimVideoControls=true;
 const fpsPresets=[120,144,165,240,360];
 let lastCustomFps=240;
 try{const savedFps=Number(localStorage.getItem('aim-frame-custom-fps-v1'));if(Number.isInteger(savedFps)&&savedFps>=30&&savedFps<=1000)lastCustomFps=savedFps;}catch{}
 // potato-mode-v1 (from max-optimization-vaim, 15 Nov) + compat-potato-v1 (18 Nov 2026): Potato graphics for weak
 // PCs. OFF by default; nothing changes for anyone who doesn't turn it on (site/local/potato.mjs returns the GPU tier
 // as is). On: same resolution (no blur), sun shadows off, anti-aliasing off, 2 nearest map lamps and no spot lamps,
 // map culling on, Interface Performance. Shadows / lamps / anti-aliasing apply when the renderer is created: restart.
 // The Compatibility graphics preset turns Potato on too; picking another preset turns it off again, but only if it
 // was Compatibility that turned it on (a Potato the player switched on by hand stays). Turning Potato off puts map
 // culling, Interface (and shadows, when switched by hand) back to what they were before.
 const potatoKey='aim-potato-v1',potatoPrevKey='aim-potato-prev-v1',potatoByPresetKey='aim-potato-by-preset-v1',cullKey='aim-map-culling-v1',uiKey='es-ui-mode';
 const lsGet=key=>{try{return localStorage.getItem(key)}catch{return null}},lsSet=(key,value)=>{try{value==null?localStorage.removeItem(key):localStorage.setItem(key,value)}catch{}};
 const potatoIsOn=()=>lsGet(potatoKey)==='on';
 function setUiMode(mode){lsSet(uiKey,mode);document.documentElement.dataset.esUi=mode;for(const b of document.querySelectorAll('.es-ui-mode button')){const on=b.dataset.mode===mode;b.classList.toggle('is-active',on);b.setAttribute('aria-checked',String(on));}}
 function setPotato(on,{byPreset=false}={}){
  const video=window.__aimVideoSettings;
  if(on){
   if(!potatoIsOn())lsSet(potatoPrevKey,JSON.stringify({cull:lsGet(cullKey),ui:lsGet(uiKey),shadows:video?.read?.().shadows??true}));
   lsSet(potatoKey,'on');lsSet(potatoByPresetKey,byPreset?'1':null);lsSet(cullKey,'on');setUiMode('performance');
   // By hand: full resolution (Potato = no blur). From the Compatibility preset: keep the preset's own 50 %.
   if(!byPreset)video?.patch?.({shadows:false,renderScale:1,renderEveryNthFrame:1});
  }else{
   let prev=null;try{prev=JSON.parse(lsGet(potatoPrevKey)||'null')}catch{}
   lsSet(potatoKey,'off');lsSet(potatoByPresetKey,null);lsSet(potatoPrevKey,null);
   // Only put back what is still as Potato left it (a choice the player made while Potato was on stays).
   if(prev&&lsGet(cullKey)==='on')lsSet(cullKey,prev.cull);
   if(prev&&lsGet(uiKey)==='performance')setUiMode(prev.ui==='performance'?'performance':'enhanced');
   // From another preset: that preset sets its own shadows. By hand: shadows back to what they were.
   if(!byPreset)video?.patch?.({shadows:prev?prev.shadows!==false:true});
  }
  window.dispatchEvent(new Event('aim-map-culling-change'));window.__aimWorkerStorageEvent?.(potatoKey);window.dispatchEvent(new Event('aim-potato-change'));
 }
 // Graphics preset buttons are the game's own (Vue); this runs after them, so the preset values are already set.
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-setting="qualityPreset"] button');if(!button)return;const label=button.textContent.trim();
  if(/^Compatibility/i.test(label)){if(!potatoIsOn())setPotato(true,{byPreset:true});}
  else if(/^(Performance|Balanced|Quality)/i.test(label)){if(potatoIsOn()&&lsGet(potatoByPresetKey)==='1')setPotato(false,{byPreset:true});}
 });
 function addVideoControls(){
  const anchor=document.querySelector('[data-setting="frameMode"]'),parent=anchor?.parentElement;
  if(!parent||parent.querySelector('.aim-frame-controls')||!window.__aimVideoSettings)return;
  parent.classList.add('aim-video-panel');
  const scopeAttributes=[...anchor.attributes].filter(attribute=>attribute.name.startsWith('data-v-')).map(attribute=>attribute.name);
  const readSettings=()=>window.__aimVideoSettings.read(),patchSettings=value=>window.__aimVideoSettings.patch(value);
  if(readSettings().renderEveryNthFrame!==1)patchSettings({renderEveryNthFrame:1});
  const initialMode=readSettings().frameMode;
  let limitMode=readSettings().frameMode==='refresh'?'refresh':readSettings().maxFps>0?'custom':'unlimited';
  if(readSettings().maxFps>0)lastCustomFps=readSettings().maxFps;
  const frameControls=document.createElement('div');frameControls.className='aim-frame-controls';frameControls.dataset.setting='frameLimit';frameControls.dataset.focus='frameRate';
  frameControls.innerHTML='<div class="hall-field hall-choice"><span class="hall-field-text"><span class="aim-frame-warn" hidden style="display:flex;align-items:center;gap:7px;color:#fbbf24;font-size:12px;font-weight:600;margin-bottom:4px"><i style="flex:none;width:15px;height:15px;border-radius:50%;background:#fbbf24;color:#111;font-style:normal;font-weight:800;font-size:11px;line-height:15px;text-align:center">!</i>Not recommended: less smooth than Match display in this version</span><span class="hall-field-head"><b>Frame rate limit</b></span><small>Choose how often the game renders.</small></span><div class="hall-choice-options" role="radiogroup" aria-label="Frame rate limit"></div></div><div class="aim-frame-custom" hidden><label>FPS <input type="number" min="30" max="1000" step="1" inputmode="numeric" aria-label="Custom frame rate limit"></label><div class="hall-choice-options aim-frame-presets" role="group" aria-label="FPS presets"></div><small class="aim-frame-error" role="status"></small></div><small class="aim-frame-status"></small><small class="aim-frame-notice" hidden>Applies from the next round.</small>';
  for(const element of frameControls.querySelectorAll('*'))for(const attr of scopeAttributes)element.setAttribute(attr,'');
  const modeOptions=frameControls.querySelector('[role=radiogroup]'),customPanel=frameControls.querySelector('.aim-frame-custom'),customFpsInput=frameControls.querySelector('input'),customFpsError=frameControls.querySelector('.aim-frame-error');
  for(const [modeId,label] of [['refresh','Match display'],['unlimited','Unlimited'],['custom','Custom']]){
   const button=document.createElement('button');button.type='button';button.role='radio';button.dataset.mode=modeId;button.textContent=label;
   for(const attr of scopeAttributes)button.setAttribute(attr,'');
   button.onclick=()=>{limitMode=modeId;patchSettings({frameMode:modeId==='refresh'?'refresh':'unlimited',renderEveryNthFrame:1,maxFps:modeId==='custom'?lastCustomFps:0});customFpsError.textContent='';customFpsInput.removeAttribute('aria-invalid');renderFrameControls();};modeOptions.append(button);
  }
  function applyCustomFps(value){
   const fps=Number(value);if(!String(value).trim()||!Number.isInteger(fps)||fps<30||fps>1000){customFpsError.textContent='Enter a whole number from 30 to 1000.';customFpsInput.setAttribute('aria-invalid','true');return false;}
   lastCustomFps=fps;try{localStorage.setItem('aim-frame-custom-fps-v1',String(fps))}catch{}customFpsInput.removeAttribute('aria-invalid');customFpsError.textContent='';patchSettings({frameMode:'unlimited',renderEveryNthFrame:1,maxFps:fps});renderFrameControls();return true;
  }
  customFpsInput.onchange=()=>applyCustomFps(customFpsInput.value);
  customFpsInput.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();applyCustomFps(customFpsInput.value);customFpsInput.blur();}};
  for(const fps of fpsPresets){const button=document.createElement('button');button.type='button';button.textContent=String(fps);button.dataset.fps=fps;for(const attr of scopeAttributes)button.setAttribute(attr,'');button.onclick=()=>{customFpsInput.value=fps;applyCustomFps(fps)};frameControls.querySelector('.aim-frame-presets').append(button);}
  const antiAliasingRow=document.createElement('div');antiAliasingRow.className='hall-field hall-choice';antiAliasingRow.dataset.setting='antiAliasing';
  antiAliasingRow.innerHTML='<span class="hall-field-text"><b>Anti-aliasing</b><small>Smooth 3D edges. Restart the game after changing.</small></span><div class="hall-choice-options" role="radiogroup" aria-label="Anti-aliasing"></div>';
  const antiAliasingKey='aim-anti-aliasing-v1';
  const readAntiAliasing=()=>{try{const saved=localStorage.getItem(antiAliasingKey);return ['smaa','msaa','off'].includes(saved)?saved:'smaa';}catch{return 'smaa';}};
  function renderAntiAliasing(){const savedMode=potatoIsOn()?'off':readAntiAliasing();for(const button of antiAliasingRow.querySelectorAll('button')){const isActive=button.dataset.aa===savedMode;button.classList.toggle('is-active',isActive);button.setAttribute('aria-checked',String(isActive));}}
  for(const [aaMode,label]of [['smaa','SMAA'],['msaa','MSAA'],['off','Off']]){const button=document.createElement('button');button.type='button';button.role='radio';button.textContent=label;button.dataset.aa=aaMode;button.onclick=()=>{try{localStorage.setItem(antiAliasingKey,aaMode);}catch{}renderAntiAliasing();};antiAliasingRow.lastElementChild.append(button);}
  for(const element of [antiAliasingRow,...antiAliasingRow.querySelectorAll('*')])for(const attr of scopeAttributes)element.setAttribute(attr,'');renderAntiAliasing();
  const frameMeterRow=document.createElement('div');frameMeterRow.className='hall-field hall-choice aim-meter-choice';frameMeterRow.dataset.setting='frameMeter';
  frameMeterRow.innerHTML='<span class="hall-field-text"><b>Performance counter</b><small>On: small FPS in the top-left corner. On + details: frame time, 1% low and worst frame.</small></span><div class="hall-choice-options" role="radiogroup" aria-label="Performance counter"></div>';
  for(const element of [frameMeterRow,...frameMeterRow.querySelectorAll('*')])for(const attr of scopeAttributes)element.setAttribute(attr,'');
  for(const [meterMode,label]of [['off','Off'],['on','On'],['details','On + details']]){const button=document.createElement('button');button.type='button';button.role='radio';button.textContent=label;button.dataset.mode=meterMode;for(const attr of scopeAttributes)button.setAttribute(attr,'');button.onclick=()=>window.__aimFrameMeter?.setMode?.(meterMode);frameMeterRow.lastElementChild.append(button);}
  function renderFrameControls(){
   if(!frameControls.isConnected)return;
   const settings=readSettings();limitMode=settings.frameMode==='refresh'?'refresh':settings.maxFps>0?'custom':'unlimited';
   if(settings.renderEveryNthFrame!==1){patchSettings({renderEveryNthFrame:1});return;}
   customPanel.hidden=limitMode!=='custom';if(document.activeElement!==customFpsInput)customFpsInput.value=settings.maxFps>0?settings.maxFps:lastCustomFps;
   for(const button of modeOptions.children){const selected=button.dataset.mode===limitMode;button.classList.toggle('is-active',selected);button.setAttribute('aria-checked',String(selected));}
   for(const button of frameControls.querySelectorAll('[data-fps]')){const selected=limitMode==='custom'&&Number(button.dataset.fps)===settings.maxFps;button.classList.toggle('is-active',selected);button.setAttribute('aria-pressed',String(selected));}
   const displays=window.aimDesktop?.displays||[],display=displays.find(entry=>entry.current)||displays.find(entry=>entry.primary),refreshHz=display?.hz;
   frameControls.querySelector('.aim-frame-status').textContent=`Display detected: ${refreshHz?refreshHz+' Hz':'unavailable'} · Selected limit: ${limitMode==='refresh'?'Match display':limitMode==='unlimited'?'Unlimited':settings.maxFps+' FPS'}`;
   frameControls.querySelector('.aim-frame-notice').hidden=settings.frameMode===initialMode;
   // Unlimited and Custom render unpaced: the screen still shows one frame per refresh, so motion is less even (measured 2026-11-02/12).
   const warn=frameControls.querySelector('.aim-frame-warn');warn.hidden=limitMode==='refresh';warn.style.display=warn.hidden?'none':'flex';
   for(const button of frameMeterRow.querySelectorAll('button')){const meterMode=window.__aimFrameMeter?.mode?.()??'on',selected=button.dataset.mode===meterMode;button.classList.toggle('is-active',selected);button.setAttribute('aria-checked',String(selected));}
  }
  const skyRow=document.createElement('div');skyRow.className='hall-field hall-choice';skyRow.dataset.setting='skyBackground';
  skyRow.innerHTML='<span class="hall-field-text"><b>Sky background</b><small>360° panorama. Map lighting stays the same.</small></span><div class="hall-choice-options" role="radiogroup" aria-label="Sky background"></div>';
  const skyStorageKey='aim-sky-background-v1';
  function renderSky(){let value='autumn';try{value=localStorage.getItem(skyStorageKey)||'autumn';}catch{}for(const button of skyRow.querySelectorAll('button')){const isActive=button.dataset.sky===value;button.classList.toggle('is-active',isActive);button.setAttribute('aria-checked',String(isActive));}}
  for(const [value,label]of [['original','Original'],['autumn','Autumn Field']]){const button=document.createElement('button');button.type='button';button.role='radio';button.dataset.sky=value;button.textContent=label;button.onclick=()=>{try{localStorage.setItem(skyStorageKey,value);}catch{}window.dispatchEvent(new Event('aim-sky-change'));renderSky();};skyRow.lastElementChild.append(button);}
  for(const element of [skyRow,...skyRow.querySelectorAll('*')])for(const attr of scopeAttributes)element.setAttribute(attr,'');
  // Map culling (Worker Test): skip drawing map pieces outside the view. On by default; threaded-game-bridge.mjs applies it.
  const cullRow=document.createElement('div');cullRow.className='hall-field hall-choice aim-cull-row';cullRow.dataset.setting='mapCulling';
  cullRow.innerHTML='<span class="hall-field-text"><span class="aim-cull-warn" style="display:flex;align-items:center;gap:7px;color:#fbbf24;font-size:12px;font-weight:600;margin-bottom:4px"><i style="flex:none;width:15px;height:15px;border-radius:50%;background:#fbbf24;color:#111;font-style:normal;font-weight:800;font-size:11px;line-height:15px;text-align:center">!</i>Far objects may pop in on very fast flicks.</span><span class="hall-field-head"><b>Map culling</b></span><small>Skips drawing what is out of view. More FPS, mostly on low-end PCs.</small></span><div class="hall-choice-options" role="radiogroup" aria-label="Map culling"></div>';
  function renderCull(){let on=true;try{on=localStorage.getItem(cullKey)!=='off';}catch{}for(const button of cullRow.querySelectorAll('button')){const isActive=(button.dataset.cull==='on')===on;button.classList.toggle('is-active',isActive);button.setAttribute('aria-checked',String(isActive));}}
  for(const [value,label]of [['on','On'],['off','Off']]){const button=document.createElement('button');button.type='button';button.role='radio';button.dataset.cull=value;button.textContent=label;button.onclick=()=>{try{localStorage.setItem(cullKey,value);}catch{}window.dispatchEvent(new Event('aim-map-culling-change'));renderCull();};cullRow.lastElementChild.append(button);}
  for(const element of [cullRow,...cullRow.querySelectorAll('*')])for(const attr of scopeAttributes)element.setAttribute(attr,'');
  addEventListener('aim-map-culling-change',()=>{if(cullRow.isConnected)renderCull();});renderCull();
  // smooth-aim-setting-v1 (14 Nov 2026): Smooth aim (mouse-retime-v1 in worker-game-entry.mjs). Off by default;
  // saved as 'aim-smooth-aim-v1' = 'on' | 'off'; threaded-game-bridge.mjs applies it, also during a round.
  const smoothRow=document.createElement('div');smoothRow.className='hall-field hall-choice aim-smooth-aim-row';smoothRow.dataset.setting='smoothAim';
  smoothRow.innerHTML='<span class="hall-field-text"><span class="hall-field-head"><b>Smooth aim</b></span><small>Evens out camera turning between frames. Adds only about 2–3 ms of delay to camera movement; clicks and shots are not delayed.</small></span><div class="hall-choice-options" role="radiogroup" aria-label="Smooth aim"></div>';
  const smoothKey='aim-smooth-aim-v1';
  function renderSmooth(){let on=false;try{on=localStorage.getItem(smoothKey)==='on';}catch{}for(const button of smoothRow.querySelectorAll('button')){const isActive=(button.dataset.smooth==='on')===on;button.classList.toggle('is-active',isActive);button.setAttribute('aria-checked',String(isActive));}}
  for(const [value,label]of [['on','On'],['off','Off']]){const button=document.createElement('button');button.type='button';button.role='radio';button.dataset.smooth=value;button.textContent=label;button.onclick=()=>{try{localStorage.setItem(smoothKey,value);}catch{}window.dispatchEvent(new Event('aim-smooth-aim-change'));renderSmooth();};smoothRow.lastElementChild.append(button);}
  for(const element of [smoothRow,...smoothRow.querySelectorAll('*')])for(const attr of scopeAttributes)element.setAttribute(attr,'');
  addEventListener('aim-smooth-aim-change',()=>{if(smoothRow.isConnected)renderSmooth();});renderSmooth();
  const potatoRow=document.createElement('div');potatoRow.className='hall-field hall-choice aim-potato-row';potatoRow.dataset.setting='potatoMode';
  potatoRow.innerHTML='<span class="hall-field-text"><span class="hall-field-head"><b>Potato graphics</b></span><small>For weak PCs and laptops. Same resolution and texture sharpness (no blur): turns off shadows and anti-aliasing, keeps 2 map lamps, culls the map. The Compatibility preset turns it on. Restart the game after changing.</small><small class="aim-potato-note" hidden style="color:#fbbf24">Restart the game to apply.</small></span><div class="hall-choice-options" role="radiogroup" aria-label="Potato graphics"></div>';
  const potatoAtOpen=potatoIsOn();
  function renderPotato(){const on=potatoIsOn();for(const button of potatoRow.querySelectorAll('button')){const isActive=(button.dataset.potato==='on')===on;button.classList.toggle('is-active',isActive);button.setAttribute('aria-checked',String(isActive));}potatoRow.querySelector('.aim-potato-note').hidden=on===potatoAtOpen;}
  for(const [value,label]of [['on','On'],['off','Off']]){const button=document.createElement('button');button.type='button';button.role='radio';button.dataset.potato=value;button.textContent=label;button.onclick=()=>{if((value==='on')!==potatoIsOn())setPotato(value==='on');else if(value==='on')lsSet(potatoByPresetKey,null);};potatoRow.lastElementChild.append(button);}
  for(const element of [potatoRow,...potatoRow.querySelectorAll('*')])for(const attr of scopeAttributes)element.setAttribute(attr,'');
  const onPotatoChange=()=>{if(!potatoRow.isConnected){removeEventListener('aim-potato-change',onPotatoChange);return;}renderPotato();renderAntiAliasing();};addEventListener('aim-potato-change',onPotatoChange);renderPotato();
  renderSky();anchor.before(potatoRow,skyRow,cullRow,smoothRow,antiAliasingRow,frameControls);const nativeMeter=parent.querySelector('[data-setting="showPerformance"]');(nativeMeter||anchor).before(frameMeterRow);
  let section=frameControls.previousElementSibling;while(section&&!section.matches('.hall-dialog-section'))section=section.previousElementSibling;
  if(section){const note=document.createElement('small');note.className='aim-video-local';note.textContent='Video settings are saved on this PC.';section.after(note);}
  const refreshOnChange=()=>{if(frameControls.isConnected)renderFrameControls();else{removeEventListener('aim-video-settings-change',refreshOnChange);removeEventListener('aim-frame-meter-change',refreshOnChange)}};
  addEventListener('aim-video-settings-change',refreshOnChange);addEventListener('aim-frame-meter-change',refreshOnChange);renderFrameControls();
 }
 let addQueued=false;window.__aimWatchPage(()=>{if(addQueued)return;addQueued=true;requestAnimationFrame(()=>{addQueued=false;addVideoControls()})},{childList:true,subtree:true});addVideoControls();
})();
