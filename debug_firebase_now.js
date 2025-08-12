const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, limit, where } = require('firebase/firestore');

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

async function debugFirebaseNow() {
  try {
    console.log('🔍 DEBUGGING Firebase for user: LH7vqrLArUehluK4etp0IbcpiJX2');
    
    // Check total videos count first
    console.log('\n📊 Checking total videos in database...');
    const allVideosSnapshot = await getDocs(query(collection(db, 'videos'), limit(10)));
    console.log('📄 Total videos found:', allVideosSnapshot.size);
    
    if (allVideosSnapshot.size > 0) {
      console.log('\n📹 Recent videos (any user):');
      allVideosSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`${index + 1}. ID: ${doc.id}`);
        console.log(`   User: ${data.userId}`);
        console.log(`   Asset ID: ${data.assetId}`);
        console.log(`   Created: ${data.createdAt}`);
        console.log(`   Upload method: ${data.uploadMethod || 'Unknown'}`);
        console.log(`   Status: ${data.status || 'Unknown'}`);
        console.log('');
      });
    }
    
    // Check specific user videos
    console.log('\n👤 Checking videos for user LH7vqrLArUehluK4etp0IbcpiJX2...');
    const userVideosSnapshot = await getDocs(query(
      collection(db, 'videos'), 
      where('userId', '==', 'LH7vqrLArUehluK4etp0IbcpiJX2'),
      limit(10)
    ));
    console.log('📄 User videos found:', userVideosSnapshot.size);
    
    if (userVideosSnapshot.size > 0) {
      console.log('\n📹 User videos:');
      userVideosSnapshot.forEach((doc, index) => {
        const data = doc.data();
        console.log(`${index + 1}. ID: ${doc.id}`);
        console.log(`   Asset ID: ${data.assetId}`);
        console.log(`   Caption: ${data.caption || 'No caption'}`);
        console.log(`   Created: ${data.createdAt}`);
        console.log(`   Processed: ${data.processed}`);
        console.log(`   Has playback URL: ${!!data.playbackUrl}`);
        console.log(`   Has thumbnail: ${!!data.thumbnailUrl}`);
        console.log('');
      });
    } else {
      console.log('❌ NO videos found for this user!');
      console.log('💡 This explains why your videos are not appearing in the app');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugFirebaseNow().then(() => {
  console.log('\n✅ Debug complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Debug failed:', error);
  process.exit(1);
});
