// Called only at native resource creation/cache misses, never per mesh/frame.
export function attachFirstUseResourceCapture(renderer,capture,running,{limit=48}={}){
 const previous=renderer.info.__aimResourceObserver,programs=new WeakSet();let emitted=0;
 const label=value=>String(value??'').slice(0,160);
 const hook=(kind,data)=>{
  previous?.(kind,data);
  if(kind==='program'){if(programs.has(data.program))return;programs.add(data.program);}
  if(!capture.enabled||!running()||emitted>=limit)return;emitted++;
  const object=data.object,geometry=data.geometry??object?.geometry,material=data.material;
  const path=[];for(let node=object;node&&path.length<5;node=node.parent)path.push(label(node.name||node.type||node.id));
  const details={kind,object:label(object?.name||object?.type),objectId:object?.id,path,geometry:label(geometry?.name),geometryId:geometry?.id,attributes:Object.keys(geometry?.attributes??{}).slice(0,12)};
  if(material){details.material=label(material.name);details.materialId=material.id;details.materialType=material.type;details.vertexPrefix=label(material.vertexShader);details.fragmentPrefix=label(material.fragmentShader);}
  if(data.parameters){const p=data.parameters;details.variant=Object.fromEntries(['shaderID','skinning','instancing','morphTargets','vertexColors','fog','numDirLights','numPointLights','numSpotLights','outputColorSpace','toneMapping'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]]));}
  capture.event('first-use-render-resource',details);
 };
 renderer.info.__aimResourceObserver=hook;
 return()=>{if(renderer.info.__aimResourceObserver===hook)renderer.info.__aimResourceObserver=previous;};
}
