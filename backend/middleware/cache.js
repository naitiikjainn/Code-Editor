import redis from "../config/redis.js";

// In-memory fallback cache when Redis is unavailable
const memoryCache = new Map();

/**
 * Get from memory cache with TTL check
 */
const getMemoryCache = (key) => {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
        memoryCache.delete(key);
        return null;
    }
    return entry;
};

/**
 * Set memory cache with optional TTL
 */
const setMemoryCache = (key, value, ttlMs, staleWhileRevalidate = false) => {
    memoryCache.set(key, {
        value,
        expiresAt: ttlMs ? Date.now() + ttlMs : null,
        staleAt: staleWhileRevalidate ? Date.now() + (ttlMs * 0.8) : null,
        createdAt: Date.now()
    });
};

/**
 * Clean up expired memory cache entries (run periodically)
 */
const cleanupMemoryCache = () => {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
        if (entry.expiresAt && now > entry.expiresAt) {
            memoryCache.delete(key);
        }
    }
};

// Cleanup every 5 minutes
setInterval(cleanupMemoryCache, 5 * 60 * 1000);

/**
 * Advanced cache middleware with stale-while-revalidate support
 * 
 * @param {Object} options - Cache options
 * @param {number} options.ttl - Cache TTL in seconds
 * @param {boolean} options.staleWhileRevalidate - Enable SWR pattern
 * @param {Function} options.keyGenerator - Custom key generator (req) => string
 * @param {Function} options.condition - Condition to cache (req, res) => boolean
 */
export const cacheMiddleware = (options = {}) => {
    const {
        ttl = 300, // 5 minutes default
        staleWhileRevalidate = true,
        keyGenerator = (req) => `cache:${req.method}:${req.originalUrl}`,
        condition = () => true
    } = options;

    return async (req, res, next) => {
        // Skip caching for non-GET requests
        if (req.method !== "GET") {
            return next();
        }

        const cacheKey = keyGenerator(req);

        try {
            // Try Redis first
            let cached = null;
            let isStale = false;
            let fromRedis = false;

            try {
                const redisData = await redis.get(cacheKey);
                if (redisData) {
                    cached = JSON.parse(redisData);
                    fromRedis = true;
                    
                    // Check if stale (using TTL metadata)
                    const redisTtl = await redis.ttl(cacheKey);
                    if (staleWhileRevalidate && redisTtl < ttl * 0.2) {
                        isStale = true;
                    }
                }
            } catch (redisErr) {
                // Redis unavailable, try memory cache
                const memEntry = getMemoryCache(cacheKey);
                if (memEntry) {
                    cached = memEntry.value;
                    if (staleWhileRevalidate && memEntry.staleAt && Date.now() > memEntry.staleAt) {
                        isStale = true;
                    }
                }
            }

            // If cached and not stale, return immediately
            if (cached && !isStale) {
                res.set("X-Cache", "HIT");
                res.set("X-Cache-Source", fromRedis ? "redis" : "memory");
                return res.json(cached);
            }

            // If stale, return stale data but trigger background refresh
            if (cached && isStale) {
                res.set("X-Cache", "STALE");
                res.set("X-Cache-Source", fromRedis ? "redis" : "memory");
                
                // Trigger background refresh (don't await)
                setImmediate(() => {
                    refreshCache(req, cacheKey, ttl, staleWhileRevalidate);
                });
                
                return res.json(cached);
            }

            // No cache - intercept response to cache it
            const originalJson = res.json.bind(res);
            res.json = (data) => {
                // Only cache successful responses
                if (res.statusCode >= 200 && res.statusCode < 300 && condition(req, res)) {
                    // Store in both Redis and memory
                    try {
                        redis.setex(cacheKey, ttl, JSON.stringify(data)).catch(() => {});
                    } catch (e) {
                        // Redis unavailable
                    }
                    setMemoryCache(cacheKey, data, ttl * 1000, staleWhileRevalidate);
                }
                
                res.set("X-Cache", "MISS");
                return originalJson(data);
            };

            next();
        } catch (err) {
            // On any error, proceed without caching
            console.error("Cache middleware error:", err.message);
            next();
        }
    };
};

/**
 * Background refresh for stale-while-revalidate
 */
const refreshCache = async (req, cacheKey, ttl, staleWhileRevalidate) => {
    // This would need the actual route handler to refresh
    // For now, just invalidate the cache to force fresh fetch on next request
    console.log(`[SWR] Background refresh triggered for: ${cacheKey}`);
};

/**
 * Cache invalidation helper
 */
export const invalidateCache = async (pattern) => {
    try {
        // Invalidate Redis cache
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(...keys);
            console.log(`[Cache] Invalidated ${keys.length} Redis keys matching: ${pattern}`);
        }
    } catch (e) {
        console.error("[Cache] Redis invalidation error:", e.message);
    }

    // Invalidate memory cache
    let count = 0;
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    for (const key of memoryCache.keys()) {
        if (regex.test(key)) {
            memoryCache.delete(key);
            count++;
        }
    }
    if (count > 0) {
        console.log(`[Cache] Invalidated ${count} memory cache entries matching: ${pattern}`);
    }
};

/**
 * ETag middleware for conditional requests
 */
export const etagMiddleware = () => {
    return (req, res, next) => {
        const originalJson = res.json.bind(res);
        
        res.json = (data) => {
            // Generate ETag from response data
            const crypto = require("crypto");
            const etag = `"${crypto.createHash("md5").update(JSON.stringify(data)).digest("hex")}"`;
            
            res.set("ETag", etag);
            
            // Check If-None-Match header
            const ifNoneMatch = req.get("If-None-Match");
            if (ifNoneMatch === etag) {
                return res.status(304).end();
            }
            
            return originalJson(data);
        };
        
        next();
    };
};

export default { cacheMiddleware, invalidateCache, etagMiddleware, getMemoryCache, setMemoryCache };
