const redis = require('redis');
const dotenv = require('dotenv');

dotenv.config();

// Fallback in-memory cache
let useMemoryCache = false;
const memoryCache = new Map();
const expiryTimers = new Map();
// Cache for Fibonacci results by input value
const resultsByInput = new Map();
const expiryTimersInput = new Map();

// Create Redis client
const client = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
});

// Connect to Redis
(async () => {
  client.on('error', (err) => {
    console.error('Redis error:', err);
    if (!useMemoryCache) {
      console.log('Switching to in-memory cache due to Redis error');
      useMemoryCache = true;
    }
  });
  
  try {
    await client.connect();
    console.log('Connected to Redis');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    console.log('Using in-memory cache instead');
    useMemoryCache = true;
  }
})();

// Default expiry time in seconds (15 minutes)
const DEFAULT_EXPIRY = parseInt(process.env.PDF_EXPIRY_SECONDS) || 900;

// Cache functions
const cache = {
  // Store a job with its status, result, and PDF path
  async setJob(jobId, data, expiry = DEFAULT_EXPIRY) {
    if (useMemoryCache) {
      const jobData = JSON.stringify(data);
      memoryCache.set(jobId, jobData);
      
      // Clear any existing expiry timer
      if (expiryTimers.has(jobId)) {
        clearTimeout(expiryTimers.get(jobId));
      }
      
      // Set expiry timer
      const timer = setTimeout(() => {
        memoryCache.delete(jobId);
        expiryTimers.delete(jobId);
      }, expiry * 1000);
      
      expiryTimers.set(jobId, timer);
      return 'OK';
    } else {
      const jobData = JSON.stringify(data);
      return await client.setEx(jobId, expiry, jobData);
    }
  },

  // Get job data by jobId
  async getJob(jobId) {
    if (useMemoryCache) {
      const jobData = memoryCache.get(jobId);
      return jobData ? JSON.parse(jobData) : null;
    } else {
      const jobData = await client.get(jobId);
      return jobData ? JSON.parse(jobData) : null;
    }
  },

  // Update job status
  async updateJobStatus(jobId, status) {
    const jobData = await this.getJob(jobId);
    if (!jobData) return null;
    
    jobData.status = status;
    await this.setJob(jobId, jobData);
    return jobData;
  },

  // Update job with result
  async updateJobResult(jobId, result, pdfPath) {
    const jobData = await this.getJob(jobId);
    if (!jobData) return null;
    
    jobData.status = 'completed';
    jobData.result = result;
    jobData.pdfPath = pdfPath;
    await this.setJob(jobId, jobData);
    
    // Also cache by input value
    if (jobData.n !== undefined) {
      await this.cacheResultByInput(jobData.n, {
        result,
        pdfPath,
        jobId
      });
    }
    
    return jobData;
  },

  // Update job with error
  async updateJobError(jobId, error) {
    const jobData = await this.getJob(jobId);
    if (!jobData) return null;
    
    jobData.status = 'failed';
    jobData.error = error;
    await this.setJob(jobId, jobData);
    return jobData;
  },

  // Check if job exists
  async jobExists(jobId) {
    if (useMemoryCache) {
      return memoryCache.has(jobId);
    } else {
      return await client.exists(jobId) === 1;
    }
  },

  // Delete a job
  async deleteJob(jobId) {
    if (useMemoryCache) {
      if (expiryTimers.has(jobId)) {
        clearTimeout(expiryTimers.get(jobId));
        expiryTimers.delete(jobId);
      }
      return memoryCache.delete(jobId);
    } else {
      return await client.del(jobId);
    }
  },
  
  // Cache result by input value
  async cacheResultByInput(n, data) {
    const key = `fib:${n}`;
    if (useMemoryCache) {
      resultsByInput.set(key, data);
      if (expiryTimersInput.has(key)) clearTimeout(expiryTimersInput.get(key));
      const t = setTimeout(() => {
        resultsByInput.delete(key);
        expiryTimersInput.delete(key);
      }, DEFAULT_EXPIRY * 1000);
      expiryTimersInput.set(key, t);
      return true;
    } else {
      return await client.setEx(key, DEFAULT_EXPIRY, JSON.stringify(data));
    }
  },
  
  // Get cached result by input value
  async getResultByInput(n) {
    const key = `fib:${n}`;
    if (useMemoryCache) {
      return resultsByInput.get(key) || null;
    } else {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    }
  }
};

module.exports = cache; 