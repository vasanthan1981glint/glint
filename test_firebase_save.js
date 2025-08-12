/**
 * Test script to simulate a background upload and check Firebase saving
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBSC2e8BW6g2oe7QDCBC3KN8OKOVsb_VYU",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "491825493848",
  appId: "1:491825493848:web:50a58c8c99ed7e77b39dd0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function testFirebaseVideoSave() {
  console.log('🔍 Testing Firebase video save capability...');
  
  try {
    // Test creating a video document directly
    const testVideoDoc = {
      userId: 'LH7vqrLArUehluK4etp0IbcpiJX2',
      assetId: 'test_video_' + Date.now(),
      playbackUrl: 'https://test.com/video.mp4',
      thumbnailUrl: 'https://test.com/thumbnail.jpg',
      createdAt: new Date().toISOString(),
      username: 'vasanthan',
      caption: 'Test video upload',
      views: 0,
      likes: 0,
      processed: true,
      status: 'ready',
      uploadMethod: 'test',
      isRealVideo: false // Mark as test
    };

    console.log('📤 Attempting to save test video to Firebase...');
    
    await setDoc(doc(db, 'videos', testVideoDoc.assetId), testVideoDoc);
    console.log('✅ Test video document saved successfully');
    
    // Verify it was saved
    const savedDoc = await getDoc(doc(db, 'videos', testVideoDoc.assetId));
    if (savedDoc.exists()) {
      console.log('🔍 VERIFICATION: Test video document confirmed in Firebase:', savedDoc.data());
      console.log('✅ Firebase write permissions are working correctly');
      
      // Clean up test document
      console.log('🧹 Cleaning up test document...');
      await setDoc(doc(db, 'videos', testVideoDoc.assetId), { deleted: true, ...testVideoDoc });
      console.log('✅ Test cleanup completed');
      
    } else {
      console.error('❌ VERIFICATION: Test video document NOT found in Firebase after save!');
    }
    
  } catch (error) {
    console.error('❌ Firebase test failed:', error);
    
    if (error.code === 'permission-denied') {
      console.error('🚫 PERMISSION DENIED: Check Firebase security rules');
    } else if (error.code === 'unauthenticated') {
      console.error('🔐 AUTHENTICATION ERROR: User not authenticated');
    }
  }
}

testFirebaseVideoSave();
