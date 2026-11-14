// These entries exist in the original manifest but their PNGs were never
// shipped in this checkout. Native live rendering already omits their materials.
// Only an actual 404 for this bounded list may be nonfatal during preparation.
const unshippedFiles=new Set([
 'muzzle.Flash_Alpha2_DS_2x2_TEX.png','muzzle.RingSmoke_3x3_TEX.png',
 'muzzle.SmokePuff_4x3a.png','muzzle.SmokeRadial_4x2_TFX.png',
 'muzzle.00_White_DIFF.png','muzzle.ArrowMuzzle_TEX.png',
 'muzzle.MuzzleFlash2_Greyscale_TEX_Inverted.png','muzzle.m_flash_01_ring.png',
 'muzzle.m_flash_02.png','muzzle.UV_Noise_Cellular_TEX.png',
]);
export function isKnownUnshippedFiringTexture(file,error){return error?.status===404&&unshippedFiles.has(file);}
// Plan render resources only. No particle emission, simulation or RNG calls.
export function planFiringResources(manifest,weapon,detail,hasMaterial=()=>true){
 const gun=manifest.guns[weapon];if(!gun)return{slots:0,materials:[]};
 const materials=new Set();let slots=0;
 for(const mode of [gun.hip,gun.ads]){
  const groups=new Map();
  for(const ref of mode){
   const system=manifest.systems[ref.sys];if(!system)throw new Error('Missing firing system: '+ref.sys);
   const emitters=system.emitters.filter(e=>e.enabled&&(e.detail&detail)!==0&&e.mat!=null&&hasMaterial(e.mat));
   for(const e of emitters){if(!manifest.materials[e.mat])throw new Error('Missing firing material: '+e.mat);materials.add(e.mat);}
   const group=groups.get(ref.err)??[];group.push({ref,count:emitters.length});groups.set(ref.err,group);
  }
  let capacity=0;
  for(const group of groups.values()){
   const bounds=[...new Set(group.flatMap(({ref})=>[ref.lo,ref.hi]))].sort((a,b)=>a-b);
   const samples=[...bounds,...bounds.slice(1).map((v,i)=>(v+bounds[i])/2)];
   let maximum=0;
   for(const value of samples){let count=0;for(const {ref,count:n} of group)if((ref.loInc?value>=ref.lo:value>ref.lo)&&(ref.hiInc?value<=ref.hi:value<ref.hi))count+=n;maximum=Math.max(maximum,count);}
   capacity+=maximum;
  }
  slots=Math.max(slots,capacity);
 }
 return{slots,materials:[...materials]};
}

// Use the same retained batches as live rendering, including full-size dynamic
// attributes. A dummy shared triangle cannot upload these future live buffers.
export function warmFiringBatches({plan,pool,createBatch,material,scene,camera,renderer,valid}){
 const check=()=>{if(!valid())throw new DOMException('Firing preparation cancelled','AbortError');};
 check();const materials=plan.materials.map(id=>{const value=material(id);if(!value)throw new Error('Firing material not ready: '+id);return value;});
 if(!materials.length)return{slots:0,created:0,materials:0,draws:0};
 const created=Math.max(0,plan.slots-pool.length),count=Math.max(1,plan.slots),saved=[];
 let draws=0;
 try{
  for(let i=0;i<count;i++){
   check();if(i>=pool.length)pool.push(createBatch());const batch=pool[i],mesh=batch.mesh;
   saved.push({mesh,parent:mesh.parent,material:mesh.material});scene.add(mesh);mesh.visible=true;
   batch.sink.pos.set([-.1,-.1,-1,.1,-.1,-1,0,.1,-1]);
   mesh.geometry.setDrawRange(0,3);for(const attr of [...batch.attrs,batch.dynAttr])attr.needsUpdate=true;
  }
  for(let start=0;start<Math.max(count,materials.length);start+=count){
   check();for(let i=0;i<count;i++)pool[i].mesh.material=materials[(start+i)%materials.length];
   renderer.render(scene,camera);draws+=count;
  }
 }finally{
  for(const {mesh,parent,material} of saved){scene.remove(mesh);parent?.add(mesh);mesh.material=material;mesh.visible=false;mesh.geometry.setDrawRange(0,0);}
 }
 return{slots:count,created,materials:materials.length,draws};
}
