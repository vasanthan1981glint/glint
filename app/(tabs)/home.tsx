import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  PanResponder,
  PixelRatio,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebaseConfig';

import { useViewTracking } from '../../hooks/useViewTracking';
import { algorithmicFeedService } from '../../lib/algorithmicFeedService';
import { engagementTrackingService } from '../../lib/engagementTrackingService';
import { followService } from '../../lib/followService';
import { useFollowStore } from '../../lib/followStore';
import { savedVideosService } from '../../lib/savedVideosService';
import thumbnailService from '../../lib/thumbnailService';
import { UserProfile, UserProfileService } from '../../lib/userProfileService';
import { useUserStore } from '../../lib/userStore';
import { videoDeleteService } from '../../lib/videoDeleteService';
import { ProcessedVideoVariant } from '../../lib/videoProcessingPipeline';
import { viewTracker } from '../../lib/viewTrackingService';

import VideoOptionsModal from '../../components/VideoOptionsModal';
import ViewCountDisplay from '../../components/ViewCountDisplay';
// ✅ Import our new Enhanced Short-form Video Player
import ShortFormVideoPlayer from '../../components/ShortFormVideoPlayer';

dayjs.extend(relativeTime);

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Enhanced universal responsive sizing for ALL device types
const getResponsiveSize = () => {
  const { height, width } = Dimensions.get('window');
  const pixelRatio = PixelRatio.get();
  
  // Comprehensive device categorization for maximum compatibility
  const isVerySmallDevice = height < 650 || width < 320; // iPhone SE 1st gen, very old Android
  const isSmallDevice = (height >= 650 && height < 750) || (width >= 320 && width < 375); // iPhone SE 2nd/3rd gen, iPhone 8
  const isMediumDevice = (height >= 750 && height < 850) || (width >= 375 && width < 400); // iPhone 12 mini, 13 mini
  const isLargeDevice = (height >= 850 && height < 950) || (width >= 400 && width < 430); // iPhone 12/13/14/15 standard
  const isExtraLargeDevice = height >= 950 || width >= 430; // iPhone Pro Max, Plus models
  const isTablet = width > 768 || (width > 600 && height > 900); // iPad and larger tablets
  const isLandscape = width > height;
  
  // Enhanced notch/island detection with Android compatibility
  const hasNotch = height >= 812 || (Platform.OS === 'ios' && height >= 780); // iPhone X and newer
  const hasDynamicIsland = height >= 852 || (Platform.OS === 'ios' && height >= 820); // iPhone 14 Pro and newer
  const isAndroid = Platform.OS === 'android';
  
  // Universal scaling system with comprehensive bounds
  const baseWidth = 375; // iPhone 8 width as reference
  const baseHeight = 667; // iPhone 8 height as reference
  const widthScale = Math.max(Math.min(width / baseWidth, 2.5), 0.5); // Bounded between 0.5 and 2.5
  const heightScale = Math.max(Math.min(height / baseHeight, 2.5), 0.5); // Bounded between 0.5 and 2.5
  const scale = Math.min(widthScale, heightScale);
  
  // Device-specific scaling adjustments for optimal UI
  const deviceScale = isTablet ? scale * 1.25 : isExtraLargeDevice ? scale * 1.15 : isVerySmallDevice ? scale * 0.85 : scale;
  
  return {
    isVerySmallDevice,
    isSmallDevice,
    isMediumDevice,
    isLargeDevice,
    isExtraLargeDevice,
    isTablet,
    isLandscape,
    hasNotch,
    hasDynamicIsland,
    isAndroid,
    scale: deviceScale,
    screenWidth: width,
    screenHeight: height,
    
    // Universal font sizes - automatically scale for ANY device
    fontSize: {
      tiny: Math.max(Math.round((isTablet ? 12 : isVerySmallDevice ? 8 : isSmallDevice ? 9 : 10) * deviceScale), 8),
      small: Math.max(Math.round((isTablet ? 16 : isVerySmallDevice ? 10 : isSmallDevice ? 11 : 12) * deviceScale), 10),
      medium: Math.max(Math.round((isTablet ? 20 : isVerySmallDevice ? 13 : isSmallDevice ? 14 : 16) * deviceScale), 12),
      large: Math.max(Math.round((isTablet ? 24 : isVerySmallDevice ? 16 : isSmallDevice ? 17 : 19) * deviceScale), 14),
      xlarge: Math.max(Math.round((isTablet ? 28 : isVerySmallDevice ? 19 : isSmallDevice ? 20 : 22) * deviceScale), 16),
    },
    
    // Universal spacing - proportional to device size
    spacing: {
      tiny: Math.max(Math.round((isTablet ? 6 : isVerySmallDevice ? 2 : 3) * deviceScale), 2),
      small: Math.max(Math.round((isTablet ? 10 : isVerySmallDevice ? 4 : isSmallDevice ? 5 : 6) * deviceScale), 4),
      medium: Math.max(Math.round((isTablet ? 18 : isVerySmallDevice ? 8 : isSmallDevice ? 10 : 12) * deviceScale), 6),
      large: Math.max(Math.round((isTablet ? 26 : isVerySmallDevice ? 14 : isSmallDevice ? 16 : 20) * deviceScale), 10),
      xlarge: Math.max(Math.round((isTablet ? 34 : isVerySmallDevice ? 20 : isSmallDevice ? 24 : 28) * deviceScale), 16),
    },
    
    // Universal icon sizes - ensuring proper touch targets on ALL devices
    iconSizes: {
      small: Math.max(isTablet ? 26 : isLargeDevice ? 22 : isSmallDevice ? 18 : 20, 16),
      medium: Math.max(isTablet ? 32 : isLargeDevice ? 28 : isSmallDevice ? 24 : 26, 22),
      large: Math.max(isTablet ? 40 : isLargeDevice ? 36 : isSmallDevice ? 32 : 34, 30),
      xlarge: Math.max(isTablet ? 46 : isLargeDevice ? 42 : isSmallDevice ? 38 : 40, 36),
      extraLarge: Math.max(isTablet ? 68 : isLargeDevice ? 60 : isSmallDevice ? 48 : 54, 44),
    },
    
    // Universal avatar sizes
    avatar: {
      small: Math.max(Math.round((isTablet ? 38 : isVerySmallDevice ? 30 : isSmallDevice ? 32 : 34) * deviceScale), 26),
      medium: Math.max(Math.round((isTablet ? 50 : isVerySmallDevice ? 36 : isSmallDevice ? 40 : 44) * deviceScale), 32),
      large: Math.max(Math.round((isTablet ? 64 : isVerySmallDevice ? 44 : isSmallDevice ? 48 : 52) * deviceScale), 38),
    },
    
    // Universal border radius
    borderRadius: {
      small: Math.max(Math.round((isTablet ? 12 : isVerySmallDevice ? 6 : isSmallDevice ? 8 : 9) * deviceScale), 4),
      medium: Math.max(Math.round((isTablet ? 16 : isVerySmallDevice ? 9 : isSmallDevice ? 11 : 13) * deviceScale), 6),
      large: Math.max(Math.round((isTablet ? 24 : isVerySmallDevice ? 15 : isSmallDevice ? 17 : 21) * deviceScale), 12),
    },
    
    // Universal layout dimensions
    topBarHeight: Math.max(isVerySmallDevice ? 38 : isSmallDevice ? 42 : isTablet ? 58 : 48, 32),
    bottomPadding: Math.max(isVerySmallDevice ? 70 : isSmallDevice ? 80 : isTablet ? 100 : 90, 55),
  };
};

interface VideoData {
  assetId: string;
  videoId?: string; // Google Cloud uses videoId
  playbackUrl: string;
  streamingUrl?: string; // Google Cloud uses streamingUrl
  thumbnailUrl: string;
  username: string;
  userId: string;
  views?: number;
  createdAt: string;
  caption?: string;
}

interface VerticalVideoPlayerProps {
  videos: VideoData[];
  initialVideoIndex?: number;
  onClose: () => void;
  showCloseButton?: boolean;
}

