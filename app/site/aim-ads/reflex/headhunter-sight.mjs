// Headhunter's ADS sight, drawn from the data in headhunter-sight/sight.json. Lives in view space, centred on screen.
import {BufferAttribute,BufferGeometry,Group,Mesh,ShaderMaterial,TextureLoader,AdditiveBlending,NormalBlending,DoubleSide,Vector3} from '/studio/vendor/three.module.js';

const BASE='/aim-ads/reflex/headhunter-sight/';
const DISTANCE=.35;
const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const fragment={
 frame:'vec2 m=texture2D(mask,vUv).rg;float v=pow(texture2D(map,vUv).r,power)*multiply*(1.-m.g);vec3 c=mix(colorA,colorB,v*v)*(alpha*.42+flash);gl_FragColor=vec4(c*v*fade,1.);',
 dots:'float v=texture2D(map,vUv).r;gl_FragColor=vec4(mix(colorA,colorB,v)*v*alpha*fade*3.,1.);',
 panel:'gl_FragColor=vec4(vec3(.05,.035,.03),alpha*fade*1.9);',
 beam:'vec2 e=smoothstep(vec2(0.),vec2(.3),vUv)*smoothstep(vec2(0.),vec2(.3),1.-vUv);float v=texture2D(map,vec2(vUv.x,1.-vUv.y)).r*texture2D(mask,vUv).r*e.x*e.y;gl_FragColor=vec4(colorA*alpha*gain*v*fade,1.);',
 rays:'float v=texture2D(map,vUv).r;gl_FragColor=vec4(colorA*alpha*v*v*fade,1.);',
};
const additive=new Set(['frame','dots','beam','rays']);

export function createHeadhunterSight(){
 const group=new Group();group.name='headhunterSight';group.visible=false;group.position.z=-DISTANCE;
 const entries=[];const textures=new Map();let disposed=false;
 const loader=new TextureLoader();
 const texture=name=>{if(!textures.has(name)){const t=loader.load(BASE+name+'.png');t.flipY=false;t.generateMipmaps=false;t.minFilter=t.magFilter=1006;textures.set(name,t);}return textures.get(name);};
 fetch(BASE+'sight.json').then(r=>{if(!r.ok)throw Error('Headhunter sight');return r.json();}).then(pack=>{
  if(disposed)return;
  const geometries=new Map();
  const geometry=key=>{if(!geometries.has(key)){const m=pack.meshes[key],g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(m.position),3));g.setAttribute('uv',new BufferAttribute(new Float32Array(m.uv),2));g.setIndex(m.index);geometries.set(key,g);}return geometries.get(key);};
  pack.layers.forEach((layer,order)=>{
   const uniforms={map:{value:layer.kind==='beam'?texture('Gradient_BottomUp_T'):layer.kind==='rays'?texture('GradientVertB_TEX'):texture('Deadeye_ADS_Center')},mask:{value:texture(layer.mask??'Deadeye_ADS_Mask')},colorA:{value:new Vector3(...(layer.colorA??layer.color??[1,1,1]))},colorB:{value:new Vector3(...(layer.colorB??layer.color??[1,1,1]))},power:{value:layer.power??1},multiply:{value:layer.multiply??1},alpha:{value:layer.alpha},gain:{value:layer.gain??1},fade:{value:0},flash:{value:0}};
   const material=new ShaderMaterial({uniforms,vertexShader,fragmentShader:'varying vec2 vUv;uniform sampler2D map,mask;uniform vec3 colorA,colorB;uniform float power,multiply,alpha,gain,fade,flash;void main(){'+fragment[layer.kind]+'\n#include <colorspace_fragment>\n}',transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:DoubleSide,blending:additive.has(layer.kind)?AdditiveBlending:NormalBlending});
   const mesh=new Mesh(geometry(layer.mesh),material);mesh.name='sight:'+layer.name;mesh.frustumCulled=false;mesh.renderOrder=9000+order;
   // The source meshes lie in their YZ plane, with Y up on screen and Z across it, in centimetres.
   const unit=.01*(layer.scale??1);
   if(layer.kind==='rays')mesh.scale.set(unit*layer.size[0],unit*layer.size[1],unit);
   else{mesh.rotation.y=Math.PI/2;mesh.scale.set(unit,unit*layer.size[0],unit*layer.size[1]);}
   const holder=new Group();holder.rotation.z=(layer.turn??0)*Math.PI*2;
   const [x,y,z]=layer.offset??[0,0,0];holder.position.set(x*.01,y*.01,z*.01);
   holder.add(mesh);group.add(holder);entries.push({layer,uniforms});
  });
  group.userData.geometries=geometries;
 }).catch(error=>console.warn('Headhunter sight:',error));
 return {group,
  update(open,blend){group.visible=open;if(!open)return;
   for(const {uniforms} of entries){uniforms.fade.value=Math.min(1,Math.max(0,blend));uniforms.flash.value=0;}},
  dispose(){disposed=true;for(const {uniforms} of entries)void uniforms;group.traverse(o=>{if(o.isMesh)o.material.dispose();});group.userData.geometries?.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());},
 };
}
