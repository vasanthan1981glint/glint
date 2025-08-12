import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebaseConfig';
import { useComments } from '../hooks/useComments';
import { useViewTracking } from '../hooks/useViewTracking';
import { Comment } from '../lib/commentService';
import { savedVideosService } from '../lib/savedVideosService';
import { useUserStore } from '../lib/userStore';
import { videoDeleteService } from '../lib/videoDeleteService';
import ExpandableCaptionDisplay from './ExpandableCaptionDisplay';
import GlintCommentModal from './GlintCommentModal';
import VideoInfo from './VideoInfo';
import VideoOptionsModal from './VideoOptionsModal';
import YouTubePlayButton from './YouTubePlayButton';

dayjs.extend(relativeTime);

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface VideoPlayerProps {
  videoData: {
    assetId: string;
    playbackUrl: string;
    thumbnailUrl: string;
    username: string;
    userId: string;
    views?: number;
    createdAt: string;
    caption?: string;
  };
  onClose: () => void;
  onNextVideo?: () => void;
  onPreviousVideo?: () => void;
  videoIndex?: number;
  totalVideos?: number;
  allVideos?: Array<{
    assetId: string;
    playbackUrl: string;
    thumbnailUrl: string;
    username: string;
    userId: string;
    views?: number;
    createdAt: string;
    caption?: string;
  }>;
}

