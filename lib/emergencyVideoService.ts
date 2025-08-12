import {
    collection,
    getDocs,
    limit,
    query,
    where
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { VideoData } from './videoService';

/**
 * Emergency video service for when indexes are not available
 * Uses only simple queries that don't require composite indexes
 */
class EmergencyVideoService {
  /**
   * Get videos using the simplest possible query
   */
  async getSimpleVideos(limitCount: number = 20): Promise<VideoData[]> {
    try {
      console.log(`🚨 Using emergency video service - fetching ${limitCount} videos...`);

      // Ultra-simple query: only filter by processed status
      const q = query(
        collection(db, 'videos'),
        where('processed', '==', true),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      
      const videos: VideoData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        videos.push({
          id: doc.id,
          assetId: data.assetId || doc.id,
          userId: data.userId,
          username: data.username || 'Unknown User',
          playbackUrl: data.playbackUrl,
          thumbnailUrl: data.thumbnailUrl,
          caption: data.caption || 'No caption',
          createdAt: data.createdAt,
          likes: data.likes || 0,
          comments: data.comments || 0,
          views: data.views || 0,
          processed: data.processed,
          isRealVideo: data.isRealVideo,
          status: data.status
        });
      });

      console.log(`✅ Emergency service: Fetched ${videos.length} videos`);
      return videos;
    } catch (error) {
      console.error('❌ Emergency video service failed:', error);
      return [];
    }
  }

  /**
   * Get any videos at all - absolute fallback
   */
  async getAnyVideos(limitCount: number = 10): Promise<VideoData[]> {
    try {
      console.log(`🚨 Absolute fallback - getting any videos...`);

      // No filters at all - just get any videos
      const q = query(
        collection(db, 'videos'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      
      const videos: VideoData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Only include videos that have the basic required fields
        if (data.playbackUrl && data.userId) {
          videos.push({
            id: doc.id,
            assetId: data.assetId || doc.id,
            userId: data.userId,
            username: data.username || 'Unknown User',
            playbackUrl: data.playbackUrl,
            thumbnailUrl: data.thumbnailUrl,
            caption: data.caption || 'No caption',
            createdAt: data.createdAt,
            likes: data.likes || 0,
            comments: data.comments || 0,
            views: data.views || 0,
            processed: data.processed !== false, // Default to true if not set
            isRealVideo: data.isRealVideo,
            status: data.status
          });
        }
      });

      console.log(`✅ Absolute fallback: Found ${videos.length} videos`);
      return videos;
    } catch (error) {
      console.error('❌ Absolute fallback failed:', error);
      return [];
    }
  }
}

export const emergencyVideoService = new EmergencyVideoService();
