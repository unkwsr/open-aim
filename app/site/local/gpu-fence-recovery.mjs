// A paced worker may probe past one stalled advisory fence episode. Deleting
// sync objects does NOT cancel GPU work. Require subsequent real completions
// and a cooldown before another probe; never turn this into an uncapped queue.
export function attachGpuFenceRecovery(stage,{enabled=()=>false,frameMs=()=>1000/60,now=()=>performance.now(),capture=()=>globalThis.__aimDetailedPerformance,cooldownMs=2000}={}){
 if(typeof stage.gpuReady!=='function'||typeof stage.recoverGpuQueue!=='function')return()=>{};
 const ready=stage.gpuReady,dispose=stage.dispose;let blockedAt=null,lastRecovery=-Infinity,completionAtRecovery=-1,suppressed=false;
 stage.gpuReady=function(){
  const ok=ready.call(stage),time=now();if(ok){blockedAt=null;suppressed=false;return true;}
  if(!enabled()){blockedAt=null;return false;}
  if(blockedAt===null)blockedAt=time;
  const period=frameMs(),budgetMs=Math.min(80,Math.max(16,(Number.isFinite(period)&&period>0?period:1000/60)*4));
  const waitMs=time-blockedAt;if(waitMs<budgetMs)return false;
  const stats=stage.gpuQueueStats?.(),progress=stats?.completed??0,meter=capture();
  if(time-lastRecovery<cooldownMs||completionAtRecovery>=0&&progress<=completionAtRecovery){
   if(!suppressed&&meter?.enabled)meter.event('gpu-fence-recovery-suppressed',{waitMs,budgetMs,stats,reason:progress<=completionAtRecovery?'no-new-completion':'cooldown'});
   suppressed=true;return false;
  }
  const discarded=stage.recoverGpuQueue();if(!(discarded>0))return false;
  lastRecovery=time;completionAtRecovery=progress;blockedAt=null;suppressed=false;
  if(meter?.enabled)meter.event('gpu-fence-recovery',{waitMs,budgetMs,discarded,stats,cooldownMs,note:'advisory fence reset; GPU work is not cancelled'});
  return true;
 };
 const release=()=>{stage.gpuReady=ready;blockedAt=null;};
 if(typeof dispose==='function')stage.dispose=function(){release();return dispose.call(stage);};
 return release;
}
