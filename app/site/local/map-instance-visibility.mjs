import {drawPreparedSceneResources} from './scene-resource-preparation.mjs';
// Draw-time views of immutable imported map instances. Source topology and
// instance data are restored before gameplay/raycast code runs again.
function defaultHook(object,key){return object[key]===Object.getPrototypeOf(object)[key];}
function attributeVersion(a){return(a.isInterleavedBufferAttribute?a.data:a).version;}
// Gershgorin bound on A^T A also covers sheared/nonuniform instance transforms.
function sphereScale(e){
 const a=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],b=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],c=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];
 const ab=Math.abs(e[0]*e[4]+e[1]*e[5]+e[2]*e[6]),ac=Math.abs(e[0]*e[8]+e[1]*e[9]+e[2]*e[10]),bc=Math.abs(e[4]*e[8]+e[5]*e[9]+e[6]*e[10]);
 return Math.sqrt(Math.max(a+ab+ac,b+ab+bc,c+ac+bc));
}
export function prepareMapInstances(map){
 if(!map?.name?.startsWith('map:'))return[];
 map.updateMatrixWorld(true);const states=[];
 for(const object of map.children){
  const g=object.geometry,m=object.material;
  if(!object.isInstancedMesh||object.matrixAutoUpdate||object.count<2||object.isSkinnedMesh||object.morphTexture||!Array.isArray(object.userData?.alInstanceNames)||!g||g.isInstancedBufferGeometry||Array.isArray(m)||m.transparent||m.isShaderMaterial||m.displacementMap||!defaultHook(object,'onBeforeRender')||!defaultHook(object,'onAfterRender')||!defaultHook(m,'onBeforeRender')||String(m.onBeforeCompile).includes('gl_InstanceID')||Object.values(g.morphAttributes??{}).some(a=>a.length))continue;
  const attributes=Object.entries(g.attributes);
  if(attributes.some(([,a])=>a.isInterleavedBufferAttribute&&a.data.isInstancedInterleavedBuffer||a.isInstancedBufferAttribute&&(a.meshPerAttribute!==1||a.count<object.count)))continue;
  if(m.transmission>0||object.instanceMatrix.meshPerAttribute!==1||object.instanceMatrix.count<object.count||object.instanceColor&&(object.instanceColor.meshPerAttribute!==1||object.instanceColor.count<object.count))continue;
  if(!g.boundingSphere)g.computeBoundingSphere();if(!g.boundingSphere||!Number.isFinite(g.boundingSphere.radius))continue;
  if(!object.boundingSphere)object.computeBoundingSphere();
  const geometry=new g.constructor();for(const [key,a]of attributes)geometry.setAttribute(key,a);
  geometry.setIndex(g.index);for(const group of g.groups)geometry.addGroup(group.start,group.count,group.materialIndex);
  geometry.setDrawRange(g.drawRange.start,g.drawRange.count);geometry.boundingSphere=g.boundingSphere.clone();geometry.boundingBox=g.boundingBox?.clone()??null;
  const matrix=object.instanceMatrix.clone(),color=object.instanceColor?.clone()??null,streams=[{source:object.instanceMatrix,target:matrix}];
  if(color)streams.push({source:object.instanceColor,target:color});
  const owned={};for(const [key,a]of attributes)if(a.isInstancedBufferAttribute){const target=a.clone();geometry.setAttribute(key,target);streams.push({source:a,target});owned[key]=target;}
  for(const {target}of streams)target.setUsage(35048); // DYNAMIC_DRAW; only changed selections upload.
  // Also release object-owned instance buffers through the renderer's geometry
  // disposal path, without releasing any shared position/UV/index buffers.
  owned.__aimInstanceMatrix=matrix;if(color)owned.__aimInstanceColor=color;
  const bounds=new Float64Array(object.count*4),transform=object.matrixWorld.clone(),sphere=g.boundingSphere.clone();
  let finite=true;for(let i=0;i<object.count;i++){object.getMatrixAt(i,transform);transform.premultiply(object.matrixWorld);const e=transform.elements;if(e[3]!==0||e[7]!==0||e[11]!==0||e[15]!==1){finite=false;break;}sphere.copy(g.boundingSphere).applyMatrix4(transform);const radius=g.boundingSphere.radius*sphereScale(e)+.03;if(![sphere.center.x,sphere.center.y,sphere.center.z,radius].every(Number.isFinite)){finite=false;break;}bounds.set([sphere.center.x,sphere.center.y,sphere.center.z,radius],i*4);}if(!finite){geometry.dispose();continue;}
  const ancestors=[];for(let p=object;p;p=p.parent)ancestors.push({node:p,position:p.position.clone(),quaternion:p.quaternion.clone(),scale:p.scale.clone(),matrix:Float64Array.from(p.matrix.elements)});
  states.push({object,source:g,geometry,material:m,materialVersion:m.version,compile:m.onBeforeCompile,attributes,versions:attributes.map(([,a])=>attributeVersion(a)),groups:g.groups.map(g=>({...g})),index:g.index,indexVersion:g.index?.version,count:object.count,matrix:object.instanceMatrix,matrixVersion:object.instanceMatrix.version,color:object.instanceColor,colorVersion:object.instanceColor?.version,world:Float64Array.from(object.matrixWorld.elements),ancestors,drawStart:g.drawRange.start,drawCount:g.drawRange.count,bounds,streams,owned,selected:new Int32Array(object.count).fill(-1),selectedCount:object.count,epoch:-1,warmed:false});
 }
 return states;
}
export function instanceStateValid(s){
 const o=s.object,g=o.geometry,m=o.material;
 if(g!==s.source||m!==s.material||o.matrixAutoUpdate||o.matrixWorldNeedsUpdate||m.version!==s.materialVersion||m.onBeforeCompile!==s.compile||m.transparent||m.displacementMap||m.transmission>0||!defaultHook(o,'onBeforeRender')||!defaultHook(o,'onAfterRender')||!defaultHook(m,'onBeforeRender')||o.count!==s.count||o.instanceMatrix!==s.matrix||s.matrix.version!==s.matrixVersion||o.instanceColor!==s.color||s.color?.version!==s.colorVersion||g.index!==s.index||g.index?.version!==s.indexVersion||g.drawRange.start!==s.drawStart||g.drawRange.count!==s.drawCount||o.morphTexture||g.morphAttributes.position?.length||g.morphAttributes.normal?.length||g.morphAttributes.color?.length)return false;
 let node=o;for(const a of s.ancestors){if(node!==a.node||!node.position.equals(a.position)||!node.quaternion.equals(a.quaternion)||!node.scale.equals(a.scale))return false;for(let i=0;i<16;i++)if(node.matrix.elements[i]!==a.matrix[i])return false;node=node.parent;}if(node)return false;
 if(g.groups.length!==s.groups.length)return false;for(let i=0;i<s.groups.length;i++){const a=g.groups[i],b=s.groups[i];if(a.start!==b.start||a.count!==b.count||a.materialIndex!==b.materialIndex)return false;}
 let keys=0;for(const key in g.attributes){const expected=s.attributes[keys++];if(!expected||key!==expected[0]||g.attributes[key]!==expected[1]||attributeVersion(expected[1])!==s.versions[keys-1])return false;}if(keys!==s.attributes.length)return false;
 for(let i=0;i<16;i++)if(o.matrixWorld.elements[i]!==s.world[i])return false;
 return true;
}
export function selectMapInstances(s,planes,lengths){
 let count=0,changed=false;
 for(let i=0;i<s.count;i++){
  const b=i*4,x=s.bounds[b],y=s.bounds[b+1],z=s.bounds[b+2],radius=s.bounds[b+3];let visible=true;
  for(let p=0;p<24;p+=4)if(planes[p]*x+planes[p+1]*y+planes[p+2]*z+planes[p+3]<-radius*lengths[p>>2]){visible=false;break;}
  if(visible){if(s.selected[count]!==i){s.selected[count]=i;changed=true;}count++;}
 }
 changed||=count!==s.selectedCount;s.selectedCount=count;
 if(changed&&count>0)for(const {source,target}of s.streams){const width=source.itemSize,a=source.array,b=target.array;for(let i=0;i<count;i++){const start=s.selected[i]*width;for(let k=0;k<width;k++)b[i*width+k]=a[start+k];}target.clearUpdateRanges();target.addUpdateRange(0,count*width);target.needsUpdate=true;}
 return s.count-count;
}
function install(s,full=false){
 const o=s.object;if(full){for(const {source,target}of s.streams){target.array.set(source.array);target.clearUpdateRanges();target.needsUpdate=true;}s.selected.fill(-1);s.epoch=-1;}
 o.geometry=s.geometry;o.instanceMatrix=s.streams[0].target;o.instanceColor=s.color?s.streams[1].target:null;o.count=full?s.count:s.selectedCount;
}
function restore(s){const o=s.object;o.geometry=s.source;o.instanceMatrix=s.matrix;o.instanceColor=s.color;o.count=s.count;}
export function releaseMapInstances(states){for(const s of states){s.geometry.attributes=s.owned;s.geometry.index=null;s.geometry.dispose();}}
export function attachMapInstanceVisibility(stage){
 const original={setMapVisual:stage.setMapVisual,render:stage.render,prewarm:stage.prewarm,dispose:stage.dispose};
 const view=stage.camera.projectionMatrix.clone(),last=new Float64Array(16),planes=new Float64Array(24),lengths=new Float64Array(6);let states=[],enabled=true,epoch=0,depth=0;const passes=[];
 const stats={enabled:true,batches:0,hiddenInstances:0,candidateSkippedTriangles:0};
 stage.setMapVisual=function(map){releaseMapInstances(states);states=[];const result=original.setMapVisual.call(stage,map);states=prepareMapInstances(map);stats.batches=states.length;return result;};
 stage.prewarm=async function(...args){
  // Keep source buffers ready for F9/shadow/mutation fallback as well. One 16px
  // draw additionally primes the compact buffers; no additional camera tour.
  const result=await original.prewarm.apply(stage,args),valid=typeof args[0]==='function'?args[0]:()=>true,renderer=stage.renderer;
  if(renderer.shadowMap.enabled||!valid())return result;
  const applied=[],target=renderer.getRenderTarget(),viewport=renderer.getViewport({copy(v){this.x=v.x;this.y=v.y;this.z=v.z;this.w=v.w;return this;}}),scissor=renderer.getScissorTest();
  try{
   for(const s of states)if(instanceStateValid(s)){install(s,true);applied.push(s);}if(!applied.length)return result;
   renderer.setRenderTarget(null);renderer.setScissorTest(false);renderer.setViewport(0,0,16,16);
   drawPreparedSceneResources(renderer,stage.scene,stage.camera,valid);for(const s of applied)s.warmed=true;
   return result;
  }finally{for(const s of applied)restore(s);renderer.setRenderTarget(target);renderer.setViewport(viewport.x,viewport.y,viewport.z,viewport.w);renderer.setScissorTest(scissor);}
 };
 stage.render=function(){
  const capture=globalThis.__aimDetailedPerformance,measuring=capture?.enabled,started=measuring?performance.now():0;
  const shadow=stage.renderer.shadowMap;stats.hiddenInstances=stats.candidateSkippedTriangles=0;
  if(!enabled||stage.scene?.overrideMaterial||stage.renderer.xr?.isPresenting||stage.camera.reversedDepth||stage.camera.coordinateSystem!==undefined&&stage.camera.coordinateSystem!==2000||shadow.enabled&&(shadow.autoUpdate!==false||shadow.needsUpdate))return original.render.call(stage);
  stage.camera.updateMatrixWorld();view.multiplyMatrices(stage.camera.projectionMatrix,stage.camera.matrixWorldInverse);const e=view.elements;let changed=false;
  for(let i=0;i<16;i++)if(last[i]!==e[i]){changed=true;break;}if(changed){last.set(e);epoch++;}
  for(let axis=0;axis<3;axis++)for(let sign=-1;sign<=1;sign+=2){const at=(axis*2+(sign===1?1:0))*4;for(let c=0;c<4;c++)planes[at+c]=e[c*4+3]+sign*e[c*4+axis];lengths[at>>2]=Math.hypot(planes[at],planes[at+1],planes[at+2]);}
  const applied=passes[depth]??(passes[depth]=[]);depth++;applied.length=0;
  try{
   for(const s of states){if(!s.warmed||!instanceStateValid(s))continue;if(s.epoch!==epoch){selectMapInstances(s,planes,lengths);s.epoch=epoch;}const hidden=s.count-s.selectedCount;stats.hiddenInstances+=hidden;stats.candidateSkippedTriangles+=hidden*(s.index?.count??s.source.attributes.position.count)/3;install(s);applied.push(s);}
   if(measuring)capture.measure?.('mapCullingCpuMs',performance.now()-started);
   return original.render.call(stage);
  }finally{for(const s of applied)restore(s);applied.length=0;depth--;}
 };
 stage.mapInstanceVisibility={setEnabled(value){enabled=!!value;stats.enabled=enabled;},snapshot:()=>({...stats})};
 stage.dispose=function(){releaseMapInstances(states);states=[];return original.dispose.call(stage);};return stage;
}
