/**
 * Video Codec Detection Utilities
 * 
 * Helps detect and handle video codec compatibility issues
 * before attempting to load videos.
 */

import { Platform } from 'react-native';

export interface CodecSupport {
  hevc: boolean;
  h264: boolean;
  vp9: boolean;
  av1: boolean;
}

/**
 * Get device codec support capabilities
 */
export const getDeviceCodecSupport = (): CodecSupport => {
  const isAndroid = Platform.OS === 'android';
  const isIOS = Platform.OS === 'ios';
  
  return {
    hevc: isIOS, // iOS generally supports HEVC, Android support varies widely
    h264: true,  // Universal support across all platforms
    vp9: isAndroid, // Better Android support, limited iOS support
    av1: false,     // Limited support currently, future codec
  };
};

/**
 * Detect if a video URL likely contains HEVC content
 */
export const isLikelyHEVCVideo = (url: string): boolean => {
  if (!url) return false;
  
  const hevcPatterns = [
    // File extensions
    /\.h265$/i,
    /\.hevc$/i,
    
    // URL parameters or paths containing codec info
    /codec[=:]h265/i,
    /codec[=:]hevc/i,
    /video[/_]h265/i,
    /video[/_]hevc/i,
    /h265[/_]/i,
    /hevc[/_]/i,
    
    // Common streaming platform patterns
    /&codec=h265/i,
    /&codec=hevc/i,
    /-h265-/i,
    /-hevc-/i,
  ];
  
  return hevcPatterns.some(pattern => pattern.test(url));
};

/**
 * Check if a video is compatible with the current device
 */
export const isVideoCompatible = (videoUrl: string): boolean => {
  const codecSupport = getDeviceCodecSupport();
  
  // If device doesn't support HEVC and video appears to be HEVC
  if (!codecSupport.hevc && isLikelyHEVCVideo(videoUrl)) {
    return false;
  }
  
  // Default to compatible for unknown formats
  return true;
};

/**
 * Filter video list to only include compatible videos
 */
export const filterCompatibleVideos = <T extends { playbackUrl: string; assetId: string }>(
  videos: T[]
): T[] => {
  const filtered = videos.filter(video => {
    const compatible = isVideoCompatible(video.playbackUrl);
    
    if (!compatible) {
      console.warn(`🚫 Filtering out incompatible video: ${video.assetId} (likely HEVC on unsupported device)`);
    }
    
    return compatible;
  });
  
  console.log(`📊 Video compatibility filter: ${videos.length} → ${filtered.length} videos`);
  
  return filtered;
};

/**
 * Get alternative video URL if available
 * This could be enhanced to request different formats from your backend
 */
export const getAlternativeVideoUrl = (originalUrl: string): string | null => {
  // For now, just return null
  // In a real implementation, you might:
  // 1. Request a different format from your backend
  // 2. Use a different quality/codec variant
  // 3. Fallback to a transcoded version
  
  return null;
};

/**
 * Log codec compatibility information for debugging
 */
export const logCodecInfo = () => {
  const support = getDeviceCodecSupport();
  
  console.log('🎬 Device Codec Support:');
  console.log(`  📱 Platform: ${Platform.OS}`);
  console.log(`  ✅ H.264: ${support.h264 ? 'Supported' : 'Not Supported'}`);
  console.log(`  🎯 HEVC: ${support.hevc ? 'Supported' : 'Not Supported'}`);
  console.log(`  📺 VP9: ${support.vp9 ? 'Supported' : 'Not Supported'}`);
  console.log(`  🔮 AV1: ${support.av1 ? 'Supported' : 'Not Supported'}`);
};
