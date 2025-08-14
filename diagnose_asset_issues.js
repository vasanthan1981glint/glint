// Quick diagnostic to check what's happening with those Asset IDs
const fetch = require('node-fetch');

async function diagnoseAssetIds() {
  console.log('🔍 DIAGNOSING ASSET ID ISSUES');
  console.log('=============================');
  
  // The Asset IDs we got from the Upload ID conversion
  const assetIds = [
    'hrQF00IrUZ8fMdtBlobT02Ul5v8rBGfP7TqE1DzojZhps', // From H00rUEZPwkFVPE8YrrTF02Uc02rVHzD5cgZnINyyi6t01400
    '00fLFk2YX2Ro3vbIMxfDLtqHNpIqMZ4n4qmOIzz3bCo'   // From i5W00Mt00xSWd102G1oarUdLeEnzXhHe1o7LanMti9pa3A
  ];
  
  for (const assetId of assetIds) {
    console.log(`\n🎯 Checking Asset ID: ${assetId.substring(0, 20)}...`);
    
    try {
      const response = await fetch(`https://glint-production-b62b.up.railway.app/api/mux/asset/${assetId}`);
      const responseText = await response.text();
      
      console.log(`📡 Response status: ${response.status}`);
      console.log(`📋 Response: ${responseText.substring(0, 200)}...`);
      
      if (response.status === 500) {
        console.log('❌ This Asset ID seems to have issues');
        
        // Try to parse any error info
        try {
          const errorData = JSON.parse(responseText);
          console.log('🔍 Error details:', errorData);
        } catch (e) {
          console.log('📄 Raw error response:', responseText);
        }
      }
      
    } catch (error) {
      console.error(`❌ Request failed:`, error.message);
    }
  }
  
  console.log('\n💡 This explains why the conversion is failing at the Asset→Playback step');
  console.log('The Upload IDs are converting to Asset IDs, but those Asset IDs are problematic');
}

diagnoseAssetIds().catch(console.error);
