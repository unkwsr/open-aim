// Static map batches only. Conservative box rejection precedes the original
// per-instance sphere decision; no geometry or draw-distance approximation.
export function prepareMapSpheres(spheres){
 if(!spheres)return null;
 const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
 for(let i=0;i<spheres.length;i+=4){const r=spheres[i+3];for(let a=0;a<3;a++){bounds[a]=Math.min(bounds[a],spheres[i+a]-r);bounds[a+3]=Math.max(bounds[a+3],spheres[i+a]+r);}}
 return {spheres,bounds,lastVisible:0,reject:new Uint8Array(spheres.length/4)};
}
export function copyFrustumPlanes(planes,target){
 for(let i=0;i<6;i++){const p=planes[i],j=i*4;target[j]=p.normal.x;target[j+1]=p.normal.y;target[j+2]=p.normal.z;target[j+3]=p.constant;}
 return target;
}
function testSphere(batch,planes,i){
 const n=batch.spheres,x=n[i],y=n[i+1],z=n[i+2],r=n[i+3],slot=i/4,first=batch.reject[slot],j=first*4;
 if(planes[j]*x+planes[j+1]*y+planes[j+2]*z+planes[j+3]<-r)return false;
 for(let p=0;p<6;p++){if(p===first)continue;const q=p*4;if(planes[q]*x+planes[q+1]*y+planes[q+2]*z+planes[q+3]<-r){batch.reject[slot]=p;return false;}}
 return true;
}
export function mapSpheresVisible(batch,planes){
 const b=batch.bounds,n=batch.spheres;
 // A small outward margin protects boundary decisions from roundoff.
 for(let p=0;p<24;p+=4){const x=planes[p],y=planes[p+1],z=planes[p+2],d=planes[p+3];
  const extent=x*(x<0?b[0]:b[3])+y*(y<0?b[1]:b[4])+z*(z<0?b[2]:b[5])+d;
  const pad=1e-9*(1+Math.abs(x)*Math.max(Math.abs(b[0]),Math.abs(b[3]))+Math.abs(y)*Math.max(Math.abs(b[1]),Math.abs(b[4]))+Math.abs(z)*Math.max(Math.abs(b[2]),Math.abs(b[5]))+Math.abs(d));
  if(extent < -pad)return false;
 }
 const last=batch.lastVisible;
 if(last<n.length&&testSphere(batch,planes,last))return true;
 for(let i=0;i<n.length;i+=4)if(i!==last&&testSphere(batch,planes,i)){batch.lastVisible=i;return true;}
 return false;
}
