/**
 * Test Video Creation - Creates a test video in Firebase to verify the upload flow
 */

import { initializeApp } from 'firebase/app';
import { doc, getFirestore, setDoc } from 'firebase/firestore';

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

async function createTestVideo() {
  console.log('🧪 Creating test video to verify Firebase saves...');
  
  try {
    const testVideoDoc = {
      userId: 'LH7vqrLArUehluK4etp0IbcpiJX2',
      assetId: 'test_video_manual_' + Date.now(),
      playbackUrl: 'https://stream.mux.com/test/video.m3u8',
      thumbnailUrl: 'https://image.mux.com/test/thumbnail.jpg',
      thumbnailType: 'auto',
      createdAt: new Date().toISOString(),
      username: 'vasanthan',
      caption: '🧪 Test Video - Manual Creation',
      views: 0,
      likes: 0,
      processed: true,
      status: 'ready',
      uploadMethod: 'manual_test',
      isRealVideo: false, // This is a test video
      hasCustomThumbnail: false
    };

    console.log('📝 Test video document:', testVideoDoc);
    
    await setDoc(doc(db, 'videos', testVideoDoc.assetId), testVideoDoc);
    console.log('✅ Test video created successfully!');
    console.log('🎯 Asset ID:', testVideoDoc.assetId);
    console.log('👀 Check the app now to see if the test video appears');
    
  } catch (error) {
    console.error('❌ Failed to create test video:', error);
  }
}

createTestVideo();
