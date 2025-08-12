import {
    collection,
    DocumentData,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    QuerySnapshot,
    where
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export interface VideoData {
  id: string;
  assetId: string;
  userId: string;
  username: string;
  playbackUrl: string;
  thumbnailUrl?: string;
  caption: string;
  createdAt: string;
  likes: number;
  comments: number;
  views: number;
  processed: boolean;
  isRealVideo?: boolean;
  status?: string;
  isFromFollowedUser?: boolean; // Added for algorithmic ranking
}

class VideoService {
  /**
   * Get all uploaded videos from Firebase
   * Returns videos from all users for the home feed
   */
  async getAllVideos(limitCount: number = 20): Promise<VideoData[]> {
    try {
      console.log(`📥 Fetching ${limitCount} videos from Firebase...`);

      try {
        // Try the complex query first - TEMPORARY FIX: Remove filters to avoid index requirement
        const q = query(
          collection(db, 'videos'),
          // where('processed', '==', true), // TEMPORARY FIX: Remove to avoid composite index requirement
          // orderBy('createdAt', 'desc'), // TEMPORARY FIX: Remove to avoid composite index requirement
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

        console.log(`✅ Fetched ${videos.length} videos from Firebase`);
        return videos;
        
      } catch (indexError) {
        console.log('🔄 Index not ready, using simple fallback query...');
        
        // Simple fallback without orderBy - TEMPORARY FIX: Remove processed filter too
        const simpleQuery = query(
          collection(db, 'videos'),
          // where('processed', '==', true), // TEMPORARY FIX: Remove to avoid composite index requirement
          limit(limitCount)
        );

        const querySnapshot = await getDocs(simpleQuery);
        
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

        console.log(`✅ Fallback: Fetched ${videos.length} videos from Firebase`);
        return videos;
      }
      
    } catch (error) {
      console.error('❌ Error fetching videos:', error);
      throw error;
    }
  }

  /**
   * Get videos for a specific user
   */
  async getUserVideos(userId: string, limitCount: number = 20): Promise<VideoData[]> {
    try {
      console.log(`📥 Fetching videos for user ${userId}...`);

      const q = query(
        collection(db, 'videos'),
        where('userId', '==', userId),
        where('processed', '==', true),
        orderBy('createdAt', 'desc'),
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

      console.log(`✅ Fetched ${videos.length} videos for user ${userId}`);
      return videos;
    } catch (error) {
      console.error('❌ Error fetching user videos:', error);
      throw error;
    }
  }

  /**
   * Real-time listener for videos
   * This will update the home feed automatically when new videos are uploaded
   */
  onVideosChange(callback: (videos: VideoData[]) => void, limitCount: number = 20) {
    console.log('🔄 Setting up real-time video listener...');

    const q = query(
      collection(db, 'videos'),
      where('processed', '==', true),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    return onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
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

      console.log(`✅ Real-time update: ${videos.length} videos available`);
      callback(videos);
    }, (error) => {
      console.error('❌ Video listener error:', error);
    });
  }

  /**
   * Convert VideoData to Reel format for home.tsx
   */
  convertToReelFormat(videos: VideoData[]): Array<{
    id: string;
    video: string;
    user: string;
    caption: string;
    song: string;
    userId: string;
    assetId: string;
    thumbnailUrl?: string;
    likes: number;
    comments: number;
    views: number;
  }> {
    return videos.map(video => ({
      id: video.assetId,
      video: video.playbackUrl,
      user: video.username,
      caption: video.caption,
      song: 'Original Audio', // Default audio label
      userId: video.userId,
      assetId: video.assetId,
      thumbnailUrl: video.thumbnailUrl,
      likes: video.likes,
      comments: video.comments,
      views: video.views
    }));
  }

  /**
   * Remove duplicate videos by assetId
   */
  removeDuplicates(videos: VideoData[]): VideoData[] {
    const seen = new Set<string>();
    const unique: VideoData[] = [];

    for (const video of videos) {
      if (!seen.has(video.assetId)) {
        seen.add(video.assetId);
        unique.push(video);
      }
    }

    console.log(`🔧 Removed ${videos.length - unique.length} duplicate videos`);
    return unique;
  }

  /**
   * Filter out videos from the current user (optional)
   */
  filterOutCurrentUser(videos: VideoData[]): VideoData[] {
    const currentUser = auth.currentUser;
    if (!currentUser) return videos;

    const filtered = videos.filter(video => video.userId !== currentUser.uid);
    console.log(`🔧 Filtered out ${videos.length - filtered.length} videos from current user`);
    return filtered;
  }
}

export const videoService = new VideoService();
