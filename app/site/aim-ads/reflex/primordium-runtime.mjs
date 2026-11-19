import {BufferGeometry,Float32BufferAttribute,Mesh,ShaderMaterial,Object3D,Vector3,Vector2,Texture,Matrix4,DoubleSide,NormalBlending,LinearFilter,ClampToEdgeWrapping,RepeatWrapping} from '/studio/vendor/three.module.js';
import {createReflex} from './device-runtime.mjs';
import {aimFxRotation} from '/_assets/r20261021-1/next/js/CnrSARj_.js';
const cache=new Map(),base='/aim-viewmodel/';
export async function loadPrimordiumReflex(skin){
 const variant=skin==='primordium-vandal-cobalt'?'cobalt':'base';
 if(!cache.has(variant))cache.set(variant,(async()=>{
  const asset=async name=>{const r=await fetch(base+name);if(!r.ok)throw Error('Primordium asset '+name);return r;};
  const bitmap=async name=>createImageBitmap(await (await asset(name)).blob(),{imageOrientation:'none',premultiplyAlpha:'none'});
  const names=['color','normal','orm','emissive','reticle','fire','smoke','flow'];
  const [data,bin,...images]=await Promise.all([asset('primordium-reflex.json').then(r=>r.json()),asset('primordium-reflex.mesh.bin').then(r=>r.arrayBuffer()),...names.map(n=>bitmap('primordium-reflex-'+(['color','normal','orm','emissive'].includes(n)?variant+'-':'')+n+'.png'))]);
  if(data.sourceFamily!=='Hellfire'||data.identity!=='Primordium Vandal')throw Error('Incorrect Primordium asset identity');
  return {data,bin,bitmap:images[0],variant,...Object.fromEntries(names.map((n,i)=>[n,images[i]]))};
 })().catch(e=>{console.warn('Primordium sight unavailable',e);return null;}));
 return cache.get(variant);
}
function texture(bitmap,color=false,repeat=false){const t=new Texture(bitmap);t.flipY=false;t.colorSpace=color?'srgb':'';t.minFilter=t.magFilter=LinearFilter;t.wrapS=t.wrapT=repeat?RepeatWrapping:ClampToEdgeWrapping;t.anisotropy=16;t.needsUpdate=true;return t;}
function geometry(spec){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(spec.position,3));g.setAttribute('uv',new Float32BufferAttribute(spec.uv,2));g.setIndex(spec.index);const c=spec.color||Array(spec.position.length/3*4).fill(1),peak=Math.max(...c);g.setAttribute('sourceColor',new Float32BufferAttribute(peak>1?c.map(v=>v/255):c,4));return g;}
const reflection=new Matrix4().makeScale(1,-1,1);
function rotation(r){const a=aimFxRotation(r.Roll,r.Pitch,r.Yaw),m=new Matrix4().set(a[0],a[1],a[2],0,a[3],a[4],a[5],0,a[6],a[7],a[8],0,0,0,0,1);return m.premultiply(reflection).multiply(reflection);}
export function createPrimordiumReflex(pack,environment,wrap){
 const device=createReflex(pack,environment,wrap),body=device.mesh.material[0],variant=pack.data.variants[pack.variant],textures=[];
 const tex=(b,repeat=false)=>{const t=texture(b,false,repeat);textures.push(t);return t;};
 body.name='primordium-reflex:body';body.normalMap=tex(pack.normal);body.normalScale=new Vector2(1,1);const orm=tex(pack.orm);body.roughnessMap=body.metalnessMap=body.aoMap=orm;body.roughness=1;body.metalness=1;body.emissiveMap=tex(pack.emissive);body.emissive.setRGB(...variant.emission);body.needsUpdate=true;device.mesh.name='gun:primordium-reflex';
 const mask=tex(pack.reticle),fire=tex(pack.fire,true),smoke=tex(pack.smoke,true),flow=tex(pack.flow,true),geometries=new Map(),effects=[],materials=[];
 for(const attach of variant.attach){
  // Keep the ADS ring; omit the lower wing flames and projector effects.
  if(attach.bone!=='Lens')continue;
  const group=new Object3D();group.quaternion.setFromRotationMatrix(rotation(attach.rotation));const offset=attach.location||{X:0,Y:0,Z:0};group.position.set(offset.X,-offset.Y,offset.Z);device.bone(attach.bone).add(group);
  for(const spec of attach.emitters){
   if(!geometries.has(spec.mesh))geometries.set(spec.mesh,geometry(pack.data.effects[spec.mesh]));
   const panel=attach.bone==='Lens',wing=attach.bone==='Root',kind=panel?0:wing?1:2;
   const material=new ShaderMaterial({uniforms:{maskMap:{value:mask},fireMap:{value:fire},smokeMap:{value:smoke},flowMap:{value:flow},sourceHue:{value:new Vector3(...spec.color)},visibility:{value:0},clock:{value:0},kind:{value:kind}},transparent:true,depthWrite:false,side:DoubleSide,blending:NormalBlending,
    vertexShader:'attribute vec4 sourceColor;varying vec2 vUv;varying vec4 vColor;void main(){vUv=uv;vColor=sourceColor;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform sampler2D maskMap;uniform sampler2D fireMap;uniform sampler2D smokeMap;uniform sampler2D flowMap;uniform vec3 sourceHue;uniform float visibility;uniform float clock;uniform float kind;varying vec2 vUv;varying vec4 vColor;
     void main(){
      vec2 drift=texture2D(flowMap,vUv*.5+vec2(0.,clock*.045)).rg*2.-1.;
      float noise=texture2D(smokeMap,vUv*vec2(.7,2.)+vec2(0.,-clock*.4)).r;
      float crawl=texture2D(fireMap,vUv*vec2(1.4,1.8)+vec2(clock*.035,-clock*.3)).r;
      float field;float alpha;
      if(kind<.5){
       field=texture2D(maskMap,vUv+drift*.004).r;
       field*=.78+.22*noise;
       alpha=smoothstep(.015,.34,field)*vColor.a;
      }else if(kind<1.5){
       float edge=pow(max(sin(clamp(vUv.y,0.,1.)*3.14159265),0.),.65);
       field=mix(noise,crawl,.45)*edge;
       alpha=smoothstep(.10,.58,field)*vColor.a;
      }else{
       field=pow(max(sin(clamp(vUv.y,0.,1.)*3.14159265),0.),2.);
       alpha=field*vColor.a*.075;
      }
      float peak=max(max(sourceHue.r,sourceHue.g),sourceHue.b);vec3 hue=sourceHue/max(peak,.001);
      vec3 hot=sourceHue.r>sourceHue.b?vec3(1.,.48,.018):vec3(.08,.65,1.);
      vec3 radiance=mix(hue*1.7,hot*2.,smoothstep(.16,.7,field)*.72);
      gl_FragColor=vec4(radiance,clamp(alpha*visibility,.0,.98));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
     }`});
   const object=new Mesh(geometries.get(spec.mesh),material);object.scale.set(...spec.size);object.position.set(spec.location[0]+spec.origin.X,-spec.location[1]-spec.origin.Y,spec.location[2]+spec.origin.Z);
   const [roll,pitch,yaw]=spec.meshRotation;object.quaternion.setFromRotationMatrix(rotation({Roll:roll*360,Pitch:pitch*360,Yaw:yaw*360}));
   object.name=panel?'primordium-reflex:sight':wing?'primordium-reflex:wing-flame':'primordium-reflex:projector:'+attach.bone;
   object.frustumCulled=false;object.renderOrder=10000;object.visible=false;group.add(object);material.name=object.name;material.userData.source=spec;materials.push(material);effects.push({object,material,spec,panel});
  }
 }
 const pose=device.pose,dispose=device.dispose;let active=false;
 device.pose=(open,openAt,closeAt,time,enabled=true)=>{pose(open,openAt,closeAt,time);active=!!open&&enabled;const elapsed=openAt==null?0:Math.max(0,time-openAt);
  for(const {object,material,spec} of effects){const local=elapsed-spec.delay,ended=spec.loops===1&&spec.lifetime>0&&local>=spec.lifetime;const fade=active&&!ended?Math.min(1,Math.max(0,local/.08)):0;object.visible=fade>0;material.uniforms.visibility.value=fade;material.uniforms.clock.value=elapsed;}
 };
 device.primordiumStats=()=>({variant:pack.variant,sourceFamily:pack.data.sourceFamily,active,vertices:pack.data.device.vertices,sightMeshes:effects.filter(e=>e.object.visible).length});
 device.dispose=()=>{dispose();for(const t of textures)t.dispose();for(const g of geometries.values())g.dispose();for(const m of materials)m.dispose();};return device;
}
