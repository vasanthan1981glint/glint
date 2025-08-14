// Fix broken videos in Firebase by updating them with correct Mux data
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, getDocs, collection, query, where } = require('firebase/firestore');
const axios = require('axios');

const firebaseConfig = {
  apiKey: "AIzaSyDzSH6TzjGO3iXaKhtyN5Z3sQIePZPdYKI",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "1047203329925",
  appId: "1:1047203329925:web:86e33ecfc41e1b1f6b3d80"
};

const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID || 'YOUR_MUX_TOKEN_ID';
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET || 'YOUR_MUX_TOKEN_SECRET';

async function fixBrokenVideos() {
  console.log('🔧 FIXING BROKEN VIDEOS IN FIREBASE');
  console.log('==================================');
  
  try {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Get all videos with null assetId but valid uploadId
    const videosRef = collection(db, 'videos');
    const q = query(videosRef);
    const snapshot = await getDocs(q);
    
    const brokenVideos = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data.uploadId && !data.assetId && data.status === 'uploading';
    });
    
    console.log(`🎯 Found ${brokenVideos.length} broken videos to fix`);
    
    for (const videoDoc of brokenVideos) {
      const data = videoDoc.data();
      const uploadId = data.uploadId;
      
      console.log(`\n🔧 Fixing video: ${videoDoc.id}`);
      console.log(`   Upload ID: ${uploadId}`);
      
      try {
        // Check Mux upload status
        const uploadResponse = await axios.get(`https://api.mux.com/video/v1/uploads/${uploadId}`, {
          auth: {
            username: MUX_TOKEN_ID,
            password: MUX_TOKEN_SECRET
          }
        });
        
        const uploadData = uploadResponse.data.data;
        console.log(`   Upload Status: ${uploadData.status}`);
        
        if (uploadData.status === 'asset_created' && uploadData.asset_id) {
          const assetId = uploadData.asset_id;
          console.log(`   Asset ID: ${assetId}`);
          
          // Check asset status
          const assetResponse = await axios.get(`https://api.mux.com/video/v1/assets/${assetId}`, {
            auth: {
              username: MUX_TOKEN_ID,
              password: MUX_TOKEN_SECRET
            }
          });
          
          const asset = assetResponse.data.data;
          console.log(`   Asset Status: ${asset.status}`);
          
          if (asset.status === 'ready' && asset.playback_ids && asset.playback_ids.length > 0) {
            const publicPlaybackId = asset.playback_ids.find(p => p.policy === 'public');
            
            if (publicPlaybackId) {
              const playbackId = publicPlaybackId.id;
              const playbackUrl = `https://stream.mux.com/${playbackId}.m3u8`;
              const thumbnailUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
              
              console.log(`   Playback ID: ${playbackId}`);
              console.log(`   Updating Firebase document...`);
              
              // Update Firebase document
              await updateDoc(doc(db, 'videos', videoDoc.id), {
                assetId: assetId,
                playbackId: playbackId,
                playbackUrl: playbackUrl,
                thumbnailUrl: thumbnailUrl,
                processed: true,
                status: 'ready',
                updatedAt: new Date().toISOString(),
                fixedAt: new Date().toISOString(),
                fixedBy: 'manual_script'
              });
              
              console.log(`   ✅ Video fixed successfully!`);
              console.log(`   🔗 Playback URL: ${playbackUrl}`);
              
            } else {
              console.log(`   ❌ No public playback ID found`);
            }
          } else {
            console.log(`   ⏳ Asset not ready yet (status: ${asset.status})`);
          }
        } else {
          console.log(`   ⏳ Upload not complete yet (status: ${uploadData.status})`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error fixing video ${uploadId}:`, error.response?.data || error.message);
      }
    }
    
    console.log('\n🎉 Finished fixing videos!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixBrokenVideos();
