// Test script to verify Firebase saves collection permissions
import { initializeApp } from 'firebase/app';
import { addDoc, collection, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // This would be your Firebase config - testing locally
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testSavePermissions() {
  try {
    console.log('Testing Firebase saves collection...');
    
    // Test adding a document to saves collection
    const testDoc = await addDoc(collection(db, 'saves'), {
      userId: 'test-user-id',
      videoId: 'test-video-id',
      savedAt: new Date().toISOString(),
      createdAt: new Date()
    });
    
    console.log('✅ Successfully created test save document:', testDoc.id);
  } catch (error) {
    console.error('❌ Failed to create save document:', error);
  }
}

testSavePermissions();
