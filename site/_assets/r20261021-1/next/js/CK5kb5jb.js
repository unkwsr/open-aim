// Local resource adapter. Plain buffers captured through the normal original-origin loader.
import { performanceDiagnostics } from './performance-diagnostics.mjs';
const origin = 'https://static.ishoutu.cn';
const local = value => typeof value === 'string' && (value.startsWith(origin + '/') || value.startsWith('https://ishoutu.cn/')) ? new URL(value).pathname : value;
const cache = new Map();
const pending = new Map();
const maxCacheBytes = 16 * 1024 * 1024;
let cacheBytes = 0;
export const a = local, s = local;
export const m = value => typeof value === 'string' && value.startsWith(origin + '/') ? new URL(value).pathname : null;
export const i = () => {};
export const d = (url, options) => fetch(local(url), options);
export async function c(url, progress) {
  try {
    const response = await fetch(local(url));
    if (!response.ok) {
      const error = new Error('Local asset missing: ' + url + ' (' + response.status + ')');
      error.status = response.status; throw error;
    }
    const bytes = await response.arrayBuffer();
    progress?.({loaded:bytes.byteLength,total:bytes.byteLength}); return bytes;
  } catch (error) {
    performanceDiagnostics.record('asset', { asset: local(url), status: error?.status });
    throw error;
  }
}
export function g(url) {
  if (cache.has(url)) {
    const bytes = cache.get(url);
    cache.delete(url);
    cache.set(url, bytes);
    return Promise.resolve(bytes.slice(0));
  }
  if (!pending.has(url)) {
    const task = c(url).then(bytes => {
      if (bytes.byteLength <= maxCacheBytes) {
        while (cacheBytes + bytes.byteLength > maxCacheBytes) {
          const oldest = cache.keys().next().value;
          cacheBytes -= cache.get(oldest).byteLength;
          cache.delete(oldest);
        }
        cache.set(url, bytes);
        cacheBytes += bytes.byteLength;
      }
      return bytes;
    }).finally(() => pending.delete(url));
    pending.set(url, task);
  }
  return pending.get(url).then(bytes => bytes.slice(0));
}
export const f = async url => JSON.parse(new TextDecoder().decode(await c(url)));
export const e = async url => JSON.parse(new TextDecoder().decode(await g(url)));
export async function b(url, type) { const blobURL=URL.createObjectURL(new Blob([await c(url)],type?{type}:undefined));return {url:blobURL,revoke:()=>URL.revokeObjectURL(blobURL)}; }
export async function h(url, type) { const blobURL=URL.createObjectURL(new Blob([await g(url)],type?{type}:undefined));return {url:blobURL,revoke:()=>URL.revokeObjectURL(blobURL)}; }
