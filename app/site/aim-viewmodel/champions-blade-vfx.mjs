import {BufferGeometry,Float32BufferAttribute,Mesh,ShaderMaterial,AdditiveBlending,DoubleSide,Vector3} from '/studio/vendor/three.module.js';

// Deliberately small reconstruction of the exported Champions laser motif.
// Existing material passes, 12 turbine rays and a close-fitting contour glow.
export function createChampionsBladeVfx(manifest,gun){
 if(manifest.skin?.id!=='champions-2024-blade'||manifest.skin.bladeVfx===false)return null;
 const time={value:0},activity={value:0},materials=Array.isArray(gun.material)?gun.material:[gun.material];
 const originals=[];
 // The captured crystal uses goldState=0. Its GoldCrack textures describe the
 // gold transition, not the normal purple liquid-energy surface.
 materials[1].color.multiplyScalar(.44);materials[1].envMapIntensity=.65;
 for(const index of [0,1,2,3]){
  const material=materials[index];if(!material)continue;
  originals.push({material,compile:material.onBeforeCompile,key:material.customProgramCacheKey});
  const before=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
   before.call(material,shader);
   shader.uniforms.chBladeTime=time;shader.uniforms.chBladeActivity=activity;
   shader.vertexShader='varying vec2 chBladePosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nchBladePosition=position.xz;');
   shader.fragmentShader='varying vec2 chBladePosition;uniform float chBladeTime;uniform float chBladeActivity;\n'+shader.fragmentShader;
   const energy=index===2?
    `float chFlow=.5+.5*sin(chBladePosition.y*.16+sin(chBladePosition.x*.7-chBladeTime*.8)*1.8-chBladeTime*1.1);
     float chFine=pow(.5+.5*sin(chBladePosition.y*.8+chBladePosition.x*.5-chBladeTime*2.0),10.0);
     vec3 chPurple=mix(vec3(.025,.002,.085),vec3(.13,.008,.32),chFlow)+vec3(.12,.015,.22)*chFine;
     float chBandPos=76.0+sin(chBladeTime*.65)*3.0;
     float chBand=1.0-smoothstep(1.0,5.5,abs(chBladePosition.y+chBladePosition.x*.65-chBandPos));
     float chHot=1.0-smoothstep(.15,1.1,abs(chBladePosition.y+chBladePosition.x*.65-chBandPos));
     outgoingLight=mix(chPurple,vec3(1.6,.28,.012),chBand)+vec3(1.3,.8,.15)*chHot;
     outgoingLight*=1.0+.18*chBladeActivity;`:
    index===1?`outgoingLight*=.36;`:
    `outgoingLight=vec3(1.35,.48,.025)*(1.0+.12*sin(chBladePosition.y*.12-chBladeTime*1.4)+.2*chBladeActivity);`;
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',energy+'\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey=()=>`champions-blade-energy-v3:${index}`;
  material.needsUpdate=true;
 }
 const rotor=gun.skeleton.bones.find(b=>b.name==='Turbine');
 // Reuse one mesh throughout the model's lifetime. The triangles are only
 // authored once; activity is a uniform, not a spawning particle simulation.
 const positions=[],uv=[];
 for(let i=0;i<12;i++){
  const angle=i*Math.PI/6,c=Math.cos(angle),s=Math.sin(angle),r0=2.2,r1=5.6,width=.16;
  const point=(r,w)=>[c*r-s*w,s*r+c*w,.16];
  for(const [r,w,u,v]of [[r0,-width,0,0],[r1,0,1,.5],[r0,width,0,1]]){positions.push(...point(r,w));uv.push(u,v);}
 }
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));
 const material=new ShaderMaterial({uniforms:{chBladeTime:time,chBladeActivity:activity},transparent:true,depthWrite:false,depthTest:true,blending:AdditiveBlending,side:DoubleSide,toneMapped:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'varying vec2 vUv;uniform float chBladeTime;uniform float chBladeActivity;void main(){float taper=pow(1.0-vUv.x,1.7);float pulse=.65+.35*sin(chBladeTime*2.4);float alpha=taper*(.13*pulse+.24*chBladeActivity);gl_FragColor=vec4(mix(vec3(.65,.16,1.0),vec3(1.0,.65,.12),vUv.x),alpha);}'
 });
 const rays=new Mesh(geometry,material);rays.name='champions-blade:energy-rays';rays.frustumCulled=false;rotor?.add(rays);
 const rootIndex=gun.skeleton.bones.findIndex(b=>b.name==='Root'),root=gun.skeleton.bones[rootIndex];
 // Derive the glow directly from the energy mesh in bind space. The separate
 // source aura used a different contour and produced a detached duplicate tip.
 const source=gun.geometry.attributes.position,indices=gun.geometry.index,group=manifest.gun.groups.find(g=>g.materialIndex===2),points=[];
 for(let i=group.start;i<group.start+group.count;i++){const vertex=indices.getX(i);points.push([source.getX(vertex),source.getZ(vertex)]);}
 points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const half=values=>{const h=[];for(const p of values){while(h.length>1&&cross(h.at(-2),h.at(-1),p)<=.001)h.pop();h.push(p);}return h;};
 const hull=[...half(points).slice(0,-1),...half(points.reverse()).slice(0,-1)];
 const auraGeometry=new BufferGeometry(),auraPositions=[],auraUvs=[],auraIndices=[],point=new Vector3();
 for(let i=0;i<hull.length;i++){
  const previous=hull[(i+hull.length-1)%hull.length],current=hull[i],next=hull[(i+1)%hull.length];
  let ax=current[1]-previous[1],az=previous[0]-current[0],bx=next[1]-current[1],bz=current[0]-next[0];const al=Math.hypot(ax,az),bl=Math.hypot(bx,bz);ax/=al;az/=al;bx/=bl;bz/=bl;
  let nx=ax+bx,nz=az+bz;const length=Math.hypot(nx,nz);nx/=length;nz/=length;const miter=1/Math.max(.5,nx*bx+nz*bz);
  for(const [distance,u]of [[-.2,0],[.04,.25],[.95,1]]){point.set(current[0]+nx*distance*miter,0,current[1]+nz*distance*miter).applyMatrix4(gun.bindMatrix).applyMatrix4(gun.skeleton.boneInverses[rootIndex]);auraPositions.push(...point.toArray());auraUvs.push(u,current[1]/100);}
  const a=i*3,b=((i+1)%hull.length)*3;for(let strip=0;strip<2;strip++)auraIndices.push(a+strip,b+strip,a+strip+1,b+strip,b+strip+1,a+strip+1);
 }
 auraGeometry.setAttribute('position',new Float32BufferAttribute(auraPositions,3));auraGeometry.setAttribute('uv',new Float32BufferAttribute(auraUvs,2));auraGeometry.setIndex(auraIndices);
 const auraMaterial=new ShaderMaterial({uniforms:{chBladeTime:time,chBladeActivity:activity},transparent:true,depthWrite:false,depthTest:true,blending:AdditiveBlending,side:DoubleSide,toneMapped:false,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'varying vec2 vUv;uniform float chBladeTime;uniform float chBladeActivity;void main(){float wave=.7+.3*sin(vUv.y*31.0-chBladeTime*3.0);float core=exp(-pow((vUv.x-.25)*12.0,2.0));float fade=pow(max(0.0,1.0-vUv.x),1.7)*smoothstep(0.0,.2,vUv.x);vec3 color=mix(vec3(.65,.025,1.1),vec3(1.8,.65,.035),core);gl_FragColor=vec4(color,fade*(.5+.15*wave+.2*chBladeActivity));}'
 });
 const aura=new Mesh(auraGeometry,auraMaterial);aura.name='champions-blade:purple-aura';aura.frustumCulled=false;root.add(aura);
 let disposed=false;
 return{
  update(state,holding){
   if(disposed)return;
   const seconds=Number.isFinite(state.seconds)?state.seconds:0;time.value=seconds;
   let intensity=0;
   if(holding){
    const equip=seconds-state.equipAt;if(state.equipAt!=null&&equip>=0&&equip<1.27)intensity=Math.sin(Math.PI*equip/1.27)*.65;
    const actions=state.melee||[];let latest=null;
    // Events are already ordered by the simulation. Scan backward without copies.
    for(let i=actions.length-1;i>=0;i--)if(actions[i].at<=seconds){latest=actions[i];break;}
    if(latest){const age=seconds-latest.at,life=latest.inspect?5.333333:latest.heavy?1:.65;if(age>=0&&age<life)intensity=Math.max(intensity,Math.sin(Math.PI*age/life)*(latest.inspect ? .55 : 1));}
   }
   activity.value=intensity;rays.visible=!!holding;aura.visible=!!holding;
  },
  dispose(){if(disposed)return;disposed=true;rays.removeFromParent();geometry.dispose();material.dispose();aura.removeFromParent();auraGeometry.dispose();auraMaterial.dispose();for(const entry of originals){entry.material.onBeforeCompile=entry.compile;entry.material.customProgramCacheKey=entry.key;}},
 };
}
