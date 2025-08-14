// Test Emergency Video Fix
// This script tests that the emergency fix is working properly

import { ASSET_TO_PLAYBACK_MAP, fixVideoUrl, testDemoVideos } from './lib/emergencyVideoFix';

async function testEmergencyFixFunctionality() {
  console.log('🧪 Testing Emergency Video Fix Functionality...');
  
  // Test 1: Test direct URL fixing
  console.log('\n📹 Test 1: Direct URL fixing...');
  const testUrls = [
    'https://stream.mux.com/OyW2BJCnZCfkk8v54GAQLG7dSviw5GGdqiSiO9I7hJs.m3u8',
    'https://stream.mux.com/yF7df1c9tEPRUiDJFtkeZdeOyZqIX00oJQEhRs64fTe4.m3u8',
    'https://stream.mux.com/w7rVemuEUYFjnHe501q1YM8poMLrJhbGrI01uXkxh7WeI.m3u8',
    'https://assets/brUgO02kARoyfrdVhvd02QA00GDp00j0196B2zVyOwibiqhg',
    'https://stream.mux.com/t3V7ny19JXL7nzhGTfUkmK5axoPWqdl1WPwOgc7aagM.m3u8'
  ];
  
  for (const testUrl of testUrls) {
    try {
      const fixedUrl = fixVideoUrl(testUrl);
      const wasFixed = fixedUrl !== testUrl;
      console.log(`${wasFixed ? '✅' : '➡️'} ${testUrl} -> ${fixedUrl}`);
    } catch (error) {
      console.log(`❌ Error testing ${testUrl}:`, error.message);
    }
  }
  
  // Test 2: Test mapping completeness
  console.log('\n🗺️ Test 2: Mapping completeness...');
  console.log(`Total mappings: ${Object.keys(ASSET_TO_PLAYBACK_MAP).length}`);
  for (const [assetId, playbackId] of Object.entries(ASSET_TO_PLAYBACK_MAP)) {
    console.log(`  ${assetId.substring(0, 20)}... -> ${playbackId}`);
  }
  
  // Test 3: Test demo videos accessibility
  console.log('\n🌐 Test 3: Demo videos accessibility...');
  try {
    const demoVideosWork = await testDemoVideos();
    console.log(`Demo videos accessible: ${demoVideosWork ? '✅' : '❌'}`);
  } catch (error) {
    console.log('❌ Demo video test failed:', error.message);
  }
  
  // Test 4: Test with real problematic video URLs
  console.log('\n🎯 Test 4: Real problematic video scenarios...');
  const problematicScenarios = [
    {
      name: 'Asset ID used as Playback ID',
      url: 'https://stream.mux.com/OyW2BJCnZCfkk8v54GAQLG7dSviw5GGdqiSiO9I7hJs.m3u8'
    },
    {
      name: 'Upload ID used as Asset ID',
      url: 'https://stream.mux.com/yF7df1c9tEPRUiDJFtkeZdeOyZqIX00oJQEhRs64fTe4.m3u8'
    },
    {
      name: 'Errored Asset in different URL format',
      url: 'https://assets/w7rVemuEUYFjnHe501q1YM8poMLrJhbGrI01uXkxh7WeI'
    }
  ];
  
  for (const scenario of problematicScenarios) {
    const fixedUrl = fixVideoUrl(scenario.url);
    const wasFixed = fixedUrl !== scenario.url;
    console.log(`${wasFixed ? '✅' : '❌'} ${scenario.name}: ${wasFixed ? 'FIXED' : 'NOT FIXED'}`);
    if (wasFixed) {
      console.log(`  -> ${fixedUrl}`);
    }
  }
  
  console.log('\n🎉 Emergency Fix Test Complete!');
  return true;
}

// Run the test
testEmergencyFixFunctionality().catch(console.error);
