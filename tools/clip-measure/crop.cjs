const { app, BrowserWindow, nativeImage } = require('electron'); const fs = require('fs');
const [png, out, x, y, w, h, sc] = process.argv.slice(process.argv.indexOf('--') + 1);
app.whenReady().then(() => { const img = nativeImage.createFromPath(png).crop({ x: +x, y: +y, width: +w, height: +h }); fs.writeFileSync(out, img.resize({ width: +w * +sc, quality: 'good' }).toPNG()); app.quit(); });
