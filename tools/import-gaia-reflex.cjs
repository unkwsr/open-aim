const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {readGlb,accessor,pack}=require('./valorant-melee-assets.cjs');
const root=path.resolve(__dirname,'..');
const source=path.resolve(process.argv.find(a=>!a.startsWith('--')&&a!==process.argv[0]&&a!==process.argv[1])||path.join(root,'exports/gaia-ads/ShooterGame/Content/Equippables/Guns/Attachments/RedDot'));
const ashen=path.join(source,'Ashen');
const output=path.join(root,'app/site/aim-viewmodel');
const glb=readGlb(path.join(ashen,'1P/Models/GN_RedDot_Ashen_Skelmesh.glb'));
const jointIds=glb.json.skins[0].joints;
const nodes=jointIds.map(i=>glb.json.nodes[i]);
const bones={names:nodes.map(n=>n.name),parents:jointIds.map(id=>jointIds.findIndex(parent=>glb.json.nodes[parent].children?.includes(id))),
  t:nodes.flatMap(n=>{const [x,y,z]=n.translation||[0,0,0];return [100*x,-100*z,100*y];}),
  q:nodes.flatMap(n=>{const [x,y,z,w]=n.rotation||[0,0,0,1];return [x,-z,y,w];})};
assert(bones.names.includes('ScopeTarget')&&bones.names.includes('Lens'));
const primitive=glb.json.meshes[0].primitives[0];
assert.equal(glb.json.meshes[0].primitives.length,1);
const at=primitive.attributes;
const positions=accessor(glb,at.POSITION).flatMap(([x,y,z])=>[100*x,-100*z,100*y]);
const normals=accessor(glb,at.NORMAL).flatMap(([x,y,z])=>[x,-z,y]);
const uv=accessor(glb,at.TEXCOORD_0).flat();
const weights=accessor(glb,at.WEIGHTS_0),joints=accessor(glb,at.JOINTS_0);
assert(weights.every(w=>w.filter(v=>v>.001).length===1),'Device runtime expects rigid bone weights');
const bone=joints.map((row,i)=>row[weights[i].findIndex(v=>v>.999)]);
const indices=accessor(glb,primitive.indices).flat();
const chunks=pack([['pos',Buffer.from(Float32Array.from(positions).buffer)],['nrm',Buffer.from(Float32Array.from(normals).buffer)],
  ['uv',Buffer.from(Float32Array.from(uv).buffer)],['bone',Buffer.from(bone)],['idx',Buffer.from(Uint16Array.from(indices).buffer)]]);
