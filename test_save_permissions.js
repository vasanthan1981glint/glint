const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs,
  connectFirestoreEmulator 
} = require('firebase/firestore');
const { 
  getAuth, 
  signInAnonymously,
  connectAuthEmulator 
} = require('firebase/auth');

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAUs11-YDiNO7C9pv9UR_19bvrbLbJg91A",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "869525277131",
  appId: "1:869525277131:web:b75a03f20fc93f81da0e4e",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function testSavePermissions() {
  try {
    console.log('🔐 Testing savedVideos permissions...');
    
    // Sign in anonymously for testing
    const userCredential = await signInAnonymously(auth);
    const user = userCredential.user;
    console.log('✅ Signed in as:', user.uid);
    
    // Test saving a video
    const testVideoId = 'test_video_' + Date.now();
    const savedVideoData = {
      videoId: testVideoId,
      userId: user.uid,
      savedAt: new Date().toISOString(),
    };
    
    console.log('💾 Attempting to save video...');
    const docRef = await addDoc(collection(db, 'savedVideos'), savedVideoData);
    console.log('✅ Video saved successfully with ID:', docRef.id);
    
    // Test reading saved videos
    console.log('📖 Testing read permissions...');
    const q = query(
      collection(db, 'savedVideos'),
      where('userId', '==', user.uid)
    );
    
    const querySnapshot = await getDocs(q);
    console.log('✅ Found', querySnapshot.size, 'saved videos');
    
    console.log('🎉 All savedVideos permissions working correctly!');
    
  } catch (error) {
    console.error('❌ Permission test failed:', error.message);
    console.error('Full error:', error);
  }
}

testSavePermissions();
