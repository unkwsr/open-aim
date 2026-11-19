// Map culling (Settings > Video): saved as 'aim-map-culling-v1', on unless set to 'off'.
const __aimWantCulling=()=>{try{return localStorage.getItem('aim-map-culling-v1')!=='off'}catch{return true}};
// Method: 'ranges' (default) uses the range method where the map and graphics card support it (Corrode, Haven),
// chunks everywhere else; it drew the fewest triangles in the 2026-11-12 benchmark, which helps low-end PCs most.
// F9 still cycles chunks / ranges / off for testing; saved as 'aim-map-culling-method-v2'.
const __aimCullMethod=()=>{try{return localStorage.getItem('aim-map-culling-method-v2')==='chunks'?'chunks':'ranges'}catch{return 'ranges'}};
const __aimCullWant=()=>__aimWantCulling()?__aimCullMethod():'off';
let __aimCullShown='',__aimRangesPossible=false;
import {wireValue as plain} from './worker-game-wire.mjs';
import {gameClock as recordingClock,configureRecordingKey} from './recording-clock.mjs';
import {createWorkerProgressRecovery} from './worker-progress-recovery.mjs';
const outputs=['playerPose','soundRings','botMarkers','botOrder','preaimHud','adsSight','ammo','vitals','jett','lockdown','weaponSlots','killBanner','canBuy'];
const inputs=['phase','duration','timerPaused','sensitivity','zoomSensitivity','renderScale','renderResolution','aspectRatio','renderEveryNthFrame','frameMode','maxFps','lowLatency','shadows','viewModel','viewModelFov','viewModelHand','viewModelGun','adsMode','keybinds','defaultToWalk','invertMouseY','tracers','flashLook','showPerformance','bulletHoles','rankedTicket','audio','preaimAssist','preaimReport','botOrderWanted','botOrderParts'];
const methods=['rebuildScene','setRenderScale','setRenderResolution','setAspectRatio','setLowLatencyMode','setShadowsMode','setViewModelEnabled','setViewModelFov','setViewModelGun','setTracersEnabled','setFlashLook','setAdsMode','setKeybinds','setDefaultToWalk','setInvertMouseY','setViewModelHand','releaseCursorWhenIdle','quit'];
export function createThreadedGame(host,settings,callbacks,options,runtimeURL){
 let storageFromWorker=false;
 configureRecordingKey(settings.keybinds?.current);
 const canvas=document.createElement('canvas');canvas.className='al-stage-canvas';Object.assign(canvas.style,{display:'block',width:'100%',height:'100%'});host.appendChild(canvas);
 if(!canvas.transferControlToOffscreen)throw Error('This Electron runtime does not support OffscreenCanvas');
 const worker=new Worker('/local/worker-game-entry.mjs?v=timeline-1',{type:'module',name:'AimTrainer simulation and rendering'});
 /* shared-mouse-v1 (14 Nov 2026): mouse moves go into a shared ring (no worker message queue); the worker reads it at
    every frame start and before any other input event. Per slot: movementX, movementY, page wait (ms), sent at (epoch ms).
    idx[0] = written count (page), idx[1] = read count (worker). Full ring or no SharedArrayBuffer -> postMessage as before.
    mouse-retime-v1: slot 2 is now the event's own time (epoch ms) so the worker can spread each move over its time span.
    smooth-aim-setting-v1: Settings > Video > Smooth aim ('aim-smooth-aim-v1', off unless 'on'; video-settings.js). */
 const smoothAimOn=()=>{try{return localStorage.getItem('aim-smooth-aim-v1')==='on'}catch{return false}};let mouseRetime=smoothAimOn();
 const mouseRing=(()=>{try{if(typeof SharedArrayBuffer!=='function')return null;const N=1024,sab=new SharedArrayBuffer(16+N*32);return{N,sab,idx:new Int32Array(sab,0,4),slot:new Float64Array(sab,16,N*4)}}catch{return null}})();
 let disposed=false,ready=false,prepared=false,id=0,replay=null,audio=null,latestReport=null,lastScene=null,paced=true,mapCulling=false;
 const pending=new Map(),listeners=[],fx=new Map(),lastInputs=new Map(),subscriptions=new Set();
 let resolveReady,rejectReady;const started=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject});started.catch(()=>{});
 const badge=document.createElement('div');badge.textContent='WORKER TEST · starting';Object.assign(badge.style,{position:'absolute',right:'12px',top:'12px',zIndex:90,padding:'5px 9px',background:'#10251ee6',color:'#91f2bb',font:'11px sans-serif',pointerEvents:'none'});host.appendChild(badge);
 const error=message=>{badge.textContent='WORKER TEST · '+message;badge.style.background='#561a24';console.error('Worker game:',message)};
 let failed=null;
 let lastPerformanceInput=0;
 const send=(message,transfer)=>{
  if(disposed||failed)return;
  if(message.type==='event'&&window.__aimPerformanceMeter?.enabled){const now=performance.now();if(now-lastPerformanceInput>=100||message.event==='keydown'||message.event==='mousedown'){message.performanceSentAt=performance.timeOrigin+now;lastPerformanceInput=now;}}
  worker.postMessage(message,transfer??[]);
 };
 const releaseRecordingClock=recordingClock.subscribe(rate=>send({type:'recording-speed',rate}));listeners.push(releaseRecordingClock);
 const progressRecovery=createWorkerProgressRecovery({send});
 function request(method,args=[],extra={}){if(disposed||failed)return Promise.reject(failed??new DOMException('Worker disposed','AbortError'));const key=++id;const promise=new Promise((resolve,reject)=>pending.set(key,{resolve,reject}));try{send({type:'command',id:key,method,args:plain(args),...extra})}catch(e){pending.get(key).reject(e);pending.delete(key)}return promise;}
 function fail(message){if(failed||disposed)return;failed=new Error(message);error(message);rejectReady(failed);for(const item of pending.values())item.reject(failed);pending.clear();worker.terminate();}
 const notify=(method,args=[])=>{request(method,args).catch(e=>{if(e.name!=='AbortError')error(e.message)})};
 const storage=()=>{const values={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key)values[key]=localStorage.getItem(key)}return values};
 const globals=()=>Object.fromEntries(Object.keys(window).filter(k=>k.startsWith('__aim')&&['string','number','boolean'].includes(typeof window[k])).map(k=>[k,window[k]]));
 const fullSettings=()=>Object.fromEntries(Object.entries(settings).filter(([,ref])=>ref&&'current'in ref&&typeof ref.current!=='function').map(([k,ref])=>[k,plain(ref.current)]));
 const refreshPreferences=()=>send({type:'preferences',storage:storage(),globals:globals()});
 function mergeOutputs(values){for(const[k,value]of Object.entries(values??{})){const ref=settings[k];if(!ref)continue;if(value&&typeof value==='object'&&ref.current&&typeof ref.current==='object'&&!Array.isArray(value)){Object.assign(ref.current,value)}else ref.current=value;}}
 const on=(target,type,handler,options)=>{target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options))};
 const size=()=>({width:Math.max(1,host.clientWidth),height:Math.max(1,host.clientHeight),dpr:devicePixelRatio||1});
 function syncInputs(){const delta={};for(const k of inputs){if(!settings[k])continue;const value=plain(settings[k].current),serialized=JSON.stringify(value);if(k==='keybinds')configureRecordingKey(value);if(lastInputs.get(k)!==serialized){lastInputs.set(k,serialized);delta[k]=value;if(k==='frameMode'){const next=value!=='unlimited';if(next!==paced){paced=next;send({type:'presentation',paced});}}}}if('phase'in delta)progressRecovery.phase(delta.phase);if(Object.keys(delta).length)send({type:'settings',values:delta});}
 async function lock(){if(document.pointerLockElement===canvas)return;await canvas.requestPointerLock({unadjustedMovement:true}).catch(async e=>{if(e.name==='NotSupportedError')return canvas.requestPointerLock();throw e});}
 function openingLoadout(){try{return plain(settings.openingLoadout?.current?.(lastScene)??[])}catch{return[]}}
 async function begin(method){try{window.__aimDesktop?.fullscreen?.();const locking=lock().catch(()=>false);await started;await locking;send({type:'event',event:'pointerlockchange',data:{locked:document.pointerLockElement===canvas}});if(method==='restart')await request('setOpening',[openingLoadout()]);return await request(method)}catch(e){error(e.message);throw e}}
 const audioReady=import(runtimeURL).then(module=>{if(disposed)throw new DOMException('Worker disposed','AbortError');audio=new module.__workerGameAudio(settings.audio);return audio});audioReady.catch(e=>{if(!disposed)error('Audio: '+e.message)});
 const restoreAudio=value=>{if(value?.$workerAudio)return audio;if(Array.isArray(value))return value.map(restoreAudio);return value};
 async function audioCall(message){await audioReady;if(disposed||failed)return;let target=message.domain==='audio'?audio:window[message.domain];const parts=message.method.split('.');for(const key of parts.slice(0,-1))target=target?.[key];const name=parts.at(-1),args=(message.args??[]).map(restoreAudio);if(typeof target?.[name]==='function')return target[name](...args);if(name==='ready')return target?.ready;}
 worker.onmessage=async({data:m})=>{
  if(m.type==='performance'){window.__aimPerformanceMeter?.receive(m.packet);return;}
  if(disposed||failed)return;
  if(m.type==='scheduler-pulse-ack'){progressRecovery.acknowledge();return;}
  if(m.type==='ready'){ready=true;badge.textContent='WORKER TEST · rendering off main thread';resolveReady();return;}
  if(m.type==='reply'){const item=pending.get(m.id);if(!item)return;pending.delete(m.id);if(m.error){const e=new Error(m.error.message);e.name=m.error.name??'Error';if(m.error.stack){e.workerStack=m.error.stack;e.stack=m.error.stack+'\n--- Host request ---\n'+e.stack;}item.reject(e)}else item.resolve(m.value);return;}
  if(m.type==='batch'){
   if(m.frames?.some(frame=>frame.running))progressRecovery.progress();
   mergeOutputs(m.refs);if(m.hud)callbacks.onHud?.(m.hud);
   for(const frame of m.frames??[])window.__aimRenderComplete?.(frame.at-performance.timeOrigin,frame.running);
   if(m.health){latestReport=m.health;mapCulling=m.health.corrodeRanges?.active?m.health.corrodeRanges.enabled:m.health.mapSections?.enabled??mapCulling;/* aim-map-culling-setting: keep the game on the saved choice */{const want=__aimCullWant();__aimRangesPossible=!!m.health.rangesPossible;const eff=want==='off'?'off':want==='ranges'&&__aimRangesPossible?'ranges':'chunks';if(m.health.cullMode&&m.health.cullMode!==eff)send({type:'map-visibility',mode:want});__aimCullShown=m.health.cullMode?eff:(mapCulling?'on':'off');mapCulling=eff!=='off';}badge.textContent='WORKER TEST · '+m.health.fps+' FPS · '+(paced?'display paced':'unlimited')+' · F8 · culling '+__aimCullShown+' · F9'+(mouseRing?' · smooth aim '+(mouseRetime?'on':'off'):'');}
   return;
  }
  if(m.type==='timeline'){globalThis.__aimTimelineSink?.(m.data);return;}
  // Studio copycat recording (copycat-jett-v1): the game records in the worker; keep the same
  // window.__aimStudioTake the page-side studio-launch.js reads when you leave the recording.
  if(m.type==='studio-take'){let t=window.__aimStudioTake;if(m.reset||!t||t.scene!==m.scene)t=window.__aimStudioTake={scene:m.scene,dt:m.dt,ticks:[],smokes:{},last:0};for(let i=0;i+1<m.rows.length;i+=2)t.ticks[m.rows[i]]=m.rows[i+1];for(let i=0;i+1<(m.smokes?.length??0);i+=2){if(m.smokes[i+1])t.smokes[m.smokes[i]]=m.smokes[i+1];else delete t.smokes[m.smokes[i]];}t.last=m.last;return;}
  if(m.type==='callback'){if(m.method==='onPhaseChange'){settings.phase.current=m.args[0];lastInputs.set('phase',JSON.stringify(m.args[0]));progressRecovery.phase(m.args[0]);}if(m.method==='onRoundComplete')replay=m.replay??null;if(m.method==='onWorkerLowLatency')globalThis.__aimWorkerLowLatency=m.args[0];callbacks[m.method]?.(...m.args);return;}
  if(m.type==='progress'){pending.get(m.id)?.report?.(...m.args);return;}
  if(m.type==='audio-batch'){for(const call of m.calls)audioCall(call).catch(e=>console.warn('Worker audio',e));return;}
  if(m.type==='audio'||m.type==='audio-request'){try{const value=await audioCall(m);if(m.type==='audio-request')send({type:'host-reply',id:m.id,value:typeof value==='boolean'?value:null});}catch(e){if(m.type==='audio-request')send({type:'host-reply',id:m.id,error:{name:e.name,message:e.message}});else console.warn('Worker audio',e)}return;}
  if(m.type==='host'){try{if(m.method==='lock')await lock();else if(m.method==='unlock')document.exitPointerLock();if(m.id)send({type:'host-reply',id:m.id,value:true})}catch(e){send({type:'host-reply',id:m.id,error:{name:e.name,message:e.message}})}return;}
  if(m.type==='subscribe'&&!subscriptions.has(m.event)){subscriptions.add(m.event);on(window,m.event,e=>{refreshPreferences();send({type:'event',event:m.event,target:'window',data:{detail:plain(e.detail)}})});return;}
  if(m.type==='storage'){storageFromWorker=true;try{if(m.value===null)localStorage.removeItem(m.key);else localStorage.setItem(m.key,m.value)}finally{storageFromWorker=false}return;}
  if(m.type==='shot'){window.__aimShot?.(m.shot);return;}
  if(m.type==='fx-create'){const element=document.createElement('canvas');element.className=m.className;Object.assign(element.style,m.style,{pointerEvents:'none'});host.appendChild(element);fx.set(m.id,{canvas:element,context:element.getContext('bitmaprenderer')});return;}
  if(m.type==='fx-frame'){const item=fx.get(m.id);if(item){if(item.canvas.width!==m.bitmap.width)item.canvas.width=m.bitmap.width;if(item.canvas.height!==m.bitmap.height)item.canvas.height=m.bitmap.height;item.context.transferFromImageBitmap(m.bitmap)}else m.bitmap.close();send({type:'fx-ack',id:m.id});return;}
  if(m.type==='fatal'){fail(m.message);return;}
 };
 worker.onerror=e=>{fail(e.message)};
 const engine={
  async prepareScenario(report=()=>{},signal,resume=false){await started;refreshPreferences();syncInputs();const key=id+1;const promise=request(resume?'prepareResume':'prepareScenario',[],{signalId:key});const item=pending.get(key);if(item)item.report=report;const abort=()=>send({type:'abort',id:key});signal?.addEventListener('abort',abort,{once:true});try{if(signal?.aborted){abort();throw new DOMException('Preparation cancelled','AbortError')}await promise;if(!resume)prepared=true;}finally{signal?.removeEventListener('abort',abort)}},
  prepareResume(report,signal){return engine.prepareScenario(report,signal,true)},
  consumePreparedScene(){const result=prepared;prepared=false;return result},
  loadScene(doc){lastScene=doc;prepared=false;refreshPreferences();notify('loadScene',[doc,openingLoadout()])},
  start:()=>begin('start'),restart:()=>begin('restart'),buy:weapon=>request('buy',[weapon]),
  finishReplay(){const result=replay;replay=null;return result},
 };
 for(const method of methods)engine[method]=(...args)=>{if(method==='rebuildScene'){prepared=false;notify('setOpening',[openingLoadout()])}/* aim-cursor-race: the round-complete code asks for the cursor before it sets the new phase; send the phase first, or the worker still sees "running" and cancels the release */if(method==='releaseCursorWhenIdle'){setTimeout(()=>{if(disposed||failed)return;syncInputs();notify(method,args)},0);return}notify(method,args)};
 const editable=target=>target?.closest?.('input,textarea,select,[contenteditable="true"]');
 on(window,'keydown',e=>{if(e.code!=='F8'||e.repeat||editable(e.target))return;e.preventDefault();paced=!paced;send({type:'presentation',paced});});
 /* smooth-aim-setting-v1: the Video setting switches smooth aim, also mid-round (replaces the F4 test key) */
 on(window,'aim-smooth-aim-change',()=>{const next=smoothAimOn();if(next===mouseRetime)return;mouseRetime=next;send({type:'mouse-retime',enabled:mouseRetime});});
 on(window,'aim-map-culling-change',()=>{const want=__aimCullWant();mapCulling=want!=='off';send({type:'map-visibility',mode:want});});
 on(window,'keydown',e=>{if(e.code!=='F9'||e.repeat||editable(e.target))return;e.preventDefault();/* F9 cycles chunks > ranges (Corrode, Haven only) > off */const now=__aimCullWant();const next=now==='chunks'?(__aimRangesPossible?'ranges':'off'):now==='ranges'?'off':'chunks';try{localStorage.setItem('aim-map-culling-v1',next==='off'?'off':'on');if(next!=='off')localStorage.setItem('aim-map-culling-method-v2',next)}catch{}dispatchEvent(new Event('aim-map-culling-change'));badge.textContent='WORKER TEST · map culling '+next+' · F9 to switch';});
 for(const type of ['keydown','keyup','mousedown','mouseup','wheel','contextmenu'])on(document,type,e=>{if(editable(e.target))return;if(e.target===canvas&&(type==='wheel'||type==='contextmenu'))e.preventDefault();send({type:'event',event:type,target:e.target===canvas?'canvas':'document',data:{key:e.key,code:e.code,button:e.button,buttons:e.buttons,deltaY:e.deltaY,repeat:e.repeat,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey,altKey:e.altKey,metaKey:e.metaKey}});},{passive:false});
 const pointerType='onpointerrawupdate'in window?'pointerrawupdate':'mousemove';on(document,pointerType,e=>{if(document.pointerLockElement===canvas){const now=performance.now();if(mouseRing){const w=Atomics.load(mouseRing.idx,0);if(w-Atomics.load(mouseRing.idx,1)<mouseRing.N){const o=(w%mouseRing.N)*4;mouseRing.slot[o]=e.movementX;mouseRing.slot[o+1]=e.movementY;mouseRing.slot[o+2]=performance.timeOrigin+e.timeStamp;mouseRing.slot[o+3]=performance.timeOrigin+now;Atomics.store(mouseRing.idx,0,w+1);return;}}/* mouse-timing-log-v1: how long the event waited on the page before it was forwarded, and when it was sent (epoch ms) */send({type:'event',event:pointerType,data:{movementX:e.movementX,movementY:e.movementY,pointerType:'mouse',aimPageDelayMs:now-e.timeStamp,aimSentAt:performance.timeOrigin+now}})}},{passive:true});
 on(document,'pointerlockchange',()=>send({type:'event',event:'pointerlockchange',data:{locked:document.pointerLockElement===canvas}}));
 on(document,'visibilitychange',()=>send({type:'event',event:'visibilitychange',data:{visible:!document.hidden}}));
 for(const type of ['focus','blur'])on(window,type,()=>send({type:'event',event:type,target:'window'}));
 const observer=new ResizeObserver(()=>send({type:'resize',size:size()}));observer.observe(host);
 const initial=fullSettings();for(const k of inputs)lastInputs.set(k,JSON.stringify(initial[k]));
 const surface=canvas.transferControlToOffscreen();send({type:'init',mouseRing:mouseRing?.sab,mouseRingEvent:pointerType,mouseRetime,performanceEnabled:window.__aimPerformanceMeter?.enabled===true,recordingRate:recordingClock.rate,canvas:surface,size:size(),settings:initial,storage:storage(),globals:globals(),runtimeURL,desktop:{shell:'electron',vsync:window.aimDesktop?.vsync??false,version:window.aimDesktop?.version},outputs},[surface]);
 const timer=setInterval(()=>{syncInputs();progressRecovery.tick({ready,paced,visible:!document.hidden});},16);
 const preparation={engine,async prepare(report,signal){await engine.prepareScenario(report,signal);prepared=true}};window.__aimDrillPreparation=preparation;window.__aimRefreshWorkerPreferences=refreshPreferences;/* aim-worker-storage-event: tell the worker a localStorage key changed in this window (a same-window write fires no 'storage' event), e.g. target colour picked in the Parameters window */window.__aimWorkerStorageEvent=key=>{refreshPreferences();send({type:'event',event:'storage',target:'window',data:{key,newValue:localStorage.getItem(key)}})};/* agent picker: send localStorage (aim-agent) to the worker before a restart */
 /* settings-to-worker-v1: a setting saved on the page (e.g. Settings > Range > Enemy outlines > Outline color) is passed to the game worker right away; before, the worker kept the values it got when it started. Writes that came from the worker itself are not echoed back. */
 const storageChanged=new Set();let storageFlushQueued=false;const flushStorage=()=>{storageFlushQueued=false;if(disposed||failed){storageChanged.clear();return}const values={};for(const key of storageChanged)values[key]=localStorage.getItem(key);const keys=[...storageChanged];storageChanged.clear();send({type:'preferences',storage:values,globals:globals()});for(const key of keys)send({type:'event',event:'storage',target:'window',data:{key,newValue:values[key]}});};
 const noteStorage=key=>{if(storageFromWorker||disposed||typeof key!=='string')return;storageChanged.add(key);if(!storageFlushQueued){storageFlushQueued=true;queueMicrotask(flushStorage)}};
 const sinks=(window.__aimStorageSinks??=new Set());if(!window.__aimStoragePatched){window.__aimStoragePatched=true;const get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;Storage.prototype.setItem=function(key,value){const watched=this===localStorage&&sinks.size>0,before=watched?get.call(this,key):null;set.call(this,key,value);if(watched&&before!==String(value))for(const sink of sinks)sink(String(key))};Storage.prototype.removeItem=function(key){const watched=this===localStorage&&sinks.size>0&&get.call(this,key)!==null;remove.call(this,key);if(watched)for(const sink of sinks)sink(String(key))};}
 sinks.add(noteStorage);listeners.push(()=>sinks.delete(noteStorage));
 const diagnostic={engine,canvas,worker,ready:started,status:()=>latestReport};(window.__aimWorkerGames??=[]).push(diagnostic);
 return{engine,dispose(){if(disposed)return;disposed=true;rejectReady(new DOMException('Worker disposed','AbortError'));worker.postMessage({type:'performance-control',action:'dispose'});clearInterval(timer);observer.disconnect();for(const remove of listeners)remove();if(document.pointerLockElement===canvas)document.exitPointerLock();setTimeout(()=>worker.terminate(),250);for(const item of pending.values())item.reject(new DOMException('Worker disposed','AbortError'));pending.clear();audio?.dispose();canvas.remove();badge.remove();for(const item of fx.values())item.canvas.remove();if(window.__aimDrillPreparation===preparation)delete window.__aimDrillPreparation;window.__aimWorkerGames=window.__aimWorkerGames.filter(x=>x!==diagnostic);}};
}
