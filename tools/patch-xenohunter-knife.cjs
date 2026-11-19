const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
function edit(file, transform) {
  const target=path.join(root,file), before=fs.readFileSync(target,'utf8');
  if(before.includes('/* xenohunter-knife */')) return;
  const after=transform(before);
  assert.notEqual(after,before,file);
  const backup=path.join(root,'backups/xenohunter-knife',file);
  fs.mkdirSync(path.dirname(backup),{recursive:true});
  if(!fs.existsSync(backup))fs.writeFileSync(backup,before);
  fs.writeFileSync(target,after);
}
function replace(text,from,to,count) {
  assert.equal(text.split(from).length-1,count,from);
  return text.split(from).join(to);
}
for(const route of ['app/site/next/js/','app/site/_assets/r20261021-1/next/js/']) {
  edit(route+'DXHU7cEs.js', text=>{
    text=replace(text,"if(H==='knife'){const sigil=", "/* xenohunter-knife */if(H==='knife'&&(window.__aimMeleeSkin||localStorage.getItem('es-melee-skin'))==='xenohunter-knife')H='xenohunter-knife';if(H==='knife'){const sigil=",2);
    text=replace(text,"const __aimMotion=__aimStem.startsWith", "const __aimMotion=__aimStem==='xenohunter-knife'?'xenohunter-knife.motions':__aimStem.startsWith",1);
    text=text.replaceAll("'champions-2021-karambit','champions-2024-blade'","'champions-2021-karambit','xenohunter-knife','champions-2024-blade'");
    text=text.replaceAll("H==='champions-2021-karambit'||", "H==='xenohunter-knife'||H==='champions-2021-karambit'||");
    text=replace(text,"||J.skin?.id==='champions-2021-karambit'){", "||J.skin?.id==='champions-2021-karambit'||J.skin?.id==='xenohunter-knife'){",1);
    return text;
  });
  edit(route+'OkAdunfX.js', text=>replace(text,'window.__aimMeleeSkin?.startsWith("vct-2026-sigil-")?5:',
    '/* xenohunter-knife */window.__aimMeleeSkin==="xenohunter-knife"?7:window.__aimMeleeSkin?.startsWith("vct-2026-sigil-")?5:',1));
  const loader=path.join(root,route+'DXHU7cEs.js');
  const current=fs.readFileSync(loader,'utf8');
  if(current.includes("...['attack4','attack5'].filter"))fs.writeFileSync(loader,
    replace(current,"...['attack4','attack5'].filter","...['attack4','attack5','attack6','attack7'].filter",1));
}
edit('app/collection.js',text=>replace(text,'      { id: "champions-2024-blade",',
  '      /* xenohunter-knife */\n      { id: "xenohunter-knife", name: "Xenohunter Knife" },\n      { id: "champions-2024-blade",',1));
edit('app/local-customization.js',text=>replace(text,"['damascus-karambit','Champions 2021 Karambit'],",
  "/* xenohunter-knife */['xenohunter-knife','Xenohunter Knife'],['damascus-karambit','Champions 2021 Karambit'],",1));
