/**
 * Clean up broken video documents in Firestore
 * Removes Firebase documents that were never uploaded to cloud storage
 * (those with uploadId that looks like a document ID rather than a real upload ID)
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, deleteDoc } = require('firebase/firestore');

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

async function cleanupBrokenVideos() {
  console.log('🧹 CLEANING UP BROKEN VIDEO DOCUMENTS');
  console.log('=====================================\n');
  
  try {
    // Target specific broken documents by their document IDs
    const brokenDocumentIds = [
      '0000shGwlGGExBZBmv02zS98lqLgG8lFlCy4xvM014ulq00w',
      '4rbZm008GHkwzAR02v9XcaeOzRmhdFU02NUOw6Ak1uh9zw',
      '6Eggss9hegcMFRGu9V6irqcGi5vybICVw5e446fmVUQ',
      '85fRsd8OOzIqmxq9GihhT01j01JH1E7ecFZRhz9xvVOpI',
      'AwfEq4npcjEI3utriasYkwdXH5PnERC2UcH00H8xu3jI',
      'MNozvzaKWg01s39pKedTNoxUyf3902gsl02w00pp3bx00tYI',
      'N31202ZV00S00boKlTMgKm01ahMJWZVim8qvlmEPzTyiD800',
      'UheulWLvE01gilXjO8cZcR00NOgHqR2dH7UCALjoOGPKg',
      'aazQ7YTbQFr4m10137HRaLjPkrdekMIBpYtdNmT0138V8',
      'n00HKO601jkREGo015kzwKT4Wvudc1LfPJxsdVQjrHo4FU',
      'p9o54m91lTrxo4uPBangzt7vLrxTqvXSgTbydWKFt5g',
      'waAm2egPO8mISHucbQQNyqK1BjPSlcRhJnlzfsqA2Lk',
      'x02I643I007dZ6ur02NLVoR86u00qeErC49Br52RcQqg00Nc',
      'yxoIk1GK4XC5Kefs01uinTNxyhiAyAxeG9lvGEM2pJQE'
    ];
    
    // Get all videos from posts collection
    const videosSnapshot = await getDocs(collection(db, 'posts'));
    
    // Filter to videos with broken document IDs and no valid asset
    const brokenVideos = [];
    videosSnapshot.forEach(docSnapshot => {
      const data = docSnapshot.data();
      if (brokenDocumentIds.includes(docSnapshot.id) && !data.assetId) {
        brokenVideos.push({ 
          id: docSnapshot.id, 
          data, 
          uploadId: data.uploadId,
          status: data.status,
          createdAt: data.createdAt
        });
      }
    });
    
    console.log(`📋 Found ${brokenVideos.length} broken videos to clean up\n`);
    
    if (brokenVideos.length === 0) {
      console.log('✅ No broken videos found to clean up.');
      return;
    }
    
    // Show what we're going to delete
    console.log('🗑️ Videos to be deleted:');
    brokenVideos.forEach((video, index) => {
      console.log(`   ${index + 1}. Document: ${video.id}`);
      console.log(`      Upload ID: ${video.uploadId}`);
      console.log(`      Status: ${video.status}`);
      console.log(`      Created: ${video.createdAt ? (video.createdAt.seconds ? new Date(video.createdAt.seconds * 1000).toISOString() : video.createdAt.toString()) : 'Unknown'}`);
      console.log('');
    });
    
    // Ask for confirmation (in production, you might want a prompt here)
    console.log('⚠️  This will permanently delete these video documents.');
    console.log('💡 These videos were never successfully uploaded to cloud storage and are just empty placeholders.\n');
    
    let deleteCount = 0;
    let errorCount = 0;
    
    for (const video of brokenVideos) {
      try {
        console.log(`🗑️ Deleting document: ${video.id}`);
        await deleteDoc(doc(db, 'posts', video.id));
        console.log(`   ✅ Deleted successfully`);
        deleteCount++;
      } catch (error) {
        console.error(`   ❌ Error deleting ${video.id}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n=====================================');
    console.log('📊 CLEANUP RESULTS:');
    console.log(`   🗑️ Successfully deleted: ${deleteCount}`);
    console.log(`   ❌ Errors encountered: ${errorCount}`);
    console.log(`   📋 Total processed: ${deleteCount + errorCount}`);
    console.log('=====================================');
    
    if (deleteCount > 0) {
      console.log('\n🎉 Cleanup complete! Your profile should now be clean.');
      console.log('🔄 Refresh your app to see the updated profile.');
      console.log('📱 You can now upload new videos properly.');
    }
    
  } catch (error) {
    console.error('❌ Error in cleanup process:', error);
  } finally {
    process.exit(0);
  }
}

// Run the cleanup
cleanupBrokenVideos();
