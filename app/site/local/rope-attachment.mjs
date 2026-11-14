// Exact segment-to-box distance: the pawn is a vertical capsule, not a point.
// Volume axes/half extents come from the source actor's oriented UsableVolume.
export function capsuleOverlapsRopeVolume(position,capsule,volume){
 if(!volume)return true;
 const radius=capsule.x,segment=Math.max(0,capsule.y-radius);
 const delta=[position.x-volume.center[0],position.y+capsule.y-volume.center[1],position.z-volume.center[2]];
 const a=volume.axes.map(axis=>axis.reduce((sum,v,i)=>sum+v*delta[i],0)-axis[1]*segment);
 const d=volume.axes.map(axis=>2*axis[1]*segment),h=volume.half;
 const cuts=[0,1];for(let i=0;i<3;i++)if(Math.abs(d[i])>1e-12)for(const edge of [-h[i],h[i]]){const t=(edge-a[i])/d[i];if(t>0&&t<1)cuts.push(t);}
 cuts.sort((x,y)=>x-y);
 const distance=t=>a.reduce((sum,v,i)=>{const gap=Math.max(0,Math.abs(v+d[i]*t)-h[i]);return sum+gap*gap;},0);
 let best=Math.min(distance(0),distance(1));
 for(let j=1;j<cuts.length;j++){
  const lo=cuts[j-1],hi=cuts[j],mid=(lo+hi)/2;let numerator=0,denominator=0;
  for(let i=0;i<3;i++){const v=a[i]+d[i]*mid;if(v>h[i]||v<-h[i]){const edge=v>0?h[i]:-h[i];numerator+=d[i]*(a[i]-edge);denominator+=d[i]*d[i];}}
  const t=denominator?Math.max(lo,Math.min(hi,-numerator/denominator)):mid;
  best=Math.min(best,distance(t));
 }
 return best<=radius*radius+1e-10;
}
