import { Queue, Worker, QueueEvents } from "bullmq";
import redis from "../config/redis.js";

// Connection configuration using existing Redis
const connection = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT) || 6379
};

// If REDIS_URL is set, parse it
if (process.env.REDIS_URL) {
    try {
        const url = new URL(process.env.REDIS_URL);
        connection.host = url.hostname;
        connection.port = parseInt(url.port) || 6379;
        if (url.password) connection.password = url.password;
        if (url.protocol === "rediss:") {
            connection.tls = { rejectUnauthorized: false };
        }
    } catch (e) {
        console.error("Failed to parse REDIS_URL for BullMQ:", e.message);
    }
}

// Create queues for different job types
const queues = {};

/**
 * Get or create a queue
 */
export const getQueue = (name) => {
    if (!queues[name]) {
        queues[name] = new Queue(name, {
            connection,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 1000
                },
                removeOnComplete: {
                    age: 3600, // Keep completed jobs for 1 hour
                    count: 1000 // Keep last 1000 completed jobs
                },
                removeOnFail: {
                    age: 86400 // Keep failed jobs for 24 hours
                }
            }
        });

        console.log(`📦 Queue [${name}] created`);
    }
    return queues[name];
};

/**
 * Add a job to a queue
 */
export const addJob = async (queueName, jobName, data, options = {}) => {
    const queue = getQueue(queueName);
    const job = await queue.add(jobName, data, options);
    console.log(`📤 Job [${jobName}] added to queue [${queueName}] - ID: ${job.id}`);
    return job;
};

/**
 * Create a worker for a queue
 */
export const createWorker = (queueName, processor, options = {}) => {
    const worker = new Worker(queueName, processor, {
        connection,
        concurrency: options.concurrency || 5,
        limiter: options.limiter || {
            max: 10,
            duration: 1000
        },
        ...options
    });

    worker.on("completed", (job, result) => {
        console.log(`✅ Job [${job.name}] completed - ID: ${job.id}`);
    });

    worker.on("failed", (job, err) => {
        console.error(`❌ Job [${job?.name}] failed - ID: ${job?.id}: ${err.message}`);
    });

    worker.on("error", (err) => {
        console.error(`❌ Worker error on queue [${queueName}]:`, err.message);
    });

    console.log(`👷 Worker for queue [${queueName}] started`);
    return worker;
};

/**
 * Job processors for different task types
 */
export const jobProcessors = {
    /**
     * Scraping jobs - fetch problem data from external sources
     */
    scraping: async (job) => {
        const { problemId, platform, url } = job.data;
        console.log(`🔍 Scraping job started: ${platform}/${problemId}`);

        // Dynamic import to avoid circular dependencies
        const { default: scraperService } = await import("../utils/scraperService.js");

        try {
            let result;
            switch (platform) {
                case "codeforces":
                    result = await scraperService.scrapeCodeforces(problemId);
                    break;
                case "leetcode":
                    result = await scraperService.scrapeLeetcode(problemId);
                    break;
                default:
                    throw new Error(`Unknown platform: ${platform}`);
            }

            return { success: true, data: result };
        } catch (error) {
            console.error(`Scraping job failed for ${platform}/${problemId}:`, error.message);
            throw error;
        }
    },

    /**
     * AI jobs - process AI requests
     */
    ai: async (job) => {
        const { prompt, model, userId, context } = job.data;
        console.log(`🤖 AI job started for user: ${userId}`);

        // Dynamic import
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        try {
            const aiModel = genAI.getGenerativeModel({ model: model || "gemini-pro" });
            const result = await aiModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            return { success: true, response: text };
        } catch (error) {
            console.error(`AI job failed:`, error.message);
            throw error;
        }
    },

    /**
     * Cache warming jobs - pre-populate cache
     */
    cacheWarming: async (job) => {
        const { keys, ttl } = job.data;
        console.log(`🔥 Cache warming job started for ${keys.length} keys`);

        // Implementation depends on what needs to be cached
        return { success: true, warmedKeys: keys.length };
    },

    /**
     * Cleanup jobs - remove old data
     */
    cleanup: async (job) => {
        const { collection, olderThan } = job.data;
        console.log(`🧹 Cleanup job started for ${collection}`);

        const mongoose = await import("mongoose");
        const Model = mongoose.default.model(collection);

        const result = await Model.deleteMany({
            createdAt: { $lt: new Date(Date.now() - olderThan) }
        });

        return { success: true, deletedCount: result.deletedCount };
    }
};

/**
 * Initialize workers for common queues
 */
export const initializeWorkers = () => {
    // Scraping worker
    createWorker("scraping", jobProcessors.scraping, {
        concurrency: 3,
        limiter: { max: 5, duration: 1000 } // Max 5 per second
    });

    // AI worker
    createWorker("ai", jobProcessors.ai, {
        concurrency: 5,
        limiter: { max: 10, duration: 60000 } // Max 10 per minute
    });

    // Cache warming worker
    createWorker("cache", jobProcessors.cacheWarming, {
        concurrency: 10
    });

    // Cleanup worker
    createWorker("cleanup", jobProcessors.cleanup, {
        concurrency: 1
    });
};

/**
 * Schedule recurring jobs
 */
export const scheduleRecurringJobs = async () => {
    const cleanupQueue = getQueue("cleanup");

    // Schedule room cleanup every hour
    await cleanupQueue.add(
        "cleanup-rooms",
        { collection: "Room", olderThan: 24 * 60 * 60 * 1000 }, // 24 hours
        {
            repeat: {
                every: 60 * 60 * 1000 // Every hour
            },
            jobId: "cleanup-rooms-recurring"
        }
    );

    console.log("📅 Recurring jobs scheduled");
};

/**
 * Get queue statistics
 */
export const getQueueStats = async (queueName) => {
    const queue = getQueue(queueName);
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount()
    ]);

    return {
        name: queueName,
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + delayed
    };
};

/**
 * Get all queues statistics
 */
export const getAllQueueStats = async () => {
    const stats = {};
    for (const name of Object.keys(queues)) {
        stats[name] = await getQueueStats(name);
    }
    return stats;
};

/**
 * Graceful shutdown
 */
export const shutdown = async () => {
    console.log("🛑 Shutting down job queues...");
    
    for (const [name, queue] of Object.entries(queues)) {
        await queue.close();
        console.log(`📦 Queue [${name}] closed`);
    }
};

export default {
    getQueue,
    addJob,
    createWorker,
    jobProcessors,
    initializeWorkers,
    scheduleRecurringJobs,
    getQueueStats,
    getAllQueueStats,
    shutdown
};
