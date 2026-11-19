import {BufferGeometry,Float32BufferAttribute,Mesh,ShaderMaterial,Vector3,Texture,Vector2,Matrix4,DoubleSide,CustomBlending,OneFactor,OneMinusSrcAlphaFactor,LinearFilter,ClampToEdgeWrapping} from '/studio/vendor/three.module.js';
import {createReflex,loadReflex} from './device-runtime.mjs';
import {loadPrimordiumReflex,createPrimordiumReflex} from './primordium-runtime.mjs';
import {loadKuronamiReflex,createKuronamiReflex} from './kuronami-runtime.mjs';
import {aimFxRotation} from '/_assets/r20261021-1/next/js/CnrSARj_.js';

const cache=new Map(),base='/aim-viewmodel/';
export async function loadSkinReflex(stem,skin){
  const kuronami=skin?.match(/^kuronami-vandal-(standard|black-red)$/);
  if(kuronami&&(stem==='viewmodel'||stem==='vandal'))return loadKuronamiReflex(stem,kuronami[1]);
  if(stem==='viewmodel'&&/^primordium-vandal(?:-cobalt)?$/.test(skin||''))return loadPrimordiumReflex(skin);
  if(!/^gaia-vandal-(orange|white|blue)$/.test(skin||''))return loadReflex(stem);
  if(!cache.has(skin))cache.set(skin,(async()=>{
    const variant=skin.slice('gaia-vandal-'.length);
    const json=await fetch(base+'gaia-reflex.json');if(!json.ok)throw Error('Gaia sight manifest');
    const data=await json.json(),binary=await fetch(base+'gaia-reflex.mesh.bin');if(!binary.ok)throw Error('Gaia sight mesh');
    const bitmap=async file=>{const r=await fetch(base+file);if(!r.ok)throw Error('Gaia sight texture '+file);return createImageBitmap(await r.blob(),{imageOrientation:'none',premultiplyAlpha:'none'});};
    const [bin,color,normal,orm,projector]=await Promise.all([binary.arrayBuffer(),bitmap('gaia-reflex-'+variant+'-color.png'),bitmap('gaia-reflex-'+variant+'-normal.png'),bitmap('gaia-reflex-'+variant+'-orm.png'),bitmap('gaia-reflex-projector.png')]);
    return {data,bin,bitmap:color,normal,orm,projector,variant};
  })().catch(error=>{console.warn('Gaia sight unavailable',error);return null;}));
  return cache.get(skin);
}

