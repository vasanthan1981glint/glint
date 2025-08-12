/**
 * Test script to check what videos exist in Firebase for the current user
 */

import { initializeApp } from 'firebase/app';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';

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

async function checkUserVideos() {
  console.log('🔍 Checking Firebase videos for user: LH7vqrLArUehluK4etp0IbcpiJX2');
  
  try {
    // Query videos for the current user
    const videosRef = collection(db, 'videos');
    const q = query(videosRef, where('userId', '==', 'LH7vqrLArUehluK4etp0IbcpiJX2'));
    
    const querySnapshot = await getDocs(q);
    
    console.log(`📊 Found ${querySnapshot.size} videos in Firebase`);
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log('📹 Video:', {
        id: doc.id,
        assetId: data.assetId,
        caption: data.caption,
        createdAt: data.createdAt,
        uploadMethod: data.uploadMethod,
        processed: data.processed,
        thumbnailUrl: data.thumbnailUrl?.substring(0, 50) + '...',
        playbackUrl: data.playbackUrl?.substring(0, 50) + '...'
      });
    });
    
    if (querySnapshot.empty) {
      console.log('❌ No videos found for this user in Firebase');
      console.log('💡 This confirms the issue - uploads are not saving to Firebase');
    }
    
  } catch (error) {
    console.error('❌ Error querying Firebase:', error);
  }
}

checkUserVideos();
