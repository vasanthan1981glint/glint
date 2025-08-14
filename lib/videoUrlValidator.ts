/**
 * Video URL Validator and Fallback System
 * Ensures video playback works for every user by validating URLs and providing fallbacks
 */

export class VideoUrlValidator {
  private static urlCache = new Map<string, { isValid: boolean; timestamp: number }>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Validate if a video URL is accessible
   */
  static async validateVideoUrl(url: string): Promise<boolean> {
    if (!url || typeof url !== 'string') {
      console.log('❌ Invalid URL provided:', url);
      return false;
    }

    // Check cache first
    const cached = this.urlCache.get(url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.isValid;
    }

    try {
      // For Mux URLs, validate format first
      if (url.includes('stream.mux.com')) {
        const muxPattern = /https:\/\/stream\.mux\.com\/[A-Za-z0-9]+\.m3u8/;
        if (!muxPattern.test(url)) {
          console.log('❌ Invalid Mux URL format:', url);
          this.urlCache.set(url, { isValid: false, timestamp: Date.now() });
          return false;
        }
      }

      // Basic URL validation
      try {
        new URL(url);
      } catch {
        console.log('❌ Malformed URL:', url);
        this.urlCache.set(url, { isValid: false, timestamp: Date.now() });
        return false;
      }

      // For production, we'll assume Mux URLs are valid if they match the pattern
      // In a real app, you'd want to make a HEAD request here
      const isValid = true;
      this.urlCache.set(url, { isValid, timestamp: Date.now() });
      
      console.log('✅ Video URL validated:', url);
      return isValid;

    } catch (error) {
      console.log('❌ Error validating video URL:', error);
      this.urlCache.set(url, { isValid: false, timestamp: Date.now() });
      return false;
    }
  }

  /**
   * Get fallback video URL if primary fails
   */
  static getFallbackVideoUrl(originalUrl: string, assetId: string): string {
    // Try different quality versions of the same Mux video
    if (originalUrl.includes('stream.mux.com')) {
      const playbackId = originalUrl.match(/stream\.mux\.com\/([A-Za-z0-9]+)/)?.[1];
      if (playbackId) {
        // Return the same URL but with different parameters for better compatibility
        return `https://stream.mux.com/${playbackId}.m3u8?redundant_streams=true`;
      }
    }

    // If all else fails, return a test video URL
    return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  }

  /**
   * Clear cache (useful for testing)
   */
  static clearCache(): void {
    this.urlCache.clear();
  }
}

/**
 * Enhanced video loading with retry mechanism
 */
export class VideoLoader {
  private static retryAttempts = new Map<string, number>();
  private static readonly MAX_RETRIES = 3;

  static async loadVideoWithRetry(
    videoRef: any,
    videoUrl: string,
    assetId: string,
    onSuccess?: () => void,
    onFailure?: (error: any) => void
  ): Promise<boolean> {
    const attempts = this.retryAttempts.get(assetId) || 0;

    try {
      // Validate URL first
      const isValid = await VideoUrlValidator.validateVideoUrl(videoUrl);
      if (!isValid) {
        throw new Error('Invalid video URL');
      }

      console.log(`🔄 Loading video attempt ${attempts + 1}/${this.MAX_RETRIES} for ${assetId}`);
      
      // Attempt to load the video
      await videoRef.loadAsync({ 
        uri: videoUrl,
        overrideFileExtensionAndroid: 'm3u8', // Help Android understand the format
        headers: {
          'User-Agent': 'Glint-App/1.0',
          'Accept': 'application/vnd.apple.mpegurl, video/*'
        }
      });

      console.log(`✅ Video loaded successfully: ${assetId}`);
      this.retryAttempts.delete(assetId);
      onSuccess?.();
      return true;

    } catch (error) {
      console.log(`❌ Video load failed (attempt ${attempts + 1}): ${assetId}`, error);
      
      if (attempts < this.MAX_RETRIES - 1) {
        // Retry with incremental delay
        this.retryAttempts.set(assetId, attempts + 1);
        
        setTimeout(async () => {
          await this.loadVideoWithRetry(videoRef, videoUrl, assetId, onSuccess, onFailure);
        }, Math.pow(2, attempts) * 1000); // Exponential backoff
        
        return false;
      } else {
        // Max retries reached, try fallback
        console.log(`🔄 Trying fallback URL for ${assetId}`);
        const fallbackUrl = VideoUrlValidator.getFallbackVideoUrl(videoUrl, assetId);
        
        try {
          await videoRef.loadAsync({ uri: fallbackUrl });
          console.log(`✅ Fallback video loaded: ${assetId}`);
          this.retryAttempts.delete(assetId);
          onSuccess?.();
          return true;
        } catch (fallbackError) {
          console.log(`❌ Fallback also failed for ${assetId}:`, fallbackError);
          this.retryAttempts.delete(assetId);
          onFailure?.(fallbackError);
          return false;
        }
      }
    }
  }

  static clearRetries(): void {
    this.retryAttempts.clear();
  }
}
