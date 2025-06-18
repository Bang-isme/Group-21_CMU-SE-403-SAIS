const axios = require('axios');

// Cấu hình test
const config = {
  totalUsers: 1000,        // Tổng số người dùng
  concurrentUsers: 1000,    // Số người đồng thời (để tránh lỗi ECONNREFUSED)
  baseUrl: 'http://localhost:3000',
  requestPath: '/api/fibonacci',
  requestData: { n: 20 }   // Số nhỏ để kết quả nhanh
};

// Mảng lưu thời gian phản hồi
const responseTimes = [];
let successCount = 0;
let errorCount = 0;

async function runBatch(batchSize, batchNumber) {
  console.log(`Đang chạy batch ${batchNumber}, ${batchSize} users...`);
  
  const promises = [];
  
  for (let i = 0; i < batchSize; i++) {
    const userId = (batchNumber - 1) * batchSize + i + 1;
    
    promises.push(
      (async () => {
        const startTime = Date.now();
        try {
          const response = await axios.post(
            `${config.baseUrl}${config.requestPath}`, 
            config.requestData
          );
          
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          responseTimes.push(responseTime);
          successCount++;
          
          if (userId % 50 === 0 || userId === config.totalUsers) {
            console.log(`User ${userId}/${config.totalUsers}: ${responseTime}ms`);
          }
          
          return {
            userId,
            status: 'success',
            jobId: response.data.jobId,
            responseTime
          };
        } catch (error) {
          errorCount++;
          console.error(`User ${userId} gặp lỗi: ${error.message}`);
          return {
            userId,
            status: 'error',
            error: error.message
          };
        }
      })()
    );
  }
  
  return Promise.all(promises);
}

async function runLoadTest() {
  console.log(`Bắt đầu load test với ${config.totalUsers} người dùng...`);
  const startTime = Date.now();
  
  const batches = Math.ceil(config.totalUsers / config.concurrentUsers);
  
  for (let i = 1; i <= batches; i++) {
    const batchSize = i === batches 
      ? config.totalUsers - (i - 1) * config.concurrentUsers 
      : config.concurrentUsers;
      
    await runBatch(batchSize, i);
  }
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  // Phân tích kết quả
  const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  const minResponseTime = Math.min(...responseTimes);
  const maxResponseTime = Math.max(...responseTimes);
  
  console.log('\n--- KẾT QUẢ LOAD TEST ---');
  console.log(`Tổng số users: ${config.totalUsers}`);
  console.log(`Thành công: ${successCount}`);
  console.log(`Lỗi: ${errorCount}`);
  console.log(`Tổng thời gian: ${totalTime}ms`);
  console.log(`Thời gian phản hồi trung bình: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`Thời gian phản hồi nhanh nhất: ${minResponseTime}ms`);
  console.log(`Thời gian phản hồi chậm nhất: ${maxResponseTime}ms`);
  console.log(`RPS (Requests Per Second): ${(successCount / (totalTime / 1000)).toFixed(2)}`);
}

// Chạy load test
runLoadTest().catch(console.error); 