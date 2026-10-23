// Small bounded JSON reports, never screen recordings or arbitrary console logs.
const KEY = 'aim-performance-debug-v2', TTL = 7 * 86400000;
export function createDiagnosticDelivery({ storage, send, now = Date.now } = {}) {
  let records = [], sending = false, lastSent = -Infinity, lastSignature = '', lastId = '', error = '';
  try { records = JSON.parse(storage?.getItem(KEY) || '[]'); } catch { /* Storage denied. */ }
  records = Array.isArray(records) ? records.filter(item => item?.data?.schema === 'aim-performance-v2' && item.savedAt > now() - TTL).slice(-3) : [];
  lastId = records.at(-1)?.id || '';
  function save() { try { storage?.setItem(KEY, JSON.stringify(records)); } catch { /* Memory-only fallback. */ } }
  return {
    previous() { return records.map(item => structuredClone(item.data)); },
    status() { return { sending, id: lastId, error, pending: records.some(item => !item.id) }; },
    capture(data) {
      data = { ...data }; delete data.previousReports;
      if (JSON.stringify(data).length > 48 * 1024) {
        data.timeline = data.timeline?.slice(-20); data.history = data.history?.slice(-3);
        data.events = data.events?.slice(-25).map(item => ({ ...item, scripts: item.scripts?.slice(0, 2) }));
      }
      if (JSON.stringify(data).length > 60 * 1024) return;
      records = records.filter(item => item.savedAt > now() - TTL);
      records.push({ savedAt: now(), data });
      // Menu/startup events after reload must not evict the useful gameplay report.
      const keep = new Set([records.at(-1), ...records.filter(item => item.data.ready || item.data.history?.some(sample => sample.ready)).slice(-2)]);
      for (const item of records.toReversed()) { if (keep.size >= 3) break; keep.add(item); }
      records = records.filter(item => keep.has(item)).slice(-3); save();
    },
    async flush({ force = false } = {}) {
      if (sending || !send || (!force && now() - lastSent < 300000)) return lastId;
      const item = records.findLast(item => !item.id);
      if (!item) return lastId;
      const event = item.data.events?.at(-1);
      const signature = `${item.data.scene}:${event?.kind}:${event?.at}:${item.data.lastSampleMs}`;
      if (!force && signature === lastSignature) return lastId;
      sending = true; error = '';
      try {
        const result = await send(item.data);
        if (!/^[a-f0-9-]{36}$/.test(result?.id || '')) throw Error('Invalid report receipt');
        item.id = result.id; lastId = result.id; lastSignature = signature; lastSent = now(); save();
      } catch { error = 'send-failed'; lastSent = now(); }
      finally { sending = false; }
      return lastId;
    },
    clear() { records = []; lastId = ''; error = ''; try { storage?.removeItem(KEY); } catch { /* Optional storage. */ } },
  };
}
