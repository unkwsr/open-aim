// Shared by the settings panel and the game renderer. Values are validated at the boundary.
export const KEY='es-advanced-tracers-v1';
// Non-default skins only. Each one can replace the look of "Your shots" while it is equipped.
export const SKINS=[['rgx-vandal-yellow','RGX Yellow','vandal','#ffd21f'],['gaia-vandal-orange','Gaia Orange','vandal','#ff7a1a'],['gaia-vandal-white','Gaia White','vandal','#ffffff'],['blastx-phantom','BlastX','phantom','#3fc8ff'],['prime-guardian','Prime','guardian','#ffc14d'],['araxys-operator','Araxys','operator','#7dffcf'],['rogue-operator','Rogue','operator','#ff5a5a']];
const skin=color=>({enabled:true,color,brightness:1.5,width:.025,length:12,lifetime:.10});
export const defaults={mode:'original',player:{enabled:true,color:'#ffd185',brightness:1.5,width:.025,length:12,lifetime:.10,frequency:1,random:false,chance:.5},enemy:{enabled:false,color:'#ff8066',brightness:1.2,width:.02,length:8,lifetime:.10,frequency:1,random:false,chance:.5},skins:Object.fromEntries(SKINS.map(([id,,,color])=>[id,skin(color)]))};
const clamp=(v,min,max,fallback)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;};
const look=(v,d)=>({color:/^#[0-9a-f]{6}$/i.test(v.color??'')?v.color:d.color,brightness:clamp(v.brightness,.1,5,d.brightness),width:clamp(v.width,.002,.12,d.width),length:clamp(v.length,.5,50,d.length),lifetime:clamp(v.lifetime,.025,.5,d.lifetime)});
export function sanitize(value){const result={mode:value?.mode==='custom'?'custom':'original',skins:{}};for(const who of ['player','enemy']){const d=defaults[who],v=value?.[who]??{};result[who]={enabled:typeof v.enabled==='boolean'?v.enabled:d.enabled,...look(v,d),frequency:Math.round(clamp(v.frequency,1,10,d.frequency)),random:typeof v.random==='boolean'?v.random:d.random,chance:clamp(v.chance,.05,1,d.chance)};}for(const [id] of SKINS){const d=defaults.skins[id],v=value?.skins?.[id]??{};result.skins[id]={enabled:typeof v.enabled==='boolean'?v.enabled:d.enabled,...look(v,d)};}return result;}
// The skin equipped on a gun, or null for default skins and guns without a skin setting.
export function equippedSkin(weapon){const id={vandal:globalThis.__aimVandalSkin,phantom:globalThis.__aimPhantomSkin,guardian:globalThis.__aimGuardianSkin,operator:globalThis.__aimOperatorSkin}[weapon];return SKINS.some(([skin,,gun])=>skin===id&&gun===weapon)?id:null;}
let initial;try{initial=JSON.parse(localStorage.getItem(KEY));}catch{}
let current=sanitize(initial);const listeners=new Set();
export const getSettings=()=>current;
export function setSettings(value){current=sanitize(value);try{localStorage.setItem(KEY,JSON.stringify(current));}catch{}for(const listener of listeners)listener(current);return current;}
export const resetSettings=()=>setSettings(defaults);
export function subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);}
