// Presentation only: all progress and durations are read from the native ADS state.
(() => {
 if(window.__aimScopeVisual)return;
 const scopedWeapons=new Set(['marshal','outlaw','operator','tourdeforce']),clamp=x=>Math.max(0,Math.min(1,x)),smoothStep=x=>x*x*(3-2*x);
 let scopeTexture=null,tourTexture=null,zoomState=null;
 const tourReady=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{tourTexture=image;resolve();};image.onerror=()=>reject(Error('Tour de Force sight could not load'));image.src='/aim-ads/tour-de-force/overlay.png';}).catch(error=>console.warn('Tour de Force scope:',error));
 const overlayRecords=new WeakMap();
 const scopeStyle=document.createElement('style');scopeStyle.textContent='.al-scope-overlay.es-sniper-scope .al-scope-mask,.al-scope-overlay.es-sniper-scope .al-scope-glass{display:none!important}.es-scope-reference{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;transform-origin:50% 50%;will-change:transform}.al-scope-overlay.es-sniper-scope{will-change:opacity}.al-scope-overlay.es-sniper-scope .al-scope-dot{z-index:1}';document.head.append(scopeStyle);
 // Keep the supplied JPG unchanged. Its printed checkerboard is not transparency:
 // clear the optical opening once and mask the four exterior corner mattes.
 const ready=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{try{const maskedCanvas=document.createElement('canvas');maskedCanvas.width=image.naturalWidth;maskedCanvas.height=image.naturalHeight;const context=maskedCanvas.getContext('2d');context.drawImage(image,0,0);context.fillStyle='#000';for(const [cornerX,cornerY,flipX,flipY]of [[0,0,1,1],[1024,0,-1,1],[0,572,1,-1],[1024,572,-1,-1]]){context.save();context.translate(cornerX,cornerY);context.scale(flipX,flipY);context.beginPath();context.moveTo(0,0);context.lineTo(122,0);context.lineTo(48,65);context.lineTo(0,80);context.closePath();context.fill();context.restore();}context.globalCompositeOperation='destination-out';context.beginPath();context.arc(512,286,320,0,Math.PI*2);context.fill();scopeTexture=maskedCanvas;resolve();}catch(error){reject(error);}};image.onerror=()=>reject(Error('Scope reference could not load'));image.src='/media/sniper-scope/reference.jpg';}).catch(error=>console.warn('Sniper scope:',error));
 function smoothProgress(rawProgress,scopedIn,tickFraction,tickSeconds,transitionSeconds){if(rawProgress<=1e-8)return 0;if(rawProgress>=1-1e-8)return 1;if(!(transitionSeconds>0))return clamp(rawProgress);const previous=clamp(rawProgress+(scopedIn?-1:1)*tickSeconds/transitionSeconds);return clamp(previous+(rawProgress-previous)*clamp(tickFraction));}
 function blend(weapon,rawProgress,scopedIn,tickFraction,tickSeconds,adsTiming){return scopedWeapons.has(weapon)?smoothProgress(rawProgress,scopedIn,tickFraction,tickSeconds,scopedIn?adsTiming.transitionSeconds:adsTiming.zoomOutSeconds):rawProgress;}
 function zoom(weapon,startZoom,targetZoom,rawProgress,transitionSeconds,tickFraction,tickSeconds){
  if(!scopedWeapons.has(weapon)){zoomState=null;return startZoom+(targetZoom-startZoom)*rawProgress;}
  if(!zoomState||zoomState.weapon!==weapon||zoomState.target!==targetZoom||rawProgress<zoomState.raw){const continuedZoom=zoomState?.weapon===weapon&&zoomState.raw<1?zoomState.value:startZoom;zoomState={weapon,target:targetZoom,start:continuedZoom,raw:rawProgress,value:continuedZoom};}
  const smoothed=smoothProgress(rawProgress,true,tickFraction,tickSeconds,transitionSeconds);zoomState.raw=rawProgress;zoomState.value=zoomState.start+(targetZoom-zoomState.start)*smoothStep(smoothed);return zoomState.value;
 }
 function paint(record){if(!record.dirty)return;const root=record.root,parent=root.parentElement;const width=root.clientWidth||parent?.clientWidth||innerWidth,height=root.clientHeight||parent?.clientHeight||innerHeight;if(!width||!height)return;
  const computedStyle=getComputedStyle(root),stretch=parseFloat(computedStyle.getPropertyValue('--game-stretch-x'))||1,frameH=parseFloat(computedStyle.getPropertyValue('--game-frame-h'))||1;
  const pixelRatio=Math.min(devicePixelRatio||1,2),sizeKey=[width,height,stretch,frameH,pixelRatio,record.tour,!!tourTexture].join(':');record.dirty=false;if(sizeKey===record.sizeKey)return;record.sizeKey=sizeKey;
  const canvas=record.canvas;canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);const context=canvas.getContext('2d');context.setTransform(pixelRatio,0,0,pixelRatio,0,0);context.clearRect(0,0,width,height);
  if(record.tour){if(tourTexture)drawTourScope(context,width,height,stretch,frameH);}else drawScope(context,width,height,stretch,frameH);
 }
 function drawTourScope(context,width,height,stretch,frameH){
  const sightHeight=height*frameH,sightWidth=sightHeight*(1600/900)*stretch;
  const x=width/2,y=height/2;
  context.drawImage(tourTexture,x-sightWidth/2,y-sightHeight/2,sightWidth,sightHeight);
  const horizontalReach=sightWidth*.335,verticalReach=sightHeight*.32;
  context.strokeStyle='rgba(255,198,69,.65)';
  context.lineWidth=Math.max(.75,sightHeight/900);
  context.beginPath();
  context.moveTo(x-horizontalReach,y);
  context.lineTo(x+horizontalReach,y);
  context.moveTo(x,y-verticalReach);
  context.lineTo(x,y+verticalReach);
  context.stroke();
 }
 // The complete overlay (housing, mask, clear corners, reticle) for a w x h area,
 // shared by the in-game scope and the Settings crosshair lab preview.
 function drawScope(context,width,height,stretch,frameH){
  const imageScale=height*frameH/572,openingRadius=320*imageScale;context.fillStyle='#000';context.beginPath();context.rect(0,0,width,height);context.ellipse(width/2,height/2,openingRadius*stretch,openingRadius,0,0,Math.PI*2);context.fill('evenodd');
  context.save();context.translate(width/2,height/2);context.scale(stretch,1);context.drawImage(scopeTexture,-512*imageScale,-286*imageScale,scopeTexture.width*imageScale,scopeTexture.height*imageScale);context.restore();
  // The JPG's four outer checkerboard wedges represent open space. Clear the
  // complete composited overlay here, including the wide-screen black mask.
  const sideMargin=width/2-512*imageScale*stretch;
  context.save();context.globalCompositeOperation='destination-out';
  for(const [cornerX,cornerY,flipX,flipY]of [[0,0,1,1],[width,0,-1,1],[0,height,1,-1],[width,height,-1,-1]]){context.save();context.translate(cornerX,cornerY);context.scale(flipX,flipY);context.beginPath();context.moveTo(0,0);context.lineTo(sideMargin+122*imageScale*stretch,0);context.lineTo(sideMargin+48*imageScale*stretch,65*imageScale);context.lineTo(sideMargin,80*imageScale);context.lineTo(0,80*imageScale);context.closePath();context.fill();context.restore();}
  context.restore();
  // Reference reticle, recreated over the clear world at the exact aim centre.
  context.save();context.translate(width/2,height/2);context.scale(stretch*imageScale,imageScale);context.strokeStyle='rgba(8,10,11,.78)';context.lineWidth=.8;context.beginPath();context.moveTo(-320,0);context.lineTo(320,0);context.moveTo(0,-286);context.lineTo(0,286);context.stroke();context.strokeStyle='#080a0b';context.lineWidth=2;
  for(const sign of [-1,1]){context.beginPath();context.moveTo(sign*265,-25);context.lineTo(sign*276,-25);context.lineTo(sign*276,25);context.lineTo(sign*265,25);context.moveTo(sign*255,-6);context.lineTo(sign*255,6);context.stroke();context.lineWidth=5;context.beginPath();context.moveTo(0,sign*246);context.lineTo(0,sign*286);context.stroke();context.lineWidth=1;context.beginPath();context.moveTo(-245,sign*225);context.lineTo(-105,sign*264);context.lineTo(-21,sign*264);context.moveTo(21,sign*264);context.lineTo(105,sign*264);context.lineTo(245,sign*225);context.stroke();context.lineWidth=2;}
  context.lineWidth=1;for(const [arcStart,arcEnd]of [[-.39,-.14],[.14,.39]]){context.beginPath();context.arc(0,0,279,arcStart,arcEnd);context.arc(0,0,286,arcEnd,arcStart,true);context.closePath();context.stroke();}context.restore();
 }
 function tick(root,view){if(!root)return undefined;if(!scopedWeapons.has(view.scopeWeapon)||view.scopeWeapon!=='tourdeforce'&&!scopeTexture){root.classList.remove('es-sniper-scope');return undefined;}
  const rawBlend=view.scopePhase==='running'?clamp(view.scopeVisualBlend??view.blend):0,opacity=smoothStep(rawBlend);
  let record=overlayRecords.get(root);if(!record){const canvas=document.createElement('canvas');canvas.className='es-scope-reference';canvas.setAttribute('aria-hidden','true');root.append(canvas);record={root,canvas,sizeKey:'',dirty:true,lastScale:null,observer:null,layout:null};overlayRecords.set(root,record);record.observer=new ResizeObserver(()=>{record.dirty=true;});record.observer.observe(root);record.layout=new MutationObserver(()=>{record.dirty=true;});for(let parent=root.parentElement;parent;parent=parent.parentElement)record.layout.observe(parent,{attributes:true,attributeFilter:['style','class']});}
  const isTour=view.scopeWeapon==='tourdeforce';if(record.tour!==isTour){record.tour=isTour;record.dirty=true;}if(isTour&&!record.tourLoaded&&tourTexture){record.tourLoaded=true;record.dirty=true;}
  if(!root.classList.contains('es-sniper-scope'))root.classList.add('es-sniper-scope');if(opacity>0){paint(record);const zoomScale=1+.12*(1-smoothStep(rawBlend));if(zoomScale!==record.lastScale){record.canvas.style.transform='scale('+zoomScale.toFixed(6)+')';record.lastScale=zoomScale;}}
  return opacity;
 }
 // Settings preview: drawn into its own canvas first, since the clear corners must show
 // the preview's world rather than erase it. Cached until the size or stretch changes.
 let previewCache=null;
 function draw(context,width,height,stretch=1){
  if(!scopeTexture||!(width>0)||!(height>0))return false;
  const key=[width,height,stretch].join(':');
  if(previewCache?.key!==key){const canvas=previewCache?.canvas||document.createElement('canvas');canvas.width=width;canvas.height=height;const previewContext=canvas.getContext('2d');previewContext.clearRect(0,0,width,height);drawScope(previewContext,width,height,stretch,1);previewCache={key,canvas};}
  context.drawImage(previewCache.canvas,0,0);
  return true;
 }
 window.__aimScopeVisual={ready:Promise.all([ready,tourReady]),blend,zoom,tick,draw,dispose(root){const record=overlayRecords.get(root);if(record){record.observer.disconnect();record.layout.disconnect();record.canvas.remove();overlayRecords.delete(root);}},reset(){zoomState=null;},supported:weapon=>scopedWeapons.has(weapon)};
})();
