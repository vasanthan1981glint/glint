// Test Upload ID to Playback ID Conversion
// This tests the complete conversion chain: Upload ID → Asset ID → Playback ID

const { 
  convertUploadIdToPlaybackId, 
  convertVideoUrl, 
  detectIdType,
  getCacheStats 
} = require('./lib/uploadIdConverter');

// Test cases from your app logs - these are Upload IDs not Asset IDs!
const testUploadIds = [
  'H00rUEZPwkFVPE8YrrTF02Uc02rVHzD5cgZnINyyi6t01400',
  'i5W00Mt00xSWd102G1oarUdLeEnzXhHe1o7LanMti9pa3A',
];

const testUrls = [
  'https://stream.mux.com/H00rUEZPwkFVPE8YrrTF02Uc02rVHzD5cgZnINyyi6t01400.m3u8',
  'https://stream.mux.com/i5W00Mt00xSWd102G1oarUdLeEnzXhHe1o7LanMti9pa3A.m3u8',
];

async function testUploadIdConversion() {
  console.log('🚀 Testing Upload ID → Playback ID Conversion');
  console.log('=' .repeat(60));
  
  // Test 1: ID Type Detection
  console.log('\n📋 Test 1: ID Type Detection');
  console.log('-'.repeat(30));
  
  for (const id of testUploadIds) {
    const type = detectIdType(id);
    console.log(`ID: ${id.substring(0, 25)}... (${id.length} chars)`);
    console.log(`Detected Type: ${type.toUpperCase()}`);
    console.log('');
  }
  
  // Test 2: Upload ID → Playback ID Direct Conversion
  console.log('\n📋 Test 2: Upload ID → Playback ID Conversion');
  console.log('-'.repeat(45));
  
  for (const uploadId of testUploadIds) {
    console.log(`\n🎯 Converting Upload ID: ${uploadId.substring(0, 25)}...`);
    
    try {
      const playbackId = await convertUploadIdToPlaybackId(uploadId);
      
      if (playbackId) {
        console.log(`✅ SUCCESS!`);
        console.log(`   Upload ID: ${uploadId.substring(0, 25)}...`);
        console.log(`   Playback ID: ${playbackId}`);
        console.log(`   Stream URL: https://stream.mux.com/${playbackId}.m3u8`);
      } else {
        console.log(`❌ FAILED: Could not convert Upload ID`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
  }
  
  // Test 3: Full URL Conversion
  console.log('\n📋 Test 3: Full URL Conversion');
  console.log('-'.repeat(30));
  
  for (const url of testUrls) {
    console.log(`\n🔧 Converting URL: ${url.substring(0, 80)}...`);
    
    try {
      const convertedUrl = await convertVideoUrl(url);
      
      if (convertedUrl !== url) {
        console.log('✅ CONVERSION SUCCESSFUL!');
        console.log(`Original:  ${url}`);
        console.log(`Converted: ${convertedUrl}`);
        console.log('🎉 This URL should work in your React Native app!');
      } else {
        console.log('❌ NO CONVERSION APPLIED');
      }
    } catch (error) {
      console.log(`❌ CONVERSION ERROR: ${error.message}`);
    }
  }
  
  // Test 4: Cache Statistics
  console.log('\n📋 Test 4: Cache Performance');
  console.log('-'.repeat(25));
  
  const stats = getCacheStats();
  console.log('Cache Statistics:');
  console.log(`  Upload→Asset mappings: ${stats.uploadToAsset}`);
  console.log(`  Asset→Playback mappings: ${stats.assetToPlayback}`);
  console.log(`  Direct Upload→Playback: ${stats.uploadToPlayback}`);
  console.log(`  Total cached entries: ${stats.total}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 UPLOAD ID CONVERSION TEST COMPLETE');
  
  if (stats.total > 0) {
    console.log('\n🎉 SUCCESS! The conversion system is working!');
    console.log('✅ Upload IDs have been successfully converted to Playback IDs');
    console.log('🔄 Update your React Native app to use this conversion system');
    console.log('📱 Videos should now play without NSURLErrorDomain -1008 errors');
  } else {
    console.log('\n⚠️  No conversions were cached - check for API issues');
  }
  
  console.log('='.repeat(60));
}

testUploadIdConversion().catch(console.error);
