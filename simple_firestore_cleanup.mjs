/**
 * Simple Firestore Cleanup Script
 * Uses the existing Firebase config from your app
 */

import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, writeBatch } from 'firebase/firestore';

// Your Firebase config (same as in app)
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

async function cleanupFirestore() {
  try {
    console.log('🔍 Checking Firestore collections for orphaned video documents...\n');
    
    // Check posts collection
    console.log('📄 Scanning posts collection...');
    const postsSnapshot = await getDocs(collection(db, 'posts'));
    console.log(`Found ${postsSnapshot.size} documents in posts collection`);
    
    if (postsSnapshot.size > 0) {
      console.log('\n📋 Posts to be deleted:');
      postsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        console.log(`  - ${docSnap.id}: ${data.username || 'unknown'} | ${data.status || 'no status'}`);
      });
      
      console.log('\n🗑️  Deleting all posts...');
      const batch = writeBatch(db);
      postsSnapshot.forEach(docSnap => {
        batch.delete(doc(db, 'posts', docSnap.id));
      });
      await batch.commit();
      console.log('✅ All posts deleted from Firestore');
    }
    
    // Check videos collection
    console.log('\n🎬 Scanning videos collection...');
    const videosSnapshot = await getDocs(collection(db, 'videos'));
    console.log(`Found ${videosSnapshot.size} documents in videos collection`);
    
    if (videosSnapshot.size > 0) {
      console.log('\n📋 Videos to be deleted:');
      videosSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        console.log(`  - ${docSnap.id}: ${data.status || 'no status'}`);
      });
      
      console.log('\n🗑️  Deleting all videos...');
      const batch = writeBatch(db);
      videosSnapshot.forEach(docSnap => {
        batch.delete(doc(db, 'videos', docSnap.id));
      });
      await batch.commit();
      console.log('✅ All videos deleted from Firestore');
    }
    
    if (postsSnapshot.size === 0 && videosSnapshot.size === 0) {
      console.log('✅ No video documents found - Firestore is already clean!');
    } else {
      console.log('\n🎉 Cleanup complete! Your app should now show no videos.');
      console.log('📱 Restart your app to see the changes.');
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

cleanupFirestore();
