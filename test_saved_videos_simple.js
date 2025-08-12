const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, addDoc, deleteDoc, doc } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAUs11-YDiNO7C9pv9UR_19bvrbLbJg91A",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "869525277131",
  appId: "1:869525277131:web:b75a03f20fc93f81da0e4e",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function testSavedVideosSimple() {
  console.log('🧪 Testing savedVideos with simple query (no orderBy)...');
  
  try {
    // First authenticate
    console.log('🔐 Authenticating...');
    await signInWithEmailAndPassword(auth, 'glintchat2025@gmail.com', 'password123');
    console.log('✅ Authenticated as:', auth.currentUser?.email);
    
    // Test 1: Create a test document
    console.log('📝 Creating test saved video...');
    const testData = {
      videoId: 'test_video_' + Date.now(),
      userId: auth.currentUser?.uid,
      savedAt: new Date().toISOString()
    };
    
    const docRef = await addDoc(collection(db, 'savedVideos'), testData);
    console.log('✅ Created test document with ID:', docRef.id);
    
    // Test 2: Query without orderBy (should work)
    console.log('📝 Querying saved videos (simple query)...');
    const simpleQuery = query(
      collection(db, 'savedVideos'),
      where('userId', '==', auth.currentUser?.uid)
    );
    
    const querySnapshot = await getDocs(simpleQuery);
    console.log('✅ Simple query successful! Found:', querySnapshot.docs.length, 'documents');
    
    // Show the documents
    querySnapshot.docs.forEach(doc => {
      console.log('📄 Document:', doc.id, doc.data());
    });
    
    // Test 3: Clean up
    console.log('🧹 Cleaning up test document...');
    await deleteDoc(doc(db, 'savedVideos', docRef.id));
    console.log('✅ Cleanup complete');
    
    console.log('🎉 All tests passed! Simple savedVideos queries work.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
  }
}

testSavedVideosSimple();
