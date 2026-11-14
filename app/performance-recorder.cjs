// Local, bounded, asynchronous diagnostic writes. Never accepts a file path.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
// Fingerprint the paths relevant to this investigation once per recording,
// outside gameplay. App version alone cannot identify experimental test builds.
exports.captureBuildFingerprint=async function(){
 const files=['main.js','worker-test-main.cjs','performance-recorder.cjs','site/next/js/OkAdunfX.js','site/_assets/r20261021-1/next/js/OkAdunfX.js','site/next/js/BiMsX6Xn.js','site/_assets/r20261021-1/next/js/BiMsX6Xn.js','site/next/js/CnrSARj_.js','site/_assets/r20261021-1/next/js/CnrSARj_.js','site/aim-maps/port.ropes.json','site/local/rope-attachment.mjs','site/local/firing-resource-preparation.mjs','site/local/equipment-preparation-queue.mjs','site/local/worker-game-scheduler.mjs','site/local/worker-game-entry.mjs','site/local/threaded-game-bridge.mjs','site/local/worker-progress-recovery.mjs','site/local/scene-resource-preparation.mjs','site/local/first-use-resource-capture.mjs','site/local/performance-capture.mjs','site/local/corrode-range-visibility.mjs','site/local/bone-render-traversal.mjs','site/local/map-instance-visibility.mjs','site/aim-ui/scenario-loading.mjs','site/next/js/Hwnlm6zD.js','site/_assets/r20261021-1/next/js/Hwnlm6zD.js','site/local/render-mesh-capture.mjs','site/local/map-section-visibility.mjs','site/local/live-actor-resources.mjs','site/local/loadout-warm-plan.mjs','site/local/jett-kit.mjs','site/aim-ads/warm-melee.mjs','site/next/js/DXHU7cEs.js','site/_assets/r20261021-1/next/js/DXHU7cEs.js','site/local/anti-aliasing.mjs'];
 const sources=await Promise.all(files.map(async file=>{try{return[file,crypto.createHash('sha256').update(await fs.readFile(path.join(__dirname,file))).digest('hex')]}catch{return[file,null]}}));
 return{scope:'startup-render-paths-v8',sha256:crypto.createHash('sha256').update(JSON.stringify(sources)).digest('hex'),sources:Object.fromEntries(sources)};
};
exports.createPerformanceStore=function({root,hardware=async()=>({}),processMetrics=()=>[],clock=()=>Date.now()}){
 const sessions=new Map();
 async function statusFile(directory,value){const file=path.join(directory,'status.json'),temporary=file+'.tmp';await fs.writeFile(temporary,JSON.stringify(value,null,2));await fs.rename(temporary,file);}
 async function begin(owner,description={}){
  if(sessions.has(owner))await end(owner,'replaced');
  const id=new Date(clock()).toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex');
  const directory=path.join(root,id);await fs.mkdir(directory,{recursive:true});
  const state={id,directory,queue:Promise.resolve(),offsets:{},packets:0,bytes:0,error:null,metricAt:0,ended:false};
  const metadata={format:1,id,startedAt:new Date(clock()).toISOString(),description,
   cpu:{model:os.cpus()[0]?.model,logicalProcessors:os.cpus().length},ramBytes:os.totalmem(),
   system:{platform:os.platform(),release:os.release(),arch:os.arch()},timing:{systemUptimeSeconds:os.uptime(),mainProcessUptimeSeconds:process.uptime()},build:await exports.captureBuildFingerprint(),hardware:await hardware(),
   notes:['Frame intervals are render submissions, not monitor scanouts or physical input latency.',
    'GPU timing is sampled asynchronously; unsupported/disjoint samples are unavailable, not zero.',
    'Simulation step combines physics and bot logic. CPU process totals include all renderer threads.',
    'Raw frame files are little-endian Float64 rows; column names are in schema.json.']};
  await fs.writeFile(path.join(directory,'metadata.json'),JSON.stringify(metadata,null,2));
  sessions.set(owner,state);return{id,directory};
 }
 function append(owner,packet){
  const s=sessions.get(owner);if(!s||s.ended)return Promise.reject(Error('No active performance recording'));
  if(!packet||!['renderer','worker'].includes(packet.source))return Promise.reject(Error('Invalid capture source'));
  const frames=packet.frames;
  if(!(frames instanceof Float64Array)||frames.byteLength>4*1024*1024||!Array.isArray(packet.columns)||packet.columns.length<1||packet.columns.length>80||frames.length%packet.columns.length)return Promise.reject(Error('Invalid frame payload'));
  const safe={...packet,timing:{systemUptimeSeconds:os.uptime(),mainProcessUptimeSeconds:process.uptime()}};delete safe.frames;
  if(JSON.stringify(safe).length>512*1024)return Promise.reject(Error('Capture metadata too large'));
  // Clone before queuing: callers cannot mutate data while a prior write awaits.
  const data=Buffer.from(new Uint8Array(frames.buffer,frames.byteOffset,frames.byteLength));
  s.queue=s.queue.then(async()=>{
   const source=packet.source,offset=s.offsets[source]??0;
   if(s.offsets[source]===undefined)await fs.writeFile(path.join(s.directory,source+'-schema.json'),JSON.stringify({format:1,type:'Float64LE',columns:packet.columns},null,2));
   if(clock()-s.metricAt>=2000){safe.processMetrics=processMetrics();safe.systemFreeRamBytes=os.freemem();s.metricAt=clock();}
   if(data.length)await fs.appendFile(path.join(s.directory,source+'-frames.f64'),data);
   safe.frameOffset=offset;safe.frameCount=frames.length/packet.columns.length;safe.savedAt=new Date(clock()).toISOString();
   await fs.appendFile(path.join(s.directory,'timeline.jsonl'),JSON.stringify(safe)+'\n');
   s.offsets[source]=offset+safe.frameCount;s.packets++;s.bytes+=data.length;
   await statusFile(s.directory,{id:s.id,active:!s.ended,packets:s.packets,frameCounts:s.offsets,frameBytes:s.bytes,updatedAt:safe.savedAt,error:s.error});
  }).catch(error=>{s.error=String(error.message);throw error;});
  return s.queue.then(()=>({id:s.id,packets:s.packets,frameBytes:s.bytes}));
 }
 function saveProfile(owner,{name,profile,metadata}){
  const s=sessions.get(owner);if(!s||s.ended)return Promise.reject(Error('No active performance recording'));
  if(!/^cpu-\d+-(worker|renderer)-\d+$/.test(name)||!Array.isArray(profile?.nodes))return Promise.reject(Error('Invalid CPU profile'));
  s.queue=s.queue.then(async()=>{
   await fs.writeFile(path.join(s.directory,name+'.cpuprofile'),JSON.stringify(profile));
   await fs.writeFile(path.join(s.directory,name+'.json'),JSON.stringify(metadata,null,2));
   return{name,directory:s.directory,samples:profile.samples?.length??0};
  });return s.queue;
 }
 async function end(owner,reason='stopped'){
  const s=sessions.get(owner);if(!s)return;if(s.finish)return s.finish;s.ended=true;
  s.finish=(async()=>{try{await s.queue;}catch{};
   await statusFile(s.directory,{id:s.id,active:false,reason,packets:s.packets,frameCounts:s.offsets,frameBytes:s.bytes,endedAt:new Date(clock()).toISOString(),error:s.error});
   sessions.delete(owner);
  })();return s.finish;
 }
 return{begin,append,saveProfile,end,close:()=>Promise.all([...sessions.keys()].map(owner=>end(owner,'app-closed'))),active:owner=>sessions.has(owner)};
};

