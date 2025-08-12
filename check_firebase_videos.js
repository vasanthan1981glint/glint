const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, limit } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyAUs11-YDiNO7C9pv9UR_19bvrbLbJg91A',
  authDomain: 'glint-7e3c3.firebaseapp.com',
  projectId: 'glint-7e3c3',
  storageBucket: 'glint-7e3c3.firebasestorage.app',
  messagingSenderId: '869525277131',
  appId: '1:869525277131:web:b75a03f20fc93f81da0e4e',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkFirebaseVideos() {
  try {
    console.log('🔍 Checking videos collection...');
    
    // Simple query without orderBy to avoid index issues
    const videosSnapshot = await getDocs(query(collection(db, 'videos'), limit(10)));
    
    console.log('📊 Total videos found:', videosSnapshot.size);
    
    if (videosSnapshot.size > 0) {
      console.log('\n📹 Recent videos:');
      videosSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`${index + 1}. ID: ${doc.id}`);
        console.log(`   User: ${data.userId || 'Unknown'}`);
        console.log(`   Username: ${data.username || 'Unknown'}`);
        console.log(`   Caption: ${data.caption || 'No caption'}`);
        console.log(`   Created: ${data.createdAt || 'Unknown'}`);
        console.log(`   Has thumbnail: ${!!data.thumbnailUrl}`);
        console.log(`   Thumbnail URL: ${data.thumbnailUrl || 'None'}`);
        console.log(`   Playback URL: ${data.playbackUrl ? 'Yes' : 'No'}`);
        console.log(`   Processed: ${data.processed}`);
        console.log(`   Storage: ${data.storage || 'Unknown'}`);
        console.log('');
      });
    } else {
      console.log('❌ No videos found in the videos collection');
    }
    
    // Check savedVideos collection
    console.log('\n🔍 Checking savedVideos collection...');
    const savedVideosSnapshot = await getDocs(query(collection(db, 'savedVideos'), limit(5)));
    console.log('📊 Total saved videos found:', savedVideosSnapshot.size);
    
    if (savedVideosSnapshot.size > 0) {
      console.log('\n💾 Recent saved videos:');
      savedVideosSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`${index + 1}. ID: ${doc.id}`);
        console.log(`   Video ID: ${data.videoId}`);
        console.log(`   User ID: ${data.userId}`);
        console.log(`   Saved at: ${data.savedAt}`);
        console.log('');
      });
    }
    
    // Check posts collection
    console.log('\n🔍 Checking posts collection...');
    const postsSnapshot = await getDocs(query(collection(db, 'posts'), limit(5)));
    console.log('📊 Total posts found:', postsSnapshot.size);
    
    if (postsSnapshot.size > 0) {
      console.log('\n📝 Recent posts:');
      postsSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`${index + 1}. ID: ${doc.id}`);
        console.log(`   Video ID: ${data.videoId}`);
        console.log(`   User ID: ${data.userId}`);
        console.log(`   Username: ${data.username || 'Unknown'}`);
        console.log(`   Caption: ${data.caption || 'No caption'}`);
        console.log(`   Has thumbnail: ${!!data.thumbnailUrl}`);
        console.log('');
      });
    }
    
    // Check users collection
    console.log('\n🔍 Checking users collection...');
    const usersSnapshot = await getDocs(query(collection(db, 'users'), limit(3)));
    console.log('📊 Total users found:', usersSnapshot.size);
    
  } catch (error) {
    console.error('❌ Error checking Firebase:', error.message);
    console.error('Full error:', error);
  }
}

checkFirebaseVideos().then(() => {
  console.log('\n✅ Firebase check complete');
}).catch((error) => {
  console.error('❌ Check failed:', error);
});
