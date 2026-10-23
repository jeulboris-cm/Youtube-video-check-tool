// Counts attempts per key (an address, an email) and says when there have
// been too many in the time window. Kept in memory: a restart clears it,
// which is fine for stopping floods.
function createLimiter({ max, windowMs }) {
  const hits = new Map();
  return function tooMany(key) {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    // Forget old keys now and then so memory does not grow.
    if (hits.size > 10000) for (const [k, times] of hits) if (now - times[times.length - 1] > windowMs) hits.delete(k);
    return recent.length > max;
  };
}

module.exports = { createLimiter };
