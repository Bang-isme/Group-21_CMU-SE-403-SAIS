const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load utilities
const cache = require('../utils/cache');
const jobQueue = require('../utils/jobQueue');

// Load environment variables
dotenv.config();

// Maximum allowed value for Fibonacci calculation
const MAX_N = parseInt(process.env.MAX_FIBONACCI_N) || 100000;

// Test endpoint to check API connection
router.get('/test', (req, res) => {
  return res.status(200).json({
    status: 'success',
    message: 'API is working correctly',
    timestamp: new Date().toISOString()
  });
});

// POST endpoint to request Fibonacci calculation
router.post('/', async (req, res) => {
  try {
    const { n } = req.body;
    
    // Validate input
    if (n === undefined || n === null) {
      return res.status(400).json({ error: 'Missing parameter: n' });
    }
    
    // Convert to number and validate
    const nValue = parseInt(n);
    
    if (isNaN(nValue)) {
      return res.status(400).json({ error: 'Parameter n must be a number' });
    }
    
    if (nValue < 0) {
      return res.status(400).json({ error: 'Parameter n must be a non-negative integer' });
    }
    
    if (nValue > MAX_N) {
      return res.status(400).json({ error: `Parameter n must be less than or equal to ${MAX_N}` });
    }
    
    // Check if result for this n already exists in cache
    const cachedResult = await cache.getResultByInput(nValue);
    
    if (cachedResult) {
      console.log(`Using cached result for Fibonacci(${nValue})`);
      
      // Return existing result and jobId
      return res.status(200).json({
        jobId: cachedResult.jobId,
        status: 'completed',
        n: nValue,
        result: cachedResult.result,
        downloadUrl: `/api/fibonacci/download/${cachedResult.jobId}`,
        fromCache: true,
        message: 'Result retrieved from cache'
      });
    }
    
    // Generate a unique job ID for new calculation
    const jobId = uuidv4();
    
    // Create job in cache
    await cache.setJob(jobId, {
      n: nValue,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    
    // Add job to the queue
    jobQueue.addJob(jobId, nValue);
    
    // Return job ID and status
    return res.status(202).json({
      jobId,
      status: 'pending',
      message: 'Fibonacci calculation has been queued'
    });
  } catch (error) {
    console.error('Error creating Fibonacci job:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET endpoint to check job status
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Get job from cache
    const jobData = await cache.getJob(jobId);
    
    if (!jobData) {
      return res.status(404).json({ error: 'Job not found or expired' });
    }
    
    // Prepare response based on job status
    const response = {
      jobId,
      status: jobData.status,
      n: jobData.n
    };
    
    // Add additional information based on status
    if (jobData.status === 'completed') {
      response.result = jobData.result;
      response.downloadUrl = `/api/fibonacci/download/${jobId}`;
    } else if (jobData.status === 'failed') {
      response.error = jobData.error;
    }
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('Error getting job status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET endpoint to download PDF result
router.get('/download/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Get job from cache
    const jobData = await cache.getJob(jobId);
    
    if (!jobData) {
      return res.status(404).json({ error: 'Job not found or expired' });
    }
    
    if (jobData.status !== 'completed') {
      return res.status(400).json({ error: 'Job is not completed yet' });
    }
    
    if (!jobData.pdfPath) {
      return res.status(404).json({ error: 'PDF file not found' });
    }
    
    // Check if file exists
    if (!fs.existsSync(jobData.pdfPath)) {
      return res.status(404).json({ error: 'PDF file not found or expired' });
    }
    
    // Send the file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="fibonacci-${jobId}.pdf"`);
    
    return res.sendFile(path.resolve(jobData.pdfPath));
  } catch (error) {
    console.error('Error downloading PDF:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 