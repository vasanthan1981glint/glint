// Video URL Migration Script
// This script updates existing videos to use HLS (.m3u8) URLs instead of MP4 URLs

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: 'glint-7e3c3',
      // Note: In production, use proper service account credentials
    }),
  });
}

const db = admin.firestore();

async function migrateVideoUrls() {
  console.log('🔄 Starting video URL migration...');
  
  try {
    // Get all videos
    const videosSnapshot = await db.collection('videos').get();
    console.log(`📹 Found ${videosSnapshot.size} videos to check`);
    
    let migratedCount = 0;
    const batch = db.batch();
    
    for (const doc of videosSnapshot.docs) {
      const video = doc.data();
      const assetId = video.assetId || doc.id;
      
      // Check if the playbackUrl uses old MP4 format
      if (video.playbackUrl && video.playbackUrl.includes('.mp4')) {
        console.log(`🔧 Migrating video ${assetId}: ${video.playbackUrl}`);
        
        // Convert MP4 URL to HLS URL
        const newUrl = video.playbackUrl.replace('.mp4', '.m3u8');
        
        // Update the document
        batch.update(doc.ref, {
          playbackUrl: newUrl,
          migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          urlFormat: 'hls'
        });
        
        console.log(`✅ ${assetId}: ${video.playbackUrl} → ${newUrl}`);
        migratedCount++;
      } else if (video.playbackUrl && video.playbackUrl.includes('.m3u8')) {
        console.log(`✅ Video ${assetId} already uses HLS format`);
      } else {
        console.log(`⚠️ Video ${assetId} has unknown URL format: ${video.playbackUrl}`);
      }
    }
    
    if (migratedCount > 0) {
      console.log(`🚀 Committing ${migratedCount} URL migrations...`);
      await batch.commit();
      console.log(`✅ Successfully migrated ${migratedCount} videos to HLS format`);
    } else {
      console.log('✅ No videos needed migration');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Also create a function to fix a specific video
async function fixSpecificVideo(assetId) {
  console.log(`🎯 Fixing specific video: ${assetId}`);
  
  try {
    const videoRef = db.collection('videos').doc(assetId);
    const doc = await videoRef.get();
    
    if (!doc.exists) {
      console.log(`❌ Video ${assetId} not found`);
      return;
    }
    
    const video = doc.data();
    
    if (video.playbackUrl && video.playbackUrl.includes('.mp4')) {
      const newUrl = video.playbackUrl.replace('.mp4', '.m3u8');
      
      await videoRef.update({
        playbackUrl: newUrl,
        fixedAt: admin.firestore.FieldValue.serverTimestamp(),
        urlFormat: 'hls'
      });
      
      console.log(`✅ Fixed ${assetId}:`);
      console.log(`   Old: ${video.playbackUrl}`);
      console.log(`   New: ${newUrl}`);
    } else {
      console.log(`✅ Video ${assetId} already uses correct format: ${video.playbackUrl}`);
    }
    
  } catch (error) {
    console.error(`❌ Failed to fix video ${assetId}:`, error);
  }
}

// Check command line arguments
const args = process.argv.slice(2);

if (args.length > 0 && args[0] === 'fix') {
  if (args[1]) {
    // Fix specific video
    fixSpecificVideo(args[1]).then(() => process.exit(0));
  } else {
    console.log('Usage: node migrate_video_urls.js fix <assetId>');
    process.exit(1);
  }
} else {
  // Migrate all videos
  migrateVideoUrls().then(() => process.exit(0));
}
