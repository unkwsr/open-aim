import { mountLocalControls, suppressDesktopWelcome, suppressOriginalUi } from './local-mode.mjs';
import { installLocaleControl } from './locale-control.mjs';

// Start-up for the English UI. The runtime translator that used to rewrite page / canvas text was retired in
// batch 111 (6 Nov 2026): every served screen is direct English in code and data.
document.documentElement.lang='en';
document.documentElement.dataset.aimLocal='';
document.cookie='aim_ui_language=en; Path=/; Max-Age=31536000; SameSite=Lax';
try{suppressDesktopWelcome(window.localStorage)}catch{}
// Canvas text uses the app's UI font (Segoe UI) and at most weight 600, as before.
for(const prototype of [window.CanvasRenderingContext2D?.prototype,window.OffscreenCanvasRenderingContext2D?.prototype]){
  if(!prototype)continue;
  const font=Object.getOwnPropertyDescriptor(prototype,'font');
  if(font?.configurable&&font.set&&font.get)Object.defineProperty(prototype,'font',{...font,set(value){
    const localFont=typeof value==='string'?value.replace(/\b[789]00\b/g,'600').replace(/(\d+(?:\.\d+)?(?:px|pt|rem|em))\s+.+$/,'$1 "Segoe UI", Arial, sans-serif'):value;font.set.call(this,localFont);
  }});
}
installLocaleControl('en');
void import('../js/performance-diagnostics-ui.mjs').catch(() => {});
await import('/_assets/r20261021-1/next/js/index.uPZ7wDgX.js');
suppressOriginalUi();
mountLocalControls();
