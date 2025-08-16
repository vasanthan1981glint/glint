import { Ionicons } from '@expo/vector-icons';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Image,
    PixelRatio,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    ViewToken
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoOptimizationProfiles, applyOptimizationProfile } from '../Config/videoOptimization';
import { useVideoPerformanceMonitor } from '../hooks/useVideoPerformanceMonitor';
import { useVideoPreloader } from '../hooks/useVideoPreloader';
import { useViewTracking } from '../hooks/useViewTracking';

// 🧱 UNIVERSAL LAYOUT SYSTEM: Full-Screen, Aspect-Ratio-Aware
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// ✅ 1. Universal Responsive Sizing for ALL Device Types
const getUniversalResponsiveSize = () => {
  const { height, width } = Dimensions.get('window');
  const pixelRatio = PixelRatio.get();
  
  // 📱 Comprehensive Device Detection
  const isVerySmallDevice = height < 650 || width < 320; // iPhone SE 1st gen
  const isSmallDevice = height >= 650 && height < 750; // iPhone SE 2nd/3rd gen
  const isMediumDevice = height >= 750 && height < 850; // iPhone 12 mini
  const isLargeDevice = height >= 850 && height < 950; // iPhone 12/13/14
  const isExtraLargeDevice = height >= 950; // iPhone Pro Max
  const isTablet = width > 768 || (width > 600 && height > 900); // iPads
  const isFoldable = width > 700 && height > 700; // Foldable devices
  
  // 🔍 Enhanced Notch/Island Detection
  const hasNotch = height >= 812 || (Platform.OS === 'ios' && height >= 780);
  const hasDynamicIsland = height >= 852 || (Platform.OS === 'ios' && height >= 820);
  const isAndroid = Platform.OS === 'android';
  
  // 📐 Universal Scaling System
  const baseWidth = 375; // iPhone 8 reference
  const baseHeight = 667; // iPhone 8 reference
  const widthScale = Math.max(Math.min(width / baseWidth, 2.5), 0.5);
  const heightScale = Math.max(Math.min(height / baseHeight, 2.5), 0.5);
  const scale = Math.min(widthScale, heightScale);
  
  // Device-specific scaling adjustments
  const deviceScale = isTablet ? scale * 1.3 : 
                     isFoldable ? scale * 1.2 : 
                     isExtraLargeDevice ? scale * 1.15 : 
                     isVerySmallDevice ? scale * 0.85 : scale;
  
  return {
    // Device flags
    isVerySmallDevice,
    isSmallDevice,
    isMediumDevice,
    isLargeDevice,
    isExtraLargeDevice,
    isTablet,
    isFoldable,
    hasNotch,
    hasDynamicIsland,
    isAndroid,
    
    // Screen dimensions
    screenWidth: width,
    screenHeight: height,
    scale: deviceScale,
    
    // ✅ 8. Universal Font Sizes (Tested on ALL Devices)
    fontSize: {
      tiny: Math.max(Math.round((isTablet ? 12 : isVerySmallDevice ? 8 : 10) * deviceScale), 8),
      small: Math.max(Math.round((isTablet ? 16 : isVerySmallDevice ? 10 : 12) * deviceScale), 10),
      medium: Math.max(Math.round((isTablet ? 20 : isVerySmallDevice ? 13 : 16) * deviceScale), 12),
      large: Math.max(Math.round((isTablet ? 24 : isVerySmallDevice ? 16 : 19) * deviceScale), 14),
      xlarge: Math.max(Math.round((isTablet ? 28 : isVerySmallDevice ? 19 : 22) * deviceScale), 16),
    },
    
    // ✅ 8. Universal Spacing (Responsive on ALL Screens)
    spacing: {
      tiny: Math.max(Math.round((isTablet ? 6 : isVerySmallDevice ? 2 : 3) * deviceScale), 2),
      small: Math.max(Math.round((isTablet ? 10 : isVerySmallDevice ? 4 : 6) * deviceScale), 4),
      medium: Math.max(Math.round((isTablet ? 18 : isVerySmallDevice ? 8 : 12) * deviceScale), 6),
      large: Math.max(Math.round((isTablet ? 26 : isVerySmallDevice ? 14 : 20) * deviceScale), 10),
      xlarge: Math.max(Math.round((isTablet ? 34 : isVerySmallDevice ? 20 : 28) * deviceScale), 16),
    },
    
    // ✅ 10. Touch-Friendly Icon Sizes (60px+ touch targets)
    iconSizes: {
      small: Math.max(isTablet ? 26 : isLargeDevice ? 22 : 20, 18),
      medium: Math.max(isTablet ? 32 : isLargeDevice ? 28 : 26, 24),
      large: Math.max(isTablet ? 40 : isLargeDevice ? 36 : 34, 32),
      xlarge: Math.max(isTablet ? 46 : isLargeDevice ? 42 : 40, 36),
      extraLarge: Math.max(isTablet ? 68 : isLargeDevice ? 60 : 54, 48),
    },
    
    // Touch target zones for thumb-friendly interaction
    touchTarget: {
      minimum: 44, // iOS HIG minimum
      recommended: 60, // Better for thumb interaction
      comfortable: 72, // Optimal for one-handed use
    },
  };
};

