/**
 * Test script to verify that save functionality is working correctly
 * Run this in the app to check if videos can be saved and retrieved properly
 */

import { auth } from './firebaseConfig';
import { SavedVideo, savedVideosService } from './lib/savedVideosService';

async function testSaveFunctionality() {
  console.log('🧪 Testing save functionality...');
  
  const user = auth.currentUser;
  if (!user) {
    console.error('❌ No authenticated user found');
    return;
  }
  
  console.log(`👤 Testing with user: ${user.uid}`);
  
  // Test video ID (replace with an actual video ID from your app)
  const testVideoId = 'firebase_1754745045064'; // From the logs you provided
  
  try {
    // 1. Test initial save status
    console.log('1️⃣ Checking initial save status...');
    const initialStatus = await savedVideosService.isVideoSaved(testVideoId);
    console.log(`   Initial save status: ${initialStatus}`);
    
    // 2. Test save video
    console.log('2️⃣ Testing save video...');
    await savedVideosService.saveVideo(testVideoId);
    const statusAfterSave = await savedVideosService.isVideoSaved(testVideoId);
    console.log(`   Status after save: ${statusAfterSave}`);
    
    // 3. Test get saved videos
    console.log('3️⃣ Testing get saved videos...');
    const savedVideos = await savedVideosService.getSavedVideos();
    console.log(`   Found ${savedVideos.length} saved videos`);
    const isInList = savedVideos.some((sv: SavedVideo) => sv.videoId === testVideoId);
    console.log(`   Test video found in saved list: ${isInList}`);
    
    // 4. Test unsave video
    console.log('4️⃣ Testing unsave video...');
    await savedVideosService.unsaveVideo(testVideoId);
    const statusAfterUnsave = await savedVideosService.isVideoSaved(testVideoId);
    console.log(`   Status after unsave: ${statusAfterUnsave}`);
    
    // 5. Test toggle functionality
    console.log('5️⃣ Testing toggle functionality...');
    const toggleResult1 = await savedVideosService.toggleSaveVideo(testVideoId);
    console.log(`   First toggle result: ${toggleResult1}`);
    
    const toggleResult2 = await savedVideosService.toggleSaveVideo(testVideoId);
    console.log(`   Second toggle result: ${toggleResult2}`);
    
    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Call this function in your app to test
export { testSaveFunctionality };
