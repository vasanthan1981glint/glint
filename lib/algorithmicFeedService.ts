import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { VideoPerformanceMetrics, engagementTrackingService } from './engagementTrackingService';
import { followService } from './followService';
import { VideoData } from './videoService';

export interface UserProfile {
  userId: string;
  interests: string[]; // hashtags, categories user engages with
  avgWatchTime: number;
  preferredContentTypes: string[];
  skipPattern: number; // tendency to skip videos quickly
  engagementRate: number;
  lastActive: Date;
  location?: string;
  language: string;
}

export interface VideoRankingScore {
  videoId: string;
  finalScore: number;
  freshnessScore: number;
  relevanceScore: number;
  uploaderTrustScore: number;
  viralityScore: number;
  personalizedScore: number;
  boostFactor: number;
}

export interface FeedConfig {
  seedTestSize: number; // Number of users for initial test
  minEngagementForBoost: number; // Minimum engagement rate to boost
  maxFeedSize: number; // Maximum videos to preload
  personalizedWeight: number; // 0-1, how much to personalize vs trending
  freshnessWeight: number; // 0-1, how much to favor new content
  diversityFactor: number; // 0-1, prevent too much content from same creator
  followedUsersWeight: number; // 0-1, how much to boost followed users' content
}

class AlgorithmicFeedService {
  private feedConfig: FeedConfig = {
    seedTestSize: 100,
    minEngagementForBoost: 0.15, // 15% engagement rate
    maxFeedSize: 50,
    personalizedWeight: 0.7,
    freshnessWeight: 0.3,
    diversityFactor: 0.4,
    followedUsersWeight: 0.8 // Boost content from followed users
  };

  private userProfiles: Map<string, UserProfile> = new Map();

  /**
   * Get personalized feed for user
   */
  async getPersonalizedFeed(userId: string, feedSize: number = 20): Promise<VideoData[]> {
    try {
      console.log(`🎯 Generating personalized feed for user ${userId}`);
      
      // Get or create user profile
      const userProfile = await this.getUserProfile(userId);
      
      // Get candidate videos
      const candidateVideos = await this.getCandidateVideos(userId);
      
      // Rank videos for this user
      const rankedVideos = await this.rankVideosForUser(candidateVideos, userProfile);
      
      // Apply diversity filter
      const diversifiedFeed = this.applyDiversityFilter(rankedVideos, userProfile);
      
      // Return top videos
      const finalFeed = diversifiedFeed.slice(0, feedSize);
      
      console.log(`✅ Generated feed with ${finalFeed.length} videos for user ${userId}`);
      return finalFeed;
      
    } catch (error) {
      console.error('Error generating personalized feed:', error);
      // Fallback to trending videos
      return this.getTrendingVideos(feedSize);
    }
  }

  /**
   * Get or create user profile for personalization
   */
  private async getUserProfile(userId: string): Promise<UserProfile> {
    // Check cache first
    if (this.userProfiles.has(userId)) {
      return this.userProfiles.get(userId)!;
    }

    try {
      const profileRef = doc(db, 'userProfiles', userId);
      const profileDoc = await getDoc(profileRef);
      
      let profile: UserProfile;
      
      if (profileDoc.exists()) {
        profile = profileDoc.data() as UserProfile;
      } else {
        // Create new profile
        profile = {
          userId,
          interests: [],
          avgWatchTime: 30, // Default 30 seconds
          preferredContentTypes: [],
          skipPattern: 0.5, // Neutral skip pattern
          engagementRate: 0.1, // Low initial engagement
          lastActive: new Date(),
          language: 'en'
        };
        
        await setDoc(profileRef, profile);
      }
      
      // Cache the profile
      this.userProfiles.set(userId, profile);
      return profile;
      
    } catch (error) {
      console.error('Error getting user profile:', error);
      // Return default profile
      return {
        userId,
        interests: [],
        avgWatchTime: 30,
        preferredContentTypes: [],
        skipPattern: 0.5,
        engagementRate: 0.1,
        lastActive: new Date(),
        language: 'en'
      };
    }
  }

