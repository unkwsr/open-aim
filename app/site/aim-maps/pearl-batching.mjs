// Pearl uses full-resolution exported images instead of the precompressed images
// in the older maps. Make them eligible for the engine's existing array batching.
// This adds no animation, lighting effects, geometry reduction or texture resizing.
export function preparePearlTextureArrays(root){
 const textures=new Set();root.traverse(object=>{if(!object.isMesh)return;for(const material of Array.isArray(object.material)?object.material:[object.material])if(material?.map&&!material.map.isCompressedTexture)textures.add(material.map);});
 for(const texture of textures){if(texture.userData.pearlRawPixels)continue;texture.updateMatrix();const m=texture.matrix.elements;if(texture.channel!==0||m.some((v,i)=>Math.abs(v-([0,4,8].includes(i)?1:0))>1e-7))continue;
  const image=texture.image,width=image?.width,height=image?.height;if(!width||!height)continue;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  texture.userData.pearlRawPixels={data:new Uint8Array(ctx.getImageData(0,0,width,height).data),width,height};
 }
}
export function pearlRawArrayKey(texture){
 const p=texture.userData?.pearlRawPixels;if(!p)return null;
 return ['pearl-rgba',p.width,p.height,texture.colorSpace,texture.wrapS,texture.wrapT,texture.minFilter,texture.magFilter,texture.anisotropy,texture.premultiplyAlpha?1:0].join('|');
}
export function makePearlRawArray(textures){
 const first=textures[0],p=first.userData.pearlRawPixels,stride=p.width*p.height*4,data=new Uint8Array(stride*textures.length);
 textures.forEach((texture,index)=>data.set(texture.userData.pearlRawPixels.data,index*stride));
 // DataArrayTexture's storage contract, using the renderer's own Texture/Source
 // classes so this module doesn't load a second copy of the Three.js library.
 const array=new first.constructor();for(const key of ['colorSpace','wrapS','wrapT','minFilter','magFilter','anisotropy','premultiplyAlpha','type','format'])array[key]=first[key];array.source=new first.source.constructor({data,width:p.width,height:p.height,depth:textures.length});
 array.userData={};array.isDataArrayTexture=true;array.isCompressedTexture=false;array.isCompressedArrayTexture=false;
 array.layerUpdates=new Set();array.addLayerUpdate=index=>array.layerUpdates.add(index);array.clearLayerUpdates=()=>array.layerUpdates.clear();
 array.mipmaps=[];array.wrapR=1001;array.unpackAlignment=1;array.flipY=false;array.generateMipmaps=true;
 array.name=`al-texarray:pearl:${p.width}x${p.height}x${textures.length}`;array.needsUpdate=true;return array;
}