export const FullScreenVideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videoData, 
  onClose, 
  onNextVideo, 
  onPreviousVideo, 
  videoIndex, 
  totalVideos,
  allVideos = []
}) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  const nextVideoRef = useRef<Video>(null);
  const prevVideoRef = useRef<Video>(null);
  const { avatar: userAvatar, username: userUsername } = useUserStore();
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true); // Start muted by default
  const [showControls, setShowControls] = useState(true);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPosition, setVideoPosition] = useState(0);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isVideoOwner, setIsVideoOwner] = useState(false);
  const [showVideoOptionsModal, setShowVideoOptionsModal] = useState(false);
  
  // Comment like states for GlintCommentModal
  const [commentLikes, setCommentLikes] = useState<{ [id: string]: boolean }>({});
  const [commentLikeCounts, setCommentLikeCounts] = useState<{ [id: string]: number }>({});
  
  // Animations
  const playPauseOpacity = useRef(new Animated.Value(0)).current;
  const playPauseScale = useRef(new Animated.Value(0.5)).current;
  
  // Swipe gesture for navigation
  const translateY = useRef(new Animated.Value(0)).current;
  const swipeIndicatorOpacity = useRef(new Animated.Value(1)).current;
  
  // View tracking for the current video
  const { startTracking, stopTracking } = useViewTracking({
    videoId: videoData.assetId,
    isVisible: true, // Full screen video is always visible
    isPlaying: isPlaying,
    onViewRecorded: (videoId) => {
      console.log(`📊 View recorded for video: ${videoId}`);
    },
    onViewThresholdReached: (videoId) => {
      console.log(`🎯 View threshold reached for video: ${videoId}`);
    }
  });
  
  // Check video ownership on component mount
  useEffect(() => {
    const checkOwnership = async () => {
      const isOwner = await videoDeleteService.isVideoOwner(videoData.assetId);
      setIsVideoOwner(isOwner);
    };
    checkOwnership();
  }, [videoData.assetId]);

  // Load saved status for current video when user changes
  useEffect(() => {
    if (!user?.uid || !videoData?.assetId) return;

    const loadSavedStatus = async () => {
      try {
        const savedStatus = await savedVideosService.isVideoSaved(videoData.assetId);
        setIsSaved(savedStatus);
      } catch (error) {
        console.error('Error checking saved status:', error);
        setIsSaved(false);
      }
    };

    loadSavedStatus();
  }, [user?.uid, videoData?.assetId]);

  // Auto-hide swipe indicators after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(swipeIndicatorOpacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);

  // Auto-hide controls after 3 seconds of inactivity
  const controlsTimeoutRef = useRef<any>(null);
  
  const showControlsTemporarily = () => {
    setShowControls(true);
    
    // Clear existing timeout
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    // Set new timeout to hide controls
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  // Auto-play when video loads
  useEffect(() => {
    if (isVideoLoaded && videoRef.current) {
      videoRef.current.playAsync();
      setIsPlaying(true);
    }
  }, [isVideoLoaded]);

  // Preload next and previous videos for smooth transitions
  useEffect(() => {
    if (allVideos.length > 0 && videoIndex !== undefined) {
      // Preload next video
      if (videoIndex < allVideos.length - 1 && nextVideoRef.current) {
        const nextVideo = allVideos[videoIndex + 1];
        nextVideoRef.current.loadAsync({ uri: nextVideo.playbackUrl }, {}, false);
      }
      
      // Preload previous video
      if (videoIndex > 0 && prevVideoRef.current) {
        const prevVideo = allVideos[videoIndex - 1];
        prevVideoRef.current.loadAsync({ uri: prevVideo.playbackUrl }, {}, false);
      }
    }
  }, [videoIndex, allVideos]);

  // Continuous playback - auto-play next video when current ends
  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      setVideoDuration(status.durationMillis || 0);
      setVideoPosition(status.positionMillis || 0);
      setIsBuffering(status.isBuffering || false);
      
      // Auto-play next video when current video ends
      if (status.didJustFinish && onNextVideo && videoIndex !== undefined && videoIndex < (totalVideos || 0) - 1) {
        setTimeout(() => {
          onNextVideo();
        }, 500); // Small delay for smooth transition
      }
    }
  };
  
  // Handle swipe gestures for video navigation
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );
  
  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationY, velocityY } = event.nativeEvent;
      
      // Swipe up for next video (negative translationY)
      if (translationY < -50 || velocityY < -500) {
        if (onNextVideo) {
          // Smooth transition animation
          Animated.timing(translateY, {
            toValue: -screenHeight,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            onNextVideo();
            translateY.setValue(0);
          });
        }
      }
      // Swipe down for previous video (positive translationY)
      else if (translationY > 50 || velocityY > 500) {
        if (onPreviousVideo) {
          // Smooth transition animation
          Animated.timing(translateY, {
            toValue: screenHeight,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            onPreviousVideo();
            translateY.setValue(0);
          });
        }
      }
      // Swipe down from top edge to close (exit gesture)
      else if (translationY > 100 && event.nativeEvent.absoluteY < 100) {
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onClose();
        });
      }
      else {
        // Reset animation if no action taken
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      }
    }
  };
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // REAL FIREBASE LIKE SYSTEM - Same as home screen
  const likeDebounce = useRef<boolean>(false);

  // ADVANCED COMMENT SYSTEM - Each video has its own unique comment collection
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
    refreshComments
  } = useComments({
    postId: videoData.assetId, // This ensures each video has its own unique comment system
    userId: user?.uid,
    enableRealtime: true,
    pageSize: 20
  });

  // Debug log to confirm unique post ID and comment loading (only once)
  useEffect(() => {
    console.log(`🎬 Video Comment System: Setting up comments for video ${videoData.assetId}`);
    console.log(`👤 User ID: ${user?.uid}`);
    console.log(`📝 Video by: ${videoData.username}`);
  }, [videoData.assetId]); // Only run when video changes

  // Accurate comment counting system
  const [actualDisplayedCount, setActualDisplayedCount] = useState(0);
  useEffect(() => {
    // Count only top-level comments (not replies)
    const topLevelComments = comments.filter((c: Comment) => !c.parentCommentId);
    const displayedCount = topLevelComments.length;
    
    setActualDisplayedCount(displayedCount);
    
    // Log only when there's a significant change or mismatch
    if (displayedCount !== totalComments && totalComments > 0) {
      console.log(`📊 Comment count for video ${videoData.assetId}:`);
      console.log(`   - Displayed (UI): ${displayedCount}`);
      console.log(`   - Total (DB): ${totalComments}`);
      console.log(`   - Comments loading: ${commentsLoading}`);
      
      // If there's a big mismatch, try refreshing
      if (Math.abs(displayedCount - totalComments) > 2 && !commentsLoading) {
        console.log('🔄 Large comment count mismatch detected, refreshing...');
        setTimeout(() => refreshComments(), 1000);
      }
    }
  }, [comments.length, totalComments, commentsLoading, videoData.assetId, refreshComments]);

  // Load comment likes when comments change (optimized)
  const loadedCommentIds = useRef(new Set<string>());
  useEffect(() => {
    if (!user || comments.length === 0) return;

    // Only load likes for new comments that haven't been loaded yet
    const newComments = comments.filter(comment => !loadedCommentIds.current.has(comment.id));
    if (newComments.length === 0) return;

    const loadCommentLikes = async () => {
      const likes: { [id: string]: boolean } = { ...commentLikes };
      const likeCounts: { [id: string]: number } = { ...commentLikeCounts };

      for (const comment of newComments) {
        try {
          // Check if user liked this comment
          const userLikeQuery = query(
            collection(db, 'comments', comment.id, 'likes'),
            where('__name__', '==', user.uid)
          );
          const userLikeSnapshot = await getDocs(userLikeQuery);
          likes[comment.id] = !userLikeSnapshot.empty;

          // Get total like count for this comment
          const likesSnapshot = await getDocs(collection(db, 'comments', comment.id, 'likes'));
          likeCounts[comment.id] = likesSnapshot.size;

          // Mark this comment as loaded
          loadedCommentIds.current.add(comment.id);
        } catch (error) {
          console.error(`Error loading likes for comment ${comment.id}:`, error);
          likes[comment.id] = false;
          likeCounts[comment.id] = comment.likes || 0;
        }
      }

      setCommentLikes(likes);
      setCommentLikeCounts(likeCounts);
    };

    loadCommentLikes();
  }, [comments.map(c => c.id).join(','), user]); // Only run when comment IDs change

  // Load like status and count from Firebase (optimized)
  const likeDataLoaded = useRef(false);
  useEffect(() => {
    if (!user || !videoData.assetId || likeDataLoaded.current) return;

    const loadLikeData = async () => {
      try {
        // Check if user liked this video
        const userLikeQuery = query(
          collection(db, 'posts', videoData.assetId, 'likes'),
          where('__name__', '==', user.uid)
        );
        const userLikeSnapshot = await getDocs(userLikeQuery);
        setIsLiked(!userLikeSnapshot.empty);

        // Get total like count
        const likesSnapshot = await getDocs(collection(db, 'posts', videoData.assetId, 'likes'));
        setLikeCount(likesSnapshot.size);

        // Set up real-time listener for like count (only once)
        const unsubscribe = onSnapshot(
          collection(db, 'posts', videoData.assetId, 'likes'),
          (snapshot) => {
            setLikeCount(snapshot.size);
          }
        );

        likeDataLoaded.current = true;
        return unsubscribe;
      } catch (error) {
        console.error('Error loading like data:', error);
      }
    };

    loadLikeData();
  }, [user?.uid, videoData.assetId]); // Only run when user or video changes

  // REAL FIREBASE LIKE TOGGLE - Same implementation as home screen
  const toggleLike = async () => {
    if (!user || likeDebounce.current) return;
    
    likeDebounce.current = true;
    setTimeout(() => { likeDebounce.current = false; }, 250);

    const newLikedState = !isLiked;
    
    // Instant UI update for responsiveness
    setIsLiked(newLikedState);
    setLikeCount(prev => newLikedState ? prev + 1 : prev - 1);
    
    // Animation
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.2,
        tension: 150,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 150,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();

    // Haptic feedback
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Firebase sync
    try {
      const likeDocRef = doc(db, 'posts', videoData.assetId, 'likes', user.uid);
      if (newLikedState) {
        await setDoc(likeDocRef, { timestamp: serverTimestamp() });
      } else {
        await deleteDoc(likeDocRef);
      }
      console.log(`✅ Like ${newLikedState ? 'added' : 'removed'} for video ${videoData.assetId}`);
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert UI on error
      setIsLiked(!newLikedState);
      setLikeCount(prev => newLikedState ? prev - 1 : prev + 1);
    }
  };

  // Enhanced Save video functionality with optimistic updates
  const toggleSave = async () => {
    if (!user?.uid) {
      Alert.alert('Sign In Required', 'Please sign in to save videos');
      return;
    }

    try {
      // Instantly update UI for fast feedback (optimistic update)
      const wasSaved = isSaved;
      setIsSaved(!wasSaved);

      // Haptic feedback for immediate response
      if (Platform.OS === 'ios') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Backend sync with savedVideosService for consistency
      console.log(`🔄 FullScreen player toggling save for video: ${videoData.assetId}`);
      const newSaveStatus = await savedVideosService.toggleSaveVideo(videoData.assetId);
      
      // Update UI with actual result from backend
      setIsSaved(newSaveStatus);

      console.log(`✅ FullScreen save toggle complete: ${videoData.assetId} = ${newSaveStatus}`);

      // Show success message
      const message = newSaveStatus ? 'Video saved to your collection' : 'Video removed from saved';
      Alert.alert(newSaveStatus ? 'Saved' : 'Removed', message);

    } catch (error) {
      console.error(`❌ FullScreen save toggle failed for ${videoData.assetId}:`, error);
      
      // Revert optimistic update on error
      setIsSaved(isSaved);
      
      Alert.alert('Error', 'Failed to save video. Please try again.');
    }
  };

  // Comment like functionality - same as home screen
  const toggleCommentLike = async (commentId: string) => {
    if (!user) return;

    try {
      const newLikedState = !commentLikes[commentId];
      
      // Optimistic UI update
      setCommentLikes(prev => ({ ...prev, [commentId]: newLikedState }));
      setCommentLikeCounts(prev => ({
        ...prev,
        [commentId]: (prev[commentId] || 0) + (newLikedState ? 1 : -1)
      }));

      // Haptic feedback
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      // Firebase sync
      const likeDocRef = doc(db, 'comments', commentId, 'likes', user.uid);
      if (newLikedState) {
        await setDoc(likeDocRef, { timestamp: serverTimestamp() });
      } else {
        await deleteDoc(likeDocRef);
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
      // Revert on error
      setCommentLikes(prev => ({ ...prev, [commentId]: !commentLikes[commentId] }));
      setCommentLikeCounts(prev => ({
        ...prev,
        [commentId]: (prev[commentId] || 0) + (commentLikes[commentId] ? 1 : -1)
      }));
    }
  };

  // Navigation to user profile
  const navigateToUser = (username: string) => {
    // For now, just close the modal and navigate back
    onClose();
  };

  // Enhanced addComment function with proper user data and count tracking
  const handleAddComment = useCallback(async (text: string, parentId?: string) => {
    if (!user || !userUsername) {
      Alert.alert('Authentication Required', 'Please log in to comment');
      return;
    }

    try {
      console.log(`📝 Adding comment to video ${videoData.assetId} by user ${userUsername}`);
      await addComment(text, parentId, {
        username: userUsername,
        avatar: userAvatar || 'https://via.placeholder.com/40'
      });
      console.log(`✅ Comment added successfully to video ${videoData.assetId}`);
      
      // Force refresh comments to get accurate count after adding
      setTimeout(() => {
        refreshComments();
        console.log('🔄 Refreshing comments for accurate count');
      }, 500);
    } catch (error) {
      console.error('❌ Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment. Please try again.');
    }
  }, [addComment, user, userUsername, userAvatar, videoData.assetId, refreshComments]);

  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pauseAsync();
      } else {
        videoRef.current.playAsync();
      }
    }
    
    // Show controls temporarily when toggling play/pause
    showControlsTemporarily();
    
    // Animate play/pause indicator
    Animated.sequence([
      Animated.parallel([
        Animated.timing(playPauseOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(playPauseScale, {
          toValue: 1,
          tension: 50,
          friction: 5,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(800),
      Animated.parallel([
        Animated.timing(playPauseOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(playPauseScale, {
          toValue: 0.5,
          tension: 50,
          friction: 5,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [isPlaying, playPauseOpacity, playPauseScale, showControlsTemporarily]);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      setIsMuted(!isMuted);
      videoRef.current.setVolumeAsync(isMuted ? 1.0 : 0.0);
    }
    showControlsTemporarily();
  }, [isMuted, showControlsTemporarily]);

  const handleVideoTap = useCallback(() => {
    // Single tap shows controls temporarily
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const handleDoubleTapLike = useCallback(() => {
    if (!isLiked) {
      toggleLike(); // Only like if not already liked
    }
  }, [isLiked, toggleLike]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this video by @${videoData.username} on Glint!`,
        url: `glint://video/${videoData.assetId}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Helper function to format time in mm:ss
  const formatTime = (timeInMs: number): string => {
    const totalSeconds = Math.floor(timeInMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
    >
      <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Full Screen Video */}
      <TouchableWithoutFeedback 
        onPress={handleVideoTap}
        onLongPress={handleDoubleTapLike}
      >
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={{ 
              uri: videoData.playbackUrl.startsWith('http') 
                ? videoData.playbackUrl 
                : videoData.playbackUrl 
            }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isPlaying}
            isMuted={isMuted}
            isLooping={false} // Disable loop for continuous playback
            volume={isMuted ? 0.0 : 1.0}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            onError={(error) => {
              console.error('Video playback error:', error);
              Alert.alert('Video Error', 'Unable to play this video');
            }}
            onLoad={(status) => {
              console.log('Video loaded successfully:', videoData.assetId);
              setIsVideoLoaded(true);
              if (status.isLoaded) {
                setVideoDuration(status.durationMillis || 0);
              }
            }}
          />
          
          {/* Buffering Indicator */}
          {isBuffering && (
            <View style={styles.bufferingContainer}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.bufferingText}>Loading...</Text>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Play/Pause Animated Overlay */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.playPauseOverlay,
          {
            opacity: playPauseOpacity,
            transform: [{ scale: playPauseScale }],
          },
        ]}
      >
        <Ionicons
          name={isPlaying ? 'pause-circle' : 'play-circle'}
          size={80}
          color="rgba(255, 255, 255, 0.85)"
        />
      </Animated.View>

      {/* Swipe Navigation Indicators */}
      {onNextVideo && (
        <Animated.View style={[styles.swipeIndicator, { opacity: swipeIndicatorOpacity }]}>
          <View style={styles.swipeHint}>
            <Ionicons name="chevron-up" size={24} color="rgba(255, 255, 255, 0.7)" />
            <Text style={styles.swipeText}>Swipe up for next</Text>
          </View>
        </Animated.View>
      )}
      
      {onPreviousVideo && videoIndex !== undefined && videoIndex > 0 && (
        <Animated.View style={[styles.swipeIndicator, styles.swipeIndicatorBottom, { opacity: swipeIndicatorOpacity }]}>
          <View style={styles.swipeHint}>
            <Text style={styles.swipeText}>Swipe down for previous</Text>
            <Ionicons name="chevron-down" size={24} color="rgba(255, 255, 255, 0.7)" />
          </View>
        </Animated.View>
      )}
      
      {/* Close gesture indicator */}
      <Animated.View style={[styles.swipeIndicator, styles.swipeIndicatorClose, { opacity: swipeIndicatorOpacity }]}>
        <View style={styles.swipeHint}>
          <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.7)" />
          <Text style={styles.swipeText}>Swipe down to close</Text>
        </View>
      </Animated.View>

      {/* Minimalist Playback Controls */}
      {showControls && (
        <Animated.View style={styles.controlsContainer}>
          {/* YouTube-Style Play/Pause Button */}
          <YouTubePlayButton
            isPlaying={isPlaying}
            onPress={togglePlayPause}
            size={44}
            showBackground={true}
            style={styles.youtubePlayButton}
          />
          
          {/* Mute/Unmute Button */}
          <TouchableOpacity 
            style={styles.muteButton}
            onPress={toggleMute}
          >
            <Ionicons 
              name={isMuted ? 'volume-mute' : 'volume-high'} 
              size={24} 
              color="#fff" 
            />
          </TouchableOpacity>
          
          {/* Video Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${videoDuration > 0 ? (videoPosition / videoDuration) * 100 : 0}%` }
                ]} 
              />
            </View>
            <Text style={styles.timeText}>
              {formatTime(videoPosition)} / {formatTime(videoDuration)}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        {/* Video Counter */}
        {videoIndex !== undefined && totalVideos !== undefined && (
          <View style={styles.videoCounter}>
            <Text style={styles.videoCounterText}>
              {videoIndex + 1} of {totalVideos}
            </Text>
          </View>
        )}
        
        <TouchableOpacity onPress={() => setShowVideoOptionsModal(true)} style={styles.optionsButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Left side content - User info */}
      <View style={[styles.leftContent, { paddingBottom: Math.max(40, insets.bottom + 20) }]}>
        <TouchableOpacity style={styles.userRow}>
          <Image 
            source={{ uri: userAvatar || 'https://via.placeholder.com/40' }}
            style={styles.userAvatar}
          />
          <View style={styles.userInfo}>
            <Text style={styles.username}>@{videoData.username}</Text>
            <Text style={styles.userHandle}>Creator</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.captionContainer} 
          onPress={() => {
            if (videoData.caption && videoData.caption.length > 100) {
              setCaptionExpanded(!captionExpanded);
            }
          }}
          activeOpacity={videoData.caption && videoData.caption.length > 100 ? 0.7 : 1}
        >
          {videoData.caption ? (
            <ExpandableCaptionDisplay
              caption={videoData.caption}
              views={videoData.views}
              createdAt={videoData.createdAt}
              username={videoData.username}
              maxLines={2}
              style={styles.expandableCaptionDisplay}
              textStyle={styles.caption}
              showViewsAndDate={false} // We'll show this separately below
            />
          ) : (
            <Text style={styles.caption}>
              Video created on {dayjs(videoData.createdAt).format('MMM D, YYYY')}
            </Text>
          )}
        </TouchableOpacity>
        
        <VideoInfo 
          views={videoData.views}
          createdAt={videoData.createdAt}
          style={styles.videoInfo}
          textStyle={styles.videoInfoText}
        />
      </View>

      {/* Right side actions */}
      <View style={[styles.rightActions, { paddingBottom: Math.max(40, insets.bottom + 20) }]}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={toggleLike}
          >
            <Ionicons 
              name={isLiked ? "heart" : "heart-outline"} 
              size={32} 
              color={isLiked ? "#ff3040" : "#fff"} 
            />
            <Text style={styles.actionText}>{likeCount}</Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => {
            setShowCommentsModal(true);
            // Refresh comments to get accurate count
            setTimeout(() => refreshComments(), 100);
          }}
        >
          <Ionicons name="chatbubble-outline" size={32} color="#fff" />
          <Text style={styles.actionText}>{actualDisplayedCount > 0 ? actualDisplayedCount : totalComments}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleShare}
        >
          <Ionicons name="arrow-redo-outline" size={32} color="#fff" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Comments Modal - Using GlintCommentModal */}
      <GlintCommentModal
        visible={showCommentsModal}
        onClose={() => setShowCommentsModal(false)}
        postId={videoData.assetId}
        comments={comments}
        commentsLoading={commentsLoading}
        hasMoreComments={hasMoreComments}
        totalComments={actualDisplayedCount > 0 ? actualDisplayedCount : totalComments}
        addComment={handleAddComment}
        deleteComment={deleteComment}
        loadMoreComments={loadMoreComments}
        refreshComments={refreshComments}
        commentLikes={commentLikes}
        commentLikeCounts={commentLikeCounts}
        toggleCommentLike={toggleCommentLike}
        currentUserProfile={{
          avatar: userAvatar || 'https://via.placeholder.com/40',
          username: userUsername || user?.displayName || 'User'
        }}
        navigateToUser={navigateToUser}
        onReportComment={async (commentId: string, reason: string, details?: string) => {
          try {
            const reportData = {
              commentId,
              reportedByUserId: user?.uid,
              reportedByUsername: userUsername || user?.displayName || 'User',
              reason,
              details: details || '',
              timestamp: serverTimestamp(),
              postId: videoData.assetId,
              status: 'pending'
            };
            await setDoc(doc(db, 'commentReports', `comment_${commentId}_${Date.now()}`), reportData);
            Alert.alert('Report Submitted', 'Thank you for helping keep our community safe.');
          } catch (error) {
            console.error('❌ Failed to submit report:', error);
            Alert.alert('Error', 'Failed to submit report. Please try again.');
            throw error;
          }
        }}
        modalHeight={0.85}
        backgroundColor="#fff"
      />

      {/* Options Modal */}
      <Modal
        visible={showOptionsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOptionsModal(false)}
      >
        <View style={styles.optionsModal}>
          <View style={styles.optionsHeader}>
            <Text style={styles.optionsTitle}>Video Options</Text>
            <TouchableOpacity onPress={() => setShowOptionsModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.optionItem} onPress={handleShare}>
            <Ionicons name="share-outline" size={24} color="#333" />
            <Text style={styles.optionText}>Share Video</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.optionItem}
            onPress={toggleSave}
          >
            <Ionicons 
              name={isSaved ? "bookmark" : "bookmark-outline"} 
              size={24} 
              color={isSaved ? "#007AFF" : "#333"} 
            />
            <Text style={[styles.optionText, { 
              color: isSaved ? "#007AFF" : "#333" 
            }]}>
              {isSaved ? "Saved" : "Save Video"}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.optionItem}>
            <Ionicons name="flag-outline" size={24} color="#red" />
            <Text style={[styles.optionText, { color: 'red' }]}>Report Video</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      
      {/* Video Options Modal */}
      <VideoOptionsModal
        visible={showVideoOptionsModal}
        onClose={() => setShowVideoOptionsModal(false)}
        videoId={videoData.assetId}
        videoTitle={videoData.caption}
        isOwner={isVideoOwner}
        onVideoDeleted={(deletedVideoId) => {
          console.log(`Video ${deletedVideoId} was deleted`);
          // Close the modal and navigate back
          setShowVideoOptionsModal(false);
          onClose(); // Close the full screen player
        }}
      />
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: screenWidth,
    height: screenHeight,
  },
  videoContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playPauseOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
    zIndex: 1000,
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
  backButton: {
    padding: 8,
  },
  optionsButton: {
    padding: 8,
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
  leftContent: {
    position: 'absolute',
    left: 16,
    bottom: 0,
    maxWidth: screenWidth * 0.7,
    zIndex: 1000,
    paddingVertical: 16,
    backgroundColor: 'transparent',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
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
  caption: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  viewCount: {
    color: '#ccc',
    fontSize: 12,
  },
  rightActions: {
    position: 'absolute',
    right: 16,
    bottom: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 24,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  optionsModal: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  optionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
  },
  captionContainer: {
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  readMoreText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '500',
  },
  swipeIndicator: {
    position: 'absolute',
    top: 60,
    right: 20,
    alignItems: 'center',
    zIndex: 1001,
  },
  swipeIndicatorBottom: {
    top: undefined,
    bottom: 120,
  },
  swipeIndicatorClose: {
    top: 100,
    left: 20,
    right: undefined,
  },
  swipeHint: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  swipeText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  bufferingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 20,
  },
  bufferingText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 80,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 999,
  },
  playPauseButton: {
    marginRight: 16,
    padding: 8,
  },
  muteButton: {
    marginRight: 16,
    padding: 8,
  },
  progressContainer: {
    flex: 1,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ECDC4',
    borderRadius: 2,
  },
  timeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  // YouTube-Style Components
  expandableCaption: {
    marginBottom: 8,
  },
  expandableCaptionDisplay: {
    marginBottom: 4,
  },
  videoInfo: {
    marginBottom: 8,
  },
  videoInfoText: {
    color: '#B0B0B0',
    fontSize: 13,
    fontWeight: '500',
  },
  youtubePlayButton: {
    marginRight: 16,
  },
});
