const admin = require('firebase-admin');

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
  try {
    const serviceAccount = require('./glint-7e3c3-firebase-adminsdk-bcsiq-2c4f52ca82.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('🔥 Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function cleanupFirestoreVideos() {
  try {
    console.log('🔍 Scanning Firestore for video documents...\n');
    
    // Check posts collection
    console.log('📄 Checking posts collection...');
    const postsSnapshot = await db.collection('posts').get();
    console.log(`Found ${postsSnapshot.size} documents in posts collection`);
    
    if (postsSnapshot.size > 0) {
      console.log('\n📋 Posts found:');
      for (const doc of postsSnapshot.docs) {
        const data = doc.data();
        console.log(`  - ${doc.id}: ${data.status || 'unknown status'} | ${data.streamingUrl ? 'has URL' : 'no URL'}`);
      }
      
      // Ask for confirmation before deleting
      console.log('\n⚠️  DELETE ALL POSTS? This will remove all video documents from Firestore.');
      console.log('Run with "delete" argument to confirm: node cleanup_firestore_videos.js delete');
      
      if (process.argv[2] === 'delete') {
        console.log('\n🗑️  Deleting all posts...');
        const batch = db.batch();
        postsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log('✅ All posts deleted from Firestore');
      }
    }
    
    // Check videos collection
    console.log('\n🎬 Checking videos collection...');
    const videosSnapshot = await db.collection('videos').get();
    console.log(`Found ${videosSnapshot.size} documents in videos collection`);
    
    if (videosSnapshot.size > 0) {
      console.log('\n📋 Videos found:');
      for (const doc of videosSnapshot.docs) {
        const data = doc.data();
        console.log(`  - ${doc.id}: ${data.status || 'unknown status'}`);
      }
      
      if (process.argv[2] === 'delete') {
        console.log('\n🗑️  Deleting all videos...');
        const batch = db.batch();
        videosSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log('✅ All videos deleted from Firestore');
      }
    }
    
    if (postsSnapshot.size === 0 && videosSnapshot.size === 0) {
      console.log('✅ No video documents found in Firestore - database is clean!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

cleanupFirestoreVideos();
