const { workerData, parentPort } = require('worker_threads');
const { generatePDF } = require('../utils/pdfGenerator');

// Fast-doubling Fibonacci O(log n)
function fibFastDoubling(n) {
  n = BigInt(n);
  function fd(k) {
    if (k === 0n) return [0n, 1n];
    const [a, b] = fd(k >> 1n);
    const c = a * (2n * b - a);
    const d = a * a + b * b;
    if (k & 1n) {
      return [d, c + d];
    }
    return [c, d];
  }
  return fd(n)[0];
}

async function processFibonacciJob() {
  const { jobId, n } = workerData;
  
  try {
    if (jobId === undefined || n === undefined) {
      throw new Error('Missing required parameters: jobId or n');
    }
    
    console.log(`[Worker] Starting calculation for Fibonacci(${n}) with jobId: ${jobId}`);
    
    // Calculate Fibonacci number
    const result = fibFastDoubling(n);
    
    console.log(`[Worker] Calculation completed for jobId: ${jobId}`);
    
    // Generate PDF for the result
    let pdfPath;
    try {
      pdfPath = await generatePDF(jobId, n, result);
      console.log(`[Worker] PDF generated for jobId: ${jobId} at ${pdfPath}`);
    } catch (pdfError) {
      console.error(`[Worker] Error generating PDF for jobId: ${jobId}:`, pdfError);
      throw new Error(`Failed to generate PDF: ${pdfError.message}`);
    }
    
    // Send the result back to the parent thread
    parentPort.postMessage({
      jobId,
      result: result.toString(),
      pdfPath
    });
  } catch (error) {
    console.error(`[Worker] Error processing job ${jobId}:`, error);
    parentPort.postMessage({
      jobId,
      error: error.message
    });
  }
}

// Start processing the job
processFibonacciJob(); 