// Test the actual Railway endpoints we know exist

const testKnownEndpoints = async () => {
  const API_URL = 'https://glint-production-f754.up.railway.app';
  
  console.log('🔍 Testing known Railway endpoints...');
  
  // Test the Mux asset endpoint
  const testAssets = [
    't3V7ny19JXL7nzhGTfUkmK5axoPWqdl1WPwOgc7aagM',
    'jOYrW01xoAW2aFhI0000wKLC31rZ4QNRFQwUlfDtfqcvo8',
    'yF7df1c9tEPRUiDJFtkeZdeOyZqIX00oJQEhRs64fTe4'
  ];
  
  for (const assetId of testAssets) {
    try {
      console.log(`\n📋 Testing: /api/mux/asset/${assetId}`);
      const response = await fetch(`${API_URL}/api/mux/asset/${assetId}`);
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`   ✅ Response:`, JSON.stringify(data, null, 2));
        
        // Look for playback IDs in the response
        if (data.playback_ids && data.playback_ids.length > 0) {
          console.log(`   🎯 PLAYBACK IDS FOUND:`);
          data.playback_ids.forEach((playback, index) => {
            console.log(`      ${index + 1}. ${playback.id} (policy: ${playback.policy})`);
          });
        }
      } else {
        console.log(`   ❌ Error: ${response.status} ${response.statusText}`);
        if (response.status === 404) {
          console.log(`   💡 This asset may not exist in Mux or is corrupted`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Network Error: ${error.message}`);
    }
  }
  
  // Test some additional endpoints that might exist
  console.log('\n🔍 Testing additional potential endpoints...');
  
  const additionalEndpoints = [
    '/api/mux/assets',
    '/api/mux/list',
    '/api/health',
    '/api/status'
  ];
  
  for (const endpoint of additionalEndpoints) {
    try {
      console.log(`\n📋 Testing: ${endpoint}`);
      const response = await fetch(`${API_URL}${endpoint}`);
      console.log(`   Status: ${response.status} ${response.statusText}`);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          console.log(`   Response:`, JSON.stringify(data, null, 2));
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
};

testKnownEndpoints();
