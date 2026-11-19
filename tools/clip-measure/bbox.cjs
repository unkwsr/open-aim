const { app, nativeImage } = require('electron');
const [png] = process.argv.slice(process.argv.indexOf('--') + 1);
app.whenReady().then(() => { const im = nativeImage.createFromPath(png); const { width: W, height: H } = im.getSize(); const b = im.toBitmap();
 let x0 = W, x1 = 0, y0 = H, y1 = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (b[(y * W + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
 console.log(JSON.stringify({ W, H, x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 })); app.quit(); });
