// Export all middleware from a central location

export { cacheMiddleware, invalidateCache, etagMiddleware } from './cache.js';
export { rateLimiter, rateLimiters } from './rateLimiter.js';
export { requestTiming, getMetrics, resetMetrics, requestLogger } from './performance.js';
export { 
    CircuitBreaker, 
    circuits, 
    getAllCircuitStates, 
    resetCircuit 
} from './circuitBreaker.js';
export { 
    AppError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    RateLimitError,
    ExternalServiceError,
    asyncHandler,
    notFoundHandler,
    errorHandler,
    gracefulShutdown,
} from './errorHandler.js';
export { authenticate } from './authMiddleware.js';
