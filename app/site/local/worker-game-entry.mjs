import {installWorkerDOM} from './worker-game-dom.mjs';
import {wireValue as wire} from './worker-game-wire.mjs';
import {createWorkerScheduler} from './worker-game-scheduler.mjs';
import {createAudioBatch} from './worker-audio-batch.mjs';
import {prepareMapSections} from './map-sections.mjs';
import {attachMapSectionVisibility} from './map-section-visibility.mjs';
import {attachCorrodeRangeVisibility} from './corrode-range-visibility.mjs';
import {attachMapInstanceVisibility} from './map-instance-visibility.mjs';
import {gameClock as recordingClock} from './recording-clock.mjs';
import {detailedCapture} from './performance-capture.mjs';
import {attachGpuFenceRecovery} from './gpu-fence-recovery.mjs';
/* settings-to-worker-v1 (14 Nov 2026): apply the saved display settings (enemy outline colour/width/on-off, target pulse,
   hit bursts, ball colour) in the worker's copy of the game. On the page this is done by a Vue settings store the worker
   never creates, so outlines stayed yellow. Runs at start and whenever the page saves al-display-settings-v1
   (threaded-game-bridge.mjs forwards it). b5 = read saved settings, b7/b8/b9 = pulse/bursts/ball colour. */
function applyDisplaySettings(){try{if(!core)return;const d=core.b5();core.__aimApplyEnemyOutline?.(d);core.b7?.(d);core.b8?.(d);core.b9?.(d);send?.({type:'callback',method:'onWorkerDisplaySettings',args:[{enemyHighlightEnabled:d.enemyHighlightEnabled,enemyHighlightColor:d.enemyHighlightColor,enemyHighlightWidth:d.enemyHighlightWidth}]});}catch(e){console.warn('[worker] display settings',e?.message)}}
let dom,settings,instance,viewport,core,init,chain=Promise.resolve(),sequence=0,hud=null,outputs=[],lastBatch=0,frameTimes=[],lastHealth=0,healthFrames=0,activeCommand=null;
const requests=new Map(),controllers=new Map(),aborted=new Set();
const performanceHeld=new Set();let performanceLook=-Infinity;
detailedCapture.activityProvider=()=>((performanceHeld.has('KeyW')||performanceHeld.has('KeyA')||performanceHeld.has('KeyS')||performanceHeld.has('KeyD'))?1:0)|(performanceHeld.has('Mouse0')?2:0)|(performanceHeld.has('Mouse2')?4:0)|(performance.now()-performanceLook<150?8:0);
const audioBatch=createAudioBatch(message=>postMessage(message));
// Requests, replies and frame notifications retain their order relative to audio.
const send=(message,transfer)=>{audioBatch.flush();postMessage(message,transfer??[])};
function hostRequest(method,args=[],domain){const id=++sequence;const promise=new Promise((resolve,reject)=>requests.set(id,{resolve,reject,method,domain}));send(domain?{type:'audio-request',id,domain,method,args:wire(args)}:{type:'host',id,method,args});return promise;}
function audioNotify(domain,method,args){audioBatch.push({type:'audio',domain,method,args:wire(args)});}
function makeAudio(){
 const nested=domain=>new Proxy({}, {get:(_target,method)=>{
  if(method==='then')return undefined;
  if(method==='ready')return hostRequest('ready',[],domain);
  return(...args)=>{if(/^warm/.test(method))return hostRequest(method,args,domain);audioNotify(domain,method,args);return true;};
 }});
 for(const name of ['__aimLocalAudio','__aimMeleeAudio','__aimArcaneAudio'])Object.defineProperty(globalThis,name,{configurable:true,get:()=>nested(name),set(){}});
 const audio={
  $workerAudio:true,ensure(){audioNotify('audio','ensure',[]);return null;},
  jettAudio:new Proxy({}, {get:(_t,method)=>(...args)=>{if(method==='warm')return hostRequest('jettAudio.warm',[],'audio');if(method==='observe'&&args[0]){const s=args[0];args[0]={tick:s.tick,player:s.player,jett:s.jett,neon:s.neon,chamber:s.chamber,waves:s.waves/*wave-hud-worker-v1: the wave counter (wave-hud.mjs) on the page*/};}audioNotify('audio','jettAudio.'+method,args);}}),
  flash:new Proxy({}, {get:(_t,method)=>(...args)=>audioNotify('audio','flash.'+method,args)}),
 };
 return new Proxy(audio,{get(target,method){if(method in target)return target[method];if(method==='then')return undefined;if(method==='weaponSounds')return null;return(...args)=>{if(/^warm/.test(method))return hostRequest(method,args,'audio');audioNotify('audio',method,args);return true;};}});
}
function flush(force=false){
 if(!settings)return;const now=performance.now();if(!force&&now-lastBatch<16)return;lastBatch=now;
 const refs={};for(const key of outputs)if(settings[key])refs[key]=settings[key].current;
 let health=null;if(now-lastHealth>=1000){const scene=globalThis.__aimWorkerScene,s=scene?.snapshot();health={scope:globalThis.constructor.name,potato:globalThis.__aimPotatoInfo??null,render:(()=>{const r=scene?.stage.renderer;if(!r)return null;const gl=r.getContext();return {shadowMap:r.shadowMap.enabled,pixelRatio:r.getPixelRatio(),buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],aa:scene.stage.antiAliasingStats?.()??null,calls:r.info.render.calls,programs:r.info.programs?.length??null}})()/*potato-matrix-v1: read-only, once per second*/,offscreen:scene?.stage.canvas instanceof OffscreenCanvas,fps:Math.round(1000*healthFrames/Math.max(1,now-lastHealth)),tick:s?.tick,bots:s?.actors.filter(a=>a.alive&&a.visible).length,position:s?.player.position,grounded:s?.player.grounded,jett:s?.jett,phase:settings.phase.current,command:activeCommand?.method??null,progress:activeCommand?.progress??null,waiting:[...requests.values()].map(r=>({method:r.method,domain:r.domain})),mapSections:scene?.stage.mapSectionVisibility?.snapshot(),corrodeRanges:scene?.stage.corrodeRangeVisibility?.snapshot(),cullMode:scene?.stage.mapSectionVisibility?.enabled?'chunks':(scene?.stage.corrodeRangeVisibility?.possible&&scene?.stage.corrodeRangeVisibility?.on)?'ranges':'off',rangesPossible:!!scene?.stage.corrodeRangeVisibility?.possible,attrs:scene?.stage.renderer.getContext().getContextAttributes()};/* bot-skeleton-counter-v1: bot bone updates in the last second (only while bots are drawn) */{const S=globalThis.__aimSkelStats;if(S&&S.calls>0){detailedCapture.event('bot-skeletons',{frames:healthFrames,calls:S.calls,skipped:S.skipped,updated:S.updated,byPose:S.byPose,byMove:S.byMove,ms:Math.round(S.ms*1000)/1000,maxMs:Math.round(S.maxMs*1000)/1000});S.calls=S.skipped=S.updated=S.byPose=S.byMove=S.ms=S.maxMs=0;}}lastHealth=now;healthFrames=0;}
 send({type:'batch',refs:wire(refs),hud,frames:frameTimes,health});hud=null;frameTimes=[];
}
async function initialize(message){
 globalThis.__aimWorkerThread=true;
 detailedCapture.configure(message.performanceEnabled===true,packet=>send({type:'performance',packet},[packet.frames.buffer]));
 globalThis.__aimPrepareMapSections=prepareMapSections;
 // Round timeline samples move to the page (results screen) without being copied.
 globalThis.__aimTimelineSink=(data,buffers)=>send({type:'timeline',data},buffers);
 if(typeof globalThis.requestAnimationFrame!=='function')throw Error('Worker display frame callbacks are unavailable in this runtime');
 globalThis.__aimWorkerScheduler=createWorkerScheduler({raf:requestAnimationFrame.bind(globalThis),cancelRaf:cancelAnimationFrame.bind(globalThis),visible:()=>globalThis.document?.visibilityState!=='hidden'&&settings?.phase?.current==='running'});
 globalThis.__aimWorkerRunLoading=async prepare=>{try{await prepare(activeCommand?.report??(()=>{}),activeCommand?.signal);return true}catch(error){if(error?.name==='AbortError')return false;throw error}};
 dom=installWorkerDOM(message.canvas,message.size,send,(method,args)=>hostRequest(method,args),message.storage);
 Object.assign(globalThis,message.globals);globalThis.aimDesktop=message.desktop;
 recordingClock.setRate(message.recordingRate??1);
 settings=Object.fromEntries(Object.entries(message.settings).map(([key,value])=>[key,{current:value}]));
 let opening=[];settings.openingLoadout={current:()=>opening};outputs=message.outputs;
 const audio=makeAudio();
 const native=await import(message.runtimeURL);core=await import(new URL('./BiMsX6Xn.js',message.runtimeURL).href);applyDisplaySettings();
 const callbacks=new Proxy({
  onHud(value){hud=value},
  onPhaseChange(value){settings.phase.current=value;send({type:'callback',method:'onPhaseChange',args:[value]});flush(true);},
  beginLockRenewal(){return null},
  onRoundComplete(...args){flush(true);send({type:'callback',method:'onRoundComplete',args:wire(args)});},
 },{get(target,method){if(method in target)return target[method];return(...args)=>send({type:'callback',method,args:wire(args)});}});
 // Cache renderer selection before handing out the single transferred canvas.
 core.e();
 // The native Windows low-latency path requests a desynchronized canvas and
 // manually blits its persistent framebuffer. On 2026-11-02 Chromium declined
 // desynchronized for this transferred worker canvas, so it was forced off here.
 // 2026-11-11: the player's Low-latency setting is honored again so on/off can be
 // compared in play. What the canvas actually got is reported as __aimWorkerLowLatency.
 instance=native.__workerCreateGame(dom.host,settings,callbacks,{buildAudio:()=>audio,buildViewport:(host,doc,options)=>{dom.arm();const built=core.f(host,doc,options);try{const gl=built.renderer?.getContext?.(),a=gl?.getContextAttributes?.();globalThis.__aimWorkerLowLatency={requested:options?.lowLatency===true,desynchronized:a?.desynchronized===true,antialias:a?.antialias===true};send({type:'callback',method:'onWorkerLowLatency',args:[globalThis.__aimWorkerLowLatency]});console.log('[worker] low latency',JSON.stringify(globalThis.__aimWorkerLowLatency))}catch{}viewport=attachMapInstanceVisibility(attachCorrodeRangeVisibility(attachMapSectionVisibility(built)));attachGpuFenceRecovery(viewport,{enabled:()=>globalThis.__aimWorkerScheduler?.paced===true&&settings.phase.current==='running'&&!document.hidden,frameMs:()=>globalThis.__aimWorkerScheduler.displayIntervalMs});return viewport}});
 instance.setOpening=value=>{opening=value??[]};
 globalThis.__aimRenderComplete=(at,running)=>{healthFrames++;frameTimes.push({at:performance.timeOrigin+at,running});dom.commitFX();flush();};
 globalThis.__aimRenderStop=()=>send({type:'batch',refs:{},frames:[{at:Date.now(),running:false}]});
 globalThis.__aimShot=shot=>send({type:'shot',shot:wire(shot)});
 setInterval(()=>flush(),16);
 send({type:'ready'});
}
async function command(message){
 await init;
 const {method,args=[],id}=message;
 const controller=new AbortController();controllers.set(id,controller);if(aborted.delete(id))controller.abort();activeCommand={method,signal:controller.signal,report:(...args)=>{activeCommand.progress=args;send({type:'progress',id,args})}};
 try{
  let value;
  if(method==='setOpening'){instance.setOpening(args[0]);
  }else if(method==='loadScene'){
   const [doc,opening]=args;instance.setOpening(opening);if(doc.environment.map)await core.gu.loadMapCollision(doc.environment.map);value=instance.engine.loadScene(doc);
  }else if(method==='prepareScenario'||method==='prepareResume'){
   value=await instance.engine[method](activeCommand.report,controller.signal);
  }else value=await instance.engine[method](...args);
  flush(true);send({type:'reply',id,value:wire(value??null)});
 }catch(error){send({type:'reply',id,error:{name:error?.name??'Error',message:error?.message??String(error),stack:error?.stack}})}finally{controllers.delete(id);activeCommand=null;}
}
/* shared-mouse-v1 (14 Nov 2026): read the page's shared mouse ring (threaded-game-bridge.mjs). Each movement is still
   dispatched as its own event, as before, so the game sees the same input; only the delivery path changes. Called
   at every frame start (worker-game-scheduler.mjs) and before any other input event, so a click uses the aim that
   came before it. Also keeps mouse-timing-log-v1 counts (transit = page write -> worker read). */
