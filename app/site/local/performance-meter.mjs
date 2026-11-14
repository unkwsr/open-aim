import {detailedCapture,CAPTURE_COLUMNS} from './performance-capture.mjs';
import {mapPerformanceDetailEnabled} from './map-performance-detail.mjs';

export async function installPerformanceMeter(){
 if(globalThis.__aimWorkerThread||window.__aimPerformanceMeter||!location.pathname.startsWith('/aim')||!window.__aimDesktop?.performance)return;
 const desktop=window.__aimDesktop.performance;
 let enabled=false,expanded=false,session=null,queue=Promise.resolve(),queued=0,saveError='',savedPackets=0,uiTimer=null,drainTimer=null,disposed=false,flushSequence=0;
 const latest=new Map(),held=new Set();let activity=0,lastInput=0,lastLook=0,started=performance.now(),overlay=null;
 // CPU profiles caused ~250–300 ms diagnostic stalls in real user sessions.
 // Keep them explicitly requested; ordinary frame recording remains automatic.
 let cpuProfile={state:'idle'},profileBusy=false,profileStatusAt=0;
 function profileEvent(kind,details){detailedCapture.event(kind,details);for(const game of window.__aimWorkerGames??[])game.worker.postMessage({type:'performance-control',action:'profile-marker',kind,details})}
 async function takeProfile(label='manual'){
  if(profileBusy||cpuProfile.state==='recording'||!enabled||!session)return;
  const packet=latest.get('worker')?.summary?.frames?latest.get('worker'):latest.get('renderer');
  if(!packet?.summary?.frames||packet.context.phase!=='running'){cpuProfile={state:'waiting',error:'Start a round first'};paint();return;}
  profileBusy=true;
  try{
   cpuProfile=await desktop.profile({label,source:packet.source,context:packet.context,summary:packet.summary,requestedAtMs:Date.now()});
   profileEvent('cpu-profile-start',{...cpuProfile,label});
  }catch(error){cpuProfile={state:'error',error:String(error.message??error)};}
  finally{profileBusy=false;paint()}
 }
 async function profileTick(){
  if(profileBusy||!session)return;
  if(cpuProfile.state==='recording'&&performance.now()-profileStatusAt>=1000){
   profileStatusAt=performance.now();profileBusy=true;
   try{const status=await desktop.profile({action:'status'});if(status.state!=='recording'){cpuProfile=status;profileEvent('cpu-profile-end',status)}}catch(error){cpuProfile={state:'error',error:String(error.message??error)}}finally{profileBusy=false}
   return;
  }
 }
 const bus={
  get enabled(){return enabled},get session(){return session},get pendingWrites(){return queued},
  get lastError(){return saveError},get latest(){return Object.fromEntries(latest)},
  receive(packet){
   if(disposed)return;latest.set(packet.source,packet);
   if(queued>=8){saveError='Recorder queue full — pause recording and check disk';setEnabled(false);return;}
   queued++;
   queue=queue.then(()=>desktop.append(packet)).then(result=>{savedPackets=result.packets}).catch(error=>{saveError=String(error.message??error);console.error('Performance recording save:',saveError);enabled=false;detailedCapture.configure(false);notifyWorkers('configure',false)}).finally(()=>{queued--});
  },
  setEnabled,profile:takeProfile,get profileStatus(){return cpuProfile},mark(){detailedCapture.event('player-mark',{label:'rough moment'});notifyWorkers('mark');paint()},
  async flush(){
   detailedCapture.drain('requested-flush');
   await Promise.all((window.__aimWorkerGames??[]).map(game=>new Promise(resolve=>{
    const requestId='performance-'+(++flushSequence),timer=setTimeout(done,500);
    function done(){clearTimeout(timer);game.worker.removeEventListener('message',listen);resolve()}
    function listen({data}){if(data.type==='performance-ack'&&data.requestId===requestId)done()}
    game.worker.addEventListener('message',listen);game.worker.postMessage({type:'performance-control',action:'flush',requestId});
   })));
   await queue;return{session:savedPackets,pending:queued,error:saveError};
  },
 };
 window.__aimPerformanceMeter=bus;
 detailedCapture.activityProvider=()=>activity&~8|(performance.now()-lastLook<150?8:0);
 function notifyWorkers(action,value=enabled){for(const game of window.__aimWorkerGames??[])game.worker.postMessage({type:'performance-control',action,enabled:value})}
 function setEnabled(value){enabled=!!value;if(enabled)saveError='';detailedCapture.configure(enabled,bus.receive);notifyWorkers('configure');paint()}
 const n=(value,digits=1)=>Number.isFinite(value)?value.toFixed(digits):'—';
 function paint(){
  if(disposed||!document.body)return;
  if(!overlay){overlay=document.createElement('div');overlay.id='aim-detailed-performance';overlay.setAttribute('aria-label','Detailed local performance recording');Object.assign(overlay.style,{position:'fixed',right:'12px',top:'46px',zIndex:2147483100,padding:'8px 10px',background:'#07151de8',color:'#c5e7ed',font:'11px/1.5 Consolas,monospace',whiteSpace:'pre',border:'1px solid #32606b',borderRadius:'5px',pointerEvents:'none',maxWidth:'calc(100vw - 32px)'});document.body.append(overlay)}
  const p=latest.get('worker')?.summary?.frames?latest.get('worker'):latest.get('renderer'),s=p?.summary,c=p?.context,cpu=s?.cpu,gpu=p?.gpuSamples??[];
  const gpuMean=gpu.length?gpu.reduce((sum,item)=>sum+item.gpuMs,0)/gpu.length:null;
  const header=saveError?'PERF · SAVE ERROR: '+saveError:enabled?'PERF · RECORDING · '+savedPackets+' saved batches':'PERF · PAUSED';
  const lines=[header];
  if(expanded){
   lines.push(`${p?.source??'waiting'} · ${c?.map?.replace(/^map:/,'')??'no map'} · ${c?.phase??'menu'} · ${Math.round((performance.now()-started)/1000)} s`);
   lines.push(`FPS ${n(s?.fps,0)} · 1% low ${n(s?.onePercentLow,0)}`);
   lines.push(`Frame p99 ${n(s?.p99Ms,2)} ms · worst ${n(s?.worstMs,2)}`);
   lines.push(`CPU sim ${n(cpu?.simulationCpuMs?.meanMs,2)} · render ${n(cpu?.renderCpuMs?.meanMs,2)} ms`);
   lines.push(`  actors ${n(cpu?.actorsCpuMs?.meanMs,2)} · culling ${n(cpu?.mapCullingCpuMs?.meanMs,2)} ms`);
   lines.push(`GPU ${n(gpuMean,2)} ms sampled · ${p?.gpu?.status??'waiting'}`);
   if(c?.antiAliasing)lines.push(`Anti-aliasing: ${c.antiAliasing.mode.toUpperCase()}${c.antiAliasing.ready?'':' · preparing'}`);
   lines.push(`Map culling ${c?.mapCulling?c.mapCulling.enabled?'ON':'OFF':'native'} · hidden ${c?.mapCulling?.hidden??0}`);
   lines.push(`${c?.canvas?.width??'—'}×${c?.canvas?.height??'—'} · ${c?.pacing??'native'} · GPU retries ${s?.gpuRetries??0}`);
   lines.push('Ctrl+Shift+P details · Ctrl+Shift+M mark');
   lines.push('Ctrl+Shift+R recording on/off');
   lines.push(`CPU profile: ${cpuProfile.state}${cpuProfile.error?' · '+cpuProfile.error.slice(0,90):''}`);
   lines.push('Ctrl+Shift+C: 4-second CPU profile');
   lines.push(`Map detail next launch: ${mapPerformanceDetailEnabled()?'optimized':'full'} · Ctrl+Shift+L switch`);
  }else lines.push('Ctrl+Shift+P details');
  // Hidden unless Ctrl+Shift+P opened it: recording keeps running in the background.
  overlay.style.display=expanded?'':'none';
  const text=lines.join('\n');if(overlay.textContent!==text)overlay.textContent=text;
 }
 function updateActivity(){activity=(held.has('KeyW')||held.has('KeyA')||held.has('KeyS')||held.has('KeyD')?1:0)|(held.has('Mouse0')?2:0)|(held.has('Mouse2')?4:0)|(performance.now()-lastLook<150?8:0);detailedCapture.setActivity(activity)}
 function input(event){
  if(event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if(event.type==='keydown'&&event.ctrlKey&&event.shiftKey&&!event.repeat&&['KeyP','KeyM','KeyR','KeyC','KeyL'].includes(event.code)){
   event.preventDefault();event.stopImmediatePropagation();if(event.code==='KeyP')expanded=!expanded;if(event.code==='KeyM')bus.mark();if(event.code==='KeyR')setEnabled(!enabled);if(event.code==='KeyC')takeProfile('manual');if(event.code==='KeyL'){try{localStorage.setItem('al-map-performance-detail',mapPerformanceDetailEnabled()?'full':'optimized');}catch(error){saveError=String(error.message??error)}}paint();return;
  }
  const key=event.code??('Mouse'+event.button);if(['keydown','mousedown'].includes(event.type))held.add(key);if(['keyup','mouseup'].includes(event.type))held.delete(key);
  if(event.type==='pointerrawupdate'||event.type==='mousemove'){lastLook=performance.now();if(lastLook-lastInput<100)return;}updateActivity();
  if(!enabled||!document.pointerLockElement||performance.now()-lastInput<100)return;lastInput=performance.now();
  detailedCapture.event('browser-input-dispatch',{type:event.type,queueMs:Math.max(0,performance.now()-event.timeStamp),activity});
 }
 const observed=[];
 function observe(type,handler){if(!PerformanceObserver.supportedEntryTypes?.includes(type))return;const observer=new PerformanceObserver(list=>{if(enabled)for(const entry of list.getEntries())handler(entry)});observer.observe({type,buffered:false});observed.push(observer)}
 if(typeof PerformanceObserver==='function'){
  observe('longtask',entry=>detailedCapture.event('ui-long-task',{durationMs:entry.duration},entry.startTime));
  observe('long-animation-frame',entry=>detailedCapture.event('ui-long-frame',{durationMs:entry.duration,blockingMs:entry.blockingDuration,scripts:entry.scripts?.slice(0,5).map(s=>({file:s.sourceURL?.replace(location.origin,'').split('?')[0].slice(0,180),function:s.sourceFunctionName,durationMs:s.duration,forcedLayoutMs:s.forcedStyleAndLayoutDuration}))},entry.startTime));
  observe('resource',entry=>{const url=new URL(entry.name,location.origin);if(url.origin===location.origin&&/\.(glb|bin|ktx2|png|jpe?g|webp|avif|ogg|wav|mjs|js)$/.test(url.pathname))detailedCapture.event('asset-load',{file:url.pathname,durationMs:entry.duration,transferBytes:entry.transferSize},entry.startTime)});
 }
 const types=['keydown','keyup','mousedown','mouseup','onpointerrawupdate'in window?'pointerrawupdate':'mousemove'];
 for(const type of types)addEventListener(type,input,{capture:true,passive:type!=='keydown'});
 addEventListener('blur',()=>{held.clear();updateActivity();detailedCapture.event('window-blur')});
 document.addEventListener('visibilitychange',()=>detailedCapture.setVisible(!document.hidden));
 try{
  session=await desktop.start({columns:CAPTURE_COLUMNS,screen:{width:screen.width,height:screen.height,devicePixelRatio},settings:JSON.parse(localStorage.getItem('al-display-settings-v1')??'{}'),lowLatencyCanvas:globalThis.__aimWorkerLowLatency??null,measurement:'Detailed diagnostic run; compare multiple machines at their actual settings.'});
  if(disposed)return;setEnabled(true);notifyWorkers('configure');
  desktop.profile({action:'prepare'}).catch(error=>{cpuProfile={state:'error',error:String(error.message??error)}});
  desktop.onFlush(()=>{setEnabled(false);return bus.flush()});
  drainTimer=setInterval(()=>{updateActivity();detailedCapture.drain('checkpoint')},2000);uiTimer=setInterval(()=>{paint();profileTick()},1000);paint();
 }catch(error){saveError=String(error.message??error);enabled=false;paint()}
 addEventListener('pagehide',()=>{const packet=detailedCapture.drain('pagehide',false);if(packet)desktop.last(packet);disposed=true;clearInterval(uiTimer);clearInterval(drainTimer);for(const observer of observed)observer.disconnect();overlay?.remove()},{once:true});
}

installPerformanceMeter();
