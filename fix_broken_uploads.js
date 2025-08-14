/**
 * Fix Broken Upload Documents
 * Updates Firebase documents that have uploadId but missing assetId
 * by checking Mux status and updating with correct asset information
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, doc, updateDoc, serverTimestamp } = require('firebase/firestore');
const Mux = require('@mux/mux-node');

const firebaseConfig = {
  apiKey: "AIzaSyDzSH6TzjGO3iXaKhtyN5Z3sQIePZPdYKI",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "1047203329925",
  appId: "1:1047203329925:web:86e33ecfc41e1b1f6b3d80"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize Mux
const { video: muxVideo } = new Mux(
  process.env.MUX_TOKEN_ID || 'YOUR_MUX_TOKEN_ID',
  process.env.MUX_TOKEN_SECRET || 'YOUR_MUX_TOKEN_SECRET'
);

async function fixBrokenUploads() {
  console.log('🔧 FIXING BROKEN UPLOAD DOCUMENTS');
  console.log('=====================================\n');
  
  try {
    // Target specific broken uploads from the debug output
    const targetUploadIds = [
      'p9o54m91lTrxo4uPBangzt7vLrxTqvXSgTbydWKFt5g',
      'waAm2egPO8mISHucbQQNyqK1BjPSlcRhJnlzfsqA2Lk',
      'n00HKO601jkREGo015kzwKT4Wvudc1LfPJxsdVQjrHo4FU',
      'aazQ7YTbQFr4m10137HRaLjPkrdekMIBpYtdNmT0138V8',
      'yxoIk1GK4XC5Kefs01uinTNxyhiAyAxeG9lvGEM2pJQE',
      '6Eggss9hegcMFRGu9V6irqcGi5vybICVw5e446fmVUQ',
      'AwfEq4npcjEI3utriasYkwdXH5PnERC2UcH00H8xu3jI',
      'x02I643I007dZ6ur02NLVoR86u00qeErC49Br52RcQqg00Nc',
      'UheulWLvE01gilXjO8cZcR00NOgHqR2dH7UCALjoOGPKg',
      'N31202ZV00S00boKlTMgKm01ahMJWZVim8qvlmEPzTyiD800',
      'MNozvzaKWg01s39pKedTNoxUyf3902gsl02w00pp3bx00tYI',
      '85fRsd8OOzIqmxq9GihhT01j01JH1E7ecFZRhz9xvVOpI',
      '4rbZm008GHkwzAR02v9XcaeOzRmhdFU02NUOw6Ak1uh9zw',
      '0000shGwlGGExBZBmv02zS98lqLgG8lFlCy4xvM014ulq00w'
    ];
    
    // Get all videos from posts collection - we'll filter client-side since Firebase web SDK has limitations
    const videosSnapshot = await getDocs(collection(db, 'posts'));
    
    // Filter to videos with uploadId that match our target list
    const brokenVideos = [];
    videosSnapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      if (data.uploadId && targetUploadIds.includes(data.uploadId) && !data.assetId) {
        brokenVideos.push({ id: docSnapshot.id, data, ref: docSnapshot.ref });
      }
    });
    
    console.log(`📋 Found ${brokenVideos.length} videos to fix\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const video of brokenVideos) {
      const docId = video.id;
      const data = video.data;
      const uploadId = data.uploadId;
      
      console.log(`📤 Processing upload: ${uploadId}`);
      console.log(`   Document ID: ${docId}`);
      
      try {
        // Check upload status in Mux
        const uploadResponse = await muxVideo.uploads.retrieve(uploadId);
        const uploadData = uploadResponse.data;
        
        console.log(`   Upload status: ${uploadData.status}`);
        
        if (uploadData.status === 'asset_created' && uploadData.asset_id) {
          // Upload was converted to asset, get asset details
          const assetId = uploadData.asset_id;
          console.log(`   Asset ID: ${assetId}`);
          
          const assetResponse = await muxVideo.assets.retrieve(assetId);
          const assetData = assetResponse.data;
          
          console.log(`   Asset status: ${assetData.status}`);
          
          if (assetData.status === 'ready' && assetData.playback_ids && assetData.playback_ids.length > 0) {
            // Asset is ready, get playback information
            const playbackId = assetData.playback_ids[0].id;
            const playbackUrl = `https://stream.mux.com/${playbackId}.m3u8`;
            const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
            
            console.log(`   Playback ID: ${playbackId}`);
            console.log(`   Duration: ${assetData.duration} seconds`);
            
            // Update Firebase document
            const updateData = {
              assetId: assetId,
              playbackId: playbackId,
              playbackUrl: playbackUrl,
              thumbnailUrl: thumbnailUrl,
              thumbnailType: 'mux-auto',
              duration: assetData.duration,
              status: 'ready',
              processed: true,
              processing: false,
              fixedAt: serverTimestamp(),
              fixedBy: 'fix_broken_uploads_script'
            };
            
            await updateDoc(doc(db, 'posts', docId), updateData);
            
            console.log(`   ✅ Fixed video document ${docId}`);
            console.log(`   🔗 Playback URL: ${playbackUrl}`);
            console.log(`   📸 Thumbnail URL: ${thumbnailUrl}\n`);
            
            successCount++;
            
          } else if (assetData.status === 'preparing') {
            console.log(`   ⏳ Asset still preparing, updating status only`);
            
            await updateDoc(doc(db, 'posts', docId), {
              assetId: assetId,
              status: 'processing',
              processed: false,
              processing: true,
              updatedAt: serverTimestamp()
            });
            
            console.log(`   🔄 Updated to processing status\n`);
            successCount++;
            
          } else {
            console.log(`   ⚠️ Asset not ready yet: ${assetData.status}\n`);
          }
          
        } else if (uploadData.status === 'waiting') {
          console.log(`   ⏳ Upload still waiting for file\n`);
          
        } else if (uploadData.status === 'errored') {
          console.log(`   ❌ Upload failed: ${uploadData.error?.type || 'Unknown error'}`);
          
          await updateDoc(doc(db, 'posts', docId), {
            status: 'error',
            error: uploadData.error || { type: 'upload_failed' },
            processed: false,
            processing: false,
            erroredAt: serverTimestamp()
          });
          
          console.log(`   🔄 Updated to error status\n`);
          errorCount++;
          
        } else {
          console.log(`   ⚠️ Unknown upload status: ${uploadData.status}\n`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error processing upload ${uploadId}:`, error.message);
        
        if (error.message.includes('not found')) {
          console.log(`   🗑️ Upload not found in Mux, marking as error`);
          
          await updateDoc(doc(db, 'posts', docId), {
            status: 'error',
            error: { type: 'upload_not_found', message: 'Upload not found in Mux' },
            processed: false,
            processing: false,
            erroredAt: serverTimestamp()
          });
          
          errorCount++;
        }
        
        console.log('');
      }
    }
    
    console.log('=====================================');
    console.log('📊 FIXING RESULTS:');
    console.log(`   ✅ Successfully fixed: ${successCount}`);
    console.log(`   ❌ Errors encountered: ${errorCount}`);
    console.log(`   📋 Total processed: ${successCount + errorCount}`);
    console.log('=====================================');
    
    if (successCount > 0) {
      console.log('\n🎉 Videos fixed! They should now appear in your profile.');
      console.log('🔄 Refresh your app to see the updated videos.');
    }
    
  } catch (error) {
    console.error('❌ Error in fix process:', error);
  } finally {
    process.exit(0);
  }
}

// Run the fix
fixBrokenUploads();
