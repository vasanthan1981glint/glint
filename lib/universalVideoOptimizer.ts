// Universal Video Player Optimizations for All Phones
// This file contains optimizations to ensure videos work on all devices

import { Platform } from 'react-native';

export interface VideoOptimizationConfig {
  // Video quality settings based on device performance
  quality: 'high' | 'medium' | 'low';
  // Buffer size optimizations
  bufferSize: number;
  // Retry configurations
  maxRetries: number;
  retryDelay: number;
  // Performance settings
  preloadNext: boolean;
  enableHardwareAcceleration: boolean;
}

export class UniversalVideoOptimizer {
  
  /**
   * Get optimized video configuration based on device capabilities
   */
  static getOptimizedConfig(): VideoOptimizationConfig {
    // Default configuration for all devices
    const baseConfig: VideoOptimizationConfig = {
      quality: 'medium',
      bufferSize: 5000, // 5 seconds
      maxRetries: 3,
      retryDelay: 1500,
      preloadNext: false,
      enableHardwareAcceleration: true
    };

    // Platform-specific optimizations
    if (Platform.OS === 'android') {
      return {
        ...baseConfig,
        // Android optimizations
        quality: 'medium', // Better compatibility on Android
        bufferSize: 3000, // Smaller buffer for lower-end devices
        retryDelay: 2000, // Longer retry delay
        preloadNext: false, // Disable preloading to save memory
      };
    } else if (Platform.OS === 'ios') {
      return {
        ...baseConfig,
        // iOS optimizations
        quality: 'high', // iOS generally handles higher quality better
        bufferSize: 5000,
        retryDelay: 1000, // Faster retries on iOS
        preloadNext: true, // iOS can handle preloading better
      };
    }

    return baseConfig;
  }

  /**
   * Get video source with fallback URLs for better compatibility
   */
  static getOptimizedVideoSource(originalUrl: string) {
    // Add fallback sources and optimization parameters
    const optimizedSource = {
      uri: originalUrl,
      // Add headers for better compatibility
      headers: {
        'User-Agent': 'Glint-Mobile-App',
        'Accept': 'video/*',
      },
      // Cache configuration
      cache: 'force-cache' as const,
      // Network timeout
      timeout: 30000, // 30 seconds
    };

    return optimizedSource;
  }

  /**
   * Error categorization and handling
   */
  static categorizeVideoError(error: any): {
    type: 'network' | 'codec' | 'permission' | 'unknown';
    recoverable: boolean;
    message: string;
  } {
    const errorString = typeof error === 'string' ? error : JSON.stringify(error);
    
    // Network errors
    if (errorString.includes('-1100') || 
        errorString.includes('NSURLErrorDomain') ||
        errorString.includes('network') ||
        errorString.includes('connection') ||
        errorString.includes('timeout')) {
      return {
        type: 'network',
        recoverable: true,
        message: 'Network connection issue. Please check your internet connection.'
      };
    }

    // Codec/format errors
    if (errorString.includes('codec') || 
        errorString.includes('format') ||
        errorString.includes('unsupported')) {
      return {
        type: 'codec',
        recoverable: false,
        message: 'Video format not supported on your device.'
      };
    }

    // Permission errors
    if (errorString.includes('permission') || 
        errorString.includes('access')) {
      return {
        type: 'permission',
        recoverable: false,
        message: 'Permission denied. Please check app permissions.'
      };
    }

    // Unknown errors
    return {
      type: 'unknown',
      recoverable: true,
      message: 'An unexpected error occurred. Please try again.'
    };
  }

  /**
   * Performance monitoring for video playback
   */
  static monitorVideoPerformance(videoId: string, event: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logData = {
      videoId,
      event,
      timestamp,
      platform: Platform.OS,
      data
    };

    console.log(`📊 Video Performance [${event}]:`, logData);

    // In production, you could send this data to analytics
    // Analytics.track('video_performance', logData);
  }

  /**
   * Optimize video URLs for different platforms
   */
  static optimizeVideoUrl(url: string): string {
    if (!url) return url;

    // Add platform-specific optimizations to Mux URLs
    if (url.includes('mux.com')) {
      const separator = url.includes('?') ? '&' : '?';
      
      if (Platform.OS === 'android') {
        // Android optimizations
        return `${url}${separator}resolution=720p&format=mp4`;
      } else if (Platform.OS === 'ios') {
        // iOS optimizations - can handle higher quality
        return `${url}${separator}resolution=1080p&format=mp4`;
      }
    }

    return url;
  }

  /**
   * Get recommended video settings for thumbnails
   */
  static getThumbnailSettings() {
    return {
      // Responsive thumbnail sizes
      width: Platform.OS === 'android' ? 150 : 200,
      height: Platform.OS === 'android' ? 150 : 200,
      // Quality settings
      quality: Platform.OS === 'android' ? 0.7 : 0.9,
      // Cache settings
      cache: 'force-cache' as const,
      // Timeout
      timeout: 10000, // 10 seconds for thumbnails
    };
  }

  /**
   * Memory management for video lists
   */
  static getListOptimizations() {
    return {
      // How many videos to render at once
      maxToRenderPerBatch: Platform.OS === 'android' ? 6 : 12,
      // Window size for virtualization
      windowSize: Platform.OS === 'android' ? 8 : 10,
      // Initial number to render
      initialNumToRender: Platform.OS === 'android' ? 6 : 9,
      // Remove clipped subviews for memory optimization
      removeClippedSubviews: Platform.OS === 'android',
      // Update batching period
      updateCellsBatchingPeriod: 50,
    };
  }
}

// Export a singleton instance for convenience
export const VideoOptimizer = new UniversalVideoOptimizer();

// Export utility functions
export const getVideoConfig = UniversalVideoOptimizer.getOptimizedConfig;
export const optimizeVideoSource = UniversalVideoOptimizer.getOptimizedVideoSource;
export const categorizeVideoError = UniversalVideoOptimizer.categorizeVideoError;
export const monitorVideoPerformance = UniversalVideoOptimizer.monitorVideoPerformance;
