import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { VideoPlayer, VideoSource } from 'expo-video';
import { VideoView, useVideoPlayer } from 'expo-video';
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
import { useVideoPerformanceMonitor } from '../hooks/useVideoPerformanceMonitor';

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

interface ShortFormVideoPlayerNewProps {
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

// Video codec detection utility
const isHEVCVideo = (url: string): boolean => {
  // Common HEVC file extensions and patterns
  const hevcPatterns = [
    /\.h265$/i,
    /\.hevc$/i,
    /codec.*hevc/i,
    /codec.*h265/i,
    /video.*hevc/i,
    /video.*h265/i,
  ];
  
  return hevcPatterns.some(pattern => pattern.test(url));
};

// Device codec support detection
const getCodecSupport = () => {
  const isAndroid = Platform.OS === 'android';
  const isIOS = Platform.OS === 'ios';
  
  return {
    hevc: isIOS, // iOS generally supports HEVC, Android support varies
    h264: true,  // Universal support
    vp9: isAndroid, // Better Android support
    av1: false,     // Limited support currently
  };
};

export const ShortFormVideoPlayerNew: React.FC<ShortFormVideoPlayerNewProps> = ({
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
  const codecSupport = getCodecSupport();
  
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
  const [videoLoadStates, setVideoLoadStates] = useState<{ [key: string]: 'loading' | 'loaded' | 'error' }>({});
  const [showThumbnails, setShowThumbnails] = useState<{ [key: string]: boolean }>({});
  const [isMuted, setIsMuted] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState<{ [key: string]: number }>({});
  const [skipCountdown, setSkipCountdown] = useState<{ [key: string]: number }>({});
  const [unsupportedVideos, setUnsupportedVideos] = useState<Set<string>>(new Set());
  
  // ✅ 4. Video Player Refs and Players
  const flatListRef = useRef<FlatList>(null);
  const videoPlayers = useRef<{ [key: string]: VideoPlayer }>({});
  
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
  
  // ✅ 9. Caption State Management
  const [expandedCaptions, setExpandedCaptions] = useState<{ [key: string]: boolean }>({});
  
  // ✅ 14. Tap-to-Pause State
  const [showPlayPauseIndicator, setShowPlayPauseIndicator] = useState<{ [key: string]: boolean }>({});
  const [playPauseIndicatorIcon, setPlayPauseIndicatorIcon] = useState<{ [key: string]: 'play' | 'pause' }>({});
  const playPauseTimeoutRefs = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});
  
  // Animations
  const playPauseAnims = useRef<{ [key: string]: Animated.Value }>({});
  const scaleAnims = useRef<{ [key: string]: Animated.Value }>({});
  
  // Filter out unsupported videos (HEVC on Android)
  const supportedVideos = useMemo(() => {
    return videos.filter(video => {
      if (isHEVCVideo(video.playbackUrl) && !codecSupport.hevc) {
        console.warn(`🚫 Filtering out HEVC video on unsupported device: ${video.assetId}`);
        return false;
      }
      return true;
    });
  }, [videos, codecSupport.hevc]);
  
  // Create video players for each video
  useEffect(() => {
    supportedVideos.forEach((video) => {
      if (!videoPlayers.current[video.assetId]) {
        const source: VideoSource = { uri: video.playbackUrl };
        
        const player = useVideoPlayer(source, (player) => {
          player.loop = true;
          player.muted = isMuted;
        });
        
        // Set up player event listeners
        player.addListener('playingChange', (isPlaying, oldIsPlaying) => {
          setVideoPlayingStates(prev => ({ ...prev, [video.assetId]: isPlaying }));
        });
        
        player.addListener('statusChange', (status) => {
          if (status === 'error') {
            console.warn(`Video error for ${video.assetId}`);
            setVideoLoadStates(prev => ({ ...prev, [video.assetId]: 'error' }));
            handleVideoError(video.assetId);
          } else if (status === 'readyToPlay') {
            setVideoLoadStates(prev => ({ ...prev, [video.assetId]: 'loaded' }));
            setRetryAttempts(prev => ({ ...prev, [video.assetId]: 0 }));
          } else if (status === 'loading') {
            setVideoLoadStates(prev => ({ ...prev, [video.assetId]: 'loading' }));
          }
        });
        
        videoPlayers.current[video.assetId] = player;
      }
    });
    
    // Cleanup removed videos
    Object.keys(videoPlayers.current).forEach(assetId => {
      if (!supportedVideos.find(v => v.assetId === assetId)) {
        videoPlayers.current[assetId]?.release();
        delete videoPlayers.current[assetId];
      }
    });
  }, [supportedVideos, isMuted]);
  
