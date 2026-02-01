/**
 * Error Handling Middleware
 * Centralized error handling with proper logging and client responses
 */

// Custom error classes
export class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.timestamp = new Date().toISOString();
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message, errors = []) {
        super(message, 400);
        this.name = 'ValidationError';
        this.errors = errors;
    }
}

export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
        this.name = 'NotFoundError';
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403);
        this.name = 'ForbiddenError';
    }
}

export class RateLimitError extends AppError {
    constructor(retryAfter = 60) {
        super('Too many requests, please try again later', 429);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}

export class ExternalServiceError extends AppError {
    constructor(service, originalError) {
        super(`${service} service unavailable`, 503);
        this.name = 'ExternalServiceError';
        this.service = service;
        this.originalError = originalError?.message;
    }
}

/**
 * Wrap async route handlers to catch errors
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Not found handler - for unmatched routes
 */
export const notFoundHandler = (req, res, next) => {
    next(new NotFoundError(`Route ${req.originalUrl}`));
};

/**
 * Main error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }
    // Set defaults
    err.statusCode = err.statusCode || 500;
    err.message = err.message || 'Internal Server Error';

    // Log error details (but not to client)
    const logData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userId: req.user?.id,
        statusCode: err.statusCode,
        message: err.message,
        stack: err.stack,
    };

    // Log differently based on severity
    if (err.statusCode >= 500) {
        console.error('❌ SERVER ERROR:', JSON.stringify(logData, null, 2));
    } else if (err.statusCode >= 400) {
        console.warn('⚠️ CLIENT ERROR:', JSON.stringify({
            ...logData,
            stack: undefined, // Don't log stack for client errors
        }));
    }

    // Development vs Production response
    const isDev = process.env.NODE_ENV === 'development';

    // Handle specific error types
    if (err.name === 'ValidationError' && err.errors) {
        // Mongoose/Joi validation errors
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: err.message,
            errors: err.errors,
            ...(isDev && { stack: err.stack }),
        });
    }

    if (err.name === 'CastError') {
        // MongoDB invalid ID error
        return res.status(400).json({
            success: false,
            error: 'Invalid ID',
            message: `Invalid ${err.path}: ${err.value}`,
        });
    }

    if (err.code === 11000) {
        // MongoDB duplicate key error
        const field = Object.keys(err.keyValue || {})[0];
        return res.status(409).json({
            success: false,
            error: 'Duplicate Error',
            message: `${field ? `${field} already exists` : 'Duplicate key error'}`,
        });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            error: 'Invalid Token',
            message: 'Please log in again',
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            error: 'Token Expired',
            message: 'Your session has expired, please log in again',
        });
    }

    if (err.name === 'RateLimitError') {
        res.set('Retry-After', err.retryAfter);
        return res.status(429).json({
            success: false,
            error: 'Rate Limit Exceeded',
            message: err.message,
            retryAfter: err.retryAfter,
        });
    }

    if (err.name === 'ExternalServiceError') {
        return res.status(503).json({
            success: false,
            error: 'Service Unavailable',
            message: err.message,
            service: err.service,
        });
    }

    // Generic error response
    res.status(err.statusCode).json({
        success: false,
        error: err.name || 'Error',
        message: err.isOperational ? err.message : 'Something went wrong',
        ...(isDev && {
            stack: err.stack,
            originalMessage: err.message,
        }),
    });
};

/**
 * Graceful shutdown handler
 */
export const gracefulShutdown = (server, connections = []) => {
    let isShuttingDown = false;

    const shutdown = async (signal) => {
        if (isShuttingDown) return;
        isShuttingDown = true;

        console.log(`\n📤 Received ${signal}. Starting graceful shutdown...`);

        // Stop accepting new connections
        server.close(() => {
            console.log('✅ HTTP server closed');
        });

        // Close database connections
        for (const connection of connections) {
            try {
                if (connection.close) {
                    await connection.close();
                    console.log('✅ Connection closed');
                } else if (connection.quit) {
                    await connection.quit();
                    console.log('✅ Connection quit');
                } else if (connection.disconnect) {
                    await connection.disconnect();
                    console.log('✅ Connection disconnected');
                }
            } catch (err) {
                console.error('❌ Error closing connection:', err.message);
            }
        }

        // Force exit if graceful shutdown takes too long
        setTimeout(() => {
            console.error('⚠️ Forced shutdown after timeout');
            process.exit(1);
        }, 30000);

        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};

export default {
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
};
