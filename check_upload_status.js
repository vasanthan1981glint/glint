// Check the upload status directly
const fetch = require('node-fetch');

async function checkUploadStatus() {
  console.log('🔍 CHECKING UPLOAD STATUS DIRECTLY');
  console.log('==================================');
  
  // The original Upload IDs from your logs
  const uploadIds = [
    'H00rUEZPwkFVPE8YrrTF02Uc02rVHzD5cgZnINyyi6t01400',
    'i5W00Mt00xSWd102G1oarUdLeEnzXhHe1o7LanMti9pa3A'
  ];
  
  for (const uploadId of uploadIds) {
    console.log(`\n🎯 Checking Upload: ${uploadId.substring(0, 20)}...`);
    
    try {
      const response = await fetch(`https://glint-production-b62b.up.railway.app/api/mux/upload/${uploadId}`);
      const data = await response.json();
      
      console.log(`📡 Response status: ${response.status}`);
      
      if (data.success && data.upload) {
        const upload = data.upload;
        console.log(`📊 Upload Status: ${upload.status}`);
        console.log(`🎬 Asset ID: ${upload.asset_id || 'Not yet available'}`);
        console.log(`📅 Created: ${upload.created_at}`);
        console.log(`📋 CORS Origin: ${upload.cors_origin || 'None'}`);
        
        if (upload.error) {
          console.log(`❌ Upload Error:`, upload.error);
        }
        
        if (upload.status === 'asset_created' && upload.asset_id) {
          console.log(`✅ Upload completed successfully!`);
          console.log(`🔍 Asset ID: ${upload.asset_id}`);
          
          // Try to get the Playback ID for this valid asset
          try {
            const assetResponse = await fetch(`https://glint-production-b62b.up.railway.app/api/mux/asset/${upload.asset_id}`);
            const assetData = await assetResponse.json();
            
            if (assetData.success && assetData.asset) {
              const playbackIds = assetData.asset.playback_ids;
              if (playbackIds && playbackIds.length > 0) {
                const playbackId = playbackIds[0].id;
                console.log(`🎊 FOUND WORKING PLAYBACK ID: ${playbackId}`);
                console.log(`🌐 Stream URL: https://stream.mux.com/${playbackId}.m3u8`);
              }
            }
          } catch (e) {
            console.log(`❌ Could not get asset details: ${e.message}`);
          }
        } else {
          console.log(`⏳ Upload not complete yet. Status: ${upload.status}`);
        }
      } else {
        console.log(`❌ Error getting upload:`, data);
      }
      
    } catch (error) {
      console.error(`❌ Request failed:`, error.message);
    }
  }
}

checkUploadStatus().catch(console.error);
