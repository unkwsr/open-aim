// Virtual sections inside native batches: preserve vertices, materials and draw calls.
const jobs=new WeakMap(),layouts=new WeakMap(),indices=new WeakMap();
const depthSafe=material=>material.depthTest!==false&&(material.depthFunc===undefined||material.depthFunc===2||material.depthFunc===3||material.depthFunc===4);
export const getMapSections=map=>layouts.get(map)??[];
export const getMapSectionIndex=object=>indices.get(object);
// aim-section-reuse (2026-11-13): the game re-clones the map at every round start. Each clone used to get
// brand-new section containers and working index buffers, uploaded on the first frames of the round
// (a ~55 ms hitch about 0.5 s in, measured in Worker Test). Containers are now kept per source batch
// geometry and handed to the next clone of the same map; another map's leftovers are disposed.
const spare=new Map();// sourceGeometry -> {geometry,working,mapName}
function disposeSpare(entry){
 // Geometry.dispose normally deletes its attribute/index GPU buffers. Only the
 // compacted index is ours; native cached geometry still owns shared vertices
 // and its original index. Detach those before disposing this container/VAO.
 for(const name of Object.keys(entry.geometry.attributes))entry.geometry.deleteAttribute(name);
 entry.geometry.setIndex(entry.working);entry.geometry.dispose();
}
export function releaseMapSections(map,expected){
 if(layouts.get(map)!==expected)return;
 for(const state of expected){
  restoreMapSection(state);if(state.object.geometry===state.geometry)state.object.geometry=state.sourceGeometry;
  indices.delete(state.object);
  const old=spare.get(state.sourceGeometry);if(old&&old.geometry!==state.geometry)disposeSpare(old);
  spare.set(state.sourceGeometry,{geometry:state.geometry,working:state.working,mapName:map?.name??''});
 }
 layouts.delete(map);jobs.delete(map);
}
export function prepareMapSections(map,{cellSize=12}={}){
 if(jobs.has(map))return jobs.get(map);
 const job=prepare(map,cellSize);jobs.set(map,job);return job;
}
export function restoreMapSection(state){
 const {object,geometry,working,original}=state;
 if(object.geometry!==geometry||geometry.index!==working&&!(state.active&&geometry.index===original))return;
 // Working storage belongs to this feature: unknown edits fail open to native
 // topology. An entirely replaced geometry/index is left to its new owner.
 geometry.setIndex(original);geometry.setDrawRange(state.rangeStart,state.rangeCount);
 if(working.version!==state.version){state.packedParts=[];state.packedStarts=[];state.version=working.version;}
 object.userData.alMergedRanges=state.parts;state.hiddenKey='';state.active=false;
}
export function applyMapSections(state,hidden){
 const key=hidden.join(',');if(key===state.hiddenKey)return 0;
 if(!hidden.length){restoreMapSection(state);return 0;}
 const blocked=new Set(hidden),{geometry,original,working}=state;
 // A single surviving span can use the immutable native index directly. No
 // copy, buffer update or index allocation is needed, including an empty draw.
 let first=-1,last=-1,visibleCount=0;
 for(let i=0;i<state.parts.length;i++)if(!blocked.has(state.partSections[i])){if(first<0)first=i;last=i;visibleCount++;}
 if(visibleCount===0||last-first+1===visibleCount){
  const start=first<0?0:state.parts[first].start,count=first<0?0:state.parts[last].start+state.parts[last].count-start;
  geometry.setIndex(original);geometry.setDrawRange(start,count);
  const ranges=state.spanRanges??(state.spanRanges=[]);ranges.length=0;
  if(first>=0)for(let i=first;i<=last;i++)ranges.push(state.parts[i]);
  state.object.userData.alMergedRanges=ranges;
  state.drawStart=start;state.count=count;state.hiddenKey=key;state.active=true;
  return 0;
 }
 let at=0,dirtyStart=Infinity,dirtyEnd=0;const ranges=state.compactRanges??(state.compactRanges=[]);ranges.length=0;
 const previousParts=state.packedParts??[],previousStarts=state.packedStarts??[];
 const nextParts=state.nextPackedParts??[],nextStarts=state.nextPackedStarts??[];nextParts.length=0;nextStarts.length=0;
 const metadata=state.compactMetadata??(state.compactMetadata=state.parts.map(part=>({...part})));
 for(let i=0;i<state.parts.length;i++){
  if(blocked.has(state.partSections[i]))continue;
  const part=state.parts[i],slot=nextParts.length;
  if(previousParts[slot]!==i||previousStarts[slot]!==at){
   working.array.set(original.array.subarray(part.start,part.start+part.count),at);
   dirtyStart=Math.min(dirtyStart,at);dirtyEnd=at+part.count;
  }
  nextParts.push(i);nextStarts.push(at);
  const range=metadata[i];range.start=at;ranges.push(range);at+=part.count;
 }
 // Preserve unchanged prefixes/suffixes and upload only the dirty span. A
 // shortened draw may need no upload at all. Cached shadows use native indices.
 if(dirtyEnd>dirtyStart){
  // The renderer may skip a batch for several frames. Retain its pending dirty
  // range until an actual upload; CPU cache reuse does not prove GPU delivery.
  for(const range of working.updateRanges??[]){dirtyStart=Math.min(dirtyStart,range.start);dirtyEnd=Math.max(dirtyEnd,range.start+range.count);}
  working.clearUpdateRanges();working.addUpdateRange(dirtyStart,dirtyEnd-dirtyStart);working.needsUpdate=true;
 }
 state.packedParts=nextParts;state.packedStarts=nextStarts;state.nextPackedParts=previousParts;state.nextPackedStarts=previousStarts;
 geometry.setIndex(working);geometry.setDrawRange(0,at);state.object.userData.alMergedRanges=ranges;
 state.version=working.version;state.count=at;state.hiddenKey=key;state.active=true;
 return Math.max(0,dirtyEnd-(Number.isFinite(dirtyStart)?dirtyStart:0))*working.array.BYTES_PER_ELEMENT;
}
export function mapSectionStateValid(state){
 const {object:o,geometry:g}=state;
 return o.geometry===g&&o.material===state.material&&g.attributes.position===state.position&&state.position.version===state.positionVersion&&state.original.version===state.originalVersion&&
  (g.index===state.original&&g.drawRange.start===(state.active?state.drawStart:state.rangeStart)&&g.drawRange.count===(state.active?state.count:state.rangeCount)||g.index===state.working&&state.working.version===state.version&&g.drawRange.start===0&&g.drawRange.count===state.count)&&
  !o.material.transparent&&depthSafe(o.material)&&!o.material.displacementMap&&!o.material.isShaderMaterial&&!g.morphAttributes?.position&&state.matrix.every((value,i)=>value===o.matrixWorld.elements[i]);
}
async function prepare(map,cellSize){
 if(!(cellSize>0))throw Error('Invalid section size');
 map.updateMatrixWorld(true);const states=[],uses=new Map();map.traverse(o=>{if(o.isMesh)uses.set(o.geometry,(uses.get(o.geometry)??0)+1)});
 for(const [source,entry]of spare)if(entry.mapName!==(map.name??'')){disposeSpare(entry);spare.delete(source);}
 let reused=0;
 for(const object of map.children){
  const g=object.geometry,parts=object.userData.alMergedRanges,spheres=object.userData.alPartSpheres;
  if(!object.isMesh||object.isInstancedMesh||object.isSkinnedMesh||object.isBatchedMesh||object.children.length||Array.isArray(object.material)||object.material.transparent||!depthSafe(object.material)||object.material.displacementMap||object.material.isShaderMaterial||g.morphAttributes?.position)continue;
  if(uses.get(g)!==1||!g.index?.array||!Array.isArray(parts)||parts.length<2||spheres?.length!==parts.length*4||g.groups.length||g.drawRange.start!==0||g.drawRange.count<g.index.count)continue;
  let at=0,valid=true;for(const part of parts){if(part.start!==at||!Number.isInteger(part.count)||part.count<0||part.count%3){valid=false;break}at+=part.count}if(!valid||at!==g.index.count)continue;
  if(!g.boundingSphere)g.computeBoundingSphere();
  const cells=new Map(),partSections=[];
  for(let i=0;i<parts.length;i++){
   const sphere=g.boundingSphere.clone();sphere.center.set(spheres[i*4],spheres[i*4+1],spheres[i*4+2]);sphere.radius=spheres[i*4+3];sphere.applyMatrix4(object.matrixWorld);
   if(![sphere.center.x,sphere.center.y,sphere.center.z,sphere.radius].every(Number.isFinite)){valid=false;break}
   const key=[sphere.center.x,sphere.center.y,sphere.center.z].map(v=>Math.floor(v/cellSize)).join(',');
   let section=cells.get(key);if(!section){section={id:cells.size,sphere:sphere.clone()};cells.set(key,section)}else section.sphere.union(sphere);
   partSections.push(section.id);
  }
  if(!valid||cells.size<2)continue;
  const original=g.index,kept=spare.get(g);
  const keep=kept&&kept.working.array.length===original.array.length&&Object.keys(g.attributes).every(name=>kept.geometry.attributes[name]===g.attributes[name]);
  if(kept&&!keep){disposeSpare(kept);spare.delete(g);}
  let working,geometry;
  if(keep){
   // Same source batch as a previous clone: reuse its container (VAO) and working index buffer.
   spare.delete(g);reused++;working=kept.working;geometry=kept.geometry;
   geometry.setIndex(original);geometry.setDrawRange(g.drawRange.start,g.drawRange.count);
  }else{
   working=new original.constructor(new original.array.constructor(original.array.length),1);working.setUsage(35048);working.onUpload(()=>working.clearUpdateRanges());
   // loadMapVisual clones objects but shares native geometry. Own only the geometry
   // container/index binding, so other maps/cameras and the asset cache stay intact.
   geometry=new g.constructor();for(const [name,attribute]of Object.entries(g.attributes))geometry.setAttribute(name,attribute);
   geometry.setIndex(original);geometry.setDrawRange(g.drawRange.start,g.drawRange.count);geometry.boundingBox=g.boundingBox?.clone()??null;geometry.boundingSphere=g.boundingSphere.clone();geometry.userData={...g.userData};
  }
  object.geometry=geometry;
  const state={object,geometry,sourceGeometry:g,material:object.material,position:g.attributes.position,positionVersion:g.attributes.position.version,original,originalVersion:original.version,working,version:working.version,count:0,rangeStart:g.drawRange.start,rangeCount:g.drawRange.count,parts,partSections,sections:[...cells.values()],matrix:[...object.matrixWorld.elements],hiddenKey:'',active:false};
  indices.set(object,state);states.push(state);
  // Yield only when a new container was built; reused ones are cheap, so the re-cloned map mounts at once.
  if(!keep)await new Promise(resolve=>setTimeout(resolve,0));
 }
 layouts.set(map,states);map.userData.mapSectionsVersion=2;
 map.userData.mapSectionsStats={batches:map.children.length,eligible:states.length,sections:states.reduce((n,s)=>n+s.sections.length,0),reused};
 globalThis.__aimDetailedPerformance?.event?.('map-sections-prepared',{map:map.name??'',eligible:states.length,reused});
 return map;
}
