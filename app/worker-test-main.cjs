// Experimental launcher only. Normal main.js and production bundles stay intact.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),profile=path.join(root,'test-data/worker-test');
const sourceProfile=path.join(root,'test-data/AimTrainer'),targetProfile=path.join(profile,'AimTrainer');
// worker-release-v1 (14 Nov 2026): this file is also the installed game's entry point (package.json
// build.extraMetadata.main). Installed: no test profile, no "Worker Test" title; main.js then uses
// %APPDATA%\AimTrainer and port 8000 like 1.3.0 (upgrade-safety-v1).
const PACKAGED=require('electron').app.isPackaged;
if(!PACKAGED&&!fs.existsSync(targetProfile)){
 fs.mkdirSync(targetProfile,{recursive:true});
 for(const name of ['Local Storage','shell-settings.json']){
  const from=path.join(sourceProfile,name),to=path.join(targetProfile,name);
  if(fs.existsSync(from))try{fs.cpSync(from,to,{recursive:true,filter:p=>path.basename(p)!=='LOCK'})}catch(e){console.warn('Worker test preference copy:',e.message)}
 }
}
process.env.AIM_FRAME_LOG='0';
const read=fs.readFileSync.bind(fs);
fs.readFileSync=function(file,...args){
 let value=read(file,...args);
 if(typeof file==='string'&&/site[\\/](?:_assets[\\/]r20261021-1[\\/])?next[\\/]js[\\/]BiMsX6Xn\.js$/.test(file)){
  let s=Buffer.isBuffer(value)?value.toString():value;
  const anchor='function lU(n){return Hv(n).then(e=>{const t=e.clone(!0);return Ev(t),t})}';assert.equal(s.split(anchor).length,2);
  s=s.replace(anchor,'function lU(n){return Hv(n).then(async e=>{const t=e.clone(!0);return Ev(t),globalThis.__aimWorkerThread?await globalThis.__aimPrepareMapSections(t):t})}');
  // Worker Test: Low-latency mode off by default and in every preset (measured 2026-11-11: Chromium refuses
  // desynchronized here, and ON was less even). Save version 2 -> 3 resets old saves to off once; a player
  // who turns it on afterwards keeps it on.
  for(const [from,to,count] of [['t_=70,mA=2,EA=1','t_=70,mA=3,EA=1',1],['lowLatency:!0,lowLatencyRev:mA','lowLatency:!1,lowLatencyRev:mA',1],['lowLatency:!0,shadows:','lowLatency:!1,shadows:',4]]){assert.equal(s.split(from).length-1,count,'worker low-latency patch: '+from);s=s.split(from).join(to);}
  value=Buffer.isBuffer(value)?Buffer.from(s):s;
 }
 // Worker Test: yellow "!" warning above Low-latency mode in Video settings (HallSwitch gets an optional `warn`),
 // a shorter description, and the presets note no longer says presets turn it on. Approved 2026-11-11.
 if(typeof file==='string'&&/site[\\/](?:_assets[\\/]r20261021-1[\\/])?next[\\/]js[\\/]Dc2Dm9E6\.js$/.test(file)){
  let s=Buffer.isBuffer(value)?value.toString():value;
  const warnSpan="cw['warn']?(bC(),bv('span',{'class':'hall-field-warn','style':{'display':'flex','alignItems':'center','gap':'7px','color':'#fbbf24','fontSize':'12px','fontWeight':'600','marginBottom':'4px'}},[bz('i',{'style':{'flex':'none','width':'15px','height':'15px','borderRadius':'50%','background':'#fbbf24','color':'#111','fontStyle':'normal','fontWeight':'800','fontSize':'11px','lineHeight':'15px','textAlign':'center'}},'!',-0x1),bJ(bI(cw['warn']),0x1)])):bG('',!0x0),";
  for(const [from,to] of [
   ["'__name':'HallSwitch','props':{'label':{},'hint':{},","'__name':'HallSwitch','props':{'label':{},'hint':{},'warn':{},"],
   ["bz('span',nc,[cw['local']?","bz('span',nc,["+warnSpan+"cw['local']?"],
   ["'label':'Low-latency mode','data-setting':'lowLatency','hint':'Reduces mouse-to-screen latency (about 2–3 frames on Windows) with no quality loss. Applies the next time you enter training; if the screen flickers or goes black, turn it off'","'label':'Low-latency mode','data-setting':'lowLatency','warn':'Not recommended: can make motion less smooth in this version','hint':'Lower input delay on some setups. Applies the next time you enter training'"],
   [" Graphics presets also set shadows and low-latency mode. All four presets use low latency; turning it off shows Custom above. "," Graphics presets also set shadows. Presets leave low-latency mode off; turning it on shows Custom above. "],
  ]){assert.equal(s.split(from).length-1,1,'worker settings patch: '+from.slice(0,60));s=s.replace(from,()=>to);}
  value=Buffer.isBuffer(value)?Buffer.from(s):s;
 }
 // release-no-dev-tools-v1 (14 Nov 2026): installed build only. No green "WORKER TEST · FPS · display paced ·
 // F8 · culling · F9 · smooth aim" badge, no F8 (pacing) / F9 (map culling) test keys. The Video settings rows
 // (smooth aim, map culling, frame limit) still work. Worker Test from source keeps all of it.
 if(PACKAGED&&typeof file==='string'&&/site[\\/]local[\\/]threaded-game-bridge\.mjs$/.test(file)){
  let s=Buffer.isBuffer(value)?value.toString():value;
  for(const [from,to] of [
   ["pointerEvents:'none'});host.appendChild(badge);","pointerEvents:'none',display:'none'});host.appendChild(badge);"],
   ["on(window,'keydown',e=>{if(e.code!=='F8'","void(e=>{if(e.code!=='F8'"],
   ["on(window,'keydown',e=>{if(e.code!=='F9'","void(e=>{if(e.code!=='F9'"],
  ]){assert.equal(s.split(from).length-1,1,'release dev-tools patch: '+from.slice(0,50));s=s.replace(from,()=>to);}
  value=Buffer.isBuffer(value)?Buffer.from(s):s;
 }
 // release-no-slowmo-v1: installed build only. The recording slow-mo (V / F6 / F7 / F10 / F11 in a round = 0.5x
 // game speed, Shift = "0.5x" label) is never installed, so the clock stays at 1x and V reaches the game.
 if(PACKAGED&&typeof file==='string'&&/site[\\/]local[\\/]recording-clock\.mjs$/.test(file)){
  let s=Buffer.isBuffer(value)?value.toString():value;
  assert.equal(s.split('installRecordingKeys();').length-1,1,'release slow-mo patch');
  s=s.replace('installRecordingKeys();','/* release-no-slowmo-v1 */');
  value=Buffer.isBuffer(value)?Buffer.from(s):s;
 }
 if(typeof file==='string'&&/site[\\/]aim-audio[\\/]arcane-sheriff\.mjs$/.test(file)){
  const s=Buffer.isBuffer(value)?value.toString():value;const after='if(!globalThis.__aimWorkerThread){\n'+s+'\n}\n';value=Buffer.isBuffer(value)?Buffer.from(after):after;
 }
 if(typeof file==='string'&&/site[\\/]aim-ui[\\/]scenario-loading\.mjs$/.test(file)){
  let s=Buffer.isBuffer(value)?value.toString():value;const anchor='export function runScenarioLoading(prepare, workshop = null) {';assert.equal(s.split(anchor).length,2);s=s.replace(anchor,anchor+'\n  if(globalThis.__aimWorkerThread)return globalThis.__aimWorkerRunLoading(prepare,workshop);');value=Buffer.isBuffer(value)?Buffer.from(s):s;
 }
 if(typeof file==='string'&&/site[\\/](?:_assets[\\/]r20261021-1[\\/])?next[\\/]js[\\/]OkAdunfX\.js$/.test(file)){
  let s=Buffer.isBuffer(value)?value.toString():value;
  const anchor='function Jy(e,t,n,s={}){';assert.equal(s.split(anchor).length,2);
  s="import {createThreadedGame as __aimThreadedGame} from '/local/threaded-game-bridge.mjs';\n"+s.replace(anchor,anchor+'if(!globalThis.__aimWorkerThread)return __aimThreadedGame(e,t,n,s,import.meta.url);');
  const buy='function Bs(G){const ge=n.value?.buy(G)??!1,qe=Lt(),gt=zt.value;return ge&&qe&&gt&&dn.value?.remember(qe.shareCode,G,gt.original),ge}';
  assert.equal(s.split(buy).length,2);s=s.replace(buy,'async function Bs(G){const ge=await n.value?.buy(G)??!1,qe=Lt(),gt=zt.value;return ge&&qe&&gt&&dn.value?.remember(qe.shareCode,G,gt.original),ge}');
  const menu='function v(b){if(oo(b)){s.buy(b)?(u.value=b,c.value=null):c.value="Detained: you cannot change gear now";return}if(b===r.value){p(!0);return}if(!s.buy(b)){c.value="Detained: you cannot change gear now";return}r.value=b,p(!0)}';
  assert.equal(s.split(menu).length,2);s=s.replace(menu,menu.replace('function v(b)','async function v(b)').replaceAll('s.buy(b)','(await s.buy(b))'));
  s+='\nexport {Jy as __workerCreateGame,qp as __workerGameAudio};\n';
  const scheduler='s.scheduler??(me?_h():void 0)';assert.equal(s.split(scheduler).length,2);
  s=s.replace(scheduler,'s.scheduler??(globalThis.__aimWorkerThread?globalThis.__aimWorkerScheduler:(me?_h():void 0))');
  s=s.replace('globalThis.__aimDrillPreparation={engine:Xu,','globalThis.__aimWorkerScene={snapshot:()=>hs(de),stage:r};globalThis.__aimDrillPreparation={engine:Xu,');
  value=Buffer.isBuffer(value)?Buffer.from(s):s;
 }
 return value;
};
const {app}=require('electron');
// shared-mouse-v1 (14 Nov 2026): lets the page hand mouse movement to the game worker through shared memory
// (threaded-game-bridge.mjs / worker-game-entry.mjs). Without it SharedArrayBuffer is undefined (page is not
// cross-origin isolated) and the bridge keeps posting one message per mouse event.
app.commandLine.appendSwitch('enable-features','SharedArrayBuffer');
app.on('browser-window-created',(_event,win)=>{
 if(!PACKAGED)win.webContents.on('page-title-updated',event=>{event.preventDefault();win.setTitle('openVaim — Worker Test')});
 if(process.env.AIM_WORKER_PROBE==='1'){
  win.webContents.on('console-message',event=>console.log('PAGE',event.level,event.message));
  let busy=false,last=0;const command=path.join(root,'previews/worker-test/probe-command.js'),response=path.join(root,'previews/worker-test/probe-response.json');
  const timer=setInterval(async()=>{if(busy||win.isDestroyed()||win.webContents.isLoadingMainFrame()||!fs.existsSync(command))return;const stamp=fs.statSync(command).mtimeMs;if(stamp===last)return;last=stamp;busy=true;try{const value=await win.webContents.executeJavaScript(read(command,'utf8'));fs.writeFileSync(response,JSON.stringify({value},null,2));}catch(error){fs.writeFileSync(response,JSON.stringify({error:error?.stack??String(error)},null,2));}finally{busy=false}},250);
  win.on('closed',()=>clearInterval(timer));setTimeout(()=>app.exit(1),900000).unref();
 }
});
const file=path.join(__dirname,'main.js');let main=read(file,'utf8');
main=main.replace('process.env.AIM_PROFILE = path.join(TEST_ROOT, "test-data");',`process.env.AIM_PROFILE = ${JSON.stringify(profile)};`);
// Diagnostic runs can coexist with the user's normal test game. Launcher default stays 8137.
if(process.env.AIM_WORKER_PROBE==='1'&&/^\d{4,5}$/.test(process.env.AIM_WORKER_PROBE_PORT??''))main=main.replace('process.env.AIM_PORT = "8137";',`process.env.AIM_PORT = ${JSON.stringify(process.env.AIM_WORKER_PROBE_PORT)};`);
const compiled=new Module(file,module);compiled.filename=file;compiled.paths=Module._nodeModulePaths(__dirname);compiled._compile(main,file);
