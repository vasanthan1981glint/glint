const { initializeApp } = require('firebase/app');
const { getFirestore, doc, deleteDoc, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBJMCQHkC5WzBGojlKLrXZhgc5CKFpCb8w",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "325710700705",
  appId: "1:325710700705:web:8b9bb75dac3b09b3e6ce28",
  measurementId: "G-CFXZP4MM5X"
};

async function forceCleanupTestDocuments() {
  try {
    console.log('🔧 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('🧹 Getting ALL documents in videos collection...');
    
    // Get all documents without any filters
    const videosRef = collection(db, 'videos');
    const querySnapshot = await getDocs(videosRef);
    
    console.log(`📊 Found ${querySnapshot.size} total documents`);
    
    let deletedCount = 0;
    const toDelete = [];
    
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const docId = docSnapshot.id;
      
      console.log(`\\n📄 Checking document: ${docId}`);
      console.log(`  - Playback URL: ${data.playbackUrl || 'NONE'}`);
      console.log(`  - Test Document: ${data.testDocument || false}`);
      
      // Delete if it's a connectivity test OR has no playback URL
      if (docId.startsWith('connectivity_test_') || data.testDocument || !data.playbackUrl) {
        console.log(`🗑️ MARKING FOR DELETION: ${docId}`);
        toDelete.push(docId);
      } else {
        console.log(`✅ KEEPING: ${docId} (has valid playback URL)`);
      }
    });
    
    // Delete marked documents
    console.log(`\\n🗑️ Deleting ${toDelete.length} documents...`);
    for (const docId of toDelete) {
      try {
        await deleteDoc(doc(db, 'videos', docId));
        deletedCount++;
        console.log(`✅ Deleted: ${docId}`);
      } catch (error) {
        console.error(`❌ Failed to delete ${docId}:`, error.message);
      }
    }
    
    console.log(`\\n🎉 Cleanup complete! Deleted ${deletedCount} invalid documents.`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

forceCleanupTestDocuments();
