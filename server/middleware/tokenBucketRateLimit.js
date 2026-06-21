/** Token-bucket rate limiter — 100 requests/minute per IP by default. */

function createTokenBucketLimiter({
  capacity = 100,
  refillIntervalMs = 60_000,
  message = { error: 'Rate limit exceeded.' },
} = {}) {
  const buckets = new Map();

  function refillBucket(bucket, now) {
    if (!bucket) {
      return { tokens: capacity - 1, lastRefill: now };
    }
    const elapsed = now - bucket.lastRefill;
    if (elapsed >= refillIntervalMs) {
      const periods = Math.floor(elapsed / refillIntervalMs);
      const refilled = Math.min(capacity, bucket.tokens + periods * capacity);
      return { tokens: refilled - 1, lastRefill: now };
    }
    if (bucket.tokens <= 0) return null;
    return { tokens: bucket.tokens - 1, lastRefill: bucket.lastRefill };
  }

  return function tokenBucketRateLimit(req, res, next) {
    const ip =
      req.ip ||
      String(req.headers['x-forwarded-for'] || '')
        .split(',')[0]
        .trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    const now = Date.now();
    const current = buckets.get(ip);
    const updated = refillBucket(current, now);

    if (!updated) {
      res.setHeader('Retry-After', Math.ceil(refillIntervalMs / 1000));
      return res.status(429).json(message);
    }

    buckets.set(ip, updated);
    return next();
  };
}

module.exports = { createTokenBucketLimiter };
