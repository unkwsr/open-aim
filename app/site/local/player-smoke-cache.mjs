const same=(a,b)=>a.kind===b.kind&&a.id===b.id&&a.agent===b.agent&&a.team===b.team&&a.at===b.at&&a.life===b.life&&a.position.x===b.position.x&&a.position.y===b.position.y&&a.position.z===b.position.z;
const snapshot=node=>({...node,position:{...node.position}});

// Copycat bots' smokes come with owner (the bot's id) so their clouds never share an id with yours.
const smokeId=(z,born)=>(z.owner===undefined?'player-jett-':'copycat-'+z.owner+'-')+born;
export function createPlayerSmokeNodes(step){
 let nodes=[];
 return (zones,tick)=>{
  zones??=[];let changed=nodes.length!==zones.length;
  for(let i=0;!changed&&i<zones.length;i++){const z=zones[i],n=nodes[i],born=tick-z.ageTicks;changed=n.id!==smokeId(z,born)||n.position.x!==z.x||n.position.y!==z.y-.65||n.position.z!==z.z;}
  if(!changed)return nodes;
  nodes=zones.map(z=>{const born=tick-z.ageTicks;return{kind:'smoke',id:smokeId(z,born),agent:'jett',team:'enemy',at:born*step,position:{x:z.x,y:z.y-.65,z:z.z}};});
  return nodes;
 };
}

// Keep unchanged clouds alive. Recycle only removed ones, resetting their
// native seed, origin and simulation before they are attached to a new cast.
export function createSmokePool({create,canReuse,retarget,attach,detach,max=6}){
 let active=[],clouds=[],spare=[],created=0,reused=0,recycled=0,disposed=false;
 function recycle(cloud){detach(cloud);cloud.hide();if(max>0){if(spare.length>=max)spare.shift().dispose();spare.push(cloud);}else cloud.dispose();recycled++;}
 return {
  adopt(initial){for(const cloud of initial)recycle(cloud);},
  update(nodes){
   if(disposed)return clouds;
   if(active.length===nodes.length&&active.every((e,i)=>same(e.node,nodes[i])))return clouds;
   const used=new Set(),next=new Array(nodes.length);
   for(let i=0;i<nodes.length;i++){const at=active.findIndex((e,j)=>!used.has(j)&&same(e.node,nodes[i]));if(at>=0){used.add(at);next[i]=active[at];}}
   for(let i=0;i<active.length;i++)if(!used.has(i))recycle(active[i].cloud);
   for(let i=0;i<nodes.length;i++)if(!next[i]){
    const node=nodes[i],at=spare.findIndex(cloud=>canReuse(cloud,node));let cloud;
    if(at>=0){cloud=spare.splice(at,1)[0];retarget(cloud,node);reused++;}
    else{cloud=create(node);if(cloud)created++;}
    if(cloud){attach(cloud);next[i]={node:snapshot(node),cloud};}
   }
   active=next.filter(Boolean);clouds=active.map(e=>e.cloud);return clouds;
  },
  stats:()=>({created,reused,recycled,active:active.length,pooled:spare.length}),
  dispose(){if(disposed)return;disposed=true;for(const e of active)e.cloud.dispose();for(const cloud of spare)cloud.dispose();active=[];clouds=[];spare=[];}
 };
}
