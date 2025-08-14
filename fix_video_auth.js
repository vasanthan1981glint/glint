// Direct Firebase fix using client SDK with authentication
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, signInWithEmailAndPassword, getAuth } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyDzSH6TzjGO3iXaKhtyN5Z3sQIePZPdYKI",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "1047203329925",
  appId: "1:1047203329925:web:86e33ecfc41e1b1f6b3d80"
};

// Use your actual user credentials
const EMAIL = 'glintchat2025@gmail.com';
const PASSWORD = 'Vasanthan@123'; // You'll need to provide this

async function fixVideoWithAuth() {
  console.log('🔐 FIXING VIDEO WITH AUTHENTICATED FIREBASE CLIENT');
  console.log('==================================================');
  
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    
    console.log('🔑 Signing in to Firebase...');
    await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
    console.log('✅ Authenticated successfully');
    
    // Fix the ready video
    const videoId = 'p9o54m91lTrxo4uPBangzt7vLrxTqvXSgTbydWKFt5g';
    const assetId = 'pBFWYlup01QYJjGIDTrucYbwQrgc3BILPYpoau5aix3E';
    const playbackId = 'C5PVakKHdB00cX01pjiiEsLhyCctgKxxDtaCC7gQfe2ys';
    const playbackUrl = `https://stream.mux.com/${playbackId}.m3u8`;
    const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
    
    console.log(`\\n🔧 Updating video: ${videoId}`);
    console.log(`🎬 Asset ID: ${assetId}`);
    console.log(`🎯 Playback ID: ${playbackId}`);
    
    const updates = {
      assetId: assetId,
      playbackId: playbackId,
      playbackUrl: playbackUrl,
      thumbnailUrl: thumbnailUrl,
      processed: true,
      status: 'ready',
      updatedAt: new Date().toISOString(),
      fixedAt: new Date().toISOString(),
      fixedBy: 'manual_auth_client'
    };
    
    console.log('💾 Applying updates...');
    await updateDoc(doc(db, 'videos', videoId), updates);
    
    console.log('✅ Video fixed successfully!');
    console.log(`🔗 Playback URL: ${playbackUrl}`);
    console.log(`📸 Thumbnail URL: ${thumbnailUrl}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    if (error.code === 'auth/wrong-password') {
      console.log('💡 Please provide the correct password for glintchat2025@gmail.com');
    } else if (error.code === 'auth/user-not-found') {
      console.log('💡 User not found. Please check the email address.');
    }
  }
}

fixVideoWithAuth();
