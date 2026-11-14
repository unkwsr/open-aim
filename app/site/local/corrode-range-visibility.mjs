// Conservative frustum rejection inside existing indexed map batches. The
// native index/attributes and triangle order stay intact; no buffer compaction.
const RANGE_MAPS=new Set(['map:rook','map:triad']);
export function prepareCorrodeRanges(map){
 if(!RANGE_MAPS.has(map?.name))return[];
 map.updateMatrixWorld(true);const states=[];
 for(const object of map.children){
  const geometry=object.geometry,material=object.material,parts=object.userData?.alMergedRanges,spheres=object.userData?.alPartSpheres;
  if(!object.isMesh||object.isInstancedMesh||object.isSkinnedMesh||object.isBatchedMesh||object.children.length||!geometry?.index||!geometry.attributes.position||geometry.isInstancedBufferGeometry||geometry.groups.length||geometry.drawRange.start!==0||geometry.drawRange.count<geometry.index.count||Array.isArray(material)||material.transparent||material.isShaderMaterial||material.displacementMap||geometry.morphAttributes?.position||!Array.isArray(parts)||parts.length<2||spheres?.length!==parts.length*4||geometry.index.array.byteLength>=2147483648)continue;
  let end=0,valid=true;const bounds=new Float64Array(spheres.length),sphere=geometry.boundingSphere?.clone();
  if(!sphere){geometry.computeBoundingSphere();}const sample=sphere??geometry.boundingSphere?.clone();if(!sample)continue;
  for(let i=0;i<parts.length;i++){
   const part=parts[i];if(part.start!==end||!Number.isInteger(part.count)||part.count<0||part.count%3){valid=false;break;}end+=part.count;
   sample.center.set(spheres[i*4],spheres[i*4+1],spheres[i*4+2]);sample.radius=spheres[i*4+3];sample.applyMatrix4(object.matrixWorld);
   if(![sample.center.x,sample.center.y,sample.center.z,sample.radius].every(Number.isFinite)||sample.radius<0){valid=false;break;}
   bounds.set([sample.center.x,sample.center.y,sample.center.z,sample.radius],i*4);
  }
  if(!valid||end!==geometry.index.count)continue;
  const state={object,geometry,material,materialVersion:material.version,onBeforeCompile:material.onBeforeCompile,position:geometry.attributes.position,positionVersion:geometry.attributes.position.version,index:geometry.index,indexVersion:geometry.index.version,matrix:Float64Array.from(object.matrixWorld.elements),parts,partStarts:Int32Array.from(parts,p=>p.start),partCounts:Int32Array.from(parts,p=>p.count),bounds,byteStarts:new Int32Array(parts.length),counts:new Int32Array(parts.length),count:0,selectedIndices:0,hiddenParts:0,camera:null,enabled:false,used:false};state.valid=()=>rangeStateValid(state);states.push(state);
 }
 return states;
}
export function rangeStateValid(s){
 const o=s.object,g=o.geometry;
 if(g!==s.geometry||o.isSkinnedMesh||o.isInstancedMesh||o.isBatchedMesh||g.isInstancedBufferGeometry||g.morphAttributes?.position||o.material!==s.material||s.material.version!==s.materialVersion||s.material.onBeforeCompile!==s.onBeforeCompile||s.material.transparent||s.material.displacementMap||g.index!==s.index||g.index.version!==s.indexVersion||g.attributes.position!==s.position||s.position.version!==s.positionVersion||g.drawRange.start!==0||g.drawRange.count<s.index.count||g.groups.length)return false;
 for(let i=0;i<16;i++)if(s.matrix[i]!==o.matrixWorld.elements[i])return false;
 if(s.cameraState)for(let i=0;i<16;i++)if(s.cameraState[i]!==s.camera.matrixWorld.elements[i]||s.cameraState[16+i]!==s.camera.projectionMatrix.elements[i])return false;
 return true;
}
export function selectCorrodeRanges(state,planes,lengths,camera){
 const {partStarts,partCounts,bounds,counts,byteStarts}=state;let spans=0,indices=0,hidden=0,runStart=-1,runCount=0;
 for(let i=0;i<partStarts.length;i++){
  const at=i*4,x=bounds[at],y=bounds[at+1],z=bounds[at+2],radius=bounds[at+3]+.03;let visible=true;
  for(let p=0;p<24;p+=4)if(planes[p]*x+planes[p+1]*y+planes[p+2]*z+planes[p+3]<-radius*lengths[p>>2]){visible=false;break;}
  if(visible){if(runStart<0)runStart=partStarts[i];runCount+=partCounts[i];indices+=partCounts[i];}else{hidden++;if(runStart>=0){byteStarts[spans]=runStart*state.index.array.BYTES_PER_ELEMENT;counts[spans++]=runCount;runStart=-1;runCount=0;}}
 }
 if(runStart>=0){byteStarts[spans]=runStart*state.index.array.BYTES_PER_ELEMENT;counts[spans++]=runCount;}
 state.count=spans;state.selectedIndices=indices;state.hiddenParts=hidden;state.camera=camera;state.enabled=hidden>0;return hidden;
}
export function copyRangeFrustum(camera,view,planes,lengths){
 const m=view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements;
 for(let axis=0;axis<3;axis++)for(let sign=-1;sign<=1;sign+=2){const at=(axis*2+(sign===1?1:0))*4;for(let c=0;c<4;c++)planes[at+c]=m[c*4+3]+sign*m[c*4+axis];lengths[at>>2]=Math.hypot(planes[at],planes[at+1],planes[at+2]);}
}
export function attachCorrodeRangeVisibility(stage){
 const original={setMapVisual:stage.setMapVisual,render:stage.render,dispose:stage.dispose},renderer=stage.renderer;
 const available=renderer.extensions.has('WEBGL_multi_draw'),planes=new Float64Array(24),lengths=new Float64Array(6),view=stage.camera.projectionMatrix.clone(),cameraState=new Float64Array(32),lastView=new Float64Array(16);let epoch=0;
 let states=[],active=false,enabled=true,stats={mode:'frustum-ranges',enabled:false,available,active:false,batches:0,hiddenParts:0,candidateSkippedTriangles:0,candidateRanges:0,indexUploadBytes:0};
 const release=()=>{for(const state of states)if(state.object.__aimRangeDraw===state)delete state.object.__aimRangeDraw;states=[];};
 stage.setMapVisual=function(map){release();original.setMapVisual.call(stage,map);active=RANGE_MAPS.has(map?.name);states=available&&active?prepareCorrodeRanges(map):[];epoch++;for(const s of states){s.object.__aimRangeDraw=s;s.cameraState=cameraState;s.camera=stage.camera;}stats={...stats,map:map?.name??'',active:active&&available,enabled:active&&available&&enabled,batches:states.length,hiddenParts:0,candidateSkippedTriangles:0,candidateRanges:0};};
 stage.render=function(){
  const capture=globalThis.__aimDetailedPerformance,measure=capture?.enabled,at=measure?performance.now():0;
  stats.hiddenParts=stats.candidateSkippedTriangles=stats.candidateRanges=0;for(const s of states){s.enabled=false;s.used=false;}
  const shadow=renderer.shadowMap,shadowRefresh=shadow.enabled&&(shadow.autoUpdate!==false||shadow.needsUpdate),legacy=stage.mapSectionVisibility?.enabled;
  stats.active=active&&available&&!legacy;stats.enabled=stats.active&&enabled;renderer.__aimCorrodeRangesActive=false;
  try{
   if(stats.enabled&&!shadowRefresh&&!stage.camera.reversedDepth&&(stage.camera.coordinateSystem===undefined||stage.camera.coordinateSystem===2000)){
    stage.updateMapVisibility(stage.camera,false);copyRangeFrustum(stage.camera,view,planes,lengths);
    cameraState.set(stage.camera.matrixWorld.elements);cameraState.set(stage.camera.projectionMatrix.elements,16);let changed=false;for(let i=0;i<16;i++)if(lastView[i]!==view.elements[i]){changed=true;break;}if(changed){epoch++;lastView.set(view.elements);}
    for(const s of states){if(!s.object.visible||!rangeStateValid(s))continue;if(s.epoch!==epoch){selectCorrodeRanges(s,planes,lengths,stage.camera);s.epoch=epoch;}else s.enabled=s.hiddenParts>0;stats.hiddenParts+=s.hiddenParts;stats.candidateSkippedTriangles+=(s.index.count-s.selectedIndices)/3;if(s.enabled)stats.candidateRanges+=s.count;}
    renderer.__aimCorrodeRangesActive=true;
   }
   if(measure)capture.measure('mapCullingCpuMs',performance.now()-at);
   return original.render.call(stage);
  }finally{renderer.__aimCorrodeRangesActive=false;}
 };
 stage.corrodeRangeVisibility={get possible(){return active&&available;},get on(){return enabled;},get active(){return active&&available&&!stage.mapSectionVisibility?.enabled;},setEnabled(value){enabled=!!value;for(const s of states)s.enabled=false;},snapshot:()=>({...stats})};
 stage.dispose=function(){renderer.__aimCorrodeRangesActive=false;release();return original.dispose.call(stage);};return stage;
}
