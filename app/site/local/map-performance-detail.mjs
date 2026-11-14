// Load-time map optimization only. Collision snapshots are collected by the
// caller BEFORE this pass. Structural/unknown names always remain visible.
const DECORATION=/^(?:Grass_|Papers_|TrashGround_|Clothes_|Clothing_|Vegetation_|Plant_|Plants_|Foliage_|Plushie_|Books?_|Bottles?_|Scrolls_)/i;
const KEEP=/wall|hedge|trunk|tree|collision|barrier|cover|platform|groundchunk|climb|rope|clothesrack|coatrack|shelf|shelves|planter|pot(?:ted)?_|container/i;
export function mapPerformanceDetailEnabled(){
 try{return globalThis.localStorage?.getItem('al-map-performance-detail')!=='full';}catch{return true;}
}
export function isDisposableMapDetail(name,sphere){
 // Limit removals to small decorations; large foliage/unknown bounds stay.
 return typeof name==='string'&&DECORATION.test(name)&&!KEEP.test(name)&&sphere&&Number.isFinite(sphere.radius)&&sphere.radius<=2.5;
}
export function optimizeMapDetails(map,{enabled=mapPerformanceDetailEnabled()}={}){
 if(!enabled){map.userData.mapPerformanceDetail={version:2,enabled:false,removedMeshes:0,removedTriangles:0,byFamily:{}};return map;}
 map.updateMatrixWorld(true);const removals=[],stats={version:2,enabled:true,removedMeshes:0,removedTriangles:0,byFamily:{}};
 map.traverse(object=>{
  if(!object.isMesh||object.isSkinnedMesh||object.isInstancedMesh||object.isBatchedMesh||object.children.length)return;
  let name=object.name??'';for(let p=object;p;p=p.parent)if(p.name?.includes('#')){name=p.name;break;}
  const geometry=object.geometry;if(!geometry?.attributes?.position)return;
  if(!geometry.boundingSphere)geometry.computeBoundingSphere();if(!geometry.boundingSphere)return;
  const sphere=geometry.boundingSphere.clone().applyMatrix4(object.matrixWorld);
  if(!isDisposableMapDetail(name,sphere))return;
  const triangles=(geometry.index?.count??geometry.attributes.position.count)/3,family=name.split('_')[0];
  stats.removedMeshes++;stats.removedTriangles+=triangles;stats.byFamily[family]=(stats.byFamily[family]??0)+triangles;removals.push(object);
 });
 for(const object of removals)object.parent?.remove(object);
 // Do not dispose shared source geometry/materials: collision/cache/other
 // instances may still own them. The asset cache releases these as before.
 map.userData.mapPerformanceDetail=stats;return map;
}
export function splitOversizedMapBatch(group,{enabled=mapPerformanceDetailEnabled(),maxTriangles=64000,cellSize=24}={}){
 const items=group.items;if(!enabled||!items||items.length<2)return[group];
 const cost=item=>(item.geometry.index?.count??item.geometry.attributes?.position?.count??0)/3;
 let total=0;for(const item of items)total+=cost(item);if(total<=maxTriangles)return[group];
 const cells=new Map();
 for(const item of items){
  const geometry=item.geometry;if(!geometry.boundingSphere)geometry.computeBoundingSphere();
  const sphere=geometry.boundingSphere;if(!sphere)return[group];
  const p=sphere.center,e=item.matrix.elements,w=e[3]*p.x+e[7]*p.y+e[11]*p.z+e[15];
  const x=(e[0]*p.x+e[4]*p.y+e[8]*p.z+e[12])/w,y=(e[1]*p.x+e[5]*p.y+e[9]*p.z+e[13])/w,z=(e[2]*p.x+e[6]*p.y+e[10]*p.z+e[14])/w;
  if(![x,y,z].every(Number.isFinite))return[group];
  const key=[Math.floor(x/cellSize),Math.floor(y/cellSize),Math.floor(z/cellSize)].join(',');
  if(!cells.has(key))cells.set(key,[]);cells.get(key).push(item);
 }
 const result=[];
 for(const members of cells.values()){
  let next=[],triangles=0;
  for(const item of members){const count=cost(item);if(next.length&&triangles+count>maxTriangles){result.push({...group,items:next});next=[];triangles=0;}next.push(item);triangles+=count;}
  if(next.length)result.push({...group,items:next});
 }
 return result;
}