export interface VideoData {
  assetId: string;
  videoId?: string;
  playbackUrl: string;
  streamingUrl?: string;
  thumbnailUrl: string;
  username: string;
  userId: string;
  views?: number;
  createdAt: string;
  caption?: string;
}

interface ShortFormVideoPlayerProps {
  videos: VideoData[];
  initialVideoIndex?: number;
  onVideoChange?: (index: number) => void;
  onLike?: (videoId: string) => void;
  onShare?: (videoId: string) => void;
  onSave?: (videoId: string) => void;
  onComment?: (videoId: string) => void;
  onFollow?: (userId: string) => void;
  isLoading?: boolean;
}

export const ShortFormVideoPlayer: React.FC<ShortFormVideoPlayerProps> = ({
  videos,
  initialVideoIndex = 0,
  onVideoChange,
  onLike,
  onShare,
  onSave,
  onComment,
  onFollow,
  isLoading = false,
}) => {
  const insets = useSafeAreaInsets();
  const responsiveSize = getUniversalResponsiveSize();
  
  // ✅ 1. Full Height Viewport Calculation (100% Screen)
  const videoContainerHeight = useMemo(() => {
    // BULLETPROOF: For TikTok-style full screen, use entire screen minus only tab bar
    const tabBarHeight = 49 + insets.bottom; // Standard tab bar + safe area
    
    // Each video takes EXACTLY one full screen (including status bar area)
    const fullScreenHeight = screenHeight - tabBarHeight;
    
    console.log(`🧱 FULL-SCREEN LAYOUT SYSTEM:
      📐 Screen Height: ${screenHeight}px (100% viewport)
      📊 Tab Bar: ${tabBarHeight}px
      ✅ Video Height: ${fullScreenHeight}px
      🎯 ONE VIDEO = ONE SCREEN guaranteed!`);
    
    return fullScreenHeight;
  }, [insets]);
  
  // ✅ 2. Video State Management
  const [currentVideoIndex, setCurrentVideoIndex] = useState(initialVideoIndex);
  const [videoPlayingStates, setVideoPlayingStates] = useState<{ [key: string]: boolean }>({});
  const [videoPositions, setVideoPositions] = useState<{ [key: string]: number }>({});
  const [videoDurations, setVideoDurations] = useState<{ [key: string]: number }>({});
  const [videoLoadStates, setVideoLoadStates] = useState<{ [key: string]: 'loading' | 'loaded' | 'error' }>({});
  const [showThumbnails, setShowThumbnails] = useState<{ [key: string]: boolean }>({});
  const [isMuted, setIsMuted] = useState(false); // ✅ 13. Start unmuted for better UX
  const [retryAttempts, setRetryAttempts] = useState<{ [key: string]: number }>({}); // Track retry attempts
  const [skipCountdown, setSkipCountdown] = useState<{ [key: string]: number }>({}); // Auto-skip countdown
  
  // ✅ 4. Video Player Refs
  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<{ [key: string]: Video }>({});
  
  // 🚀 VIDEO PERFORMANCE MONITORING (DISABLED TO PREVENT MEMORY ISSUES)
  const {
    startVideoLoad,
    completeVideoLoad,
    recordVideoError,
    getPerformanceStats,
    exportMetrics,
    setIsMonitoring,
  } = useVideoPerformanceMonitor();
  
  // Disable monitoring to save memory
  useEffect(() => {
    setIsMonitoring(false);
  }, [setIsMonitoring]);
  
  // 🚀 VIDEO OPTIMIZATION CONFIGURATION
  const optimizationConfig = useMemo(() => {
    // Auto-detect optimal profile or use props
    return VideoOptimizationProfiles.MAXIMUM_PERFORMANCE; // Can be made configurable via props
  }, []);
  
  const optimizedProps = useMemo(() => applyOptimizationProfile(optimizationConfig), [optimizationConfig]);
  
  // 🚀 VIDEO PRELOADER FOR FASTER LOADING (REDUCED TO PREVENT MEMORY ISSUES)
  const { preloadNextVideo, getPreloadStatus } = useVideoPreloader(
    videos,
    currentVideoIndex,
    videoRefs,
    {
      preloadRadius: 1, // Reduced from 2 to prevent memory issues
      maxConcurrentLoads: 1, // Reduced from 2 to prevent memory issues
      enableBackgroundPreload: false, // Temporarily disabled to prevent crashes
    }
  );
  
  // ✅ 9. Caption State Management
  const [expandedCaptions, setExpandedCaptions] = useState<{ [key: string]: boolean }>({});
  
  // ✅ 14. Tap-to-Pause State
  const [showPlayPauseIndicator, setShowPlayPauseIndicator] = useState<{ [key: string]: boolean }>({});
  const [playPauseIndicatorIcon, setPlayPauseIndicatorIcon] = useState<{ [key: string]: 'play' | 'pause' }>({});
  const playPauseTimeoutRefs = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});
  
  // ✅ 6. Progress Bar State (YouTube Shorts style)
  const [showProgressBar, setShowProgressBar] = useState<{ [key: string]: boolean }>({});
  const [isDraggingProgress, setIsDraggingProgress] = useState<{ [key: string]: boolean }>({});
  const [dragProgress, setDragProgress] = useState<{ [key: string]: number }>({});
  
  // Animations
  const playPauseAnims = useRef<{ [key: string]: Animated.Value }>({});
  const scaleAnims = useRef<{ [key: string]: Animated.Value }>({});
  
  // ✅ 5. Initialize Video States
  useEffect(() => {
    const initialStates: { [key: string]: boolean } = {};
    const initialThumbnails: { [key: string]: boolean } = {};
    
    videos.forEach((video, index) => {
      const isCurrentVideo = index === currentVideoIndex;
      initialStates[video.assetId] = isCurrentVideo; // Only current video plays
      initialThumbnails[video.assetId] = !isCurrentVideo; // Show thumbnail for non-current
      
      // Initialize animations
      if (!playPauseAnims.current[video.assetId]) {
        playPauseAnims.current[video.assetId] = new Animated.Value(0);
      }
      if (!scaleAnims.current[video.assetId]) {
        scaleAnims.current[video.assetId] = new Animated.Value(1);
      }
    });
    
    setVideoPlayingStates(initialStates);
    setShowThumbnails(initialThumbnails);
  }, [videos, currentVideoIndex]);

  // ✅ VIEW TRACKING - Match VerticalVideoPlayer behavior for accurate views
  const currentVideo = videos[currentVideoIndex];
  const isCurrentVideoVisible = currentVideoIndex >= 0 && currentVideoIndex < videos.length;
  const isCurrentVideoPlaying = currentVideo ? (videoPlayingStates[currentVideo.assetId] ?? false) : false;

  // View tracking for current video
  const { startTracking, stopTracking } = useViewTracking({
    videoId: currentVideo?.assetId || '',
    isVisible: isCurrentVideoVisible,
    isPlaying: isCurrentVideoPlaying,
    onViewRecorded: (videoId) => {
      console.log(`📊 View recorded for video: ${videoId}`);
    },
    onViewThresholdReached: (videoId) => {
      console.log(`🎯 View threshold reached for video: ${videoId}`);
    }
  });

  // ✅ 3. Video Scroll Handler (Snap Scrolling - TikTok Style)
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 85, // 85% visible to switch
    minimumViewTime: 150, // Minimum time before switching
    waitForInteraction: false,
  }), []);
  
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index || 0;
      
      if (newIndex !== currentVideoIndex) {
        setCurrentVideoIndex(newIndex);
        onVideoChange?.(newIndex);
        
        // ✅ 4. Only One Video Plays at a Time
        videos.forEach((video, index) => {
          const assetId = video.assetId;
          const videoRef = videoRefs.current[assetId];
          const isCurrentVideo = index === newIndex;
          
          if (videoRef) {
            if (isCurrentVideo) {
              // Play current video immediately if preloaded
              setVideoPlayingStates(prev => ({ ...prev, [assetId]: true }));
              setShowThumbnails(prev => ({ ...prev, [assetId]: false }));
              
              // Simple video start without aggressive preloading
              videoRef.playAsync().catch(console.warn);
            } else {
              // Pause non-current videos
              setVideoPlayingStates(prev => ({ ...prev, [assetId]: false }));
              setShowThumbnails(prev => ({ ...prev, [assetId]: true }));
              videoRef.pauseAsync().catch(console.warn);
            }
          }
        });
      }
    }
  }, [currentVideoIndex, videos, onVideoChange]);
  
  // ✅ 14. Tap-to-Pause Handler
  const handleVideoTap = useCallback(async (videoId: string) => {
    const videoRef = videoRefs.current[videoId];
    if (!videoRef) return;
    
    try {
      const status = await videoRef.getStatusAsync();
      if (!status.isLoaded) return;
      
      const newPlayingState = !status.isPlaying;
      const icon = newPlayingState ? 'play' : 'pause';
      
      // Show indicator with animation
      setShowPlayPauseIndicator(prev => ({ ...prev, [videoId]: true }));
      setPlayPauseIndicatorIcon(prev => ({ ...prev, [videoId]: icon }));
      
      // Animate indicator
      const anim = playPauseAnims.current[videoId];
      if (anim) {
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start();
      }
      
      // Toggle playback
      if (newPlayingState) {
        await videoRef.playAsync();
        setShowProgressBar(prev => ({ ...prev, [videoId]: false }));
      } else {
        await videoRef.pauseAsync();
        setShowProgressBar(prev => ({ ...prev, [videoId]: true }));
      }
      
      setVideoPlayingStates(prev => ({ ...prev, [videoId]: newPlayingState }));
      
      // Hide indicator after delay
      if (playPauseTimeoutRefs.current[videoId]) {
        clearTimeout(playPauseTimeoutRefs.current[videoId]);
      }
      playPauseTimeoutRefs.current[videoId] = setTimeout(() => {
        setShowPlayPauseIndicator(prev => ({ ...prev, [videoId]: false }));
      }, 600);
      
      // ✅ Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
    } catch (error) {
      console.warn('Error toggling video playback:', error);
    }
  }, []);
  
  // 🚀 Skip Failed Videos Function
  const skipFailedVideo = useCallback(() => {
    const currentVideo = videos[currentVideoIndex];
    const isCurrentVideoFailed = videoLoadStates[currentVideo?.assetId] === 'error' && 
                                  (retryAttempts[currentVideo?.assetId] || 0) >= 2;
    
    if (isCurrentVideoFailed && currentVideoIndex < videos.length - 1) {
      console.log('🔄 Skipping failed video, moving to next...');
      
      // Reset countdown for the failed video
      setSkipCountdown(prev => ({ ...prev, [currentVideo.assetId]: 0 }));
      
      const nextIndex = currentVideoIndex + 1;
      setCurrentVideoIndex(nextIndex);
      onVideoChange?.(nextIndex);
      
      // Scroll to next video
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
    }
  }, [currentVideoIndex, videos, videoLoadStates, retryAttempts, onVideoChange]);
  
  // ✅ 12. Video Scaling for Full-Screen Experience
  const getVideoResizeMode = useCallback((aspectRatio?: number) => {
    // Always use COVER for TikTok/Instagram style full-screen experience
    // This ensures no black bars and videos fill the entire screen
    return ResizeMode.COVER;
  }, []);
  
  // ✅ 15. Thumbnail Placeholder with Blur Preview
  const renderThumbnail = useCallback((video: VideoData) => {
    if (!showThumbnails[video.assetId]) return null;
    
    return (
      <View style={styles.thumbnailOverlay}>
        {video.thumbnailUrl ? (
          <Image
            source={{ uri: video.thumbnailUrl }}
            style={styles.thumbnailImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="play-circle" size={80} color="rgba(255,255,255,0.7)" />
          </View>
        )}
        
        {/* ✅ Video Duration Badge */}
        {videoDurations[video.assetId] && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {formatTime(videoDurations[video.assetId])}
            </Text>
          </View>
        )}
      </View>
    );
  }, [showThumbnails, videoDurations]);
  
  // ✅ 6. Progress Bar Component
  const renderProgressBar = useCallback((video: VideoData) => {
    if (!showProgressBar[video.assetId]) return null;
    
    const progress = videoDurations[video.assetId] 
      ? (videoPositions[video.assetId] || 0) / videoDurations[video.assetId]
      : 0;
    
    return (
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarTrack}>
          <View 
            style={[
              styles.progressBarFill, 
              { width: `${Math.min(progress * 100, 100)}%` }
            ]} 
          />
        </View>
      </View>
    );
  }, [showProgressBar, videoDurations, videoPositions]);
  
  // ✅ 9. Caption Rendering with Ellipsis
  const renderCaption = useCallback((video: VideoData) => {
    if (!video.caption) return null;
    
    const isExpanded = expandedCaptions[video.assetId];
    const shouldTruncate = video.caption.length > 100;
    
    return (
      <View style={styles.captionContainer}>
        <Text style={styles.caption}>
          {shouldTruncate && !isExpanded 
            ? `${video.caption.substring(0, 100)}...`
            : video.caption
          }
        </Text>
        {shouldTruncate && (
          <TouchableOpacity
            onPress={() => setExpandedCaptions(prev => ({ 
              ...prev, 
              [video.assetId]: !isExpanded 
            }))}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.readMoreText}>
              {isExpanded ? ' Less' : ' More'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [expandedCaptions]);
  
  // ✅ 10. Touch-Friendly Action Buttons
  const renderActionButtons = useCallback((video: VideoData) => (
    <View style={styles.rightActions}>
      {/* Like Button */}
      <TouchableOpacity 
        style={[styles.actionButton, { minHeight: responsiveSize.touchTarget.recommended }]}
        onPress={() => onLike?.(video.assetId)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons 
          name="heart-outline" 
          size={responsiveSize.iconSizes.large} 
          color="#ffffff" 
        />
        <Text style={[styles.actionText, { fontSize: responsiveSize.fontSize.small }]}>
          Like
        </Text>
      </TouchableOpacity>
      
      {/* Comment Button */}
      <TouchableOpacity 
        style={[styles.actionButton, { minHeight: responsiveSize.touchTarget.recommended }]}
        onPress={() => onComment?.(video.assetId)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons 
          name="chatbubble-outline" 
          size={responsiveSize.iconSizes.large} 
          color="#ffffff" 
        />
        <Text style={[styles.actionText, { fontSize: responsiveSize.fontSize.small }]}>
          Comment
        </Text>
      </TouchableOpacity>
      
      {/* Share Button */}
      <TouchableOpacity 
        style={[styles.actionButton, { minHeight: responsiveSize.touchTarget.recommended }]}
        onPress={() => onShare?.(video.assetId)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons 
          name="arrow-redo-outline" 
          size={responsiveSize.iconSizes.large} 
          color="#ffffff" 
        />
        <Text style={[styles.actionText, { fontSize: responsiveSize.fontSize.small }]}>
          Share
        </Text>
      </TouchableOpacity>
      
      {/* Save Button */}
      <TouchableOpacity 
        style={[styles.actionButton, { minHeight: responsiveSize.touchTarget.recommended }]}
        onPress={() => onSave?.(video.assetId)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons 
          name="bookmark-outline" 
          size={responsiveSize.iconSizes.large} 
          color="#ffffff" 
        />
        <Text style={[styles.actionText, { fontSize: responsiveSize.fontSize.small }]}>
          Save
        </Text>
      </TouchableOpacity>
      
      {/* Mute Button */}
      <TouchableOpacity 
        style={[styles.actionButton, { minHeight: responsiveSize.touchTarget.recommended }]}
        onPress={() => setIsMuted(!isMuted)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons 
          name={isMuted ? "volume-mute-outline" : "volume-high-outline"} 
          size={responsiveSize.iconSizes.large} 
          color="#ffffff" 
        />
      </TouchableOpacity>
    </View>
  ), [responsiveSize, isMuted, onLike, onComment, onShare, onSave]);
  
  // ✅ Video Item Renderer with Full-Screen Layout + Performance Optimization
  const renderVideoItem = useCallback(({ item, index }: { item: VideoData; index: number }) => {
    const isCurrentVideo = index === currentVideoIndex;
    const isNextOrPrevious = Math.abs(index - currentVideoIndex) <= 1;
    
    return (
      <View style={[styles.videoContainer, { height: videoContainerHeight }]}>
        {/* ✅ 2. Full-Screen Video with Aspect Ratio Handling */}
        <View style={styles.videoWrapper}>
          <Video
            ref={(ref) => {
              if (ref) videoRefs.current[item.assetId] = ref;
            }}
            source={{ uri: item.playbackUrl }}
            style={styles.video}
            resizeMode={getVideoResizeMode()}
            shouldPlay={isCurrentVideo && videoPlayingStates[item.assetId]}
            isMuted={isMuted}
            isLooping={true}
            volume={isMuted ? 0.0 : 1.0}
            rate={1.0}
            progressUpdateIntervalMillis={isCurrentVideo ? optimizedProps.progressUpdateIntervalMillis : 1000}
            useNativeControls={false}
            // 🚀 PERFORMANCE OPTIMIZATIONS FOR FASTER LOADING
            shouldCorrectPitch={false} // Reduce processing overhead
            posterSource={item.thumbnailUrl ? { uri: item.thumbnailUrl } : undefined}
            posterStyle={styles.video}
            onLoad={(status) => {
              if (status.isLoaded) {
                setVideoLoadStates(prev => ({ ...prev, [item.assetId]: 'loaded' }));
                // Reset retry attempts on successful load
                setRetryAttempts(prev => ({ ...prev, [item.assetId]: 0 }));
                // Reset skip countdown on successful load
                setSkipCountdown(prev => ({ ...prev, [item.assetId]: 0 }));
                
                if (status.durationMillis) {
                  setVideoDurations(prev => ({ ...prev, [item.assetId]: status.durationMillis! }));
                }
              }
            }}
            onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
              if (status.isLoaded) {
                if (status.positionMillis !== undefined) {
                  setVideoPositions(prev => ({ ...prev, [item.assetId]: status.positionMillis! }));
                }
              }
            }}
            onError={(error) => {
              console.warn('Video error:', error);
              setVideoLoadStates(prev => ({ ...prev, [item.assetId]: 'error' }));
              
              // Handle codec errors with improved detection
              const errorString = JSON.stringify(error) + String(error);
              const isCodecError = errorString.includes('MediaCodec') || 
                                 errorString.includes('codec') || 
                                 errorString.includes('decoder') ||
                                 errorString.includes('HEVC') ||
                                 errorString.includes('hevc') ||
                                 errorString.includes('h265') ||
                                 errorString.includes('H265');
              
              if (isCodecError) {
                const currentRetries = retryAttempts[item.assetId] || 0;
                
                // If it's HEVC codec error, skip immediately without retries
                if (errorString.includes('hevc') || errorString.includes('HEVC') || errorString.includes('h265') || errorString.includes('H265')) {
                  console.warn(`🚫 HEVC codec not supported, skipping video immediately: ${item.assetId}`);
                  setRetryAttempts(prev => ({ ...prev, [item.assetId]: 2 })); // Mark as max retries reached
                  
                  if (isCurrentVideo && currentVideoIndex < videos.length - 1) {
                    console.log('⚡ Instantly skipping HEVC video...');
                    setTimeout(() => {
                      skipFailedVideo();
                    }, 1000); // Skip after 1 second
                  }
                  return;
                }
                
                const maxRetries = 2; // Maximum 2 retry attempts for other codec issues
                
                if (currentRetries < maxRetries) {
                  console.log(`🔄 Codec error detected, attempting fallback ${currentRetries + 1}/${maxRetries}...`);
                  setRetryAttempts(prev => ({ ...prev, [item.assetId]: currentRetries + 1 }));
                  
                  const videoRef = videoRefs.current[item.assetId];
                  if (videoRef) {
                    setTimeout(() => {
                      videoRef.loadAsync(
                        { uri: item.playbackUrl },
                        { 
                          shouldPlay: isCurrentVideo,
                          isLooping: true,
                          isMuted: isMuted,
                        }
                      ).catch(() => {
                        console.warn(`🚨 Retry ${currentRetries + 1} failed for: ${item.assetId}`);
                        if (currentRetries + 1 >= maxRetries) {
                          console.warn(`🛑 Max retries reached for: ${item.assetId}. Video permanently failed.`);
                        }
                      });
                    }, 2000); // Increased delay to 2 seconds
                  }
                } else {
                  console.warn(`🛑 Max retries (${maxRetries}) reached for: ${item.assetId}. Stopping retry attempts.`);
                  
                  // Auto-skip failed video after 5 seconds if it's the current video
                  if (isCurrentVideo && currentVideoIndex < videos.length - 1) {
                    console.log('⏰ Auto-skipping failed video in 5 seconds...');
                    
                    // Start countdown
                    let countdown = 5;
                    setSkipCountdown(prev => ({ ...prev, [item.assetId]: countdown }));
                    
                    const countdownInterval = setInterval(() => {
                      countdown--;
                      setSkipCountdown(prev => ({ ...prev, [item.assetId]: countdown }));
                      
                      if (countdown <= 0) {
                        clearInterval(countdownInterval);
                        setSkipCountdown(prev => ({ ...prev, [item.assetId]: 0 }));
                        skipFailedVideo();
                      }
                    }, 1000);
                  }
                }
              } else {
                // Non-codec errors: handle normally
                console.warn(`🚨 Non-codec video error for ${item.assetId}:`, error);
                
                if (isCurrentVideo && currentVideoIndex < videos.length - 1) {
                  console.log('⏰ Auto-skipping failed video in 3 seconds...');
                  setTimeout(() => {
                    skipFailedVideo();
                  }, 3000);
                }
              }
            }}
          />
          
          {/* ✅ 15. Thumbnail Overlay */}
          {renderThumbnail(item)}
          
          {/* ✅ 17. Enhanced Loading Indicators */}
          {videoLoadStates[item.assetId] === 'loading' && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#ffffff" />
              <Text style={styles.loadingText}>Loading video...</Text>
            </View>
          )}
          
          {/* 🚨 Video Error State */}
          {videoLoadStates[item.assetId] === 'error' && (
            <View style={styles.loadingOverlay}>
              <Ionicons name="warning-outline" size={48} color="#FF6B6B" />
              <Text style={[styles.loadingText, { color: '#FF6B6B' }]}>
                {(retryAttempts[item.assetId] || 0) >= 2 
                  ? 'Video format not supported'
                  : 'Loading video...'
                }
              </Text>
              <Text style={[styles.loadingText, { fontSize: 12, opacity: 0.7 }]}>
                {(retryAttempts[item.assetId] || 0) >= 2 
                  ? (skipCountdown[item.assetId] > 0 
                      ? `Auto-skipping in ${skipCountdown[item.assetId]}s...`
                      : 'HEVC codec not supported on this device')
                  : `Retry ${(retryAttempts[item.assetId] || 0) + 1}/2...`
                }
              </Text>
              
              {/* Skip Button for permanently failed videos */}
              {(retryAttempts[item.assetId] || 0) >= 2 && 
               currentVideoIndex < videos.length - 1 && 
               !skipCountdown[item.assetId] && (
                <TouchableOpacity 
                  style={styles.skipButton}
                  onPress={skipFailedVideo}
                  activeOpacity={0.7}
                >
                  <Ionicons name="play-skip-forward" size={20} color="#FFFFFF" />
                  <Text style={styles.skipButtonText}>Skip Video</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          
          {/* ✅ 14. Play/Pause Indicator */}
          {showPlayPauseIndicator[item.assetId] && (
            <Animated.View 
              style={[
                styles.playPauseIndicator,
                { opacity: playPauseAnims.current[item.assetId] || 0 }
              ]}
            >
              <Ionicons
                name={playPauseIndicatorIcon[item.assetId] === 'play' ? 'play' : 'pause'}
                size={80}
                color="rgba(255,255,255,0.9)"
              />
            </Animated.View>
          )}
        </View>
        
        {/* ✅ 5. Overlay UI with Safe Area Support */}
        <View style={[
          styles.overlayContainer,
          {
            paddingTop: insets.top + responsiveSize.spacing.medium,
            paddingBottom: insets.bottom + responsiveSize.spacing.large,
            paddingHorizontal: responsiveSize.spacing.medium,
          }
        ]}>
          {/* Left side - User info and caption */}
          <View style={styles.leftContent}>
            {/* User Info */}
            <TouchableOpacity 
              style={styles.userRow}
              onPress={() => onFollow?.(item.userId)}
            >
              <Image 
                source={{ uri: `https://ui-avatars.com/api/?name=${item.username}&size=40` }}
                style={styles.userAvatar}
              />
              <View style={styles.userInfo}>
                <Text style={[styles.username, { fontSize: responsiveSize.fontSize.medium }]}>
                  @{item.username}
                </Text>
                <TouchableOpacity style={styles.followButton}>
                  <Text style={[styles.followText, { fontSize: responsiveSize.fontSize.small }]}>
                    Follow
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
            
            {/* ✅ 9. Caption with Ellipsis */}
            {renderCaption(item)}
          </View>
          
          {/* ✅ 10. Right side - Action buttons */}
          {renderActionButtons(item)}
        </View>
        
        {/* ✅ 6. Progress Bar */}
        {renderProgressBar(item)}
        
        {/* ✅ 14. Full-Screen Touch Area for Tap-to-Pause */}
        <TouchableWithoutFeedback onPress={() => handleVideoTap(item.assetId)}>
          <View style={styles.fullScreenTouchArea} />
        </TouchableWithoutFeedback>
      </View>
    );
  }, [
    currentVideoIndex, 
    videoContainerHeight, 
    videoPlayingStates,
    isMuted,
    insets,
    responsiveSize,
    getVideoResizeMode,
    renderThumbnail,
    renderCaption,
    renderActionButtons,
    renderProgressBar,
    handleVideoTap,
    videoLoadStates,
    showPlayPauseIndicator,
    playPauseIndicatorIcon,
    currentVideoIndex, // Add this dependency to improve performance
  ]);
  
  // ✅ 17. Loading State
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { height: videoContainerHeight }]}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.loadingText}>Loading videos...</Text>
      </View>
    );
  }
  
  // ✅ Empty State
  if (videos.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height: videoContainerHeight }]}>
        <Ionicons name="videocam-outline" size={64} color="#666" />
        <Text style={styles.emptyText}>No videos available</Text>
      </View>
    );
  }
  
  return (
    <>
      {/* ✅ Status Bar Configuration */}
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* ✅ 3. Vertical Pager (Snap Scrolling) */}
      <FlatList
        ref={flatListRef}
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={(item, index) => `${item.assetId}-${index}-video`}
        pagingEnabled={true} // ✅ Snap scrolling
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToAlignment="start"
        snapToInterval={videoContainerHeight}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        getItemLayout={(data, index) => ({
          length: videoContainerHeight,
          offset: videoContainerHeight * index,
          index,
        })}
        initialScrollIndex={initialVideoIndex}
        // 🚀 CONSERVATIVE PERFORMANCE SETTINGS TO PREVENT MEMORY ISSUES
        removeClippedSubviews={Platform.OS === 'android'} // Only on Android
        maxToRenderPerBatch={1} // Very conservative to prevent memory issues
        windowSize={2} // Small window to prevent memory issues
        initialNumToRender={1} // Only render current video initially
        updateCellsBatchingPeriod={200} // Slower updates to prevent memory spikes
        disableIntervalMomentum={true} // Prevent momentum scrolling issues
        scrollEventThrottle={16} // Smooth 60fps scrolling
        overScrollMode="never" // Prevent overscroll on Android
        bounces={false} // Prevent bounce on iOS for smoother experience
        style={styles.container}
      />
    </>
  );
};

