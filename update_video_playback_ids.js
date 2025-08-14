const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB-1kOlBAmwIJu6Uf7ZCepA9IWX4w0P6J8",
  authDomain: "glint-a325f.firebaseapp.com",
  projectId: "glint-a325f",
  storageBucket: "glint-a325f.appspot.com",
  messagingSenderId: "1089006225",
  appId: "1:1089006225:web:a5edfcb8e1e2c3d4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Asset ID to Playback ID mapping from our script
const assetToPlaybackMapping = {
  'JbJFNqmoj4hRA3vztqWywBqnBAJPRRdrgJ2oGiQpQHg': 'noJ4jPEfxN41g01c00BwG5Reh6pddQ1d001OIvLHY5CSPk',
  'Qp01gq5IymxDYbIkKDvKl23UbQgtx9xh9LbpYz4fuAuU': 'ZbwmKdOdbQBCQD4eHKz91JT9pYoSpz9POXbQrCczJ8A',
  'bXML1S9tBCVfh3Z9vDp001DYP02rrTA60125ZIN2dAbUZI': 'Hemuo7gv51YwW101IWHIlmlB81UlvYwEDc31soOuy901A',
  '1AXB9N43Kk023BiH7hWQp7ifpkgka6WHqJ5sUZLTwys8': 'sRethC01iEZb39lgqgDTmWkm4gSaVIb02OHr2p1iGRZQ00',
  'YPJOk6GOw9TkMuQlMZlS01XCI00U3ybSPuetL18duF1qU': 'M00IoeajRIzR8yUjQq2ZjYpUAYjh4aFZqYQqMADrQbKo',
  'Kc48B4IR02M01cKytTBwhUY26XMYD9ecSEsr02KFVWPURs': 'gsnsIMhOuJGjD0002gUwpZ5xP6QOZ5N02DWeUTz3Jy6R8g',
  'XNQxOHk01ICC02PU6Ce8tRkyziVl9RAagf01x5mBmXc0102o': 'rBO18DerHyv72EEaG01l9tScBQLzMKoAAwOyA8mtVjcw',
  'pBFWYlup01QYJjGIDTrucYbwQrgc3BILPYpoau5aix3E': 'SWOBAP1pNW3hWargzYP01b8dnmGJ6jrDLks9uR00CTXvI',
  'h53kMVYT4TUi6A6Fnt4u5VjIQUJPULna3myYKIdQk7A': 'cxZOwlZOS7DaD4sSonouE94zJaDJuD485Gxotb5p9Ys'
};

async function updateVideoPlaybackIds() {
  try {
    console.log('🔄 Updating video documents with Playback IDs...\n');
    
    const videosRef = collection(db, 'videos');
    const querySnapshot = await getDocs(videosRef);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const docId = docSnap.id;
      
      if (data.assetId && assetToPlaybackMapping[data.assetId]) {
        const playbackId = assetToPlaybackMapping[data.assetId];
        const streamUrl = `https://stream.mux.com/${playbackId}.m3u8`;
        
        console.log(`📝 Updating document ${docId}:`);
        console.log(`   Asset ID: ${data.assetId}`);
        console.log(`   Playback ID: ${playbackId}`);
        console.log(`   Stream URL: ${streamUrl}`);
        
        // Update the document with playback ID and proper stream URL
        await updateDoc(doc(db, 'videos', docId), {
          playbackId: playbackId,
          streamUrl: streamUrl,
          muxPlaybackId: playbackId, // Alternative field name if needed
          videoUrl: streamUrl, // Update videoUrl to use playback ID instead of asset ID
          updatedAt: new Date().toISOString()
        });
        
        console.log(`✅ Updated document ${docId}\n`);
        updatedCount++;
      } else {
        console.log(`⏭️  Skipping document ${docId} - no matching asset ID found`);
        skippedCount++;
      }
    }
    
    console.log('\n📊 UPDATE SUMMARY:');
    console.log(`✅ Updated: ${updatedCount} documents`);
    console.log(`⏭️  Skipped: ${skippedCount} documents`);
    console.log('\n🎉 Video documents updated with Playback IDs!');
    console.log('Your videos should now stream properly in the app.');
    
  } catch (error) {
    console.error('❌ Error updating video documents:', error);
  }
}

updateVideoPlaybackIds();
