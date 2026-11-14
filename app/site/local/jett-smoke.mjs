import {TextureLoader,RepeatWrapping,LinearFilter,NoColorSpace} from '/studio/vendor/three.module.js';
// Shared per-renderer-instance maps: the exported Jett masks, decoded once.
export function createJettSmokeSurface(){
 const loader=new TextureLoader(),textures=['puff','wind'].map(name=>{
  const texture=loader.load('/local/jett-smoke/'+name+'.png');
  texture.wrapS=texture.wrapT=RepeatWrapping;texture.minFilter=texture.magFilter=LinearFilter;texture.colorSpace=NoColorSpace;return texture;
 });
 return{uniforms:{uPuff:{value:textures[0]},uWind:{value:textures[1]}},dispose(){textures.forEach(t=>t.dispose());}};
}
export const smokeVertex=`
uniform sampler2D uPuff;
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main(){
 vP=position;
 float puff=texture2D(uPuff,uv*vec2(3.,2.)+vec2(uTime*.025,0.)).r;
 vec3 cloud=position*(.985+.03*puff);
 vec4 view=modelViewMatrix*vec4(cloud,1.);
 vN=normalize(normalMatrix*normal);vV=normalize(-view.xyz);
 gl_Position=projectionMatrix*view;
}`;
export const smokeFragment=`
uniform sampler2D uPuff;
uniform sampler2D uWind;
uniform float uTime;
uniform float uTele;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main(){
 vec3 p=normalize(vP);
 vec2 uv=vec2(atan(p.z,p.x)/6.2831853+.5,asin(clamp(p.y,-1.,1.))/3.1415927+.5);
 vec2 flow=vec2(uTime*.075,uTime*-.018);
 float puff=texture2D(uPuff,uv*vec2(3.,2.)+flow*.4).r;
 float clouds=texture2D(uPuff,uv*vec2(5.,3.)-flow*.3+vec2(.37,.21)).r;
 float wind=texture2D(uWind,uv*vec2(2.,1.4)+flow+vec2(puff*.09,clouds*.04)).r;
 float curl=texture2D(uWind,uv*vec2(3.,2.)-flow*.65+vec2(.2,.6)).r;
 float fresnel=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.);
 float density=clamp(.35+puff*.5+clouds*.3,0.,1.);
 vec3 color=mix(vec3(.51,.68,.75),vec3(.77,.87,.89),density);
 float wisps=smoothstep(.28,.72,wind)*.19+smoothstep(.42,.8,curl)*.07;
 color=mix(color,vec3(.91,.97,.98),wisps+fresnel*.24);
 color*=.91+.09*max(p.y,0.);
 if(!gl_FrontFacing)color=mix(vec3(.45,.60,.65),color,.35);
 color+=uTele*fresnel*.035;
 gl_FragColor=vec4(color,1.);
}`;