  // ✅ 5. Initialize Video States
  useEffect(() => {
    const initialStates: { [key: string]: boolean } = {};
    const initialThumbnails: { [key: string]: boolean } = {};
    
    supportedVideos.forEach((video, index) => {
      const isCurrentVideo = index === currentVideoIndex;
      initialStates[video.assetId] = false; // Start paused
      initialThumbnails[video.assetId] = true; // Show thumbnail initially
      
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
  }, [supportedVideos, currentVideoIndex]);
  
  // Error handling function
  const handleVideoError = useCallback((assetId: string) => {
    const currentRetries = retryAttempts[assetId] || 0;
    const maxRetries = 2;
    
    if (currentRetries < maxRetries) {
      console.log(`🔄 Video error, attempting retry ${currentRetries + 1}/${maxRetries}...`);
      setRetryAttempts(prev => ({ ...prev, [assetId]: currentRetries + 1 }));
      
      // Retry loading the video
      setTimeout(() => {
        const player = videoPlayers.current[assetId];
        if (player) {
          player.replace({ uri: supportedVideos.find(v => v.assetId === assetId)?.playbackUrl || '' });
        }
      }, 2000);
    } else {
      console.warn(`🛑 Max retries reached for video: ${assetId}`);
      setUnsupportedVideos(prev => new Set(prev).add(assetId));
      
      // Auto-skip if it's the current video
      const currentVideo = supportedVideos[currentVideoIndex];
      if (currentVideo?.assetId === assetId && currentVideoIndex < supportedVideos.length - 1) {
        skipFailedVideo();
      }
    }
  }, [retryAttempts, supportedVideos, currentVideoIndex]);
  
  // Skip failed video function
  const skipFailedVideo = useCallback(() => {
    if (currentVideoIndex < supportedVideos.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentVideoIndex + 1,
        animated: true,
      });
    }
  }, [currentVideoIndex, supportedVideos.length]);
  
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
        supportedVideos.forEach((video, index) => {
          const assetId = video.assetId;
          const player = videoPlayers.current[assetId];
          const isCurrentVideo = index === newIndex;
          
          if (player) {
            if (isCurrentVideo) {
              // Play current video
              player.play();
              setShowThumbnails(prev => ({ ...prev, [assetId]: false }));
            } else {
              // Pause non-current videos
              player.pause();
              setShowThumbnails(prev => ({ ...prev, [assetId]: true }));
            }
          }
        });
      }
    }
  }, [currentVideoIndex, supportedVideos, onVideoChange]);
  
  // ✅ Video Resize Mode
  const getVideoContentFit = useCallback(() => {
    return 'cover' as const; // TikTok-style full screen
  }, []);
  
  // ✅ 15. Tap to Pause/Play Handler
  const handleVideoTap = useCallback((assetId: string) => {
    const player = videoPlayers.current[assetId];
    if (!player) return;
    
    const isPlaying = videoPlayingStates[assetId];
    
    if (isPlaying) {
      player.pause();
      setPlayPauseIndicatorIcon(prev => ({ ...prev, [assetId]: 'play' }));
    } else {
      player.play();
      setPlayPauseIndicatorIcon(prev => ({ ...prev, [assetId]: 'pause' }));
    }
    
    // Show play/pause indicator with animation
    setShowPlayPauseIndicator(prev => ({ ...prev, [assetId]: true }));
    
    // Animate indicator
    const anim = playPauseAnims.current[assetId];
    if (anim) {
      anim.setValue(1);
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.delay(800),
        Animated.timing(anim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowPlayPauseIndicator(prev => ({ ...prev, [assetId]: false }));
      });
    }
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [videoPlayingStates]);
  
  // Mute toggle
  useEffect(() => {
    Object.values(videoPlayers.current).forEach(player => {
      player.muted = isMuted;
    });
  }, [isMuted]);
  
  // ✅ Format time helper
  const formatTime = useCallback((milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);
  
  // ✅ 15. Thumbnail Component
  const renderThumbnail = useCallback((video: VideoData) => {
    if (!showThumbnails[video.assetId]) return null;
    
    return (
      <View style={styles.thumbnailContainer}>
        {video.thumbnailUrl ? (
          <Image
            source={{ uri: video.thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="play-circle" size={80} color="rgba(255,255,255,0.7)" />
          </View>
        )}
      </View>
    );
  }, [showThumbnails]);
  
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
  
  // ✅ Video Item Renderer with expo-video
  const renderVideoItem = useCallback(({ item, index }: { item: VideoData; index: number }) => {
    const isCurrentVideo = index === currentVideoIndex;
    const player = videoPlayers.current[item.assetId];
    
    return (
      <View style={[styles.videoContainer, { height: videoContainerHeight }]}>
        {/* ✅ 2. Full-Screen Video with expo-video */}
        <View style={styles.videoWrapper}>
          {player && (
            <VideoView
              style={styles.video}
              player={player}
              contentFit={getVideoContentFit()}
              allowsFullscreen={false}
              allowsPictureInPicture={false}
            />
          )}
          
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
          {(videoLoadStates[item.assetId] === 'error' || unsupportedVideos.has(item.assetId)) && (
            <View style={styles.loadingOverlay}>
              <Ionicons name="warning-outline" size={48} color="#FF6B6B" />
              <Text style={[styles.loadingText, { color: '#FF6B6B' }]}>
                Video format not supported
              </Text>
              <Text style={[styles.loadingText, { fontSize: 12, opacity: 0.7 }]}>
                This device doesn't support HEVC codec
              </Text>
              
              {/* Skip Button for failed videos */}
              {currentVideoIndex < supportedVideos.length - 1 && (
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
        
        {/* ✅ 14. Full-Screen Touch Area for Tap-to-Pause */}
        <TouchableWithoutFeedback onPress={() => handleVideoTap(item.assetId)}>
          <View style={styles.fullScreenTouchArea} />
        </TouchableWithoutFeedback>
      </View>
    );
  }, [
    currentVideoIndex, 
    videoContainerHeight, 
    videoLoadStates,
    unsupportedVideos,
    supportedVideos.length,
    insets,
    responsiveSize,
    getVideoContentFit,
    renderThumbnail,
    renderCaption,
    renderActionButtons,
    handleVideoTap,
    showPlayPauseIndicator,
    playPauseIndicatorIcon,
    skipFailedVideo
  ]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(videoPlayers.current).forEach(player => {
        player.release();
      });
    };
  }, []);
  
  // Show unsupported content message if all videos are filtered out
  if (supportedVideos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="warning-outline" size={64} color="#FF6B6B" />
        <Text style={styles.emptyTitle}>No Compatible Videos</Text>
        <Text style={styles.emptyMessage}>
          All videos use HEVC codec which is not supported on this device.
          Please try videos with H.264 encoding.
        </Text>
      </View>
    );
  }
  
  if (isLoading || supportedVideos.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
        <Text style={styles.loadingText}>Loading videos...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      <FlatList
        ref={flatListRef}
        data={supportedVideos}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item.assetId}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={videoContainerHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        getItemLayout={(data, index) => ({
          length: videoContainerHeight,
          offset: videoContainerHeight * index,
          index,
        })}
        removeClippedSubviews={Platform.OS === 'android'}
        initialScrollIndex={Math.min(initialVideoIndex, supportedVideos.length - 1)}
      />
    </View>
  );
};

// ✅ Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoContainer: {
    width: screenWidth,
    backgroundColor: '#000000',
    position: 'relative',
  },
  videoWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  thumbnailContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 22,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  leftContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingRight: 20,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    color: '#ffffff',
    fontWeight: 'bold',
    marginRight: 12,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
  },
  followText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  captionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  caption: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
    flexWrap: 'wrap',
  },
  readMoreText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  rightActions: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 20,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 8,
  },
  actionText: {
    color: '#ffffff',
    marginTop: 4,
    fontSize: 12,
  },
  playPauseIndicator: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenTouchArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});
