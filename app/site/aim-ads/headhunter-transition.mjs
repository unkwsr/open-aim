// Add the authored ADS animation arc to the calibrated hip/ADS endpoints.
// Sampling follows the existing zoom progress, so reversing aim never starts a second timer.
function capture(bones){return bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone()}));}
function copy(target,bones){for(let i=0;i<bones.length;i++){target[i].p.copy(bones[i].position);target[i].q.copy(bones[i].quaternion);}}
export function createHeadhunterTransition(bones,inClip,outClip){
 const saved=capture(bones),start=[],end=[];
 for(const clip of [inClip,outClip]){clip.sample(0,bones);start.push(capture(bones));clip.sample(clip.duration,bones);end.push(capture(bones));}
 for(let i=0;i<bones.length;i++){bones[i].position.copy(saved[i].p);bones[i].quaternion.copy(saved[i].q);}
 const last=capture(bones),from=capture(bones);for(const list of [last,from])for(const b of list){b.p.set(0,0,0);b.q.identity();}
 const p=bones[0].position.clone(),q=bones[0].quaternion.clone(),delta=q.clone();
 let previous=0,direction=1,changed=-Infinity,time=-Infinity;
 return {apply(progress,seconds){
  const value=Math.max(0,Math.min(1,progress));
  if(seconds<time){previous=value;changed=-Infinity;for(const b of last){b.p.set(0,0,0);b.q.identity();}}
  time=seconds;const next=value>previous+1e-6?1:value<previous-1e-6?-1:direction;
  if(next!==direction){for(let i=0;i<last.length;i++){from[i].p.copy(last[i].p);from[i].q.copy(last[i].q);}direction=next;changed=seconds;}
  previous=value;
  if(value<=0||value>=1){for(const b of last){b.p.set(0,0,0);b.q.identity();}return;}
  copy(saved,bones);const index=direction>0?0:1,u=direction>0?value:1-value,clip=index?outClip:inClip;
  clip.sample(u*clip.duration,bones);
  const blend=Math.min(1,Math.max(0,(seconds-changed)/.035)),smooth=blend*blend*(3-2*blend);
  for(let i=0;i<bones.length;i++){
   const b=bones[i];
   p.copy(start[index][i].p).lerp(end[index][i].p,u).negate().add(b.position);
   q.copy(start[index][i].q).slerp(end[index][i].q,u);delta.copy(q).invert().multiply(b.quaternion).normalize();
   if(smooth<1){p.lerp(from[i].p,1-smooth);delta.slerp(from[i].q,1-smooth);}
   last[i].p.copy(p);last[i].q.copy(delta);b.position.copy(saved[i].p).add(p);b.quaternion.copy(saved[i].q).multiply(delta).normalize();
  }
 }};
}
