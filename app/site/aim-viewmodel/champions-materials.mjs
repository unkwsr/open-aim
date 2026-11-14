// Small Champions-only shader approximations; cooked JSON omits the UE graphs.
export function championsMaterial(material,spec){
 if(spec.reconProjectedCamo){
  const config=spec.reconProjectedCamo,previousCompile=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
  material.onBeforeCompile=shader=>{
   previousCompile.call(material,shader);
   shader.uniforms.reconCamoPattern={value:material.emissiveMap};
   shader.vertexShader='varying vec3 reconCamoPosition;varying vec3 reconCamoNormal;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nreconCamoPosition=position;reconCamoNormal=normal;');
   shader.fragmentShader='uniform sampler2D reconCamoPattern;varying vec3 reconCamoPosition;varying vec3 reconCamoNormal;\n'+shader.fragmentShader;
   // Position projection breaks the source suppressor's reused UV islands.
   // Warp and a fixed part offset stop parallel rings receiving identical bands.
   const projection=`
    vec3 rcP=reconCamoPosition*.061+vec3(${config.offset.join(',')});
    rcP+=.11*sin(rcP.zxy*2.7+vec3(.7,2.1,4.3));
    vec3 rcWeights=pow(abs(normalize(reconCamoNormal)),vec3(6.0));rcWeights/=max(.001,rcWeights.x+rcWeights.y+rcWeights.z);
    vec3 rcPattern=texture2D(reconCamoPattern,fract(rcP.yz)).rgb*rcWeights.x+texture2D(reconCamoPattern,fract(rcP.xz)).rgb*rcWeights.y+texture2D(reconCamoPattern,fract(rcP.xy)).rgb*rcWeights.z;
    float rcLight=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
    float rcMask=${config.mode==='upper'?`smoothstep(.05,.2,reconCamoPosition.z-9.3)*smoothstep(1.15,1.65,diffuseColor.r/max(.008,max(diffuseColor.g,diffuseColor.b)))`:`smoothstep(.012,.065,rcLight)`};
    vec3 rcPaint=rcPattern*clamp(pow(max(rcLight,.001),.32)*1.5,.38,1.15);
    diffuseColor.rgb=mix(diffuseColor.rgb,rcPaint,rcMask);
   `;
   const upperDark = config.mode === 'darkUpper' ? `
    float rcUpperMask=smoothstep(${Number(config.lowerCm).toFixed(3)},${Number(config.upperCm).toFixed(3)},reconCamoPosition.z);
    vec3 rcNative=texture2D(reconCamoPattern,vMapUv).rgb;
    float rcNativeLight=dot(rcNative,vec3(.2126,.7152,.0722));
    vec3 rcCharcoal=vec3(clamp(rcNativeLight*.22+.008,.008,.085))*vec3(.97,.985,1.0);
    diffuseColor.rgb=mix(diffuseColor.rgb,rcCharcoal,rcUpperMask);
   ` : projection;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+upperDark);
   // emissiveMap carries the shared camo sampler; it emits no light.
   shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','');
  };
  material.customProgramCacheKey=()=>previousKey.call(material)+':recon-projected-v1:'+JSON.stringify(config);
  return material;
 }
 if(spec.championsOutline){
  const {near,far,distance,opacity}=spec.championsOutline;
  // Inverted hull: the opaque body hides the shell interior without bloom passes.
  material.side=1;material.depthWrite=false;material.toneMapped=false;
  if(opacity!==undefined){material.transparent=true;material.opacity=opacity;material.blending=2;}
  material.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float championsDistance=length((modelViewMatrix*vec4(transformed,1.0)).xyz)*100.0;
    transformed += normalize(normal)*mix(${Number(near).toFixed(5)},${Number(far).toFixed(5)},clamp(championsDistance/${Number(distance).toFixed(5)},0.0,1.0));`);
  };
  material.customProgramCacheKey=()=>`champions-hull:${near}:${far}:${distance}:${opacity}`;
 }else if(spec.championsSurface){
  // Preserve detail on the long, obliquely viewed receiver and projected lettering.
  // Three.js clamps this request to the device's supported anisotropy level.
  for(const texture of new Set([material.map,material.normalMap,material.roughnessMap,material.metalnessMap,material.aoMap,material.championsLogo])){
   if(texture?.isTexture&&texture.anisotropy!==16){texture.anisotropy=16;texture.needsUpdate=true;}
  }
  const surface=spec.championsSurface,{glow,emissive,logoColor,logoWidth,logoAspect,logoX,logoZ,logoMetallic,logoRoughness}=surface;
  material.onBeforeCompile=shader=>{
   shader.uniforms.championsMask={value:material.aoMap};
   shader.uniforms.championsGradient={value:material.emissiveMap};
   shader.uniforms.championsLogo={value:material.championsLogo};
   shader.vertexShader='varying vec3 championsPosition;\nvarying vec3 championsSideNormal;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nchampionsPosition=position;championsSideNormal=normal;');
   shader.fragmentShader=`varying vec3 championsPosition;\nvarying vec3 championsSideNormal;\nuniform sampler2D championsMask;\nuniform sampler2D championsGradient;\nuniform sampler2D championsLogo;\n`+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    float championsMaskValue=texture2D(championsMask,vMapUv).g;
    float championsFacing=abs(dot(normalize(normal),normalize(vViewPosition)));
    vec3 championsGold=texture2D(championsGradient,vec2(clamp(0.30+0.35*championsFacing,0.0,1.0),0.5)).rgb;
    float championsRed=smoothstep(0.35,0.65,1.0-max(diffuseColor.g,diffuseColor.b)/max(diffuseColor.r,0.001))*(1.0-smoothstep(0.01,0.08,championsMaskValue));
    diffuseColor.rgb=mix(max(diffuseColor.rgb,vec3(0.010,0.013,0.018)),diffuseColor.rgb,championsRed);
    metalnessFactor=mix(metalnessFactor,0.10,championsRed);
    roughnessFactor=max(roughnessFactor,mix(0.25,0.40,championsRed));
    diffuseColor.rgb=mix(diffuseColor.rgb,championsGold,clamp(championsMaskValue*1.4,0.0,1.0)*0.85);
    float championsRim=pow(1.0-championsFacing,3.0);
    totalEmissiveRadiance += championsMaskValue*(vec3(${glow.join(',')})*championsRim*0.025+vec3(${emissive.join(',')})*0.02);
    vec2 championsLogoUv=vec2(1.0-(championsPosition.x-${logoX})/${Number(logoWidth).toFixed(4)},0.5-(championsPosition.z-${logoZ})/${logoWidth*logoAspect});
    float championsLogoBounds=step(0.0,championsLogoUv.x)*step(championsLogoUv.x,1.0)*step(0.0,championsLogoUv.y)*step(championsLogoUv.y,1.0);
    float championsSide=smoothstep(0.55,0.9,abs(normalize(championsSideNormal).y));
    float championsLetter=texture2D(championsLogo,clamp(championsLogoUv,0.0,1.0)).b*championsLogoBounds*championsSide*${surface.logoEnabled===false?'0.0':'1.0'};
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.9,0.68,0.16),championsLetter);
    metalnessFactor=mix(metalnessFactor,${logoMetallic},championsLetter);
    roughnessFactor=mix(roughnessFactor,${logoRoughness},championsLetter);
    totalEmissiveRadiance += vec3(${logoColor.join(',')})*championsLetter*0.8;`);
   // Keep white reflection cards from washing the painted red regions pink.
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight.gb *= mix(1.0,0.55,championsRed);\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey=()=>`champions-metal-v2:${JSON.stringify(surface)}`;
 }
 return material;
}
