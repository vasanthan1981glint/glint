// Quick test upload function to bypass background service
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export const testDirectUpload = async () => {
  try {
    console.log('🧪 DIRECT UPLOAD TEST: Starting...');
    
    // Check authentication
    const user = auth.currentUser;
    if (!user) {
      console.error('❌ No authenticated user');
      return false;
    }
    
    console.log('✅ User authenticated:', user.uid);
    
    // Create test video document
    const testVideoId = `direct_test_${Date.now()}`;
    const videoDoc = {
      userId: user.uid,
      assetId: testVideoId,
      playbackUrl: 'https://test.com/video.mp4',
      thumbnailUrl: 'https://test.com/thumbnail.jpg',
      caption: 'Direct upload test video',
      createdAt: new Date().toISOString(),
      username: 'test_user',
      views: 0,
      likes: 0,
      processed: true,
      status: 'ready',
      isRealVideo: false,
      testUpload: true
    };
    
    console.log('💾 Saving directly to Firebase...');
    await setDoc(doc(db, 'videos', testVideoId), videoDoc);
    console.log('✅ Direct save successful!');
    
    return true;
    
  } catch (error) {
    console.error('❌ Direct upload test failed:', error);
    return false;
  }
};
