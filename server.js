const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const fibonacciRoutes = require('./routes/fibonacci');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// API response middleware
app.use((req, res, next) => {
  // Store the original json method
  const originalJson = res.json;
  
  // Override the json method
  res.json = function(data) {
    // Add API version and timestamp to all JSON responses
    const responseData = {
      ...data,
      apiVersion: '1.0',
      timestamp: new Date().toISOString()
    };
    
    // Call the original json method
    return originalJson.call(this, responseData);
  };
  
  next();
});

// Routes
app.use('/api/fibonacci', fibonacciRoutes);

// Root route to serve the HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 