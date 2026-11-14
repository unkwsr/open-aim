// Time actual readiness episodes, including all retry callbacks. Never changes
// queue limits, skips a fence, flushes commands or waits synchronously for GL.
export function attachGpuWaitDiagnostics(stage,capture,{now=()=>performance.now()}={}){
 if(typeof stage.gpuReady!=='function')return()=>{};
 const ready=stage.gpuReady;let began=null,checks=0,total=0,worst=0,before=null;
 stage.gpuReady=function(){
  if(!capture.enabled){began=null;return ready.call(stage);}
  const start=now(),ok=ready.call(stage),end=now(),cost=Math.max(0,end-start);
  if(!ok&&began===null){began=start;checks=0;total=0;worst=0;before=stage.gpuQueueStats?.()??null;}
  if(began!==null){checks++;total+=cost;worst=Math.max(worst,cost);
   if(ok){const durationMs=Math.max(0,end-began);if(durationMs>=8)capture.event('gpu-ready-wait',{durationMs,checks,checkCpuMs:total,maxCheckCpuMs:worst,before,after:stage.gpuQueueStats?.()??null});began=null;}
  }
  return ok;
 };
 return()=>{stage.gpuReady=ready;began=null;};
}
