require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, query, where, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugVideoIssue() {
  console.log('🔍 Debugging video playback issue...');
  
  try {
    // Check the problematic video
    const videoId = 'gcs_1755260936025_l5h5otvnk';
    const videoDoc = await getDoc(doc(db, 'videos', videoId));
    
    if (videoDoc.exists()) {
      const data = videoDoc.data();
      console.log('\n📹 Video Document Data:');
      console.log('- Video ID:', videoId);
      console.log('- User ID:', data.userId);
      console.log('- Status:', data.status);
      console.log('- Processed:', data.processed);
      console.log('- Storage:', data.storage);
      console.log('- Video URL:', data.videoUrl);
      console.log('- Playback URL:', data.playbackUrl);
      console.log('- Thumbnail URL:', data.thumbnailUrl);
      console.log('- Created At:', data.createdAt);
      
      // Check if URLs are accessible
      console.log('\n🌐 Testing URL accessibility...');
      
      if (data.videoUrl) {
        try {
          const response = await fetch(data.videoUrl, { method: 'HEAD' });
          console.log('✅ Video URL status:', response.status, response.statusText);
          if (response.status === 403) {
            console.log('🔥 PROBLEM FOUND: 403 Forbidden - Your Google Cloud Storage bucket needs public permissions!');
          }
        } catch (error) {
          console.log('❌ Video URL not accessible:', error.message);
        }
      }
      
      if (data.thumbnailUrl && !data.thumbnailUrl.includes('placeholder')) {
        try {
          const response = await fetch(data.thumbnailUrl, { method: 'HEAD' });
          console.log('✅ Thumbnail URL status:', response.status, response.statusText);
        } catch (error) {
          console.log('❌ Thumbnail URL not accessible:', error.message);
        }
      }
      
    } else {
      console.log('❌ Video document not found');
    }
    
    // Check posts collection for the same video
    console.log('\n📄 Checking posts collection...');
    const postDoc = await getDoc(doc(db, 'posts', videoId));
    
    if (postDoc.exists()) {
      const postData = postDoc.data();
      console.log('✅ Post document exists');
      console.log('- Status:', postData.status);
      console.log('- Processed:', postData.processed);
      console.log('- Video URL:', postData.videoUrl);
      console.log('- Playback URL:', postData.playbackUrl);
    } else {
      console.log('❌ Post document not found');
    }
    
    // Check total video count for user
    console.log('\n📊 Checking user video count...');
    const videosQuery = query(
      collection(db, 'videos'),
      where('userId', '==', 'LH7vqrLArUehluK4etp0IbcpiJX2')
    );
    const videosSnapshot = await getDocs(videosQuery);
    
    console.log('Total videos for user:', videosSnapshot.size);
    
    videosSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`- ${doc.id}: status=${data.status}, processed=${data.processed}, storage=${data.storage}`);
    });
    
    console.log('\n🎯 SOLUTION:');
    console.log('If you see 403 Forbidden above, go to:');
    console.log('1. https://console.cloud.google.com/');
    console.log('2. Cloud Storage > Buckets > glint-videos');
    console.log('3. Permissions tab > Grant Access');
    console.log('4. Principal: allUsers, Role: Storage Object Viewer');
    
  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

debugVideoIssue();
