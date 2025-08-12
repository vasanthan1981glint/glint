const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBJMCQHkC5WzBGojlKLrXZhgc5CKFpCb8w",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "325710700705",
  appId: "1:325710700705:web:8b9bb75dac3b09b3e6ce28",
  measurementId: "G-CFXZP4MM5X"
};

async function listAllVideos() {
  try {
    console.log('🔧 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('📋 Getting all videos in the collection...');
    
    // Get all videos without any filters
    const videosRef = collection(db, 'videos');
    const querySnapshot = await getDocs(videosRef);
    
    console.log(`📊 Found ${querySnapshot.size} total video documents`);
    
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const docId = docSnapshot.id;
      
      console.log(`\\n📹 Document ID: ${docId}`);
      console.log(`  - User ID: ${data.userId}`);
      console.log(`  - Asset ID: ${data.assetId}`);
      console.log(`  - Playback URL: ${data.playbackUrl || 'undefined'}`);
      console.log(`  - Caption: ${data.caption || 'undefined'}`);
      console.log(`  - Test Document: ${data.testDocument || false}`);
      console.log(`  - Created: ${data.createdAt}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listAllVideos();
