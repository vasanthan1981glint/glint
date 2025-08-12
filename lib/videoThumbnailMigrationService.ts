import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import permanentThumbnailService from './permanentThumbnailService';

class VideoThumbnailMigrationService {
  
  /**
   * Ensure all videos have permanent thumbnails
   * This runs in background to update videos that don't have Firebase thumbnails
   */
  async ensureAllVideosHavePermanentThumbnails(userId: string): Promise<void> {
    try {
      console.log('🎨 Starting permanent thumbnail migration for user:', userId);
      
      // Get all videos for the user
      const videosQuery = query(
        collection(db, 'videos'),
        where('userId', '==', userId)
      );
      
      const videosSnapshot = await getDocs(videosQuery);
      const videos = videosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`📊 Found ${videos.length} videos to check for permanent thumbnails`);
      
      // Process each video
      for (const video of videos) {
        await this.ensureVideoHasPermanentThumbnail(video);
      }
      
      console.log('✅ Permanent thumbnail migration completed');
      
    } catch (error) {
      console.error('❌ Thumbnail migration failed:', error);
    }
  }
  
  /**
   * Ensure a single video has a permanent thumbnail
   */
  private async ensureVideoHasPermanentThumbnail(video: any): Promise<void> {
    try {
      const videoId = video.id || video.assetId;
      const thumbnailUrl = video.thumbnailUrl;
      
      // Check if video already has a permanent Firebase thumbnail
      const hasPermanentThumbnail = thumbnailUrl && 
                                  thumbnailUrl.includes('firebasestorage.googleapis.com') && 
                                  thumbnailUrl.includes('thumbnails');
      
      if (hasPermanentThumbnail) {
        console.log(`✅ Video ${videoId} already has permanent thumbnail`);
        return;
      }
      
      console.log(`🎨 Generating permanent thumbnail for video: ${videoId}`);
      
      // Generate and upload permanent thumbnail
      const permanentThumbnailUrl = await permanentThumbnailService.ensureVideoHasPermanentThumbnail(videoId);
      
      // Update video document
      await updateDoc(doc(db, 'videos', videoId), {
        thumbnailUrl: permanentThumbnailUrl,
        thumbnailType: 'permanent',
        hasPermanentThumbnail: true,
        thumbnailUpdatedAt: new Date().toISOString(),
        thumbnailMigrated: true
      });
      
      // Update post document if it exists
      try {
        await updateDoc(doc(db, 'posts', videoId), {
          thumbnailUrl: permanentThumbnailUrl,
          hasPermanentThumbnail: true,
          thumbnailUpdatedAt: new Date().toISOString()
        });
      } catch (postError) {
        console.warn(`⚠️ Could not update post document for ${videoId}:`, postError);
      }
      
      console.log(`✅ Updated video ${videoId} with permanent thumbnail: ${permanentThumbnailUrl}`);
      
    } catch (error) {
      console.error(`❌ Failed to create permanent thumbnail for video:`, error);
    }
  }
  
  /**
   * Check if user videos need thumbnail migration
   */
  async needsThumbnailMigration(userId: string): Promise<boolean> {
    try {
      // Get count of videos without permanent thumbnails
      const videosQuery = query(
        collection(db, 'videos'),
        where('userId', '==', userId)
      );
      
      const videosSnapshot = await getDocs(videosQuery);
      
      const videosNeedingMigration = videosSnapshot.docs.filter(doc => {
        const data = doc.data();
        const thumbnailUrl = data.thumbnailUrl;
        
        // Check if video doesn't have a permanent thumbnail
        const hasPermanentThumbnail = thumbnailUrl && 
                                    thumbnailUrl.includes('firebasestorage.googleapis.com') && 
                                    thumbnailUrl.includes('thumbnails');
        
        return !hasPermanentThumbnail;
      });
      
      const needsMigration = videosNeedingMigration.length > 0;
      
      if (needsMigration) {
        console.log(`📊 ${videosNeedingMigration.length} videos need permanent thumbnails`);
      }
      
      return needsMigration;
      
    } catch (error) {
      console.error('❌ Failed to check thumbnail migration status:', error);
      return false;
    }
  }
}

export default new VideoThumbnailMigrationService();
