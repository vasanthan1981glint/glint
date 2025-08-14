// Test new video upload and get real Playback IDs
// This will help us understand the correct ID format

const checkVideoUploadFlow = async () => {
  const API_URL = 'https://glint-production-b62b.up.railway.app';
  
  console.log('🔍 Testing video upload flow to get real Playback IDs...');
  
  try {
    // 1. Check if there are any new videos uploaded recently
    console.log('📋 Step 1: Checking recent video uploads...');
    
    // 2. Get video details from your backend
    const response = await fetch(`${API_URL}/api/videos/recent`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Recent videos response:', JSON.stringify(data, null, 2));
      
      // Look for the new video we saw in logs (IMG_4073.mp4)
      if (data.videos) {
        data.videos.forEach(video => {
          console.log(`📹 Video: ${video.id || video.assetId}`);
          console.log(`   - Filename: ${video.filename || 'unknown'}`);
          console.log(`   - Playback URL: ${video.playbackUrl || video.url || 'unknown'}`);
          console.log(`   - Duration: ${video.duration || 'unknown'}`);
          console.log(`   - Status: ${video.status || 'unknown'}`);
          
          // Extract ID from URL to see the format
          if (video.playbackUrl || video.url) {
            const url = video.playbackUrl || video.url;
            const match = url.match(/stream\.mux\.com\/([^\.]+)/);
            if (match) {
              const id = match[1];
              console.log(`   - Extracted ID: ${id} (length: ${id.length})`);
              console.log(`   - ID Type: ${id.length > 30 ? 'Likely Asset ID' : 'Likely Playback ID'}`);
            }
          }
          console.log('');
        });
      }
    } else {
      console.log(`❌ Failed to fetch recent videos: ${response.status} ${response.statusText}`);
    }
    
    // 3. Test specific asset lookup if we know IDs
    console.log('📋 Step 2: Testing specific video assets...');
    
    const testAssets = [
      't3V7ny19JXL7nzhGTfUkmK5axoPWqdl1WPwOgc7aagM',
      'jOYrW01xoAW2aFhI0000wKLC31rZ4QNRFQwUlfDtfqcvo8',
      'yF7df1c9tEPRUiDJFtkeZdeOyZqIX00oJQEhRs64fTe4'
    ];
    
    for (const assetId of testAssets) {
      try {
        const assetResponse = await fetch(`${API_URL}/api/videos/${assetId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (assetResponse.ok) {
          const assetData = await assetResponse.json();
          console.log(`✅ Asset ${assetId}:`, JSON.stringify(assetData, null, 2));
        } else {
          console.log(`❌ Asset ${assetId}: ${assetResponse.status} ${assetResponse.statusText}`);
        }
      } catch (error) {
        console.log(`❌ Asset ${assetId}: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing video upload flow:', error);
  }
};

checkVideoUploadFlow();