  /**
   * Get candidate videos for ranking
   */
  private async getCandidateVideos(userId: string): Promise<VideoData[]> {
    try {
      console.log('🔄 Getting candidate videos for user:', userId);
      
      // Get list of users that the current user follows
      const followedUsers = await followService.getFollowing(userId, 100);
      console.log(`👥 User follows ${followedUsers.length} users`);
      
      const videos: VideoData[] = [];
      
      // First, get recent videos from followed users (prioritized)
      if (followedUsers.length > 0) {
        try {
          const followedVideosQuery = query(
            collection(db, 'videos'),
            // where('processed', '==', true), // TEMPORARY FIX: Remove to avoid composite index requirement
            where('userId', 'in', followedUsers.slice(0, 10)), // Firestore 'in' limit is 10
            // orderBy('createdAt', 'desc'), // TEMPORARY FIX: Remove to avoid composite index requirement
            limit(30)
          );
          
          const followedVideosSnapshot = await getDocs(followedVideosQuery);
          followedVideosSnapshot.forEach(doc => {
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
              status: data.status,
              isFromFollowedUser: true // Mark for ranking boost
            });
          });
          
          console.log(`👥 Found ${followedVideosSnapshot.size} videos from followed users`);
        } catch (followedError) {
          console.warn('Error getting followed users videos:', followedError);
        }
      }
      
      // Then get trending/general videos to fill the rest
      const generalQuery = query(
        collection(db, 'videos'),
        // where('processed', '==', true), // TEMPORARY FIX: Remove to avoid composite index requirement
        limit(70) // Get more to ensure diversity after filtering
      );
      
