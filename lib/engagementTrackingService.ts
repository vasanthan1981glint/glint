import {
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export interface EngagementMetrics {
  videoId: string;
  userId: string;
  watchTime: number; // seconds
  completionRate: number; // 0-100
  totalDuration: number; // seconds
  interactions: {
    liked: boolean;
    commented: boolean;
    shared: boolean;
    followed: boolean;
    saved: boolean;
  };
  skipTime?: number; // seconds when user swiped away
  rewatches: number;
  timestamp: Date;
}

export interface VideoPerformanceMetrics {
  videoId: string;
  uploaderId: string;
  totalViews: number;
  totalWatchTime: number;
  avgWatchTime: number;
  completionRate: number;
  engagementRate: number; // (likes + comments + shares) / views
  skipRate: number; // percentage of users who skip quickly
  viralityScore: number; // 0-100
  freshnessFactor: number; // 0-1 (1 = brand new)
  relevanceScore: number; // 0-100
  uploaderTrustScore: number; // 0-100
  lastUpdated: Date;
}

class EngagementTrackingService {
  private watchStartTime: Map<string, number> = new Map();
  private currentVideoId: string | null = null;
  private watchTimeInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Start tracking when user begins watching a video
   */
  startWatching(videoId: string, userId: string): void {
    // Stop tracking previous video if any
    this.stopWatching();
    
    this.currentVideoId = videoId;
    this.watchStartTime.set(videoId, Date.now());
    
    console.log(`📊 Started tracking engagement for video ${videoId}`);
    
    // NOTE: View counting is now handled by viewTrackingService.ts
    // This service only tracks engagement metrics (watch time, interactions)
    
    // Start periodic watch time tracking
    this.watchTimeInterval = setInterval(() => {
      this.updateWatchTime(videoId, userId);
    }, 1000); // Update every second
  }

  /**
   * Stop tracking current video
   */
  stopWatching(): void {
    if (this.currentVideoId && this.watchTimeInterval) {
      clearInterval(this.watchTimeInterval);
      this.watchTimeInterval = null;
      
      // Final watch time update
      const userId = auth.currentUser?.uid;
      if (userId) {
        this.updateWatchTime(this.currentVideoId, userId, true);
      }
      
      this.currentVideoId = null;
    }
  }

  /**
   * Track video view - DEPRECATED
   * View tracking is now handled by viewTrackingService.ts with duplicate prevention
   */
  private async trackView(videoId: string, userId: string): Promise<void> {
    // DISABLED: This method is deprecated in favor of viewTrackingService.ts
    // which provides comprehensive duplicate prevention and fraud detection
    console.log(`📊 Note: View tracking delegated to viewTrackingService for video ${videoId}`);
    return;
    
    /*
    try {
      // Increment video view count
      const videoRef = doc(db, 'videos', videoId);
      await updateDoc(videoRef, {
        views: increment(1),
        lastViewed: serverTimestamp()
      });

      // Record user view
      const viewRef = doc(db, 'videoViews', `${videoId}_${userId}`);
      await setDoc(viewRef, {
        videoId,
        userId,
        viewedAt: serverTimestamp(),
        watchTime: 0
      }, { merge: true });

      console.log(`👁️ View tracked for video ${videoId}`);
    } catch (error) {
      console.error('Error tracking view:', error);
    }
    */
  }

  /**
   * Update watch time for current video
   */
  private async updateWatchTime(videoId: string, userId: string, isFinal: boolean = false): Promise<void> {
    const startTime = this.watchStartTime.get(videoId);
    if (!startTime) return;

    const watchTime = Math.floor((Date.now() - startTime) / 1000);
    
    try {
      // Update user's watch time (create document if it doesn't exist)
      const viewRef = doc(db, 'videoViews', `${videoId}_${userId}`);
      await setDoc(viewRef, {
        videoId,
        userId,
        watchTime,
        lastUpdated: serverTimestamp(),
        createdAt: new Date().toISOString()
      }, { merge: true });

      if (isFinal) {
        console.log(`⏱️ Final watch time for video ${videoId}: ${watchTime}s`);
      }
    } catch (error) {
      console.error('Error updating watch time:', error);
    }
  }

  /**
   * Track user interaction (like, comment, share, etc.)
   */
  async trackInteraction(
    videoId: string, 
    userId: string, 
    interactionType: 'like' | 'comment' | 'share' | 'follow' | 'save',
    value: boolean = true
  ): Promise<void> {
    try {
      const interactionRef = doc(db, 'userInteractions', `${videoId}_${userId}`);
      
      await setDoc(interactionRef, {
        videoId,
        userId,
        [interactionType]: value,
        [`${interactionType}At`]: value ? serverTimestamp() : null,
        lastUpdated: serverTimestamp()
      }, { merge: true });

      // Update video engagement metrics
      const videoRef = doc(db, 'videos', videoId);
      if (interactionType === 'like') {
        await updateDoc(videoRef, {
          likes: increment(value ? 1 : -1)
        });
      } else if (interactionType === 'comment') {
        await updateDoc(videoRef, {
          comments: increment(1)
        });
      }

      console.log(`${value ? '✅' : '❌'} ${interactionType} tracked for video ${videoId}`);
    } catch (error) {
      console.error(`Error tracking ${interactionType}:`, error);
    }
  }

  /**
   * Track when user skips a video
   */
  async trackSkip(videoId: string, userId: string, skipTime: number, totalDuration: number): Promise<void> {
    try {
      const skipRef = doc(db, 'videoSkips', `${videoId}_${userId}_${Date.now()}`);
      
      await setDoc(skipRef, {
        videoId,
        userId,
        skipTime,
        totalDuration,
        completionRate: (skipTime / totalDuration) * 100,
        skippedAt: serverTimestamp()
      });

      console.log(`⏭️ Skip tracked for video ${videoId} at ${skipTime}s`);
    } catch (error) {
      console.error('Error tracking skip:', error);
    }
  }

  /**
   * Get engagement metrics for a video
   */
  async getVideoEngagementMetrics(videoId: string): Promise<VideoPerformanceMetrics | null> {
    try {
      const metricsRef = doc(db, 'videoMetrics', videoId);
      const metricsDoc = await getDoc(metricsRef);
      
      if (metricsDoc.exists()) {
        return metricsDoc.data() as VideoPerformanceMetrics;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting engagement metrics:', error);
      return null;
    }
  }

  /**
   * Calculate and update video performance metrics
   */
  async updateVideoMetrics(videoId: string): Promise<void> {
    try {
      // Get all views for this video
      const viewsQuery = query(
        collection(db, 'videoViews'),
        where('videoId', '==', videoId)
      );
      const viewsSnapshot = await getDocs(viewsQuery);
      
      // Get all interactions for this video
      const interactionsQuery = query(
        collection(db, 'userInteractions'),
        where('videoId', '==', videoId)
      );
      const interactionsSnapshot = await getDocs(interactionsQuery);
      
      // Get all skips for this video
      const skipsQuery = query(
        collection(db, 'videoSkips'),
        where('videoId', '==', videoId)
      );
      const skipsSnapshot = await getDocs(skipsQuery);

      // Calculate metrics
      const totalViews = viewsSnapshot.size;
      let totalWatchTime = 0;
      let totalInteractions = 0;
      let totalSkips = skipsSnapshot.size;

      viewsSnapshot.forEach(doc => {
        const data = doc.data();
        totalWatchTime += data.watchTime || 0;
      });

      interactionsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.like || data.comment || data.share || data.save) {
          totalInteractions++;
        }
      });

      const avgWatchTime = totalViews > 0 ? totalWatchTime / totalViews : 0;
      const engagementRate = totalViews > 0 ? (totalInteractions / totalViews) * 100 : 0;
      const skipRate = totalViews > 0 ? (totalSkips / totalViews) * 100 : 0;

      // Get video data for upload time
      const videoRef = doc(db, 'videos', videoId);
      const videoDoc = await getDoc(videoRef);
      const videoData = videoDoc.data();
      
      const uploadTime = new Date(videoData?.createdAt || Date.now());
      const hoursSinceUpload = (Date.now() - uploadTime.getTime()) / (1000 * 60 * 60);
      const freshnessFactor = Math.max(0, 1 - (hoursSinceUpload / 168)); // Decay over 1 week

      // Calculate virality score (simplified)
      const viralityScore = Math.min(100, (engagementRate * 2) + (avgWatchTime / 30 * 10) - skipRate);

      // Update metrics document
      const metricsRef = doc(db, 'videoMetrics', videoId);
      await setDoc(metricsRef, {
        videoId,
        uploaderId: videoData?.userId || '',
        totalViews,
        totalWatchTime,
        avgWatchTime,
        completionRate: 100 - skipRate,
        engagementRate,
        skipRate,
        viralityScore: Math.max(0, viralityScore),
        freshnessFactor,
        relevanceScore: 50, // Would be calculated based on user interests
        uploaderTrustScore: 75, // Would be calculated based on uploader history
        lastUpdated: new Date()
      }, { merge: true });

      console.log(`📊 Updated metrics for video ${videoId}:`, {
        totalViews,
        avgWatchTime: Math.round(avgWatchTime),
        engagementRate: Math.round(engagementRate),
        viralityScore: Math.round(viralityScore)
      });

    } catch (error) {
      console.error('Error updating video metrics:', error);
    }
  }
}

export const engagementTrackingService = new EngagementTrackingService();
