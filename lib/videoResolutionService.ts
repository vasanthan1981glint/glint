/**
 * 🎬 VIDEO RESOLUTION FILTER SERVICE
 * Filters out problematic 4K videos and manages codec compatibility
 */

interface VideoResolution {
  width: number;
  height: number;
  isSupported: boolean;
  quality: 'SD' | 'HD' | '4K' | 'Unknown';
}

interface DeviceCapabilities {
  maxResolution: { width: number; height: number };
  supportedCodecs: string[];
  memoryLimit: number; // MB
}

class VideoResolutionService {
  private deviceCapabilities: DeviceCapabilities;

  constructor() {
    this.deviceCapabilities = this.detectDeviceCapabilities();
  }

  /**
   * Detect device capabilities based on platform and performance
   */
  private detectDeviceCapabilities(): DeviceCapabilities {
    // Conservative defaults to prevent crashes
    const baseCapabilities: DeviceCapabilities = {
      maxResolution: { width: 1920, height: 1080 }, // Default to 1080p
      supportedCodecs: ['h264', 'avc1'],
      memoryLimit: 256 // 256MB limit for videos
    };

    // TODO: Add device-specific detection logic
    // For now, use conservative settings to prevent crashes
    
    console.log('🎬 Device capabilities detected:', baseCapabilities);
    return baseCapabilities;
  }

  /**
   * Check if a video URL is likely 4K based on common patterns
   */
  private detect4KVideo(videoUrl: string): boolean {
    const url4KPatterns = [
      /3840x2160/i,
      /4k/i,
      /uhd/i,
      /2160p/i,
      /high\.mp4/i,
      /4096x/i
    ];

    return url4KPatterns.some(pattern => pattern.test(videoUrl));
  }

  /**
   * Extract resolution from video metadata or URL
   */
  parseVideoResolution(videoUrl: string, metadata?: any): VideoResolution {
    let width = 1920;
    let height = 1080;
    let quality: 'SD' | 'HD' | '4K' | 'Unknown' = 'Unknown';

    // Try to get resolution from metadata first
    if (metadata?.naturalSize) {
      width = metadata.naturalSize.width || width;
      height = metadata.naturalSize.height || height;
    }

    // Fallback to URL pattern detection
    if (this.detect4KVideo(videoUrl)) {
      width = 3840;
      height = 2160;
      quality = '4K';
    } else if (videoUrl.includes('1080p') || videoUrl.includes('1920x1080')) {
      width = 1920;
      height = 1080;
      quality = 'HD';
    } else if (videoUrl.includes('720p') || videoUrl.includes('1280x720')) {
      width = 1280;
      height = 720;
      quality = 'HD';
    } else if (videoUrl.includes('480p') || videoUrl.includes('854x480')) {
      width = 854;
      height = 480;
      quality = 'SD';
    }

    // Determine if resolution is supported
    const isSupported = (
      width <= this.deviceCapabilities.maxResolution.width &&
      height <= this.deviceCapabilities.maxResolution.height &&
      quality !== '4K' // Temporarily block all 4K videos
    );

    return {
      width,
      height,
      isSupported,
      quality
    };
  }

  /**
   * Filter videos to remove unsupported resolutions
   */
  filterSupportedVideos<T extends { playbackUrl: string; id: string }>(videos: T[]): T[] {
    const supportedVideos: T[] = [];
    let filtered4K = 0;
    let filteredOther = 0;

    for (const video of videos) {
      const resolution = this.parseVideoResolution(video.playbackUrl);
      
      if (resolution.isSupported) {
        supportedVideos.push(video);
      } else {
        if (resolution.quality === '4K') {
          filtered4K++;
          console.log(`🚫 Filtered 4K video: ${video.id} (${resolution.width}x${resolution.height})`);
        } else {
          filteredOther++;
          console.log(`🚫 Filtered unsupported video: ${video.id} (${resolution.width}x${resolution.height})`);
        }
      }
    }

    if (filtered4K > 0 || filteredOther > 0) {
      console.log(`🎬 Video filtering results:`);
      console.log(`   ✅ Supported: ${supportedVideos.length}`);
      console.log(`   🚫 Filtered 4K: ${filtered4K}`);
      console.log(`   🚫 Filtered other: ${filteredOther}`);
    }

    return supportedVideos;
  }

  /**
   * Get alternative video URL for unsupported videos
   */
  getAlternativeVideoUrl(originalUrl: string): string | null {
    // Try to find a lower resolution version
    const alternatives = [
      originalUrl.replace(/4k|3840x2160|2160p/gi, '1080p'),
      originalUrl.replace(/high\.mp4/i, 'medium.mp4'),
      originalUrl.replace(/uhd/gi, 'hd'),
    ];

    // Return the first alternative that looks different
    for (const alt of alternatives) {
      if (alt !== originalUrl) {
        console.log(`🔄 Alternative URL found: ${alt}`);
        return alt;
      }
    }

    return null;
  }

  /**
   * Process video before playback
   */
  processVideoForPlayback(video: { playbackUrl: string; id: string }): {
    url: string;
    isOriginal: boolean;
    resolution: VideoResolution;
  } {
    const resolution = this.parseVideoResolution(video.playbackUrl);
    
    if (resolution.isSupported) {
      return {
        url: video.playbackUrl,
        isOriginal: true,
        resolution
      };
    }

    // Try to get alternative URL
    const alternativeUrl = this.getAlternativeVideoUrl(video.playbackUrl);
    
    if (alternativeUrl) {
      const altResolution = this.parseVideoResolution(alternativeUrl);
      if (altResolution.isSupported) {
        console.log(`🔄 Using alternative URL for ${video.id}`);
        return {
          url: alternativeUrl,
          isOriginal: false,
          resolution: altResolution
        };
      }
    }

    // If no alternative works, return original but mark as unsupported
    console.warn(`⚠️ No supported alternative found for ${video.id}`);
    return {
      url: video.playbackUrl,
      isOriginal: true,
      resolution
    };
  }

  /**
   * Check if device can handle additional video loading
   */
  canLoadMoreVideos(currentVideoCount: number): boolean {
    const maxVideos = this.deviceCapabilities.memoryLimit / 32; // Assume ~32MB per video
    return currentVideoCount < maxVideos;
  }

  /**
   * Get recommended video quality for current device
   */
  getRecommendedQuality(): 'SD' | 'HD' | '4K' {
    // Conservative approach - recommend HD for most devices
    return 'HD';
  }
}

export const videoResolutionService = new VideoResolutionService();
