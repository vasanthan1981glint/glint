/**
 * 🚀 VIDEO PRELOADER HOOK (React Native)
 * Preloads videos in the background for instant playback
 * Optimizes video loading performance with intelligent caching
 */

import { Video } from 'expo-av';
import { useCallback, useEffect, useRef } from 'react';

interface VideoData {
  assetId: string;
  playbackUrl: string;
  thumbnailUrl?: string;
}

interface VideoPreloaderConfig {
  preloadRadius: number; // How many videos to preload around current
  maxConcurrentLoads: number; // Max simultaneous video loads
  enableBackgroundPreload: boolean; // Preload when app is active
}

export const useVideoPreloader = (
  videos: VideoData[],
  currentIndex: number,
  videoRefs: React.MutableRefObject<{ [key: string]: Video }>,
  config: VideoPreloaderConfig = {
    preloadRadius: 2,
    maxConcurrentLoads: 2,
    enableBackgroundPreload: true,
  }
) => {
  const preloadedVideos = useRef<Set<string>>(new Set());
  const loadingVideos = useRef<Set<string>>(new Set());
  const preloadPromises = useRef<Map<string, Promise<any>>>(new Map());

  // 🚀 Intelligent Video Preloader for React Native
  const preloadVideo = useCallback(async (video: VideoData): Promise<boolean> => {
    if (preloadedVideos.current.has(video.assetId) || 
        loadingVideos.current.has(video.assetId)) {
      return true; // Already preloaded or loading
    }

    // Respect concurrent load limit
    if (loadingVideos.current.size >= config.maxConcurrentLoads) {
      return false;
    }

    const videoRef = videoRefs.current[video.assetId];
    if (!videoRef) {
      return false; // No video ref available
    }

    loadingVideos.current.add(video.assetId);

    try {
      // Preload the video using Expo AV
      const preloadPromise = videoRef.loadAsync(
        { uri: video.playbackUrl },
        { 
          shouldPlay: false,
          isLooping: false,
          isMuted: true,
          volume: 0,
        },
        false // Don't download to device
      );

      preloadPromises.current.set(video.assetId, preloadPromise);
      
      await preloadPromise;
      preloadedVideos.current.add(video.assetId);
      loadingVideos.current.delete(video.assetId);
      
      return true;

    } catch (error) {
      console.warn(`Video preload failed for ${video.assetId}:`, error);
      loadingVideos.current.delete(video.assetId);
      preloadPromises.current.delete(video.assetId);
      return false;
    }
  }, [config.maxConcurrentLoads, videoRefs]);

  // 🎯 Smart Preload Strategy
  const preloadVideosAroundIndex = useCallback(async (centerIndex: number) => {
    if (!config.enableBackgroundPreload) return;

    const videosToPreload: { video: VideoData; priority: number }[] = [];
    
    // Calculate which videos to preload with priority
    for (let i = 1; i <= config.preloadRadius; i++) {
      // Next videos (higher priority)
      const nextIndex = centerIndex + i;
      if (nextIndex < videos.length) {
        const video = videos[nextIndex];
        if (!preloadedVideos.current.has(video.assetId) && videoRefs.current[video.assetId]) {
          videosToPreload.push({ video, priority: 10 - i }); // Higher priority for closer videos
        }
      }

      // Previous videos (lower priority)
      const prevIndex = centerIndex - i;
      if (prevIndex >= 0) {
        const video = videos[prevIndex];
        if (!preloadedVideos.current.has(video.assetId) && videoRefs.current[video.assetId]) {
          videosToPreload.push({ video, priority: 5 - i }); // Lower priority for previous videos
        }
      }
    }

    // Sort by priority (higher priority first)
    videosToPreload.sort((a, b) => b.priority - a.priority);

    // Preload videos sequentially to avoid overwhelming the system
    for (const { video } of videosToPreload) {
      if (loadingVideos.current.size >= config.maxConcurrentLoads) {
        break; // Respect concurrent load limit
      }
      
      // Don't await - let it preload in background
      preloadVideo(video).catch(() => {
        // Silent fail - preloading is best effort
      });
    }

  }, [videos, config.preloadRadius, config.enableBackgroundPreload, config.maxConcurrentLoads, preloadVideo, videoRefs]);

  // 🔄 Preload Effect
  useEffect(() => {
    // Small delay to let current video start playing first
    const timer = setTimeout(() => {
      preloadVideosAroundIndex(currentIndex);
    }, 500);

    return () => clearTimeout(timer);
  }, [currentIndex, preloadVideosAroundIndex]);

  // 🧹 Cleanup Effect
  useEffect(() => {
    return () => {
      // Cancel all pending preloads
      preloadPromises.current.clear();
      loadingVideos.current.clear();
    };
  }, []);

  // 📊 Preload Status
  const getPreloadStatus = useCallback((assetId: string) => {
    if (preloadedVideos.current.has(assetId)) return 'preloaded';
    if (loadingVideos.current.has(assetId)) return 'loading';
    return 'not-loaded';
  }, []);

  // 🗑️ Clear Preload Cache
  const clearPreloadCache = useCallback(() => {
    preloadedVideos.current.clear();
    loadingVideos.current.clear();
    preloadPromises.current.clear();
  }, []);

  // 🎯 Force Preload Next Video
  const preloadNextVideo = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < videos.length) {
      const nextVideo = videos[nextIndex];
      preloadVideo(nextVideo).catch(() => {});
    }
  }, [currentIndex, videos, preloadVideo]);

  return {
    preloadVideo,
    preloadNextVideo,
    getPreloadStatus,
    clearPreloadCache,
    preloadedCount: preloadedVideos.current.size,
    loadingCount: loadingVideos.current.size,
  };
};
