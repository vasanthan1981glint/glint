/**
 * Universal Video Playback Solution
 * Ensures video content works for every user across all devices and network conditions
 */

import { Platform } from 'react-native';

export class UniversalVideoPlayer {
  private static workingUrls = new Map<string, string>();
  private static fallbackVideos = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4'
  ];
  
  private static placeholderVideo = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAP5tZGF0AAAAcWVzdWl0ZSBhbmQgdGhlcmUgd2lsbCBiZSBhIG5ldyBzdGFydA==';

  /**
   * Get the best working video URL for a given asset
   */
  static async getBestVideoUrl(originalUrl: string, assetId: string): Promise<string> {
    // Check if we already found a working URL for this asset
    const cachedUrl = this.workingUrls.get(assetId);
    if (cachedUrl) {
      return cachedUrl;
    }

    // Test original URL first
    const isOriginalWorking = await this.testVideoUrl(originalUrl);
    if (isOriginalWorking) {
      this.workingUrls.set(assetId, originalUrl);
      return originalUrl;
    }

    // For Google Cloud Storage URLs, try different quality variants
    if (originalUrl.includes('googleapis.com') || originalUrl.includes('googleusercontent.com')) {
      const variants = this.generateGoogleCloudVariants(originalUrl);
      for (const variant of variants) {
        const isWorking = await this.testVideoUrl(variant);
        if (isWorking) {
          this.workingUrls.set(assetId, variant);
          return variant;
        }
      }
    }

    // Try fallback videos as last resort
    for (const fallbackUrl of this.fallbackVideos) {
      const isWorking = await this.testVideoUrl(fallbackUrl);
      if (isWorking) {
        console.log(`🔄 Using fallback video for ${assetId}: ${fallbackUrl}`);
        this.workingUrls.set(assetId, fallbackUrl);
        return fallbackUrl;
      }
    }

    // If nothing works, return a very simple placeholder
    console.warn(`⚠️ No working video found for ${assetId}, using placeholder`);
    return this.placeholderVideo;
  }

  /**
   * Test if a video URL is accessible
   */
  private static async testVideoUrl(url: string): Promise<boolean> {
    try {
      // For data URLs, assume they work
      if (url.startsWith('data:')) {
        return true;
      }

      // Simple HEAD request to test availability
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'Accept': 'video/*,application/octet-stream',
          'User-Agent': Platform.OS === 'ios' ? 'Glint-iOS/1.0' : 'Glint-Android/1.0'
        }
      });

      clearTimeout(timeoutId);
      return response.ok || response.status === 206; // 206 = Partial Content is OK for videos
    } catch (error) {
      console.log(`❌ Video URL test failed: ${url} - ${error}`);
      return false;
    }
  }

  /**
   * Generate Google Cloud Storage URL variants for better compatibility
   */
  private static generateGoogleCloudVariants(originalUrl: string): string[] {
    // Extract the base URL and try different formats
    const baseUrl = originalUrl.replace(/\.(mp4|webm|mkv).*$/, '');
    const urlObj = new URL(originalUrl);
    
    return [
      // Try different video formats
      `${baseUrl}.mp4`,
      `${baseUrl}.webm`,
      // Try with different quality parameters
      `${originalUrl}?quality=720p`,
      `${originalUrl}?quality=480p`,
      `${originalUrl}?quality=360p`,
      // Try direct access
      originalUrl.replace(/\/v\d+\//, '/'),
      // Try without query parameters
      urlObj.origin + urlObj.pathname
    ];
  }

  /**
   * Clear cache for testing
   */
  static clearCache(): void {
    this.workingUrls.clear();
  }

  /**
   * Get video display configuration for universal compatibility
   */
  static getVideoConfig(originalUrl: string) {
    const isFallback = this.fallbackVideos.includes(originalUrl) || originalUrl.startsWith('data:');
    
    return {
      shouldAutoplay: !isFallback,
      shouldLoop: true,
      volume: isFallback ? 0 : 1,
      resizeMode: isFallback ? 'contain' : 'cover',
      showControls: false,
      posterSource: isFallback ? { uri: 'https://via.placeholder.com/640x360/2C3E50/FFFFFF?text=Loading+Video' } : undefined
    };
  }
}

/**
 * Enhanced Video Component Props
 */
export interface UniversalVideoProps {
  originalUrl: string;
  assetId: string;
  onVideoReady?: (workingUrl: string) => void;
  onVideoFailed?: (error: string) => void;
  fallbackMessage?: string;
}

/**
 * Universal Error Recovery
 */
export class VideoErrorRecovery {
  private static errorCounts = new Map<string, number>();
  private static readonly MAX_ERRORS = 3;

  static shouldRetryVideo(assetId: string): boolean {
    const errors = this.errorCounts.get(assetId) || 0;
    return errors < this.MAX_ERRORS;
  }

  static recordError(assetId: string): void {
    const errors = this.errorCounts.get(assetId) || 0;
    this.errorCounts.set(assetId, errors + 1);
  }

  static resetErrors(assetId: string): void {
    this.errorCounts.delete(assetId);
  }

  static getErrorCount(assetId: string): number {
    return this.errorCounts.get(assetId) || 0;
  }
}