function texture(bitmap,color=false){const t=new Texture(bitmap);t.flipY=false;t.colorSpace=color?'srgb':'';t.needsUpdate=true;return t;}
function geometry(spec){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(spec.position,3));g.setAttribute('uv',new Float32BufferAttribute(spec.uv,2));g.setIndex(spec.index);return g;}
export function createSkinReflex(pack,environment,wrap){
  if(pack?.data.kuronamiReflex)return createKuronamiReflex(pack,environment,wrap);
  if(pack?.data.primordiumReflex)return createPrimordiumReflex(pack,environment,wrap);
  if(!pack?.data.gaiaReflex)return createReflex(pack,environment,wrap);
  const device=createReflex(pack,environment,wrap),body=device.mesh.material[0];
  const normal=texture(pack.normal),orm=texture(pack.orm),projector=texture(pack.projector);
  // This mask is only 128x512. Avoid low mip levels and oblique sampling blur;
  // derivative-based coverage in the shader handles the fine strand edges.
  projector.minFilter=projector.magFilter=LinearFilter;projector.generateMipmaps=false;
  projector.wrapS=projector.wrapT=ClampToEdgeWrapping;projector.anisotropy=16;
  normal.anisotropy=orm.anisotropy=16;body.map.anisotropy=16;
  body.name='gaia-reflex:crystal';body.normalMap=normal;body.normalScale=new Vector2(1,1);body.roughnessMap=orm;body.metalnessMap=orm;body.aoMap=orm;
  body.roughness=.35;body.metalness=.2;body.emissiveMap=body.map;body.emissive.setRGB(.55,.55,.55);body.needsUpdate=true;
  device.mesh.name='gun:gaia-reflex';
  const variant=pack.data.variants[pack.variant];
  const materials=[],meshes=[],geometries=[geometry(pack.data.effects.sight),geometry(pack.data.effects.projector)];
  const makeMaterial=isProjector=>{
    const source=isProjector?variant.projectorColor:variant.color,peak=Math.max(...source);
    const hue=new Vector3(...source).multiplyScalar(1/peak);
    // Source material modes: sight = AlphaComposite, projector = Additive.
    // Output premultiplied color explicitly, so soft mask values are not squared.
    const mat=new ShaderMaterial({
      uniforms:{maskMap:{value:projector},maskSize:{value:new Vector2(pack.projector.width,pack.projector.height)},hue:{value:hue},visibility:{value:0}},
      transparent:true,depthWrite:false,side:DoubleSide,blending:CustomBlending,
      blendSrc:OneFactor,blendDst:isProjector?OneFactor:OneMinusSrcAlphaFactor,
      blendSrcAlpha:OneFactor,blendDstAlpha:OneMinusSrcAlphaFactor,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`uniform sampler2D maskMap;uniform vec2 maskSize;uniform vec3 hue;uniform float visibility;varying vec2 vUv;
        vec4 cubicWeights(float t){float t2=t*t,t3=t2*t;return vec4(-.5*t+t2-.5*t3,1.-2.5*t2+1.5*t3,.5*t+2.*t2-1.5*t3,-.5*t2+.5*t3);}
        float maskBicubic(vec2 uv){
          vec2 p=uv*maskSize-.5,cell=floor(p),f=fract(p);vec4 wx=cubicWeights(f.x),wy=cubicWeights(f.y);float result=0.;
          for(int y=0;y<4;y++)for(int x=0;x<4;x++)result+=texture2D(maskMap,(cell+vec2(float(x-1),float(y-1))+.5)/maskSize).r*wx[x]*wy[y];
          return clamp(result,0.,1.);
        }
        void main(){
          float field=maskBicubic(vUv);
          float edge=max(fwidth(field)*.6,.003);
          float core=smoothstep(.03-edge,.75+edge,field);
          float feather=field*field;
          float alpha=visibility*${isProjector?'feather*.22':'clamp(core*.8+field*.12,0.,.94)'};
          vec3 radiance=${isProjector?'hue*.65':'mix(hue*1.35,vec3(1.),core*.16)'};
          gl_FragColor=vec4(radiance*alpha,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });
    mat.userData.sourceColor=[...source];mat.userData.sourceBlend=isProjector?'Additive':'AlphaComposite';
    mat.name=isProjector?'gaia-reflex:projector':'gaia-reflex:sight';materials.push(mat);return mat;
  };
  const reflection=new Matrix4().makeScale(1,-1,1);
  for(const [i,attach]of pack.data.effects.attach.entries()){
    const r=attach.rotation,a=aimFxRotation(r.Roll,r.Pitch,r.Yaw);
    const rotation=new Matrix4().set(a[0],a[1],a[2],0,a[3],a[4],a[5],0,a[6],a[7],a[8],0,0,0,0,1);
    rotation.premultiply(reflection).multiply(reflection);
    const mesh=new Mesh(geometries[i===0?0:1],makeMaterial(i>0));mesh.name=i===0?'gaia-reflex:sight':'gaia-reflex:projector:'+attach.bone;
    mesh.quaternion.setFromRotationMatrix(rotation);mesh.frustumCulled=false;mesh.renderOrder=10000;mesh.visible=false;
    device.bone(attach.bone).add(mesh);meshes.push(mesh);
  }
  const pose=device.pose,dispose=device.dispose;
  let active=false;
  device.pose=(open,openAt,closeAt,time,enabled=true)=>{
    pose(open,openAt,closeAt,time);active=!!open&&enabled;
    const elapsed=openAt==null?0:Math.max(0,time-openAt),fade=Math.min(1,elapsed/.25);
    for(let i=0;i<meshes.length;i++){meshes[i].visible=active;materials[i].uniforms.visibility.value=active?fade:0;}
  };
  device.gaiaStats=()=>({variant:pack.variant,active,vertices:pack.data.device.vertices,sightMeshes:meshes.filter(m=>m.visible).length});
  device.dispose=()=>{dispose();normal.dispose();orm.dispose();projector.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();};
  return device;
}