const geometry={vertices:positions.length/3,indices:indices.length,bones,offsets:Object.fromEntries(Object.entries(chunks.offsets).map(([k,v])=>[k,v[0]])),groups:[{start:0,count:indices.length,material:'body'}]};
fs.writeFileSync(path.join(output,'gaia-reflex.mesh.bin'),chunks.bytes);
fs.writeFileSync(path.join(output,'gaia-reflex.mesh.json'),JSON.stringify(geometry));
execFileSync('pwsh',['-NoProfile','-File',path.join(root,'scripts/build-kuronami-textures.ps1'),'-GaiaReflexExport',ashen],{stdio:'inherit'});
console.log(JSON.stringify({vertices:geometry.vertices,bones:bones.names,geometryReady:true}));
if(!process.argv.includes('--geometry-only')){
  const needed=['GN_Core_RedDot_Edge_Open','GN_Core_RedDot_Edge_Open_Idle','GN_Core_RedDot_Edge_Close'].map(n=>path.join(source,'Edge/1P/Anims',n+'.psa'));
  for(const file of needed)assert(fs.existsSync(file),'Export referenced animation: '+file);
  const {readPsa}=require('../previews/bot-anims/psa.cjs');
  const normalize=q=>{const n=Math.hypot(...q);return q.map(v=>v/n);};
  function animation(file){
    const psa=readPsa(file),seq=psa.sequences[0],tracks={};
    for(const [i,name]of bones.names.entries()){
      const j=psa.bones.findIndex(b=>b.name===name);assert(j>=0,'Missing bone '+name);
      const keys=[];
      for(let f=0;f<psa.frames;f++){
        // FModel's ANIMKEYS already use the runtime position basis. BONENAMES
        // contains a different reference basis and must not retarget these keys.
        const key=f*psa.bones.length+j,p=psa.pos.slice(key*3,key*3+3),raw=psa.quat.slice(key*4,key*4+4);
        const rotation=normalize([raw[0],raw[1],raw[2],psa.bones[j].parent<0?raw[3]:-raw[3]]);
        keys.push(...p,...rotation);
      }tracks[name]=keys;
    }
    return {frames:psa.frames,duration:psa.frames/seq.rate,tracks};
  }
  const anims={open:animation(needed[0]),openIdle:animation(needed[1]),close:animation(needed[2])};
  const montages=Object.fromEntries(['open','close'].map(name=>{
    const file=path.join(source,'Edge/1P/Anims/GN_Core_RedDot_Edge_'+(name==='open'?'Open':'Close')+'_Montage.json');
    const p=JSON.parse(fs.readFileSync(file))[0].Properties;
    assert(Math.abs(anims[name].duration-p.SequenceLength)<.001);
    return [name,{duration:p.SequenceLength,blendIn:p.BlendIn?.BlendTime||0,blendOut:p.BlendOut?.BlendTime||0}];
  }));
  // source is Guns/Attachments/RedDot; DMR is Guns/SniperRifles/DMR.
  const dmrRoot=path.resolve(source,'../../SniperRifles/DMR/Ashen');
  const effects={};
  for(const [key,name]of [['sight','SM_Ashen_DMR_RedDot_ADS_Sight'],['projector','SM_Ashen_DMR_RedDot_ADS_Projector']]){
    const g=readGlb(path.join(dmrRoot,'VFX/Meshes',name+'.glb')),p=g.json.meshes[0].primitives[0];
    effects[key]={position:accessor(g,p.attributes.POSITION).flatMap(([x,y,z])=>[100*x,-100*z,100*y]),uv:accessor(g,p.attributes.TEXCOORD_0).flat(),index:accessor(g,p.indices).flat()};
  }
  const variants={};
  for(const [variant,chroma]of [['white',''],['orange','v3'],['blue','v1']]){
    const file=path.join(dmrRoot,chroma?'Chromas/'+chroma:'','VFX/Particles/P_Ashen_DMR_ADS_Sight'+(chroma?'_'+chroma:'')+'.json');
    const entries=JSON.parse(fs.readFileSync(file));
    const color=entries.find(e=>e.Type==='ParticleModuleColor').Properties.StartColor.Table.Values;
    const projectorFile=path.join(dmrRoot,chroma?'Chromas/'+chroma:'','VFX/Particles/P_Ashen_DMR_ADS_Projectors'+(chroma?'_'+chroma:'')+'.json');
    const projectorEntries=JSON.parse(fs.readFileSync(projectorFile));
    const projectorColors=projectorEntries.filter(e=>e.Type==='ParticleModuleColor').map(e=>e.Properties.StartColor.Table.Values)
      .sort((a,b)=>Math.max(...b)-Math.max(...a));
    variants[variant]={color,projectorColor:projectorColors[0],projectorGlowColor:projectorColors[1]};
  }
  const attachment=JSON.parse(fs.readFileSync(path.join(ashen,'FXC_RedDot_Ashen_VFX.json')));
  effects.attach=attachment.flatMap(e=>e.Properties?.['Weapon Particle Info']||[]).map(e=>({
    bone:Object.entries(e).find(([k])=>k.startsWith('VFXAttachPoint_'))[1],
    rotation:Object.entries(e).find(([k])=>k.startsWith('ParticleSpawnRotationOffset_'))[1]
  }));
  fs.copyFileSync(path.join(dmrRoot,'VFX/Textures/T_Ashen_DMR_ADS.png'),path.join(output,'gaia-reflex-projector.png'));
  const baseline=JSON.parse(fs.readFileSync(path.join(root,'app/site/aim-ads/reflex/reddot.json')));
  const manifest={gaiaReflex:true,socket:'Reflex',device:geometry,tritium:baseline.tritium,anims,montages,effects,variants,
    materialNote:'Source mesh, textures, animation and particle colors; crystal and unlit VFX shaders reconstructed for Three.'};
  fs.writeFileSync(path.join(output,'gaia-reflex.json'),JSON.stringify(manifest));
  console.log(JSON.stringify({animations:Object.fromEntries(Object.entries(anims).map(([k,a])=>[k,{frames:a.frames,duration:a.duration}])),variants:Object.keys(variants)}));
}
