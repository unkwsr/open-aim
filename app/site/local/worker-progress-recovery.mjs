// Called by the UI's existing 16 ms settings timer. There is no extra timer,
// rAF loop, or queue of pulses when a worker is busy or suspended.
export function createWorkerProgressRecovery({send,now=()=>performance.now(),timeoutMs=24}={}){
 let lastProgress=now(),lastAttempt=-Infinity,pending=false,running=false;
 return{
  progress(){lastProgress=now();},
  acknowledge(){pending=false;},
  phase(value){running=value==='running';lastProgress=now();},
  tick({ready,paced,visible}){
   const at=now();if(!running||!ready||!paced||!visible||pending||at-lastProgress<timeoutMs||at-lastAttempt<timeoutMs)return false;
   pending=true;lastAttempt=at;send({type:'scheduler-pulse'});return true;
  },
 };
}
