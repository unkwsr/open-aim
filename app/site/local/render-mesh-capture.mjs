// Summarize an existing native draw list after rendering. No scene traversal,
// extra draws, GPU queries or per-object hooks. Lists are borrowed for this call.
export function summarizeRenderMeshes(list,camera,{maxItems=512,maxChars=64000}={}){
 const objects=[];let draws=0,triangles=0,omitted=0,characters=0;
 const label=value=>String(value??'').slice(0,128);
 for(const queue of [list?.opaque,list?.transmissive,list?.transparent])for(const item of queue??[]){
  const o=item.object,g=item.geometry,m=item.material;if(!o?.isMesh||!g)continue;
  const available=g.index?.count??g.attributes?.position?.count??0,range=g.drawRange??{start:0,count:Infinity},group=item.group;
  const start=Math.max(range.start??0,group?.start??0),end=Math.min(available,(range.start??0)+(range.count??Infinity),(group?.start??0)+(group?.count??Infinity));
  const instances=o.isInstancedMesh?o.count:g.isInstancedBufferGeometry?g.instanceCount:1;
  const ranges=o.__aimRangeDraw,rangeDraw=ranges?.used&&ranges.geometry===g&&ranges.camera===camera;
  const count=(rangeDraw?ranges.selectedIndices:Math.max(0,end-start))/3*instances;if(!Number.isFinite(count)||!count)continue;
  draws++;triangles+=count;if(objects.length>=maxItems){omitted++;continue;}
  const parts=o.userData?.alMergedRanges,names=o.userData?.alInstanceNames;
  const entry={object:label(o.name||'#'+o.id),material:label(m?.name),instances,triangles:count,transparent:!!m?.transparent,parts:parts?.length??names?.length??1,sources:parts?parts.slice(0,4).map(p=>label(p.name)):names?names.slice(0,4).map(label):undefined};
  // Five samples can fall on one two-second recorder boundary. Bound each so
  // their metadata cannot exceed the recorder's 512 KiB packet limit.
  const size=JSON.stringify(entry).length+1;if(characters+size>maxChars){omitted++;continue;}characters+=size;objects.push(entry);
 }
 const e=camera.matrixWorld.elements;
 return{draws,triangles,omitted,position:{x:e[12],y:e[13],z:e[14]},forward:{x:-e[8],y:-e[9],z:-e[10]},objects};
}
export function createMeshCapture(capture,{now=()=>performance.now(),intervalMs=1000,minimumDrawMs=2.5}={}){
 let last=-Infinity;
 return(renderer,camera,drawMs,map)=>{
  const list=renderer.__aimMeshTraceList;renderer.__aimMeshTraceList=null;
  if(!capture.enabled||!/^map:[a-z]+$/.test(map)||drawMs<minimumDrawMs||now()-last<intervalMs||!list)return;
  const start=now();last=start;const details=summarizeRenderMeshes(list,camera);details.map=map;details.worldDrawCpuMs=drawMs;details.captureCpuMs=Math.max(0,now()-start);capture.event('render-mesh-sample',details);
 };
}
