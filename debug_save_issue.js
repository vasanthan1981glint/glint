// Debug script to check auth state when saving videos
const { initializeApp } = require('firebase/app');
const { getAuth, onAuthStateChanged } = require('firebase/auth');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

// Firebase config from your project
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
const auth = getAuth(app);
const db = getFirestore(app);

async function debugAuthAndPermissions() {
  console.log('🔍 Debugging authentication and permissions...');
  
  // Check current auth state
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('✅ User is authenticated:', user.uid);
        console.log('📧 Email:', user.email);
        console.log('✅ Email verified:', user.emailVerified);
        
        // Try to access Firestore with current user
        try {
          console.log('🔍 Testing Firestore access...');
          
          // Try to read from savedVideos collection
          const testDoc = doc(db, 'savedVideos', 'test');
          await getDoc(testDoc);
          console.log('✅ Firestore access successful');
          
        } catch (error) {
          console.log('❌ Firestore access failed:', error.code, error.message);
        }
      } else {
        console.log('❌ No user authenticated');
      }
      resolve();
    });
    
    // If no auth state change within 5 seconds, assume no user
    setTimeout(() => {
      console.log('⏰ Auth state check timeout - no user logged in');
      resolve();
    }, 5000);
  });
}

debugAuthAndPermissions().then(() => {
  console.log('🏁 Debug complete');
  process.exit(0);
});
