// Fix the broken video document in Firebase
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, deleteDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyDzSH6TzjGO3iXaKhtyN5Z3sQIePZPdYKI",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "1047203329925",
  appId: "1:1047203329925:web:86e33ecfc41e1b1f6b3d80"
};

async function fixBrokenVideo() {
  try {
    console.log('🔧 Fixing broken video document...');
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    const videoId = 'x02I643I007dZ6ur02NLVoR86u00qeErC49Br52RcQqg00Nc';
    const assetId = 'fiKE1dLJKPrh401q00QBzhTGYxmkagPm1E6iHp2zf9kCc';
    const playbackId = 'Vo02x94bKDP020102nA7AzwYmeuzsmOSBblpiU00IYVVBLkw';
    
    // Option 1: Update with playback ID (even though asset errored)
    console.log('📝 Option 1: Update document with playback ID...');
    try {
      await updateDoc(doc(db, 'videos', videoId), {
        assetId: assetId,
        playbackUrl: `https://stream.mux.com/${playbackId}.m3u8`,
        status: 'ready', // Mark as ready to see if it plays
        processed: true,
        playbackId: playbackId,
        updatedAt: new Date().toISOString()
      });
      console.log('✅ Document updated with playback ID');
    } catch (error) {
      console.error('❌ Failed to update document:', error);
    }
    
    // Option 2: If video is completely broken, delete it
    console.log('\n🗑️ Option 2: Delete broken document...');
    console.log('Uncomment the following lines if you want to delete the broken video:');
    console.log('// await deleteDoc(doc(db, "videos", videoId));');
    console.log('// console.log("✅ Broken document deleted");');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixBrokenVideo();
