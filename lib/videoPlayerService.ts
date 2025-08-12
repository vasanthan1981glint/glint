import { followService } from './followService';
import { VideoData } from './videoService';

export interface VideoPlayerProps {
  videos: VideoData[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  showFollowButton?: boolean;
  allowSelfFollow?: boolean;
}

export interface VideoPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isBuffering: boolean;
  volume: number;
  isMuted: boolean;
}

class VideoPlayerService {
  /**
   * Convert VideoData to the format expected by VerticalVideoPlayer
   */
  convertToVerticalPlayerFormat(videos: VideoData[]): Array<{
    assetId: string;
    playbackUrl: string;
    thumbnailUrl: string;
    userId: string;
    username: string;
    caption: string;
    likes: number;
    comments: number;
    views: number;
    createdAt: string;
    processed: boolean;
  }> {
    return videos.map(video => ({
      assetId: video.assetId,
      playbackUrl: video.playbackUrl,
      thumbnailUrl: video.thumbnailUrl || 'https://via.placeholder.com/300x400/000000/FFFFFF?text=Video', // Fallback thumbnail
      userId: video.userId,
      username: video.username,
      caption: video.caption,
      likes: video.likes,
      comments: video.comments,
      views: video.views,
      createdAt: video.createdAt,
      processed: video.processed
    }));
  }

  /**
   * Check if current user can follow the video owner
   */
  canFollowUser(videoUserId: string, currentUserId?: string): boolean {
    if (!currentUserId) return false;
    return videoUserId !== currentUserId; // Can't follow yourself
  }

  /**
   * Get follow button props for a video
   */
  getFollowButtonProps(video: VideoData, currentUserId?: string) {
    const canFollow = this.canFollowUser(video.userId, currentUserId);
    
    return {
      visible: canFollow,
      targetUserId: video.userId,
      username: video.username
    };
  }

  /**
   * Handle video interaction events
   */
  createVideoEventHandlers(video: VideoData, currentUserId?: string) {
    return {
      onLike: async () => {
        // Like functionality will be handled by VerticalVideoPlayer's internal logic
        console.log(`👍 Like video ${video.assetId}`);
      },
      
      onComment: () => {
        // Comment functionality will be handled by VerticalVideoPlayer's internal logic
        console.log(`💬 Comment on video ${video.assetId}`);
      },
      
      onSave: () => {
        // Save functionality will be handled by VerticalVideoPlayer's internal logic
        console.log(`💾 Save video ${video.assetId}`);
      },
      
      onFollow: async () => {
        if (this.canFollowUser(video.userId, currentUserId) && currentUserId) {
          try {
            await followService.followUser(currentUserId, video.userId);
            console.log(`✅ Followed user ${video.username}`);
          } catch (error) {
            console.error('❌ Follow error:', error);
          }
        }
      },
      
      onUnfollow: async () => {
        if (this.canFollowUser(video.userId, currentUserId) && currentUserId) {
          try {
            await followService.unfollowUser(currentUserId, video.userId);
            console.log(`✅ Unfollowed user ${video.username}`);
          } catch (error) {
            console.error('❌ Unfollow error:', error);
          }
        }
      },
      
      onProfile: () => {
        // Navigate to user profile
        console.log(`👤 Navigate to profile of ${video.username}`);
      }
    };
  }

  /**
   * Filter videos for optimal home feed experience
   */
  prepareVideosForHomeFeed(videos: VideoData[], currentUserId?: string): VideoData[] {
    // Remove duplicates
    const uniqueVideos = this.removeDuplicates(videos);
    
    // Filter out invalid videos
    const validVideos = uniqueVideos.filter(video => 
      video.playbackUrl && 
      video.processed && 
      video.assetId
    );

    // Sort by creation date (newest first)
    const sortedVideos = validVideos.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    console.log(`📱 Prepared ${sortedVideos.length} videos for home feed`);
    return sortedVideos;
  }

  /**
   * Remove duplicate videos by assetId
   */
  private removeDuplicates(videos: VideoData[]): VideoData[] {
    const seen = new Set<string>();
    const unique: VideoData[] = [];

    for (const video of videos) {
      if (!seen.has(video.assetId)) {
        seen.add(video.assetId);
        unique.push(video);
      }
    }

    if (videos.length !== unique.length) {
      console.log(`🔧 Removed ${videos.length - unique.length} duplicate videos`);
    }
    
    return unique;
  }

  /**
   * Create optimized video settings for home feed
   */
  getOptimizedVideoSettings() {
    return {
      shouldPlay: true,
      isLooping: true,
      isMuted: false,
      volume: 1.0,
      rate: 1.0,
      shouldCorrectPitch: true,
      progressUpdateIntervalMillis: 100,
      positionMillis: 0,
      // Performance optimizations
      resizeMode: 'cover' as const,
      useNativeControls: false,
      // Preload settings
      shouldLoadAsync: true,
    };
  }

  /**
   * Handle video player state changes
   */
  createVideoStateHandler() {
    return {
      onPlaybackStatusUpdate: (status: any, index: number) => {
        // Handle playback status updates
        if (status.isLoaded) {
          // Video is loaded and ready
          if (status.didJustFinish && status.isLooping) {
            // Video finished and will loop
            console.log(`🔄 Video ${index} looped`);
          }
        } else if (status.error) {
          console.error(`❌ Video ${index} error:`, status.error);
        }
      },
      
      onLoad: (status: any, index: number) => {
        console.log(`✅ Video ${index} loaded successfully`);
      },
      
      onError: (error: any, index: number) => {
        console.error(`❌ Video ${index} failed to load:`, error);
      }
    };
  }
}

export const videoPlayerService = new VideoPlayerService();
