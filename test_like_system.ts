/**
 * Like System Test & Fix Script
 * 
 * This script helps test and verify the like system works correctly
 */

import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from './firebaseConfig';

// Test functions for like system
export const testLikeSystem = {
  
  // Test 1: Check if a video has likes in Firebase
  async checkVideoLikes(videoId: string) {
    try {
      console.log(`🔍 Checking likes for video: ${videoId}`);
      
      const likesSnapshot = await getDocs(collection(db, 'posts', videoId, 'likes'));
      const totalLikes = likesSnapshot.size;
      
      console.log(`📊 Video ${videoId} total likes: ${totalLikes}`);
      
      if (totalLikes > 0) {
        likesSnapshot.forEach((doc) => {
          console.log(`👤 Liked by user: ${doc.id} at ${doc.data().timestamp?.toDate()}`);
        });
      }
      
      return totalLikes;
    } catch (error) {
      console.error('❌ Error checking video likes:', error);
      return 0;
    }
  },

  // Test 2: Check if current user liked a video
  async checkUserLikedVideo(videoId: string, userId: string) {
    try {
      console.log(`🔍 Checking if user ${userId} liked video ${videoId}`);
      
      const userLikeQuery = query(
        collection(db, 'posts', videoId, 'likes'),
        where('__name__', '==', userId)
      );
      const userLikeSnapshot = await getDocs(userLikeQuery);
      const isLiked = !userLikeSnapshot.empty;
      
      console.log(`❤️ User ${userId} liked video ${videoId}: ${isLiked}`);
      return isLiked;
    } catch (error) {
      console.error('❌ Error checking user like:', error);
      return false;
    }
  },

  // Test 3: Manually add a like for testing
  async addTestLike(videoId: string, userId: string) {
    try {
      console.log(`➕ Adding test like for video ${videoId} by user ${userId}`);
      
      const likeDocRef = doc(db, 'posts', videoId, 'likes', userId);
      await setDoc(likeDocRef, {
        timestamp: new Date(),
        userId: userId,
        videoId: videoId
      });
      
      console.log('✅ Test like added successfully');
      return true;
    } catch (error) {
      console.error('❌ Error adding test like:', error);
      return false;
    }
  },

  // Test 4: Remove a like for testing
  async removeTestLike(videoId: string, userId: string) {
    try {
      console.log(`➖ Removing test like for video ${videoId} by user ${userId}`);
      
      const likeDocRef = doc(db, 'posts', videoId, 'likes', userId);
      await deleteDoc(likeDocRef);
      
      console.log('✅ Test like removed successfully');
      return true;
    } catch (error) {
      console.error('❌ Error removing test like:', error);
      return false;
    }
  },

  // Test 5: Full like system test
  async runFullTest(videoId: string, userId: string) {
    console.log('🧪 Starting full like system test...\n');
    
    // Check initial state
    console.log('📋 Step 1: Check initial state');
    const initialLikes = await this.checkVideoLikes(videoId);
    const initialUserLiked = await this.checkUserLikedVideo(videoId, userId);
    
    // Add a like
    console.log('\n➕ Step 2: Add like');
    await this.addTestLike(videoId, userId);
    
    // Check after adding like
    console.log('\n📋 Step 3: Check after adding like');
    const afterAddLikes = await this.checkVideoLikes(videoId);
    const afterAddUserLiked = await this.checkUserLikedVideo(videoId, userId);
    
    // Remove the like
    console.log('\n➖ Step 4: Remove like');
    await this.removeTestLike(videoId, userId);
    
    // Check after removing like
    console.log('\n📋 Step 5: Check after removing like');
    const afterRemoveLikes = await this.checkVideoLikes(videoId);
    const afterRemoveUserLiked = await this.checkUserLikedVideo(videoId, userId);
    
    // Results
    console.log('\n📊 Test Results:');
    console.log(`Initial: ${initialLikes} likes, user liked: ${initialUserLiked}`);
    console.log(`After add: ${afterAddLikes} likes, user liked: ${afterAddUserLiked}`);
    console.log(`After remove: ${afterRemoveLikes} likes, user liked: ${afterRemoveUserLiked}`);
    
    const testPassed = 
      afterAddLikes === initialLikes + 1 &&
      afterAddUserLiked === true &&
      afterRemoveLikes === initialLikes &&
      afterRemoveUserLiked === false;
    
    console.log(`\n${testPassed ? '✅' : '❌'} Like system test ${testPassed ? 'PASSED' : 'FAILED'}`);
    
    return testPassed;
  }
};

// Instructions for testing
export const likeSystemInstructions = `
🔧 LIKE SYSTEM TESTING INSTRUCTIONS

1. Import this test in your component:
   import { testLikeSystem } from './test_like_system';

2. Run tests in your component:
   
   // Test with actual video ID and user ID
   const videoId = 'firebase_1754842246230'; // Replace with actual video ID
   const userId = 'LH7vqrLArUehluK4etp0IbcpiJX2'; // Replace with actual user ID
   
   // Run full test
   testLikeSystem.runFullTest(videoId, userId);

3. Check console logs for results

4. Test in the app:
   - Like a video
   - Close and reopen the app
   - Check if the like persists
   - Unlike the video
   - Check if the unlike persists

🚨 COMMON ISSUES TO FIX:

1. UI Delay on App Startup:
   - Real-time listeners should now fix this
   - Check console for "🔴 Set up real-time like listeners"

2. Likes Not Persisting:
   - Check Firebase console for the likes data
   - Verify toggleLike function is called
   - Look for "💝 Like saved to Firebase" logs

3. Like Button Not Working:
   - Check for "❤️ Toggling like" logs
   - Verify user authentication
   - Make sure video has a valid assetId

📊 EXPECTED BEHAVIOR:
- Tap like → Instant UI update → Background Firebase save
- App restart → Likes load immediately from Firebase
- Real-time updates → Changes sync across devices instantly
`;

console.log(likeSystemInstructions);