      const generalSnapshot = await getDocs(generalQuery);
      generalSnapshot.forEach(doc => {
        const data = doc.data();
        // Exclude user's own videos and already added followed users' videos
        if (data.userId !== userId && !videos.some(v => v.id === doc.id)) {
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
            status: data.status,
            isFromFollowedUser: false
          });
        }
      });
      
      console.log(`📹 Found ${videos.length} total candidate videos`);
      return videos;
      
    } catch (error) {
      console.error('Error getting candidate videos:', error);
      // Fallback to simple query
      return this.getFallbackVideos(userId);
    }
  }

  /**
   * Fallback method for getting videos when main query fails
   */
  private async getFallbackVideos(userId: string): Promise<VideoData[]> {
    try {
      console.log('🔄 Using fallback video query...');
      
      const simpleQuery = query(
        collection(db, 'videos'),
        // where('processed', '==', true), // TEMPORARY FIX: Remove to avoid composite index requirement
        limit(50)
      );
      
      const videosSnapshot = await getDocs(simpleQuery);
      const videos: VideoData[] = [];
      
      videosSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.userId !== userId) {
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
            status: data.status,
            isFromFollowedUser: false
          });
        }
      });
      
      console.log(`📹 Fallback: Found ${videos.length} videos`);
      return videos;
      
    } catch (error) {
      console.error('Error in fallback query:', error);
      return [];
    }
  }

  /**
   * Rank videos for specific user
   */
  private async rankVideosForUser(videos: VideoData[], userProfile: UserProfile): Promise<VideoData[]> {
    const rankedVideos: { video: VideoData; score: VideoRankingScore }[] = [];
    
    for (const video of videos) {
      const score = await this.calculateVideoScore(video, userProfile);
      rankedVideos.push({ video, score });
    }
    
    // Sort by final score (highest first)
    rankedVideos.sort((a, b) => b.score.finalScore - a.score.finalScore);
    
    // Log top scores for debugging
    console.log(`🏆 Top 5 video scores:`, 
      rankedVideos.slice(0, 5).map(r => ({
        videoId: r.video.assetId,
        score: Math.round(r.score.finalScore),
        freshness: Math.round(r.score.freshnessScore),
        virality: Math.round(r.score.viralityScore)
      }))
    );
    
    return rankedVideos.map(r => r.video);
  }

  /**
   * Calculate comprehensive score for a video
   */
  private async calculateVideoScore(video: VideoData, userProfile: UserProfile): Promise<VideoRankingScore> {
    // Get performance metrics
    const metrics = await engagementTrackingService.getVideoEngagementMetrics(video.assetId);
    
    // Calculate individual scores
    const freshnessScore = this.calculateFreshnessScore(video.createdAt);
    const relevanceScore = this.calculateRelevanceScore(video, userProfile);
    const uploaderTrustScore = await this.calculateUploaderTrustScore(video.userId);
    const viralityScore = metrics?.viralityScore || 0;
    const personalizedScore = this.calculatePersonalizedScore(video, userProfile);
    
    // Boost factor for trending content
    const boostFactor = this.calculateBoostFactor(metrics);
    
    // Additional boost for followed users' content
    const followBoost = video.isFromFollowedUser ? this.feedConfig.followedUsersWeight : 1.0;
    
    // Weighted final score
    const finalScore = (
      freshnessScore * this.feedConfig.freshnessWeight +
      relevanceScore * 0.2 +
      uploaderTrustScore * 0.1 +
      viralityScore * 0.3 +
      personalizedScore * this.feedConfig.personalizedWeight
    ) * boostFactor * followBoost;
    
    return {
      videoId: video.assetId,
      finalScore,
      freshnessScore,
      relevanceScore,
      uploaderTrustScore,
      viralityScore,
      personalizedScore,
      boostFactor
    };
  }

  /**
   * Calculate freshness score (newer = higher score)
   */
  private calculateFreshnessScore(createdAt: string): number {
    const uploadTime = new Date(createdAt);
    const hoursSinceUpload = (Date.now() - uploadTime.getTime()) / (1000 * 60 * 60);
    
    // Exponential decay: 100 points for new, 50 points after 24h, 25 points after 48h
    return Math.max(10, 100 * Math.exp(-hoursSinceUpload / 24));
  }

  /**
   * Calculate relevance based on user interests
   */
  private calculateRelevanceScore(video: VideoData, userProfile: UserProfile): number {
    // Extract hashtags and keywords from caption
    const caption = video.caption.toLowerCase();
    const hashtags = caption.match(/#\w+/g) || [];
    const keywords = caption.split(/\s+/);
    
    let relevanceScore = 50; // Base score
    
    // Check against user interests
    for (const interest of userProfile.interests) {
      if (hashtags.some(tag => tag.includes(interest.toLowerCase()))) {
        relevanceScore += 20;
      }
      if (keywords.some(word => word.includes(interest.toLowerCase()))) {
        relevanceScore += 10;
      }
    }
    
    return Math.min(100, relevanceScore);
  }

  /**
   * Calculate uploader trust score
   */
  private async calculateUploaderTrustScore(uploaderId: string): Promise<number> {
    try {
      // Get uploader's recent performance
      const uploaderQuery = query(
        collection(db, 'videoMetrics'),
        where('uploaderId', '==', uploaderId),
        orderBy('lastUpdated', 'desc'),
        limit(10)
      );
      
      const metricsSnapshot = await getDocs(uploaderQuery);
      
      if (metricsSnapshot.empty) {
        return 50; // Neutral score for new uploaders
      }
      
      let avgEngagement = 0;
      let avgVirality = 0;
      
      metricsSnapshot.forEach(doc => {
        const data = doc.data() as VideoPerformanceMetrics;
        avgEngagement += data.engagementRate;
        avgVirality += data.viralityScore;
      });
      
      avgEngagement /= metricsSnapshot.size;
      avgVirality /= metricsSnapshot.size;
      
      // Trust score based on consistent performance
      return Math.min(100, (avgEngagement * 2) + (avgVirality * 0.5) + 25);
      
    } catch (error) {
      console.error('Error calculating uploader trust:', error);
      return 50;
    }
  }

  /**
   * Calculate personalized score based on user behavior
   */
  private calculatePersonalizedScore(video: VideoData, userProfile: UserProfile): number {
    let score = 50; // Base score
    
    // Check if user has engaged with this uploader before
    // This would require additional tracking
    
    // Adjust based on user's typical engagement patterns
    if (userProfile.engagementRate > 0.2) {
      score += 10; // Boost for engaged users
    }
    
    // Adjust based on content length vs user preference
    // This would require video duration data
    
    return Math.min(100, score);
  }

  /**
   * Calculate boost factor for trending content
   */
  private calculateBoostFactor(metrics: VideoPerformanceMetrics | null): number {
    if (!metrics) return 1.0;
    
    // Boost highly engaging content
    if (metrics.engagementRate > this.feedConfig.minEngagementForBoost) {
      return 1.0 + (metrics.engagementRate * 2); // Up to 3x boost
    }
    
    // Boost viral content
    if (metrics.viralityScore > 70) {
      return 1.5;
    }
    
    return 1.0;
  }

  /**
   * Apply diversity filter to prevent too much content from same creator
   */
  private applyDiversityFilter(videos: VideoData[], userProfile: UserProfile): VideoData[] {
    const creatorCount: Map<string, number> = new Map();
    const diversifiedFeed: VideoData[] = [];
    
    for (const video of videos) {
      const currentCount = creatorCount.get(video.userId) || 0;
      const maxPerCreator = Math.ceil(videos.length * this.feedConfig.diversityFactor);
      
      if (currentCount < maxPerCreator) {
        diversifiedFeed.push(video);
        creatorCount.set(video.userId, currentCount + 1);
      }
    }
    
    console.log(`🎨 Applied diversity filter: ${videos.length} → ${diversifiedFeed.length} videos`);
    return diversifiedFeed;
  }

  /**
   * Fallback to trending videos
   */
  private async getTrendingVideos(limitCount: number = 20): Promise<VideoData[]> {
    try {
      console.log('🔄 Trending query failed, using simple query...');
      
      // Ultra-simple fallback
      const simpleQuery = query(
        collection(db, 'videos'),
        where('processed', '==', true),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(simpleQuery);
      const videos: VideoData[] = [];
      
      snapshot.forEach(doc => {
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
      
      console.log(`📈 Simple fallback: Loaded ${videos.length} videos`);
      return videos;
      
    } catch (error) {
      console.error('Error getting trending videos:', error);
      return [];
    }
  }

  /**
   * Update user profile based on interactions
   */
  async updateUserProfile(
    userId: string, 
    videoId: string, 
    interaction: {
      watchTime?: number;
      totalDuration?: number;
      liked?: boolean;
      commented?: boolean;
      shared?: boolean;
      skipped?: boolean;
    }
  ): Promise<void> {
    try {
      const profileRef = doc(db, 'userProfiles', userId);
      const updates: any = {
        lastActive: serverTimestamp()
      };

      // Update average watch time
      if (interaction.watchTime !== undefined && interaction.totalDuration !== undefined) {
        const completionRate = interaction.watchTime / interaction.totalDuration;
        updates.lastCompletionRate = completionRate;
      }

      // Update engagement patterns
      if (interaction.liked || interaction.commented || interaction.shared) {
        updates.lastEngagement = serverTimestamp();
      }

      await updateDoc(profileRef, updates);
      
      // Clear cache to force refresh
      this.userProfiles.delete(userId);
      
    } catch (error) {
      console.error('Error updating user profile:', error);
    }
  }

  /**
   * Trigger feed refresh for user
   */
  async refreshUserFeed(userId: string): Promise<void> {
    // Clear cached profile to get fresh data
    this.userProfiles.delete(userId);
    console.log(`🔄 Refreshed feed algorithm for user ${userId}`);
  }
}

export const algorithmicFeedService = new AlgorithmicFeedService();
