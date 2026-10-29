// One counter for game-render throughput. Never label rAF/refresh as game FPS.
(async()=>{
 if(window.__aimFrameMeter)return;
 const {createFrameMetrics}=await import('/aim-ui/frame-metrics.mjs');
 const metrics=createFrameMetrics(),key='aim-frame-meter-v2';
 let enabled=true,active=false,visible=!document.hidden,node=null,minimap=null;
 const mapResize=typeof ResizeObserver==='function'?new ResizeObserver(position):null;
 function remove(){node?.remove();node=null;mapResize?.disconnect();minimap=null;}
 function position(){
  if(!node)return;
  const bounds=minimap?.getBoundingClientRect();
  if(bounds&&bounds.width>0&&bounds.height>0){
   node.style.left=Math.max(8,bounds.left)+'px';
   node.style.top=Math.max(64,bounds.bottom+64)+'px';
  }else{node.style.left='16px';node.style.top='64px';}
 }
 function followMap(){
  const next=document.querySelector('.hall-train-layer [data-role="minimap"]');
  if(next===minimap)return;
  mapResize?.disconnect();minimap=next;
  if(minimap)mapResize?.observe(minimap);
  position();
 }
 try{
  const saved=localStorage.getItem(key),old=localStorage.getItem('es-fps-meter');
  const display=JSON.parse(localStorage.getItem('al-display-settings-v1')||'{}');
  enabled=saved!==null?saved==='1':old==='1'||display.showPerformance===true||old===null;
 }catch{}
 function setEnabled(on){enabled=!!on;metrics.reset();try{localStorage.setItem(key,enabled?'1':'0')}catch{}
  if(!enabled)remove();
  dispatchEvent(new Event('aim-frame-meter-change'));paint();
 }
 function paint(){
  if(!enabled||!visible||!active||!document.body.classList.contains('al-training-active')){remove();return;}
  if(!node){node=document.createElement('div');node.className='aim-frame-meter';
   node.setAttribute('aria-label','Game render performance');
   node.title='Completed game renders, not monitor scanout. FPS / mean frame time: last 1 s. 1% low: reciprocal of the mean slowest 1% intervals over 5 s. Pauses and hidden windows reset samples.';
   node.innerHTML='<div><b>—</b><span>FPS</span></div><small>Measuring…</small><small></small>';document.body.append(node);position();
  }
  followMap();
  const data=active?metrics.snapshot(performance.now()):null;
  const text=(el,value)=>{value=String(value);if(el.textContent!==value)el.textContent=value;};
  text(node.firstElementChild.firstElementChild,data?.ready?Math.round(data.fps):'—');
  text(node.children[1],!active?'Waiting for gameplay':!data?.ready?'Measuring…':`${data.frameMs.toFixed(2)} ms · 1% low ${data.lowReady?Math.round(data.onePercentLow):'measuring…'}`);
  text(node.children[2],data?.ready?`Worst ${data.worstMs.toFixed(2)} ms · last 5 s`:'');
 }
 window.__aimFrameMeter={enabled:()=>enabled,setEnabled};
 window.__aimRenderComplete=(at,running)=>{
  const next=!!running&&visible&&document.body.classList.contains('al-training-active');
  window.__aimFrameLog?.(at,next);
  if(next!==active){active=next;metrics.reset();paint();}
  if(enabled&&active)metrics.frame(at);
 };
 window.__aimRenderStop=()=>{active=false;metrics.reset();paint();};
 document.addEventListener('visibilitychange',()=>{visible=!document.hidden;active=false;metrics.reset();paint()});
 const reposition=()=>{followMap();position()};
 addEventListener('resize',reposition);addEventListener('fullscreenchange',reposition);
 addEventListener('pagehide',()=>{clearInterval(timer);remove();removeEventListener('resize',reposition);removeEventListener('fullscreenchange',reposition)},{once:true});
 const timer=setInterval(paint,250);paint();dispatchEvent(new Event('aim-frame-meter-change'));
})();
