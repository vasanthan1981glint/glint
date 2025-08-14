// Fix Existing Assets with Correct Playback IDs
// This script retrieves the correct playback IDs from Mux and updates Firebase

const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.159:3000';

const problemAssets = [
  '7dnx13xaFMSXfiBsp678U9oZJivv6ifBnv02O3fgE34c',
  'jOYrW01xoAW2aFhI0000wKLC31rZ4QNRFQwUlfDtfqcvo8',
  'yF7df1c9tEPRUiDJFtkeZdeOyZqIX00oJQEhRs64fTe4',
  'iApqzi02LSyTkWJm4ruFgH28yEpFmkhOpKdi1nPJjHOA'
];

async function getCorrectPlaybackId(assetId) {
  console.log(`🔍 Checking asset: ${assetId}`);
  
  try {
    const response = await fetch(`${apiUrl}/api/mux/asset/${assetId}`, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      console.log(`❌ API Error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`📊 API Response:`, JSON.stringify(data, null, 2));
    
    if (data.success && data.asset) {
      const asset = data.asset;
      
      if (asset.playback_ids && asset.playback_ids.length > 0) {
        const publicPlaybackId = asset.playback_ids.find(pb => pb.policy === 'public');
        if (publicPlaybackId) {
          console.log(`✅ Found public playback ID: ${publicPlaybackId.id}`);
          return publicPlaybackId.id;
        } else {
          console.log(`⚠️ Using first playback ID: ${asset.playback_ids[0].id}`);
          return asset.playback_ids[0].id;
        }
      } else {
        console.log(`❌ No playback IDs found in asset`);
        return null;
      }
    } else {
      console.log(`❌ Invalid API response structure`);
      return null;
    }
    
  } catch (error) {
    console.log(`❌ Error fetching asset: ${error.message}`);
    return null;
  }
}

async function testCorrectUrls() {
  console.log('🚀 Checking all problematic assets for correct playback IDs...');
  console.log('');
  
  for (const assetId of problemAssets) {
    const playbackId = await getCorrectPlaybackId(assetId);
    
    if (playbackId) {
      const hlsUrl = `https://stream.mux.com/${playbackId}.m3u8`;
      const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
      
      console.log(`🎯 Testing corrected URLs for ${assetId}:`);
      console.log(`   HLS: ${hlsUrl}`);
      console.log(`   Thumbnail: ${thumbnailUrl}`);
      
      // Test the URL
      try {
        const testResponse = await fetch(hlsUrl, { method: 'HEAD' });
        console.log(`   Status: ${testResponse.status} ${testResponse.statusText}`);
        
        if (testResponse.ok) {
          console.log(`   ✅ WORKING! This is the correct playback ID`);
        } else {
          console.log(`   ❌ Still not working`);
        }
      } catch (error) {
        console.log(`   ❌ Test failed: ${error.message}`);
      }
    }
    
    console.log('');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testCorrectUrls().catch(console.error);
