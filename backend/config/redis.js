import Redis from "ioredis";

const buildRedisOptions = (url) => {
    const isTls = url?.startsWith("rediss://");
    return {
        retryStrategy: (times) => (times > 5 ? null : Math.min(times * 100, 2000)),
        maxRetriesPerRequest: 2,
        connectTimeout: 5000,
        ...(isTls ? { tls: { rejectUnauthorized: false } } : {})
    };
};

const redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, buildRedisOptions(process.env.REDIS_URL))
    : new Redis({
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: process.env.REDIS_PORT || 6379,
        retryStrategy: (times) => (times > 5 ? null : Math.min(times * 100, 2000)),
        maxRetriesPerRequest: 2,
        connectTimeout: 5000
    });

redis.on("connect", () => {
    console.log("✅ Redis Connected");
});

redis.on("error", (err) => {
    console.warn("⚠️ Redis Connection Error (Caching disabled):", err.message);
});

export default redis;
