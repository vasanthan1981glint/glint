const { initializeApp } = require('firebase/app');
const { getFirestore, doc, deleteDoc, collection, query, where, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBJMCQHkC5WzBGojlKLrXZhgc5CKFpCb8w",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "325710700705",
  appId: "1:325710700705:web:8b9bb75dac3b09b3e6ce28",
  measurementId: "G-CFXZP4MM5X"
};

async function cleanupTestDocuments() {
  try {
    console.log('🔧 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('🧹 Finding test documents to clean up...');
    
    // Find all connectivity test documents
    const videosRef = collection(db, 'videos');
    const testQuery = query(
      videosRef,
      where('userId', '==', 'LH7vqrLArUehluK4etp0IbcpiJX2')
    );
    
    const querySnapshot = await getDocs(testQuery);
    console.log(`📊 Found ${querySnapshot.size} documents`);
    
    let deletedCount = 0;
    const batch = [];
    
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const docId = docSnapshot.id;
      
      // Delete connectivity test documents and documents without playback URLs
      if (docId.startsWith('connectivity_test_') || data.testDocument || !data.playbackUrl) {
        console.log(`🗑️ Marking for deletion: ${docId} (reason: ${docId.startsWith('connectivity_test_') ? 'connectivity test' : !data.playbackUrl ? 'no playback URL' : 'test document'})`);
        batch.push(docId);
      } else {
        console.log(`✅ Keeping: ${docId} (has playback URL: ${data.playbackUrl})`);
      }
    });
    
    // Delete documents
    for (const docId of batch) {
      await deleteDoc(doc(db, 'videos', docId));
      deletedCount++;
      console.log(`🗑️ Deleted: ${docId}`);
    }
    
    console.log(`\\n🎉 Cleanup complete! Deleted ${deletedCount} test documents.`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

cleanupTestDocuments();