let mouseRing=null,mouseRingEvent='pointerrawupdate';
/* mouse-retime-v1 (14 Nov 2026): smooth aim. Each mouse report moved the mouse over the time since the previous
   report; spread its movement evenly over that span and give each frame exactly the movement up to
   (frame time - RETIME_DELAY_MS). Turn per frame then follows time, not how many reports landed in the frame
   (880 reports/s vs 240 fps = 3, 4 or 5 per frame: about half of the uneven frames, measured 10:37 / 10:41).
   Costs about RETIME_DELAY_MS of input delay; a mouse press first applies everything already received so a shot
   uses the latest aim. Off (Settings > Video > Smooth aim, default): every report is dispatched as soon as it is read, as in shared-mouse-v1. */
const RETIME_DELAY_MS=2,RETIME_GAP_MS=8,RETIME_FIRST_SPAN_MS=1;
let mouseRetime=false,mousePending=[],mouseLastAt=0;
function applyMouse(dx,dy){if(dx||dy)dom.dispatch(mouseRingEvent,{movementX:dx,movementY:dy,pointerType:'mouse'});}
// mode: 'frame' (frame start, frameStamp = worker performance time of the display frame), 'pull' (read only),
// 'flush' (apply everything read so far)
function drainMouse(frameStamp,mode='frame'){
 if(!mouseRing||!dom)return;
 const w=Atomics.load(mouseRing.idx,0);let r=Atomics.load(mouseRing.idx,1);
 if(r!==w){
  const now=performance.timeOrigin+performance.now(),m=globalThis.__aimMouseFrame??={n:0,page:0,transit:0};
  try{for(;r!==w;r++){const o=(r%mouseRing.N)*4,dx=mouseRing.slot[o],dy=mouseRing.slot[o+1],at=mouseRing.slot[o+2],sent=mouseRing.slot[o+3];
   m.n++;const pd=sent-at,tr=now-sent;if(pd>m.page)m.page=pd;if(tr>m.transit)m.transit=tr;
   if(!mouseRetime){applyMouse(dx,dy);continue;}
   // a report after a pause (or out of order) gets a short span instead of the whole pause
   let start=mouseLastAt;if(!(at-start<=RETIME_GAP_MS)||start>at)start=at-RETIME_FIRST_SPAN_MS;
   mousePending.push({start,end:at,dx,dy});if(at>mouseLastAt)mouseLastAt=at;}}
  finally{Atomics.store(mouseRing.idx,1,r);}
 }
 if(!mousePending.length||mode==='pull')return;
 const until=mode==='flush'||!mouseRetime?Infinity:performance.timeOrigin+(Number.isFinite(frameStamp)?frameStamp:performance.now())-RETIME_DELAY_MS;
 let sx=0,sy=0;
 while(mousePending.length){const p=mousePending[0];
  if(p.end<=until){sx+=p.dx;sy+=p.dy;mousePending.shift();continue;}
  if(p.start>=until)break;
  const f=(until-p.start)/(p.end-p.start),ux=p.dx*f,uy=p.dy*f;sx+=ux;sy+=uy;p.dx-=ux;p.dy-=uy;p.start=until;break;}
 applyMouse(sx,sy);
}
globalThis.__aimDrainMouse=drainMouse;
addEventListener('message',({data:message})=>{
 if(message.type==='scheduler-pulse'){
  globalThis.__aimWorkerScheduler?.recoverPendingFrame();send({type:'scheduler-pulse-ack'});return;
 }
 if(message.type==='performance-control'){
  if(message.action==='profile-marker'&&['cpu-profile-start','cpu-profile-end'].includes(message.kind))detailedCapture.event(message.kind,message.details);
  if(message.action==='configure')detailedCapture.configure(message.enabled===true);
  if(message.action==='mark')detailedCapture.event('player-mark',{label:'rough moment'});
  if(message.action==='flush'||message.action==='dispose')detailedCapture.drain(message.action);
  send({type:'performance-ack',requestId:message.requestId});if(message.action==='dispose')close();return;
 }
 if(message.type==='init'){if(message.mouseRing instanceof SharedArrayBuffer){const N=(message.mouseRing.byteLength-16)/32;mouseRing={N,idx:new Int32Array(message.mouseRing,0,4),slot:new Float64Array(message.mouseRing,16,N*4)};mouseRingEvent=message.mouseRingEvent??mouseRingEvent;mouseRetime=message.mouseRetime===true;}init=initialize(message).catch(error=>{send({type:'fatal',message:error?.stack??String(error)});throw error});init.catch(()=>{});return;}
 if(message.type==='command'){chain=chain.then(()=>command(message)).catch(error=>send({type:'fatal',message:error?.stack??String(error)}));return;}
 if(message.type==='host-reply'){const item=requests.get(message.id);if(item){requests.delete(message.id);if(message.error){const error=new Error(message.error.message);error.name=message.error.name;item.reject(error)}else item.resolve(message.value)}return;}
 if(message.type==='abort'){const controller=controllers.get(message.id);if(controller)controller.abort();else aborted.add(message.id);return;}
 if(message.type==='settings'){if(settings)for(const[key,value]of Object.entries(message.values))if(settings[key]){if(['renderScale','renderResolution','aspectRatio','renderEveryNthFrame','frameMode','maxFps','lowLatency','shadows','viewModel','tracers','flashLook'].includes(key))detailedCapture.event('settings-change',{[key]:value});settings[key].current=value;}return;}
 if(message.type==='recording-speed'){recordingClock.setRate(message.rate);return;}
 if(message.type==='preferences'){if(dom){for(const[key,value]of Object.entries(message.storage))dom.storage.set(key,value);Object.assign(globalThis,message.globals)}return;}
 if(message.type==='event'){if(message.event==='storage'&&message.data?.key==='al-display-settings-v1')applyDisplaySettings();
  /* shared-mouse-v1: movement written before this event is read first; mouse-retime-v1: a press (or losing the
     pointer lock) applies all of it so a shot uses the latest aim, other events only read it */
  drainMouse(undefined,message.event==='mousedown'||message.event==='pointerlockchange'||message.event==='blur'?'flush':'pull');
  if(message.event==='visibilitychange')detailedCapture.setVisible(message.data.visible);
  if(message.event==='keydown'||message.event==='mousedown')performanceHeld.add(message.data?.code??'Mouse'+message.data?.button);
  if(message.event==='keyup'||message.event==='mouseup')performanceHeld.delete(message.data?.code??'Mouse'+message.data?.button);
  if(message.event==='blur')performanceHeld.clear();
  /* mouse-timing-log-v1: per-frame mouse event count, max wait on the page, max page-to-worker transit (read and reset by performance-capture) */if((message.event==='pointerrawupdate'||message.event==='mousemove')&&message.data){const m=globalThis.__aimMouseFrame??={n:0,page:0,transit:0};m.n++;const pd=+message.data.aimPageDelayMs;if(pd>m.page)m.page=pd;const sa=+message.data.aimSentAt;if(sa>0){const tr=performance.timeOrigin+performance.now()-sa;if(tr>m.transit)m.transit=tr;}}
  if(detailedCapture.enabled&&message.performanceSentAt&&(message.event==='pointerrawupdate'||message.event==='mousemove'))performanceLook=performance.now();
  if(detailedCapture.enabled&&message.performanceSentAt){detailedCapture.event('worker-input-queue',{type:message.event,queueMs:Math.max(0,performance.timeOrigin+performance.now()-message.performanceSentAt)});}
  dom?.dispatch(message.event,message.data,message.target);return;
 }
 if(message.type==='mouse-retime'){drainMouse(undefined,'flush');mouseRetime=message.enabled!==false;detailedCapture.event?.('mouse-retime',{enabled:mouseRetime});return;}
 if(message.type==='presentation'){detailedCapture.event('pacing',{paced:message.paced});globalThis.__aimWorkerScheduler?.setPaced(message.paced);return;}
 if(message.type==='map-visibility'){detailedCapture.event('map-culling',{enabled:message.enabled});viewport?.mapInstanceVisibility?.setEnabled(message.enabled);/* aim-map-culling-ab: mode chunks | ranges (Corrode, Haven; elsewhere chunks) | off */{const mode=message.mode??(message.enabled?'chunks':'off'),ranges=mode==='ranges'&&!!viewport?.corrodeRangeVisibility?.possible;viewport?.mapSectionVisibility.setEnabled(mode!=='off'&&!ranges);viewport?.corrodeRangeVisibility?.setEnabled(mode!=='off');detailedCapture.event('map-culling-mode',{mode,ranges});}return;}
 if(message.type==='resize'){dom?.resize(message.size);return;}
 if(message.type==='fx-ack')dom?.ackFX(message.id);
});
addEventListener('error',error=>send({type:'fatal',message:error.message}));
addEventListener('unhandledrejection',event=>send({type:'fatal',message:event.reason?.stack??String(event.reason)}));
