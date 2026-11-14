// OffscreenCanvas submissions need an opportunity to reach Chromium's display
// compositor. Keep Unlimited available for an immediate in-game comparison.
export function createWorkerScheduler({raf,cancelRaf,channel=new MessageChannel(),now=()=>performance.now(),timer=setTimeout,clear=clearTimeout,visible=()=>globalThis.document?.visibilityState!=='hidden'}){
 let paced=true,sequence=0,lastFinished=0,lastRafAt=null,refreshMs=1000/60,recoveries=0,lastRecoveryAt=-Infinity,lastGapEvent=-Infinity;
 const pending=new Map();let lastStamp=-Infinity;
 const release=item=>{if(item.frame!==null)cancelRaf(item.frame);if(item.timer!==null)clear(item.timer);if(item.watchdog!==null)clear(item.watchdog);};
 const fire=(id,rafAt,recovery=false)=>{
  const item=pending.get(id);if(!item)return;
  // A delayed display event can arrive immediately after timer recovery. Keep
  // the next request for the following display event instead of bursting twice.
  if(Number.isFinite(rafAt)&&now()-lastRecoveryAt<Math.max(1,refreshMs*.5)){item.frame=raf(at=>fire(id,at));return;}
  pending.delete(id);
  release(item);
  if(Number.isFinite(rafAt)){
   const delta=lastRafAt===null?0:rafAt-lastRafAt;lastRafAt=rafAt;recoveries=0;
   // Follow real callbacks across refresh rates. Do not learn a long stall as
   // the display period, or assume every player has the developer's 240 Hz.
   if(delta>=2&&delta<=50)refreshMs+=.2*(Math.min(delta,refreshMs*1.25)-refreshMs);
  }else if(recovery){lastRecoveryAt=now();if(++recoveries>=3){refreshMs=1000/60;lastRafAt=null;}}
  const capture=globalThis.__aimDetailedPerformance,measuring=capture?.enabled;
  if(measuring){const started=now(),idleMs=lastFinished?Math.max(0,started-lastFinished):0;capture.scheduling?.(Math.max(0,started-item.queuedAt),Number.isFinite(rafAt)?Math.max(0,started-rafAt):-1,idleMs);
   // Reuse existing callbacks; no heartbeat timer or profiler. A route tells us
   // what delivered this callback, not why Chromium/OS delayed its execution.
   if(lastFinished&&idleMs>=Math.max(16,item.expectedRefreshMs*2.5)&&started-lastGapEvent>=1000){lastGapEvent=started;capture.event?.('scheduler-callback-gap',{route:Number.isFinite(rafAt)?'raf':recovery===true?'watchdog':recovery||'message',paced,displayFrame:item.displayFrame,requestedDelayMs:item.requestedDelayMs,queueWaitMs:Math.max(0,started-item.queuedAt),idleMs,delayTimerLateMs:item.delayTimerLateMs,expectedRefreshMs:item.expectedRefreshMs});}
  }
  if(recovery&&measuring){const at=now(),idleMs=Math.max(0,at-Math.max(item.queuedAt,lastFinished));capture.event?.('scheduler-recovery',{trigger:recovery===true?'watchdog':recovery,waitMs:Math.max(0,at-item.queuedAt),idleMs,timerLateMs:recovery===true?Math.max(0,idleMs-Math.max(8,item.expectedRefreshMs*2+1)):null,expectedRefreshMs:item.expectedRefreshMs});}
  // Hand the game the display frame's time, not the moment this callback got to run: the game
  // advances bots by the gap between these stamps, and callback timing wandered ~10% around the
  // refresh period (2026-11-07 drill log), so bots moved unevenly per shown frame. Never backwards.
  let stamp=Number.isFinite(rafAt)?rafAt:now();if(stamp<lastStamp)stamp=lastStamp;lastStamp=stamp;
  /* shared-mouse-v1: apply mouse movement the page wrote since the last frame (worker-game-entry.mjs drainMouse) */
  try{globalThis.__aimDrainMouse?.(stamp,item.displayFrame?'frame':'pull')}catch(error){console.warn('shared mouse:',error)}
  try{item.callback(stamp)}finally{lastFinished=now();}
 };
 channel.port1.onmessage=({data:id})=>fire(id);
 function schedule(callback,delay=0,displayFrame=true){
  const id=++sequence,item={callback,frame:null,timer:null,watchdog:null,queuedAt:now(),displayFrame,expectedRefreshMs:refreshMs,requestedDelayMs:delay,delayTimerLateMs:0};pending.set(id,item);
  const enqueue=()=>{item.timer=null;if(delay>0)item.delayTimerLateMs=Math.max(0,now()-item.queuedAt-delay);if(!pending.has(id))return;if(paced&&displayFrame){
   item.frame=raf(at=>fire(id,at));
   // Chromium can suppress worker rAF while an OffscreenCanvas has pending
   // presentation frames. A visible game must not depend solely on that path.
   // Race one recovery timer; the winning route cancels the other atomically.
   const watchdogMs=Math.max(8,refreshMs*2+1);
   const recover=()=>{item.watchdog=null;if(!pending.has(id)||!visible())return;
    // Requests are queued at callback entry. Its own simulation/render work
    // must not consume the recovery deadline and cause an immediate burst.
    const remaining=watchdogMs-(now()-Math.max(item.queuedAt,lastFinished));
    if(remaining>0){item.watchdog=timer(recover,Math.max(1,remaining));return;}
    fire(id,undefined,true);
   };
   item.watchdog=timer(recover,watchdogMs);
  }else channel.port2.postMessage(id)};
  if(delay>0)item.timer=timer(enqueue,delay);else enqueue();return id;
 }
 return{
  // Yield on every GPU retry. Tight MessageChannel polling can repeatedly see
  // Chromium's cached fence status without advancing readiness. The message
  // after the timer also avoids recursively nesting timers (4 ms clamp).
  now,requestFrame:callback=>schedule(callback),deferFrame:(callback,delay=0)=>schedule(callback,Math.max(1,delay),false),
  recoverPendingFrame(){
   if(!paced||!visible())return false;
   const at=now();for(const [id,item]of pending){
    // Never bypass a deferred GPU check/frame-cap timer or the callback's own
    // work. Only rescue an overdue display request; fire cancels both rivals.
    if(!item.displayFrame||item.frame===null||at-Math.max(item.queuedAt,lastFinished)<Math.max(8,item.expectedRefreshMs*2+1))continue;
    fire(id,undefined,'host-progress');return true;
   }return false;
  },
  cancelFrame(id){const item=pending.get(id);if(!item)return;pending.delete(id);release(item)},
  setPaced(value){if(paced===!!value)return;paced=!!value;lastRafAt=null;refreshMs=1000/60;recoveries=0;lastRecoveryAt=-Infinity;if(!paced)for(const[id,item]of pending)if(item.displayFrame&&item.frame!==null){release(item);item.frame=item.timer=item.watchdog=null;channel.port2.postMessage(id);}},get paced(){return paced},get displayIntervalMs(){return refreshMs},
 };
}
