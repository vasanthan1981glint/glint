// Debug the current state of videos in Firebase
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, limit } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDzSH6TzjGO3iXaKhtyN5Z3sQIePZPdYKI",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "1047203329925",
  appId: "1:1047203329925:web:86e33ecfc41e1b1f6b3d80"
};

async function debugCurrentVideos() {
  console.log('🔍 DEBUGGING CURRENT FIREBASE VIDEOS');
  console.log('====================================');
  
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Get the latest videos
    const videosRef = collection(db, 'videos');
    const q = query(videosRef, limit(10));
    const snapshot = await getDocs(q);
    
    console.log(`📋 Found ${snapshot.size} video documents:`);
    console.log('');
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`📹 Video ${index + 1}:`);
      console.log(`   Document ID: ${doc.id}`);
      console.log(`   Asset ID: ${data.assetId || 'NULL'}`);
      console.log(`   Upload ID: ${data.uploadId || 'NULL'}`);
      console.log(`   Playback ID: ${data.playbackId || 'NULL'}`);
      console.log(`   Playback URL: ${data.playbackUrl || 'NULL'}`);
      console.log(`   Status: ${data.status || 'unknown'}`);
      console.log(`   Processed: ${data.processed || false}`);
      console.log(`   User ID: ${data.userId || 'unknown'}`);
      console.log(`   Created: ${data.createdAt || 'unknown'}`);
      console.log('');
    });
    
    // Check for videos with uploadIds but null assetIds
    const videosWithNullAssets = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data.uploadId && !data.assetId;
    });
    
    if (videosWithNullAssets.length > 0) {
      console.log('🚨 PROBLEM VIDEOS FOUND:');
      console.log(`   ${videosWithNullAssets.length} videos have uploadId but NULL assetId`);
      console.log('   These videos need to be fixed by webhook or manual update');
      console.log('');
      
      videosWithNullAssets.forEach((doc, index) => {
        const data = doc.data();
        console.log(`❌ Problem Video ${index + 1}:`);
        console.log(`   Document ID: ${doc.id}`);
        console.log(`   Upload ID: ${data.uploadId}`);
        console.log(`   Asset ID: ${data.assetId || 'NULL'}`);
        console.log(`   Status: ${data.status}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugCurrentVideos();