export const VerticalVideoPlayer: React.FC<VerticalVideoPlayerProps> = ({
  videos,
  initialVideoIndex = 0,
  onClose,
  showCloseButton = true
}) => {
  const insets = useSafeAreaInsets();
  
  // � ULTIMATE UNIVERSAL LAYOUT SOLUTION
  // This approach uses a measurement-based system to ensure perfect fit on ANY device
  const [layoutMeasured, setLayoutMeasured] = useState(false);
  const [availableHeight, setAvailableHeight] = useState(screenHeight);
  
  // Measure the actual available space dynamically
  const onLayoutMeasure = useCallback((event: any) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0 && height !== availableHeight) {
      setAvailableHeight(height);
      setLayoutMeasured(true);
      console.log(`🎯 MEASURED Available Height: ${height}px (vs screen: ${screenHeight}px)`);
    }
  }, [availableHeight]);
  
  // Fallback calculation for immediate rendering while measurement happens
  const videoContainerHeight = useMemo(() => {
    // 💪 BULLETPROOF: Use EXACT same calculation as tab layout (49 + insets.bottom)
    const EXACT_TAB_BAR_HEIGHT = 49 + insets.bottom;
    const perfectHeight = screenHeight - EXACT_TAB_BAR_HEIGHT;
    
    console.log(`💪 BULLETPROOF Layout Calculation:
      🔧 Screen Height: ${screenHeight}px
      📱 Platform: ${Platform.OS}
      🏠 Safe Area Bottom: ${insets.bottom}px
      📊 EXACT Tab Bar Height: ${EXACT_TAB_BAR_HEIGHT}px
      ✅ PERFECT Video Height: ${perfectHeight}px
      📐 Zero Gap Guaranteed!`);
    
    return perfectHeight;
  }, [insets.bottom]);
  
  const { user } = useAuth();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<{ [key: string]: Video }>({});
  const { avatar: userAvatar, username: userUsername } = useUserStore();
  
  // Debug logging for user store data (commented out to reduce console spam)
  // console.log('🎬 VerticalVideoPlayer userStore data:', {
  //   userAvatar,
  //   userUsername,
  //   user: user?.uid,
  //   displayName: user?.displayName,
  // });
  
  // Create enhanced user profile with better fallbacks and validation
  const createUserProfile = useCallback(() => {
    const fallbackUsername = userUsername || user?.displayName || user?.email?.split('@')[0] || 'User';
    const fallbackAvatar = userAvatar && userAvatar !== 'https://randomuser.me/api/portraits/men/32.jpg'
      ? userAvatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackUsername)}&size=40&background=4ECDC4&color=ffffff&format=png`;
    
    return {
      avatar: fallbackAvatar,
      username: fallbackUsername,
      isVerified: false,
    };
  }, [userAvatar, userUsername, user]);

  const [currentVideoIndex, setCurrentVideoIndex] = useState(initialVideoIndex);
  const [isMuted, setIsMuted] = useState(false); // Start with audio enabled
  const [showControls, setShowControls] = useState(true);

  const [videoLikes, setVideoLikes] = useState<{ [key: string]: boolean }>({});
  const [videoLikeCounts, setVideoLikeCounts] = useState<{ [key: string]: number }>({});
  const [videoSaved, setVideoSaved] = useState<{ [key: string]: boolean }>({});
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [videoDurations, setVideoDurations] = useState<{ [key: string]: number }>({});
  const [videoPositions, setVideoPositions] = useState<{ [key: string]: number }>({});
  const [videoPlayingStates, setVideoPlayingStates] = useState<{ [key: string]: boolean }>({});
  const [videoThumbnails, setVideoThumbnails] = useState<{ [key: string]: string }>({});
  
  // Progress bar drag state (add missing state)
  const [dragStartPosition, setDragStartPosition] = useState<{ [key: string]: number }>({});
  const [thumbnailsLoading, setThumbnailsLoading] = useState<{ [key: string]: boolean }>({});
  const [showThumbnails, setShowThumbnails] = useState<{ [key: string]: boolean }>({});
  const [showVideoOptionsModal, setShowVideoOptionsModal] = useState(false);
  const [selectedVideoForOptions, setSelectedVideoForOptions] = useState<VideoData | null>(null);
  const [videoOwnership, setVideoOwnership] = useState<{ [key: string]: boolean }>({});
  const [videoLoading, setVideoLoading] = useState<{ [key: string]: boolean }>({});
  const [videoBuffering, setVideoBuffering] = useState<{ [key: string]: boolean }>({});
  const [videoLoadStates, setVideoLoadStates] = useState<{ [key: string]: 'loading' | 'loaded' | 'error' | 'codec-error' }>({});
  const [videoRetryCount, setVideoRetryCount] = useState<{ [key: string]: number }>({});
  
  // Enhanced video metadata for complete processing pipeline
  const [videoMetadata, setVideoMetadata] = useState<{ [key: string]: { 
    width: number; 
    height: number; 
    aspectRatio: number;
    orientation: 'portrait' | 'landscape' | 'square';
    resizeMode: 'contain' | 'cover' | 'stretch';
    variants?: ProcessedVideoVariant[];
    renderingPolicy?: {
      renderingMode: 'contain' | 'cover' | 'fill';
      backgroundFill: 'solid' | 'blur' | 'gradient';
      backgroundColor?: string;
    };
    cdnUrls?: { [resolution: string]: string };
  } }>({});
  
  // Adaptive streaming state
  const [currentQuality, setCurrentQuality] = useState<{ [key: string]: string }>({});
  const [networkQuality, setNetworkQuality] = useState<'high' | 'medium' | 'low'>('high');
  
  // Play/pause indicator state for tap feedback
  const [showPlayPauseIndicator, setShowPlayPauseIndicator] = useState<{ [key: string]: boolean }>({});
  const [playPauseIndicatorIcon, setPlayPauseIndicatorIcon] = useState<{ [key: string]: 'play' | 'pause' }>({});
  
  // Caption modal state
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [selectedCaptionVideo, setSelectedCaptionVideo] = useState<VideoData | null>(null);

  // Global follow system
  const { followStates, loadMultipleFollowStates, toggleFollow: globalToggleFollow } = useFollowStore();
  const [followCounts, setFollowCounts] = useState<{ [userId: string]: { followers: number; following: number } }>({});

  // Keep existing optimistic states for smooth UX
  const recentFollowChanges = useRef<{ [userId: string]: number }>({});
  const [optimisticFollowStates, setOptimisticFollowStates] = useState<{ [userId: string]: boolean }>({});
  const instantFollowStates = useRef<{ [userId: string]: boolean }>({});

  // User profiles state for real user data
  const [userProfiles, setUserProfiles] = useState<{ [userId: string]: UserProfile }>({});
  const [profilesLoading, setProfilesLoading] = useState<{ [userId: string]: boolean }>({});

  // YouTube Shorts-style progress bar state
  const [showProgressBar, setShowProgressBar] = useState<{ [key: string]: boolean }>({});
  const [progressBarVisible, setProgressBarVisible] = useState<{ [key: string]: boolean }>({});
  const [isDraggingProgress, setIsDraggingProgress] = useState<{ [key: string]: boolean }>({});
  const [dragProgress, setDragProgress] = useState<{ [key: string]: number }>({});
  const progressBarTimeoutRefs = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});

  // Get video ref callback for proper cleanup

  
  // FIXED: Add ref to manage thumbnail timeouts and prevent loops
  const thumbnailTimeouts = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});

  // FIXED: Store stable ref callbacks to prevent re-renders
  const videoRefCallbacks = useRef<{ [key: string]: (ref: Video | null) => void }>({});

  // Helper to get or create a stable ref callback for each video
  const getVideoRefCallback = useCallback((assetId: string) => {
    if (!videoRefCallbacks.current[assetId]) {
      videoRefCallbacks.current[assetId] = (ref: Video | null) => {
        if (ref && !videoRefs.current[assetId]) {
          videoRefs.current[assetId] = ref;
          // DISABLED: console.log(`📹 Video ref set for: ${assetId}`);
        }
      };
    }
    return videoRefCallbacks.current[assetId];
  }, []);

  // FIXED: Add ref to prevent state sync loops
  const stateSyncTimeoutRefs = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});
  const lastStateSyncTime = useRef<{ [key: string]: number }>({});

  // Animation refs
  const controlsOpacity = useRef(new Animated.Value(1)).current; // YouTube-style controls fade
  const scaleAnims = useRef<{ [key: string]: Animated.Value }>({});
  const playPauseAnims = useRef<{ [key: string]: Animated.Value }>({});

  // Auto-hide controls
  const controlsTimeoutRef = useRef<any>(null);

  // YouTube-style controls fade animation
  useEffect(() => {
    Animated.timing(controlsOpacity, {
      toValue: showControls ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showControls, controlsOpacity]);

  // FIXED: Cleanup effect to prevent memory leaks and orphaned timeouts
  useEffect(() => {
    return () => {
      // Clear all thumbnail timeouts
      Object.values(thumbnailTimeouts.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      thumbnailTimeouts.current = {};
      
      // Clear all play/pause timeouts
      Object.values(playPauseTimeoutRefs.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      playPauseTimeoutRefs.current = {};
      
      // Clear all state sync timeouts
      Object.values(stateSyncTimeoutRefs.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      stateSyncTimeoutRefs.current = {};
      
      // Clear controls timeout
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      // Clear all progress bar timeouts
      Object.values(progressBarTimeoutRefs.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      progressBarTimeoutRefs.current = {};
      
      // Reset toggling flags
      isTogglingRef.current = {};
      lastStateSyncTime.current = {};
    };
  }, []);

  // Get current video for view tracking
  const currentVideo = videos[currentVideoIndex];
  const isCurrentVideoVisible = currentVideoIndex >= 0 && currentVideoIndex < videos.length;
  const isCurrentVideoPlaying = currentVideo ? (videoPlayingStates[currentVideo.assetId] ?? true) : false;

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

  // Development debugging functions (accessible via console)
  useEffect(() => {
    if (__DEV__) {
      // Make debugging functions globally accessible
      (global as any).glintDebug = {
        ...((global as any).glintDebug || {}), // Preserve existing debug functions
        getLayoutInfo: () => {
          const EXACT_TAB_BAR_HEIGHT = 49 + insets.bottom;
          const layoutInfo = {
            screenDimensions: `${screenWidth}x${screenHeight}`,
            platform: Platform.OS,
            safeAreaInsets: insets,
            exactTabBarHeight: EXACT_TAB_BAR_HEIGHT,
            videoContainerHeight,
            calculationMethod: 'BULLETPROOF (exact tab layout match)',
          };
          console.log('� BULLETPROOF Layout Debug Info:', layoutInfo);
          return layoutInfo;
        },
        clearViews: async () => {
          console.log('🧹 Clearing all view data...');
          await viewTracker.clearAllViewData();
          console.log('✅ View data cleared! Try viewing videos again.');
        },
        getViewDebug: () => {
          const debug = viewTracker.getDebugInfo();
          console.log('🔍 View Tracking Debug Info:', debug);
          return debug;
        },
        getVideoViews: async (videoId: string) => {
          const views = await viewTracker.getViewCount(videoId);
          console.log(`📊 Video ${videoId} has ${views} views`);
          return views;
        },
        testRecordView: async (videoId: string) => {
          console.log(`🧪 Testing view recording for video: ${videoId}`);
          const result = await viewTracker.recordView(videoId, 3);
          console.log(`✅ View recording result: ${result}`);
          const newViews = await viewTracker.getViewCount(videoId);
          console.log(`📊 Updated view count: ${newViews}`);
          return { recorded: result, newCount: newViews };
        }
      };
      console.log('🛠️ Debug functions available:');
      console.log('- glintDebug.getLayoutInfo() - Get bulletproof layout calculations');
      console.log('- glintDebug.clearViews() - Clear all view data');
      console.log('- glintDebug.getViewDebug() - Get tracking debug info');
      console.log('- glintDebug.getVideoViews(videoId) - Get view count for video');
      console.log('- glintDebug.testRecordView(videoId) - Test recording a view');
    }
  }, [videoContainerHeight, insets]);

  // 🎵 Audio Management - Pause all videos when component loses focus
  const pauseAllVideos = useCallback(async () => {
    console.log('⏸️ Pausing all videos due to navigation/focus loss');
    try {
      const videoRefEntries = Object.entries(videoRefs.current);
      if (videoRefEntries.length === 0) {
        console.log('📹 No video refs to pause');
        return;
      }

      await Promise.all(
        videoRefEntries.map(async ([assetId, videoRef]) => {
          try {
            if (videoRef) {
              await videoRef.pauseAsync();
              console.log(`⏸️ Paused video: ${assetId}`);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to pause video ${assetId}:`, error);
          }
        })
      );
      console.log('✅ All videos paused successfully');
    } catch (error) {
      console.error('❌ Error pausing videos:', error);
    }
  }, []);

  // 🎯 Focus Management - Handle navigation events
  useFocusEffect(
    useCallback(() => {
      console.log('🎬 VerticalVideoPlayer focused - videos can play');
      
      // When component becomes focused, we don't auto-resume videos
      // This is intentional - let user manually resume if needed

      return () => {
        // When component loses focus (navigation), pause all videos
        console.log('🎬 VerticalVideoPlayer unfocused - pausing all videos');
        pauseAllVideos();
      };
    }, [pauseAllVideos])
  );

  // Initialize playing states for all videos (start playing by default)
  useEffect(() => {
    const initialStates: { [key: string]: boolean } = {};
    const initialLikes: { [key: string]: boolean } = {};
    const initialLikeCounts: { [key: string]: number } = {};
    const initialThumbnailStates: { [key: string]: boolean } = {};
    const initialFollowStates: { [key: string]: boolean } = {};
    
    videos.forEach((video, index) => {
      // Only the current/initial video should start playing immediately
      const isInitialVideo = index === initialVideoIndex;
      initialStates[video.assetId] = isInitialVideo; // Only initial video starts playing
      
      // Hide thumbnail for initial video, show for others
      initialThumbnailStates[video.assetId] = !isInitialVideo;
      
      // Initialize likes and counts with default values to prevent undefined
      if (videoLikes[video.assetId] === undefined) {
        initialLikes[video.assetId] = false;
      }
      if (videoLikeCounts[video.assetId] === undefined) {
        initialLikeCounts[video.assetId] = 0;
      }
      
      // Initialize follow states for video owners
      if (video.userId && followStates[video.userId] === undefined) {
        initialFollowStates[video.userId] = false;
      }
    });
    
    setVideoPlayingStates(initialStates);
    setShowThumbnails(initialThumbnailStates);
    
    // Only set defaults if not already set
    setVideoLikes(prev => ({ ...initialLikes, ...prev }));
    setVideoLikeCounts(prev => ({ ...initialLikeCounts, ...prev }));
    // Follow states are now handled by global store
    
    console.log(`🎬 Initialized video states - Current video index: ${initialVideoIndex}`);
  }, [videos, initialVideoIndex]);

  // Load actual follow states for all video owners when user is available
  useEffect(() => {
    if (!user || videos.length === 0) return;

    const loadUserDataAndFollowStates = async () => {
      console.log('👥 Loading user profiles and follow states for video owners...');
      
      // Get unique user IDs from videos
      const userIds = [...new Set(
        videos
          .map(video => video.userId)
          .filter(userId => userId)
      )];

      if (userIds.length === 0) {
        console.log('👥 No users to load data for');
        return;
      }

      try {
        // Set loading states
        const loadingState: { [key: string]: boolean } = {};
        userIds.forEach(userId => { loadingState[userId] = true; });
        setProfilesLoading(prev => ({ ...prev, ...loadingState }));

        // Load user profiles in batch
        console.log('📄 Loading user profiles...');
        const profiles = await UserProfileService.batchGetUserProfiles(userIds);
        console.log('📄 Loaded profiles:', profiles);
        setUserProfiles(prev => ({ ...prev, ...profiles }));
        
        // Clear profile loading states
        setProfilesLoading(prev => {
          const newState = { ...prev };
          userIds.forEach(userId => { newState[userId] = false; });
          return newState;
        });

        // Load follow states for all unique users (excluding current user)
        const followableUserIds = userIds.filter(userId => userId !== user.uid);
        
        // Only check follow status for users we don't already have follow states for
        const uncheckedFollowUserIds = followableUserIds.filter(userId => followStates[userId] === undefined);
        
        if (uncheckedFollowUserIds.length > 0) {
          console.log('👥 Loading follow states for NEW users:', uncheckedFollowUserIds);
          const followPromises = uncheckedFollowUserIds.map(async (userId) => {
            const isFollowing = await followService.isFollowing(user.uid, userId);
            // Get follow counts for this user
            const followStats = await followService.getUserFollowStats(userId, user.uid);
            console.log(`👥 Follow check: ${user.uid} -> ${userId} = ${isFollowing}, followers: ${followStats.followersCount}, following: ${followStats.followingCount}`);
            return { 
              userId, 
              isFollowing, 
              followers: followStats.followersCount, 
              following: followStats.followingCount 
            };
          });

          const results = await Promise.all(followPromises);
          
          // Update follow states
          const newFollowStates: { [key: string]: boolean } = {};
          const newFollowCounts: { [key: string]: { followers: number; following: number } } = {};
          results.forEach(({ userId, isFollowing, followers, following }) => {
            newFollowStates[userId] = isFollowing;
            newFollowCounts[userId] = { followers, following };
          });

          // Load follow states into global store
          const userIds = results.map(r => r.userId);
          if (user?.uid) {
            loadMultipleFollowStates(user.uid, userIds);
          }

          // Update follow counts
          setFollowCounts(prev => ({ ...prev, ...newFollowCounts }));
        } else {
          console.log('👥 All follow states already loaded, skipping follow state loading');
        }
        
      } catch (error) {
        console.error('❌ Error loading user data and follow states:', error);
        // Clear all loading states on error
        setProfilesLoading({});
      }
    };

    loadUserDataAndFollowStates();
  }, [user, videos.length]); // Only reload when user changes or video count changes, not on video content changes

  // Handle current video index changes to ensure proper playback
  useEffect(() => {
    if (videos.length === 0) return;
    
    const currentVideo = videos[currentVideoIndex];
    if (!currentVideo) return;
    
    console.log(`🎯 Current video index changed to: ${currentVideoIndex}, video: ${currentVideo.assetId}`);
    
    // Ensure the current video is set to play and thumbnail is hidden
    const assetId = currentVideo.assetId;
    const videoRef = videoRefs.current[assetId];
    
    if (videoRef) {
      // Set state immediately with Firebase delay protection
      setVideoPlayingStates(prev => ({ ...prev, [assetId]: true }));
      setShowThumbnails(prev => ({ ...prev, [assetId]: false }));
      
      // Enhanced auto-play with retry logic for Firebase loading delays
      const attemptAutoPlay = async (retryCount = 0) => {
        try {
          // Check if video is loaded before attempting to play
          const status = await videoRef.getStatusAsync();
          if (status.isLoaded) {
            await videoRef.playAsync();
            console.log(`✅ Auto-play successful for video ${assetId}`);
          } else if (retryCount < 3) {
            // Retry after short delay if video not loaded (Firebase delay)
            setTimeout(() => attemptAutoPlay(retryCount + 1), 200 * (retryCount + 1));
            // console.log(`⏳ Video ${assetId} not loaded yet, retrying in ${200 * (retryCount + 1)}ms`);
          } else {
            console.warn(`⚠️ Video ${assetId} failed to load after retries`);
          }
        } catch (error) {
          console.error(`❌ Failed to auto-play video ${assetId}:`, error);
          // Only show thumbnail and pause state if all retries failed
          if (retryCount >= 2) {
            setShowThumbnails(prev => ({ ...prev, [assetId]: true }));
            setVideoPlayingStates(prev => ({ ...prev, [assetId]: false }));
          }
        }
      };
      
      attemptAutoPlay();
    }
  }, [currentVideoIndex, videos]);

  // Ensure thumbnails are hidden when videos are playing (safety mechanism)
  useEffect(() => {
    const currentVideo = videos[currentVideoIndex];
    if (currentVideo && videoPlayingStates[currentVideo.assetId] === true) {
      setShowThumbnails(prev => ({ ...prev, [currentVideo.assetId]: false }));
    }
  }, [videoPlayingStates, currentVideoIndex, videos]);

  // Initialize and manage thumbnails for all videos
  useEffect(() => {
    const initializeThumbnails = async () => {
      const thumbnails: { [key: string]: string } = {};
      const loading: { [key: string]: boolean } = {};
      const showThumb: { [key: string]: boolean } = {};

      for (const video of videos) {
        const videoIndex = videos.findIndex(v => v.assetId === video.assetId);
        const isInitialVideo = videoIndex === initialVideoIndex;
        
        // Initialize loading state
        loading[video.assetId] = false;
        // Only show thumbnail for non-initial videos
        showThumb[video.assetId] = !isInitialVideo;
        
        // Use existing thumbnailUrl if available and not a placeholder
        if (video.thumbnailUrl && 
            video.thumbnailUrl !== '' && 
            !video.thumbnailUrl.includes('placeholder.com') &&
            !video.thumbnailUrl.includes('via.placeholder.com') &&
            (video.thumbnailUrl.startsWith('http') || video.thumbnailUrl.startsWith('file://'))) {
          
          // Validate thumbnail URL before using it
          try {
            const isValid = await thumbnailService.validateThumbnailUrl(video.thumbnailUrl);
            if (isValid) {
              thumbnails[video.assetId] = video.thumbnailUrl;
              console.log('✅ Using existing valid thumbnail for video:', video.assetId);
            } else {
              console.log('⚠️ Existing thumbnail invalid, generating new one for video:', video.assetId);
              throw new Error('Invalid thumbnail URL');
            }
          } catch (validationError) {
            console.log('🎬 Thumbnail validation had issues, but continuing with generation for video:', video.assetId);
            // Even if validation fails due to network issues, try to generate a new thumbnail
            loading[video.assetId] = true;
            setThumbnailsLoading(prev => ({ ...prev, [video.assetId]: true }));
            
            try {
              // Generate real thumbnail from video at 2 seconds
              const generatedThumbnail = await thumbnailService.generateAndUploadThumbnail(
                video.playbackUrl,
                video.assetId,
                { time: 2000, quality: 0.9 } // High quality thumbnail at 2 seconds
              );
              
              if (generatedThumbnail) {
                thumbnails[video.assetId] = generatedThumbnail;
                
                // Update video document in Firebase with new thumbnail
                try {
                  await updateDoc(doc(db, 'posts', video.assetId), {
                    thumbnailUrl: generatedThumbnail,
                    thumbnailUpdatedAt: serverTimestamp(),
                    thumbnailGenerated: true
                  });
                  console.log('✅ Real thumbnail saved to Firebase for video:', video.assetId);
                } catch (error) {
                  console.error('❌ Error saving thumbnail to Firebase:', error);
                }
              } else {
                // Skip setting thumbnail if generation fails - let video show without thumbnail
                console.log('⚠️ Thumbnail generation failed for video:', video.assetId);
                thumbnails[video.assetId] = '';
              }
            } catch (error) {
              console.error('❌ Error generating thumbnail:', error);
              thumbnails[video.assetId] = '';
            }
            
            loading[video.assetId] = false;
            setThumbnailsLoading(prev => ({ ...prev, [video.assetId]: false }));
          }
        } else {
          // Generate real thumbnail if not available
          console.log('🎬 Generating new thumbnail for video:', video.assetId);
          loading[video.assetId] = true;
          setThumbnailsLoading(prev => ({ ...prev, [video.assetId]: true }));
          
          try {
            // Generate real thumbnail from video at 2 seconds
            const generatedThumbnail = await thumbnailService.generateAndUploadThumbnail(
              video.playbackUrl,
              video.assetId,
              { time: 2000, quality: 0.9 } // High quality thumbnail at 2 seconds
            );
            
            if (generatedThumbnail) {
              thumbnails[video.assetId] = generatedThumbnail;
              
              // Update video document in Firebase with new thumbnail
              try {
                await updateDoc(doc(db, 'posts', video.assetId), {
                  thumbnailUrl: generatedThumbnail,
                  thumbnailUpdatedAt: serverTimestamp(),
                  thumbnailGenerated: true
                });
                console.log('✅ Real thumbnail saved to Firebase for video:', video.assetId);
              } catch (error) {
                console.error('❌ Error saving thumbnail to Firebase:', error);
              }
            } else {
              // Skip setting thumbnail if generation fails
              console.log('⚠️ Real thumbnail generation failed for video:', video.assetId);
              thumbnails[video.assetId] = '';
            }
          } catch (error) {
            console.error('❌ Error generating thumbnail:', error);
            thumbnails[video.assetId] = '';
          }
          
          loading[video.assetId] = false;
          setThumbnailsLoading(prev => ({ ...prev, [video.assetId]: false }));
        }
      }

      setVideoThumbnails(thumbnails);
      setThumbnailsLoading(loading);
      // Don't override showThumbnails if video is currently playing
      setShowThumbnails(prev => {
        const newShowThumb = { ...prev };
        videos.forEach((video, index) => {
          const isInitialVideo = index === initialVideoIndex;
          // Only update if video is not currently playing
          if (!videoPlayingStates[video.assetId]) {
            newShowThumb[video.assetId] = !isInitialVideo;
          }
        });
        return newShowThumb;
      });
    };

    initializeThumbnails();
  }, [videos]);

  // Initialize scale animations for each video
  useEffect(() => {
    videos.forEach((video) => {
      if (!scaleAnims.current[video.assetId]) {
        scaleAnims.current[video.assetId] = new Animated.Value(1);
      }
      if (!playPauseAnims.current[video.assetId]) {
        playPauseAnims.current[video.assetId] = new Animated.Value(0);
      }
    });
  }, [videos]);

  // Check video ownership for all videos
  useEffect(() => {
    const checkAllOwnership = async () => {
      const ownershipMap: { [key: string]: boolean } = {};
      
      for (const video of videos) {
        const isOwner = await videoDeleteService.isVideoOwner(video.assetId);
        ownershipMap[video.assetId] = isOwner;
      }
      
      setVideoOwnership(ownershipMap);
    };
    
    if (videos.length > 0) {
      checkAllOwnership();
    }
  }, [videos]);

  // Load initial video
  useEffect(() => {
    if (flatListRef.current && initialVideoIndex > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: initialVideoIndex,
          animated: false
        });
      }, 100);
    }
  }, [initialVideoIndex]);

  // Handle video scroll/change with improved Android compatibility and Instagram-style speed
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      const previousIndex = currentVideoIndex;
      
      // Only log significant scroll changes to prevent spam
      if (Math.abs(newIndex - previousIndex) > 0) {
        console.log(`📱 Video scroll: ${previousIndex} -> ${newIndex}`);
      }
      setCurrentVideoIndex(newIndex);
      
      // TikTok-style video switching with safe loading checks
      videos.forEach(async (video, index) => {
        const assetId = video.assetId;
        const videoRef = videoRefs.current[assetId];
        
        // Check if video ref exists and component is loaded
        if (!videoRef) {
          // console.log(`⚠️ Video ref not available for ${assetId}, skipping...`);
          return;
        }
        
        const isCurrentVideo = index === newIndex;
        
        try {
          if (isCurrentVideo) {
            // Current video - should auto-play and hide thumbnail immediately
            console.log(`▶️ Auto-playing current video: ${assetId}`);
            
            // Set states immediately BEFORE calling playAsync
            setVideoPlayingStates(prev => ({ ...prev, [assetId]: true }));
            setShowThumbnails(prev => ({ ...prev, [assetId]: false }));
            
            // Check if video is actually loaded before trying to play
            try {
              const status = await videoRef.getStatusAsync();
              if (status.isLoaded) {
                await videoRef.playAsync();
                console.log(`✅ Video ${assetId} is now playing`);
              } else {
                // console.log(`⏳ Video ${assetId} not loaded yet, will auto-play when ready`);
                // Will auto-play in onLoad callback
              }
            } catch (statusError) {
              // console.log(`⏳ Video ${assetId} status check failed, will auto-play when ready`);
              // Will auto-play in onLoad callback
            }
            
          } else {
            // Non-current video - should pause and show thumbnail
            console.log(`⏸️ Pausing non-current video: ${assetId}`);
            
            // Set paused state and show thumbnail
            setVideoPlayingStates(prev => ({ ...prev, [assetId]: false }));
            setShowThumbnails(prev => ({ ...prev, [assetId]: true }));
            
            // Safely pause only if video is loaded
            try {
              const status = await videoRef.getStatusAsync();
              if (status.isLoaded) {
                await videoRef.pauseAsync();
              }
            } catch (pauseError) {
              // console.log(`⚠️ Could not pause ${assetId}, might not be loaded yet`);
            }
          }
        } catch (error) {
          console.error(`❌ Error switching video ${assetId}:`, error);
          
          if (isCurrentVideo) {
            // If current video fails to play, show thumbnail as fallback
            setShowThumbnails(prev => ({ ...prev, [assetId]: true }));
            setVideoPlayingStates(prev => ({ ...prev, [assetId]: false }));
          }
        }
      });
    }
  }, [videos, currentVideoIndex]);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 80, // Increased from 50 to 80 for faster video switching
    minimumViewTime: 100, // Minimum time in ms before considering item viewable
    waitForInteraction: false // Don't wait for user interaction
  };

  // Load video likes
  useEffect(() => {
    if (!user) return;

    const loadVideoLikes = async () => {
      console.log('📊 Loading likes for all videos...');
      const likes: { [key: string]: boolean } = {};
      const likeCounts: { [key: string]: number } = {};

      for (const video of videos) {
        try {
          // Check if user liked this video
          const userLikeQuery = query(
            collection(db, 'posts', video.assetId, 'likes'),
            where('__name__', '==', user.uid)
          );
          const userLikeSnapshot = await getDocs(userLikeQuery);
          likes[video.assetId] = !userLikeSnapshot.empty;

          // Get total like count
          const likesSnapshot = await getDocs(collection(db, 'posts', video.assetId, 'likes'));
          likeCounts[video.assetId] = likesSnapshot.size;
          
          console.log(`📊 Video ${video.assetId}: liked=${likes[video.assetId]}, count=${likeCounts[video.assetId]}`);
        } catch (error) {
          console.error('Error loading likes for video:', video.assetId, error);
          likes[video.assetId] = false;
          likeCounts[video.assetId] = 0;
        }
      }

      console.log('📊 Setting video likes and counts:', { likes, likeCounts });
      setVideoLikes(likes);
      setVideoLikeCounts(likeCounts);
    };

    loadVideoLikes();
  }, [videos, user]);

  // Set up real-time like listeners for instant updates
  useEffect(() => {
    if (!user || videos.length === 0) return;

    const unsubscribes: (() => void)[] = [];

    // Set up real-time listener for each video
    videos.forEach((video) => {
      // Listener for total like count
      const likesRef = collection(db, 'posts', video.assetId, 'likes');
      const unsubscribeLikes = onSnapshot(likesRef, (snapshot) => {
        const newCount = snapshot.size;
        setVideoLikeCounts(prev => ({ ...prev, [video.assetId]: newCount }));
        console.log(`📈 Real-time like count update for ${video.assetId}: ${newCount}`);
      }, (error) => {
        console.error(`❌ Like count listener error for ${video.assetId}:`, error);
      });

      // Listener for current user's like status
      const userLikeRef = doc(db, 'posts', video.assetId, 'likes', user.uid);
      const unsubscribeUserLike = onSnapshot(userLikeRef, (doc) => {
        const isLiked = doc.exists();
        setVideoLikes(prev => ({ ...prev, [video.assetId]: isLiked }));
        console.log(`❤️ Real-time like status update for ${video.assetId}: ${isLiked}`);
      }, (error) => {
        console.error(`❌ User like listener error for ${video.assetId}:`, error);
      });

      unsubscribes.push(unsubscribeLikes, unsubscribeUserLike);
    });

    console.log(`🔴 Set up real-time like listeners for ${videos.length} videos`);

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up like listeners');
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [videos, user]);

  // Load saved videos - Enhanced for real-time updates
  useEffect(() => {
    if (!user) return;

    const loadSavedVideos = async () => {
      console.log('🔄 Loading saved videos state for', videos.length, 'videos');
      const saved: { [key: string]: boolean } = {};

      // Process all videos in parallel for faster loading
      const savePromises = videos.map(async (video) => {
        try {
          // Use savedVideosService to check if video is saved
          const isSaved = await savedVideosService.isVideoSaved(video.assetId);
          saved[video.assetId] = isSaved;
          console.log(`📋 Video ${video.assetId} save status:`, isSaved);
        } catch (error) {
          console.error('Error loading saved video:', video.assetId, error);
          saved[video.assetId] = false;
        }
      });

      // Wait for all save status checks to complete
      await Promise.all(savePromises);

      // Update state with all save statuses
      setVideoSaved(saved);
      console.log('✅ Saved videos loaded:', Object.keys(saved).length, 'videos processed');
    };

    loadSavedVideos();
  }, [videos, user]); // Re-run when videos array changes or user changes

  const toggleLike = async (videoId: string) => {
    if (!user) return;

    const currentLiked = videoLikes[videoId] || false;
    const newLiked = !currentLiked; // Allow both like and unlike
    const currentCount = videoLikeCounts[videoId] || 0;
    const newCount = newLiked ? currentCount + 1 : Math.max(0, currentCount - 1);
    
    console.log(`❤️ Toggling like for ${videoId}: ${currentLiked} -> ${newLiked}, count: ${currentCount} -> ${newCount}`);

    // 🚀 ULTRA FAST - Everything happens synchronously first!
    
    // 1. INSTANT state updates (no async, no delays)
    setVideoLikes(prev => ({ ...prev, [videoId]: newLiked }));
    setVideoLikeCounts(prev => ({ ...prev, [videoId]: newCount }));

    // 2. Ensure video continues playing after like action (FIX for thumbnail issue)
    const currentVideo = videos[currentVideoIndex];
    if (currentVideo?.assetId === videoId) {
      // Force the video to keep playing and hide thumbnail
      setVideoPlayingStates(prev => ({ ...prev, [videoId]: true }));
      setShowThumbnails(prev => ({ ...prev, [videoId]: false }));
      
      // Ensure the video ref is actually playing
      if (videoRefs.current[videoId]) {
        videoRefs.current[videoId].playAsync().catch(() => {
          console.log('🎬 Video play command failed, but continuing...');
        });
      }
    }

    // 3. INSTANT haptic feedback (fire and forget)
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(
        newLiked ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
      ).catch(() => {});
    }

    // 4. INSTANT animation (fire and forget)
    if (scaleAnims.current[videoId]) {
      Animated.sequence([
        Animated.spring(scaleAnims.current[videoId], {
          toValue: newLiked ? 1.5 : 1.2,
          tension: 500,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnims.current[videoId], {
          toValue: 1,
          tension: 500,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }

    // 5. Background Firebase save - FULL TOGGLE SUPPORT (completely non-blocking)
    const saveToFirebase = async () => {
      const likeDocRef = doc(db, 'posts', videoId, 'likes', user.uid);
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          if (newLiked) {
            // Add like
            await setDoc(likeDocRef, { 
              timestamp: serverTimestamp(),
              userId: user.uid,
              videoId: videoId
            });
            console.log(`💝 Like saved to Firebase: ${videoId}`);
          } else {
            // Remove like
            await deleteDoc(likeDocRef);
            console.log(`💔 Like removed from Firebase: ${videoId}`);
          }
          
          // Success - exit retry loop
          break;
          
        } catch (error) {
          retryCount++;
          console.error(`❌ Like/unlike attempt ${retryCount} failed for ${videoId}:`, error);
          
          if (retryCount >= maxRetries) {
            // Final attempt failed - revert UI
            console.log(`🔄 All like attempts failed, reverting UI for ${videoId}`);
            setVideoLikes(prev => ({ ...prev, [videoId]: currentLiked }));
            setVideoLikeCounts(prev => ({ ...prev, [videoId]: currentCount }));
          } else {
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 500));
          }
        }
      }
    };
    
    // Fire and forget - don't wait for Firebase
    saveToFirebase();
  };

  // Memoized profile picture cache to reduce repeated logging
  const profilePictureCache = useRef<Map<string, string>>(new Map());
  
  // Get the best available profile picture for a user
  const getUserProfilePicture = useCallback((userId: string): string => {
    // Check cache first to avoid repeated processing
    const cacheKey = `${userId}-${userProfiles[userId]?.avatar || 'none'}-${userAvatar}`;
    if (profilePictureCache.current.has(cacheKey)) {
      return profilePictureCache.current.get(cacheKey)!;
    }
    
    const userProfile = userProfiles[userId];
    
    // Only log when actually computing (not from cache)
    console.log(`🖼️ Getting profile picture for ${userId}:`, {
      profile: userProfile,
      avatar: userProfile?.avatar,
      hasRealAvatar: userProfile?.avatar && !userProfile.avatar.includes('placeholder')
    });
    
    let finalAvatar: string;
    
    // First priority: Real user avatar from profile
    if (userProfile?.avatar && 
        userProfile.avatar !== 'https://via.placeholder.com/150' && 
        userProfile.avatar !== 'https://via.placeholder.com/50' &&
        !userProfile.avatar.includes('placeholder') &&
        !userProfile.avatar.includes('ui-avatars')) {
      console.log(`✅ Using real avatar for ${userId}: ${userProfile.avatar}`);
      finalAvatar = userProfile.avatar;
    }
    // Second priority: For current user, use their stored avatar
    else if (userId === user?.uid && userAvatar && 
        userAvatar !== 'https://randomuser.me/api/portraits/men/32.jpg' &&
        !userAvatar.includes('placeholder') &&
        !userAvatar.includes('ui-avatars')) {
      console.log(`✅ Using current user avatar for ${userId}: ${userAvatar}`);
      finalAvatar = userAvatar;
    }
    // Third priority: High-quality generated avatar with user's actual name
    else {
      const displayName = userProfile?.fullName || userProfile?.username || `User${userId.slice(-4)}`;
      finalAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&size=150&background=4ECDC4&color=ffffff&format=png&font-size=0.6&rounded=true&bold=true`;
      console.log(`📝 Using generated avatar for ${userId}: ${finalAvatar}`);
    }
    
    // Cache the result
    profilePictureCache.current.set(cacheKey, finalAvatar);
    
    // Clear cache if it gets too large (memory management)
    if (profilePictureCache.current.size > 100) {
      profilePictureCache.current.clear();
    }
    
    return finalAvatar;
  }, [userProfiles, user, userAvatar]);

  // Get the current follow state (instant ref cache takes priority) - ZERO DELAY
  const getCurrentFollowState = useCallback((userId: string): boolean => {
    // Check instant cache first (no state lookups, pure ref access)
    if (instantFollowStates.current[userId] !== undefined) {
      return instantFollowStates.current[userId];
    }
    // Fallback to optimistic then regular state
    return optimisticFollowStates[userId] !== undefined 
      ? optimisticFollowStates[userId] 
      : followStates[userId] || false;
  }, [optimisticFollowStates, followStates]);

  // Follow/Unfollow toggle function - INSTANT UI response
  const toggleFollow = useCallback(async (targetUserId: string) => {
    if (!user || !targetUserId || user.uid === targetUserId) return;

    const currentUserId = user.uid;
    const currentFollowing = getCurrentFollowState(targetUserId);
    const newFollowing = !currentFollowing;

    console.log(`⚡ INSTANT FOLLOW: ${targetUserId}, ${currentFollowing} -> ${newFollowing}`);

    // 🚀 INSTANT REF UPDATE - Zero delay, no re-renders, pure speed
    instantFollowStates.current[targetUserId] = newFollowing;

    // Use global store for follow toggle
    if (user?.uid) {
      await globalToggleFollow(user.uid, targetUserId);
    }
    
    // Batch other updates
    const followChange = newFollowing ? 1 : -1;
    setFollowCounts(prev => ({
      ...prev,
      [targetUserId]: {
        followers: Math.max(0, (prev[targetUserId]?.followers || 0) + followChange),
        following: prev[targetUserId]?.following || 0
      }
    }));

    // INSTANT haptic feedback
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(newFollowing ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
    }

    // 🔥 FIRE-AND-FORGET Firebase save
    followService[newFollowing ? 'followUser' : 'unfollowUser'](currentUserId, targetUserId)
      .then(() => console.log(`🔥 Save complete: ${targetUserId}`))
      .catch(error => console.log(`⚠️ Save failed:`, error));
  }, [user, getCurrentFollowState, globalToggleFollow]);

  // Navigation function for user profiles
  const navigateToUser = (userId: string, username?: string) => {
    console.log(`🔗 Navigating to profile: ${username || 'User'} (${userId})`);
    router.push(`/profile/${userId}` as any);
  };

  const toggleMute = useCallback(() => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    // Apply mute state to all video refs
    Object.keys(videoRefs.current).forEach((key) => {
      const video = videoRefs.current[key];
      if (video) {
        video.setVolumeAsync(newMutedState ? 0.0 : 1.0);
      }
    });
  }, [isMuted]);

  // Add ref for tap debouncing
  const videoLastTapTime = useRef<{ [key: string]: number }>({});

  // Add ref to track if we're currently toggling to prevent conflicts
  const isTogglingRef = useRef<{ [key: string]: boolean }>({});
  const playPauseTimeoutRefs = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});
  
  // Function to reset a problematic video
  const resetVideo = useCallback(async (videoId: string) => {
    console.log(`🔄 [${videoId}] Resetting video...`);
    
    const video = videoRefs.current[videoId];
    if (!video) {
      console.error(`❌ [${videoId}] No video ref for reset`);
      return false;
    }

    const videoData = videos.find(v => v.assetId === videoId);
    if (!videoData?.playbackUrl) {
      console.error(`❌ [${videoId}] No playback URL for reset`);
      return false;
    }

    try {
      // Unload and reload the video
      await video.unloadAsync();
      console.log(`🔄 [${videoId}] Video unloaded`);
      
      await video.loadAsync(
        { uri: videoData.playbackUrl },
        { shouldPlay: false, isLooping: true }
      );
      console.log(`✅ [${videoId}] Video reloaded`);
      
      // Reset state
      setVideoPlayingStates(prev => ({ ...prev, [videoId]: false }));
      setShowThumbnails(prev => ({ ...prev, [videoId]: true }));
      
      return true;
    } catch (error) {
      console.error(`❌ [${videoId}] Reset failed:`, error);
      return false;
    }
  }, [videos]);

  // Function to diagnose video health and readiness
  const checkVideoHealth = useCallback(async (videoId: string) => {
    console.log(`🏥 [${videoId}] Starting video health check...`);
    
    const video = videoRefs.current[videoId];
    if (!video) {
      console.error(`❌ [${videoId}] No video ref found`);
      return { healthy: false, reason: 'NO_REF' };
    }

    try {
      const status = await video.getStatusAsync();
      console.log(`📊 [${videoId}] Video status check:`, {
        isLoaded: status.isLoaded,
        shouldPlay: status.isLoaded ? status.shouldPlay : 'N/A',
        isPlaying: status.isLoaded ? status.isPlaying : 'N/A',
        isBuffering: status.isLoaded ? status.isBuffering : 'N/A',
        positionMillis: status.isLoaded ? status.positionMillis : 'N/A',
        durationMillis: status.isLoaded ? status.durationMillis : 'N/A',
        uri: status.isLoaded ? status.uri : 'N/A'
      });

      if (!status.isLoaded) {
        console.warn(`⚠️ [${videoId}] Video not loaded`);
        return { healthy: false, reason: 'NOT_LOADED', status };
      }

      // Check if video URL is valid
      const videoData = videos.find(v => v.assetId === videoId);
      if (!videoData?.playbackUrl) {
        console.error(`❌ [${videoId}] No playback URL found`);
        return { healthy: false, reason: 'NO_URL', status };
      }

      console.log(`✅ [${videoId}] Video appears healthy`);
      return { healthy: true, status };
      
    } catch (error) {
      console.error(`❌ [${videoId}] Error checking video health:`, error);
      return { healthy: false, reason: 'STATUS_ERROR', error };
    }
  }, [videos]);

  // Function to toggle play/pause for a specific video
  const toggleVideoPlayPause = useCallback(async (videoId: string) => {
    console.log(`🎮 [${videoId}] Toggle play/pause requested`);
    
    const video = videoRefs.current[videoId];
    if (!video) {
      console.warn(`⚠️ [${videoId}] No video ref found`);
      return;
    }

    // Enhanced loading state check with retry mechanism
    try {
      console.log(`🔍 [${videoId}] Checking video status...`);
      const status = await video.getStatusAsync();
      console.log(`📊 [${videoId}] Video status:`, {
        isLoaded: status.isLoaded,
        uri: status.isLoaded ? status.uri : 'Not loaded',
        shouldPlay: status.isLoaded ? status.shouldPlay : 'Unknown',
        isPlaying: status.isLoaded ? status.isPlaying : 'Unknown'
      });
      
      if (!status.isLoaded) {
        console.warn(`⚠️ [${videoId}] Video not loaded yet - attempting to load...`);
        
        // Try to reload the video
        try {
          await video.loadAsync({ uri: videos.find(v => v.assetId === videoId)?.playbackUrl || '' });
          console.log(`✅ [${videoId}] Video reloaded successfully`);
        } catch (loadError) {
          console.error(`❌ [${videoId}] Failed to reload video:`, loadError);
          return;
        }
      }
    } catch (statusError) {
      console.error(`❌ [${videoId}] Cannot get video status:`, statusError);
      return;
    }

    const now = Date.now();
    const lastTap = videoLastTapTime.current[videoId] || 0;
    
    // Prevent rapid taps with better logging
    if (now - lastTap < 150) {
      console.log(`🚫 [${videoId}] Blocked rapid tap (${now - lastTap}ms since last tap)`);
      return;
    }
    
    if (isTogglingRef.current[videoId]) {
      console.log(`🚫 [${videoId}] Already toggling, skipping`);
      return;
    }
    
    videoLastTapTime.current[videoId] = now;
    isTogglingRef.current[videoId] = true;

    try {
      const currentlyPlaying = videoPlayingStates[videoId] ?? true;
      const newPlayingState = !currentlyPlaying;
      
      console.log(`� [${videoId}] State change: ${currentlyPlaying} -> ${newPlayingState}`);
      
      // Clear any existing timeout for this video
      if (playPauseTimeoutRefs.current[videoId]) {
        clearTimeout(playPauseTimeoutRefs.current[videoId]);
        delete playPauseTimeoutRefs.current[videoId];
      }
      
      // Show play/pause indicator immediately with faster animation
      const indicatorIcon = newPlayingState ? 'play' : 'pause';
      setPlayPauseIndicatorIcon(prev => ({ ...prev, [videoId]: indicatorIcon }));
      setShowPlayPauseIndicator(prev => ({ ...prev, [videoId]: true }));
      
      // Animate play/pause indicator for smooth appearance
      if (!playPauseAnims.current[videoId]) {
        playPauseAnims.current[videoId] = new Animated.Value(0);
      }
      
      Animated.sequence([
        Animated.timing(playPauseAnims.current[videoId], {
          toValue: 1,
          duration: 80, // Faster animation for better responsiveness
          useNativeDriver: true,
        }),
        Animated.timing(playPauseAnims.current[videoId], {
          toValue: 0,
          duration: 400, // Faster fade out
          useNativeDriver: true,
        }),
      ]).start();
      
      // Add subtle video bounce effect for tactile feedback
      if (!scaleAnims.current[videoId]) {
        scaleAnims.current[videoId] = new Animated.Value(1);
      }
      
      Animated.sequence([
        Animated.timing(scaleAnims.current[videoId], {
          toValue: 0.98,
          duration: 40, // Much faster bounce for snappier feel
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnims.current[videoId], {
          toValue: 1,
          duration: 80, // Faster return to normal
          useNativeDriver: true,
        }),
      ]).start();
      
      // Hide indicator after animation completes
      playPauseTimeoutRefs.current[videoId] = setTimeout(() => {
        setShowPlayPauseIndicator(prev => ({ ...prev, [videoId]: false }));
        delete playPauseTimeoutRefs.current[videoId];
      }, 400); // Reduced from 600ms to 400ms for faster indicator hide
      
      // Update state immediately for instant UI response
      setVideoPlayingStates(prev => ({ ...prev, [videoId]: newPlayingState }));
      
      // Control video playback with enhanced error handling
      if (newPlayingState) {
        console.log(`▶️ [${videoId}] Attempting to play...`);
        try {
          await video.playAsync();
          console.log(`✅ [${videoId}] Playing successfully`);
          // Hide thumbnail instantly when playing
          setShowThumbnails(prev => ({ ...prev, [videoId]: false }));
          // Hide progress bar when playing
          hideProgressBarForVideo(videoId);
        } catch (playError) {
          console.error(`❌ [${videoId}] Play failed:`, playError);
          
          // Try alternative play method with position reset
          try {
            console.log(`🔄 [${videoId}] Attempting play with position reset...`);
            await video.setPositionAsync(0);
            await video.playAsync();
            console.log(`✅ [${videoId}] Playing after reset`);
            setShowThumbnails(prev => ({ ...prev, [videoId]: false }));
            // Hide progress bar when playing
            hideProgressBarForVideo(videoId);
          } catch (retryError) {
            console.error(`❌ [${videoId}] Retry play failed:`, retryError);
            // Revert state on play failure
            setVideoPlayingStates(prev => ({ ...prev, [videoId]: false }));
            throw retryError;
          }
        }
      } else {
        console.log(`⏸️ [${videoId}] Attempting to pause...`);
        try {
          await video.pauseAsync();
          console.log(`✅ [${videoId}] Paused successfully`);
          // DON'T show thumbnail when paused - keep video frame visible
          
          // Show progress bar when video is paused (YouTube Shorts style)
          showProgressBarForVideo(videoId);
        } catch (pauseError) {
          console.error(`❌ [${videoId}] Pause failed:`, pauseError);
          
          // Try alternative pause method
          try {
            console.log(`🔄 [${videoId}] Attempting force pause...`);
            const status = await video.getStatusAsync();
            if (status.isLoaded && status.isPlaying) {
              await video.setStatusAsync({ shouldPlay: false });
              console.log(`✅ [${videoId}] Force paused`);
              // Show progress bar after successful force pause too
              showProgressBarForVideo(videoId);
            }
          } catch (retryError) {
            console.error(`❌ [${videoId}] Retry pause failed:`, retryError);
            // Revert state on pause failure
            setVideoPlayingStates(prev => ({ ...prev, [videoId]: true }));
            throw retryError;
          }
        }
      }
      
      // Instant haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
    } catch (error) {
      console.error(`❌ [${videoId}] Error toggling play/pause:`, error);
      
      // Hide indicator immediately on error
      setShowPlayPauseIndicator(prev => ({ ...prev, [videoId]: false }));
      
      // Clear timeout on error
      if (playPauseTimeoutRefs.current[videoId]) {
        clearTimeout(playPauseTimeoutRefs.current[videoId]);
        delete playPauseTimeoutRefs.current[videoId];
      }
      
      // Revert state on error by checking actual video state
      try {
        const actualStatus = await video.getStatusAsync();
        if (actualStatus.isLoaded) {
          const actualState = actualStatus.isPlaying;
          console.log(`🔄 [${videoId}] Reverting to actual state: ${actualState}`);
          setVideoPlayingStates(prev => ({ ...prev, [videoId]: actualState }));
        }
      } catch (statusError) {
        console.error(`❌ [${videoId}] Cannot check status for revert:`, statusError);
        // Default to paused state on double error
        setVideoPlayingStates(prev => ({ ...prev, [videoId]: false }));
      }
    } finally {
      // Reset the toggling flag much faster for better responsiveness
      setTimeout(() => {
        isTogglingRef.current[videoId] = false;
        console.log(`🔓 [${videoId}] Toggle lock released`);
      }, 200); // Reduced from 750ms to 200ms for faster response
    }
  }, [videoPlayingStates, videos]);

  const handlePlaybackStatusUpdate = useCallback((videoId: string) => async (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      const currentVideo = videos[currentVideoIndex];
      const isCurrentVideo = currentVideo?.assetId === videoId;
      
      // Skip state syncing if we're currently toggling this video manually
      if (isTogglingRef.current[videoId]) {
        // console.log(`⏭️ Skipping status update for ${videoId} - currently toggling`);
        return;
      }
      
      // Sync internal playing state with actual video state - WITH BETTER DEBOUNCING
      const actuallyPlaying = status.isPlaying;
      const expectedPlaying = videoPlayingStates[videoId]; // Remove default fallback
      const now = Date.now();
      const lastSync = lastStateSyncTime.current[videoId] || 0;
      
      // Enhanced logic to prevent automatic stopping due to Firebase delays
      // Only update our state if there's a significant discrepancy and enough time has passed
      // This prevents the infinite loop by adding a cooldown period
      if (expectedPlaying !== undefined && 
          actuallyPlaying !== expectedPlaying && 
          !isTogglingRef.current[videoId] && 
          (now - lastSync > 3000)) { // Increased from 2000ms to 3000ms for more stability
        
        // Clear any existing timeout for this video
        if (stateSyncTimeoutRefs.current[videoId]) {
          clearTimeout(stateSyncTimeoutRefs.current[videoId]);
        }
        
        // IMPORTANT: Only sync to PAUSE state, never auto-pause the current video
        // This prevents Firebase loading delays from stopping videos automatically
        const shouldSync = isCurrentVideo ? 
          // For current video: Only sync if video is actually playing (never auto-pause)
          (actuallyPlaying && !expectedPlaying) :
          // For non-current videos: Allow normal syncing
          (Math.abs(now - (videoLastTapTime.current[videoId] || 0)) > 3000);
          
        if (shouldSync) {
          // console.log(`🔄 Syncing state for ${videoId}: expected=${expectedPlaying}, actual=${actuallyPlaying}`);
          
          // Debounce the state update to prevent rapid changes
          stateSyncTimeoutRefs.current[videoId] = setTimeout(() => {
            setVideoPlayingStates(prev => ({ ...prev, [videoId]: actuallyPlaying }));
            lastStateSyncTime.current[videoId] = Date.now();
            delete stateSyncTimeoutRefs.current[videoId];
          }, 750); // Increased from 500ms to 750ms for better stability
        }
      }
      
      // Handle thumbnail visibility based on actual playing state (but not when toggling)
      if (!isTogglingRef.current[videoId]) {
        if (actuallyPlaying) {
          // Hide thumbnail immediately when video is actually playing
          setShowThumbnails(prev => {
            if (prev[videoId] !== false) {
              // console.log(`🎬 Hiding thumbnail for playing video: ${videoId}`);
              return { ...prev, [videoId]: false };
            }
            return prev;
          });
        } else {
          // For non-current videos, show thumbnail immediately
          setShowThumbnails(prev => {
            if (prev[videoId] !== true) {
              return { ...prev, [videoId]: true };
            }
            return prev;
          });
        }
      }
      
      // Update duration information
      if (status.durationMillis) {
        setVideoDurations(prev => {
          if (prev[videoId] !== status.durationMillis) {
            return { ...prev, [videoId]: status.durationMillis! };
          }
          return prev;
        });
      }
      
      // Update position for all videos (for individual progress tracking)
      if (status.positionMillis !== undefined) {
        setVideoPositions(prev => {
          const currentPos = prev[videoId] || 0;
          const newPos = status.positionMillis!;
          
          // Reduced threshold for smoother progress bar updates (100ms instead of 300ms)
          if (Math.abs(newPos - currentPos) > 100) {
            return { ...prev, [videoId]: newPos };
          }
          return prev;
        });
      }
      
      // Enhanced auto-restart logic for when video ends - with Firebase loading protection
      if (status.didJustFinish && isCurrentVideo) {
        // console.log(`🏁 Video ${videoId} finished playing - restarting loop`);
        
        // Enhanced restart logic with better error handling for Firebase delays
        const performRestart = async () => {
          try {
            const video = videoRefs.current[videoId];
            // Double-check video readiness before any operations
            const currentStatus = await video?.getStatusAsync();
            
            if (video && currentStatus?.isLoaded && status.isLoaded) { 
              // Ensure the video stays in playing state during restart
              setVideoPlayingStates(prev => ({ ...prev, [videoId]: true }));
              
              // Use replayAsync for seamless looping
              await video.replayAsync();
              // console.log(`🔄 Video ${videoId} restarted successfully (looping)`);
              
              // Hide thumbnail to ensure smooth playback
              setShowThumbnails(prev => ({ ...prev, [videoId]: false }));
            } else {
              // Video not ready for restart, just keep it in playing state
              console.warn(`⚠️ Video ${videoId} not ready for restart - component not loaded`);
              setVideoPlayingStates(prev => ({ ...prev, [videoId]: true }));
            }
          } catch (replayError) {
            console.warn(`⚠️ Error restarting video ${videoId}, trying alternative approach:`, replayError);
            
            // Fallback: Try setting position to 0 and play (only if loaded)
            try {
              const video = videoRefs.current[videoId];
              // Verify readiness again before fallback
              const currentStatus = await video?.getStatusAsync();
              
              if (video && currentStatus?.isLoaded && status.isLoaded) { 
                await video.setPositionAsync(0);
                await video.playAsync();
                // console.log(`🔄 Video ${videoId} restarted using fallback method`);
              } else {
                console.warn(`⚠️ Video ${videoId} not ready for fallback restart`);
              }
            } catch (fallbackError) {
              // Silently fail and just maintain playing state
              console.error(`❌ Failed to restart video ${videoId}:`, fallbackError);
              setVideoPlayingStates(prev => ({ ...prev, [videoId]: true }));
            }
          }
        };
        
        // Add small delay to ensure video component is fully ready
        setTimeout(performRestart, 100);
      }
      
      // Enhanced YouTube-style loading states tracking
      if (status.isBuffering) {
        setVideoBuffering(prev => {
          if (!prev[videoId]) {
            // REDUCED LOGGING: console.log(`⏳ YouTube-style buffering for video ${videoId}`);
          }
          return { ...prev, [videoId]: true };
        });
      } else {
        setVideoBuffering(prev => {
          if (prev[videoId]) {
            // REDUCED LOGGING: console.log(`✅ YouTube-style buffering complete for video ${videoId}`);
          }
          return { ...prev, [videoId]: false };
        });
      }
      
    } else if (status.error) {
      console.error(`💥 Video ${videoId} playback error:`, status.error);
      
      // Show thumbnail on playback error
      setShowThumbnails(prev => ({ ...prev, [videoId]: true }));
      
      // Update state to reflect error
      setVideoPlayingStates(prev => ({ ...prev, [videoId]: false }));
    }
  }, [currentVideoIndex, videos, flatListRef, videoPlayingStates]);

  const formatTime = (timeInMs: number): string => {
    const totalSeconds = Math.floor(timeInMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatCount = (count: number): string => {
    if (!count || count === 0) {
      return '0';
    }
    
    if (count < 1000) {
      return count.toString();
    } else if (count < 1000000) {
      // For thousands: 1.2K, 12K, 999K
      const thousands = count / 1000;
      if (thousands < 10) {
        return `${Math.floor(thousands * 10) / 10}K`; // 1.2K, 9.9K
      } else {
        return `${Math.floor(thousands)}K`; // 12K, 999K
      }
    } else if (count < 1000000000) {
      // For millions: 1.2M, 12M, 999M
      const millions = count / 1000000;
      if (millions < 10) {
        return `${Math.floor(millions * 10) / 10}M`; // 1.2M, 9.9M
      } else {
        return `${Math.floor(millions)}M`; // 12M, 999M
      }
    } else {
      // For billions: 1.2B, 12B, 999B
      const billions = count / 1000000000;
      if (billions < 10) {
        return `${Math.floor(billions * 10) / 10}B`; // 1.2B, 9.9B
      } else {
        return `${Math.floor(billions)}B`; // 12B, 999B
      }
    }
  };

  // Helper functions for caption modal
  const truncateCaption = (text: string, maxLength: number = 30): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return '1 day ago';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      return years === 1 ? '1 year ago' : `${years} years ago`;
    }
  };

  const formatFullDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // YouTube Shorts-style progress bar functions
  const showProgressBarForVideo = useCallback((videoId: string) => {
    setProgressBarVisible(prev => ({ ...prev, [videoId]: true }));
    
    // Clear existing timeout
    if (progressBarTimeoutRefs.current[videoId]) {
      clearTimeout(progressBarTimeoutRefs.current[videoId]);
    }
    
    // Hide progress bar after 3 seconds of inactivity
    progressBarTimeoutRefs.current[videoId] = setTimeout(() => {
      setProgressBarVisible(prev => ({ ...prev, [videoId]: false }));
    }, 3000);
  }, []);

  const hideProgressBarForVideo = useCallback((videoId: string) => {
    if (progressBarTimeoutRefs.current[videoId]) {
      clearTimeout(progressBarTimeoutRefs.current[videoId]);
    }
    setProgressBarVisible(prev => ({ ...prev, [videoId]: false }));
  }, []);

  const handleProgressBarPress = useCallback(async (videoId: string, progress: number) => {
    const videoRef = videoRefs.current[videoId];
    if (!videoRef) return;

    try {
      const status = await videoRef.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        const targetPosition = progress * status.durationMillis;
        await videoRef.setPositionAsync(targetPosition);
        console.log(`📍 Seeked to ${(progress * 100).toFixed(1)}% (${formatTime(targetPosition)})`);
      }
    } catch (error) {
      console.error('Error seeking video:', error);
    }
  }, []);

  const getVideoProgress = useCallback((videoId: string): number => {
    if (isDraggingProgress[videoId]) {
      return dragProgress[videoId] || 0;
    }
    
    const duration = videoDurations[videoId];
    const position = videoPositions[videoId];
    
    // Return 0 if no duration or position data available yet
    if (!duration || duration === 0) return 0;
    
    // If position is undefined or 0, return 0 (video hasn't started)
    if (position === undefined || position === null) return 0;
    
    // Calculate progress ensuring it never exceeds 100%
    return Math.min(position / duration, 1);
  }, [isDraggingProgress, dragProgress, videoDurations, videoPositions]);

  const createProgressPanResponder = useCallback((videoId: string, progressBarWidth: number) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      
      onPanResponderGrant: (event) => {
        const { locationX } = event.nativeEvent;
        const progress = Math.max(0, Math.min(1, locationX / progressBarWidth));
        
        setIsDraggingProgress(prev => ({ ...prev, [videoId]: true }));
        setDragProgress(prev => ({ ...prev, [videoId]: progress }));
        setDragStartPosition(prev => ({ ...prev, [videoId]: locationX }));
      },
      
      onPanResponderMove: (event) => {
        const { locationX } = event.nativeEvent;
        const progress = Math.max(0, Math.min(1, locationX / progressBarWidth));
        
        setDragProgress(prev => ({ ...prev, [videoId]: progress }));
      },
      
      onPanResponderRelease: async () => {
        const progress = dragProgress[videoId] || 0;
        
        // Find the video and seek to the dragged position
        const currentVideo = videos.find((video: any) => video.assetId === videoId);
        if (currentVideo && videoRefs.current[videoId]) {
          await handleProgressBarPress(videoId, progress);
        }
        
        // Clear drag state
        setIsDraggingProgress(prev => ({ ...prev, [videoId]: false }));
        setDragProgress(prev => ({ ...prev, [videoId]: 0 }));
        setDragStartPosition(prev => ({ ...prev, [videoId]: 0 }));
      },
    });
  }, [dragProgress, videos, handleProgressBarPress]);

  const renderTextWithLinks = (text: string, style: any) => {
    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return (
      <Text style={style}>
        {parts.map((part, index) => {
          if (urlRegex.test(part)) {
            return (
              <Text
                key={index}
                style={styles.captionLink}
                onPress={() => handleLinkPress(part)}
              >
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  };

  const handleLinkPress = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.log("Don't know how to open URI: " + url);
      }
    } catch (error) {
      console.error('Error opening link:', error);
    }
  };

  const openCaptionModal = (video: VideoData) => {
    setSelectedCaptionVideo(video);
    setShowCaptionModal(true);
  };

  const handleShare = async (video: VideoData) => {
    try {
      await Share.share({
        message: `Check out this video by @${video.username} on Glint!`,
        url: `glint://video/${video.assetId}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const toggleSaveVideo = async (videoId: string) => {
    if (!user) {
      console.warn('⚠️ User not logged in, cannot save video');
      return;
    }

    if (!videoId) {
      console.error('❌ Invalid video ID provided to toggleSaveVideo');
      return;
    }

    console.log(`💾 Toggling save for video: ${videoId}`);
    
    const currentSavedState = videoSaved[videoId] || false;
    const newSavedState = !currentSavedState;
    
    // 🚀 ULTRA FAST save/unsave with enhanced error handling
    
    // 1. INSTANT UI update - optimistic update
    setVideoSaved(prev => ({ ...prev, [videoId]: newSavedState }));

    // 2. INSTANT haptic feedback
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    // 3. Background Firebase save with enhanced retry logic
    const saveToFirebase = async () => {
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          console.log(`🔄 Save attempt ${retryCount + 1} for video: ${videoId}`);
          
          // Use the savedVideosService to maintain consistency across the app
          await savedVideosService.toggleSaveVideo(videoId);
          
          console.log(`✅ Video ${newSavedState ? 'saved' : 'unsaved'} successfully: ${videoId}`);
          
          // Success - exit retry loop
          break;
          
        } catch (error) {
          retryCount++;
          console.error(`❌ Save attempt ${retryCount} failed for ${videoId}:`, error);
          
          if (retryCount >= maxRetries) {
            // Final attempt failed - revert UI and show user feedback
            console.log(`🔄 All save attempts failed, reverting UI for ${videoId}`);
            setVideoSaved(prev => ({ ...prev, [videoId]: currentSavedState }));
            
            // Optional: Show user feedback about the failure
            // Could add a toast or alert here if needed
          } else {
            // Wait before retry with exponential backoff
            const delay = Math.pow(2, retryCount) * 300;
            // console.log(`⏳ Waiting ${delay}ms before retry ${retryCount + 1}`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    };
    
    // Fire and forget - don't wait for Firebase to keep UI responsive
    saveToFirebase();
  };

  // Function to refresh save states - can be called when new videos are added
  const refreshSaveStates = useCallback(async () => {
    if (!user || videos.length === 0) return;

    console.log('🔄 Refreshing save states for all videos');
    const saved: { [key: string]: boolean } = {};

    try {
      // Process all videos in parallel for faster refresh
      const savePromises = videos.map(async (video) => {
        try {
          const isSaved = await savedVideosService.isVideoSaved(video.assetId);
          saved[video.assetId] = isSaved;
        } catch (error) {
          console.error('Error refreshing save state for video:', video.assetId, error);
          saved[video.assetId] = false;
        }
      });

      await Promise.all(savePromises);
      setVideoSaved(saved);
      console.log('✅ Save states refreshed for', Object.keys(saved).length, 'videos');
    } catch (error) {
      console.error('❌ Error refreshing save states:', error);
    }
  }, [user, videos]);

  // Calculate optimal video display settings based on aspect ratio
  const calculateVideoDisplaySettings = useCallback((videoWidth: number, videoHeight: number, containerWidth: number, containerHeight: number) => {
    const videoAspectRatio = videoWidth / videoHeight;
    const containerAspectRatio = containerWidth / containerHeight;
    
    // Determine video orientation
    let orientation: 'portrait' | 'landscape' | 'square';
    if (videoAspectRatio < 0.9) {
      orientation = 'portrait';
    } else if (videoAspectRatio > 1.1) {
      orientation = 'landscape';
    } else {
      orientation = 'square';
    }
    
    // Calculate optimal resize mode and dimensions for full-screen display
    let resizeMode: 'contain' | 'cover' = 'cover';
    let displayWidth = containerWidth;
    let displayHeight = containerHeight;
    let letterboxing = false;
    let pillarboxing = false;
    
    // Use cover mode for full-screen experience (no black bars)
    // This will crop the video if needed to fill the entire screen
    if (videoAspectRatio > containerAspectRatio) {
      // Video is wider than container - will crop horizontally
      displayWidth = containerHeight * videoAspectRatio;
    } else if (videoAspectRatio < containerAspectRatio) {
      // Video is taller than container - will crop vertically
      displayHeight = containerWidth / videoAspectRatio;
    }
    
    // Video display calculation logging (commented out to reduce console spam)
    // console.log(`📐 Video display calculation:
    //   Original: ${videoWidth}x${videoHeight} (${videoAspectRatio.toFixed(2)})
    //   Container: ${containerWidth}x${containerHeight} (${containerAspectRatio.toFixed(2)})
    //   Display: ${displayWidth.toFixed(0)}x${displayHeight.toFixed(0)}
    //   Orientation: ${orientation}
    //   Letterboxing: ${letterboxing}, Pillarboxing: ${pillarboxing}
    //   Resize Mode: ${resizeMode}`);
    
    return {
      width: videoWidth,
      height: videoHeight,
      aspectRatio: videoAspectRatio,
      orientation,
      resizeMode,
      displayWidth,
      displayHeight,
      letterboxing,
      pillarboxing
    };
  }, []);

  // Adaptive Quality Selection
  const selectOptimalVideoQuality = useCallback((variants: ProcessedVideoVariant[], networkQuality: string): string => {
    if (!variants || variants.length === 0) return '';

    // Sort variants by resolution (quality)
    const sortedVariants = [...variants].sort((a, b) => {
      const resolutionOrder = { '480p': 1, '720p': 2, '1080p': 3, '1440p': 4, '4K': 5 };
      return resolutionOrder[a.resolution] - resolutionOrder[b.resolution];
    });

    // Select based on network quality and device capabilities
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    const screenResolution = Math.max(screenWidth, screenHeight);

    let selectedVariant: ProcessedVideoVariant;

    switch (networkQuality) {
      case 'low':
        selectedVariant = sortedVariants[0]; // 480p
        break;
      case 'medium':
        selectedVariant = sortedVariants[Math.min(1, sortedVariants.length - 1)]; // 720p
        break;
      case 'high':
      default:
        // Select based on screen resolution
        if (screenResolution <= 720) {
          selectedVariant = sortedVariants[Math.min(1, sortedVariants.length - 1)]; // 720p
        } else if (screenResolution <= 1080) {
          selectedVariant = sortedVariants[Math.min(2, sortedVariants.length - 1)]; // 1080p
        } else {
          selectedVariant = sortedVariants[sortedVariants.length - 1]; // Highest available
        }
        break;
    }

    console.log(`🎯 Selected ${selectedVariant.resolution} for ${networkQuality} network on ${screenResolution}p screen`);
    return selectedVariant.url;
  }, []);

  // Monitor Network Quality (simplified)
  useEffect(() => {
    const checkNetworkQuality = async () => {
      try {
        // Simple network speed test - in production would use proper network monitoring
        const startTime = Date.now();
        await fetch('https://www.google.com/favicon.ico', { cache: 'no-cache' });
        const endTime = Date.now();
        const latency = endTime - startTime;

        if (latency < 100) {
          setNetworkQuality('high');
        } else if (latency < 300) {
          setNetworkQuality('medium');
        } else {
          setNetworkQuality('low');
        }
      } catch (error) {
        console.warn('⚠️ Network quality check failed, defaulting to medium');
        setNetworkQuality('medium');
      }
    };

    checkNetworkQuality();
    
    // Check every 30 seconds
    const interval = setInterval(checkNetworkQuality, 30000);
    return () => clearInterval(interval);
  }, []);

  // Expose refresh function for parent components to use
  useEffect(() => {
    // Add refreshSaveStates to a global ref if needed by parent components
    (globalThis as any).refreshVerticalPlayerSaveStates = refreshSaveStates;
    
    return () => {
      delete (globalThis as any).refreshVerticalPlayerSaveStates;
    };
  }, [refreshSaveStates]);

  const renderVideoItem = useCallback(({ item, index }: { item: VideoData; index: number }) => {
    const isCurrentVideo = index === currentVideoIndex;
    const responsiveSize = getResponsiveSize();
    const metadata = videoMetadata[item.assetId];
    
    // Calculate intelligent resize mode for full-screen viewing (TikTok/Instagram style)
    let dynamicResizeMode = ResizeMode.COVER; // Default to COVER for full-screen experience
    
    if (metadata) {
      const videoAspectRatio = metadata.aspectRatio;
      const screenAspectRatio = screenWidth / screenHeight;
      
      // Force full-screen experience by using COVER mode
      // This ensures no black bars and videos fill the entire screen
      dynamicResizeMode = ResizeMode.COVER;
      
      // Video aspect ratio logging (commented out to reduce console spam)
      // console.log(`📐 Video ${item.assetId}: ${metadata.width}x${metadata.height} (${videoAspectRatio.toFixed(2)}) -> COVER (full-screen)`);
    }
    
    // Select optimal video URL based on available variants and network quality
    let videoUrl = item.playbackUrl;
    if (metadata?.variants && metadata.variants.length > 0) {
      const optimalUrl = selectOptimalVideoQuality(metadata.variants, networkQuality);
      if (optimalUrl) {
        videoUrl = optimalUrl;
        setCurrentQuality(prev => ({ ...prev, [item.assetId]: optimalUrl }));
      }
    }
    
    return (
      <View style={dynamicStyles.videoContainer}>
        {/* Enhanced video area with comprehensive aspect ratio support */}
        <View style={styles.videoWrapper}>
          {/* No background needed since we're using COVER mode for full-screen */}
          
          <View style={styles.video}>
            <Video
              ref={getVideoRefCallback(item.assetId)}
              source={{ uri: videoUrl }}
              style={styles.video}
              resizeMode={dynamicResizeMode}
                shouldPlay={isCurrentVideo && (videoPlayingStates[item.assetId] === true)}
                isMuted={isMuted}
                  isLooping={true} // Enable looping so videos repeat
                  volume={isMuted ? 0.0 : 1.0}
                  rate={1.0}
                  progressUpdateIntervalMillis={Platform.OS === 'android' ? 500 : 250} // Faster updates for smoother progress bar
                  onPlaybackStatusUpdate={handlePlaybackStatusUpdate(item.assetId)}
                  useNativeControls={false}
                  usePoster={false}
                  posterSource={undefined}
              onLoad={async (status) => {
                // Define variables at the start
                const currentVideo = videos[currentVideoIndex];
                const isCurrentVideo = currentVideo?.assetId === item.assetId;
                
                // console.log(`📹 YouTube-style video loaded: ${item.assetId}, isCurrentVideo: ${isCurrentVideo}`);
                
                // Extract video metadata for aspect ratio handling
                if (status.isLoaded) {
                  // Try to get video dimensions from status
                  const videoStatus = status as any; // Type assertion for accessing video dimensions
                  const videoWidth = videoStatus.naturalSize?.width || videoStatus.videoWidth || 1080;
                  const videoHeight = videoStatus.naturalSize?.height || videoStatus.videoHeight || 1920;
                  
                  if (videoWidth && videoHeight) {
                    const displaySettings = calculateVideoDisplaySettings(
                      videoWidth,
                      videoHeight,
                      screenWidth,
                      screenHeight
                    );
                    
                    // Store video metadata for aspect ratio handling
                    setVideoMetadata(prev => ({
                      ...prev,
                      [item.assetId]: {
                        width: videoWidth,
                        height: videoHeight,
                        aspectRatio: displaySettings.aspectRatio,
                        orientation: displaySettings.orientation,
                        resizeMode: displaySettings.resizeMode
                      }
                    }));
                    
                    // Video metadata logging (commented out to reduce console spam)
                    // console.log(`📐 Video metadata stored for ${item.assetId}:`, {
                    //   dimensions: `${videoWidth}x${videoHeight}`,
                    //   aspectRatio: displaySettings.aspectRatio.toFixed(2),
                    //   orientation: displaySettings.orientation
                    // });
                  }
                }
                
                // Safe volume setup with status check
                try {
                  const videoRef = videoRefs.current[item.assetId];
                  if (videoRef) {
                    const status = await videoRef.getStatusAsync();
                    if (status.isLoaded) {
                      await videoRef.setVolumeAsync(isMuted ? 0.0 : 1.0);
                    } else {
                      // console.log(`⏳ Delaying volume setup for ${item.assetId}, not loaded yet`);
                    }
                  }
                } catch (volumeError) {
                  console.log(`⚠️ Could not set volume for ${item.assetId}, might not be loaded yet`);
                }
                
                // YouTube-style enhanced auto-play logic
                if (isCurrentVideo) {
                  try {
                    console.log(`🚀 Auto-play on load for current video: ${item.assetId}`);
                    
                    // Set playing state immediately
                    setVideoPlayingStates(prev => ({ ...prev, [item.assetId]: true }));
                    setShowThumbnails(prev => ({ ...prev, [item.assetId]: false }));
                    
                    // Enhanced readiness check with multiple validation layers
                    const performAutoPlay = async () => {
                      const videoRef = videoRefs.current[item.assetId];
                      if (!videoRef) {
                        console.warn(`⚠️ No video ref found for ${item.assetId}`);
                        return false;
                      }
                      
                      try {
                        const status = await videoRef.getStatusAsync();
                        if (status.isLoaded) {
                          await videoRef.playAsync();
                          console.log(`✅ Auto-play successful: ${item.assetId}`);
                          return true;
                        } else {
                          console.log(`⏳ Video ${item.assetId} not ready yet, current status:`, {
                            isLoaded: status.isLoaded,
                            error: status.error
                          });
                          return false;
                        }
                      } catch (statusError) {
                        console.warn(`⚠️ Status check failed for ${item.assetId}:`, statusError);
                        return false;
                      }
                    };
                    
                    // Try immediate auto-play
                    const immediateSuccess = await performAutoPlay();
                    
                    if (!immediateSuccess) {
                      // Retry after delay with exponential backoff
                      const retryDelays = [100, 300, 600];
                      
                      for (const delay of retryDelays) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                        
                        const retrySuccess = await performAutoPlay();
                        if (retrySuccess) {
                          console.log(`✅ Auto-play successful after ${delay}ms delay: ${item.assetId}`);
                          break;
                        }
                      }
                      
                      // If all retries failed, show thumbnail and stop trying
                      const finalStatus = await videoRefs.current[item.assetId]?.getStatusAsync();
                      if (!finalStatus?.isLoaded) {
                        console.warn(`⚠️ Video ${item.assetId} failed to load after all retries, showing thumbnail`);
                        setShowThumbnails(prev => ({ ...prev, [item.assetId]: true }));
                        setVideoPlayingStates(prev => ({ ...prev, [item.assetId]: false }));
                      }
                    }
                    
                  } catch (playError) {
                    console.error(`❌ Auto-play failed for video ${item.assetId}:`, playError);
                    
                    // Quick fallback to thumbnail
                    setShowThumbnails(prev => ({ ...prev, [item.assetId]: true }));
                    setVideoPlayingStates(prev => ({ ...prev, [item.assetId]: false }));
                  }
                } else {
                  console.log(`📱 Non-current video loaded with thumbnail: ${item.assetId}`);
                  setShowThumbnails(prev => ({ ...prev, [item.assetId]: true }));
                  setVideoPlayingStates(prev => ({ ...prev, [item.assetId]: false }));
                }
                
                // Track view for the current video when it loads and starts playing
                if (isCurrentVideo && status.isLoaded) {
                  // Add a small delay to ensure the video actually starts playing
                  setTimeout(async () => {
                    try {
                      const viewRecorded = await viewTracker.recordView(item.assetId, 3);
                      if (viewRecorded) {
                        console.log(`👁️ View tracked for video: ${item.assetId}`);
                      } else {
                        console.log(`🚫 View not tracked (duplicate/rejected): ${item.assetId}`);
                      }
                    } catch (error) {
                      console.error('Error tracking view:', error);
                    }
                  }, 3000); // Wait 3 seconds to ensure meaningful view
                }
              }}
              onLoadStart={() => {
                setVideoLoading(prev => {
                  if (!prev[item.assetId]) {
                    // console.log(`🔄 YouTube-style loading started: ${item.assetId}`);
                  }
                  return { ...prev, [item.assetId]: true };
                });
              }}
              onReadyForDisplay={() => {
                setVideoLoading(prev => {
                  // Reduced logging: only log for debugging if needed
                  // if (prev[item.assetId]) {
                  //   console.log(`🎬 YouTube-style video ready: ${item.assetId}`);
                  // }
                  return { ...prev, [item.assetId]: false };
                });
              }}
              onError={(error) => {
                console.error(`💥 Video playback error for ${item.assetId}:`, error);
                
                // Enhanced error handling for codec issues
                const errorString = error?.toString() || '';
                const isCodecError = errorString.includes('Decoder init failed') || 
                                   errorString.includes('MediaCodec') ||
                                   errorString.includes('avc1.640033') ||
                                   errorString.includes('3840, 2160'); // 4K resolution
                
                if (isCodecError) {
                  console.warn(`🎥 Codec error detected for ${item.assetId} - likely 4K video on unsupported device`);
                  // Mark video as failed for codec reasons
                  setVideoLoadStates(prev => ({ ...prev, [item.assetId]: 'codec-error' }));
                } else {
                  // Mark as general error
                  setVideoLoadStates(prev => ({ ...prev, [item.assetId]: 'error' }));
                }
                
                // Show thumbnail on video error
                setShowThumbnails(prev => ({ ...prev, [item.assetId]: true }));
                
                // Update playing state
                setVideoPlayingStates(prev => ({ ...prev, [item.assetId]: false }));
                
                // Try to reload the video with retry limit for transient errors
                if (!isCodecError) {
                  const currentRetries = videoRetryCount[item.assetId] || 0;
                  const maxRetries = 3;
                  
                  if (currentRetries >= maxRetries) {
                    console.log(`❌ Video ${item.assetId} reached max retries (${maxRetries}), marking as permanently failed`);
                    setVideoRetryCount(prev => ({ ...prev, [item.assetId]: maxRetries + 1 }));
                    return;
                  }
                  
                  // Increment retry count
                  setVideoRetryCount(prev => ({ ...prev, [item.assetId]: currentRetries + 1 }));
                  
                  setTimeout(() => {
                    const videoRef = videoRefs.current[item.assetId];
                    if (videoRef) {
                      console.log(`🔄 Attempting to reload video ${item.assetId} after error (retry ${currentRetries + 1}/${maxRetries})`);
                      videoRef.loadAsync({ uri: videoUrl }, {}, false);
                    }
                  }, 2000);
                }
              }}
            />
          </View>
          
            {/* Video Thumbnail Overlay - Fixed logic to prevent showing thumbnail when video should be playing */}
            {(() => {
              const currentVideo = videos[currentVideoIndex];
              const isCurrentVideo = currentVideo?.assetId === item.assetId;
              
              // For current video: NEVER show thumbnail - keep video frame visible
              if (isCurrentVideo) {
                return false; // Never show thumbnail for current video
              } else {
                // For non-current videos: always show thumbnail
                return videoThumbnails[item.assetId];
              }
            })() && (
              <View style={styles.thumbnailOverlay}>
                <Image
                  source={{ uri: videoThumbnails[item.assetId] }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                  onLoadStart={() => {
                    if (!thumbnailsLoading[item.assetId]) {
                      // REDUCED LOGGING: console.log('📸 Loading thumbnail for video:', item.assetId);
                    }
                  }}
                  onLoad={() => {
                    // DISABLED: console.log('✅ Thumbnail loaded successfully for video:', item.assetId);
                  }}
                  onError={(error) => {
                    console.log('⚠️ Thumbnail loading error for video:', item.assetId, 'attempting regeneration...');
                    // Only trigger regeneration if we're not already loading
                    if (!thumbnailsLoading[item.assetId]) {
                      setThumbnailsLoading(prev => ({ ...prev, [item.assetId]: true }));
                      
                      // Regenerate thumbnail in background with improved error handling
                      (async () => {
                        try {
                          console.log('🔄 Regenerating thumbnail for video:', item.assetId);
                          const newThumbnail = await thumbnailService.generateAndUploadThumbnail(
                            item.playbackUrl,
                            item.assetId,
                            { time: 2000, quality: 0.9 }
                          );
                          
                          if (newThumbnail) {
                            setVideoThumbnails(prev => ({ ...prev, [item.assetId]: newThumbnail }));
                            
                            // Update Firebase with new thumbnail (non-blocking)
                            updateDoc(doc(db, 'posts', item.assetId), {
                              thumbnailUrl: newThumbnail,
                              thumbnailUpdatedAt: serverTimestamp(),
                              thumbnailRegenerated: true
                            }).then(() => {
                              console.log('✅ Regenerated thumbnail saved to Firebase:', item.assetId);
                            }).catch((updateError) => {
                              console.log('⚠️ Firebase update failed (non-critical):', updateError);
                            });
                          } else {
                            console.log('⚠️ Regeneration failed for video:', item.assetId);
                            setVideoThumbnails(prev => ({ ...prev, [item.assetId]: '' }));
                          }
                        } catch (regenerateError) {
                          console.log('⚠️ Thumbnail regeneration error:', regenerateError);
                          setVideoThumbnails(prev => ({ ...prev, [item.assetId]: '' }));
                        } finally {
                          setThumbnailsLoading(prev => ({ ...prev, [item.assetId]: false }));
                        }
                      })();
                    }
                  }}
                />
                
                {/* Thumbnail Loading Indicator */}
                {thumbnailsLoading[item.assetId] && (
                  <View style={styles.thumbnailLoadingOverlay}>
                    <Text style={styles.thumbnailLoadingText}>Generating real thumbnail...</Text>
                  </View>
                )}
                
                {/* YouTube-Style Play Button on Thumbnail */}
                {!videoPlayingStates[item.assetId] && (
                  <View style={styles.thumbnailPlayButton}>
                    <View style={styles.playButtonBackground}>
                      <Ionicons
                        name="play"
                        size={responsiveSize.iconSizes.large}
                        color="rgba(255, 255, 255, 0.95)"
                        style={styles.thumbnailPlayIcon}
                      />
                    </View>
                  </View>
                )}
                
                {/* Video Duration Badge */}
                {videoDurations[item.assetId] && (
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>
                      {formatTime(videoDurations[item.assetId])}
                    </Text>
                  </View>
                )}
              </View>
            )}
            
            {/* Codec Error Overlay - Video Format Not Supported */}
            {/* Temporarily disabled due to TypeScript compilation issues */}
            {/* 
            {videoLoadStates[item.assetId] === 'codec-error' && (
              <View style={styles.codecErrorOverlay}>
                <View style={styles.codecErrorContent}>
                  <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
                  <Text style={styles.codecErrorTitle}>Video Format Not Supported</Text>
                  <Text style={styles.codecErrorText}>
                    This video uses a high-resolution format that your device cannot play.
                  </Text>
                  <Text style={styles.codecErrorSubtext}>
                    Try viewing on a different device or contact support.
                  </Text>
                </View>
              </View>
            )}
            */}
          </View>

        {/* YouTube-Style Loading Indicator - Only show for initial loading, not buffering */}
        {videoLoading[item.assetId] && isCurrentVideo && (
          <View style={styles.loadingIndicator}>
            <View style={styles.loadingBackground}>
              <ActivityIndicator 
                size="large" 
                color="rgba(255, 255, 255, 0.9)"
                style={styles.loadingSpinner}
              />
              <Text style={styles.loadingText}>
                Loading...
              </Text>
            </View>
          </View>
        )}

        {/* Play/Pause Indicator with Smooth Animation */}
        {showPlayPauseIndicator[item.assetId] && (
          <Animated.View 
            style={[
              styles.playPauseIndicatorContainer,
              {
                opacity: playPauseAnims.current[item.assetId],
                transform: [
                  {
                    scale: playPauseAnims.current[item.assetId]?.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.5, 1],
                    }) || 1
                  }
                ]
              }
            ]}
          >
            <View style={styles.playPauseIndicatorBackground}>
              <Ionicons
                name={playPauseIndicatorIcon[item.assetId] === 'play' ? 'play' : 'pause'}
                size={responsiveSize.iconSizes.extraLarge || 60}
                color="rgba(255, 255, 255, 0.9)"
              />
            </View>
          </Animated.View>
        )}

        {/* Video Info Overlay - Enhanced for Aspect Ratios and Universal Device Support */}
        <View 
          style={[
            dynamicStyles.videoInfoOverlay, // Use dynamic styles with proper insets calculation
            { 
              paddingBottom: screenHeight < 700 ? 15 : 20, // Adjust for smaller devices
              paddingHorizontal: screenWidth < 375 ? 12 : 16, // Tighter padding on narrow devices
            },
            metadata && metadata.orientation === 'landscape' && styles.videoInfoOverlayLandscape,
            metadata && metadata.orientation === 'square' && styles.videoInfoOverlaySquare
          ]}
          pointerEvents="auto" // Change to auto to capture touches
        >
          {/* Left side - User info and caption with safe zone */}
          <View style={styles.leftContent} pointerEvents="auto">
            <ViewCountDisplay 
              videoId={item.assetId}
              style={styles.viewCount}
            />
            
            <TouchableOpacity 
              style={styles.userRow}
              onPress={(e) => {
                e.stopPropagation(); // Prevent video touch handler from triggering
                e.preventDefault(); // Additional prevention
                const userProfile = userProfiles[item.userId];
                const username = userProfile?.username || item.username;
                console.log(`👤 User row pressed for: ${username} (${item.userId})`);
                navigateToUser(item.userId, username);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.userAvatarContainer}>
                <Image 
                  source={{ 
                    uri: getUserProfilePicture(item.userId)
                  }}
                  style={styles.userAvatar}
                />
                {profilesLoading[item.userId] && (
                  <View style={styles.avatarLoadingOverlay}>
                    <ActivityIndicator size="small" color="#ffffff" />
                  </View>
                )}
              </View>
              <View style={styles.userInfo}>
                <View style={styles.usernameRow}>
                  <Text style={styles.username}>
                    @{profilesLoading[item.userId] ? 'Loading...' : (userProfiles[item.userId]?.username || item.username)}
                  </Text>
                  {userProfiles[item.userId]?.isVerified && (
                    <Ionicons name="checkmark-circle" size={14} color="#1DA1F2" style={{ marginLeft: 6 }} />
                  )}
                  {/* Blue Follow Button - inline next to username */}
                  {user && item.userId && user.uid !== item.userId && (
                    <TouchableOpacity 
                      style={[
                        styles.followButtonInline, 
                        {
                          backgroundColor: getCurrentFollowState(item.userId) ? '#28a745' : '#007AFF', // Green when following, blue when not following
                          zIndex: 9999, // Ensure button is above video touch area
                          elevation: 10, // Android elevation
                        }
                      ]}
                      onPress={(e) => {
                        e.stopPropagation(); // Prevent video touch handler from triggering
                        e.preventDefault(); // Additional prevention
                        console.log(`👥 Follow button pressed for user: ${item.userId}, current state: ${getCurrentFollowState(item.userId)}`);
                        toggleFollow(item.userId);
                      }}
                      activeOpacity={0.6} // Faster visual feedback
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      delayPressIn={0} // Remove all delays
                      delayPressOut={0} // Remove all delays
                      delayLongPress={0} // Remove all delays
                    >
                      <Ionicons 
                        name={getCurrentFollowState(item.userId) ? "checkmark" : "person-add"} 
                        size={14} 
                        color="#ffffff" 
                      />
                      <Text style={styles.followButtonText}>
                        {getCurrentFollowState(item.userId) ? 'Following' : 'Follow'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </TouchableOpacity>
            
            {item.caption && (
              <View style={styles.captionContainer}>
                {item.caption.length > 30 ? (
                  <TouchableOpacity 
                    style={styles.captionTouchable}
                    onPress={() => openCaptionModal(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.caption}>
                      {truncateCaption(item.caption, 30)}
                    </Text>
                    <Text style={styles.readMoreText}> Read more</Text>
                  </TouchableOpacity>
                ) : (
                  <View>
                    {renderTextWithLinks(item.caption, styles.caption)}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Right side - Action buttons */}
          <View style={styles.rightActions}>
            <Animated.View style={{ transform: [{ scale: scaleAnims.current[item.assetId] || 1 }] }}>
              <TouchableOpacity 
                style={[
                  styles.actionButton, 
                  { 
                    marginBottom: responsiveSize.spacing.large,
                    opacity: videoLikes[item.assetId] ? 0.8 : 1.0 // Subtle indication when liked
                  }
                ]}
                onPress={() => toggleLike(item.assetId)}
                activeOpacity={videoLikes[item.assetId] ? 0.8 : 0.3} // Less active when already liked
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                delayPressIn={0}
                delayPressOut={0}
                delayLongPress={0}
              >
                <Ionicons 
                  name={videoLikes[item.assetId] ? "heart" : "heart-outline"} 
                  size={responsiveSize.iconSizes.medium} 
                  color={videoLikes[item.assetId] ? "#ff1744" : "#ffffff"} 
                />
                <Text style={[styles.actionText, { 
                  fontSize: responsiveSize.fontSize.small,
                  marginTop: responsiveSize.spacing.tiny,
                  color: "#ffffff", // Always white as requested
                  fontWeight: '600',
                  textShadowColor: 'rgba(0, 0, 0, 0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }]}>
                  {formatCount(Math.max(0, videoLikeCounts[item.assetId] || 0))}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity 
              style={[styles.actionButton, { marginBottom: responsiveSize.spacing.large }]}
              onPress={() => {
                console.log(`📤 Share button pressed for video: ${item.assetId}`);
                
                // Ensure video continues playing after share button press
                const currentVideo = videos[currentVideoIndex];
                if (currentVideo?.assetId === item.assetId) {
                  setVideoPlayingStates(prev => ({ ...prev, [item.assetId]: true }));
                  setShowThumbnails(prev => ({ ...prev, [item.assetId]: false }));
                  
                  if (videoRefs.current[item.assetId]) {
                    videoRefs.current[item.assetId].playAsync().catch(() => {
                      console.log('🎬 Video play command failed after share press, but continuing...');
                    });
                  }
                }
                
                handleShare(item);
              }}
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons 
                name="arrow-redo-outline" 
                size={responsiveSize.iconSizes.medium} 
                color="#ffffff" 
              />
              <Text style={[styles.actionText, { 
                fontSize: responsiveSize.fontSize.small,
                marginTop: responsiveSize.spacing.tiny,
                color: "#ffffff",
                fontWeight: '600',
                textShadowColor: 'rgba(0, 0, 0, 0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }]}>
                Share
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, { marginBottom: responsiveSize.spacing.large }]}
              onPress={() => {
                // Enhanced save button with validation
                const videoId = item.assetId;
                if (!videoId || typeof videoId !== 'string') {
                  console.error('❌ Invalid video ID for save:', videoId);
                  return;
                }
                
                console.log(`💾 Save button pressed for video: ${videoId}`);
                console.log(`📋 Current save state: ${videoSaved[videoId] ? 'saved' : 'not saved'}`);
                
                // Ensure video continues playing after save button press
                const currentVideo = videos[currentVideoIndex];
                if (currentVideo?.assetId === videoId) {
                  setVideoPlayingStates(prev => ({ ...prev, [videoId]: true }));
                  setShowThumbnails(prev => ({ ...prev, [videoId]: false }));
                  
                  if (videoRefs.current[videoId]) {
                    videoRefs.current[videoId].playAsync().catch(() => {
                      console.log('🎬 Video play command failed after save press, but continuing...');
                    });
                  }
                }
                
                toggleSaveVideo(videoId);
              }}
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons 
                name={videoSaved[item.assetId] ? "bookmark" : "bookmark-outline"} 
                size={responsiveSize.iconSizes.medium} 
                color={videoSaved[item.assetId] ? "#ffd700" : "#ffffff"} 
              />
              <Text style={[styles.actionText, { 
                fontSize: responsiveSize.fontSize.small,
                marginTop: responsiveSize.spacing.tiny,
                color: videoSaved[item.assetId] ? "#ffd700" : "#ffffff",
                fontWeight: '600',
                textShadowColor: 'rgba(0, 0, 0, 0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }]}>
                {videoSaved[item.assetId] ? "Saved" : "Save"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, { marginBottom: responsiveSize.spacing.medium }]}
              onPress={() => {
                console.log(`🔊 Mute button pressed, current state: ${isMuted}`);
                toggleMute();
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons 
                name={isMuted ? "volume-mute-outline" : "volume-high-outline"} 
                size={responsiveSize.iconSizes.medium} 
                color="#fff" 
              />
            </TouchableOpacity>

            {/* 3-dots menu button */}
            <TouchableOpacity 
              style={[styles.actionButton, { marginBottom: responsiveSize.spacing.medium }]}
              onPress={() => {
                console.log(`⋯ Options button pressed for video: ${item.assetId}`);
                setSelectedVideoForOptions(item);
                setShowVideoOptionsModal(true);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons 
                name="ellipsis-vertical" 
                size={responsiveSize.iconSizes.medium} 
                color="#fff" 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* YouTube-Style Full Screen Touch Area for Play/Pause - Covers ENTIRE video area */}
        <TouchableWithoutFeedback
          onPress={(event) => {
            // Get the touch coordinates with enhanced validation
            const { nativeEvent } = event;
            const touchX = nativeEvent?.pageX || nativeEvent?.locationX || 0;
            const touchY = nativeEvent?.pageY || nativeEvent?.locationY || 0;
            
            console.log(`🎯 Touch detected on video ${item.assetId} at (${touchX}, ${touchY}), isCurrentVideo: ${isCurrentVideo}`);
            
            // Enhanced validation before play/pause
            if (!isCurrentVideo) {
              console.log(`🚫 Blocked - not current video (current index: ${currentVideoIndex})`);
              return;
            }
            
            if (isTogglingRef.current[item.assetId]) {
              console.log(`🚫 Blocked - already toggling video ${item.assetId}`);
              return;
            }
            
            // Check if video ref exists
            if (!videoRefs.current[item.assetId]) {
              console.error(`❌ No video ref found for ${item.assetId}, cannot toggle play/pause`);
              return;
            }
            
            console.log(`✅ Processing play/pause for video ${item.assetId}`);
            
            // Show progress bar when tapping
            showProgressBarForVideo(item.assetId);
            
            // Add immediate visual feedback before async operation
            try {
              // For debugging: occasionally run health check on problematic videos
              const shouldCheckHealth = Math.random() < 0.1; // 10% chance
              if (shouldCheckHealth) {
                checkVideoHealth(item.assetId).then(health => {
                  if (!health.healthy) {
                    console.warn(`🏥 Video ${item.assetId} health issue:`, health.reason);
                  }
                });
              }
              
              toggleVideoPlayPause(item.assetId);
            } catch (error) {
              console.error(`❌ Error in touch handler for video ${item.assetId}:`, error);
            }
          }}
          delayPressIn={0} // Remove delay for immediate response
          delayPressOut={0} // Also remove press out delay
        >
          <View style={styles.fullScreenTouchArea} />
        </TouchableWithoutFeedback>

        {/* YouTube Shorts-style Red Progress Bar - Individual for each video */}
        <View style={dynamicStyles.progressBarContainer}>
          <View style={styles.progressBarTrack}>
            <View 
              style={[
                styles.progressBarFill,
                { 
                  width: `${getVideoProgress(item.assetId) * 100}%`,
                  backgroundColor: isCurrentVideo ? '#FF0000' : 'rgba(255, 255, 255, 0.7)' // Red for current, white for others
                }
              ]} 
            />
          </View>
          {/* Only allow seeking on current video */}
          {isCurrentVideo && (
            <View 
              style={styles.progressBarTouchArea}
              {...createProgressPanResponder(item.assetId, screenWidth).panHandlers}
            />
          )}
        </View>
      </View>
    );
  }, [
    currentVideoIndex, 
    videoPlayingStates, 
    videoLoading, 
    showThumbnails, 
    videoThumbnails, 
    thumbnailsLoading,
    isMuted,
    getVideoRefCallback,
    handlePlaybackStatusUpdate,
    getResponsiveSize,
    progressBarVisible,
    videoDurations,
    videoPositions,
    isDraggingProgress,
    dragProgress,
    getVideoProgress,
    showProgressBarForVideo,
    handleProgressBarPress
  ]);

  // Create dynamic styles with ULTIMATE universal positioning
  const dynamicStyles = useMemo(() => {
    // Calculate positions relative to the exact tab bar height
    const EXACT_TAB_BAR_HEIGHT = 49 + insets.bottom;
    const overlayBottomOffset = EXACT_TAB_BAR_HEIGHT + 10; // 10px above tab bar
    const progressBarBottomOffset = EXACT_TAB_BAR_HEIGHT + 3; // 3px above tab bar
    
    return StyleSheet.create({
      videoContainer: {
        width: screenWidth,
        height: videoContainerHeight,
        backgroundColor: '#000',
        marginBottom: 0,
        marginTop: 0,
      },
      // � CALCULATED overlay positioning based on actual measurements
      videoInfoOverlay: {
        position: 'absolute',
        bottom: overlayBottomOffset,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 20,
        zIndex: 1000,
        pointerEvents: 'box-none' as const,
      },
      // � CALCULATED progress bar positioning based on actual measurements
      progressBarContainer: {
        position: 'absolute',
        bottom: progressBarBottomOffset,
        left: 0,
        right: 0,
        paddingHorizontal: 0,
        zIndex: 1100,
      },
    });
  }, [videoContainerHeight]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent hidden />
      
      {/* YouTube-Style Controls with Fade Animation */}
      {showCloseButton && (
        <Animated.View 
          style={[
            styles.topBar, 
            { 
              paddingTop: 20,
              opacity: controlsOpacity 
            }
          ]}
          pointerEvents={showControls ? 'auto' : 'none'}
        >
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.videoCounter}>
            <Text style={styles.videoCounterText}>
              {currentVideoIndex + 1} of {videos.length}
            </Text>
          </View>
          
          <TouchableOpacity 
            onPress={() => {
              const currentVideo = videos[currentVideoIndex];
              setSelectedVideoForOptions(currentVideo);
              setShowVideoOptionsModal(true);
            }} 
            style={styles.optionsButton}
          >
            <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Enhanced FlatList with Bulletproof Layout */}
      <FlatList
        ref={flatListRef}
        data={videos}
        keyExtractor={(item, index) => item.assetId || `video-${index}`}
        renderItem={renderVideoItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={videoContainerHeight}
        snapToAlignment="start"
        decelerationRate={Platform.OS === 'ios' ? 0.98 : 'fast'} // Much faster deceleration for Instagram-like feel
        disableIntervalMomentum={false} // Enable momentum for smoother swipes
        bounces={Platform.OS === 'ios'} // Enable bounces on iOS for natural feel
        scrollEventThrottle={8} // Higher frequency for smoother tracking (reduced from 16)
        removeClippedSubviews={Platform.OS === 'android'} // Memory optimization for Android
        maxToRenderPerBatch={2} // Reduced for faster rendering
        initialNumToRender={1} // Only render current item initially for faster startup
        windowSize={3} // Smaller window for better performance
        updateCellsBatchingPeriod={50} // Faster batching for more responsive scrolling
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(data, index) => ({
          length: videoContainerHeight,
          offset: videoContainerHeight * index,
          index,
        })}
        // Enhanced universal scrolling optimizations
        overScrollMode="never" // Disable overscroll on Android for cleaner feel
        showsHorizontalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never" // iOS optimization
        automaticallyAdjustContentInsets={false} // iOS optimization
        keyboardShouldPersistTaps="handled"
        scrollsToTop={false} // Disable scroll to top for video feeds
        // Universal layout fixes for bulletproof display
        contentContainerStyle={{
          flexGrow: 1,
        }}
        style={{
          flex: 1,
          backgroundColor: '#000',
        }}
        // Additional edge-to-edge fixes
        contentInset={{ top: 0, bottom: 0, left: 0, right: 0 }}
        scrollIndicatorInsets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />
      
      {/* Video Options Modal */}
      {selectedVideoForOptions && (
        <VideoOptionsModal
          visible={showVideoOptionsModal}
          onClose={() => {
            setShowVideoOptionsModal(false);
            setSelectedVideoForOptions(null);
          }}
          videoId={selectedVideoForOptions.assetId}
          videoTitle={selectedVideoForOptions.caption}
          isOwner={videoOwnership[selectedVideoForOptions.assetId] || false}
          onVideoDeleted={(deletedVideoId) => {
            console.log(`Video ${deletedVideoId} was deleted`);
            // Close the modal
            setShowVideoOptionsModal(false);
            setSelectedVideoForOptions(null);
            // Close the player
            onClose();
          }}
        />
      )}
      
      {/* Caption Details Modal */}
      <Modal
        visible={showCaptionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCaptionModal(false)}
      >
        <View style={styles.captionModalContainer}>
          {/* Modal Header */}
          <View style={styles.captionModalHeader}>
            <Text style={styles.captionModalTitle}>Video Details</Text>
            <TouchableOpacity 
              onPress={() => setShowCaptionModal(false)}
              style={styles.captionModalCloseButton}
            >
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          
          {selectedCaptionVideo && (
            <ScrollView style={styles.captionModalContent} showsVerticalScrollIndicator={false}>
              {/* User Info */}
              <View style={styles.captionModalUserSection}>
                <Image 
                  source={{ uri: userAvatar || 'https://via.placeholder.com/50' }}
                  style={styles.captionModalAvatar}
                />
                <View style={styles.captionModalUserInfo}>
                  <Text style={styles.captionModalUsername}>@{selectedCaptionVideo.username}</Text>
                  <Text style={styles.captionModalUserHandle}>Creator</Text>
                </View>
              </View>
              
              {/* Video Stats */}
              <View style={styles.captionModalStats}>
                <View style={styles.captionModalStatItem}>
                  <Ionicons name="eye-outline" size={18} color="#666" />
                  <Text style={styles.captionModalStatText}>
                    {formatCount(selectedCaptionVideo.views || 0)} views
                  </Text>
                </View>
                <View style={styles.captionModalStatItem}>
                  <Ionicons name="time-outline" size={18} color="#666" />
                  <Text style={styles.captionModalStatText}>
                    {formatDate(selectedCaptionVideo.createdAt)}
                  </Text>
                </View>
                <View style={styles.captionModalStatItem}>
                  <Ionicons name="calendar-outline" size={18} color="#666" />
                  <Text style={styles.captionModalStatText}>
                    {formatFullDate(selectedCaptionVideo.createdAt)}
                  </Text>
                </View>
              </View>
              
              {/* Caption Content */}
              {selectedCaptionVideo.caption && (
                <View style={styles.captionModalTextSection}>
                  <Text style={styles.captionModalSectionTitle}>Description</Text>
                  {renderTextWithLinks(selectedCaptionVideo.caption, styles.captionModalText)}
                </View>
              )}
              
              {/* Additional Actions */}
              <View style={styles.captionModalActions}>
                <TouchableOpacity 
                  style={styles.captionModalActionButton}
                  onPress={() => {
                    setShowCaptionModal(false);
                    handleShare(selectedCaptionVideo);
                  }}
                >
                  <Ionicons name="share-outline" size={20} color="#007AFF" />
                  <Text style={styles.captionModalActionText}>Share Video</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    // Ensure full screen coverage
    margin: 0,
    padding: 0,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 1000,
  },
  closeButton: {
    padding: 8,
    zIndex: 1300, // Ensure button is clickable above full-screen touch area
  },
  optionsButton: {
    padding: 8,
    zIndex: 1300, // Ensure button is clickable above full-screen touch area
  },
  videoCounter: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  videoCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  videoContainer: {
    width: screenWidth,
    height: screenHeight, // This will be overridden by dynamicStyles for proper tab layout
    backgroundColor: '#000',
    // Universal layout fixes
    margin: 0,
    padding: 0,
    overflow: 'hidden', // Ensure content doesn't overflow
  },
  videoWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  videoBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000', // Black background for letterboxing/pillarboxing
  },
  videoBackgroundBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  videoBackgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // Gradient would be implemented with a gradient library
  },
  videoBackgroundVideo: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  video: {
    width: '100%',
    height: '100%',
    // Ensure absolute full coverage with no gaps
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fullScreenTouchArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 80, // Exclude right side where action buttons are (80px from right edge)
    bottom: 160, // Increase bottom exclusion to better avoid user info area
    width: undefined, // Remove fixed width since we're using right positioning
    height: undefined, // Remove fixed height since we're using bottom positioning
    backgroundColor: 'transparent',
    zIndex: 500, // Lower z-index than user interface elements
  },
  // YouTube Shorts-style progress bar styles
  progressBarContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 49 : 56, // Position above tab bar for universal compatibility
    left: 0,
    right: 0,
    paddingHorizontal: 0, // Remove padding to go edge-to-edge
    zIndex: 1100, // Higher z-index to appear above video info overlay
  },
  progressBarTrack: {
    height: 3, // Slightly thinner for better aesthetics
    backgroundColor: 'rgba(255, 255, 255, 0.2)', // Slightly more subtle for individual videos
    borderRadius: 0, // No border radius for edge-to-edge look
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF0000', // YouTube's signature red color
    borderRadius: 0, // No border radius for clean look
  },
  progressBarTouchArea: {
    position: 'absolute',
    top: -15, // Larger touch area for easier interaction
    left: 0,
    right: 0,
    bottom: -15,
    backgroundColor: 'transparent',
  },
  videoInfoOverlay: {
    position: 'absolute',
    // Will be overridden by dynamic styles with proper insets calculation
    bottom: 60, // Fallback value
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    zIndex: 1000,
    pointerEvents: 'box-none', // Allow touches to pass through to children only
  },
  videoInfoOverlayLandscape: {
    // Adjust overlay position for landscape videos with letterboxing
    paddingBottom: 50,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  videoInfoOverlaySquare: {
    // Adjust overlay position for square videos
    paddingBottom: 45,
    paddingHorizontal: 18,
    paddingTop: 25,
  },
  leftContent: {
    flex: 1,
    maxWidth: screenWidth * 0.72, // Slightly more space for universal compatibility
    justifyContent: 'flex-end', // Align content to bottom
    pointerEvents: 'box-none', // Allow touches to pass through except for child elements
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12, // Changed from marginBottom to marginTop
    paddingHorizontal: 0, // Remove background padding
    paddingVertical: 0, // Remove background padding
    zIndex: 10000, // Very high z-index to ensure user row is clickable above everything
    position: 'relative', // Ensure proper positioning context
    elevation: 15, // High elevation for Android
  },
  userAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  userHandle: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  followCounts: {
    color: '#fff',
    fontSize: 10,
    opacity: 0.7,
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  followButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    marginLeft: 8,
    minWidth: 80,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 10, // High elevation for Android
    zIndex: 9999, // Very high z-index to ensure it's above all other elements
    position: 'relative', // Ensure proper positioning context
  },
  followButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  captionContainer: {
    marginTop: 8, // Add margin top instead of bottom
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 0, // Remove background padding
    paddingVertical: 0, // Remove background padding
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  viewCount: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 8, // Added margin to separate from caption
  },
  rightActions: {
    alignItems: 'center',
    justifyContent: 'flex-end', // Align to bottom
    paddingBottom: 10, // Add some padding from the very bottom
    position: 'relative', // Required for z-index to work in React Native
    zIndex: 1200, // Higher z-index to ensure buttons remain clickable
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20, // Default fallback, will be overridden by responsive sizing
    position: 'relative', // Required for z-index to work in React Native
    zIndex: 1300, // Ensure buttons are above full-screen touch area
  },
  actionText: {
    color: '#fff',
    fontSize: 11, // Default fallback, will be overridden by responsive sizing
    marginTop: 3, // Default fallback, will be overridden by responsive sizing
    textAlign: 'center',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  // Thumbnail Styles
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 500,
    pointerEvents: 'none', // Allow touches to pass through to full screen touch area
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  thumbnailLoadingOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -75 }, { translateY: -20 }],
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 600,
  },
  thumbnailLoadingText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  thumbnailPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 80,
    height: 80,
    marginTop: -40,
    marginLeft: -40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 600,
    pointerEvents: 'none', // Let the full-screen touch area handle all touches
  },
  playButtonBackground: {
    backgroundColor: '#1a1a1a', // Solid color for efficient shadow calculation
    opacity: 0.9, // Apply transparency via opacity instead
    borderRadius: 40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8, // Android shadow
  },
  thumbnailPlayIcon: {
    textAlign: 'center',
    textAlignVertical: 'center',
    marginLeft: 3, // Slight offset to center play icon properly
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 600,
  },
  durationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // YouTube-style loading indicator styles
  loadingIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 120,
    height: 120,
    marginTop: -60,
    marginLeft: -60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 900,
  },
  loadingBackground: {
    backgroundColor: '#1a1a1a', // Solid color for efficient shadow calculation
    opacity: 0.9, // Apply transparency via opacity instead
    borderRadius: 15,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingSpinner: {
    marginBottom: 10,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  
  // Caption modal styles
  captionTouchable: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    zIndex: 1300, // Ensure caption is clickable above full-screen touch area
  },
  readMoreText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  captionLink: {
    color: '#4A9EFF',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  captionModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  captionModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingTop: 50, // Safe area
  },
  captionModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  captionModalCloseButton: {
    padding: 5,
  },
  captionModalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  captionModalUserSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  captionModalAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  captionModalUserInfo: {
    flex: 1,
  },
  captionModalUsername: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
  },
  captionModalUserHandle: {
    fontSize: 14,
    color: '#666',
  },
  captionModalStats: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  captionModalStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  captionModalStatText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  captionModalTextSection: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  captionModalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
  },
  captionModalText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  captionModalActions: {
    paddingVertical: 20,
    paddingBottom: 40, // Extra bottom padding
  },
  captionModalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
  },
  captionModalActionText: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 12,
  },
  
  // Play/Pause indicator styles
  playPauseIndicatorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    pointerEvents: 'none', // Allow taps to pass through
  },
  playPauseIndicatorBackground: {
    backgroundColor: '#1a1a1a', // Solid color for efficient shadow calculation
    opacity: 0.8, // Apply transparency via opacity instead
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});

// 🎯 ALGORITHMIC HOME SCREEN COMPONENT
interface AlgorithmicVideoData extends VideoData {
  algorithmScore: number;
  boostLevel: number;
  seedTestCompleted: boolean;
  engagementRate: number;
  freshnessScore: number;
  personalizedScore: number;
}

const AlgorithmicHomeScreen: React.FC = () => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  // 📊 Algorithmic Feed State
  const [algorithmicVideos, setAlgorithmicVideos] = useState<AlgorithmicVideoData[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [watchStartTime, setWatchStartTime] = useState<number>(0);
  const [totalWatchTime, setTotalWatchTime] = useState<number>(0);
  const [isVideoPlayerVisible, setIsVideoPlayerVisible] = useState(false);

  // 🔄 Real-time Algorithm Tracking
  const engagementTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastEngagementUpdate = useRef<number>(0);

  // 📺 Fallback Basic Video Loading
  const loadBasicVideoFeed = useCallback(async (): Promise<AlgorithmicVideoData[]> => {
    try {
      console.log('� Video loading temporarily disabled - all videos deleted from server');
      console.log('🧹 Clean up Firestore posts collection to fix "Loading video..." errors');
      
      // TEMPORARY FIX: Return empty array until Firestore is cleaned up
      return [];
      
      // ORIGINAL CODE (commented out until cleanup):
      /*
      console.log('�📺 Loading basic video feed from posts collection...');
      
      // FIXED: Use a simpler query that doesn't require complex indexes
      const videosSnapshot = await getDocs(
        query(
          collection(db, 'posts'), 
          where('processed', '==', true), // Only require processed=true
          orderBy('createdAt', 'desc'), 
          limit(20)
        )
      );
      
      console.log(`📺 Found ${videosSnapshot.docs.length} processed videos in posts collection`);
      */
      
      // ORIGINAL CODE CONTINUES (commented out until cleanup):
      /*
      const videos = videosSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`📺 Processing video: ${doc.id}`, {
          videoId: doc.id,
          streamingUrl: data.streamingUrl || data.playbackUrl || data.videoUrl,
          username: data.username,
          userId: data.userId,
          status: data.status
        });
        
        return {
          assetId: doc.id, // Use document ID as assetId (for compatibility)
          videoId: doc.id, // Google Cloud uses videoId
          playbackUrl: data.streamingUrl || data.playbackUrl || data.videoUrl || '', // Try Google Cloud field first
          streamingUrl: data.streamingUrl || data.playbackUrl || data.videoUrl || '', // Google Cloud field
          thumbnailUrl: data.thumbnailUrl || '',
          username: data.username || 'Unknown User',
          userId: data.userId || '',
          views: data.views || 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          caption: data.caption || '',
          algorithmScore: 0.5,
          boostLevel: 0,
          seedTestCompleted: false,
          engagementRate: 0,
          freshnessScore: 0.5,
          personalizedScore: 0.5
        };
      }).filter(video => {
        // FIXED: Filter out videos with missing required fields
        const isValid = video.assetId && 
                       (video.streamingUrl || video.playbackUrl) && 
                       video.userId && 
                       video.username !== 'Unknown User';
        
        if (!isValid) {
          console.warn(`⚠️ Filtering out invalid video:`, {
            assetId: video.assetId,
            hasStreamingUrl: !!video.streamingUrl,
            hasPlaybackUrl: !!video.playbackUrl,
            hasUserId: !!video.userId,
            username: video.username
          });
        }
        
        return isValid;
      });
      
      console.log(`✅ Successfully processed ${videos.length} valid videos`);
      return videos;
      */
      
    } catch (error) {
      console.error('❌ Error loading basic videos:', error);
      return [];
    }
  }, []);

  // 🌱 Initialize Algorithmic Feed
  const loadAlgorithmicFeed = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoadingFeed(true);
      setFeedError(null);
      
      console.log('🤖 Loading algorithmic feed for user:', user.uid);
      
      // Generate personalized feed using the algorithm
      const feedVideos = await algorithmicFeedService.getPersonalizedFeed(user.uid, 20);
      
      if (feedVideos.length === 0) {
        // Fallback to basic video loading if algorithmic feed is empty
        console.log('⚠️ No algorithmic feed available, loading basic videos');
        const basicVideos = await loadBasicVideoFeed();
        
        if (basicVideos.length === 0) {
          console.log('⚠️ No basic videos available either');
          setAlgorithmicVideos([]);
          return;
        }
        
        setAlgorithmicVideos(basicVideos);
      } else {
        console.log(`✅ Loaded ${feedVideos.length} algorithmic videos`);
        const enhancedVideos: AlgorithmicVideoData[] = feedVideos.map((video: any) => ({
          assetId: video.assetId || video.id, // Ensure we have an assetId
          videoId: video.videoId || video.assetId || video.id,
          playbackUrl: video.streamingUrl || video.playbackUrl || video.videoUrl || '',
          streamingUrl: video.streamingUrl || video.playbackUrl || video.videoUrl || '',
          thumbnailUrl: video.thumbnailUrl || '',
          username: video.username || 'Unknown User',
          userId: video.userId || '',
          views: video.views || 0,
          createdAt: video.createdAt || new Date().toISOString(),
          caption: video.caption || '',
          algorithmScore: 0.7,
          boostLevel: 0,
          seedTestCompleted: false,
          engagementRate: 0,
          freshnessScore: 0.5,
          personalizedScore: 0.7
        })).filter(video => {
          // FIXED: Filter out videos with missing required fields
          return video.assetId && (video.streamingUrl || video.playbackUrl) && video.userId;
        });
        
        setAlgorithmicVideos(enhancedVideos);
      }
      
      // Start watch tracking for first video if available
      const videosToUse = algorithmicVideos.length > 0 ? algorithmicVideos : feedVideos;
      if (videosToUse.length > 0) {
        setWatchStartTime(Date.now());
      }
      
    } catch (error) {
      console.error('❌ Error loading algorithmic feed:', error);
      setFeedError('Failed to load personalized feed');
      
      // Fallback to basic videos
      try {
        const basicVideos = await loadBasicVideoFeed();
        setAlgorithmicVideos(basicVideos);
      } catch (fallbackError) {
        console.error('❌ Fallback loading also failed:', fallbackError);
        setAlgorithmicVideos([]);
      }
    } finally {
      setIsLoadingFeed(false);
    }
  }, [user, loadBasicVideoFeed]);

  // 📈 Track Video Engagement in Real-time
  const trackVideoEngagement = useCallback(async (
    videoId: string,
    watchTime: number,
    totalDuration: number,
    action: 'view' | 'like' | 'comment' | 'share' | 'skip' | 'complete'
  ) => {
    if (!user || !videoId || videoId === 'undefined') {
      console.warn('⚠️ Cannot track engagement: missing user or invalid videoId', { user: !!user, videoId });
      return;
    }
    
    try {
      const completionRate = totalDuration > 0 ? watchTime / totalDuration : 0;
      
      // Track with engagement service based on action type
      switch (action) {
        case 'like':
        case 'comment':
        case 'share':
          await engagementTrackingService.trackInteraction(videoId, user.uid, action, true);
          break;
        case 'skip':
          await engagementTrackingService.trackSkip(videoId, user.uid, watchTime, totalDuration);
          break;
        case 'view':
        case 'complete':
          // These are handled by startWatching/stopWatching methods
          break;
      }
      
      // Also store basic engagement data for algorithm learning
      await addDoc(collection(db, 'videoEngagements'), {
        videoId,
        userId: user.uid,
        watchTime,
        totalDuration,
        completionRate,
        action,
        timestamp: serverTimestamp(),
        liked: action === 'like',
        commented: action === 'comment',
        shared: action === 'share',
        skipped: action === 'skip',
        skipTime: action === 'skip' ? watchTime : 0,
      });
      
      console.log(`📊 Tracked ${action} engagement for video ${videoId}: ${watchTime}s/${totalDuration}s (${(completionRate * 100).toFixed(1)}%)`);
      
    } catch (error) {
      console.error('❌ Error tracking engagement:', error);
    }
  }, [user]);

  // 🎬 Handle Video Change with Algorithm Tracking
  const handleVideoChange = useCallback((newIndex: number) => {
    if (currentVideoIndex === newIndex || !algorithmicVideos[newIndex]) return;
    
    // Stop tracking previous video
    const prevVideo = algorithmicVideos[currentVideoIndex];
    if (prevVideo && prevVideo.assetId && user) {
      engagementTrackingService.stopWatching();
      
      // Track engagement for previous video if watched for more than 1 second
      if (watchStartTime > 0) {
        const watchTime = (Date.now() - watchStartTime) / 1000;
        
        if (watchTime > 1) {
          trackVideoEngagement(prevVideo.assetId, watchTime, 30, 'view');
        }
      }
    }
    
    // Start tracking new video
    const newVideo = algorithmicVideos[newIndex];
    if (newVideo && newVideo.assetId && user) {
      engagementTrackingService.startWatching(newVideo.assetId, user.uid);
    }
    
    setCurrentVideoIndex(newIndex);
    setWatchStartTime(Date.now());
    setTotalWatchTime(0);
    
    // Preload next videos if nearing end
    if (newIndex >= algorithmicVideos.length - 3) {
      console.log('🔄 Preloading more videos...');
      loadMoreVideos();
    }
  }, [currentVideoIndex, algorithmicVideos, watchStartTime, trackVideoEngagement, user]);

  // 📥 Load More Videos for Infinite Scroll
  const loadMoreVideos = useCallback(async () => {
    if (!user || isLoadingFeed) return;
    
    try {
      const moreVideos = await algorithmicFeedService.getPersonalizedFeed(user.uid, 10);
      const enhancedMoreVideos: AlgorithmicVideoData[] = moreVideos.map((video: any) => ({
        assetId: video.assetId,
        videoId: video.videoId || video.assetId,
        playbackUrl: video.streamingUrl || video.playbackUrl,
        streamingUrl: video.streamingUrl || video.playbackUrl,
        thumbnailUrl: video.thumbnailUrl,
        username: video.username,
        userId: video.userId,
        views: video.views || 0,
        createdAt: video.createdAt,
        caption: video.caption,
        algorithmScore: 0.7,
        boostLevel: 0,
        seedTestCompleted: false,
        engagementRate: 0,
        freshnessScore: 0.5,
        personalizedScore: 0.7
      }));
      
      setAlgorithmicVideos(prev => [...prev, ...enhancedMoreVideos]);
      console.log(`📥 Loaded ${enhancedMoreVideos.length} more videos`);
    } catch (error) {
      console.error('❌ Error loading more videos:', error);
    }
  }, [user, isLoadingFeed]);

  // 🎯 Enhanced Engagement Handlers
  const handleVideoLike = useCallback((videoId: string) => {
    trackVideoEngagement(videoId, totalWatchTime, 30, 'like');
  }, [trackVideoEngagement, totalWatchTime]);

  const handleVideoComment = useCallback((videoId: string) => {
    trackVideoEngagement(videoId, totalWatchTime, 30, 'comment');
  }, [trackVideoEngagement, totalWatchTime]);

  const handleVideoShare = useCallback((videoId: string) => {
    trackVideoEngagement(videoId, totalWatchTime, 30, 'share');
  }, [trackVideoEngagement, totalWatchTime]);

  const handleVideoSkip = useCallback((videoId: string) => {
    const watchTime = (Date.now() - watchStartTime) / 1000;
    trackVideoEngagement(videoId, watchTime, 30, 'skip');
  }, [trackVideoEngagement, watchStartTime]);

  // 🔄 Real-time Feed Updates
  useEffect(() => {
    loadAlgorithmicFeed();
  }, [loadAlgorithmicFeed]);

  // 🎬 Start tracking first video when feed loads
  useEffect(() => {
    const firstVideo = algorithmicVideos[0];
    if (firstVideo && firstVideo.assetId && user && currentVideoIndex === 0) {
      console.log('📊 Starting tracking for first video:', firstVideo.assetId);
      engagementTrackingService.startWatching(firstVideo.assetId, user.uid);
      setWatchStartTime(Date.now());
    }
  }, [algorithmicVideos, user, currentVideoIndex]);

  // 📊 Continuous Watch Time Tracking
  useEffect(() => {
    if (isVideoPlayerVisible && watchStartTime > 0) {
      const interval = setInterval(() => {
        const currentWatchTime = (Date.now() - watchStartTime) / 1000;
        setTotalWatchTime(currentWatchTime);
        
        // Update engagement every 10 seconds of watch time
        if (currentWatchTime - lastEngagementUpdate.current >= 10) {
          const currentVideo = algorithmicVideos[currentVideoIndex];
          if (currentVideo && currentVideo.assetId) {
            trackVideoEngagement(currentVideo.assetId, currentWatchTime, 30, 'view');
            lastEngagementUpdate.current = currentWatchTime;
          }
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isVideoPlayerVisible, watchStartTime, algorithmicVideos, currentVideoIndex, trackVideoEngagement]);

  // � Focus Management - Pause videos when navigating away from home screen
  useFocusEffect(
    useCallback(() => {
      console.log('🏠 Home screen focused - videos can resume');
      
      // When home screen regains focus, videos can resume playing
      // The VerticalVideoPlayer component will handle its own focus management

      return () => {
        // When leaving home screen, ensure all videos are paused
        console.log('🏠 Home screen unfocused - pausing all content');
        
        // The VerticalVideoPlayer component will handle pausing its videos
        // through its own useFocusEffect hook
      };
    }, [])
  );

  // �🌊 Pull to Refresh Feed
  const refreshFeed = useCallback(async () => {
    console.log('🔄 Refreshing algorithmic feed...');
    await loadAlgorithmicFeed();
  }, [loadAlgorithmicFeed]);

  if (isLoadingFeed && algorithmicVideos.length === 0) {
    return (
      <View style={homeStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={homeStyles.loadingText}>🤖 Personalizing your feed...</Text>
        <Text style={homeStyles.loadingSubtext}>
          Our AI is analyzing your preferences to show you the best content
        </Text>
      </View>
    );
  }

  if (feedError && algorithmicVideos.length === 0) {
    return (
      <View style={homeStyles.errorContainer}>
        <Ionicons name="refresh-circle" size={64} color="#FF6B6B" />
        <Text style={homeStyles.errorTitle}>Feed Unavailable</Text>
        <Text style={homeStyles.errorText}>{feedError}</Text>
        <TouchableOpacity style={homeStyles.retryButton} onPress={refreshFeed}>
          <Text style={homeStyles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (algorithmicVideos.length === 0) {
    return (
      <View style={homeStyles.emptyContainer}>
        <Ionicons name="videocam-outline" size={64} color="#CCC" />
        <Text style={homeStyles.emptyTitle}>No Videos Available</Text>
        <Text style={homeStyles.emptyText}>Check back later for new content!</Text>
      </View>
    );
  }

  return (
    <View style={homeStyles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* ✅ ENHANCED SHORT-FORM VIDEO FEED with Full Layout System */}
      <ShortFormVideoPlayer
        videos={algorithmicVideos}
        initialVideoIndex={currentVideoIndex}
        isLoading={isLoadingFeed}
        onVideoChange={handleVideoChange}
        onLike={handleVideoLike}
        onComment={handleVideoComment}
        onShare={handleVideoShare}
        onSave={async (videoId: string) => {
          try {
            await savedVideosService.toggleSaveVideo(videoId);
            console.log(`💾 Video ${videoId} save toggled`);
          } catch (error) {
            console.error('Error toggling save:', error);
          }
        }}
        onFollow={async (userId: string) => {
          try {
            if (user) {
              const { toggleFollow } = useFollowStore.getState();
              await toggleFollow(user.uid, userId);
              console.log(`👥 Follow toggled for user: ${userId}`);
            }
          } catch (error) {
            console.error('Error toggling follow:', error);
          }
        }}
      />
      
      {/* ✅ Algorithm Indicator - Shows content boosting level */}
      {algorithmicVideos[currentVideoIndex]?.boostLevel > 0 && (
        <View style={homeStyles.algorithmIndicator}>
          <Ionicons name="trending-up" size={16} color="#FFD700" />
          <Text style={homeStyles.algorithmText}>
            {algorithmicVideos[currentVideoIndex].boostLevel === 3 ? 'Viral' : 
             algorithmicVideos[currentVideoIndex].boostLevel === 2 ? 'Trending' : 'Popular'}
          </Text>
        </View>
      )}
      
      {/* ✅ Debug Info (Development Only) */}
      {__DEV__ && (
        <View style={homeStyles.debugInfo}>
          <Text style={homeStyles.debugText}>
            📊 Video {currentVideoIndex + 1}/{algorithmicVideos.length} | 
            ⏱️ Watch: {totalWatchTime.toFixed(1)}s | 
            🤖 Score: {algorithmicVideos[currentVideoIndex]?.algorithmScore.toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
};

// 🎨 Enhanced Universal Styles for Algorithmic Home Screen
const homeStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    // Universal layout fixes for all device types
    margin: 0,
    padding: 0,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtext: {
    color: '#CCC',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  errorTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  errorText: {
    color: '#CCC',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptyText: {
    color: '#CCC',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  algorithmIndicator: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 1000,
  },
  algorithmText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  debugInfo: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 10,
    borderRadius: 8,
    zIndex: 1000,
  },
  debugText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'monospace',
  },
});

// Export the Algorithmic Home Screen as default
export default AlgorithmicHomeScreen;
 