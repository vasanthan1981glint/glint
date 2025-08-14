// Test Railway backend endpoints to understand the API structure

const testBackendEndpoints = async () => {
  const API_URL = 'https://glint-production-b62b.up.railway.app';
  
  console.log('🔍 Testing Railway backend endpoints...');
  
  const testEndpoints = [
    '/',
    '/api',
    '/api/health',
    '/api/videos',
    '/api/upload',
    '/api/mux',
    '/api/assets',
    '/health',
    '/status'
  ];
  
  for (const endpoint of testEndpoints) {
    try {
      console.log(`\n📋 Testing: ${API_URL}${endpoint}`);
      const response = await fetch(`${API_URL}${endpoint}`);
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        console.log(`   Content-Type: ${contentType}`);
        
        if (contentType && contentType.includes('application/json')) {
          try {
            const data = await response.json();
            console.log(`   Response:`, JSON.stringify(data, null, 2));
          } catch (e) {
            console.log(`   JSON Parse Error: ${e.message}`);
          }
        } else {
          const text = await response.text();
          console.log(`   Response: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  // Also test some common REST patterns
  console.log('\n🔍 Testing common patterns...');
  const patterns = [
    '/videos',
    '/upload/status',
    '/mux/assets',
    '/mux/playback'
  ];
  
  for (const pattern of patterns) {
    try {
      console.log(`\n📋 Testing: ${API_URL}${pattern}`);
      const response = await fetch(`${API_URL}${pattern}`);
      console.log(`   Status: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
};

testBackendEndpoints();
