import { VideoData } from './videoService';

export interface PreloadedVideo {
  video: VideoData;
  preloadStatus: 'pending' | 'loading' | 'loaded' | 'error';
  preloadProgress: number; // 0-100
  preloadStartTime: number;
  preloadEndTime?: number;
}

export interface PreloadConfig {
  preloadCount: number; // How many videos to preload ahead
  preloadBehind: number; // How many videos to keep loaded behind
  maxConcurrentPreloads: number; // Max simultaneous preload operations
  preloadTimeoutMs: number; // Timeout for preload operations
  enableSmartPreload: boolean; // Use user patterns to optimize preload
}

class VideoPreloadService {
  private preloadConfig: PreloadConfig = {
    preloadCount: 3,
    preloadBehind: 1,
    maxConcurrentPreloads: 2,
    preloadTimeoutMs: 30000, // 30 seconds
    enableSmartPreload: true
  };

  private preloadedVideos: Map<string, PreloadedVideo> = new Map();
  private activePreloads: Set<string> = new Set();
  private preloadQueue: string[] = [];
  private userSwipeVelocity: number[] = []; // Track user swipe patterns

  /**
   * Preload videos around current index
   */
  async preloadVideosAroundIndex(
    videos: VideoData[], 
    currentIndex: number, 
    userSwipePattern?: { velocity: number; direction: 'up' | 'down' }
  ): Promise<void> {
    if (videos.length === 0) return;

    // Track user swipe patterns for smart preloading
    if (userSwipePattern && this.preloadConfig.enableSmartPreload) {
      this.trackSwipePattern(userSwipePattern);
    }

    // Calculate preload range based on user patterns
    const preloadRange = this.calculatePreloadRange(currentIndex, videos.length, userSwipePattern);
    
    console.log(`🔄 Preloading videos around index ${currentIndex}, range: ${preloadRange.start}-${preloadRange.end}`);

    // Queue videos for preloading
    for (let i = preloadRange.start; i <= preloadRange.end; i++) {
      if (i >= 0 && i < videos.length) {
        const video = videos[i];
        await this.queueVideoForPreload(video, i === currentIndex);
      }
    }

    // Clean up videos outside range
    this.cleanupDistantVideos(currentIndex, videos);
  }

  /**
   * Calculate optimal preload range based on user behavior
   */
  private calculatePreloadRange(
    currentIndex: number, 
    totalVideos: number, 
    userSwipePattern?: { velocity: number; direction: 'up' | 'down' }
  ): { start: number; end: number } {
    let preloadAhead = this.preloadConfig.preloadCount;
    let preloadBehind = this.preloadConfig.preloadBehind;

    // Smart preloading based on user behavior
    if (this.preloadConfig.enableSmartPreload && userSwipePattern) {
      const avgVelocity = this.getAverageSwipeVelocity();
      
      // If user swipes fast, preload more ahead
      if (avgVelocity > 0.5) {
        preloadAhead = Math.min(5, preloadAhead + 2);
      }
      
      // Adjust based on swipe direction tendency
      if (userSwipePattern.direction === 'up') {
        preloadAhead += 1; // Preload more in scroll direction
      } else {
        preloadBehind += 1; // User might be going back
      }
    }

    const start = Math.max(0, currentIndex - preloadBehind);
    const end = Math.min(totalVideos - 1, currentIndex + preloadAhead);

    return { start, end };
  }

  /**
   * Queue video for preloading
   */
  private async queueVideoForPreload(video: VideoData, isPriority: boolean = false): Promise<void> {
    const videoId = video.assetId;

    // Skip if already preloaded or loading
    if (this.preloadedVideos.has(videoId) || this.activePreloads.has(videoId)) {
      return;
    }

    // Add to queue
    if (isPriority) {
      this.preloadQueue.unshift(videoId); // Add to front for current video
    } else {
      this.preloadQueue.push(videoId);
    }

    // Initialize preload status
    this.preloadedVideos.set(videoId, {
      video,
      preloadStatus: 'pending',
      preloadProgress: 0,
      preloadStartTime: Date.now()
    });

    // Process queue
    this.processPreloadQueue();
  }

  /**
   * Process preload queue with concurrency control
   */
  private async processPreloadQueue(): Promise<void> {
    // Don't exceed max concurrent preloads
    if (this.activePreloads.size >= this.preloadConfig.maxConcurrentPreloads) {
      return;
    }

    const videoId = this.preloadQueue.shift();
    if (!videoId) return;

    const preloadedVideo = this.preloadedVideos.get(videoId);
    if (!preloadedVideo) return;

    // Start preloading
    this.activePreloads.add(videoId);
    
    try {
      await this.preloadSingleVideo(preloadedVideo);
    } catch (error) {
      console.error(`❌ Failed to preload video ${videoId}:`, error);
      preloadedVideo.preloadStatus = 'error';
    } finally {
      this.activePreloads.delete(videoId);
      // Process next in queue
      if (this.preloadQueue.length > 0) {
        setTimeout(() => this.processPreloadQueue(), 100);
      }
    }
  }

