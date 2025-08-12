const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, query, where, getDocs, orderBy, limit } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBJMCQHkC5WzBGojlKLrXZhgc5CKFpCb8w",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "325710700705",
  appId: "1:325710700705:web:8b9bb75dac3b09b3e6ce28",
  measurementId: "G-CFXZP4MM5X"
};

async function checkVideoDocuments() {
  try {
    console.log('🔧 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('📋 Checking recent video documents...');
    
    // Get recent videos
    const videosRef = collection(db, 'videos');
    const recentVideosQuery = query(
      videosRef,
      where('userId', '==', 'LH7vqrLArUehluK4etp0IbcpiJX2'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    
    const querySnapshot = await getDocs(recentVideosQuery);
    console.log(`📊 Found ${querySnapshot.size} video documents`);
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('\\n📹 Video Document:', doc.id);
      console.log('  - Asset ID:', data.assetId);
      console.log('  - Playback URL:', data.playbackUrl);
      console.log('  - Thumbnail URL:', data.thumbnailUrl);
      console.log('  - Processed:', data.processed);
      console.log('  - Status:', data.status);
      console.log('  - Created:', data.createdAt);
      console.log('  - Upload Method:', data.uploadMethod);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkVideoDocuments();
