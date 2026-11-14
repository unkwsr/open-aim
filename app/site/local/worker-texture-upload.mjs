// Only browser-image adapters need the UNPACK_FLIP_Y_WEBGL query. Typed-array
// bone/data texture uploads must pass directly to WebGL without a state read.
export function uploadWorkerTexture(context,call,values){
 let hasBitmap=false;
 for(let i=0;i<values.length;i++)if(values[i]?.__bitmap){hasBitmap=true;break;}
 if(!hasBitmap)return call(...values);
 const flip=context.getParameter(context.UNPACK_FLIP_Y_WEBGL);
 return call(...values.map(value=>value?.__bitmap?(flip?value.__flipped:value.__bitmap):value));
}
