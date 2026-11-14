// Browser adapters for the unchanged engine inside a DedicatedWorker.
import {uploadWorkerTexture} from './worker-texture-upload.mjs';
export function installWorkerDOM(canvas,size,send,hostRequest,initialStorage){
 const state={...size,locked:false,focused:true,visible:true,armed:false};
 const storage=new Map(Object.entries(initialStorage));
 const fx=new Map();let elementId=0;
 const nativeBitmap=globalThis.createImageBitmap.bind(globalThis);
 const nativeFetch=globalThis.fetch.bind(globalThis);
 const event=(type,data={})=>{const e=new Event(type,{cancelable:true});for(const[k,v]of Object.entries(data))if(!['type','target','currentTarget','isTrusted'].includes(k))try{Object.defineProperty(e,k,{value:v,configurable:true})}catch{}return e};
 class Element extends EventTarget{
  constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.nodeName=this.tagName;this.style={};this.children=[];this.parentNode=null;this.dataset={};this.attributes=[];this.className='';this.id='';this.relList={supports:()=>true};this.isConnected=true;this.classList={add(){},remove(){},contains:()=>false,toggle(){}};}
  appendChild(child){this.children.push(child);child.parentNode=this;if(child instanceof OffscreenCanvas&&child.className==='al-jett-screen-fx'){const id=++elementId;child.__fxId=id;fx.set(id,{canvas:child,dirty:true,inFlight:false});send({type:'fx-create',id,className:child.className,style:child.style});}if(child.tagName==='LINK'){child.sheet={};queueMicrotask(()=>child.dispatchEvent(event('load')))}return child;}
  append(...children){for(const c of children)this.appendChild(c)}
  removeChild(child){this.children=this.children.filter(x=>x!==child);child.parentNode=null;return child}
  remove(){this.parentNode?.removeChild(this);this.isConnected=false}
  contains(child){return this.children.includes(child)}
  setAttribute(k,v){this[k]=String(v)}getAttribute(k){return this[k]??null}removeAttribute(k){delete this[k]}
  get clientWidth(){return state.width}get clientHeight(){return state.height}get offsetWidth(){return state.width}get offsetHeight(){return state.height}
  getBoundingClientRect(){return{x:0,y:0,left:0,top:0,width:state.width,height:state.height,right:state.width,bottom:state.height}}
  querySelector(){return null}querySelectorAll(){return[]}getElementsByTagName(){return[]}closest(){return null}matches(){return false}focus(){}blur(){}getRootNode(){return doc}
 }
 class ImageElement extends Element{
  constructor(){super('img');this.width=this.height=this.naturalWidth=this.naturalHeight=0;this.complete=false;this._src='';}
  set src(value){this._src=new URL(value,location.origin).href;this.complete=false;nativeFetch(this._src).then(r=>{if(!r.ok)throw Error('Image '+r.status+': '+this._src);return r.blob()}).then(async blob=>{
   const options={premultiplyAlpha:'none',colorSpaceConversion:'none'};[this.__bitmap,this.__flipped]=await Promise.all([nativeBitmap(blob,options),nativeBitmap(blob,{...options,imageOrientation:'flipY'})]);this.width=this.naturalWidth=this.__bitmap.width;this.height=this.naturalHeight=this.__bitmap.height;this.complete=true;this.dispatchEvent(event('load'));this.onload?.(event('load'));
  }).catch(error=>{this.dispatchEvent(event('error'));this.onerror?.(error);console.warn(error)});}
  get src(){return this._src}get currentSrc(){return this._src}decode(){return this.complete?Promise.resolve():new Promise((resolve,reject)=>{this.addEventListener('load',resolve,{once:true});this.addEventListener('error',reject,{once:true})})}
 }
 const decorate=surface=>{
  if(surface.__decorated)return surface;surface.__decorated=true;surface.style={};surface.className='';surface.nodeName=surface.tagName='CANVAS';surface.dataset={};surface.parentNode=null;surface.isConnected=true;surface.classList={add(){},remove(){},contains:()=>false};
  Object.defineProperties(surface,{clientWidth:{get:()=>state.width},clientHeight:{get:()=>state.height},ownerDocument:{get:()=>doc}});
  surface.getBoundingClientRect=()=>host.getBoundingClientRect();surface.setAttribute=(k,v)=>surface[k]=v;surface.remove=()=>surface.parentNode?.removeChild(surface);surface.focus=()=>{};
  surface.requestPointerLock=async()=>{await hostRequest('lock');state.locked=true;doc.dispatchEvent(event('pointerlockchange'))};
  const get=surface.getContext.bind(surface);
  surface.getContext=(kind,...args)=>{
   const context=get(kind,...args);if(!context||context.__workerAdapted)return context;context.__workerAdapted=true;
   if(kind==='2d'){
    const draw=context.drawImage.bind(context);context.drawImage=(image,...rest)=>{if(surface.__fxId)fx.get(surface.__fxId).dirty=true;return draw(image?.__bitmap??image,...rest)};
    for(const method of ['clearRect','fillRect','stroke','fill']){const call=context[method].bind(context);context[method]=(...values)=>{if(surface.__fxId)fx.get(surface.__fxId).dirty=true;return call(...values)}}
   }else if(kind==='webgl2'||kind==='webgl'){
    for(const method of ['texImage2D','texSubImage2D']){const call=context[method].bind(context);context[method]=(...values)=>uploadWorkerTexture(context,call,values)}
   }
   return context;
  };return surface;
 };
 const doc=new Element('#document'),head=new Element('head'),body=new Element('body'),root=new Element('html'),host=new Element('div');host.className='al-stage-wrap';
 doc.head=head;doc.body=body;doc.documentElement=root;doc.activeElement=null;doc.ownerDocument=doc;
 Object.defineProperties(doc,{visibilityState:{get:()=>state.visible?'visible':'hidden'},hidden:{get:()=>!state.visible},pointerLockElement:{get:()=>state.locked?canvas:null},fullscreenElement:{get:()=>root}});
 doc.hasFocus=()=>state.focused;doc.exitPointerLock=()=>{state.locked=false;send({type:'host',method:'unlock'});doc.dispatchEvent(event('pointerlockchange'))};root.requestFullscreen=()=>Promise.resolve();
 doc.createElement=tag=>tag==='canvas'?(state.armed?(state.armed=false,decorate(canvas)):decorate(new OffscreenCanvas(1,1))):tag==='img'?new ImageElement():new Element(tag);
 doc.createElementNS=(_namespace,tag)=>doc.createElement(tag);doc.getElementById=id=>[...head.children,...body.children].find(x=>x.id===id)??null;
 doc.createTextNode=text=>({nodeType:3,textContent:text});doc.createComment=text=>({nodeType:8,textContent:text});
 globalThis.window=globalThis;globalThis.document=doc;globalThis.Image=ImageElement;globalThis.HTMLImageElement=ImageElement;globalThis.HTMLElement=Element;globalThis.Element=Element;globalThis.HTMLCanvasElement=OffscreenCanvas;
 globalThis.history={state:{},length:1,pushState(value){this.state=value;this.length++},replaceState(value){this.state=value},go(){}};
 globalThis.Storage=class{};
 globalThis.CustomEvent??=class extends Event{constructor(type,options={}){super(type,options);this.detail=options.detail}};
 globalThis.StorageEvent??=class extends Event{constructor(type,options={}){super(type,options);Object.assign(this,options)}};
 globalThis.sessionStorage={getItem:()=>null,setItem(){},removeItem(){},key:()=>null,length:0};
 globalThis.screen={width:state.width,height:state.height,availWidth:state.width,availHeight:state.height};
 doc.cookie='';doc.readyState='complete';doc.defaultView=globalThis;doc.getElementsByTagName=tag=>tag==='head'?[head]:tag==='body'?[body]:tag==='html'?[root]:[];
 globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem(k,v){storage.set(k,String(v));send({type:'storage',key:k,value:String(v)})},removeItem(k){storage.delete(k);send({type:'storage',key:k,value:null})},key:i=>[...storage.keys()][i]??null,get length(){return storage.size}};
 globalThis.getComputedStyle=()=>({getPropertyValue:()=>'',position:'relative'});globalThis.matchMedia=query=>({matches:false,media:query,addEventListener(){},removeEventListener(){}});
 globalThis.ResizeObserver=class{constructor(callback){this.callback=callback}observe(target){target.__resize=this.callback}disconnect(){}};
 globalThis.MutationObserver=class{observe(){}disconnect(){}};
 globalThis.requestAnimationFrame??=callback=>setTimeout(()=>callback(performance.now()),8);globalThis.cancelAnimationFrame??=clearTimeout;
 globalThis.createImageBitmap=(image,...args)=>nativeBitmap(image?.__bitmap??image,...args);
 globalThis.onpointerrawupdate=null;
 const updateDimensions=()=>{globalThis.innerWidth=state.width;globalThis.innerHeight=state.height;globalThis.devicePixelRatio=state.dpr||1};updateDimensions();decorate(canvas);
 const nativeListen=globalThis.addEventListener.bind(globalThis);
 globalThis.addEventListener=(type,callback,options)=>{if(type.startsWith('aim-'))send({type:'subscribe',event:type});return nativeListen(type,callback,options)};
 return{host,doc,state,storage,
  arm(){state.armed=true},
  dispatch(type,data={},target='document'){
   if(type==='pointerlockchange')state.locked=!!data.locked;if(type==='focus'||type==='blur')state.focused=type==='focus';if(type==='visibilitychange')state.visible=!!data.visible;
   const e=event(type,data);if(target==='window'){globalThis.dispatchEvent(e);return;}
   // Native input has capture handlers on document and fire/ADS/wheel on canvas.
   // EventTarget alone has no DOM propagation; retain the original target while
   // delivering document capture, canvas target, and window in that order.
   Object.defineProperty(e,'target',{value:target==='canvas'?canvas:doc});
   let stopped=false;for(const method of ['stopPropagation','stopImmediatePropagation']){const call=e[method].bind(e);e[method]=()=>{stopped=true;call()};}
   doc.dispatchEvent(e);if(!stopped&&target==='canvas')canvas.dispatchEvent(e);if(!stopped)globalThis.dispatchEvent(e);
  },
  resize(size){Object.assign(state,size);updateDimensions();host.__resize?.([{target:host}]);globalThis.dispatchEvent(event('resize'))},
  commitFX(){for(const[id,entry]of fx){if(!entry.dirty||entry.inFlight)continue;entry.dirty=false;entry.inFlight=true;const bitmap=entry.canvas.transferToImageBitmap();send({type:'fx-frame',id,bitmap},[bitmap]);}},
  ackFX(id){const entry=fx.get(id);if(entry)entry.inFlight=false},
 };
}
