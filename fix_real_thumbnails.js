// Fix Real Thumbnails - Replace placeholder thumbnails with real video thumbnails
import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, updateDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// You'll need to add your Firebase config here
const firebaseConfig = {
  // Add your config
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Import thumbnail service
import thumbnailService from './lib/thumbnailService';

console.log('🔧 Starting real thumbnail fix for all videos...');

async function fixAllVideoThumbnails() {
  try {
    // Get all videos from Firebase
    const videosRef = collection(db, 'videos');
    const videosSnapshot = await getDocs(videosRef);
    
    console.log(`📊 Found ${videosSnapshot.size} videos to process`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const videoDoc of videosSnapshot.docs) {
      const videoData = videoDoc.data();
      const videoId = videoDoc.id;
      
      console.log(`\n🎬 Processing video: ${videoId}`);
      console.log(`📹 Current thumbnail: ${videoData.thumbnailUrl?.substring(0, 100)}...`);
      
      // Check if this is a placeholder thumbnail (contains dummyimage.com or via.placeholder.com)
      const isPlaceholder = videoData.thumbnailUrl && 
                          (videoData.thumbnailUrl.includes('dummyimage.com') || 
                           videoData.thumbnailUrl.includes('via.placeholder.com') ||
                           videoData.thumbnailUrl.includes('permanent_'));
      
      if (!isPlaceholder) {
        console.log(`✅ Video ${videoId} already has real thumbnail, skipping`);
        continue;
      }
      
      try {
        // Generate real thumbnail from video
        console.log(`🎨 Generating real thumbnail for video: ${videoId}`);
        
        // We need the video URL to generate thumbnail
        const videoUrl = videoData.playbackUrl;
        if (!videoUrl) {
          console.log(`⚠️ No video URL found for ${videoId}, skipping`);
          continue;
        }
        
        // Generate real thumbnail
        const realThumbnailUrl = await thumbnailService.generateAndUploadThumbnail(
          videoUrl, 
          videoId,
          { time: 1, quality: 0.8 } // 1 second into video, high quality
        );
        
        if (realThumbnailUrl) {
          // Update video document
          await updateDoc(doc(db, 'videos', videoId), {
            thumbnailUrl: realThumbnailUrl,
            thumbnailType: 'real-video',
            hasCustomThumbnail: false,
            hasThumbnail: true,
            thumbnailGenerated: 'real-video-service',
            thumbnailUpdatedAt: new Date().toISOString()
          });
          
          // Update post document if it exists
          try {
            await updateDoc(doc(db, 'posts', videoId), {
              thumbnailUrl: realThumbnailUrl,
              thumbnailUpdatedAt: new Date().toISOString()
            });
          } catch (postError) {
            // Post might not exist, that's OK
          }
          
          console.log(`✅ Real thumbnail generated for ${videoId}: ${realThumbnailUrl}`);
          fixedCount++;
        } else {
          console.log(`❌ Failed to generate real thumbnail for ${videoId}`);
          errorCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error processing video ${videoId}:`, error);
        errorCount++;
      }
      
      // Add small delay to avoid overwhelming the service
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🎉 Real thumbnail fix completed!');
    console.log(`✅ Successfully fixed: ${fixedCount} videos`);
    console.log(`❌ Errors: ${errorCount} videos`);
    console.log(`📱 Your videos should now show real thumbnails instead of colored placeholders!`);
    
  } catch (error) {
    console.error('❌ Failed to fix thumbnails:', error);
  }
}

// Note: This script is for demonstration
// You would need to run this in a Node.js environment with proper Firebase setup
console.log('ℹ️ This script shows how to fix real thumbnails');
console.log('ℹ️ For immediate testing, upload a new video to see real thumbnails');

export { fixAllVideoThumbnails };
