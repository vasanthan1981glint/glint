// Fix for Google Cloud Storage video access using signed URLs
// This addresses the 403 Forbidden error by generating proper access URLs

import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, query, updateDoc, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAUs11-YDiNO7C9pv9UR_19bvrbLbJg91A",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "869525277131",
  appId: "1:869525277131:web:b75a03f20fc93f81da0e4e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixVideoAccess() {
  console.log('🔧 Fixing Google Cloud Storage video access...');
  
  try {
    // Get all videos with Google Cloud Storage
    const videosQuery = query(
      collection(db, 'videos'),
      where('storage', '==', 'google-cloud')
    );
    
    const videosSnapshot = await getDocs(videosQuery);
    console.log(`📹 Found ${videosSnapshot.size} videos to fix`);
    
    for (const videoDoc of videosSnapshot.docs) {
      const videoData = videoDoc.data();
      const videoId = videoDoc.id;
      
      console.log(`\n🎬 Processing video: ${videoId}`);
      console.log(`- Current URL: ${videoData.videoUrl}`);
      
      if (videoData.videoUrl && videoData.videoUrl.includes('storage.googleapis.com')) {
        try {
          // Generate signed URL via Railway backend
          const response = await fetch('https://glint-production-f754.up.railway.app/video/signed-url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileName: videoData.fileName || `video_${videoId}.mp4`,
              userId: videoData.userId
            })
          });
          
          if (response.ok) {
            const { signedUrl } = await response.json();
            
            // Update video document with signed URL
            await updateDoc(doc(db, 'videos', videoId), {
              playbackUrl: signedUrl,
              signedUrlGeneratedAt: new Date().toISOString(),
              signedUrlExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
            });
            
            // Also update posts collection
            await updateDoc(doc(db, 'posts', videoId), {
              playbackUrl: signedUrl,
              signedUrlGeneratedAt: new Date().toISOString()
            });
            
            console.log(`✅ Updated video ${videoId} with signed URL`);
          } else {
            console.log(`❌ Failed to generate signed URL for ${videoId}`);
          }
        } catch (error) {
          console.log(`❌ Error processing ${videoId}:`, error.message);
        }
      }
    }
    
    console.log('\n✅ Video access fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing video access:', error);
  }
}

fixVideoAccess();
