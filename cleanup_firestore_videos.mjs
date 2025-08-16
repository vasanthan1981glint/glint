import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, writeBatch } from 'firebase/firestore';

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCOadf6n3gvUSDVUzI8FP5j7BVHYkb1K1k",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "404827926978",
  appId: "1:404827926978:web:4da5b1f6df46df6b1b7826",
  measurementId: "G-BSMGD5J7J8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanupFirestoreVideos() {
  try {
    console.log('🔍 Scanning Firestore for video documents...\n');
    
    // Check posts collection
    console.log('📄 Checking posts collection...');
    const postsSnapshot = await getDocs(collection(db, 'posts'));
    console.log(`Found ${postsSnapshot.size} documents in posts collection`);
    
    if (postsSnapshot.size > 0) {
      console.log('\n📋 Posts found:');
      postsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        console.log(`  - ${docSnap.id}: ${data.status || 'unknown status'} | ${data.streamingUrl ? 'has URL' : 'no URL'}`);
      });
      
      // Delete all posts
      console.log('\n🗑️  Deleting all posts from Firestore...');
      const batch = writeBatch(db);
      postsSnapshot.forEach(docSnap => {
        batch.delete(doc(db, 'posts', docSnap.id));
      });
      await batch.commit();
      console.log('✅ All posts deleted from Firestore');
    }
    
    // Check videos collection
    console.log('\n🎬 Checking videos collection...');
    const videosSnapshot = await getDocs(collection(db, 'videos'));
    console.log(`Found ${videosSnapshot.size} documents in videos collection`);
    
    if (videosSnapshot.size > 0) {
      console.log('\n📋 Videos found:');
      videosSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        console.log(`  - ${docSnap.id}: ${data.status || 'unknown status'}`);
      });
      
      console.log('\n🗑️  Deleting all videos from Firestore...');
      const batch = writeBatch(db);
      videosSnapshot.forEach(docSnap => {
        batch.delete(doc(db, 'videos', docSnap.id));
      });
      await batch.commit();
      console.log('✅ All videos deleted from Firestore');
    }
    
    if (postsSnapshot.size === 0 && videosSnapshot.size === 0) {
      console.log('✅ No video documents found in Firestore - database is clean!');
    }
    
    console.log('\n🎉 Cleanup complete! Your app should now show no videos.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

cleanupFirestoreVideos();
