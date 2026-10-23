// Smoke test: drives a running AimTrainer (started with --remote-debugging-port)
// over the DevTools protocol, loads several maps and reports console errors
// and failed requests.
//   node test-maps.mjs 9223
const port = process.argv[2] || "9223";
const SCENES = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ["C935A7", "CB2431", "03FB06", "FF8153", "E141B0", "5E7181", "F9B26B", "066349", "5A9E43", "74C0E1"];

async function waitForTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === "page" && t.url.includes("localhost:8000"));
      if (page) return page;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("no AimTrainer page found on the debugging port");
}

const page = await waitForTarget();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let nextId = 1;
const pending = new Map();
const consoleErrors = [];
const failed = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
  } else if (msg.method === "Runtime.exceptionThrown") {
    consoleErrors.push("EXCEPTION " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text).slice(0, 200));
  } else if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
    consoleErrors.push("LOG " + msg.params.entry.text.slice(0, 200) + (msg.params.entry.url ? " " + msg.params.entry.url : ""));
  } else if (msg.method === "Network.responseReceived" && msg.params.response.status >= 400) {
    failed.push(msg.params.response.status + " " + msg.params.response.url);
  } else if (msg.method === "Network.loadingFailed" && !msg.params.canceled) {
    failed.push("FAILED " + msg.params.errorText + " " + (msg.params.requestId));
  }
};
const send = (method, params = {}) => new Promise((r) => {
  const id = nextId++;
  pending.set(id, r);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expr) => {
  const res = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (res.result?.exceptionDetails) return "JS ERROR " + res.result.exceptionDetails.exception?.description;
  return res.result?.result?.value;
};

await send("Runtime.enable");
await send("Log.enable");
await send("Network.enable");
await send("Page.reload", { ignoreCache: true });
await new Promise((r) => setTimeout(r, 6000));

const helpers = `
const vis=e=>e&&e.offsetParent!==null&&getComputedStyle(e).visibility!=='hidden';
window.__exitBtn=()=>[...document.querySelectorAll('button')].find(b=>/^Exit Training( Q)?$/.test(b.textContent.replace(/\\s+/g,' ').trim())&&vis(b));
window.__state=()=>{ const L=document.querySelector('section.al-wkload'); if(L&&/won't open|failed|error/i.test(L.innerText)) return 'FAILED'; if(document.querySelector('section.al-wkload.is-loading')) return 'LOADING'; if(__exitBtn()) return 'MENU'; const cue=document.querySelector('.al-scene-start-cue'); if(vis(cue)) return 'READY'; if([...document.querySelectorAll('canvas')].some(c=>vis(c)&&c.width>300)) return 'INGAME'; if([...document.querySelectorAll('button,a')].some(b=>/^(Training history|Start training|Sign in)$/.test(b.textContent.trim())&&vis(b))) return 'LOBBY'; return 'UNKNOWN';};
window.__cardBtn=(id)=>{for(const b of [...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Start training')){let c=b; for(let k=0;k<8&&c;k++){ const ids=c.textContent.match(/NO\\.[0-9A-F]{6}/g); if(ids){ if(new Set(ids).size===1 && ids[0]==='NO.'+id) return b; break; } c=c.parentElement;} } return null;};
window.__leave=async()=>{ let b=__exitBtn(); if(!b) b=[...document.querySelectorAll('button')].find(x=>/^(Return to Watt Factory|Back to the lobby\\.?)$/.test(x.textContent.trim())&&vis(x)); if(!b) return 'NOEXIT'; b.click(); await new Promise(r=>setTimeout(r,2500)); return __state(); };
window.__test=async(id)=>{ const b=__cardBtn(id); if(!b) return id+' NOTFOUND'; b.scrollIntoView({block:'center'}); b.click(); const t0=Date.now(); let s; while(Date.now()-t0<30000){ await new Promise(r=>setTimeout(r,1000)); s=__state(); if(['READY','INGAME','FAILED'].includes(s)) break; } const sec=Math.round((Date.now()-t0)/1000); const l=await __leave(); return id+' '+s+' '+sec+'s -> '+l; };
const all=[...document.querySelectorAll('button')].find(b=>/^8 maps\\s*All maps/.test(b.textContent.trim())); if(all) all.click();
'helpers ok, lobby state ' + __state() + ', title ' + document.title`;
console.log(await evaluate(helpers));
await new Promise((r) => setTimeout(r, 1000));

let ok = 0;
for (const id of SCENES) {
  const r = await evaluate(`__test('${id}')`);
  console.log("  " + r);
  if (/ (READY|INGAME) /.test(r)) ok++;
}
console.log(`\n${ok}/${SCENES.length} maps loaded`);
console.log("ad check: " + await evaluate(`(() => {
  const sel = '.aim-ad-dock,.aim-ad-label,.aim-result-ad,.al-wk-ad-card,.map-ad-anchor,iframe';
  const els = [...document.querySelectorAll(sel)];
  const shown = els.filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed' && getComputedStyle(e).display !== 'none');
  const foreign = [...document.querySelectorAll('iframe')].filter(f => f.src && !f.src.startsWith(location.origin));
  return els.length + ' ad elements in page, ' + shown.length + ' visible, ' + foreign.length + ' foreign iframes';
})()`));
const uniq = (a) => [...new Set(a)];
console.log(`console errors (${uniq(consoleErrors).length}):`);
uniq(consoleErrors).slice(0, 40).forEach((e) => console.log("  " + e));
console.log(`failed requests (${uniq(failed).length}):`);
uniq(failed).slice(0, 40).forEach((e) => console.log("  " + e));
ws.close();
process.exit(0);
