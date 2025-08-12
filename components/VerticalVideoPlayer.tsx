import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
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
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebaseConfig';
import { useComments } from '../hooks/useComments';
import { useGlintCommentModal } from '../hooks/useGlintCommentModal';
import { useViewTracking } from '../hooks/useViewTracking';
import { followService } from '../lib/followService';
import { useFollowStore } from '../lib/followStore';
import { savedVideosService } from '../lib/savedVideosService';
import thumbnailService from '../lib/thumbnailService';
import { useUserStore } from '../lib/userStore';
import { videoDeleteService } from '../lib/videoDeleteService';
import { ProcessedVideoVariant } from '../lib/videoProcessingPipeline';
import { formatCommentCount, formatLikeCount, formatViewCount } from '../utils/formatUtils';
import GlintCommentModal from './GlintCommentModal';
import VideoOptionsModal from './VideoOptionsModal';
import ViewCountDisplay from './ViewCountDisplay';

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
  playbackUrl: string;
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
      userId: user?.uid
    };
  }, [userAvatar, userUsername, user]);

  const [currentVideoIndex, setCurrentVideoIndex] = useState(initialVideoIndex);
  const [isMuted, setIsMuted] = useState(false); // Start with audio enabled
  const [showControls, setShowControls] = useState(true);
  const [selectedVideoData, setSelectedVideoData] = useState<VideoData | null>(null);
  const [videoLikes, setVideoLikes] = useState<{ [key: string]: boolean }>({});
  const [videoLikeCounts, setVideoLikeCounts] = useState<{ [key: string]: number }>({});
  const [videoSaved, setVideoSaved] = useState<{ [key: string]: boolean }>({});
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [videoDurations, setVideoDurations] = useState<{ [key: string]: number }>({});
  const [videoPositions, setVideoPositions] = useState<{ [key: string]: number }>({});
  const [videoPlayingStates, setVideoPlayingStates] = useState<{ [key: string]: boolean }>({});
  const [videoThumbnails, setVideoThumbnails] = useState<{ [key: string]: string }>({});
  const [thumbnailsLoading, setThumbnailsLoading] = useState<{ [key: string]: boolean }>({});
  const [showThumbnails, setShowThumbnails] = useState<{ [key: string]: boolean }>({});
  const [showVideoOptionsModal, setShowVideoOptionsModal] = useState(false);
  const [selectedVideoForOptions, setSelectedVideoForOptions] = useState<VideoData | null>(null);
  const [videoOwnership, setVideoOwnership] = useState<{ [key: string]: boolean }>({});
  const [videoCommentCounts, setVideoCommentCounts] = useState<{ [key: string]: number }>({});
  const [videoLoading, setVideoLoading] = useState<{ [key: string]: boolean }>({});
  const [videoBuffering, setVideoBuffering] = useState<{ [key: string]: boolean }>({});
  
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
  const { followStates, toggleFollow: globalToggleFollow, loadMultipleFollowStates } = useFollowStore();

  // Comment system hooks - same implementation as home.tsx
  const {
    comments,
    loading: commentsLoading,
    loadingMore: loadingMoreComments,
    error: commentsError,
    hasMore: hasMoreComments,
    totalCount: totalComments,
    addComment,
    deleteComment,
    loadMoreComments,
    refreshComments,
    optimisticComments
  } = useComments({
    postId: selectedVideoData?.assetId || '', // Use selected video's ID
    userId: user?.uid,
    enableRealtime: true,
    pageSize: 20
  });

  // Glint comment modal state management
  const [glintCommentModalState, glintCommentModalActions] = useGlintCommentModal();

  // Comment li ke states
  const [commentLikes, setCommentLikes] = useState<{ [id: string]: boolean }>({});
  const [commentLikeCounts, setCommentLikeCounts] = useState<{ [id: string]: number }>({});

  // FIXED: Add ref to track previous comment length to prevent console spam
  const previousCommentsLengthRef = useRef<number>(0);
  
  // FIXED: Add proper ref for loadCommentLikes caching
  const loadCommentLikesCache = useRef<{ [key: string]: number }>({});
  
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

  // Combine optimistic comments with real comments for display - FIXED: More stable deduplication
  const allComments = useMemo(() => {
    const commentMap = new Map();
    
    // First add optimistic comments
    optimisticComments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, isOptimistic: true });
    });
    
    // Then add real comments (these will override optimistic ones with same ID)
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, isOptimistic: false });
    });
    
    // Convert back to array and sort by timestamp (newest first)
    const combined = Array.from(commentMap.values()).sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return timeB - timeA; // Newest first
    });
    
    // FIXED: Only log when there are significant changes to prevent console spam
    const newLength = combined.length;
    const prevLength = previousCommentsLengthRef.current;
    
    if (Math.abs(newLength - prevLength) > 1) { // Only log for changes > 1 to reduce noise
      // DISABLED: console.log(`📝 VerticalVideoPlayer Comments: ${optimisticComments.length} optimistic + ${comments.length} real = ${newLength} total (deduplicated)`);
      previousCommentsLengthRef.current = newLength;
    }
    
    return combined;
  }, [optimisticComments, comments]); // Removed selectedVideoData from dependencies

  // Update comment count for selected video when comments change - FIXED: Prevent unnecessary updates
  useEffect(() => {
    if (selectedVideoData && allComments.length >= 0) {
      setVideoCommentCounts(prev => {
        const currentCount = prev[selectedVideoData.assetId] || 0;
        const newCount = allComments.length;
        
        // Only update if count actually changed
        if (currentCount !== newCount) {
          console.log(`📊 Updating comment count for ${selectedVideoData.assetId}: ${currentCount} -> ${newCount}`);
          return {
            ...prev,
            [selectedVideoData.assetId]: newCount
          };
        }
        return prev;
      });
    }
  }, [selectedVideoData?.assetId, allComments.length]); // Removed selectedVideoData from dependencies to prevent extra triggers

  // FIXED: Add ref to prevent state sync loops
  const stateSyncTimeoutRefs = useRef<{ [key: string]: ReturnType<typeof setTimeout> }>({});
  const lastStateSyncTime = useRef<{ [key: string]: number }>({});

  // Function to load comment likes for all comments in a video - FIXED: Better caching and debouncing
  const loadCommentLikes = useCallback(async (postId: string) => {
    if (!user) return;
    
    // Prevent duplicate calls for the same post with better timing logic
    const cacheKey = `${postId}_${user.uid}`;
    const now = Date.now();
    
    if (loadCommentLikesCache.current[cacheKey] && 
        now - loadCommentLikesCache.current[cacheKey] < 3000) { // Increased to 3 seconds
      console.log(`⏩ Skipping duplicate loadCommentLikes call for ${postId} (cached)`);
      return;
    }
    
    loadCommentLikesCache.current[cacheKey] = now;
    
    try {
      console.log(`💖 Loading comment likes for post: ${postId}`);
      const likes: { [id: string]: boolean } = {};
      const likeCounts: { [id: string]: number } = {};
      
      // Get all comments for this post first
      const commentsSnapshot = await getDocs(
        query(collection(db, 'comments'), where('postId', '==', postId))
      );
      
      // For each comment, check if user liked it and get total like count
      for (const commentDoc of commentsSnapshot.docs) {
        const commentId = commentDoc.id;
        
        // Check if current user liked this comment
        const userLikeQuery = query(
          collection(db, 'comments', commentId, 'likes'),
          where('__name__', '==', user.uid)
        );
        const userLikeSnapshot = await getDocs(userLikeQuery);
        likes[commentId] = !userLikeSnapshot.empty;
        
        // Get total like count for this comment
        const likesSnapshot = await getDocs(collection(db, 'comments', commentId, 'likes'));
        likeCounts[commentId] = likesSnapshot.size;
      }
      
      setCommentLikes(prev => ({ ...prev, ...likes }));
      setCommentLikeCounts(prev => ({ ...prev, ...likeCounts }));
      
      console.log(`✅ Loaded comment likes for ${Object.keys(likes).length} comments`);
    } catch (error) {
      console.error('❌ Error loading comment likes:', error);
    }
  }, [user]);

  // Load comment likes when comments change for the selected video - FIXED: Proper memoization to prevent loops
  const prevSelectedVideoRef = useRef<string | null>(null);
  const prevCommentsLengthRef = useRef<number>(0);
  const loadCommentLikesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    // Clear any pending timeout
    if (loadCommentLikesTimeoutRef.current) {
      clearTimeout(loadCommentLikesTimeoutRef.current);
    }
    
    // Only load if video changed OR comment count significantly changed (not just optimistic updates)
    const videoChanged = selectedVideoData?.assetId !== prevSelectedVideoRef.current;
    const significantCommentChange = Math.abs(allComments.length - prevCommentsLengthRef.current) > 1; // Changed from > 0 to > 1
    
    if (selectedVideoData && user && (videoChanged || (significantCommentChange && allComments.length > 0))) {
      console.log(`🔄 Loading comment likes for video: ${selectedVideoData.assetId}, comments: ${allComments.length}`);
      
      // Debounce the loadCommentLikes call to prevent rapid successive calls
      loadCommentLikesTimeoutRef.current = setTimeout(() => {
        loadCommentLikes(selectedVideoData.assetId);
        
        // Update refs to prevent unnecessary reloads
        prevSelectedVideoRef.current = selectedVideoData.assetId;
        prevCommentsLengthRef.current = allComments.length;
      }, 500); // 500ms debounce
    }
    
    // Cleanup function
    return () => {
      if (loadCommentLikesTimeoutRef.current) {
        clearTimeout(loadCommentLikesTimeoutRef.current);
      }
    };
  }, [selectedVideoData?.assetId, allComments.length, user, loadCommentLikes]);

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
      
      // Clear comment likes timeout
      if (loadCommentLikesTimeoutRef.current) {
        clearTimeout(loadCommentLikesTimeoutRef.current);
      }
      
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
    // Follow states are now managed globally, no need to initialize here
    
    console.log(`🎬 Initialized video states - Current video index: ${initialVideoIndex}`);
  }, [videos, initialVideoIndex]);

  // Load actual follow states for all video owners when user is available
  useEffect(() => {
    if (!user || videos.length === 0) return;

    const loadFollowStatesForVideos = async () => {
      console.log('👥 Loading follow states for video owners...');
      
      // Get unique user IDs from videos (excluding current user)
      const userIds = [...new Set(
        videos
          .map(video => video.userId)
          .filter(userId => userId && userId !== user.uid)
      )];

      if (userIds.length === 0) {
        console.log('👥 No other users to check follow status for');
        return;
      }

      try {
        // Use global store to load multiple follow states
        await loadMultipleFollowStates(user.uid, userIds);
        console.log('👥 Follow states loaded for video owners');
        
      } catch (error) {
        console.error('❌ Error loading follow states:', error);
      }
    };

    loadFollowStatesForVideos();
  }, [user, videos]);

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

  // Load video comment counts
  useEffect(() => {
    const loadVideoCommentCounts = async () => {
      const commentCounts: { [key: string]: number } = {};

      for (const video of videos) {
        try {
          // Get total comment count for this video
          const commentsSnapshot = await getDocs(
            query(collection(db, 'comments'), where('postId', '==', video.assetId))
          );
          commentCounts[video.assetId] = commentsSnapshot.size;
        } catch (error) {
          console.error('Error loading comment counts:', error);
          commentCounts[video.assetId] = 0;
        }
      }

      setVideoCommentCounts(commentCounts);
    };

    if (videos.length > 0) {
      loadVideoCommentCounts();
    }
  }, [videos]);

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

  // Comment like toggle function - ENHANCED with instant feedback like save button
  const toggleCommentLike = async (commentId: string) => {
    if (!user) return;
    
    const userId = user.uid;
    const currentLiked = commentLikes[commentId] || false;
    const newLiked = !currentLiked;

    console.log(`💖 Toggling comment like: ${commentId}, ${currentLiked} -> ${newLiked}`);

    // 🚀 ULTRA FAST comment like - same speed as save button
    
    // 1. INSTANT UI update (no delays)
    setCommentLikes((prev) => ({ ...prev, [commentId]: newLiked }));
    setCommentLikeCounts((prev) => ({ 
      ...prev, 
      [commentId]: Math.max(0, (prev[commentId] || 0) + (newLiked ? 1 : -1))
    }));

    // 2. INSTANT haptic feedback - stronger for likes
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(newLiked ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    // 3. Background Firebase sync with retry logic (completely non-blocking)
    const saveToFirebase = async () => {
      const likeDocRef = doc(db, 'comments', commentId, 'likes', userId);
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          if (newLiked) {
            console.log(`💝 Adding like to comment: ${commentId}`);
            await setDoc(likeDocRef, { 
              userId,
              timestamp: serverTimestamp(),
              commentId // Add commentId for reference
            });
            console.log(`✅ Successfully added like to comment: ${commentId}`);
          } else {
            console.log(`💔 Removing like from comment: ${commentId}`);
            await deleteDoc(likeDocRef);
            console.log(`✅ Successfully removed like from comment: ${commentId}`);
          }
          
          // Success - exit retry loop
          break;
          
        } catch (error) {
          retryCount++;
          console.error(`❌ Attempt ${retryCount} failed for comment like ${commentId}:`, error);
          
          if (retryCount >= maxRetries) {
            // Final attempt failed - revert UI
            console.log(`🔄 All attempts failed, reverting comment like UI for ${commentId}`);
            setCommentLikes(prev => ({ ...prev, [commentId]: currentLiked }));
            setCommentLikeCounts(prev => ({ 
              ...prev, 
              [commentId]: Math.max(0, (prev[commentId] || 0) + (newLiked ? -1 : 1))
            }));
          } else {
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 300));
          }
        }
      }
    };
    
    // Fire and forget - don't wait for Firebase
    saveToFirebase();
  };

  // FLASH Follow/Unfollow toggle - INSTANT UI with background save
  const toggleFollow = async (targetUserId: string) => {
    if (!user || !targetUserId || user.uid === targetUserId) return;

    const currentUserId = user.uid;
    const currentFollowing = followStates[targetUserId] || false;
    const newFollowing = !currentFollowing;

    console.log(`⚡ FLASH FOLLOW: ${targetUserId}, ${currentFollowing} -> ${newFollowing}`);

    // 🚀 Use global store for instant UI update across all components
    await globalToggleFollow(currentUserId, targetUserId);

    console.log(`⚡ GLOBAL TOGGLE COMPLETE: ${targetUserId} -> ${newFollowing}`);

    // INSTANT haptic feedback (non-blocking)
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(
        newFollowing ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
      ).catch(() => {});
    }

    // 🔥 FIRE-AND-FORGET Firebase save (happens in background, UI already updated)
    setTimeout(async () => {
      try {
        if (newFollowing) {
          await followService.followUser(currentUserId, targetUserId);
        } else {
          await followService.unfollowUser(currentUserId, targetUserId);
        }
        console.log(`� Background save complete: ${targetUserId}`);
      } catch (error) {
        console.log(`⚠️ Background save failed (UI unchanged):`, error);
        // Keep UI as-is, user sees their intended action
      }
    }, 0); // Execute immediately but asynchronously
  };

  // Navigation function for user profiles
  const navigateToUser = (userId: string, username: string) => {
    console.log(`🔗 Navigating to profile: ${username} (${userId})`);
    router.push(`/profile/${userId}` as any);
  };

  // Wrapper for legacy components that only have username
  const navigateToUserByUsername = (username: string) => {
    // For now, we'll need to find the userId from the current video data
    // This is a fallback for components that only have username
    const currentVideo = videos[currentVideoIndex];
    if (currentVideo && currentVideo.username === username) {
      navigateToUser(currentVideo.userId, username);
    } else {
      console.warn('⚠️ Could not find userId for username:', username);
      // Fallback to old behavior or show an error
    }
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
  
  // Function to toggle play/pause for a specific video
  const toggleVideoPlayPause = useCallback(async (videoId: string) => {
    const video = videoRefs.current[videoId];
    if (!video) return;

    // ✅ Check if video is loaded before attempting operations
    try {
      const status = await video.getStatusAsync();
      if (!status.isLoaded) {
        console.log(`⚠️ Video ${videoId} not loaded yet, skipping toggle`);
        return;
      }
    } catch (statusError) {
      console.log(`⚠️ Cannot get status for video ${videoId}, skipping toggle`);
      return;
    }

    const now = Date.now();
    const lastTap = videoLastTapTime.current[videoId] || 0;
    
    // Much faster debouncing (150ms) for better responsiveness
    if (now - lastTap < 150 || isTogglingRef.current[videoId]) {
      console.log(`🚫 Blocked rapid tap for video ${videoId}`);
      return;
    }
    
    videoLastTapTime.current[videoId] = now;
    isTogglingRef.current[videoId] = true;

    try {
      const currentlyPlaying = videoPlayingStates[videoId] ?? true;
      const newPlayingState = !currentlyPlaying;
      
      console.log(`🎮 Toggling video ${videoId}: ${currentlyPlaying} -> ${newPlayingState}`);
      
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
      
      // Control video playback with optimized timing
      if (newPlayingState) {
        // Start playing immediately with no delay
        await video.playAsync();
        // Hide thumbnail instantly when playing
        setShowThumbnails(prev => ({ ...prev, [videoId]: false }));
        console.log(`▶️ Video ${videoId} playing`);
      } else {
        // Pause immediately
        await video.pauseAsync();
        // DON'T show thumbnail when paused - keep video frame visible
        // setShowThumbnails(prev => ({ ...prev, [videoId]: true }));
        console.log(`⏸️ Video ${videoId} paused`);
      }
      
      // Instant haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
    } catch (error) {
      console.error(`❌ Error toggling play/pause for video ${videoId}:`, error);
      
      // Hide indicator immediately on error
      setShowPlayPauseIndicator(prev => ({ ...prev, [videoId]: false }));
      
      // Clear timeout on error
      if (playPauseTimeoutRefs.current[videoId]) {
        clearTimeout(playPauseTimeoutRefs.current[videoId]);
        delete playPauseTimeoutRefs.current[videoId];
      }
      
      // Revert state on error
      const currentState = videoPlayingStates[videoId] ?? true;
      setVideoPlayingStates(prev => ({ ...prev, [videoId]: currentState }));
    } finally {
      // Reset the toggling flag much faster for better responsiveness
      setTimeout(() => {
        isTogglingRef.current[videoId] = false;
      }, 200); // Reduced from 750ms to 200ms for faster response
    }
  }, [videoPlayingStates]);

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
      
      // Update position when video is playing (with throttling to avoid excessive updates)
      if (actuallyPlaying && status.positionMillis !== undefined) {
        setVideoPositions(prev => {
          const currentPos = prev[videoId] || 0;
          const newPos = status.positionMillis!;
          
          // Only update if position changed significantly (300ms threshold for better performance)
          if (Math.abs(newPos - currentPos) > 300) {
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
    
    // Calculate optimal resize mode and dimensions
    let resizeMode: 'contain' | 'cover' = 'contain';
    let displayWidth = containerWidth;
    let displayHeight = containerHeight;
    let letterboxing = false;
    let pillarboxing = false;
    
    // Default to contain (scaleAspectFit) for preserving aspect ratio
    if (videoAspectRatio > containerAspectRatio) {
      // Video is wider than container - will have letterboxing (horizontal bars)
      displayHeight = containerWidth / videoAspectRatio;
      letterboxing = true;
    } else if (videoAspectRatio < containerAspectRatio) {
      // Video is taller than container - will have pillarboxing (vertical bars)
      displayWidth = containerHeight * videoAspectRatio;
      pillarboxing = true;
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

  const openComments = (video: VideoData) => {
    setSelectedVideoData(video);
    glintCommentModalActions.openModal();
    
    // Clear existing comment likes to prevent stale data
    setCommentLikes({});
    setCommentLikeCounts({});
    
    // Load comment likes for this video's comments
    loadCommentLikes(video.assetId);
  };

  // Function to update comment count when a new comment is added
  const handleCommentAdded = async (postId: string) => {
    setVideoCommentCounts(prev => ({
      ...prev,
      [postId]: (prev[postId] || 0) + 1
    }));
  };

  // Wrapped addComment function to update local counts
  const wrappedAddComment = async (content: string, parentId?: string) => {
    try {
      const result = await addComment(content, parentId);
      
      // Update the comment count for this video
      if (selectedVideoData) {
        handleCommentAdded(selectedVideoData.assetId);
      }
      
      return result;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  };

  // Wrapped deleteComment function to update local counts
  const wrappedDeleteComment = async (commentId: string) => {
    try {
      const result = await deleteComment(commentId);
      
      // Update the comment count for this video
      if (selectedVideoData) {
        setVideoCommentCounts(prev => ({
          ...prev,
          [selectedVideoData.assetId]: Math.max(0, (prev[selectedVideoData.assetId] || 0) - 1)
        }));
      }
      
      return result;
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  };

  const renderVideoItem = useCallback(({ item, index }: { item: VideoData; index: number }) => {
    const isCurrentVideo = index === currentVideoIndex;
    const responsiveSize = getResponsiveSize();
    const metadata = videoMetadata[item.assetId];
    
    // Calculate intelligent resize mode based on video's actual aspect ratio
    let dynamicResizeMode = ResizeMode.CONTAIN; // Default to CONTAIN to respect original format
    
    if (metadata) {
      const videoAspectRatio = metadata.aspectRatio;
      const screenAspectRatio = screenWidth / screenHeight;
      
      // Respect the user's original video format
      if (metadata.renderingPolicy?.renderingMode === 'contain') {
        dynamicResizeMode = ResizeMode.CONTAIN;
      } else if (metadata.renderingPolicy?.renderingMode === 'cover') {
        dynamicResizeMode = ResizeMode.COVER;
      } else {
        // Smart aspect ratio handling - show video as user uploaded it
        if (videoAspectRatio >= 1.0) {
          // Landscape or square videos - always use CONTAIN to show full video
          dynamicResizeMode = ResizeMode.CONTAIN;
        } else if (videoAspectRatio >= 0.5) {
          // Portrait videos that aren't too tall - use CONTAIN to show full video
          dynamicResizeMode = ResizeMode.CONTAIN;
        } else {
          // Very tall portrait videos (like stories) - use CONTAIN to respect user's format
          dynamicResizeMode = ResizeMode.CONTAIN;
        }
      }
      
      // Video aspect ratio logging (commented out to reduce console spam)
      // console.log(`📐 Video ${item.assetId}: ${metadata.width}x${metadata.height} (${videoAspectRatio.toFixed(2)}) -> ${dynamicResizeMode === ResizeMode.CONTAIN ? 'CONTAIN' : 'COVER'}`);
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
      <View style={styles.videoContainer}>
        {/* Enhanced video area with comprehensive aspect ratio support */}
        <View style={styles.videoWrapper}>
          {/* Background for letterboxing/pillarboxing with fill options */}
          {metadata && dynamicResizeMode === ResizeMode.CONTAIN && (
            <View style={[
              styles.videoBackground,
              metadata.renderingPolicy?.backgroundFill === 'blur' && styles.videoBackgroundBlur,
              metadata.renderingPolicy?.backgroundFill === 'gradient' && styles.videoBackgroundGradient,
              metadata.renderingPolicy?.backgroundColor && { 
                backgroundColor: metadata.renderingPolicy.backgroundColor 
              }
            ]}>
              {/* Blurred background video for aesthetic fill */}
              {metadata.renderingPolicy?.backgroundFill === 'blur' && (
                <Video
                  source={{ uri: videoUrl }}
                  style={[styles.videoBackgroundVideo, { opacity: 0.3 }]}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={isCurrentVideo}
                  isMuted={true}
                  isLooping={true}
                  useNativeControls={false}
                />
              )}
            </View>
          )}
          
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
                  progressUpdateIntervalMillis={Platform.OS === 'android' ? 1000 : 500}
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
                
                // Show thumbnail on video error
                setShowThumbnails(prev => ({ ...prev, [item.assetId]: true }));
                
                // Update playing state
                setVideoPlayingStates(prev => ({ ...prev, [item.assetId]: false }));
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

        {/* Video Info Overlay - Enhanced for Aspect Ratios */}
        <View style={[
          styles.videoInfoOverlay, 
          { paddingBottom: 80 },
          metadata && metadata.orientation === 'landscape' && styles.videoInfoOverlayLandscape,
          metadata && metadata.orientation === 'square' && styles.videoInfoOverlaySquare
        ]}>
          {/* Left side - User info and caption with safe zone */}
          <View style={styles.leftContent}>
            <ViewCountDisplay 
              videoId={item.assetId}
              style={styles.viewCount}
            />
            
            <TouchableOpacity 
              style={styles.userRow}
              onPress={() => {
                console.log(`👤 User row pressed for: ${item.username} (${item.userId})`);
                navigateToUser(item.userId, item.username);
              }}
            >
              <Image 
                source={{ uri: userAvatar || 'https://via.placeholder.com/40' }}
                style={styles.userAvatar}
              />
              <View style={styles.userInfo}>
                <Text style={styles.username}>@{item.username}</Text>
                <Text style={styles.userHandle}>Creator</Text>
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
                  {formatLikeCount(Math.max(0, videoLikeCounts[item.assetId] || 0))}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Follow Button - Only show if video is not owned by current user */}
            {user && item.userId && user.uid !== item.userId && (
              <TouchableOpacity 
                style={[
                  styles.actionButton, 
                  { 
                    marginBottom: responsiveSize.spacing.large,
                  }
                ]}
                onPress={() => toggleFollow(item.userId)}
                activeOpacity={followStates[item.userId] ? 0.8 : 0.3}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                delayPressIn={0}
                delayPressOut={0}
                delayLongPress={0}
              >
                <Ionicons 
                  name={followStates[item.userId] ? "person-remove" : "person-add"} 
                  size={responsiveSize.iconSizes.medium} 
                  color={followStates[item.userId] ? "#ff6b6b" : "#ffffff"} 
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
                  {followStates[item.userId] ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.actionButton, { marginBottom: responsiveSize.spacing.large }]}
              onPress={() => {
                console.log(`💬 Comment button pressed for video: ${item.assetId}`);
                
                // Ensure video continues playing after comment button press
                const currentVideo = videos[currentVideoIndex];
                if (currentVideo?.assetId === item.assetId) {
                  setVideoPlayingStates(prev => ({ ...prev, [item.assetId]: true }));
                  setShowThumbnails(prev => ({ ...prev, [item.assetId]: false }));
                  
                  if (videoRefs.current[item.assetId]) {
                    videoRefs.current[item.assetId].playAsync().catch(() => {
                      console.log('🎬 Video play command failed after comment press, but continuing...');
                    });
                  }
                }
                
                openComments(item);
              }}
              activeOpacity={0.6}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons 
                name="chatbubble-outline" 
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
                {formatCommentCount(
                  selectedVideoData?.assetId === item.assetId 
                    ? allComments.length 
                    : (videoCommentCounts[item.assetId] || 0)
                )}
              </Text>
            </TouchableOpacity>

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
          </View>
        </View>

        {/* Comment Input Bar */}
        {isCurrentVideo && (
          <TouchableOpacity 
            style={styles.commentInputContainer}
            onPress={() => {
              console.log(`💬 Comment input bar pressed for video: ${item.assetId}`);
              openComments(item);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.commentInputBar}>
              <Image 
                source={{ uri: createUserProfile().avatar }}
                style={styles.commentAvatar}
              />
              <Text style={styles.commentPlaceholder}>Add a comment...</Text>
              <Ionicons name="send-outline" size={20} color="#666" />
            </View>
          </TouchableOpacity>
        )}

        {/* YouTube-Style Full Screen Touch Area for Play/Pause - Covers ENTIRE video area */}
        <TouchableWithoutFeedback
          onPress={() => {
            console.log(`🎯 Touch detected on video ${item.assetId}, isCurrentVideo: ${isCurrentVideo}`);
            // Only allow play/pause for the current video and prevent rapid taps
            if (isCurrentVideo && !isTogglingRef.current[item.assetId]) {
              console.log(`✅ Processing play/pause for video ${item.assetId}`);
              toggleVideoPlayPause(item.assetId);
            } else {
              console.log(`🚫 Blocked play/pause: isCurrentVideo=${isCurrentVideo}, isToggling=${isTogglingRef.current[item.assetId]}`);
            }
          }}
          delayPressIn={0} // Remove delay for immediate response
        >
          <View style={styles.fullScreenTouchArea} />
        </TouchableWithoutFeedback>
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
    getResponsiveSize
  ]);

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

      <FlatList
        ref={flatListRef}
        data={videos}
        keyExtractor={(item) => item.assetId}
        renderItem={renderVideoItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={screenHeight}
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
          length: screenHeight,
          offset: screenHeight * index,
          index,
        })}
        // Instagram-style scroll optimizations
        overScrollMode="never" // Disable overscroll on Android for cleaner feel
        showsHorizontalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never" // iOS optimization
        automaticallyAdjustContentInsets={false} // iOS optimization
        keyboardShouldPersistTaps="handled"
        scrollsToTop={false} // Disable scroll to top for video feeds
      />

      {/* Comments Modal - Real Implementation */}
      {selectedVideoData && (
        <GlintCommentModal
          visible={glintCommentModalState.visible}
          onClose={() => {
            glintCommentModalActions.closeModal();
            // Clear comment likes when modal closes to free memory
            setCommentLikes({});
            setCommentLikeCounts({});
          }}
          postId={selectedVideoData.assetId}
          comments={allComments}
          commentsLoading={commentsLoading}
          hasMoreComments={hasMoreComments}
          totalComments={
            selectedVideoData?.assetId 
              ? Math.max(totalComments, allComments.length, videoCommentCounts[selectedVideoData.assetId] || 0)
              : Math.max(totalComments, allComments.length)
          }
          addComment={wrappedAddComment}
          deleteComment={wrappedDeleteComment}
          loadMoreComments={loadMoreComments}
          refreshComments={refreshComments}
          commentLikes={commentLikes}
          commentLikeCounts={commentLikeCounts}
          toggleCommentLike={toggleCommentLike}
          currentUserProfile={createUserProfile()}
          navigateToUser={navigateToUserByUsername}
          onReportComment={async (commentId: string, reason: string, details?: string) => {
            // Debug the user profile being passed
            const profileData = createUserProfile();
            console.log('🎬 VerticalVideoPlayer passing currentUserProfile to modal:', profileData);
            
            try {
              const reportData = {
                commentId,
                reportedByUserId: user?.uid,
                reportedByUsername: userUsername || user?.displayName || 'User',
                reason,
                details: details || '',
                timestamp: serverTimestamp(),
                postId: selectedVideoData.assetId,
                status: 'pending'
              };
              
              await addDoc(collection(db, 'commentReports'), reportData);
              console.log('✅ Comment report submitted successfully');
            } catch (error) {
              console.error('❌ Failed to submit report:', error);
              throw error;
            }
          }}
          modalHeight={0.85}
          backgroundColor="#fff"
        />
      )}
      
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
              <TouchableOpacity 
                style={styles.captionModalUserSection}
                onPress={() => {
                  if (selectedCaptionVideo) {
                    console.log(`👤 Caption modal user pressed: ${selectedCaptionVideo.username} (${selectedCaptionVideo.userId})`);
                    navigateToUser(selectedCaptionVideo.userId, selectedCaptionVideo.username);
                    setSelectedCaptionVideo(null); // Close modal after navigation
                  }
                }}
              >
                <Image 
                  source={{ uri: userAvatar || 'https://via.placeholder.com/50' }}
                  style={styles.captionModalAvatar}
                />
                <View style={styles.captionModalUserInfo}>
                  <Text style={styles.captionModalUsername}>@{selectedCaptionVideo.username}</Text>
                  <Text style={styles.captionModalUserHandle}>Creator</Text>
                </View>
              </TouchableOpacity>
              
              {/* Video Stats */}
              <View style={styles.captionModalStats}>
                <View style={styles.captionModalStatItem}>
                  <Ionicons name="eye-outline" size={18} color="#666" />
                  <Text style={styles.captionModalStatText}>
                    {formatViewCount(selectedCaptionVideo.views || 0)} views
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
                
                <TouchableOpacity 
                  style={styles.captionModalActionButton}
                  onPress={() => {
                    setShowCaptionModal(false);
                    openComments(selectedCaptionVideo);
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={20} color="#007AFF" />
                  <Text style={styles.captionModalActionText}>
                    View Comments ({formatCommentCount(
                      selectedCaptionVideo.assetId === selectedVideoData?.assetId 
                        ? allComments.length 
                        : (videoCommentCounts[selectedCaptionVideo.assetId] || 0)
                    )})
                  </Text>
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
    height: screenHeight,
    backgroundColor: '#000',
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
  },
  fullScreenTouchArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 80, // Exclude right side where action buttons are (80px from right edge)
    bottom: 120, // Exclude bottom area where comment input and user info are
    width: undefined, // Remove fixed width since we're using right positioning
    height: undefined, // Remove fixed height since we're using bottom positioning
    backgroundColor: 'transparent',
    zIndex: 1100, // Higher z-index - above video info overlay to capture center touches
  },
  videoInfoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40, // Extra padding to ensure content stays above bottom edge
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
    maxWidth: screenWidth * 0.7,
    justifyContent: 'flex-end', // Align content to bottom
    pointerEvents: 'box-none', // Allow touches to pass through except for child elements
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12, // Changed from marginBottom to marginTop
    paddingHorizontal: 0, // Remove background padding
    paddingVertical: 0, // Remove background padding
    zIndex: 1300, // Ensure user row is clickable above full-screen touch area
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: {
    flex: 1,
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
  commentInputContainer: {
    position: 'absolute',
    bottom: 20, // Moved closer to bottom since no progress bar
    left: 16,
    right: 16,
    zIndex: 1200, // Higher z-index to stay above full-screen touch area
  },
  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#fff',
  },
  commentPlaceholder: {
    flex: 1,
    color: '#ccc',
    fontSize: 14,
    fontWeight: '400',
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
