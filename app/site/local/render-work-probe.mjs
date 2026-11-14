// Fixed storage while running; allocate event details only for a slow frame.
export function createRenderWorkProbe(capture,{now=()=>performance.now(),thresholdMs=8,minEventGapMs=1000}={}){
 const names=['actorSetup','effectsAndViewmodel','viewport','flashOverlay','presentation','hud'],times=new Float64Array(names.length);
 let active=false,start=0,last=0,index=0,lastEvent=-Infinity;
 return{
  begin(running=true){active=!!capture.enabled&&running;index=0;if(active)start=last=now();},
  mark(){if(!active)return;const at=now();times[index++]=at-last;last=at;},
  end(){if(!active)return;const at=now();times[index++]=at-last;const totalMs=at-start;active=false;if(totalMs<thresholdMs||at-lastEvent<minEventGapMs)return;lastEvent=at;const phases={};for(let i=0;i<Math.min(index,names.length);i++)phases[names[i]]=times[i];capture.event('render-work-gap',{totalMs,phases,note:'Elapsed scopes can include descheduling, GC or driver waits; they do not alone prove CPU work.'});},
 };
}
export function createLoadingWorkProbe(capture,scope,{now=()=>performance.now()}={}){
 const enabled=!!capture.enabled,start=enabled?now():0;let last=start;
 return(label)=>{if(!enabled)return;const at=now();capture.event('loading-work-stage',{scope,label,stageMs:at-last,totalMs:at-start});last=at;};
}
