/**
 * 🚀 VIDEO PERFORMANCE OPTIMIZATION CONFIG
 * Advanced settings for maximum video loading speed and smooth playback
 */

export interface VideoOptimizationConfig {
  // 🔄 Preloading Settings
  preloading: {
    enabled: boolean;
    preloadRadius: number; // How many videos ahead/behind to preload
    maxConcurrentLoads: number; // Max videos loading simultaneously
    preloadOnlyOnWifi: boolean; // Respect user's data usage
    preloadQuality: 'low' | 'medium' | 'high'; // Quality for preloaded videos
  };

  // 📱 Network Optimization
  network: {
    adaptiveQuality: boolean; // Automatically adjust quality based on network
    lowDataMode: boolean; // Reduce data usage
    timeoutMs: number; // Network timeout for video loads
    retryAttempts: number; // Retry failed loads
    progressiveDownload: boolean; // Start playing while downloading
  };

  // 🎯 Playback Performance
  playback: {
    bufferSizeMs: number; // How much to buffer ahead
    fastStartThreshold: number; // When to prioritize fast start over quality
    hardwareAcceleration: boolean; // Use hardware decoding when available
    enablePosterFrame: boolean; // Show thumbnail while loading
    seekToleranceMs: number; // Seeking precision vs performance
  };

  // 💾 Caching Strategy
  caching: {
    enabled: boolean;
    maxCacheSize: number; // Max cache size in bytes
    cacheDurationMs: number; // How long to keep cached videos
    clearCacheOnLowMemory: boolean; // Auto-clear when memory is low
    compressedCaching: boolean; // Store compressed versions
  };

  // 🔧 UI Performance
  ui: {
    renderOptimization: boolean; // Optimize rendering for smooth scrolling
    reduceAnimationOnLowEnd: boolean; // Simpler animations on slower devices
    deferNonEssentialUI: boolean; // Delay loading UI that's not immediately visible
    prefetchThumbnails: boolean; // Preload video thumbnails
  };

  // 📊 Analytics & Monitoring
  monitoring: {
    trackLoadTimes: boolean; // Monitor video load performance
    trackBuffering: boolean; // Monitor buffering events
    reportSlowLoads: boolean; // Report videos that load slowly
    performanceThresholdMs: number; // Threshold for "slow" loads
  };
}

// 🎯 Predefined Optimization Profiles
export const VideoOptimizationProfiles = {
  // 🚀 Maximum Performance - Best for high-end devices with good connections
  MAXIMUM_PERFORMANCE: {
    preloading: {
      enabled: true,
      preloadRadius: 3,
      maxConcurrentLoads: 3,
      preloadOnlyOnWifi: false,
      preloadQuality: 'high' as const,
    },
    network: {
      adaptiveQuality: true,
      lowDataMode: false,
      timeoutMs: 8000,
      retryAttempts: 3,
      progressiveDownload: true,
    },
    playback: {
      bufferSizeMs: 5000,
      fastStartThreshold: 1000,
      hardwareAcceleration: true,
      enablePosterFrame: true,
      seekToleranceMs: 100,
    },
    caching: {
      enabled: true,
      maxCacheSize: 500 * 1024 * 1024, // 500MB
      cacheDurationMs: 24 * 60 * 60 * 1000, // 24 hours
      clearCacheOnLowMemory: true,
      compressedCaching: false,
    },
    ui: {
      renderOptimization: true,
      reduceAnimationOnLowEnd: false,
      deferNonEssentialUI: false,
      prefetchThumbnails: true,
    },
    monitoring: {
      trackLoadTimes: true,
      trackBuffering: true,
      reportSlowLoads: true,
      performanceThresholdMs: 3000,
    },
  } as VideoOptimizationConfig,

  // ⚖️ Balanced - Good balance between performance and data usage
  BALANCED: {
    preloading: {
      enabled: true,
      preloadRadius: 2,
      maxConcurrentLoads: 2,
      preloadOnlyOnWifi: true,
      preloadQuality: 'medium' as const,
    },
    network: {
      adaptiveQuality: true,
      lowDataMode: false,
      timeoutMs: 6000,
      retryAttempts: 2,
      progressiveDownload: true,
    },
    playback: {
      bufferSizeMs: 3000,
      fastStartThreshold: 1500,
      hardwareAcceleration: true,
      enablePosterFrame: true,
      seekToleranceMs: 250,
    },
    caching: {
      enabled: true,
      maxCacheSize: 200 * 1024 * 1024, // 200MB
      cacheDurationMs: 12 * 60 * 60 * 1000, // 12 hours
      clearCacheOnLowMemory: true,
      compressedCaching: true,
    },
    ui: {
      renderOptimization: true,
      reduceAnimationOnLowEnd: true,
      deferNonEssentialUI: true,
      prefetchThumbnails: true,
    },
    monitoring: {
      trackLoadTimes: true,
      trackBuffering: true,
      reportSlowLoads: false,
      performanceThresholdMs: 4000,
    },
  } as VideoOptimizationConfig,

  // 📱 Data Saver - Optimized for slower connections and data conservation
  DATA_SAVER: {
    preloading: {
      enabled: true,
      preloadRadius: 1,
      maxConcurrentLoads: 1,
      preloadOnlyOnWifi: true,
      preloadQuality: 'low' as const,
    },
    network: {
      adaptiveQuality: true,
      lowDataMode: true,
      timeoutMs: 10000,
      retryAttempts: 1,
      progressiveDownload: true,
    },
    playback: {
      bufferSizeMs: 2000,
      fastStartThreshold: 2000,
      hardwareAcceleration: true,
      enablePosterFrame: true,
      seekToleranceMs: 500,
    },
    caching: {
      enabled: true,
      maxCacheSize: 50 * 1024 * 1024, // 50MB
      cacheDurationMs: 6 * 60 * 60 * 1000, // 6 hours
      clearCacheOnLowMemory: true,
      compressedCaching: true,
    },
    ui: {
      renderOptimization: true,
      reduceAnimationOnLowEnd: true,
      deferNonEssentialUI: true,
      prefetchThumbnails: false,
    },
    monitoring: {
      trackLoadTimes: false,
      trackBuffering: false,
      reportSlowLoads: false,
      performanceThresholdMs: 6000,
    },
  } as VideoOptimizationConfig,
};

// 🎯 Auto-detect optimal profile based on device and network
export const detectOptimalProfile = (): VideoOptimizationConfig => {
  // This would detect device capabilities, network speed, etc.
  // For now, return balanced as default
  return VideoOptimizationProfiles.BALANCED;
};

// 🔧 Apply optimization profile to video player
export const applyOptimizationProfile = (
  profile: VideoOptimizationConfig
): Record<string, any> => {
  return {
    // Expo AV Video props
    shouldCorrectPitch: false, // Reduce processing overhead
    progressUpdateIntervalMillis: profile.monitoring.trackLoadTimes ? 250 : 1000,
    useNativeControls: false,
    
    // FlatList performance props
    removeClippedSubviews: profile.ui.renderOptimization,
    maxToRenderPerBatch: profile.preloading.maxConcurrentLoads,
    windowSize: profile.preloading.preloadRadius * 2 + 1,
    initialNumToRender: 1,
    updateCellsBatchingPeriod: profile.ui.renderOptimization ? 50 : 100,
    
    // Network optimization
    timeout: profile.network.timeoutMs,
    retries: profile.network.retryAttempts,
  };
};
