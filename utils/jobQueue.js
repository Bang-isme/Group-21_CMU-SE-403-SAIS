const { Worker } = require('worker_threads');
const path = require('path');
const cache = require('./cache');

// Simple in-memory queue
const queue = [];

// Max concurrent workers (can be configured via env)
const MAX_CONCURRENT_WORKERS = parseInt(process.env.MAX_WORKERS) || 2;
let activeWorkers = 0;

// Spawn a worker for a job
function spawnWorker(job) {
  cache.updateJobStatus(job.jobId, 'processing').catch(console.error);

  const worker = new Worker(path.join(__dirname, '../workers/fibonacciWorker.js'), {
    workerData: { jobId: job.jobId, n: job.n }
  });

  // Listen for messages from worker
  worker.on('message', async (message) => {
    if (message.error) {
      await cache.updateJobError(job.jobId, message.error);
    } else {
      await cache.updateJobResult(job.jobId, message.result, message.pdfPath);
    }
  });

  // Handle worker errors
  worker.on('error', async (error) => {
    console.error(`Worker error for job ${job.jobId}:`, error);
    await cache.updateJobError(job.jobId, error.message);
  });

  // On exit, free slot and try next
  worker.on('exit', (code) => {
    activeWorkers--;
    if (code !== 0) {
      console.error(`Worker for job ${job.jobId} exited with code ${code}`);
    }
    tryStartNext();
  });
}

function tryStartNext() {
  while (activeWorkers < MAX_CONCURRENT_WORKERS && queue.length > 0) {
    const job = queue.shift();
    activeWorkers++;
    spawnWorker(job);
  }
}

const jobQueue = {
  // Add a new job to the queue
  addJob(jobId, n) {
    queue.push({ jobId, n });
    tryStartNext();
    return { jobId, status: 'pending' };
  },

  // Current queue length
  getQueueLength() {
    return queue.length;
  }
};

module.exports = jobQueue; 