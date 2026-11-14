// Render-list traversal only. World transforms and skeleton uploads still run
// through the native renderer. A branch containing an attachment is not skipped.
const cached=new WeakMap(),observed=new WeakSet();
function invalidate(){
 for(let node=this;node;node=node.parent)cached.delete(node);
}
export function skipBoneRenderBranch(node){
 const known=cached.get(node);if(known!==undefined)return known;
 if(!observed.has(node)){
  observed.add(node);node.addEventListener('childadded',invalidate);node.addEventListener('childremoved',invalidate);
 }
 let empty=node.isBone===true&&!node.isMesh&&!node.isLine&&!node.isPoints&&!node.isSprite&&!node.isLight&&!node.isLightProbeGrid&&!node.isLOD&&!node.isGroup;
 if(empty)for(const child of node.children){if(!child.isBone||!skipBoneRenderBranch(child)){empty=false;break;}}
 cached.set(node,empty);return empty;
}
