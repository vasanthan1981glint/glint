// Fix the broken video using Railway backend API
const axios = require('axios');

const RAILWAY_API_URL = 'https://glint-production-b62b.up.railway.app';

async function fixVideoViaRailway() {
  console.log('🚂 FIXING VIDEO VIA RAILWAY BACKEND');
  console.log('===================================');
  
  try {
    // First, check if Railway backend is online
    console.log('🔍 Checking Railway backend status...');
    const healthResponse = await axios.get(`${RAILWAY_API_URL}/health`);
    console.log('✅ Railway backend is online:', healthResponse.data);
    
    // Fix the ready video
    const uploadId = 'p9o54m91lTrxo4uPBangzt7vLrxTqvXSgTbydWKFt5g';
    const assetId = 'pBFWYlup01QYJjGIDTrucYbwQrgc3BILPYpoau5aix3E';
    const playbackId = 'C5PVakKHdB00cX01pjiiEsLhyCctgKxxDtaCC7gQfe2ys';
    
    console.log(`\\n🔧 Fixing video via Railway API:`);
    console.log(`   Upload ID: ${uploadId}`);
    console.log(`   Asset ID: ${assetId}`);
    console.log(`   Playback ID: ${playbackId}`);
    
    const fixResponse = await axios.patch(`${RAILWAY_API_URL}/api/videos/${uploadId}/fix-asset`, {
      correctAssetId: assetId,
      playbackId: playbackId,
      playbackUrl: `https://stream.mux.com/${playbackId}.m3u8`
    });
    
    console.log('✅ Railway fix response:', fixResponse.data);
    
    // Verify the fix worked by checking upload status
    console.log('\\n🔍 Verifying fix...');
    const statusResponse = await axios.get(`${RAILWAY_API_URL}/api/mux/upload/${uploadId}`);
    console.log('📊 Updated upload status:', statusResponse.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\\n💡 Backend connection failed. The Railway backend might be sleeping.');
      console.log('   Try visiting https://glint-production-b62b.up.railway.app/health in your browser first.');
    } else if (error.response?.status === 404) {
      console.log('\\n💡 Endpoint not found. Let me check what endpoints are available...');
    }
  }
}

fixVideoViaRailway();
