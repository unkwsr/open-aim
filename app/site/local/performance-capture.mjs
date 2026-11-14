import {attachGpuWaitDiagnostics} from './gpu-wait-diagnostics.mjs';
import {createMeshCapture} from './render-mesh-capture.mjs';
import {attachFirstUseResourceCapture} from './first-use-resource-capture.mjs';
// Fixed per-frame storage; no DOM, file I/O, blocking GPU reads or extra rAF loop.
export const CAPTURE_COLUMNS=Object.freeze(['atMs','frameId','segment','runAgeMs','intervalMs','running','simulationCpuMs','renderCpuMs','simulationSteps','gpuRetries','viewportCpuMs','mapCullingCpuMs','actorsCpuMs','drawCallsAllPasses','trianglesAllPasses','worldDrawCalls','worldTriangles','programs','textures','geometries','sectionsHidden','occlusionHidden','indexUpdateBytes','stepCpuMs','snapshotCpuMs','adsCpuMs','markersCpuMs','scoreCpuMs','statsCpuMs','ghostCpuMs','replayCpuMs','damageCpuMs','activityFlags','cameraX','cameraY','cameraZ','recordingRate','drawCpuMs','schedulerWaitMs','rafDeliveryLagMs','schedulerIdleMs','cameraYawDeg','cameraPitchDeg','mouseEvents','mousePageDelayMaxMs','mouseTransitMaxMs']);
const WIDTH=CAPTURE_COLUMNS.length,CAPACITY=4096;
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
export function summarizeFrames(frames,columns=CAPTURE_COLUMNS,{minRunAgeMs=0}={}){
 const at=name=>columns.indexOf(name),interval=at('intervalMs'),active=at('running');
 const values=[],cpu={},keys=['simulationCpuMs','renderCpuMs','viewportCpuMs','mapCullingCpuMs','actorsCpuMs','drawCpuMs','stepCpuMs','snapshotCpuMs','adsCpuMs','markersCpuMs','scoreCpuMs','statsCpuMs','ghostCpuMs','replayCpuMs','damageCpuMs'],indices=Object.fromEntries(keys.map(key=>[key,at(key)]));
 for(const key of keys)cpu[key]={total:0,max:0};
 let count=0,ticks=0,retries=0;
 for(let row=0;row<frames.length;row+=columns.length){
  if(!frames[row+active]||minRunAgeMs&&frames[row+at('runAgeMs')]<minRunAgeMs)continue;count++;const dt=frames[row+interval];if(dt>0)values.push(dt);
  for(const key of keys){if(indices[key]<0)continue;const value=frames[row+indices[key]];cpu[key].total+=value;cpu[key].max=Math.max(cpu[key].max,value);}
  ticks+=frames[row+at('simulationSteps')];retries+=frames[row+at('gpuRetries')];
 }
 values.sort((a,b)=>a-b);const total=values.reduce((a,b)=>a+b,0),q=p=>values.length?values[Math.min(values.length-1,Math.ceil(values.length*p)-1)]:null;
 const low=fraction=>{if(values.length<Math.ceil(1/fraction))return null;const n=Math.ceil(values.length*fraction),sum=values.slice(-n).reduce((a,b)=>a+b,0);return sum?1000*n/sum:null;};
 return{frames:count,intervals:values.length,fps:total?1000*values.length/total:null,p50Ms:q(.5),p95Ms:q(.95),p99Ms:q(.99),worstMs:values.at(-1)??null,onePercentLow:low(.01),pointOnePercentLow:low(.001),
  intervalsOverBudget:Object.fromEntries([240,144,120,90,70,60].map(fps=>[fps,values.filter(ms=>ms>1000/fps).length])),
  cpu:Object.fromEntries(keys.map(key=>[key,{meanMs:count&&indices[key]>=0?cpu[key].total/count:null,maxMs:indices[key]>=0?cpu[key].max:null}])),simulationSteps:ticks,simulationCpuMsPerStep:ticks?cpu.simulationCpuMs.total/ticks:null,stepCpuMsPerStep:ticks?cpu.stepCpuMs.total/ticks:null,gpuRetries:retries};
}

