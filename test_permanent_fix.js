// Test Permanent Asset ID to Playback ID Fix
// This script tests the new automatic conversion system

const { convertAssetUrlToPlaybackUrl, isAssetIdUrl, getPlaybackIdForAsset } = require('./lib/playbackIdConverter');

// Test cases from your app logs
const testAssetIds = [
  'H00rUEZPwkFVPE8YrrTF02Uc02rVHzD5cgZnINyyi6t01400',
  'i5W00Mt00xSWd102G1oarUdLeEnzXhHe1o7LanMti9pa3A',
];

const testUrls = [
  'https://stream.mux.com/H00rUEZPwkFVPE8YrrTF02Uc02rVHzD5cgZnINyyi6t01400.m3u8',
  'https://stream.mux.com/i5W00Mt00xSWd102G1oarUdLeEnzXhHe1o7LanMti9pa3A.m3u8',
];

async function testPermanentFix() {
  console.log('🚀 Testing Permanent Asset ID to Playback ID Fix');
  console.log('=' .repeat(60));
  
  // Test 1: Asset ID Detection
  console.log('\n📋 Test 1: Asset ID Detection');
  console.log('-'.repeat(30));
  
  for (const url of testUrls) {
    const isAssetId = isAssetIdUrl(url);
    console.log(`URL: ${url.substring(0, 80)}...`);
    console.log(`Is Asset ID URL: ${isAssetId ? '✅ YES' : '❌ NO'}`);
    console.log('');
  }
  
  // Test 2: Individual Asset ID → Playback ID Conversion
  console.log('\n📋 Test 2: Asset ID → Playback ID Conversion');
  console.log('-'.repeat(40));
  
  for (const assetId of testAssetIds) {
    console.log(`\n🎯 Testing Asset ID: ${assetId.substring(0, 20)}...`);
    
    try {
      const playbackId = await getPlaybackIdForAsset(assetId);
      
      if (playbackId) {
        console.log(`✅ SUCCESS: ${assetId.substring(0, 20)}... → ${playbackId}`);
        console.log(`📱 Fixed URL: https://stream.mux.com/${playbackId}.m3u8`);
      } else {
        console.log(`❌ FAILED: No Playback ID found for ${assetId.substring(0, 20)}...`);
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}`);
    }
  }
  
  // Test 3: Full URL Conversion
  console.log('\n📋 Test 3: Full URL Conversion');
  console.log('-'.repeat(30));
  
  for (const url of testUrls) {
    console.log(`\n🔧 Converting: ${url.substring(0, 80)}...`);
    
    try {
      const convertedUrl = await convertAssetUrlToPlaybackUrl(url);
      
      if (convertedUrl !== url) {
        console.log('✅ CONVERSION SUCCESSFUL!');
        console.log(`Original:  ${url}`);
        console.log(`Converted: ${convertedUrl}`);
      } else {
        console.log('❌ NO CONVERSION (Asset may be in errored state)');
      }
    } catch (error) {
      console.log(`❌ CONVERSION ERROR: ${error.message}`);
    }
  }
  
  // Test 4: Backend Health Check
  console.log('\n📋 Test 4: Backend Health Check');
  console.log('-'.repeat(30));
  
  try {
    const response = await fetch('https://glint-production-b62b.up.railway.app/health');
    const health = await response.json();
    
    console.log('Backend Status:', health.status);
    console.log('Mux Enabled:', health.muxEnabled);
    console.log('Timestamp:', health.timestamp);
  } catch (error) {
    console.log('❌ Backend health check failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 PERMANENT FIX TEST COMPLETE');
  console.log('\n💡 If conversions are successful, the fix is working!');
  console.log('🔄 Restart your React Native app to see the changes.');
  console.log('='.repeat(60));
}

testPermanentFix().catch(console.error);
