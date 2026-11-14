// Optional effects must not retry missing art on every render/shot.
export function createAssetRetryGate({now = () => performance.now(), initialDelay = 1000, maxDelay = 30000, missingDelay = 300000} = {}) {
  let retryAt = 0, delay = initialDelay;
  return {
    ready: () => now() >= retryAt,
    fail(error) {
      retryAt = now() + ([404,410].includes(error?.status) ? missingDelay : delay);
      delay = Math.min(maxDelay, delay * 2);
    },
    reset() { retryAt = 0; delay = initialDelay; },
  };
}

// Wait for all decoders, and release successes if any member fails. Otherwise
// a partial batch leaks GPU textures and a retry can overlap pending decodes.
export async function loadTextureBatch(tasks) {
  const results = await Promise.allSettled(tasks);
  const failure = results.find(result => result.status === 'rejected');
  if (failure) {
    for (const result of results) if (result.status === 'fulfilled') result.value.dispose();
    throw failure.reason;
  }
  return results.map(result => result.value);
}
