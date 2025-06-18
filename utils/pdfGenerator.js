const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Function to generate PDF for a Fibonacci result
async function generatePDF(jobId, n, result) {
  return new Promise((resolve, reject) => {
    try {
      // Create a PDF document
      const doc = new PDFDocument();
      
      // Define the output file path
      const resultsDir = path.join(__dirname, '../results');
      
      // Ensure the results directory exists
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }
      
      const outputPath = path.join(resultsDir, `${jobId}.pdf`);
      
      // Pipe the PDF output to a file
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      // Add content to the PDF
      doc.fontSize(20).text('Fibonacci Result', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text(`Job ID: ${jobId}`);
      doc.moveDown();
      doc.text(`Fibonacci(${n}) =`);
      doc.moveDown();
      
      // Format the result (may be very large)
      const resultStr = result.toString();
      let formattedResult = '';
      
      // Break up large numbers for better readability
      for (let i = 0; i < resultStr.length; i++) {
        formattedResult += resultStr[i];
        if ((i + 1) % 70 === 0) {
          formattedResult += '\n';
        }
      }
      
      doc.fontSize(12).text(formattedResult);
      doc.moveDown();
      
      // Add timestamp
      doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`);
      
      // Add expiration notice
      const expiryMinutes = Math.floor(process.env.PDF_EXPIRY_SECONDS / 60);
      doc.moveDown();
      doc.fontSize(10).text(`Note: This file will expire after ${expiryMinutes} minutes.`);
      
      // Finalize the PDF
      doc.end();
      
      stream.on('finish', () => {
        resolve(outputPath);

        // Schedule deletion after expiry
        const expiry = parseInt(process.env.PDF_EXPIRY_SECONDS) || 900;
        setTimeout(() => {
          fs.unlink(outputPath, (err) => {
            if (err) {
              console.error('Error deleting expired PDF:', err);
            } else {
              console.log(`Deleted expired PDF: ${outputPath}`);
            }
          });
        }, expiry * 1000);
      });
      
      stream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generatePDF }; 