export function createGpuSampler(gl,{now=()=>performance.now(),intervalMs=200,onSample=()=>{}}={}){
 let extension=null,pending=[],active=null,last=-Infinity,disabled=false,status='unsupported',disjointSamples=0;
 try{extension=gl.getExtension('EXT_disjoint_timer_query_webgl2');if(extension)status='available'}catch{}
 function clear(){for(const item of pending)gl.deleteQuery(item.query);pending=[];}
 function poll(){
  if(!extension||disabled||gl.isContextLost?.())return;
  try{
   if(gl.getParameter(extension.GPU_DISJOINT_EXT)){disjointSamples+=pending.length;clear();return;}
   for(let i=pending.length-1;i>=0;i--){const item=pending[i];if(!gl.getQueryParameter(item.query,gl.QUERY_RESULT_AVAILABLE))continue;
    const ns=gl.getQueryParameter(item.query,gl.QUERY_RESULT);gl.deleteQuery(item.query);pending.splice(i,1);
    if(Number.isFinite(ns)&&ns>=0)onSample({frameId:item.frameId,atMs:item.atMs,gpuMs:ns/1e6,deliveredMs:now()});
   }
  }catch{disabled=true;status='query-error';try{clear()}catch{}}
 }
 return{
  begin(frameId){
   if(!extension||disabled||active||now()-last<intervalMs||gl.isContextLost?.())return false;
   last=now();poll();if(disabled||pending.length>=4)return false;
   try{if(gl.getQuery(extension.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))return false;const query=gl.createQuery();if(!query)return false;gl.beginQuery(extension.TIME_ELAPSED_EXT,query);active={query,frameId,atMs:now()};return true}catch{disabled=true;status='query-error';return false}
  },
  end(){if(!active)return;const item=active;active=null;try{gl.endQuery(extension.TIME_ELAPSED_EXT);pending.push(item)}catch{disabled=true;status='query-error';try{gl.deleteQuery(item.query)}catch{}}},
  poll,snapshot:()=>({status,pending:pending.length,disjointSamples,sampleIntervalMs:intervalMs}),
  dispose(){if(active){try{gl.endQuery(extension.TIME_ELAPSED_EXT);gl.deleteQuery(active.query)}catch{}active=null}try{clear()}catch{}}
 };
}

