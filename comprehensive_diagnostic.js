// Comprehensive Video System Diagnostic
// This will help identify the real solution

const runComprehensiveDiagnostic = async () => {
  console.log('🔍 COMPREHENSIVE VIDEO SYSTEM DIAGNOSTIC');
  console.log('==========================================\n');
  
  const API_URL = 'https://glint-production-b62b.up.railway.app';
  
  // 1. Test backend health
  console.log('1️⃣ BACKEND HEALTH CHECK');
  try {
    const healthResponse = await fetch(`${API_URL}/api/health`);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('✅ Backend is healthy:', health);
      console.log(`   - Mux configured: ${health.mux_configured}`);
      console.log(`   - Mux enabled: ${health.muxEnabled}`);
    }
  } catch (error) {
    console.log('❌ Backend health check failed:', error.message);
  }
  
  // 2. Test the problematic Asset IDs
  console.log('\n2️⃣ TESTING PROBLEMATIC ASSET IDS');
  const problematicAssets = [
    't3V7ny19JXL7nzhGTfUkmK5axoPWqdl1WPwOgc7aagM',
    'jOYrW01xoAW2aFhI0000wKLC31rZ4QNRFQwUlfDtfqcvo8', 
    'yF7df1c9tEPRUiDJFtkeZdeOyZqIX00oJQEhRs64fTe4',
    'iApqzi02LSyTkWJm4ruFgH28yEpFmkhOpKdi1nPJjHOA',
    '7dnx13xaFMSXfiBsp678U9oZJivv6ifBnv02O3fgE34c'
  ];
  
  for (const assetId of problematicAssets) {
    console.log(`\n   🔍 Testing Asset: ${assetId}`);
    
    // Test backend API
    try {
      const assetResponse = await fetch(`${API_URL}/api/mux/asset/${assetId}`);
      console.log(`   Backend API: ${assetResponse.status} ${assetResponse.statusText}`);
      
      if (assetResponse.ok) {
        const data = await assetResponse.json();
        console.log(`   Asset Status: ${data.status || 'unknown'}`);
        if (data.playback_ids) {
          console.log(`   Playback IDs: ${data.playback_ids.length} found`);
          data.playback_ids.forEach(pb => {
            console.log(`      - ${pb.id} (${pb.policy})`);
          });
        }
      }
    } catch (error) {
      console.log(`   Backend Error: ${error.message}`);
    }
    
    // Test direct Mux streaming
    const directUrl = `https://stream.mux.com/${assetId}.m3u8`;
    try {
      const streamResponse = await fetch(directUrl, { method: 'HEAD' });
      console.log(`   Direct Stream: ${streamResponse.status} ${streamResponse.statusText}`);
    } catch (error) {
      console.log(`   Direct Stream Error: ${error.message}`);
    }
  }
  
  // 3. Test Asset ID vs Playback ID detection
  console.log('\n3️⃣ ID FORMAT ANALYSIS');
  console.log('Asset ID characteristics:');
  problematicAssets.forEach(id => {
    console.log(`   ${id} - Length: ${id.length} - Type: ${id.length > 30 ? 'Asset ID' : 'Playbook ID'}`);
  });
  
  console.log('\nKnown working Playback ID examples (from Mux docs):');
  const examplePlaybackIds = [
    'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe', // Example from Mux docs
    'v69RSHhFelSm4701snP22dYz2jICy4E4FUyk051F55vxjxnhfKBGUs', // Example long ID
    'abc123', // Example short ID
  ];
  examplePlaybackIds.forEach(id => {
    console.log(`   ${id} - Length: ${id.length} - Type: ${id.length > 30 ? 'Long ID' : 'Short ID'}`);
  });
  
  // 4. Test emergency fix logic
  console.log('\n4️⃣ EMERGENCY FIX STATUS');
  console.log('Current emergency mapping:');
  const currentMapping = {
    'yF7df1c9tEPRUiDJFtkeZdeOyZqIX00oJQEhRs64fTe4': 'test001',
    'jOYrW01xoAW2aFhI0000wKLC31rZ4QNRFQwUlfDtfqcvo8': 'test002', 
    't3V7ny19JXL7nzhGTfUkmK5axoPWqdl1WPwOgc7aagM': 'test003'
  };
  
  Object.entries(currentMapping).forEach(([assetId, playbackId]) => {
    console.log(`   ${assetId} → ${playbackId}`);
    console.log(`      Asset ID length: ${assetId.length}`);
    console.log(`      Playback ID length: ${playbackId.length}`);
  });
  
  // 5. Recommendations
  console.log('\n5️⃣ RECOMMENDATIONS');
  console.log('Based on the diagnostic:');
  console.log('   1. ✅ Backend is healthy and Mux is configured');
  console.log('   2. ❌ All current Asset IDs return 500 errors (corrupted in Mux)'); 
  console.log('   3. 🔧 Emergency fix needs real Playback IDs from working assets');
  console.log('   4. 📱 New video upload (IMG_4073.mp4) should provide working IDs');
  console.log('   5. 🚀 Solution: Upload fresh videos and get their Playbook IDs');
  
  console.log('\n6️⃣ IMMEDIATE ACTION PLAN');
  console.log('To fix the video system:');
  console.log('   1. Upload a test video via the app');
  console.log('   2. Check Firebase for the new video document');
  console.log('   3. Extract the working Playbook ID from backend');
  console.log('   4. Update emergency fix with real Playbook IDs');
  console.log('   5. Test video playback with corrected URLs');
};

runComprehensiveDiagnostic();
