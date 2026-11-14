// Preserve notification order while sharing one cross-thread delivery per task.
export function createAudioBatch(deliver, enqueue = queueMicrotask) {
 let pending = [], scheduled = false;
 function flush() {
  if (!pending.length) return;
  const calls = pending;
  pending = [];
  deliver({type:'audio-batch', calls});
 }
 return {
  push(call) {
   pending.push(call);
   if (scheduled) return;
   scheduled = true;
   enqueue(() => {scheduled = false; flush()});
  },
  flush,
 };
}
