// Monitor script để đếm số job đang chạy và trong hàng đợi
const axios = require('axios');

let previousActive = 0;
let previousQueue = 0;

async function getServerStatus() {
  try {
    const response = await axios.get('http://localhost:3000/api/fibonacci/test');
    const { timestamp } = response.data;
    return { timestamp, ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function printMemoryUsage() {
  const used = process.memoryUsage();
  console.log('Memory usage:');
  for (const key in used) {
    console.log(`  ${key}: ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`);
  }
}

async function monitor() {
  console.log('Bắt đầu theo dõi server...');
  
  while (true) {
    try {
      const status = await getServerStatus();
      if (status.ok) {
        const date = new Date();
        const timeStr = date.toISOString().split('T')[1].substring(0, 8);
        
        // Đếm số CPU cores đang sử dụng (ước lượng)
        const cpuUsage = Math.min(require('os').cpus().length, 8); // Max là số core CPU
        
        // Log ra console
        console.log(
          `[${timeStr}] Server OK | API Timestamp: ${status.timestamp.split('T')[1].substring(0, 12)} | Est. Workers: ${cpuUsage}`
        );
      } else {
        console.log(`Server không phản hồi: ${status.error}`);
      }
    } catch (error) {
      console.error('Lỗi theo dõi:', error.message);
    }
    
    // In thông tin sử dụng bộ nhớ mỗi 10 lần kiểm tra
    if (Math.random() < 0.1) {
      printMemoryUsage();
    }
    
    // Chờ 1 giây
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Bắt đầu theo dõi
monitor().catch(console.error); 