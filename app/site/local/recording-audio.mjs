// Scoped Web Audio time domain for recording. Native context stays real-time.
// Game code sees game seconds; pitch/rates, envelopes and cue deadlines scale.
import {gameClock} from './recording-clock.mjs';
const nativeOf=new WeakMap();
const unwrap=value=>nativeOf.get(value)??value;
export function wrapRecordingContext(context,clock=gameClock){
 let realAnchor=context.currentTime,gameAnchor=realAnchor,rate=clock.rate;
 const now=()=>gameAnchor+(context.currentTime-realAnchor)*rate;
 const realTime=game=>context.currentTime+Math.max(0,game-now())/rate;
 const params=new Set(),sources=new Set(),timers=new Set(),nodes=new WeakMap();
 const defer=(at,callback)=>{const job={at,callback,id:null};timers.add(job);arm(job);return()=>{clearTimeout(job.id);timers.delete(job)}};
 function arm(job){clearTimeout(job.id);job.id=setTimeout(()=>{if(job.at>now()+.0001){arm(job);return}timers.delete(job);job.callback()},Math.max(0,(job.at-now())/rate*1000))}
 const multiplier=kind=>kind==='frequency'||kind==='playbackRate'?rate:['delayTime','attack','release'].includes(kind)?1/rate:1;
 function param(raw,kind){
  const events=[],initial=raw.value;let base=initial;
  function valueAt(t){let value=base,at=-Infinity,target=null;for(const e of events){if(e.type==='cancel')continue;
   if(e.type==='linearRampToValueAtTime'||e.type==='exponentialRampToValueAtTime'){
    if(t<e.at){if(!Number.isFinite(at))return value;const u=Math.max(0,Math.min(1,(t-at)/(e.at-at)));return e.type[0]==='l'?value+(e.value-value)*u:value*Math.pow(e.value/value,u)}value=e.value;at=e.at;target=null;
   }else if(e.at>t)break;else{if(target)value=target.value+(value-target.value)*Math.exp(-(e.at-at)/target.tc);at=e.at;if(e.type==='setTargetAtTime')target={value:e.value,tc:e.tc};else{value=e.value;target=null}}
  }if(target)return target.value+(value-target.value)*Math.exp(-(t-at)/target.tc);return value}
  function emit(e){const at=realTime(e.at),m=multiplier(kind);if(e.type==='setTargetAtTime')raw.setTargetAtTime(e.value*m,at,e.tc/rate);else raw[e.type](e.value*m,at)}
  function compact(){
   if(events.length<128)return;
   const at=now(),value=valueAt(at),previous=events.findLast(e=>e.at<=at),future=events.filter(e=>e.at>at);
   events.length=0;events.push({type:'setValueAtTime',value,at});
   if(previous?.type==='setTargetAtTime')events.push({...previous,at});
   events.push(...future);
  }
  const state={raw,kind,rebuild(){const t=now(),v=valueAt(t);raw.cancelScheduledValues(context.currentTime);raw.setValueAtTime(v*multiplier(kind),context.currentTime);let previous=null;for(const e of events){if(e.at>t)emit(e);else previous=e}if(previous?.type==='setTargetAtTime')raw.setTargetAtTime(previous.value*multiplier(kind),context.currentTime,previous.tc/rate)}};
  params.add(state);
  const proxy=new Proxy(raw,{get(target,key){
   if(key==='value')return valueAt(now());
   if(['setValueAtTime','linearRampToValueAtTime','exponentialRampToValueAtTime','setTargetAtTime'].includes(key))return(value,at,tc)=>{compact();const e={type:key,value,at,tc};events.push(e);events.sort((a,b)=>a.at-b.at);emit(e);return proxy};
   if(key==='cancelScheduledValues'||key==='cancelAndHoldAtTime')return at=>{const held=valueAt(at);for(let i=events.length-1;i>=0;i--)if(events[i].at>=at)events.splice(i,1);target[key]?.(realTime(at));if(key==='cancelAndHoldAtTime'){events.push({type:'setValueAtTime',value:held,at});target.setValueAtTime(held*multiplier(kind),realTime(at))}return proxy};
   if(key==='setValueCurveAtTime')return(values,at,duration)=>{for(let i=0;i<values.length;i++)proxy[i?'linearRampToValueAtTime':'setValueAtTime'](values[i],at+duration*i/(values.length-1));return proxy};
   const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;
  },set(target,key,value){if(key==='value'){base=value;target.value=value*multiplier(kind);return true}return Reflect.set(target,key,value,target)}});
  nativeOf.set(proxy,raw);state.rebuild();return{proxy,state};
 }
 function node(raw){
  if(nodes.has(raw))return nodes.get(raw);
  const owned=[],cache=new Map();let startCancel=null,stopCancel=null,started=false,ended=false;
  const source=typeof raw.start==='function';
  const proxy=new Proxy(raw,{get(target,key){
   if(key==='context')return api;
   if(key==='connect')return(destination,...args)=>{for(const p of owned)params.add(p);const result=target.connect(unwrap(destination),...args);return result===unwrap(destination)?destination:result};
   if(key==='disconnect')return(...args)=>{target.disconnect(...args.map(unwrap));if(!args.length)for(const p of owned)params.delete(p)};
   if(source&&key==='start')return(at=0,offset=0,duration)=>{if(started)throw new DOMException('Source already started','InvalidStateError');started=true;const begin=()=>{if(ended)return;if('buffer'in target){target.start(0,offset);if(duration!==undefined)stopCancel=defer(now()+duration,()=>target.stop())}else target.start()};if(at<=now())begin();else startCancel=defer(at,begin)};
   if(source&&key==='stop')return(at=0)=>{stopCancel?.();const stop=()=>{ended=true;startCancel?.();try{target.stop()}catch{};for(const s of owned)params.delete(s);sources.delete(raw)};if(at<=now())stop();else stopCancel=defer(at,stop)};
   const v=Reflect.get(target,key,target);
   if(v&&typeof v.setValueAtTime==='function'){
    if(!cache.has(key)){const item=param(v,key);cache.set(key,item.proxy);owned.push(item.state)}return cache.get(key);
   }
   return typeof v==='function'?((...args)=>v.apply(target,args.map(unwrap))):v;
  },set(target,key,value){return Reflect.set(target,key,value,target)}});
  nativeOf.set(proxy,raw);nodes.set(raw,proxy);
  // Install rate/frequency scaling even when callers never assign the parameter.
  for(const key of ['playbackRate','frequency','delayTime','attack','release'])if(raw[key]&&typeof raw[key].setValueAtTime==='function')void proxy[key];
  if(source){sources.add(raw);raw.addEventListener('ended',()=>{ended=true;for(const p of owned)params.delete(p);sources.delete(raw)},{once:true})}
  return proxy;
 }
 const api=new Proxy(context,{get(target,key){
  if(key==='currentTime')return now();
  if(key==='close')return async()=>{unsubscribe();for(const t of timers)clearTimeout(t.id);timers.clear();params.clear();sources.clear();return target.close()};
  const value=Reflect.get(target,key,target);
  if(typeof value!=='function')return value;
  return(...args)=>{const result=value.apply(target,args.map(unwrap));return result&&typeof result.connect==='function'?node(result):result};
 }});
 nativeOf.set(api,context);
 const unsubscribe=clock.subscribe(()=>{const game=now();realAnchor=context.currentTime;gameAnchor=game;rate=clock.rate;for(const p of params)p.rebuild();for(const t of timers)arm(t)});
 return api;
}
export function installRecordingAudio(){
 if(typeof window==='undefined'||globalThis.__aimWorkerThread||globalThis.__aimRecordingAudio)return;
 globalThis.__aimRecordingAudio=true;
 for(const name of ['AudioContext','webkitAudioContext']){const Native=globalThis[name];if(!Native)continue;globalThis[name]=new Proxy(Native,{construct(Target,args){return wrapRecordingContext(new Target(...args))}})}
}
installRecordingAudio();
