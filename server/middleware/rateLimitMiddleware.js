function createRateLimiter({
    windowMs = 60 * 1000,
    max = 30,
    keyGenerator,
    errorCode = 'RATE_LIMIT_EXCEEDED',
    errorMessage = 'Too many requests. Please try again shortly.',
} = {}) {
    const buckets = new Map();

    function getBucket(key, now) {
        const existing = buckets.get(key);
        if (!existing || now >= existing.resetAt) {
            const nextBucket = {
                count: 0,
                resetAt: now + windowMs,
            };
            buckets.set(key, nextBucket);
            return nextBucket;
        }
        return existing;
    }

    function cleanup(now) {
        for (const [key, bucket] of buckets.entries()) {
            if (now >= bucket.resetAt) {
                buckets.delete(key);
            }
        }
    }

    return function rateLimiter(req, res, next) {
        const now = Date.now();
        if (Math.random() < 0.01) cleanup(now);

        const key = typeof keyGenerator === 'function'
            ? keyGenerator(req)
            : req.ip;
        const bucket = getBucket(key || req.ip || 'unknown', now);

        bucket.count += 1;

        res.setHeader('x-ratelimit-limit', String(max));
        res.setHeader('x-ratelimit-remaining', String(Math.max(0, max - bucket.count)));
        res.setHeader('x-ratelimit-reset', String(Math.ceil(bucket.resetAt / 1000)));

        if (bucket.count > max) {
            return res.status(429).json({
                error: errorCode,
                message: errorMessage,
            });
        }

        next();
    };
}

const chatResponseRateLimiter = createRateLimiter({
    windowMs: Number.parseInt(process.env.CHAT_RESPONSE_RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: Number.parseInt(process.env.CHAT_RESPONSE_RATE_LIMIT_MAX || '30', 10),
    keyGenerator: (req) => req.user?.id || req.ip || 'anonymous',
    errorCode: 'CHAT_RATE_LIMIT_EXCEEDED',
    errorMessage: 'Too many chat requests. Please wait a moment and try again.',
});

module.exports = {
    createRateLimiter,
    chatResponseRateLimiter,
};
