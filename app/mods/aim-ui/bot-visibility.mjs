// Conservative convex shadow-volume proof against actual opaque visual triangles.
// Unknown, untested, stale or uncertain always means visible. No collision walls.
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const opaque=m=>m&&!m.transparent&&m.opacity===1&&!(m.alphaTest>0)&&!m.alphaMap&&m.depthWrite!==false&&m.depthTest!==false&&!m.polygonOffset&&!m.clippingPlanes?.length&&!m.wireframe&&m.visible!==false;
function shown(object){for(let o=object;o;o=o.parent)if(!o.visible)return false;return true;}
export function triangleHidesBox(t,eye,center,radius){
 const [a,b,c]=t.points;
 const e1x=b[0]-a[0],e1y=b[1]-a[1],e1z=b[2]-a[2],e2x=c[0]-a[0],e2y=c[1]-a[1],e2z=c[2]-a[2];
 let nx=e1y*e2z-e1z*e2y,ny=e1z*e2x-e1x*e2z,nz=e1x*e2y-e1y*e2x;
 const length=Math.hypot(nx,ny,nz);if(!(length>1e-8)||!Number.isFinite(radius)||radius<0)return false;
 const side=nx*(eye[0]-a[0])+ny*(eye[1]-a[1])+nz*(eye[2]-a[2]);
 if(Math.abs(side)<1e-6*length||t.side!==2&&(t.side===1?side>0:side<0))return false;
 const r=radius+.05;if(side<0){nx=-nx;ny=-ny;nz=-nz;}
 if(nx*(center[0]-a[0])+ny*(center[1]-a[1])+nz*(center[2]-a[2])+r*(Math.abs(nx)+Math.abs(ny)+Math.abs(nz))>=-.005*length)return false;
 const tx=center[0]-eye[0],ty=center[1]-eye[1],tz=center[2]-eye[2];
 for(let i=0;i<3;i++){
  const p=t.points[i],q=t.points[(i+1)%3],v=t.points[(i+2)%3],px=p[0]-eye[0],py=p[1]-eye[1],pz=p[2]-eye[2],qx=q[0]-eye[0],qy=q[1]-eye[1],qz=q[2]-eye[2];
  nx=py*qz-pz*qy;ny=pz*qx-px*qz;nz=px*qy-py*qx;
  if(nx*(v[0]-eye[0])+ny*(v[1]-eye[1])+nz*(v[2]-eye[2])<0){nx=-nx;ny=-ny;nz=-nz;}
  if(nx*tx+ny*ty+nz*tz-r*(Math.abs(nx)+Math.abs(ny)+Math.abs(nz))<=.005*Math.hypot(nx,ny,nz))return false;
 }
 return true;
}
function hit(t,eye,dir,max){
 const [a,b,c]=t.points,e1x=b[0]-a[0],e1y=b[1]-a[1],e1z=b[2]-a[2],e2x=c[0]-a[0],e2y=c[1]-a[1],e2z=c[2]-a[2];
 const px=dir[1]*e2z-dir[2]*e2y,py=dir[2]*e2x-dir[0]*e2z,pz=dir[0]*e2y-dir[1]*e2x,det=e1x*px+e1y*py+e1z*pz;
 if(Math.abs(det)<1e-9||t.side!==2&&(t.side===1?det>0:det<0))return null;
 const ox=eye[0]-a[0],oy=eye[1]-a[1],oz=eye[2]-a[2],u=(ox*px+oy*py+oz*pz)/det;if(u<0||u>1)return null;
 const qx=oy*e1z-oz*e1y,qy=oz*e1x-ox*e1z,qz=ox*e1y-oy*e1x,v=(dir[0]*qx+dir[1]*qy+dir[2]*qz)/det;
 if(v<0||u+v>1)return null;const distance=(e2x*qx+e2y*qy+e2z*qz)/det;return distance>.005&&distance<max?distance:null;
}
function bounds(items){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const t of items)for(let i=0;i<3;i++){min[i]=Math.min(min[i],t.min[i]);max[i]=Math.max(max[i],t.max[i])}return {min,max};}
function tree(items,ordered=false){if(!items.length)return null;const box=bounds(items);if(items.length<=12)return {...box,items};let axis=0;for(let i=1;i<3;i++)if(box.max[i]-box.min[i]>box.max[axis]-box.min[axis])axis=i;if(!ordered)items.sort((a,b)=>(a.min[axis]+a.max[axis])-(b.min[axis]+b.max[axis]));const mid=items.length>>1;return {...box,left:tree(items.slice(0,mid),ordered),right:tree(items.slice(mid),ordered)};}
function intersects(node,eye,dir,max){let lo=0,hi=max;for(let i=0;i<3;i++){if(Math.abs(dir[i])<1e-12){if(eye[i]<node.min[i]||eye[i]>node.max[i])return false;continue;}let a=(node.min[i]-eye[i])/dir[i],b=(node.max[i]-eye[i])/dir[i];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return false;}return true;}
export function createBotVisibility({allowBuild=false}={}){
 let generation=0,root=null,bvh=null,records=[],cache=new WeakMap(),owners=new WeakMap(),ownerChecks=new WeakMap(),frame=0,budget=0,eye=[0,0,0],forward=[0,0,-1],near=0,layerMask=1,stats={triangles:0,hidden:0,tests:0,queries:0,ready:false};
 async function setMap(map){
  if(map===root)return;
  const token=++generation;root=map;bvh=null;records=[];cache=new WeakMap();owners=new WeakMap();ownerChecks=new WeakMap();stats={triangles:0,hidden:0,tests:0,queries:0,ready:false};if(!map)return;
  let selected=null,ordered=false;
  if(!allowBuild){
   const id=/^map:([a-z0-9_-]+)$/.exec(map.name??'')?.[1];if(!id)return;
   try{const response=await fetch('/aim-occlusion/'+id+'.json');if(!response.ok)return;const data=await response.json();if(data.format!==1||!Array.isArray(data.triangles))return;ordered=data.ordered===true;selected=new Map();for(const [owner,instance,start]of data.triangles){if(![owner,instance,start].every(n=>Number.isInteger(n)&&n>=0))continue;let m=selected.get(owner);if(!m)selected.set(owner,m=new Map());let a=m.get(instance);if(!a)m.set(instance,a=[]);a.push(start)}}catch{return;}
   if(token!==generation)return;
  }
  // Keep owner ordinals independent of eligibility, so old candidate lists stay safe.
  map.updateMatrixWorld(true);const meshes=[];map.traverse(o=>{if(o.isMesh&&!o.isBatchedMesh&&!Array.isArray(o.material))meshes.push(o)});
  const triangles=[];let processed=0;
  for(let ownerIndex=0;ownerIndex<meshes.length;ownerIndex++){
   const mesh=meshes[ownerIndex];if(!opaque(mesh.material)||!shown(mesh)||(selected&&!selected.has(ownerIndex)))continue;
   const geometry=mesh.geometry,position=geometry.attributes.position,index=geometry.index;if(!position)continue;
   owners.set(mesh,{geometry,positionVersion:position.version,indexVersion:index?.version,instanceVersion:mesh.instanceMatrix?.version,matrix:[...mesh.matrixWorld.elements],rangeStart:geometry.drawRange.start,rangeCount:geometry.drawRange.count});
   const count=index?.count??position.count,instance=mesh.matrixWorld.clone(),matrix=mesh.matrixWorld.clone();
   for(let instanceId=0;instanceId<(mesh.isInstancedMesh?mesh.count:1);instanceId++){
    const starts=selected?.get(ownerIndex)?.get(instanceId);if(selected&&!starts)continue;
    if(mesh.isInstancedMesh){mesh.getMatrixAt(instanceId,instance);matrix.multiplyMatrices(mesh.matrixWorld,instance)}else matrix.copy(mesh.matrixWorld);
    const m=matrix.elements,flip=mesh.matrixWorld.determinant()<0;
    for(let run=0;run<(starts?starts.length:Math.floor(count/3));run++){
     const j=starts?starts[run]:run*3,range=geometry.drawRange;if(j+2>=count||j<(range?.start??0)||j+2>=(range?.start??0)+(range?.count??Infinity))continue;
     const points=[];
     for(let k=0;k<3;k++){const vertex=index?index.getX(j+k):j+k,x=position.getX(vertex),y=position.getY(vertex),z=position.getZ(vertex);points.push([m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]])}
     if(flip)[points[1],points[2]]=[points[2],points[1]];
     const n=cross(sub(points[1],points[0]),sub(points[2],points[0]));
     // Small triangles cannot usually cover the generously expanded actor bound.
     if(dot(n,n)>=16){const min=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...points.map(p=>p[i])));triangles.push({points,min,max,side:mesh.material.side,owner:mesh,material:mesh.material,record:[ownerIndex,instanceId,j]});records.push([ownerIndex,instanceId,j])}
     if(++processed%(selected?500:12000)===0){await new Promise(r=>setTimeout(r,0));if(token!==generation)return;}
    }
   }
  }
  if(token!==generation)return;
  bvh=tree(triangles,ordered);stats.triangles=triangles.length;stats.ready=true;
 }
 function valid(triangle){
  if(!triangle)return false;const object=triangle.owner;
  let checked=ownerChecks.get(object);
  if(checked?.frame!==frame){const original=owners.get(object),geometry=object.geometry;let ok=!!original&&shown(object)&&!!(object.layers.mask&layerMask)&&geometry===original.geometry&&geometry.attributes.position.version===original.positionVersion&&geometry.index?.version===original.indexVersion&&object.instanceMatrix?.version===original.instanceVersion&&geometry.drawRange.start===original.rangeStart&&geometry.drawRange.count===original.rangeCount;
   for(let i=0;ok&&i<16;i++)if(original.matrix[i]!==object.matrixWorld.elements[i])ok=false;
   checked={frame,ok};ownerChecks.set(object,checked);
  }
  return checked.ok&&object.material===triangle.material&&opaque(triangle.material)&&triangle.side===triangle.material.side;
 }
 function proves(t,center,radius){
  // A triangle crossing the near plane may be clipped away: fail open.
  if(!valid(t))return false;for(const p of t.points)if((p[0]-eye[0])*forward[0]+(p[1]-eye[1])*forward[1]+(p[2]-eye[2])*forward[2]<=near+.01)return false;
  return triangleHidesBox(t,eye,center,radius);
 }
 function begin(camera){frame++;budget=2;const m=camera.matrixWorld?.elements;eye=m?[m[12],m[13],m[14]]:[camera.position.x,camera.position.y,camera.position.z];forward=m?[-m[8],-m[9],-m[10]]:[0,0,-1];near=camera.near??0;layerMask=camera.layers?.mask??1;stats.hidden=0;stats.tests=0;stats.queries=0;}
 function hidden(entry,x,y,z,radius){
  if(!bvh||!root||!shown(root)||![x,y,z,radius,...eye].every(Number.isFinite))return false;
  stats.tests++;const center=[x,y,z];let state=cache.get(entry);
  if(!state){state={triangle:null,next:0};cache.set(entry,state)}
  if(state.triangle&&proves(state.triangle,center,radius)){stats.hidden++;return true;}
  state.triangle=null; // Reveal on THIS frame before considering any query budget.
  if(budget<=0||frame<state.next)return false;
  budget--;stats.queries++;state.next=frame+15;
  const direction=sub(center,eye),distance=Math.hypot(...direction);if(!(distance>radius))return false;
  for(let i=0;i<3;i++)direction[i]/=distance;
  const hits=[],stack=[bvh];
  while(stack.length){const node=stack.pop();if(!intersects(node,eye,direction,distance))continue;if(node.items){for(const t of node.items){const at=hit(t,eye,direction,distance);if(at!==null)hits.push({t,at})}}else stack.push(node.left,node.right)}
  hits.sort((a,b)=>a.at-b.at);
  for(const {t}of hits.slice(0,12))if(proves(t,center,radius)){state.triangle=t;stats.hidden++;return true;}
  return false;
 }
 return {setMap,begin,hidden,snapshot:()=>({...stats}),exportMap:()=>{const triangles=[];function visit(node){if(!node)return;if(node.items)for(const t of node.items)triangles.push(t.record);else{visit(node.left);visit(node.right)}}visit(bvh);return {format:1,ordered:true,triangles}}
};
}
// Each engine/camera owns its map: settings previews must not replace game data.
export function createBotVisibilityRegistry(factory=createBotVisibility){
 const controllers=new WeakMap();let current=null;
 return {
  setMap(map,camera){if(!camera)return Promise.resolve();let controller=controllers.get(camera);if(!controller){controller=factory();controllers.set(camera,controller)}return controller.setMap(map)},
  begin(camera){current=controllers.get(camera)??null;current?.begin(camera)},
  hidden(entry,x,y,z,radius){return current?.hidden(entry,x,y,z,radius)??false},
  snapshot(camera){return (camera?controllers.get(camera):current)?.snapshot()??{ready:false,hidden:0}}
 };
}
if(typeof window!=='undefined')window.__aimBotVisibility??=createBotVisibilityRegistry();
