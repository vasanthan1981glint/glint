// Test backend connectivity from app environment
const testBackendConnection = async () => {
  console.log('🧪 Testing backend connection...');
  
  try {
    const response = await fetch('http://localhost:3000/api/health');
    const data = await response.json();
    console.log('✅ Backend health check:', data);
    return true;
  } catch (error) {
    console.error('❌ Backend connection failed:', error);
    
    // Try different localhost variations
    const alternatives = [
      'http://127.0.0.1:3000/api/health',
      'http://0.0.0.0:3000/api/health',
    ];
    
    for (const url of alternatives) {
      try {
        console.log(`🔄 Trying alternative URL: ${url}`);
        const response = await fetch(url);
        const data = await response.json();
        console.log(`✅ Alternative URL works: ${url}`, data);
        return url.replace('/api/health', '/api');
      } catch (altError) {
        console.log(`❌ Alternative URL failed: ${url}`);
      }
    }
    
    return false;
  }
};

// Run the test
testBackendConnection();