exports.registerPerformanceRecorder=function({ipcMain,app,screen,root,vsync}){
 const {createStartupProfiler,createSystemSampler}=require('./startup-profiler.cjs'),sampleSystem=createSystemSampler(),profilers=new Map();
 const store=exports.createPerformanceStore({root,
  hardware:async()=>{let gpu={};try{const info=await app.getGPUInfo('basic');gpu={devices:info.gpuDevice,auxAttributes:info.auxAttributes}}catch{}return{appVersion:app.getVersion(),electron:process.versions.electron,chrome:process.versions.chrome,vsync:vsync(),gpu,gpuFeatures:app.getGPUFeatureStatus(),displays:screen.getAllDisplays().map(d=>({width:d.size.width,height:d.size.height,scaleFactor:d.scaleFactor,hz:d.displayFrequency}))};},
  processMetrics:()=>app.getAppMetrics().map(p=>({type:p.type,pid:p.pid,cpuPercent:p.cpu?.percentCPUUsage,workingSetKB:p.memory?.workingSetSize,privateKB:p.memory?.privateBytes}))});
 ipcMain.handle('aim:performance:start',async(event,description)=>{
  if(JSON.stringify(description??{}).length>20000)throw Error('Recording description too large');
  return store.begin(event.sender.id,description);
 });
 let lastSystemSample=0;
 ipcMain.handle('aim:performance:append',(event,packet)=>{if(Date.now()-lastSystemSample>=2000){packet={...packet,systemSample:sampleSystem()};lastSystemSample=Date.now();}return store.append(event.sender.id,packet)});
 ipcMain.handle('aim:performance:profile',async(event,request)=>{
  if(!store.active(event.sender.id))throw Error('Start performance recording first');
  if(JSON.stringify(request??{}).length>30000)throw Error('Profile context too large');
  let profiler=profilers.get(event.sender.id);
  if(!profiler){profiler=createStartupProfiler({contents:event.sender,save:packet=>store.saveProfile(event.sender.id,packet)});profilers.set(event.sender.id,profiler);}
  if(request?.action==='status')return profiler.status();
  if(request?.action==='prepare'){await profiler.prepare();return{state:'ready'}};
  return profiler.start(request);
 });
 ipcMain.handle('aim:performance:stop',(event)=>store.end(event.sender.id));
 // Renderer unload can deliver its last bounded packet without waiting for a reply.
 ipcMain.on('aim:performance:last',(event,packet)=>{store.append(event.sender.id,packet).catch(()=>{})});
 const windows=new Map(),flushes=new Map();
 function flushWindow(owner){
  if(flushes.has(owner))return flushes.get(owner).promise;
  const win=windows.get(owner);if(!win||win.isDestroyed()||!store.active(owner))return Promise.resolve();
  let resolve;const promise=new Promise(r=>{resolve=r});const timer=setTimeout(()=>{flushes.delete(owner);resolve()},1500);
  flushes.set(owner,{promise,resolve:()=>{clearTimeout(timer);flushes.delete(owner);resolve()}});win.webContents.send('aim:performance:flush');return promise;
 }
 ipcMain.on('aim:performance:flushed',event=>flushes.get(event.sender.id)?.resolve());
 app.on('browser-window-created',(_event,win)=>{
  const owner=win.webContents.id;windows.set(owner,win);let closing=false,approved=false;
  win.on('close',event=>{if(approved||!store.active(owner))return;event.preventDefault();if(closing)return;closing=true;
   flushWindow(owner).then(()=>profilers.get(owner)?.dispose()).then(()=>store.end(owner,'window-closed')).finally(()=>{approved=true;if(!win.isDestroyed())win.close()});
  });
  win.once('closed',()=>{windows.delete(owner);profilers.get(owner)?.dispose().catch(()=>{});profilers.delete(owner);store.end(owner,'window-destroyed').catch(()=>{})});
 });
 let quitting=false,quitReady=false;app.on('before-quit',event=>{
  if(quitReady)return;event.preventDefault();if(quitting)return;quitting=true;
  Promise.all([...windows.keys()].map(flushWindow)).then(()=>Promise.all([...profilers.values()].map(p=>p.dispose()))).then(()=>store.close()).finally(()=>{quitReady=true;app.quit()});
 });
 return store;
};