  /**
   * Preload a single video
   */
  private async preloadSingleVideo(preloadedVideo: PreloadedVideo): Promise<void> {
    const { video } = preloadedVideo;
    
    preloadedVideo.preloadStatus = 'loading';
    console.log(`📥 Starting preload for video: ${video.assetId}`);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Preload timeout'));
      }, this.preloadConfig.preloadTimeoutMs);

      // For React Native, we can use Image.prefetch for thumbnails
      // and create a hidden Video component for video preloading
      
      // Preload thumbnail first
      if (video.thumbnailUrl) {
        // This would be platform-specific implementation
        // For now, we'll simulate the preload
        this.simulatePreload(preloadedVideo, timeoutId, resolve, reject);
      } else {
        // Skip to video preload
        this.simulatePreload(preloadedVideo, timeoutId, resolve, reject);
      }
    });
  }

  /**
   * Simulate preload process (replace with actual implementation)
   */
  private simulatePreload(
    preloadedVideo: PreloadedVideo,
    timeoutId: ReturnType<typeof setTimeout>,
    resolve: () => void,
    reject: (error: Error) => void
  ): void {
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 20 + 10; // Simulate variable progress
      preloadedVideo.preloadProgress = Math.min(100, progress);

      if (progress >= 100) {
        clearInterval(progressInterval);
        clearTimeout(timeoutId);
        
        preloadedVideo.preloadStatus = 'loaded';
        preloadedVideo.preloadEndTime = Date.now();
        
        const loadTime = preloadedVideo.preloadEndTime - preloadedVideo.preloadStartTime;
        console.log(`✅ Preloaded video ${preloadedVideo.video.assetId} in ${loadTime}ms`);
        
        resolve();
      }
    }, 200); // Update progress every 200ms
  }

  /**
   * Check if video is preloaded and ready
   */
  isVideoPreloaded(videoId: string): boolean {
    const preloadedVideo = this.preloadedVideos.get(videoId);
    return preloadedVideo?.preloadStatus === 'loaded';
  }

  /**
   * Get preload status for video
   */
  getPreloadStatus(videoId: string): PreloadedVideo | null {
    return this.preloadedVideos.get(videoId) || null;
  }

  /**
   * Clean up videos that are too far from current position
   */
  private cleanupDistantVideos(currentIndex: number, videos: VideoData[]): void {
    const cleanupDistance = this.preloadConfig.preloadCount + this.preloadConfig.preloadBehind + 2;
    
    this.preloadedVideos.forEach((preloadedVideo, videoId) => {
      const videoIndex = videos.findIndex(v => v.assetId === videoId);
      
      if (videoIndex !== -1 && Math.abs(videoIndex - currentIndex) > cleanupDistance) {
        this.preloadedVideos.delete(videoId);
        console.log(`🗑️ Cleaned up preloaded video: ${videoId}`);
      }
    });
  }

  /**
   * Track user swipe patterns for smart preloading
   */
  private trackSwipePattern(swipePattern: { velocity: number; direction: 'up' | 'down' }): void {
    this.userSwipeVelocity.push(swipePattern.velocity);
    
    // Keep only recent swipe data (last 20 swipes)
    if (this.userSwipeVelocity.length > 20) {
      this.userSwipeVelocity.shift();
    }
  }

  /**
   * Get average swipe velocity for smart preloading
   */
  private getAverageSwipeVelocity(): number {
    if (this.userSwipeVelocity.length === 0) return 0.3; // Default moderate speed
    
    const sum = this.userSwipeVelocity.reduce((a, b) => a + b, 0);
    return sum / this.userSwipeVelocity.length;
  }

  /**
   * Force preload specific video (high priority)
   */
  async forcePreloadVideo(video: VideoData): Promise<void> {
    console.log(`⚡ Force preloading video: ${video.assetId}`);
    await this.queueVideoForPreload(video, true);
  }

  /**
   * Clear all preloaded videos (memory cleanup)
   */
  clearAllPreloads(): void {
    this.preloadedVideos.clear();
    this.activePreloads.clear();
    this.preloadQueue.length = 0;
    console.log('🧹 Cleared all preloaded videos');
  }

  /**
   * Get preload statistics
   */
  getPreloadStats(): {
    totalPreloaded: number;
    currentlyLoading: number;
    queueLength: number;
    avgLoadTime: number;
  } {
    const loadedVideos = Array.from(this.preloadedVideos.values()).filter(v => v.preloadStatus === 'loaded');
    const avgLoadTime = loadedVideos.length > 0 
      ? loadedVideos.reduce((sum, v) => sum + ((v.preloadEndTime || Date.now()) - v.preloadStartTime), 0) / loadedVideos.length
      : 0;

    return {
      totalPreloaded: this.preloadedVideos.size,
      currentlyLoading: this.activePreloads.size,
      queueLength: this.preloadQueue.length,
      avgLoadTime
    };
  }

  /**
   * Update preload configuration
   */
  updateConfig(newConfig: Partial<PreloadConfig>): void {
    this.preloadConfig = { ...this.preloadConfig, ...newConfig };
    console.log('🔧 Updated preload config:', this.preloadConfig);
  }
}

export const videoPreloadService = new VideoPreloadService();
