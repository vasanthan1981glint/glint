// Debug script to check what video URLs are stored in Firebase
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDzSH6TzjGO3iXaKhtyN5Z3sQIePZPdYKI",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "1047203329925",
  appId: "1:1047203329925:web:86e33ecfc41e1b1f6b3d80"
};

async function debugVideoUrls() {
  try {
    console.log('🔍 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('📄 Fetching all video documents...');
    const videosSnapshot = await getDocs(collection(db, 'videos'));
    
    console.log(`Found ${videosSnapshot.size} video documents:`);
    console.log('');
    
    videosSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`📹 Video ${index + 1}:`);
      console.log(`   Document ID: ${doc.id}`);
      console.log(`   Asset ID: ${data.assetId || 'undefined'}`);
      console.log(`   Playback URL: ${data.playbackUrl || 'undefined'}`);
      console.log(`   Status: ${data.status || 'undefined'}`);
      console.log(`   Processed: ${data.processed || 'undefined'}`);
      
      // Check if URL looks like Asset ID or Playback ID
      if (data.playbackUrl) {
        const idMatch = data.playbackUrl.match(/([a-zA-Z0-9]{32,})/);
        if (idMatch) {
          const id = idMatch[1];
          const isAssetId = id.length >= 40;
          console.log(`   🔍 URL Analysis: ${isAssetId ? '❌ Asset ID (wrong)' : '✅ Playback ID (correct)'}`);
          console.log(`   📏 ID Length: ${id.length} characters`);
        }
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugVideoUrls();
