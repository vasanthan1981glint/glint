const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDocs, query, where, limit } = require('firebase/firestore');

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

async function testVideoSave() {
  try {
    console.log('🧪 Testing video save and retrieval...');
    
    // Create a test video document
    const testVideoId = `test_video_${Date.now()}`;
    const testVideo = {
      userId: 'LH7vqrLArUehluK4etp0IbcpiJX2',
      assetId: testVideoId,
      playbackUrl: 'https://example.com/test.mp4',
      thumbnailUrl: 'https://example.com/test.jpg',
      caption: 'Test video to verify Firebase functionality',
      createdAt: new Date().toISOString(),
      username: 'vasanthan',
      views: 0,
      likes: 0,
      processed: true,
      status: 'ready',
      isRealVideo: false,
      testVideo: true
    };
    
    console.log('💾 Saving test video to Firebase...');
    await setDoc(doc(db, 'videos', testVideoId), testVideo);
    console.log('✅ Test video saved successfully');
    
    // Test our fixed query (without processed filter)
    console.log('🔍 Testing video retrieval query...');
    const videosQuery = query(
      collection(db, 'videos'),
      where('userId', '==', 'LH7vqrLArUehluK4etp0IbcpiJX2'),
      limit(10)
    );
    
    const querySnapshot = await getDocs(videosQuery);
    console.log(`📄 Query returned ${querySnapshot.size} documents`);
    
    if (querySnapshot.size > 0) {
      console.log('✅ SUCCESS: Our query fixes work!');
      console.log('📹 Found videos:');
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`   - ${doc.id}: ${data.caption}`);
        console.log(`     Test video: ${data.testVideo || false}`);
        console.log(`     Created: ${data.createdAt}`);
      });
    } else {
      console.log('❌ ISSUE: Query still returns no results');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testVideoSave().then(() => {
  console.log('\\n✅ Test complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
