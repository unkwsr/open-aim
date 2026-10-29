// Presentation only: all progress and durations are read from the native ADS state.
(() => {
 if(window.__aimScopeVisual)return;
 const weapons=new Set(['marshal','outlaw','operator']),clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>x*x*(3-2*x);
 let texture=null,zoomState=null;
 const records=new WeakMap();
 const css=document.createElement('style');css.textContent='.al-scope-overlay.es-sniper-scope .al-scope-mask,.al-scope-overlay.es-sniper-scope .al-scope-glass{display:none!important}.es-scope-reference{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;transform-origin:50% 50%;will-change:transform}.al-scope-overlay.es-sniper-scope{will-change:opacity}.al-scope-overlay.es-sniper-scope .al-scope-dot{z-index:1}';document.head.append(css);
 // Keep the supplied JPG unchanged. Its printed checkerboard is not transparency:
 // clear the optical opening once and mask the four exterior corner mattes.
 const ready=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{try{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);ctx.fillStyle='#000';for(const [x,y,sx,sy]of [[0,0,1,1],[1024,0,-1,1],[0,572,1,-1],[1024,572,-1,-1]]){ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(122,0);ctx.lineTo(48,65);ctx.lineTo(0,80);ctx.closePath();ctx.fill();ctx.restore();}ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(512,286,320,0,Math.PI*2);ctx.fill();texture=c;resolve();}catch(e){reject(e);}};img.onerror=()=>reject(Error('Scope reference could not load'));img.src='/media/sniper-scope/reference.jpg';}).catch(e=>console.warn('Sniper scope:',e));
 function progress(raw,active,fraction,step,seconds){if(raw<=1e-8)return 0;if(raw>=1-1e-8)return 1;if(!(seconds>0))return clamp(raw);const previous=clamp(raw+(active?-1:1)*step/seconds);return clamp(previous+(raw-previous)*clamp(fraction));}
 function blend(weapon,raw,active,fraction,step,ads){return weapons.has(weapon)?progress(raw,active,fraction,step,active?ads.transitionSeconds:ads.zoomOutSeconds):raw;}
 function zoom(weapon,start,target,raw,seconds,fraction,step){
  if(!weapons.has(weapon)){zoomState=null;return start+(target-start)*raw;}
  if(!zoomState||zoomState.weapon!==weapon||zoomState.target!==target||raw<zoomState.raw){const continuous=zoomState?.weapon===weapon&&zoomState.raw<1?zoomState.value:start;zoomState={weapon,target,start:continuous,raw,value:continuous};}
  const p=progress(raw,true,fraction,step,seconds);zoomState.raw=raw;zoomState.value=zoomState.start+(target-zoomState.start)*ease(p);return zoomState.value;
 }
 function paint(record){if(!record.dirty)return;const root=record.root,parent=root.parentElement;const w=root.clientWidth||parent?.clientWidth||innerWidth,h=root.clientHeight||parent?.clientHeight||innerHeight;if(!w||!h)return;
  const computed=getComputedStyle(root),stretch=parseFloat(computed.getPropertyValue('--game-stretch-x'))||1,frameH=parseFloat(computed.getPropertyValue('--game-frame-h'))||1;
  const ratio=Math.min(devicePixelRatio||1,2),key=[w,h,stretch,frameH,ratio,record.araxys].join(':');record.dirty=false;if(key===record.sizeKey)return;record.sizeKey=key;
  const canvas=record.canvas;canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  drawScope(ctx,w,h,stretch,frameH);
 }
 // The complete overlay (housing, mask, clear corners, reticle) for a w x h area,
 // shared by the in-game scope and the Settings crosshair lab preview.
 function drawScope(ctx,w,h,stretch,frameH){
  const scale=h*frameH/572,radius=320*scale;ctx.fillStyle='#000';ctx.beginPath();ctx.rect(0,0,w,h);ctx.ellipse(w/2,h/2,radius*stretch,radius,0,0,Math.PI*2);ctx.fill('evenodd');
  ctx.save();ctx.translate(w/2,h/2);ctx.scale(stretch,1);ctx.drawImage(texture,-512*scale,-286*scale,texture.width*scale,texture.height*scale);ctx.restore();
  // The JPG's four outer checkerboard wedges represent open space. Clear the
  // complete composited overlay here, including the wide-screen black mask.
  const side=w/2-512*scale*stretch;
  ctx.save();ctx.globalCompositeOperation='destination-out';
  for(const [x,y,sx,sy]of [[0,0,1,1],[w,0,-1,1],[0,h,1,-1],[w,h,-1,-1]]){ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(side+122*scale*stretch,0);ctx.lineTo(side+48*scale*stretch,65*scale);ctx.lineTo(side,80*scale);ctx.lineTo(0,80*scale);ctx.closePath();ctx.fill();ctx.restore();}
  ctx.restore();
  // Reference reticle, recreated over the clear world at the exact aim centre.
  ctx.save();ctx.translate(w/2,h/2);ctx.scale(stretch*scale,scale);ctx.strokeStyle='rgba(8,10,11,.78)';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(-320,0);ctx.lineTo(320,0);ctx.moveTo(0,-286);ctx.lineTo(0,286);ctx.stroke();ctx.strokeStyle='#080a0b';ctx.lineWidth=2;
  for(const sign of [-1,1]){ctx.beginPath();ctx.moveTo(sign*265,-25);ctx.lineTo(sign*276,-25);ctx.lineTo(sign*276,25);ctx.lineTo(sign*265,25);ctx.moveTo(sign*255,-6);ctx.lineTo(sign*255,6);ctx.stroke();ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,sign*246);ctx.lineTo(0,sign*286);ctx.stroke();ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-245,sign*225);ctx.lineTo(-105,sign*264);ctx.lineTo(-21,sign*264);ctx.moveTo(21,sign*264);ctx.lineTo(105,sign*264);ctx.lineTo(245,sign*225);ctx.stroke();ctx.lineWidth=2;}
  ctx.lineWidth=1;for(const [a,b]of [[-.39,-.14],[.14,.39]]){ctx.beginPath();ctx.arc(0,0,279,a,b);ctx.arc(0,0,286,b,a,true);ctx.closePath();ctx.stroke();}ctx.restore();
 }
 function tick(root,view){if(!root)return undefined;if(!weapons.has(view.scopeWeapon)||!texture){root.classList.remove('es-sniper-scope');return undefined;}
  const raw=view.scopePhase==='running'?clamp(view.scopeVisualBlend??view.blend):0,opacity=ease(raw);
  let r=records.get(root);if(!r){const canvas=document.createElement('canvas');canvas.className='es-scope-reference';canvas.setAttribute('aria-hidden','true');root.append(canvas);r={root,canvas,sizeKey:'',dirty:true,lastScale:null,observer:null,layout:null,araxys:false};records.set(root,r);r.observer=new ResizeObserver(()=>{r.dirty=true;});r.observer.observe(root);r.layout=new MutationObserver(()=>{r.dirty=true;});for(let parent=root.parentElement;parent;parent=parent.parentElement)r.layout.observe(parent,{attributes:true,attributeFilter:['style','class']});}
  const araxys=view.scopeWeapon==='operator'&&window.__aimOperatorSkin==='araxys-operator';if(r.araxys!==araxys){r.araxys=araxys;r.dirty=true;}
  if(!root.classList.contains('es-sniper-scope'))root.classList.add('es-sniper-scope');if(opacity>0){paint(r);const scale=1+.12*(1-ease(raw));if(scale!==r.lastScale){r.canvas.style.transform='scale('+scale.toFixed(6)+')';r.lastScale=scale;}}
  return opacity;
 }
 // Settings preview: drawn into its own canvas first, since the clear corners must show
 // the preview's world rather than erase it. Cached until the size or stretch changes.
 let preview=null;
 function draw(ctx,w,h,stretch=1){
  if(!texture||!(w>0)||!(h>0))return false;
  const key=[w,h,stretch].join(':');
  if(preview?.key!==key){const canvas=preview?.canvas||document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');c.clearRect(0,0,w,h);drawScope(c,w,h,stretch,1);preview={key,canvas};}
  ctx.drawImage(preview.canvas,0,0);
  return true;
 }
 window.__aimScopeVisual={ready,blend,zoom,tick,draw,dispose(root){const r=records.get(root);if(r){r.observer.disconnect();r.layout.disconnect();r.canvas.remove();records.delete(root);}},reset(){zoomState=null;},supported:weapon=>weapons.has(weapon)};
})();
