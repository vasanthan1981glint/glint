/**
 * Migration script to move saved videos from the 'saves' collection to 'savedVideos' collection
 * This ensures consistency between the save functionality and the SavedVideosGrid
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, query, where } = require('firebase/firestore');

// Firebase config (you may need to update this with your actual config)
const firebaseConfig = {
  // Add your Firebase config here
  // This script should be run with admin credentials for migration
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateFromSavesToSavedVideos() {
  console.log('🔄 Starting migration from saves to savedVideos collection...');
  
  try {
    // Get all documents from the 'saves' collection
    const savesSnapshot = await getDocs(collection(db, 'saves'));
    
    let totalMigrated = 0;
    let totalErrors = 0;
    
    console.log(`📊 Found ${savesSnapshot.size} documents in saves collection`);
    
    for (const saveDoc of savesSnapshot.docs) {
      const saveData = saveDoc.data();
      const { userId, videoId, savedAt } = saveData;
      
      if (!userId || !videoId) {
        console.warn(`  ⚠️  Skipping invalid document ${saveDoc.id}: missing userId or videoId`);
        continue;
      }
      
      try {
        // Check if this save already exists in savedVideos collection
        const existingQuery = query(
          collection(db, 'savedVideos'),
          where('userId', '==', userId),
          where('videoId', '==', videoId)
        );
        const existingSnapshot = await getDocs(existingQuery);
        
        if (!existingSnapshot.empty) {
          console.log(`    ⏭️  Video ${videoId} already migrated for user ${userId}`);
          continue;
        }
        
        // Create new document in savedVideos collection
        const newSavedVideoData = {
          videoId,
          userId,
          savedAt: savedAt || new Date().toISOString(),
        };
        
        await setDoc(doc(collection(db, 'savedVideos')), newSavedVideoData);
        
        console.log(`    ✅ Migrated save: ${videoId} for user ${userId}`);
        totalMigrated++;
        
        // Optional: Delete the old document from saves collection
        // Uncomment the line below if you want to clean up the old saves collection
        // await deleteDoc(saveDoc.ref);
        
      } catch (error) {
        console.error(`    ❌ Error migrating save ${saveDoc.id}:`, error);
        totalErrors++;
      }
    }
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`📊 Total migrated: ${totalMigrated}`);
    console.log(`❌ Total errors: ${totalErrors}`);
    console.log(`📝 Note: Original saves collection is preserved. Delete manually if needed.`);
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  }
}

// Uncomment the line below to run the migration
// migrateFromSavesToSavedVideos();

console.log('📋 Migration script ready. Update Firebase config and uncomment the last line to run migration.');
console.log('⚠️  Make sure to backup your Firestore data before running!');
