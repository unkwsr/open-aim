// Brief V8 sampling only. Never enables Debugger or precise coverage, which can
// interfere with optimization. Samples are explicitly marked as instrumented.
const os=require('node:os');
exports.createSystemSampler=function({cpus=()=>os.cpus(),now=()=>Date.now()}={}){
 let previous=null;
 return()=>{
  const current=cpus(),at=now(),totals=current.map(cpu=>({idle:cpu.times.idle,total:Object.values(cpu.times).reduce((a,b)=>a+b,0)}));
  let busyPercent=null;
  if(previous&&previous.totals.length===totals.length){let total=0,idle=0;totals.forEach((t,i)=>{total+=t.total-previous.totals[i].total;idle+=t.idle-previous.totals[i].idle});if(total>0)busyPercent=100*(1-idle/total);}
  const values=current.map(cpu=>cpu.speed).filter(value=>Number.isFinite(value)&&value>0);
  const result={atMs:at,intervalMs:previous?at-previous.at:null,busyPercent,
   reportedCpuMHz:values.length?{min:Math.min(...values),max:Math.max(...values),mean:values.reduce((a,b)=>a+b,0)/values.length}:null,
   freeRamBytes:os.freemem(),note:'OS-reported CPU MHz may be nominal or stale; this is not a thermal/throttling measurement.'};
  previous={at,totals};return result;
 };
};

exports.createStartupProfiler=function({contents,save,now=()=>Date.now(),durationMs=4000,samplingIntervalUs=1000}){
 const debug=contents.debugger;
 let owned=false,initializing=null,current=null,lastStatus={state:'idle'},sequence=0,closed=false,disposing=null;
 const workers=new Map();
 function message(_event,method,params){
  if(method==='Target.attachedToTarget'&&params.targetInfo.type==='worker')workers.set(params.sessionId,params.targetInfo);
  if(method==='Target.detachedFromTarget')workers.delete(params.sessionId);
 }
 function detached(){owned=false;workers.clear();lastStatus={state:'unavailable',error:'Profiler detached (for example, DevTools was opened).'};}
 async function attach(){
  if(owned&&debug.isAttached())return;
  if(initializing)return initializing;
  initializing=(async()=>{
   if(debug.isAttached())throw Error('DevTools or another diagnostic already owns this debugger');
   debug.on('message',message);debug.on('detach',detached);debug.attach('1.3');owned=true;
   await debug.sendCommand('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:true});
  })().finally(()=>{initializing=null});return initializing;
 }
 function target(source){
  if(source==='renderer')return{sessionId:undefined,label:'renderer'};
  const entries=[...workers.entries()].filter(([,info])=>/worker-game-entry\.mjs(?:$|\?)|AimTrainer simulation and rendering/i.test(info.url+' '+info.title));
  if(entries.length!==1)throw Error(entries.length?'More than one gameplay worker is attached; retry in a single active drill':'Gameplay worker is not attached yet; retry in a moment');
  return{sessionId:entries[0][0],label:'worker',info:entries[0][1]};
 }
 async function finish(reason='complete'){
  const item=current;if(!item)return lastStatus;if(item.stopping)return item.stopping;
  clearTimeout(item.timer);
  item.stopping=(async()=>{
   try{
    await item.ready;
    const {profile}=await debug.sendCommand('Profiler.stop',{},item.sessionId);
    await debug.sendCommand('Profiler.disable',{},item.sessionId).catch(()=>{});
    const result=await save({name:item.name,profile,metadata:{format:1,source:item.label,reason,requested:item.context,startedAtMs:item.startedAtMs,endedAtMs:now(),samplingIntervalUs,instrumented:true,target:item.info?{type:item.info.type,url:item.info.url,title:item.info.title}:null}});
    lastStatus={state:'saved',name:item.name,...result};
   }catch(error){lastStatus={state:'error',name:item.name,error:String(error.message??error)};}
   finally{if(current===item)current=null;}
   return lastStatus;
  })();return item.stopping;
 }
 async function start(request={}){
  if(closed)throw Error('Profiler is closed');if(current)throw Error('A CPU profile is already running');
  const source=request.source==='worker'?'worker':'renderer';await attach();
  if(current)throw Error('A CPU profile is already running');
  const selected=target(source),startedAtMs=now(),name=`cpu-${++sequence}-${source}-${startedAtMs}`;
  // Reserve before asynchronous setup to reject overlapping requests.
  const item={...selected,name,startedAtMs,context:JSON.parse(JSON.stringify(request)),timer:null,stopping:null};current=item;
  item.ready=(async()=>{
   await debug.sendCommand('Profiler.enable',{},item.sessionId);
   await debug.sendCommand('Profiler.setSamplingInterval',{interval:samplingIntervalUs},item.sessionId);
   await debug.sendCommand('Profiler.start',{},item.sessionId);
  })();
  try{
   await item.ready;
   if(!item.stopping)item.timer=setTimeout(()=>finish(),durationMs);
   lastStatus={state:'recording',name,source,startedAtMs,durationMs,samplingIntervalUs};return lastStatus;
  }catch(error){current=null;await debug.sendCommand('Profiler.disable',{},item.sessionId).catch(()=>{});throw error;}
 }
 return{prepare:attach,start,status:()=>({...lastStatus}),finish,
  dispose(){if(disposing)return disposing;closed=true;disposing=(async()=>{await finish('window-closed');if(owned&&debug.isAttached())try{debug.detach()}catch{}debug.removeListener('message',message);debug.removeListener('detach',detached);workers.clear();})();return disposing;}
 };
};