export function createDetailedCapture({now=()=>performance.now(),timeOrigin=performance.timeOrigin,source='renderer'}={}){
 const streamId=globalThis.crypto?.randomUUID?.()??`${Math.round(timeOrigin)}-${now().toFixed(3)}`;
 let enabled=false,visible=true,sink=null,storage=new Float64Array(CAPACITY*WIDTH),count=0,frameId=0,segment=0,previous=0,runStart=0,wasRunning=false,lastFlush=now(),lastSummary=null,contextProvider=()=>({}),disposed=false;
 const phaseParts={mapCullingCpuMs:0,actorsCpuMs:0,drawCpuMs:0},tickParts={step:0,snapshot:0,ads:0,markers:0,score:0,stats:0,ghost:0,replay:0,damage:0},tickKeys=Object.keys(tickParts),row=new Float64Array(WIDTH);
 let tick=0,render=0,steps=0,retries=0,draws=0,triangles=0,worldDraws=0,worldTriangles=0,viewportMs=0,activity=0,schedulerWait=0,rafLag=-1,schedulerIdle=0;
 let gpu=null,events=[],gpuSamples=[],droppedFrames=0,droppedEvents=0,latestCounters={};
 function resetWork(){tick=render=steps=retries=draws=triangles=worldDraws=worldTriangles=viewportMs=0;phaseParts.mapCullingCpuMs=phaseParts.actorsCpuMs=phaseParts.drawCpuMs=0;for(let i=0;i<tickKeys.length;i++)tickParts[tickKeys[i]]=0;if(enabled)globalThis.__aimTickParts=tickParts;}
 function event(kind,details={},atMs=now()){if(!enabled)return;if(events.length<512)events.push({kind,atMs,details});else droppedEvents++;}
 function drain(reason='checkpoint',deliver=true){
  if(disposed)return null;
  if(reason==='checkpoint'&&now()-lastFlush<2000)return null;
  gpu?.poll();if(!count&&!events.length&&!gpuSamples.length&&reason==='checkpoint')return null;
  const frames=storage.slice(0,count*WIDTH);lastSummary=summarizeFrames(frames);
  // Native settings may be Vue proxies, which Electron IPC cannot clone.
  let context={};try{context=JSON.parse(JSON.stringify(contextProvider()))}catch{}
  const packet={format:1,source,streamId,timeOrigin,reason,atMs:now(),columns:CAPTURE_COLUMNS,frames,summary:lastSummary,context,gpu:gpu?.snapshot()??{status:'not-attached'},gpuSamples,events,droppedFrames,droppedEvents};
  count=0;events=[];gpuSamples=[];lastFlush=now();
  if(sink&&deliver)try{sink(packet)}catch{}
  return packet;
 }
 const api={
  get enabled(){return enabled},get frameId(){return frameId},get source(){return source},
  configure(value,delivery){if(delivery)sink=delivery;if(enabled===!!value)return;enabled=!!value;previous=0;wasRunning=false;runStart=0;schedulerWait=0;rafLag=-1;schedulerIdle=0;resetWork();globalThis.__aimTickParts=enabled?tickParts:null;if(!enabled)drain('recording-paused');else event('recording-start');},
  setContext(provider){contextProvider=provider;segment++;event('context-change',{segment});},
  attachGpu(value){gpu?.dispose();gpu=value;},
  measure(name,ms){if(enabled)phaseParts[name]=(phaseParts[name]??0)+finite(ms);},
  draw(ms,calls,tris,world=false){if(!enabled)return;phaseParts.drawCpuMs=(phaseParts.drawCpuMs??0)+ms;draws+=finite(calls);triangles+=finite(tris);if(world){worldDraws+=finite(calls);worldTriangles+=finite(tris);}},
  viewport(ms){if(enabled)viewportMs+=ms},
  work(tickMs,renderMs,ticks,gpuRetries,counters){if(!enabled)return;tick=finite(tickMs);render=finite(renderMs);steps=finite(ticks);retries=finite(gpuRetries);latestCounters=counters??{};},
  setActivity(flags){activity=flags},event,
  scheduling(wait,lag,idle){if(enabled){schedulerWait=wait;rafLag=lag;schedulerIdle=idle;}},
  setVisible(value){visible=!!value;previous=0;event('visibility',{visible});if(!visible)api.stop();},
  gpuSample(sample){if(enabled&&gpuSamples.length<128)gpuSamples.push(sample)},
  frame(at,running,cap,nth){
   if(!enabled||disposed)return;
   const stamp=now(),active=!!running&&visible;
   if(active!==wasRunning){previous=0;if(active){runStart=stamp;segment++;event('gameplay-start',{segment,cap,nth},stamp)}else event('gameplay-stop',{segment},stamp);wasRunning=active;}
   if(!active){resetWork();if(count)drain('gameplay-stop');else if(stamp-lastFlush>=2000)drain('checkpoint');return;}
   const dt=active&&previous?Math.max(0,stamp-previous):0;previous=active?stamp:0;
   if(count>=CAPACITY){if(sink)drain('capacity');else{droppedFrames+=count;count=0;}}
   let context={};try{context=api.frameContext?.()??{}}catch{}
   const tp=globalThis.__aimTickParts??{},c=latestCounters;
   row[0]=stamp;row[1]=frameId++;row[2]=segment;row[3]=active?stamp-runStart:0;row[4]=dt;row[5]=active?1:0;
   row[6]=tick;row[7]=render;row[8]=steps;row[9]=retries;row[10]=viewportMs;row[11]=phaseParts.mapCullingCpuMs;row[12]=phaseParts.actorsCpuMs;
   row[13]=draws;row[14]=triangles;row[15]=worldDraws;row[16]=worldTriangles;row[17]=finite(c.programs);row[18]=finite(c.textures);row[19]=finite(c.geometries);
   row[20]=finite(context.hidden);row[21]=finite(context.occlusionHidden);row[22]=finite(context.indexUploadBytes);
   row[23]=finite(tp.step);row[24]=finite(tp.snapshot);row[25]=finite(tp.ads);row[26]=finite(tp.markers);row[27]=finite(tp.score);row[28]=finite(tp.stats);row[29]=finite(tp.ghost);row[30]=finite(tp.replay);row[31]=finite(tp.damage);
   row[32]=api.activityProvider?.()??activity;row[33]=finite(context.x);row[34]=finite(context.y);row[35]=finite(context.z);row[36]=finite(globalThis.__aimRecordingClock?.rate,1);row[37]=phaseParts.drawCpuMs;
   row[38]=schedulerWait;row[39]=rafLag;row[40]=schedulerIdle;/* camera-angle-log-v1 */row[41]=finite(context.yaw);row[42]=finite(context.pitch);/* mouse-timing-log-v1 */{const m=globalThis.__aimMouseFrame;row[43]=m?m.n:0;row[44]=m?finite(m.page):0;row[45]=m?finite(m.transit):0;if(m){m.n=0;m.page=0;m.transit=0;}}
   storage.set(row,count++*WIDTH);resetWork();
   if(stamp-lastFlush>=2000)drain('checkpoint');else if(!active&&count)drain('gameplay-stop');
  },
  stop(){if(!enabled)return;wasRunning=false;previous=0;event('loop-stop');drain('loop-stop');},
  drain,latest:()=>lastSummary,
  dispose(){drain('dispose');gpu?.dispose();disposed=true;enabled=false;globalThis.__aimTickParts=null;}
 };
 return api;
}

export const detailedCapture=globalThis.__aimDetailedPerformance??=createDetailedCapture({source:typeof document==='undefined'?'worker':'renderer'});

