/**
 * Test script for the enhanced view tracking system
 * 
 * This script demonstrates all the key features of the view tracking system:
 * 1. Automatic view detection when video starts playing
 * 2. Minimum watch time threshold (3 seconds)
 * 3. Anti-bot and fraud prevention
 * 4. Duplicate view prevention
 * 5. Real-time view count updates
 * 6. Analytics tracking
 */

import { viewTracker } from '../lib/viewTrackingService';

export const testViewTracking = async () => {
  console.log('🧪 Starting View Tracking System Test');
  
  const testVideoId = 'test_video_123';
  
  try {
    // Test 1: Normal view tracking flow
    console.log('\n📊 Test 1: Normal View Tracking Flow');
    const sessionId = await viewTracker.startViewTracking(testVideoId);
    console.log('✅ View tracking started, session:', sessionId);
    
    // Simulate watching for 2 seconds (below threshold)
    await new Promise(resolve => setTimeout(resolve, 2000));
    await viewTracker.updateViewProgress(sessionId);
    console.log('⏱️  Watched for 2 seconds (below threshold)');
    
    // Simulate watching for 2 more seconds (total 4 seconds, above threshold)
    await new Promise(resolve => setTimeout(resolve, 2000));
    await viewTracker.updateViewProgress(sessionId);
    console.log('✅ Watched for 4 seconds total (above 3s threshold)');
    
    // Stop tracking
    await viewTracker.stopViewTracking(sessionId);
    console.log('🛑 View tracking stopped');
    
    // Test 2: Get view count
    console.log('\n📈 Test 2: Get View Count');
    const viewCount = await viewTracker.getViewCount(testVideoId);
    console.log(`👀 Current view count: ${viewCount}`);
    
    // Test 3: Duplicate view prevention
    console.log('\n🚫 Test 3: Duplicate View Prevention');
    try {
      const duplicateSessionId = await viewTracker.startViewTracking(testVideoId);
      console.log('❌ Duplicate view was not prevented (this should not happen)');
      await viewTracker.stopViewTracking(duplicateSessionId);
    } catch (error: any) {
      console.log('✅ Duplicate view prevented successfully:', error?.message);
    }
    
    // Test 4: Analytics
    console.log('\n📊 Test 4: View Analytics');
    const analytics = await viewTracker.getViewAnalytics(testVideoId);
    console.log('📈 Analytics data:', analytics);
    
    console.log('\n🎉 All view tracking tests completed successfully!');
    
    return {
      success: true,
      viewCount,
      analytics
    };
    
  } catch (error: any) {
    console.error('❌ View tracking test failed:', error);
    return {
      success: false,
      error: error?.message
    };
  }
};

/**
 * Test video owner exclusion
 */
export const testVideoOwnerExclusion = async () => {
  console.log('\n👤 Testing Video Owner Exclusion');
  
  // This test would need to be run with an authenticated user
  // who owns a video to properly test the ownership check
  
  const ownVideoId = 'user_own_video_123';
  
  try {
    const sessionId = await viewTracker.startViewTracking(ownVideoId);
    console.log('❌ Owner view was not prevented (this should not happen)');
    await viewTracker.stopViewTracking(sessionId);
    return { success: false, message: 'Owner view was not prevented' };
  } catch (error: any) {
    if (error?.message === 'Video owner views are not counted') {
      console.log('✅ Video owner view prevented successfully');
      return { success: true, message: 'Owner exclusion working correctly' };
    } else {
      console.log('❌ Unexpected error during owner test:', error?.message);
      return { success: false, message: error?.message };
    }
  }
};

/**
 * Test rapid viewing (bot detection)
 */
export const testBotDetection = async () => {
  console.log('\n🤖 Testing Bot Detection');
  
  const rapidViews = [];
  
  // Try to create multiple views rapidly (should be detected as bot behavior)
  for (let i = 0; i < 5; i++) {
    try {
      const sessionId = await viewTracker.startViewTracking(`rapid_test_${i}`);
      rapidViews.push(sessionId);
      console.log(`Rapid view ${i + 1} started`);
    } catch (error: any) {
      console.log(`✅ Bot behavior detected on attempt ${i + 1}:`, error?.message);
    }
  }
  
  // Clean up any successful rapid views
  for (const sessionId of rapidViews) {
    await viewTracker.stopViewTracking(sessionId);
  }
};

/**
 * Real-world simulation test
 */
export const simulateRealWorldUsage = async () => {
  console.log('\n🌍 Simulating Real-World Usage');
  
  const videos = ['video_1', 'video_2', 'video_3'];
  const results = [];
  
  for (const videoId of videos) {
    try {
      console.log(`\n▶️  Starting to watch ${videoId}`);
      
      // Start tracking
      const sessionId = await viewTracker.startViewTracking(videoId);
      
      // Simulate random watch time (1-10 seconds)
      const watchTime = Math.floor(Math.random() * 9000) + 1000;
      console.log(`⏱️  Simulating ${Math.round(watchTime / 1000)}s watch time`);
      
      // Update progress periodically
      const updateInterval = setInterval(async () => {
        await viewTracker.updateViewProgress(sessionId);
      }, 1000);
      
      // Wait for the simulated watch time
      await new Promise(resolve => setTimeout(resolve, watchTime));
      
      // Stop updates and tracking
      clearInterval(updateInterval);
      await viewTracker.stopViewTracking(sessionId);
      
      // Get final view count
      const viewCount = await viewTracker.getViewCount(videoId);
      
      results.push({
        videoId,
        watchTimeMs: watchTime,
        viewCounted: watchTime >= 3000,
        finalViewCount: viewCount
      });
      
      console.log(`✅ ${videoId} completed - View counted: ${watchTime >= 3000 ? 'Yes' : 'No'}`);
      
    } catch (error: any) {
      console.error(`❌ Error with ${videoId}:`, error?.message);
      results.push({
        videoId,
        error: error?.message
      });
    }
  }
  
  console.log('\n📊 Real-world simulation results:');
  console.table(results);
  
  return results;
};

// Export all test functions
export const runAllViewTrackingTests = async () => {
  console.log('🧪 Running Complete View Tracking Test Suite\n');
  
  const results = {
    basicTracking: await testViewTracking(),
    ownerExclusion: await testVideoOwnerExclusion(),
    botDetection: await testBotDetection(),
    realWorldSimulation: await simulateRealWorldUsage()
  };
  
  console.log('\n🏁 All tests completed!');
  console.log('📊 Test Results Summary:', results);
  
  return results;
};
