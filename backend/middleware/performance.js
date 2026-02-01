/**
 * Request timing and performance monitoring middleware
 * Logs slow requests and provides performance metrics
 */

// Performance thresholds (ms)
const SLOW_REQUEST_THRESHOLD = 500; // Log warnings for requests > 500ms
const VERY_SLOW_REQUEST_THRESHOLD = 2000; // Log errors for requests > 2s

// Track request statistics
const stats = {
    totalRequests: 0,
    totalResponseTime: 0,
    slowRequests: 0,
    errorRequests: 0,
    endpointStats: new Map(),
    startTime: Date.now()
};

/**
 * Request timing middleware
 * Adds timing headers and logs slow requests
 */
export const requestTiming = () => {
    return (req, res, next) => {
        const startTime = process.hrtime.bigint();
        const startMs = Date.now();
        
        // Add request ID for tracing
        req.requestId = `${startMs}-${Math.random().toString(36).substr(2, 9)}`;
        if (!res.headersSent) {
            res.set("X-Request-ID", req.requestId);
        }
        
        // Track response
        const originalEnd = res.end.bind(res);
        res.end = function(...args) {
            const endTime = process.hrtime.bigint();
            const durationNs = Number(endTime - startTime);
            const durationMs = durationNs / 1_000_000;
            
            // Set timing headers
            if (!res.headersSent) {
                res.set("X-Response-Time", `${durationMs.toFixed(2)}ms`);
            }
            
            // Update statistics
            updateStats(req, res, durationMs);
            
            // Log slow requests
            if (durationMs > VERY_SLOW_REQUEST_THRESHOLD) {
                console.error(`🐢 VERY SLOW [${durationMs.toFixed(0)}ms] ${req.method} ${req.originalUrl}`);
            } else if (durationMs > SLOW_REQUEST_THRESHOLD) {
                console.warn(`⚠️ SLOW [${durationMs.toFixed(0)}ms] ${req.method} ${req.originalUrl}`);
            }
            
            return originalEnd.apply(this, args);
        };
        
        next();
    };
};

/**
 * Update performance statistics
 */
const updateStats = (req, res, durationMs) => {
    stats.totalRequests++;
    stats.totalResponseTime += durationMs;
    
    if (durationMs > SLOW_REQUEST_THRESHOLD) {
        stats.slowRequests++;
    }
    
    if (res.statusCode >= 400) {
        stats.errorRequests++;
    }
    
    // Per-endpoint stats
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    if (!stats.endpointStats.has(endpoint)) {
        stats.endpointStats.set(endpoint, {
            count: 0,
            totalTime: 0,
            minTime: Infinity,
            maxTime: 0,
            errors: 0
        });
    }
    
    const endpointStat = stats.endpointStats.get(endpoint);
    endpointStat.count++;
    endpointStat.totalTime += durationMs;
    endpointStat.minTime = Math.min(endpointStat.minTime, durationMs);
    endpointStat.maxTime = Math.max(endpointStat.maxTime, durationMs);
    if (res.statusCode >= 400) {
        endpointStat.errors++;
    }
};

/**
 * Get performance metrics
 */
export const getMetrics = () => {
    const uptime = Date.now() - stats.startTime;
    const avgResponseTime = stats.totalRequests > 0 
        ? stats.totalResponseTime / stats.totalRequests 
        : 0;
    
    // Get top 10 slowest endpoints
    const slowestEndpoints = Array.from(stats.endpointStats.entries())
        .map(([endpoint, stat]) => ({
            endpoint,
            avgTime: stat.totalTime / stat.count,
            maxTime: stat.maxTime,
            count: stat.count,
            errorRate: stat.errors / stat.count
        }))
        .sort((a, b) => b.avgTime - a.avgTime)
        .slice(0, 10);
    
    return {
        uptime: `${Math.floor(uptime / 1000 / 60)} minutes`,
        totalRequests: stats.totalRequests,
        avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
        slowRequestRate: stats.totalRequests > 0 
            ? `${((stats.slowRequests / stats.totalRequests) * 100).toFixed(2)}%` 
            : "0%",
        errorRate: stats.totalRequests > 0 
            ? `${((stats.errorRequests / stats.totalRequests) * 100).toFixed(2)}%` 
            : "0%",
        requestsPerMinute: stats.totalRequests / (uptime / 1000 / 60),
        slowestEndpoints
    };
};

/**
 * Reset statistics
 */
export const resetStats = () => {
    stats.totalRequests = 0;
    stats.totalResponseTime = 0;
    stats.slowRequests = 0;
    stats.errorRequests = 0;
    stats.endpointStats.clear();
    stats.startTime = Date.now();
};

/**
 * Log request details (for debugging)
 */
export const requestLogger = (options = {}) => {
    const { 
        logBody = false, 
        logHeaders = false,
        skipPaths = ['/health', '/metrics', '/favicon.ico']
    } = options;
    
    return (req, res, next) => {
        // Skip logging for certain paths
        if (skipPaths.some(p => req.path.includes(p))) {
            return next();
        }
        
        const logData = {
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.originalUrl,
            ip: req.ip || req.connection?.remoteAddress,
            userAgent: req.get("User-Agent")?.substring(0, 100)
        };
        
        if (logBody && req.body && Object.keys(req.body).length > 0) {
            // Redact sensitive fields
            const sanitizedBody = { ...req.body };
            ["password", "token", "secret", "key", "authorization"].forEach(field => {
                if (sanitizedBody[field]) sanitizedBody[field] = "[REDACTED]";
            });
            logData.body = sanitizedBody;
        }
        
        if (logHeaders) {
            logData.headers = {
                contentType: req.get("Content-Type"),
                authorization: req.get("Authorization") ? "[PRESENT]" : undefined
            };
        }
        
        console.log(`📥 ${logData.method} ${logData.path}`);
        
        next();
    };
};

export default { requestTiming, getMetrics, resetStats, requestLogger };
