// Simple client-side Firebase check
import { initializeApp } from 'firebase/app';
import { collection, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';

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

async function debugIssues() {
  console.log('🔍 Debugging Glint video issues...');
  
  try {
    // Check the specific video that's failing
    const videoId = 'gcs_1755260936025_l5h5otvnk';
    console.log(`\n📹 Checking video: ${videoId}`);
    
    const videoDoc = await getDoc(doc(db, 'videos', videoId));
    
    if (videoDoc.exists()) {
      const data = videoDoc.data();
      console.log('✅ Video document found:');
      console.log('- Status:', data.status);
      console.log('- Processed:', data.processed);
      console.log('- Storage:', data.storage);
      console.log('- Video URL:', data.videoUrl);
      console.log('- Playback URL:', data.playbackUrl);
      console.log('- Thumbnail URL:', data.thumbnailUrl);
      
      // Test if the video URL is accessible
      if (data.videoUrl) {
        try {
          const response = await fetch(data.videoUrl, { method: 'HEAD' });
          console.log('✅ Video URL accessible:', response.status);
        } catch (error) {
          console.log('❌ Video URL not accessible:', error.message);
          console.log('🔧 This is likely the cause of playback error -1102');
        }
      }
    } else {
      console.log('❌ Video document not found');
    }
    
    // Check posts collection
    console.log('\n📄 Checking posts collection...');
    const postsQuery = query(
      collection(db, 'posts'),
      where('processed', '==', true)
    );
    
    try {
      const postsSnapshot = await getDocs(postsQuery);
      console.log(`✅ Posts query successful: ${postsSnapshot.size} posts found`);
    } catch (error) {
      console.log('❌ Posts query failed:', error.message);
      if (error.message.includes('requires an index')) {
        console.log('🔧 Fix: Deploy Firestore indexes');
      }
    }
    
    // Check user videos
    console.log('\n👤 Checking user videos...');
    const userVideosQuery = query(
      collection(db, 'videos'),
      where('userId', '==', 'LH7vqrLArUehluK4etp0IbcpiJX2')
    );
    
    const userVideosSnapshot = await getDocs(userVideosQuery);
    console.log(`✅ User has ${userVideosSnapshot.size} videos`);
    
    userVideosSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- ${doc.id}: status=${data.status}, processed=${data.processed}`);
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugIssues();
