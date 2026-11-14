// Remove functions / Vue wrappers while retaining the typed arrays used by HUDs.
export function wireValue(value,seen=new Map()){
 if(value===null||value===undefined||typeof value!=='object')return typeof value==='function'?undefined:value;
 if(value.$workerAudio)return{$workerAudio:true};
 if(ArrayBuffer.isView(value))return value instanceof DataView?new DataView(value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength)):value.slice();
 if(value instanceof ArrayBuffer)return value.slice(0);
 if(value instanceof Date)return new Date(value);
 if(seen.has(value))return seen.get(value);
 if(value instanceof Set){const out=new Set();seen.set(value,out);for(const item of value)out.add(wireValue(item,seen));return out;}
 if(value instanceof Map){const out=new Map();seen.set(value,out);for(const[k,v]of value)out.set(wireValue(k,seen),wireValue(v,seen));return out;}
 const out=Array.isArray(value)?new Array(value.length):{};seen.set(value,out);for(const key of Object.keys(value)){const item=wireValue(value[key],seen);if(item!==undefined)out[key]=item;}return out;
}
