// Test Custom Thumbnail Upload and Display
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

async function testCustomThumbnailDisplay() {
  try {
    console.log('🔍 Testing custom thumbnail upload and display...');
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('❌ No user logged in');
      return;
    }
    
    console.log('📱 Current user ID:', currentUser.uid);
    
    // Query user's videos to check for custom thumbnails
    const userVideosQuery = query(
      collection(db, 'videos'),
      where('userId', '==', currentUser.uid)
    );
    
    const userVideosSnapshot = await getDocs(userVideosQuery);
    console.log(`📊 Found ${userVideosSnapshot.size} videos for user`);
    
    let customThumbnailVideos = 0;
    let regularVideos = 0;
    
    userVideosSnapshot.forEach((doc) => {
      const videoData = doc.data();
      console.log('\n📹 Video:', videoData.assetId);
      console.log('🖼️ Thumbnail URL:', videoData.thumbnailUrl?.substring(0, 80) + '...');
      console.log('🔧 Thumbnail Type:', videoData.thumbnailType);
      console.log('✨ Has Custom Thumbnail:', videoData.hasCustomThumbnail);
      console.log('🎯 Thumbnail Generated:', videoData.thumbnailGenerated);
      
      if (videoData.hasCustomThumbnail || videoData.thumbnailType === 'custom') {
        customThumbnailVideos++;
        console.log('✅ This video has a custom thumbnail!');
        
        // Check if thumbnail URL is valid
        if (videoData.thumbnailUrl && videoData.thumbnailUrl.includes('firebasestorage.googleapis.com')) {
          console.log('✅ Custom thumbnail is stored in Firebase Storage');
        } else {
          console.log('⚠️ Custom thumbnail might not be uploaded to Firebase Storage');
        }
      } else {
        regularVideos++;
        console.log('📝 This video uses auto-generated thumbnail');
      }
    });
    
    console.log('\n📊 Summary:');
    console.log(`Total videos: ${userVideosSnapshot.size}`);
    console.log(`Videos with custom thumbnails: ${customThumbnailVideos}`);
    console.log(`Videos with auto thumbnails: ${regularVideos}`);
    
    if (customThumbnailVideos === 0) {
      console.log('\n💡 ISSUE IDENTIFIED: No custom thumbnails found!');
      console.log('🔍 This means:');
      console.log('1. Custom thumbnails are not being uploaded properly');
      console.log('2. Or the hasCustomThumbnail flag is not being set');
      console.log('3. Or custom thumbnails are being uploaded but not saved to video documents');
    } else {
      console.log('\n✅ Custom thumbnails are being saved!');
      console.log('🔍 If they\'re not showing in profile:');
      console.log('1. Check EnhancedVideoGrid thumbnail rendering');
      console.log('2. Check if Firebase Storage URLs are accessible');
      console.log('3. Check image loading in the video grid');
    }
    
  } catch (error) {
    console.error('❌ Error testing custom thumbnails:', error);
  }
}

// Export for manual testing
export { testCustomThumbnailDisplay };

// Run test if called directly
if (typeof window !== 'undefined') {
  // Browser environment - can run test
  console.log('🧪 Custom Thumbnail Test Ready');
  console.log('📱 Call testCustomThumbnailDisplay() to run test');
}
