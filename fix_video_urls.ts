/**
 * Script to fix existing video URLs in Firebase that use the wrong format
 * Changes .mp4 to .m3u8 for proper Mux HLS streaming
 */

import { initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, updateDoc } from 'firebase/firestore';

// Initialize Firebase (you may need to adjust this config)
const firebaseConfig = {
  // Add your Firebase config here
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixVideoUrls() {
  console.log('🔄 Scanning for videos with incorrect URL format...');
  
  try {
    const postsCollection = collection(db, 'posts');
    const snapshot = await getDocs(postsCollection);
    
    let updatedCount = 0;
    let totalVideos = 0;
    
    for (const document of snapshot.docs) {
      const data = document.data();
      totalVideos++;
      
      if (data.playbackUrl && data.playbackUrl.includes('.mp4')) {
        const oldUrl = data.playbackUrl;
        const newUrl = oldUrl.replace('.mp4', '.m3u8');
        
        console.log(`🔧 Updating video ${document.id}:`);
        console.log(`  Old: ${oldUrl}`);
        console.log(`  New: ${newUrl}`);
        
        await updateDoc(doc(db, 'posts', document.id), {
          playbackUrl: newUrl,
          urlFormatFixed: true,
          updatedAt: new Date().toISOString()
        });
        
        updatedCount++;
      }
    }
    
    console.log('');
    console.log('✅ URL format fix complete!');
    console.log(`📊 Processed ${totalVideos} videos`);
    console.log(`🔧 Updated ${updatedCount} videos with new URL format`);
    console.log(`✨ ${totalVideos - updatedCount} videos already had correct format`);
    
  } catch (error) {
    console.error('❌ Error fixing video URLs:', error);
  }
}

// Uncomment to run (make sure Firebase config is set)
// fixVideoUrls();

export { fixVideoUrls };