export function attachDetailedViewport(stage,settings){
 const capture=detailedCapture,renderer=stage.renderer;
 if(!renderer||stage.__detailedCaptureAttached)return stage;stage.__detailedCaptureAttached=true;
 const original={render:stage.render,setMapVisual:stage.setMapVisual,dispose:stage.dispose,draw:renderer.render};
 const releaseGpuWait=attachGpuWaitDiagnostics(stage,capture);
 const releaseResources=attachFirstUseResourceCapture(renderer,capture,()=>settings.phase?.current==='running');
 const captureMeshes=createMeshCapture(capture);
 let gpu=null,mapId='',mapDetail=null,drawIndex=0,graphics={};
 function setupGpu(){if(gpu)return;const gl=renderer.getContext();gpu=createGpuSampler(gl,{onSample:sample=>capture.gpuSample(sample)});capture.attachGpu(gpu);
  try{const ext=gl.getExtension('WEBGL_debug_renderer_info');graphics={vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),attributes:gl.getContextAttributes()}}catch{}
 }
 const snapshot=()=>{const state=stage.__aimDetailedSnapshot?.();return{source:capture.source,map:mapId,phase:settings.phase?.current,canvas:{width:stage.canvas?.width,height:stage.canvas?.height},graphics,
  scene:state?{tick:state.tick,actors:state.actors?.length,alive:state.actors?.filter(a=>a.alive).length,visible:state.actors?.filter(a=>a.alive&&a.visible).length}:null,
  settings:Object.fromEntries(['renderScale','renderResolution','aspectRatio','renderEveryNthFrame','frameMode','maxFps','lowLatency','shadows','viewModel','tracers','flashLook'].map(k=>[k,settings[k]?.current])),
  pacing:globalThis.__aimWorkerScheduler?.paced===undefined?'native':globalThis.__aimWorkerScheduler.paced?'display-paced':'unlimited',
  mapDetail,antiAliasing:stage.antiAliasingStats?.(),gpuQueue:stage.gpuQueueStats?.(),mapCulling:stage.mapSectionVisibility?.snapshot(),corrodeRanges:stage.corrodeRangeVisibility?.snapshot(),mapInstances:stage.mapInstanceVisibility?.snapshot(),botCulling:globalThis.__aimBotVisibility?.snapshot(stage.camera),heap:performance.memory?{usedBytes:performance.memory.usedJSHeapSize,totalBytes:performance.memory.totalJSHeapSize,limitBytes:performance.memory.jsHeapSizeLimit}:null}};
 capture.setContext(snapshot);
 const frameData={};capture.frameContext=()=>{const stats=stage.mapSectionVisibility?.metrics,p=stage.camera.position;frameData.hidden=stats?.hidden;frameData.occlusionHidden=stats?.occlusionHidden;frameData.indexUploadBytes=stats?.indexUploadBytes;frameData.x=p.x;frameData.y=p.y;frameData.z=p.z;/* camera-angle-log-v1: view direction in degrees (yaw around up, pitch up/down) for aim smoothness checks */const q=stage.camera.quaternion,fx=-2*(q.x*q.z+q.w*q.y),fy=-2*(q.y*q.z-q.w*q.x),fz=-(1-2*(q.x*q.x+q.y*q.y));frameData.yaw=Math.atan2(-fx,-fz)*180/Math.PI;frameData.pitch=Math.asin(Math.max(-1,Math.min(1,fy)))*180/Math.PI;return frameData};
 stage.setMapVisual=function(map){mapId=map?.name??'';mapDetail=map?.userData?.mapPerformanceDetail??null;capture.event('map',{map:mapId,mapDetail});return original.setMapVisual.call(stage,map)};
 renderer.render=function(...args){if(!capture.enabled||settings.phase?.current!=='running')return original.draw.apply(renderer,args);const world=drawIndex===0;renderer.__aimMeshTraceEnabled=world&&mapId.startsWith('map:');const at=performance.now();try{return original.draw.apply(renderer,args)}finally{const ms=performance.now()-at;capture.draw(ms,renderer.info.render.calls,renderer.info.render.triangles,drawIndex++===0);renderer.__aimMeshTraceEnabled=false;if(world)captureMeshes(renderer,stage.camera,ms,mapId)}};
 stage.render=function(){if(!capture.enabled||settings.phase?.current!=='running')return original.render.call(stage);setupGpu();drawIndex=0;const at=performance.now(),queried=gpu.begin(capture.frameId);try{return original.render.call(stage)}finally{if(queried)gpu.end();capture.viewport(performance.now()-at)}};
 stage.dispose=function(){capture.stop();releaseResources();releaseGpuWait();gpu?.dispose();renderer.render=original.draw;return original.dispose.call(stage)};
 return stage;
}
