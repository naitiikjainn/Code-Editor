import mongoose from "mongoose";

/**
 * MongoDB Connection with optimized settings
 * - Connection pooling for better performance
 * - Automatic reconnection
 * - Query optimizations
 */
const connectDB = async () => {
  try {
    // Connection options for production optimization
    const options = {
      // Connection Pool Settings
      maxPoolSize: 50,           // Maximum connections in pool
      minPoolSize: 10,           // Minimum connections to maintain
      maxIdleTimeMS: 30000,      // Close idle connections after 30s
      
      // Timeouts
      serverSelectionTimeoutMS: 5000,  // Timeout for server selection
      socketTimeoutMS: 45000,          // Close sockets after 45s inactivity
      connectTimeoutMS: 10000,         // Timeout for initial connection
      
      // Write Concern
      w: 'majority',                   // Wait for majority acknowledgment
      
      // Read Preference (can be changed based on needs)
      // readPreference: 'secondaryPreferred', // Read from secondaries when possible
      
      // Compression
      compressors: ['zlib'],           // Enable compression for network traffic
      
      // Other optimizations
      retryWrites: true,               // Automatically retry failed writes
      retryReads: true,                // Automatically retry failed reads
    };

    // Only apply certain options in production
    if (process.env.NODE_ENV === 'production') {
      options.heartbeatFrequencyMS = 10000; // Check connection health every 10s
    }

    const conn = await mongoose.connect(process.env.MONGO_URI, options);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`   Pool Size: ${options.maxPoolSize} connections`);

    // ONE-TIME MIGRATION: Drop the dangerous TTL index on lockUntil that was auto-deleting user documents
    try {
      const usersCollection = mongoose.connection.collection('users');
      const indexes = await usersCollection.indexes();
      const ttlIndex = indexes.find(idx => idx.key?.lockUntil && idx.expireAfterSeconds !== undefined);
      if (ttlIndex) {
        await usersCollection.dropIndex(ttlIndex.name);
        console.log(`🔧 Migration: Dropped dangerous TTL index "${ttlIndex.name}" on users.lockUntil`);
      }
    } catch (migrationErr) {
      // Ignore if index doesn't exist or already dropped
      if (migrationErr.code !== 27) { // 27 = IndexNotFound
        console.warn('⚠️ Migration warning (lockUntil TTL index):', migrationErr.message);
      }
    }

    // Monitor connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB Connection Error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB Disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB Reconnected');
    });

    // Enable query debugging in development
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_MONGOOSE) {
      mongoose.set('debug', (collectionName, methodName, ...methodArgs) => {
        console.log(`[MongoDB] ${collectionName}.${methodName}(${JSON.stringify(methodArgs)})`);
      });
    }

  } catch (err) {
    console.error(`❌ MongoDB Connection Error: ${err.message}`);
    // Do not exit process in test environment
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
  }
};

/**
 * Gracefully close database connection
 */
export const closeDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB Connection Closed');
  } catch (err) {
    console.error('❌ Error closing MongoDB connection:', err.message);
  }
};

/**
 * Get connection stats for monitoring
 */
export const getDBStats = () => {
  const conn = mongoose.connection;
  return {
    readyState: conn.readyState,
    host: conn.host,
    name: conn.name,
    // Note: These may not be available in all versions
    // poolSize: conn.client?.s?.options?.maxPoolSize,
  };
};

export default connectDB;