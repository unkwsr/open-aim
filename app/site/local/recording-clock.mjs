// Recording clock: game time is scaled; rendering/input/browser clocks stay native.
export function createGameClock(now=()=>performance.now()) {
 const points=[{real:now(),game:0,rate:1}],listeners=new Set(),timers=new Set();let rate=1;
 function timeAt(real=now()) {let i=points.length-1;while(i>0&&real<points[i].real)i--;const p=points[i];return p.game+(real-p.real)*p.rate}
 function arm(job){clearTimeout(job.id);job.id=setTimeout(()=>{if(timeAt()+.01<job.at){arm(job);return}timers.delete(job);job.callback()},Math.max(0,(job.at-timeAt())/rate))}
 return {timeAt,get rate(){return rate},setRate(value){if(value!==1&&value!==.5)throw Error('Unsupported recording speed');if(value===rate)return;const real=now(),game=timeAt(real);rate=value;points.push({real,game,rate});for(const job of timers)arm(job);for(const fn of listeners)fn(value)},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},setTimeout(callback,delay){const job={callback,at:timeAt()+delay,id:null};timers.add(job);arm(job);return job},clearTimeout(job){if(job){clearTimeout(job.id);timers.delete(job)}}};
}
export const gameClock=globalThis.__aimRecordingClock??=createGameClock();
export function configureRecordingKey(bindings={}){
 const used=new Set(Object.values(bindings).flat());
 globalThis.__aimRecordingKey=['KeyV','F6','F7','F10','F11'].find(key=>!used.has(key))??null;
 return globalThis.__aimRecordingKey;
}
export function installRecordingKeys(){
 if(typeof document==='undefined'||globalThis.__aimWorkerThread||globalThis.__aimRecordingKeys)return;
 globalThis.__aimRecordingKeys=true;let labelVisible=false;
 const label=document.createElement('div');label.textContent='0.5x';Object.assign(label.style,{position:'fixed',left:'50%',top:'12px',transform:'translateX(-50%)',zIndex:2147483647,padding:'3px 7px',borderRadius:'4px',background:'#0009',color:'white',font:'12px sans-serif',pointerEvents:'none',display:'none'});
 (document.body??document.documentElement).append(label);
 const update=()=>{label.style.display=gameClock.rate===.5&&labelVisible?'block':'none'};gameClock.subscribe(update);
 globalThis.__aimSlowMotion={setRate(value){gameClock.setRate(value)},get rate(){return gameClock.rate},get key(){return globalThis.__aimRecordingKey??'KeyV'},setLabelVisible(value){labelVisible=!!value;update()},get labelVisible(){return labelVisible}};
 document.addEventListener('keydown',event=>{
  if(event.code!==(globalThis.__aimRecordingKey??'KeyV')||event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if(!document.pointerLockElement)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(event.shiftKey){labelVisible=!labelVisible;update()}else gameClock.setRate(gameClock.rate===1?.5:1);
 },true);
}
installRecordingKeys();
