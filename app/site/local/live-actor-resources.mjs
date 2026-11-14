// Operates on the actor updater's retained live instances, including actors
// outside the starting camera frustum. Never steps simulation or emits effects.
export async function prepareLiveActorResources(entries,renderer,valid=()=>true,{now=()=>performance.now(),yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0)),batchSize=4}={}){
 const start=now(),seen=new Set(),stats={actors:0,skinnedMeshes:0,skeletons:0,createdBoneTextures:0,uploadedBoneTextures:0,cpuMs:0,elapsedMs:0};
 const check=()=>{if(!valid())throw new DOMException('Actor preparation cancelled','AbortError');};
 check();if(typeof renderer?.initTexture!=='function')throw new Error('Renderer cannot initialize live actor textures');
 for(const entry of entries.values()){
  check();const root=entry.mesh?.root;if(!root)continue;stats.actors++;const at=now();root.updateWorldMatrix?.(true,true);
  root.traverse(node=>{
   if(!node.isSkinnedMesh||!node.skeleton)return;stats.skinnedMeshes++;const skeleton=node.skeleton;if(seen.has(skeleton))return;seen.add(skeleton);stats.skeletons++;
   if(!skeleton.boneTexture){skeleton.computeBoneTexture();stats.createdBoneTextures++;}
   skeleton.update();renderer.initTexture(skeleton.boneTexture);stats.uploadedBoneTextures++;
  });
  stats.cpuMs+=Math.max(0,now()-at);
  if(stats.actors%batchSize===0){await yieldTask();check();}
 }
 check();stats.elapsedMs=Math.max(0,now()-start);return stats;
}
export function disposeLiveActorResources(root){
 const seen=new Set();root.traverse(node=>{if(node.isSkinnedMesh&&node.skeleton&&!seen.has(node.skeleton)){seen.add(node.skeleton);node.skeleton.dispose();}});
 return seen.size;
}
// Conservative spawner capacity by template. We deliberately do not run the
// simulation or sample its RNG to discover which candidate spawners will win.
export function planActorCapacity(scene){
 const templates=new Map((scene?.actors??[]).map(a=>[a.id,a])),counts=new Map();
 const spawners=scene?.spawners??[];
 for(const spawner of spawners){const id=spawner.actorTemplateId,template=templates.get(id);if(!template||template.body?.shape==='sphere')continue;const count=Number.isInteger(spawner.maxAlive)?Math.max(0,spawner.maxAlive):1;counts.set(id,(counts.get(id)??0)+count);}
 if(!spawners.length)for(const [id,template]of templates)if(template.body?.shape!=='sphere')counts.set(id,1);
 return counts;
}
export function createPreparedActorPool(spawn,{limit=64,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 const pools=new Map();let generation=0,hits=0,misses=0;
 const all=()=>[...pools.values()].flat();
 return{
  take(id){const mesh=pools.get(id)?.pop();if(mesh)hits++;else misses++;return mesh;},
  async prepare(scene,live,renderer,valid=()=>true){
   const token=generation,check=()=>{if(token!==generation||!valid())throw new DOMException('Actor pool preparation cancelled','AbortError');};
   check();const plan=planActorCapacity(scene),active=new Map();for(const entry of live.values())active.set(entry.templateId,(active.get(entry.templateId)??0)+1);
   let requested=0,created=0,remaining=Math.max(0,limit-live.size-all().length);
   for(const [id,capacity]of plan){
    requested+=capacity;let pool=pools.get(id);if(!pool){pool=[];pools.set(id,pool);}
    const missing=Math.max(0,capacity-(active.get(id)??0)-pool.length);
    for(let i=0;i<missing&&remaining>0;i++){
     check();const mesh=spawn(id);if(!mesh)break;pool.push(mesh);remaining--;created++;
     if(created%4===0){await yieldTask();check();}
    }
   }
   const pooled=all(),entries=new Map(live);for(const mesh of pooled)entries.set(mesh,{mesh});
   const stats=await prepareLiveActorResources(entries,renderer,()=>token===generation&&valid(),{yieldTask});check();
   return{...stats,pooledActors:pooled.length,liveActors:live.size,createdPoolActors:created,requestedCapacity:requested,capacityLimit:limit,capacityCapped:requested>limit,poolHits:hits,poolMisses:misses};
  },
  clear(){generation++;for(const mesh of all())disposeLiveActorResources(mesh.root);pools.clear();hits=misses=0;},
  snapshot:()=>({pooledActors:all().length,hits,misses}),
 };
}
