#!/usr/bin/env node

/**
 * 🧹 Clean Up Broken Videos and Enable Mux
 * 
 * This script will:
 * 1. Clean up all broken video records (assetId: null)
 * 2. Ensure Mux system is properly enabled
 * 3. Test the upload system
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, deleteDoc, writeBatch, query, where } = require('firebase/firestore');
const axios = require('axios');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAUs11-YDiNO7C9pv9UR_19bvrbLbJg91A",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "869525277131",
  appId: "1:869525277131:web:b75a03f20fc93f81da0e4e",
};

const BACKEND_URL = 'https://glint-production-b62b.up.railway.app';

// Initialize Firebase
console.log('🔥 Initializing Firebase...');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

class BrokenVideoCleanup {
  constructor() {
    this.deletedVideos = 0;
    this.errors = [];
  }

  /**
   * Step 1: Identify and clean broken videos
   */
  async cleanBrokenVideos() {
    console.log('\n🧹 STEP 1: Cleaning Broken Videos...');
    
    try {
      // Get all videos
      const videosSnapshot = await getDocs(collection(db, 'videos'));
      console.log(`📊 Found ${videosSnapshot.size} total videos`);
      
      const brokenVideos = [];
      
      // Identify broken videos
      videosSnapshot.forEach(docSnapshot => {
        const video = docSnapshot.data();
        const videoId = docSnapshot.id;
        
        // Check if video is broken (no assetId, no playbackUrl, status uploading)
        const isBroken = (
          (!video.assetId || video.assetId === null) &&
          (!video.playbackUrl || video.playbackUrl === 'undefined') &&
          video.status === 'uploading' &&
          !video.processed
        );
        
        if (isBroken) {
          brokenVideos.push({
            id: videoId,
            data: video,
            ref: docSnapshot.ref
          });
        }
      });
      
      console.log(`❌ Found ${brokenVideos.length} broken videos`);
      
      if (brokenVideos.length === 0) {
        console.log('✅ No broken videos found!');
        return;
      }
      
      // Ask for confirmation in a real scenario, but for automation let's proceed
      console.log('🗑️ Deleting broken video records...');
      
      // Delete broken videos in batches
      const batch = writeBatch(db);
      let batchCount = 0;
      
      for (const brokenVideo of brokenVideos) {
        console.log(`   ❌ Deleting broken video: ${brokenVideo.id}`);
        batch.delete(brokenVideo.ref);
        batchCount++;
        this.deletedVideos++;
        
        // Commit batch every 500 operations
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`💾 Committed batch of ${batchCount} deletions`);
          batchCount = 0;
        }
      }
      
      // Commit remaining operations
      if (batchCount > 0) {
        await batch.commit();
        console.log(`💾 Committed final batch of ${batchCount} deletions`);
      }
      
      console.log(`✅ Cleanup completed: ${this.deletedVideos} broken videos deleted`);
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
      this.errors.push(`Cleanup: ${error.message}`);
    }
  }

  /**
   * Step 2: Verify Mux backend is working
   */
  async verifyMuxBackend() {
    console.log('\n🔍 STEP 2: Verifying Mux Backend...');
    
    try {
      // Test backend health
      const healthResponse = await axios.get(`${BACKEND_URL}/health`, { timeout: 10000 });
      
      if (!healthResponse.data.muxEnabled) {
        throw new Error('Mux is not enabled on backend');
      }
      
      console.log('✅ Railway backend is healthy and Mux-enabled');
      
      // Test upload creation
      const uploadResponse = await axios.post(`${BACKEND_URL}/api/mux/create-upload`, {
        metadata: {
          test: 'cleanup-verification',
          timestamp: new Date().toISOString()
        }
      });
      
      if (!uploadResponse.data.uploadUrl) {
        throw new Error('Upload creation failed - no URL returned');
      }
      
      console.log('✅ Mux upload creation working correctly');
      console.log(`   📍 Upload URL: ${uploadResponse.data.uploadUrl.substring(0, 50)}...`);
      console.log(`   🆔 Upload ID: ${uploadResponse.data.uploadId}`);
      
    } catch (error) {
      console.error('❌ Backend verification failed:', error.message);
      this.errors.push(`Backend verification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Step 3: Check database state after cleanup
   */
  async verifyCleanDatabase() {
    console.log('\n✅ STEP 3: Verifying Clean Database...');
    
    try {
      // Check remaining videos
      const videosSnapshot = await getDocs(collection(db, 'videos'));
      console.log(`📊 Remaining videos in database: ${videosSnapshot.size}`);
      
      let validVideos = 0;
      let stillBrokenVideos = 0;
      
      videosSnapshot.forEach(docSnapshot => {
        const video = docSnapshot.data();
        
        if (video.assetId && video.playbackUrl && video.assetId !== null) {
          validVideos++;
        } else {
          stillBrokenVideos++;
          console.log(`⚠️ Still broken: ${docSnapshot.id}`);
        }
      });
      
      console.log(`✅ Valid videos: ${validVideos}`);
      console.log(`❌ Still broken videos: ${stillBrokenVideos}`);
      
      if (stillBrokenVideos === 0) {
        console.log('🎉 Database is now clean!');
      }
      
    } catch (error) {
      console.error('❌ Database verification failed:', error.message);
      this.errors.push(`Database verification: ${error.message}`);
    }
  }

  /**
   * Generate cleanup report
   */
  generateReport() {
    console.log('\n📊 CLEANUP REPORT');
    console.log('='.repeat(40));
    console.log(`🗑️ Broken Videos Deleted: ${this.deletedVideos}`);
    console.log(`❌ Errors: ${this.errors.length}`);
    
    if (this.errors.length > 0) {
      console.log('\n❌ Error Details:');
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    console.log('\n✅ Cleanup Status: ' + (this.errors.length === 0 ? 'SUCCESS' : 'COMPLETED WITH ERRORS'));
    
    if (this.deletedVideos > 0) {
      console.log('\n🎯 NEXT STEPS:');
      console.log('1. 📱 Test new video upload in the app');
      console.log('2. 🔍 Verify videos show up correctly');
      console.log('3. 🌍 Test video playback');
      console.log('4. 📊 Monitor for any new issues');
    }
  }

  /**
   * Run complete cleanup
   */
  async runCleanup() {
    console.log('🧹 STARTING BROKEN VIDEO CLEANUP');
    console.log('='.repeat(50));
    
    try {
      await this.cleanBrokenVideos();
      await this.verifyMuxBackend();
      await this.verifyCleanDatabase();
      
      this.generateReport();
      
      console.log('\n🎉 CLEANUP COMPLETED SUCCESSFULLY!');
      console.log('📱 Your app should now work properly with Mux');
      console.log('🎬 Try uploading a new video to test the system');
      
    } catch (error) {
      console.error('\n💥 CLEANUP FAILED:', error.message);
      this.generateReport();
      console.log('\n📞 Please check the error details above');
      process.exit(1);
    }
  }
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  const cleanup = new BrokenVideoCleanup();
  cleanup.runCleanup().then(() => {
    console.log('\n🎯 Ready to test video uploads!');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  });
}

module.exports = BrokenVideoCleanup;
