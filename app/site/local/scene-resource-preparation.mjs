// One existing loading draw, not a gameplay/map tour. Compile alone does not
// upload buffers belonging to hidden objects, nested meshes or sprites.
export function drawPreparedSceneResources(renderer,scene,camera,valid=()=>true){
 const check=()=>{if(!valid())throw new DOMException('Scene preparation cancelled','AbortError');};
 check();const started=performance.now(),saved=[],hiddenLights=[];let renderables=0,stats;
 const visit=(node,parentVisible)=>{
  const effective=parentVisible&&node.visible!==false;
  if(node.isLight){if(!effective&&node.visible!==false){hiddenLights.push(node);node.visible=false;}return;}
  if(node.isMesh||node.isLine||node.isPoints||node.isSprite)renderables++;
  saved.push({node,visible:node.visible,frustumCulled:node.frustumCulled});
  node.visible=true;if('frustumCulled'in node)node.frustumCulled=false;
  for(const child of node.children??[])visit(child,effective);
 };
 const before={programs:renderer.info?.programs?.length??0,geometries:renderer.info?.memory?.geometries??0};
 try{
  visit(scene,true);check();renderer.render(scene,camera);check();
  if(renderer.getContext?.().isContextLost?.())throw new Error('Graphics context lost during scene preparation');
  stats={renderables,newPrograms:(renderer.info?.programs?.length??0)-before.programs,newGeometries:(renderer.info?.memory?.geometries??0)-before.geometries};
 }finally{
  for(const {node,visible,frustumCulled}of saved){node.visible=visible;if(frustumCulled!==undefined)node.frustumCulled=frustumCulled;}
  for(const light of hiddenLights)light.visible=true;
 }
 stats.elapsedMs=performance.now()-started;return stats;
}
