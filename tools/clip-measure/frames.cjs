// Decode a video in Electron: contact sheets or a frame range. args: <video> <outdir> sheet <step s> | range <t0> <t1> <fps> <scale>
const { app, BrowserWindow } = require('electron');
const [video, out, mode, ...rest] = process.argv.slice(process.argv.indexOf('--') + 1);
const SRC = 'file:///' + video.split(String.fromCharCode(92)).join('/');
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, width: 800, height: 600, webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false, backgroundThrottling: false } });
  await w.loadURL('data:text/html,<body></body>');
  const code = `(async()=>{const fs=require('fs');const v=document.createElement('video');v.muted=true;v.src=${JSON.stringify(SRC)};
   await new Promise((r,j)=>{v.onloadeddata=r;v.onerror=()=>j(new Error('load '+(v.error&&v.error.message)))});
   const seek=t=>new Promise(r=>{v.onseeked=()=>r();v.currentTime=t;});
   const W=v.videoWidth,H=v.videoHeight,D=v.duration;const info={W,H,D};
   const mode=${JSON.stringify(mode)},rest=${JSON.stringify(rest)},out=${JSON.stringify(out)};
   const save=(c,n)=>fs.writeFileSync(out+'/'+n,Buffer.from(c.toDataURL('image/png').split(',')[1],'base64'));
   if(mode==='sheet'){const step=+rest[0],cols=6,tw=320,th=Math.round(tw*H/W),per=36,start=+(rest[1]||0),end=+(rest[2]||D);let k=0,page=0;
    for(let p0=start;p0<end;p0+=step*per,page++){const c=document.createElement('canvas');c.width=cols*tw;c.height=Math.ceil(per/cols)*(th+18);const g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,c.width,c.height);
     for(let i=0;i<per;i++){const t=p0+i*step;if(t>=Math.min(D,end))break;await seek(t);const x=(i%cols)*tw,y=Math.floor(i/cols)*(th+18);g.drawImage(v,x,y+18,tw,th);g.fillStyle='#ff0';g.font='14px sans-serif';g.fillText(t.toFixed(2)+'s',x+4,y+14);}
     save(c,'sheet'+page+'.png');}}
   if(mode==='range'){const t0=+rest[0],t1=+rest[1],fps=+rest[2],sc=+(rest[3]||0.5);const c=document.createElement('canvas');c.width=Math.round(W*sc);c.height=Math.round(H*sc);const g=c.getContext('2d');
    for(let t=t0,i=0;t<=t1+1e-9;t+=1/fps,i++){await seek(t);g.drawImage(v,0,0,c.width,c.height);save(c,'f'+String(i).padStart(4,'0')+'_'+t.toFixed(3)+'.png');}}
   return info;})()`;
  try { console.log(JSON.stringify(await w.webContents.executeJavaScript(code))); } catch (e) { console.log('ERR', e.message); }
  app.quit();
});
