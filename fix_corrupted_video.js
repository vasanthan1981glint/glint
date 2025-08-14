// Fix the corrupted video entry with correct Mux Asset ID and Playback ID
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDzSH6TzjGO3iXaKhtyN5Z3sQIePZPdYKI",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "1047203329925",
  appId: "1:1047203329925:web:86e33ecfc41e1b1f6b3d80"
};

async function fixCorruptedVideo() {
  try {
    console.log('🔧 Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    const problemVideoId = 'gihGTEIlfKfx2Dv2z01ySYOsj4eFjYRkIqAyBODSqQG00';
    const correctAssetId = '1faLfaSYxBOujFwurNMQE2evYDah01rSKU9GOkaBfCvI';
    const correctPlaybackId = 'xiKDgbmHtRkeQtDSsS5LUIKNDtjswEDS2kZMc1Amj00o';
    const correctPlaybackUrl = `https://stream.mux.com/${correctPlaybackId}.m3u8`;
    
    console.log('📄 Getting current video document...');
    const videoRef = doc(db, 'videos', problemVideoId);
    const videoSnap = await getDoc(videoRef);
    
    if (!videoSnap.exists()) {
      console.log('❌ Video document not found');
      return;
    }
    
    const currentData = videoSnap.data();
    console.log('📊 Current video data:');
    console.log('   Asset ID:', currentData.assetId);
    console.log('   Playback URL:', currentData.playbackUrl);
    console.log('   Status:', currentData.status);
    
    console.log('');
    console.log('🔧 Applying fixes...');
    
    const updates = {
      assetId: correctAssetId,
      playbackUrl: correctPlaybackUrl,
      status: 'ready',
      processed: true,
      lastUpdated: new Date().toISOString(),
      fixApplied: true,
      fixReason: 'Corrected Asset ID and Playback URL from Mux dashboard'
    };
    
    await updateDoc(videoRef, updates);
    
    console.log('✅ Video document updated successfully!');
    console.log('📊 New video data:');
    console.log('   Asset ID:', correctAssetId);
    console.log('   Playback URL:', correctPlaybackUrl);
    console.log('   Status: ready');
    
    console.log('');
    console.log('🎉 The video should now play correctly!');
    console.log('💡 Note: The video has upload errors in Mux ("invalid input file")');
    console.log('💡 You may need to re-upload this video with a valid video file');
    
  } catch (error) {
    console.error('❌ Error fixing video:', error);
  }
}

fixCorruptedVideo();
