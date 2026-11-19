// Track the minimap player icon. args: <video> <out.json> <t0> <t1> <fps> <refT> <refX> <refY>
const { app, BrowserWindow } = require('electron');
const a = process.argv.slice(process.argv.indexOf('--') + 1);
const [video, out] = a; const [t0, t1, fps, refT, refX, refY] = a.slice(2).map(Number);
const SRC = 'file:///' + video.split(String.fromCharCode(92)).join('/');
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await w.loadURL('data:text/html,<body></body>');
  const code = `(async()=>{const fs=require('fs');const v=document.createElement('video');v.muted=true;v.src=${JSON.stringify(SRC)};
  await new Promise((r,j)=>{v.onloadeddata=r;v.onerror=()=>j(new Error('load'))});
  const seek=t=>new Promise(r=>{v.onseeked=()=>r();v.currentTime=t;});
  const X0=0,Y0=30,CW=470,CH=440;const c=document.createElement('canvas');c.width=CW;c.height=CH;const g=c.getContext('2d',{willReadFrequently:true});
  const grab=async t=>{await seek(t);g.drawImage(v,X0,Y0,CW,CH,0,0,CW,CH);const d=g.getImageData(0,0,CW,CH).data;const L=new Float32Array(CW*CH);for(let i=0;i<CW*CH;i++)L[i]=.299*d[4*i]+.587*d[4*i+1]+.114*d[4*i+2];return L;};
  const R=7;const ref=await grab(${refT});const rx=${refX}-X0,ry=${refY}-Y0;const tpl=[];
  for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++)if(dx*dx+dy*dy<=R*R)tpl.push([dx,dy,ref[(ry+dy)*CW+rx+dx]]);
  const tm=tpl.reduce((s,p)=>s+p[2],0)/tpl.length;const ts=Math.sqrt(tpl.reduce((s,p)=>s+(p[2]-tm)**2,0));
  const ncc=(L,x,y)=>{let m=0;for(const p of tpl)m+=L[(y+p[1])*CW+x+p[0]];m/=tpl.length;let n=0,s2=0;for(const p of tpl){const q=L[(y+p[1])*CW+x+p[0]]-m;n+=q*(p[2]-tm);s2+=q*q;}return n/(Math.sqrt(s2)*ts+1e-9);};
  const res=[];let px=null,py=null,prevSum=null;
  // start: global search near ref position on the first frame
  for(let t=${t0},i=0;t<=${t1}+1e-9;t=${t0}+(++i)/${fps}){const L=await grab(t);let sum=0;for(let k=0;k<L.length;k+=97)sum+=L[k];const dup=prevSum!==null&&Math.abs(sum-prevSum)<1e-3;prevSum=sum;
   const sr=px===null?200:14,cx=px===null?rx:Math.round(px),cy=py===null?ry:Math.round(py);let best=-2,bx=cx,by=cy;
   for(let y=Math.max(R,cy-sr);y<=Math.min(CH-R-1,cy+sr);y++)for(let x=Math.max(R,cx-sr);x<=Math.min(CW-R-1,cx+sr);x++){const s=ncc(L,x,y);if(s>best){best=s;bx=x;by=y;}}
   const sx=(()=>{const l=ncc(L,bx-1,by),r=ncc(L,bx+1,by),d=l-2*best+r;return d<0?.5*(l-r)/d:0})(),sy=(()=>{const u=ncc(L,bx,by-1),dn=ncc(L,bx,by+1),d=u-2*best+dn;return d<0?.5*(u-dn)/d:0})();
   px=bx+sx;py=by+sy;res.push({t:+t.toFixed(4),x:+(px+X0).toFixed(2),y:+(py+Y0).toFixed(2),score:+best.toFixed(3),dup});}
  fs.writeFileSync(${JSON.stringify(out)},JSON.stringify(res));return res.length;})()`;
  try { console.log('frames', await w.webContents.executeJavaScript(code)); } catch (e) { console.log('ERR', e.message); }
  app.quit();
});