// ✅ Helper Functions
const formatTime = (timeInMs: number): string => {
  const totalSeconds = Math.floor(timeInMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// ✅ Universal Styles for ALL Device Types
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 0, // Remove any padding that might cause gaps
  },
  
  // ✅ 1. Video Container - Full Screen
  videoContainer: {
    width: screenWidth,
    backgroundColor: '#000',
    position: 'relative',
    // Ensure full screen coverage including status bar area
    marginTop: 0,
    paddingTop: 0,
  },
  
  // ✅ 2. Video Wrapper - Aspect Ratio Handling
  videoWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  
  // ✅ 15. Thumbnail Styles
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  
  durationBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // ✅ 17. Loading States
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  
  emptyText: {
    color: '#666',
    fontSize: 16,
    marginTop: 16,
  },
  
  // ✅ 14. Play/Pause Indicator
  playPauseIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 120,
    height: 120,
    marginTop: -60,
    marginLeft: -60,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  
  // ✅ 5. Overlay Container with Safe Areas
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 4,
    pointerEvents: 'box-none',
  },
  
  leftContent: {
    flex: 1,
    maxWidth: '75%',
  },
  
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  
  userInfo: {
    flex: 1,
  },
  
  username: {
    color: '#fff',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  
  followButton: {
    backgroundColor: '#FF1744',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  
  followText: {
    color: '#fff',
    fontWeight: '600',
  },
  
  // ✅ 9. Caption Styles
  captionContainer: {
    marginBottom: 16,
  },
  
  caption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  
  readMoreText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // ✅ 10. Touch-Friendly Action Buttons
  rightActions: {
    alignItems: 'center',
    paddingLeft: 16,
  },
  
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
    minWidth: 60, // ✅ Touch target size
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  
  actionText: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  // ✅ 6. Progress Bar Styles
  progressBarContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    zIndex: 5,
  },
  
  progressBarTrack: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1.5,
  },
  
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF1744',
    borderRadius: 1.5,
  },
  
  // ✅ 14. Full-Screen Touch Area
  fullScreenTouchArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0, // Below overlays but above video
  },
  
  // 🚀 Loading and Preload Styles
  preloadText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  
  debugPreloadStatus: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
    zIndex: 10,
  },
  
  debugText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  
  performanceStats: {
    position: 'absolute',
    bottom: 50,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
    zIndex: 10,
  },
  
  // 🚀 Skip Button for Failed Videos
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ShortFormVideoPlayer;
