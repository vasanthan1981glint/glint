// Fix the ready video using the backend API
const axios = require('axios');

const BACKEND_URL = 'http://localhost:3000';

async function fixVideoViaAPI() {
  console.log('🔧 FIXING VIDEO VIA BACKEND API');
  console.log('===============================');
  
  try {
    const uploadId = 'p9o54m91lTrxo4uPBangzt7vLrxTqvXSgTbydWKFt5g';
    const assetId = 'pBFWYlup01QYJjGIDTrucYbwQrgc3BILPYpoau5aix3E';
    const playbackId = 'C5PVakKHdB00cX01pjiiEsLhyCctgKxxDtaCC7gQfe2ys';
    const playbackUrl = `https://stream.mux.com/${playbackId}.m3u8`;
    
    console.log(`📹 Upload ID: ${uploadId}`);
    console.log(`🎬 Asset ID: ${assetId}`);
    console.log(`🎯 Playback ID: ${playbackId}`);
    
    const response = await axios.patch(`${BACKEND_URL}/api/videos/${uploadId}/fix-asset`, {
      correctAssetId: assetId,
      playbackId: playbackId,
      playbackUrl: playbackUrl
    });
    
    if (response.data.success) {
      console.log('✅ Video fixed successfully via backend API!');
      console.log(`🔗 Playback URL: ${playbackUrl}`);
    } else {
      console.error('❌ Backend returned error:', response.data);
    }
    
  } catch (error) {
    console.error('❌ Error calling backend API:', error.response?.data || error.message);
  }
}

fixVideoViaAPI();
