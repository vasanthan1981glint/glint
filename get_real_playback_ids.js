// Get Playback IDs for the real Asset IDs
const fetch = require('node-fetch');

async function getPlaybackIds() {
  console.log('🎬 GETTING PLAYBACK IDs FOR VALID ASSET IDs');
  console.log('==========================================');
  
  // The real Asset IDs from the upload status check
  const assetIds = [
    'hrQF00IrUZ8fMdtBlobTiNXfnlEvtg802101rgxzr1aC3Y', // From H00rUEZPwkFVPE8YrrTF02Uc02rVHzD5cgZnINyyi6t01400
    '00fLFk2YX2Ro3vbIMxfDnNni92Ww872f7toMFSs9mdoU'   // From i5W00Mt00xSWd102G1oarUdLeEnzXhHe1o7LanMti9pa3A
  ];
  
  for (const assetId of assetIds) {
    console.log(`\n🎯 Getting Playback ID for Asset: ${assetId}`);
    
    try {
      const response = await fetch(`https://glint-production-b62b.up.railway.app/api/mux/asset/${assetId}`);
      
      if (!response.ok) {
        console.log(`❌ Asset API failed: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log(`📋 Error response: ${errorText.substring(0, 200)}...`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.success && data.asset) {
        const asset = data.asset;
        console.log(`📊 Asset Status: ${asset.status}`);
        
        if (asset.playback_ids && asset.playback_ids.length > 0) {
          const playbackId = asset.playback_ids[0].id;
          console.log(`🎊 SUCCESS! Playback ID: ${playbackId}`);
          console.log(`🌐 Stream URL: https://stream.mux.com/${playbackId}.m3u8`);
          
          // This is what your users should be streaming!
        } else {
          console.log(`❌ No Playback IDs found for this asset`);
        }
      } else {
        console.log(`❌ Invalid response:`, data);
      }
      
    } catch (error) {
      console.error(`❌ Request failed:`, error.message);
    }
  }
  
  console.log('\n💡 SOLUTION: Your converter should return these Playback ID URLs!');
}

getPlaybackIds().catch(console.error);
