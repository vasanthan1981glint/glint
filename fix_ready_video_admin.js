// Fix the ready video using Firebase Admin SDK
const admin = require('firebase-admin');

// Initialize Firebase Admin (you may need to set up service account)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: 'glint-7e3c3',
      // For production, you'd use proper service account keys here
    }),
  });
}

const db = admin.firestore();

async function fixReadyVideo() {
  console.log('🔧 FIXING THE READY VIDEO');
  console.log('=========================');
  
  try {
    const videoId = 'p9o54m91lTrxo4uPBangzt7vLrxTqvXSgTbydWKFt5g';
    const assetId = 'pBFWYlup01QYJjGIDTrucYbwQrgc3BILPYpoau5aix3E';
    const playbackId = 'C5PVakKHdB00cX01pjiiEsLhyCctgKxxDtaCC7gQfe2ys';
    const playbackUrl = `https://stream.mux.com/${playbackId}.m3u8`;
    const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
    
    console.log(`📹 Updating video: ${videoId}`);
    console.log(`🎬 Asset ID: ${assetId}`);
    console.log(`🎯 Playback ID: ${playbackId}`);
    
    const updates = {
      assetId: assetId,
      playbackId: playbackId,
      playbackUrl: playbackUrl,
      thumbnailUrl: thumbnailUrl,
      processed: true,
      status: 'ready',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      fixedAt: admin.firestore.FieldValue.serverTimestamp(),
      fixedBy: 'manual_admin_script'
    };
    
    await db.collection('videos').doc(videoId).update(updates);
    
    console.log('✅ Video fixed successfully!');
    console.log(`🔗 Playback URL: ${playbackUrl}`);
    console.log(`📸 Thumbnail URL: ${thumbnailUrl}`);
    
    // Verify the update
    const updatedDoc = await db.collection('videos').doc(videoId).get();
    if (updatedDoc.exists) {
      const data = updatedDoc.data();
      console.log('\\n🔍 VERIFICATION:');
      console.log(`   Asset ID: ${data.assetId}`);
      console.log(`   Playback ID: ${data.playbackId}`);
      console.log(`   Status: ${data.status}`);
      console.log(`   Processed: ${data.processed}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixReadyVideo();
