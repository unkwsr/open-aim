import {createSMAAShaders} from './vendor/smaa/SMAAShader.mjs';
import {readPotato} from './potato.mjs';

export const ANTI_ALIASING_KEY='aim-anti-aliasing-v1';
export function readAntiAliasing(storage=globalThis.localStorage){
 /* potato-mode-v1: Potato = anti-aliasing off (the saved choice is kept for when Potato is off) */if(readPotato(storage))return 'off';
 try{const mode=storage?.getItem(ANTI_ALIASING_KEY);return ['smaa','msaa','off'].includes(mode)?mode:'smaa';}catch{return 'smaa';}
}
class Vec2{constructor(x=0,y=0){this.x=x;this.y=y;this.isVector2=true;}set(x,y){this.x=x;this.y=y;return this;}}
class Rect{constructor(){this.isVector4=true;}copy(v){this.x=v.x;this.y=v.y;this.z=v.z;this.w=v.w;return this;}}
async function loadLookup(name){
 const response=await fetch(new URL('./vendor/smaa/'+name+'.png',import.meta.url));if(!response.ok)throw Error('SMAA '+name+' lookup: '+response.status);
 return createImageBitmap(await response.blob(),{premultiplyAlpha:'none',colorSpaceConversion:'none',imageOrientation:'none'});
}

// The engine keeps its normal textured render/depth/effect path. Copy only the
// finished 3D framebuffer to a single-sample texture, then run SMAA's three
// passes. Its display-encoded colors are written back unchanged outside edges;
// no lighting, tone mapping or material substitution is applied by these passes.
export function attachSmaa(stage,T,mode=readAntiAliasing(),{load=loadLookup}={}){
 const stats={mode,ready:mode!=='smaa',passes:mode==='smaa'?3:0,width:0,height:0,error:null};
 stage.antiAliasingStats=()=>({...stats});
 if(mode!=='smaa')return stage;
 const renderer=stage.renderer,original={render:stage.render,prewarm:stage.prewarm,dispose:stage.dispose};
 const shaders=createSMAAShaders(Vec2),geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.BufferAttribute(new Float32Array([-1,3,0,-1,-1,0,3,-1,0]),3));
 geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array([0,2,0,0,2,0]),2));
 const camera=new T.Camera(-1,1,1,-1,0,1),quad=new T.Mesh(geometry);quad.frustumCulled=false;
 const make=shader=>new T.ShaderMaterial({name:shader.name,defines:{...shader.defines},uniforms:shader.uniforms,vertexShader:shader.vertexShader,fragmentShader:shader.fragmentShader,depthTest:false,depthWrite:false,blending:0,toneMapped:false});
 const edgesMaterial=make(shaders.SMAAEdgesShader),weightsMaterial=make(shaders.SMAAWeightsShader),blendMaterial=make(shaders.SMAABlendShader);
 const rtOptions={depthBuffer:false,stencilBuffer:false,minFilter:1006,magFilter:1006,generateMipmaps:false};
 const edges=new T.RenderTarget(1,1,rtOptions),weights=new T.RenderTarget(1,1,rtOptions);
 edges.texture.name='SMAA.edges';weights.texture.name='SMAA.weights';
 weightsMaterial.uniforms.tDiffuse.value=edges.texture;blendMaterial.uniforms.tDiffuse.value=weights.texture;
 let source=null,disposed=false,lookupTextures=[],lookupImages=[];
 const viewport=new Rect(),scissor=new Rect(),clearColor=new T.Color();
 const ready=Promise.allSettled([load('area'),load('search')]).then(results=>{
  lookupImages=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
  const failed=results.find(r=>r.status==='rejected');if(disposed||failed){for(const image of lookupImages)image.close?.();lookupImages=[];if(failed)stats.error=String(failed.reason?.message??failed.reason);return;}
  for(let i=0;i<2;i++){const texture=new T.Texture(results[i].value);texture.name=i?'SMAA.search':'SMAA.area';texture.minFilter=i?1003:1006;texture.magFilter=i?1003:1006;texture.flipY=false;texture.generateMipmaps=false;texture.needsUpdate=true;lookupTextures.push(texture);}
  weightsMaterial.uniforms.tArea.value=lookupTextures[0];weightsMaterial.uniforms.tSearch.value=lookupTextures[1];stats.ready=true;
 });
 function resize(width,height){
  if(source&&stats.width===width&&stats.height===height)return;
  source?.dispose();source=new T.Texture({width,height});source.isFramebufferTexture=true;source.name='SMAA.framebuffer';source.minFilter=source.magFilter=1006;source.generateMipmaps=false;source.flipY=false;source.needsUpdate=true;
  edges.setSize(width,height);weights.setSize(width,height);
  for(const material of [edgesMaterial,weightsMaterial,blendMaterial])material.uniforms.resolution.value.set(1/width,1/height);
  stats.width=width;stats.height=height;
 }
 function apply(){
  if(!stats.ready||disposed||renderer.getRenderTarget()!==null)return;
  const gl=renderer.getContext();if(gl.isContextLost())return;const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;if(!(width>0&&height>0))return;
  resize(width,height);
  // Preserve renderer state for the native flash, presentation and warmup paths.
  renderer.getViewport(viewport);renderer.getScissor(scissor);const test=renderer.getScissorTest(),autoClear=renderer.autoClear,alpha=renderer.getClearAlpha();renderer.getClearColor(clearColor);
  try{
   renderer.copyFramebufferToTexture(source);
   renderer.autoClear=false;renderer.setScissorTest(false);renderer.setClearColor(0,0);
   edgesMaterial.uniforms.tDiffuse.value=source;
   renderer.setRenderTarget(edges);renderer.clear();quad.material=edgesMaterial;renderer.render(quad,camera);
   renderer.setRenderTarget(weights);renderer.clear();quad.material=weightsMaterial;renderer.render(quad,camera);
   blendMaterial.uniforms.tColor.value=source;renderer.setRenderTarget(null);
   // Default-framebuffer viewport is in CSS pixels, target sizes are physical.
   const ratio=renderer.getPixelRatio();renderer.setViewport(0,0,width/ratio,height/ratio);
   quad.material=blendMaterial;renderer.render(quad,camera);
  }finally{
   renderer.setRenderTarget(null);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(test);renderer.setClearColor(clearColor,alpha);renderer.autoClear=autoClear;
  }
 }
 stage.render=function(...args){const value=original.render.apply(stage,args);apply();return value;};
 stage.prewarm=async function(...args){const value=await original.prewarm?.apply(stage,args);await ready;if(stats.error)throw Error('SMAA preparation failed: '+stats.error);if(!disposed){for(const texture of lookupTextures)renderer.initTexture(texture);apply();}return value;};
 stage.dispose=function(...args){disposed=true;source?.dispose();edges.dispose();weights.dispose();geometry.dispose();for(const material of [edgesMaterial,weightsMaterial,blendMaterial])material.dispose();for(const texture of lookupTextures)texture.dispose();for(const image of lookupImages)image.close?.();lookupImages=[];return original.dispose.apply(stage,args);};
 return stage;
}
