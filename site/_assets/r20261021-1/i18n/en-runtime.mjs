import { translateText } from './translate-en.mjs';
import { mountLocalControls, suppressDesktopWelcome, suppressOriginalUi } from './local-mode.mjs';
import { installLocaleControl } from './locale-control.mjs';

document.documentElement.lang='en';
document.documentElement.dataset.aimLocal='';
document.cookie='aim_ui_language=en; Path=/; Max-Age=31536000; SameSite=Lax';
try{suppressDesktopWelcome(window.localStorage)}catch{}
const ignored=new Set(['SCRIPT','STYLE','CODE','PRE','TEXTAREA']);
const attributes=['placeholder','title','aria-label','aria-description','aria-valuetext','alt','label'];
function text(node){
  if (/^[\d\s.,:+/%×−–—\-()|°∞]+$/u.test(node.nodeValue)) return;
  if(!node.parentElement||node.parentElement.closest('[contenteditable="true"],script,style,code,pre,textarea,.pw-card-mk,.pw-maker,.am-scene-author'))return;
  const translated=translateText(node.nodeValue);if(translated!==node.nodeValue)node.nodeValue=translated;
}
function element(node){
  if(['SCRIPT','STYLE','CODE','PRE'].includes(node.tagName))return;
  for(const name of attributes){const value=node.getAttribute(name);if(value){const translated=translateText(value);if(value!==translated)node.setAttribute(name,translated)}}
  if(node.tagName==='INPUT'&&['button','submit','reset'].includes(node.type))node.value=translateText(node.value);
}
function scan(node){
  if(node.nodeType===Node.TEXT_NODE){text(node);return}
  if(node.nodeType!==Node.ELEMENT_NODE)return;element(node);
  if(ignored.has(node.tagName)||node.closest('[contenteditable="true"]'))return;
  for(const child of node.childNodes)scan(child);
}
scan(document.documentElement);
new MutationObserver(records=>{for(const record of records){
  if(record.type==='characterData')text(record.target);else if(record.type==='attributes')element(record.target);else for(const child of record.addedNodes)scan(child);
}}).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
for(const prototype of [window.CanvasRenderingContext2D?.prototype,window.OffscreenCanvasRenderingContext2D?.prototype]){
  if(!prototype)continue;
  const font=Object.getOwnPropertyDescriptor(prototype,'font');
  if(font?.configurable&&font.set&&font.get)Object.defineProperty(prototype,'font',{...font,set(value){
    const localFont=typeof value==='string'?value.replace(/\b[789]00\b/g,'600').replace(/(\d+(?:\.\d+)?(?:px|pt|rem|em))\s+.+$/,'$1 "Segoe UI", Arial, sans-serif'):value;font.set.call(this,localFont);
  }});
  for(const name of ['fillText','strokeText','measureText']){const original=prototype[name];prototype[name]=function(value,...args){return Reflect.apply(original,this,[translateText(value),...args])}}
}
installLocaleControl('en');
void import('../js/performance-diagnostics-ui.mjs').catch(() => {});
await import('/_assets/r20261021-1/next/js/index.uPZ7wDgX.js');
suppressOriginalUi();
mountLocalControls();
