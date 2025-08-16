import { Ionicons } from '@expo/vector-icons';
import { Video as ExpoVideo, ResizeMode } from 'expo-av';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, increment, orderBy, query, updateDoc, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebaseConfig';
import { formatCount } from '../utils/formatUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Comment {
  id: string;
  userId: string;
  username: string;
  text: string;
  createdAt: string;
  likes: number;
  avatar?: string;
}

interface UserProfile {
  username: string;
  avatar: string;
  bio?: string;
  followers?: number;
}

interface Video {
  id: string;
  userId: string;
  username: string;
  caption: string;
  thumbnailUrl: string;
  videoUrl: string;
  playbackUrl: string;
  views: number;
  likes: number;
  createdAt: string;
  processed: boolean;
  status: string;
  uploadTab?: string;
  contentType?: string;
}

interface TrendsVideoPlayerProps {
  visible: boolean;
  video: Video;
  onClose: () => void;
}

const TrendsVideoPlayer: React.FC<TrendsVideoPlayerProps> = ({ visible, video, onClose }) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const videoRef = useRef<ExpoVideo>(null);
  const lastDragUpdate = useRef<number>(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes || 0);
  const [showDescription, setShowDescription] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<any>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  
  // Progress bar states
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const [showProgressPreview, setShowProgressPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const controlsTimeoutRef = useRef<any>(null);
  const dragUpdateTimeoutRef = useRef<any>(null);
  
  // Animated values for smooth progress bar
  const progressAnimatedValue = useRef(new Animated.Value(0)).current;
  const scrubberAnimatedValue = useRef(new Animated.Value(0)).current;
  
  // Double tap gesture states
  const [lastTap, setLastTap] = useState<number | null>(null);
  const [doubleTapAnimation] = useState(new Animated.Value(0));
  const [skipDirection, setSkipDirection] = useState<'forward' | 'backward' | null>(null);
  const [showSkipIndicator, setShowSkipIndicator] = useState(false);

  // Fetch user profile and video data
  useEffect(() => {
    if (visible && video) {
      console.log('🎥 Loading video:', {
        id: video.id,
        videoUrl: video.videoUrl,
        playbackUrl: video.playbackUrl,
        thumbnailUrl: video.thumbnailUrl,
        status: video.status,
        processed: video.processed
      });
      
      fetchUserProfile();
      fetchComments();
      checkIfLiked();
      checkIfSubscribed();
      incrementViews();
      
      // Reset video states when opening
      setVideoLoaded(false);
      setVideoError(false);
      setIsPlaying(false);
      setShowControls(false); // Hide controls initially
    }
    
    // Reset states when modal closes
    if (!visible) {
      setIsPlaying(false);
      setNewComment('');
      setShowControls(false);
      hideVideoControls();
      if (videoRef.current) {
        videoRef.current.pauseAsync();
      }
    }
  }, [visible, video]);

  const fetchUserProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', video.userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserProfile({
          username: userData.username || video.username,
          avatar: userData.avatar || `https://via.placeholder.com/40x40.png?text=${video.username.charAt(0).toUpperCase()}`,
          bio: userData.bio,
          followers: userData.followers || 0
        });
        setSubscriberCount(userData.followers || 0);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const commentsQuery = query(
        collection(db, 'comments'),
        where('videoId', '==', video.id),
        orderBy('createdAt', 'desc')
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      const commentsData = commentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      setComments(commentsData);
      setCommentsCount(commentsData.length);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const checkIfLiked = async () => {
    if (!user) return;
    try {
      const likeDoc = await getDoc(doc(db, 'likes', `${user.uid}_${video.id}`));
      setIsLiked(likeDoc.exists());
    } catch (error) {
      console.error('Error checking like status:', error);
    }
  };

  const checkIfSubscribed = async () => {
    if (!user || user.uid === video.userId) return;
    try {
      const followDoc = await getDoc(doc(db, 'follows', `${user.uid}_${video.userId}`));
      setIsSubscribed(followDoc.exists());
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  };

  const incrementViews = async () => {
    try {
      await updateDoc(doc(db, 'videos', video.id), {
        views: increment(1)
      });
      // Also update the post document if it exists
      const postDocRef = doc(db, 'posts', video.id);
      const postDoc = await getDoc(postDocRef);
      if (postDoc.exists()) {
        await updateDoc(postDocRef, {
          views: increment(1)
        });
      }
    } catch (error) {
      console.error('Error incrementing views:', error);
    }
  };

  // Handle video playback
  const handlePlayPause = async () => {
    if (!videoRef.current || !videoLoaded) {
      console.log('Video not loaded yet or ref not available');
      return;
    }
    
    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
        console.log('Video paused');
      } else {
        await videoRef.current.playAsync();
        console.log('Video playing');
      }
    } catch (error) {
      console.error('Error controlling video playback:', error);
    }
  };

  // Handle video status updates
  const onPlaybackStatusUpdate = useCallback((status: any) => {
    // Update playback status for smooth progress bar movement
    setPlaybackStatus(status);
    
    if (status.isLoaded) {
      setVideoLoaded(true);
      setVideoError(false);
      setIsPlaying(status.isPlaying);
      
      // Log video info for debugging (only once when loaded)
      if (status.durationMillis && !videoLoaded) {
        console.log(`Video loaded: ${formatTime(status.durationMillis)} duration`);
      }
    } else if (status.error) {
      console.error('Video playback error:', status.error);
      setVideoError(true);
      setVideoLoaded(false);
    }
  }, [videoLoaded]);

  // Get the best available video URL
  const getVideoSource = useCallback((): { uri: string } | undefined => {
    if (!video) return undefined;
    
    // Try playbackUrl first (processed video), then videoUrl (original upload)
    const url = video.playbackUrl || video.videoUrl;
    
    // Only log once per video
    if (url && !videoLoaded && !videoError) {
      console.log('🎥 Video source selected:', {
        url,
        usingPlaybackUrl: !!video.playbackUrl,
        usingVideoUrl: !!video.videoUrl && !video.playbackUrl
      });
    }
    
    return url ? { uri: url } : undefined;
  }, [video, videoLoaded, videoError]);

  // Handle video load
  const onVideoLoad = (status: any) => {
    console.log('Video loaded successfully:', status);
    setVideoLoaded(true);
    setVideoError(false);
    
    // Auto-play when video loads (like YouTube)
    if (videoRef.current && visible) {
      videoRef.current.playAsync();
    }
  };

  // Handle video error
  const onVideoError = (error: any) => {
    console.error('Video error:', error);
    setVideoError(true);
    setVideoLoaded(false);
  };

  // Retry video loading
  const retryVideoLoad = async () => {
    console.log('Retrying video load...');
    setVideoError(false);
    setVideoLoaded(false);
    
    if (videoRef.current) {
      try {
        await videoRef.current.unloadAsync();
        await videoRef.current.loadAsync({ 
          uri: video.videoUrl || video.playbackUrl,
          headers: {
            'Accept': 'video/*',
          }
        });
      } catch (error) {
        console.error('Error retrying video load:', error);
        setVideoError(true);
      }
    }
  };

  // Progress bar handlers
  const handleProgressBarLayout = useCallback((event: any) => {
    const { width } = event.nativeEvent.layout;
    setProgressBarWidth(width);
  }, []);

  const handleProgressBarPress = useCallback((event: any) => {
    if (!playbackStatus?.durationMillis || !progressBarWidth) return;
    
    const touchX = event.nativeEvent.locationX;
    const percentage = Math.max(0, Math.min(1, touchX / progressBarWidth));
    const newPosition = percentage * playbackStatus.durationMillis;
    
    if (videoRef.current) {
      videoRef.current.setPositionAsync(newPosition);
    }
  }, [playbackStatus, progressBarWidth]);

  const handleProgressBarPanStart = useCallback((event: any) => {
    setIsDragging(true);
    setShowProgressPreview(true);
    
    const touchX = event.nativeEvent.x;
    const percentage = Math.max(0, Math.min(1, touchX / progressBarWidth));
    setPreviewPosition(percentage);
    setDragPosition(touchX);
    
    // Animate to touched position smoothly
    Animated.timing(progressAnimatedValue, {
      toValue: percentage,
      duration: 50,
      useNativeDriver: false,
    }).start();
    
    Animated.timing(scrubberAnimatedValue, {
      toValue: percentage,
      duration: 50,
      useNativeDriver: false,
    }).start();
  }, [progressBarWidth, progressAnimatedValue, scrubberAnimatedValue]);

  const handleProgressBarPanMove = useCallback((event: any) => {
    if (!isDragging || !progressBarWidth) return;
    
    const touchX = Math.max(0, Math.min(progressBarWidth, event.nativeEvent.x));
    const percentage = touchX / progressBarWidth;
    
    // Clear any pending updates
    if (dragUpdateTimeoutRef.current) {
      clearTimeout(dragUpdateTimeoutRef.current);
    }
    
    // Immediate visual feedback for smooth dragging
    setPreviewPosition(percentage);
    setDragPosition(touchX);
    
    // Smooth animation during drag
    Animated.timing(progressAnimatedValue, {
      toValue: percentage,
      duration: 16, // ~60fps for ultra smooth
      useNativeDriver: false,
    }).start();
    
    Animated.timing(scrubberAnimatedValue, {
      toValue: percentage,
      duration: 16,
      useNativeDriver: false,
    }).start();
  }, [isDragging, progressBarWidth, progressAnimatedValue, scrubberAnimatedValue]);

  const handleProgressBarPanEnd = useCallback((event: any) => {
    if (!playbackStatus?.durationMillis || !progressBarWidth) {
      setIsDragging(false);
      setShowProgressPreview(false);
      return;
    }
    
    const touchX = Math.max(0, Math.min(progressBarWidth, event.nativeEvent.x));
    const percentage = touchX / progressBarWidth;
    const newPosition = percentage * playbackStatus.durationMillis;
    
    // Only seek when drag ends for smooth experience
    if (videoRef.current) {
      videoRef.current.setPositionAsync(newPosition);
    }
    
    setIsDragging(false);
    setShowProgressPreview(false);
  }, [playbackStatus, progressBarWidth]);

  const getCurrentProgress = useCallback(() => {
    // When dragging, show the drag position immediately
    if (isDragging) {
      return Math.max(0, Math.min(1, previewPosition));
    }
    // Otherwise show actual playback progress
    if (playbackStatus?.isLoaded && playbackStatus.durationMillis > 0) {
      const progress = playbackStatus.positionMillis / playbackStatus.durationMillis;
      return Math.max(0, Math.min(1, progress));
    }
    return 0;
  }, [isDragging, previewPosition, playbackStatus]);

  // Get the progress fill width for visual feedback
  const getProgressFillWidth = useCallback(() => {
    const progress = getCurrentProgress();
    return progressBarWidth > 0 ? Math.max(0, Math.min(progressBarWidth, progress * progressBarWidth)) : 0;
  }, [getCurrentProgress, progressBarWidth]);

  // Get the scrubber position for visual feedback
  const getScrubberPosition = useCallback(() => {
    if (isDragging && progressBarWidth > 0) {
      // Show scrubber at drag position
      return Math.max(0, Math.min(progressBarWidth - 6, previewPosition * progressBarWidth - 6));
    }
    // Show scrubber at actual playback position
    const progress = getCurrentProgress();
    return progressBarWidth > 0 ? Math.max(0, Math.min(progressBarWidth - 6, progress * progressBarWidth - 6)) : 0;
  }, [isDragging, previewPosition, progressBarWidth, getCurrentProgress]);

  // Show/hide controls functions
  const showVideoControls = useCallback(() => {
    setShowControls(true);
    
    // Clear existing timeout
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    // Hide controls after 3 seconds if video is playing
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  const hideVideoControls = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(false);
  }, []);

  // Handle single tap (pause/play)
  const handleSingleTap = useCallback(async () => {
    console.log('Single tap detected, current isPlaying:', isPlaying);
    
    if (isPlaying) {
      // If playing, pause and show controls
      try {
        if (videoRef.current) {
          await videoRef.current.pauseAsync();
          console.log('Video paused via single tap');
        }
        setShowControls(true);
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
      } catch (error) {
        console.error('Error pausing video:', error);
      }
    } else {
      // If paused, play and show controls briefly
      try {
        if (videoRef.current) {
          await videoRef.current.playAsync();
          console.log('Video resumed via single tap');
        }
        showVideoControls(); // This will auto-hide after 3 seconds
      } catch (error) {
        console.error('Error playing video:', error);
      }
    }
  }, [isPlaying, showVideoControls]);

  // Handle skip forward/backward
  const handleSkip = useCallback(async (direction: 'forward' | 'backward') => {
    if (!videoRef.current || !playbackStatus?.isLoaded || !playbackStatus.durationMillis) return;
    
    const skipAmount = 10000; // 10 seconds in milliseconds
    const currentPosition = playbackStatus.positionMillis || 0;
    let newPosition;
    
    if (direction === 'forward') {
      newPosition = Math.min(currentPosition + skipAmount, playbackStatus.durationMillis);
    } else {
      newPosition = Math.max(currentPosition - skipAmount, 0);
    }
    
    try {
      await videoRef.current.setPositionAsync(newPosition);
      
      // Show skip indicator animation
      setSkipDirection(direction);
      setShowSkipIndicator(true);
      
      // Animate the skip indicator
      Animated.sequence([
        Animated.timing(doubleTapAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(doubleTapAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowSkipIndicator(false);
      });
      
    } catch (error) {
      console.error('Error skipping video:', error);
    }
  }, [playbackStatus, doubleTapAnimation]);

  // Handle video player touch with double tap detection
  const handleVideoTouch = useCallback((event: any) => {
    const { locationX } = event.nativeEvent;
    const videoWidth = screenWidth; // Use the imported screenWidth
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // ms
    
    console.log('Video touch detected at x:', locationX, 'isPlaying:', isPlaying);
    
    // Determine which third of screen was tapped
    const leftThird = videoWidth / 3;
    const rightThird = (videoWidth * 2) / 3;
    
    console.log('Touch zones - Left:', leftThird, 'Right:', rightThird, 'VideoWidth:', videoWidth);
    
    if (lastTap && (now - lastTap) < DOUBLE_TAP_DELAY) {
      // Double tap detected
      console.log('Double tap detected in zone:', locationX < leftThird ? 'left' : locationX > rightThird ? 'right' : 'center');
      
      if (locationX < leftThird) {
        // Left side - skip backward 10 seconds
        handleSkip('backward');
      } else if (locationX > rightThird) {
        // Right side - skip forward 10 seconds
        handleSkip('forward');
      } else {
        // Center - treat as single tap (pause/play)
        handleSingleTap();
      }
      setLastTap(null);
    } else {
      // Potential first tap - wait for double tap
      console.log('First tap detected, waiting for potential double tap...');
      setLastTap(now);
      setTimeout(() => {
        if (lastTap === now) {
          // No double tap occurred, handle as single tap
          console.log('No double tap occurred, handling as single tap in zone:', locationX < leftThird ? 'left' : locationX > rightThird ? 'right' : 'center');
          
          // Handle single tap in any area (not just center)
          handleSingleTap();
          setLastTap(null);
        }
      }, DOUBLE_TAP_DELAY);
    }
  }, [lastTap, isPlaying, showVideoControls, handleSingleTap, handleSkip]);

  // Toggle play/pause
  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current || !playbackStatus) return;
    
    console.log('Toggle play/pause called, current isPlaying:', isPlaying);
    
    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
        console.log('Video paused via toggle');
        // Show controls when paused and keep them visible
        setShowControls(true);
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
      } else {
        await videoRef.current.playAsync();
        console.log('Video resumed via toggle');
        // Show controls briefly when resuming play
        showVideoControls();
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  }, [isPlaying, playbackStatus, showVideoControls]);

  // Create PanResponder for progress bar
  const progressBarPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => false,
    onPanResponderGrant: (evt) => handleProgressBarPanStart(evt),
    onPanResponderMove: (evt) => handleProgressBarPanMove(evt),
    onPanResponderRelease: (evt) => handleProgressBarPanEnd(evt),
    onPanResponderTerminate: (evt) => handleProgressBarPanEnd(evt),
  }), [handleProgressBarPanStart, handleProgressBarPanMove, handleProgressBarPanEnd]);

  // Format time from milliseconds
  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  const formatTimeAgo = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
    
    if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }, []);

  // Handle like toggle
  const handleLikeToggle = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to like videos');
      return;
    }

    try {
      const likeDocRef = doc(db, 'likes', `${user.uid}_${video.id}`);
      const videoDocRef = doc(db, 'videos', video.id);
      
      if (isLiked) {
        // Unlike - delete the like document
        await updateDoc(likeDocRef, { deleted: true });
        await updateDoc(videoDocRef, { likes: increment(-1) });
        
        // Update post document if it exists
        const postDocRef = doc(db, 'posts', video.id);
        const postDoc = await getDoc(postDocRef);
        if (postDoc.exists()) {
          await updateDoc(postDocRef, { likes: increment(-1) });
        }
        
        setLikeCount(prev => prev - 1);
        setIsLiked(false);
      } else {
        // Like - create new like document
        await updateDoc(likeDocRef, {
          userId: user.uid,
          videoId: video.id,
          createdAt: new Date().toISOString(),
          deleted: false
        });
        await updateDoc(videoDocRef, { likes: increment(1) });
        
        // Update post document if it exists
        const postDocRef = doc(db, 'posts', video.id);
        const postDoc = await getDoc(postDocRef);
        if (postDoc.exists()) {
          await updateDoc(postDocRef, { likes: increment(1) });
        }
        
        setLikeCount(prev => prev + 1);
        setIsLiked(true);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like status');
    }
  };

  // Handle subscribe toggle
  const handleSubscribeToggle = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to subscribe');
      return;
    }

    if (user.uid === video.userId) {
      Alert.alert('Error', 'You cannot subscribe to yourself');
      return;
    }

    try {
      const followDocRef = doc(db, 'follows', `${user.uid}_${video.userId}`);
      const userDocRef = doc(db, 'users', video.userId);

      if (isSubscribed) {
        // Unsubscribe
        await updateDoc(followDocRef, { deleted: true });
        await updateDoc(userDocRef, { followers: increment(-1) });
        setSubscriberCount(prev => prev - 1);
        setIsSubscribed(false);
      } else {
        // Subscribe
        await updateDoc(followDocRef, {
          followerId: user.uid,
          followingId: video.userId,
          createdAt: new Date().toISOString(),
          deleted: false
        });
        await updateDoc(userDocRef, { followers: increment(1) });
        setSubscriberCount(prev => prev + 1);
        setIsSubscribed(true);
      }
    } catch (error) {
      console.error('Error toggling subscription:', error);
      Alert.alert('Error', 'Failed to update subscription status');
    }
  };

  // Handle comment submission
  const handleCommentSubmit = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to comment');
      return;
    }

    if (!newComment.trim()) {
      Alert.alert('Error', 'Please enter a comment');
      return;
    }

    try {
      const commentData = {
        videoId: video.id,
        userId: user.uid,
        username: user.email?.split('@')[0] || 'user',
        text: newComment.trim(),
        createdAt: new Date().toISOString(),
        likes: 0
      };

      await addDoc(collection(db, 'comments'), commentData);
      
      // Add to local state
      const newCommentWithId = {
        id: `temp_${Date.now()}`,
        ...commentData
      };
      setComments(prev => [newCommentWithId, ...prev]);
      setCommentsCount(prev => prev + 1);
      setNewComment('');

      // Update video comments count
      const videoDocRef = doc(db, 'videos', video.id);
      await updateDoc(videoDocRef, {
        comments: increment(1)
      });
      
      // Update post document if it exists
      const postDocRef = doc(db, 'posts', video.id);
      const postDoc = await getDoc(postDocRef);
      if (postDoc.exists()) {
        await updateDoc(postDocRef, {
          comments: increment(1)
        });
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  // Navigate to user profile
  const navigateToUserProfile = () => {
    onClose();
    router.push({
      pathname: '/(tabs)/me',
      params: { userId: video.userId }
    });
  };

  // Handle share
  const handleShare = () => {
    // Implement share functionality
    console.log('Sharing video:', video.id);
    Alert.alert('Share', 'Share functionality will be implemented');
  };

  // Render comment item
  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <Image 
        source={{ 
          uri: item.avatar || `https://via.placeholder.com/32x32.png?text=${item.username.charAt(0).toUpperCase()}` 
        }}
        style={styles.commentAvatar}
      />
      <View style={styles.commentContent}>
        <Text style={styles.commentAuthor}>@{item.username}</Text>
        <Text style={styles.commentText}>{item.text}</Text>
        <View style={styles.commentActions}>
          <Text style={styles.commentTime}>{formatTimeAgo(item.createdAt)}</Text>
          <TouchableOpacity>
            <Text style={styles.commentAction}>Like</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.commentAction}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (!visible || !video) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.container}>
        
        {/* 1. TOP NAVIGATION BAR */}
        <View style={styles.topNavBar}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* 2. INLINE VIDEO PLAYER */}
          <View style={styles.videoPlayerSection}>
            {!videoError ? (
              <TouchableOpacity 
                style={styles.videoContainer} 
                activeOpacity={1} 
                onPress={handleVideoTouch}
              >
                <ExpoVideo
                  ref={videoRef}
                  source={getVideoSource()}
                  style={styles.inlineVideo}
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay={true}
                  isLooping={false}
                  onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                  onLoad={onVideoLoad}
                  onError={onVideoError}
                  useNativeControls={false}
                  volume={1.0}
                  isMuted={false}
                  usePoster={true}
                  posterSource={{ uri: video.thumbnailUrl }}
                  posterStyle={styles.inlineVideo}
                  progressUpdateIntervalMillis={50}
                />
                
                {/* Video Controls Overlay - Only visible when showControls is true */}
                {showControls && (
                  <View style={styles.videoControlsOverlayNew}>
                    {/* Play/Pause Button */}
                    <TouchableOpacity 
                      style={styles.playPauseButton}
                      onPress={togglePlayPause}
                    >
                      <Ionicons 
                        name={isPlaying ? "pause" : "play"} 
                        size={48} 
                        color="#fff" 
                      />
                    </TouchableOpacity>
                  </View>
                )}
                
                {/* Show loading indicator when video is loading */}
                {!videoLoaded && !videoError && (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading video...</Text>
                  </View>
                )}
                
                {/* Show error message if video failed to load */}
                {videoError && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="warning" size={30} color="#fff" />
                    <Text style={styles.errorText}>Video unavailable</Text>
                    <Text style={styles.errorSubtext}>Tap to retry</Text>
                  </View>
                )}
                
                {/* Show play button when video is loaded and paused AND controls are visible */}
                {videoLoaded && !videoError && !isPlaying && showControls && (
                  <View style={styles.playButtonCenter}>
                    <Ionicons name="play" size={50} color="#fff" />
                  </View>
                )}
                
                {/* Progress Bar - Only visible when showControls is true or when dragging */}
                {(showControls || isDragging) && playbackStatus && playbackStatus.isLoaded && videoLoaded && !videoError && (
                  <View style={styles.videoProgressOverlay}>
                    <TouchableOpacity
                      style={styles.progressBarContainer}
                      activeOpacity={1}
                      onLayout={handleProgressBarLayout}
                      onPress={handleProgressBarPress}
                      {...progressBarPanResponder.panHandlers}
                    >
                      {/* Background track */}
                      <View style={styles.progressBarTrack} />
                      
                      {/* Buffer progress (if available) */}
                      {playbackStatus.playableDurationMillis && playbackStatus.durationMillis > 0 && progressBarWidth > 0 && (
                        <View 
                          style={[
                            styles.progressBarBuffer,
                            {
                              width: Math.min(progressBarWidth, (playbackStatus.playableDurationMillis / playbackStatus.durationMillis) * progressBarWidth) || 0
                            }
                          ]}
                        />
                      )}
                      
                      {/* Progress fill */}
                      <Animated.View 
                        style={[
                          styles.progressBarFill, 
                          { 
                            width: isDragging 
                              ? progressAnimatedValue.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, progressBarWidth],
                                  extrapolate: 'clamp',
                                })
                              : getProgressFillWidth(),
                            backgroundColor: isDragging ? '#ff4444' : '#ff0000',
                          }
                        ]} 
                      />
                      
                      {/* Scrubber dot - positioned at progress end */}
                      <Animated.View 
                        style={[
                          styles.progressBarScrubber,
                          {
                            left: isDragging
                              ? scrubberAnimatedValue.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, Math.max(0, progressBarWidth - 6)],
                                  extrapolate: 'clamp',
                                })
                              : getScrubberPosition(),
                            opacity: isDragging ? 1 : 0.9,
                            transform: [{ scale: isDragging ? 1.4 : 1.1 }],
                          }
                        ]}
                      />
                      
                      {/* Progress preview tooltip */}
                      {showProgressPreview && playbackStatus.durationMillis > 0 && progressBarWidth > 0 && (
                        <View 
                          style={[
                            styles.progressPreviewTooltip,
                            {
                              left: Math.max(20, Math.min(progressBarWidth - 40, previewPosition * progressBarWidth - 30)),
                            }
                          ]}
                        >
                          <Text style={styles.progressPreviewText}>
                            {formatTime(previewPosition * playbackStatus.durationMillis)}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
                
                {/* Skip Indicator Overlay */}
                {showSkipIndicator && (
                  <Animated.View 
                    style={[
                      styles.skipIndicatorOverlay,
                      {
                        opacity: doubleTapAnimation,
                        transform: [
                          {
                            scale: doubleTapAnimation.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.5, 1],
                            }),
                          },
                        ],
                      }
                    ]}
                  >
                    <View style={styles.skipIndicatorContainer}>
                      <Ionicons 
                        name={skipDirection === 'forward' ? 'play-forward' : 'play-back'} 
                        size={40} 
                        color="#fff" 
                      />
                      <Text style={styles.skipIndicatorText}>
                        {skipDirection === 'forward' ? '+10' : '-10'}
                      </Text>
                    </View>
                  </Animated.View>
                )}
              </TouchableOpacity>
            ) : (
              // Fallback to thumbnail if video fails to load
              <TouchableOpacity 
                style={styles.videoContainer}
                onPress={retryVideoLoad}
                activeOpacity={1}
              >
                <Image 
                  source={{ uri: video.thumbnailUrl }} 
                  style={styles.inlineVideo}
                  resizeMode="cover"
                />
                <View style={styles.errorContainer}>
                  <Ionicons name="warning" size={30} color="#fff" />
                  <Text style={styles.errorText}>Video unavailable</Text>
                  <Text style={styles.errorSubtext}>Tap to retry</Text>
                </View>
              </TouchableOpacity>
            )}



          </View>

          {/* 3. SPONSORED TAG (if applicable) */}
          {video.uploadTab === 'Trends' && (
            <View style={styles.sponsoredSection}>
              <Text style={styles.sponsoredText}>Sponsored</Text>
            </View>
          )}

          {/* 4. VIDEO METADATA SECTION */}
          <View style={styles.videoMetadataSection}>
            {/* Video Title */}
            <TouchableOpacity onPress={() => setShowDescription(!showDescription)}>
              <Text style={styles.videoTitle} numberOfLines={showDescription ? undefined : 2}>
                {video.caption}
              </Text>
            </TouchableOpacity>

            {/* Views and Time */}
            <View style={styles.viewsTimeRow}>
              <Text style={styles.viewsTimeText}>
                {formatCount(video.views + 1)} views • {formatTimeAgo(video.createdAt)}
              </Text>
              {!showDescription && (
                <TouchableOpacity onPress={() => setShowDescription(true)}>
                  <Text style={styles.moreText}>...more</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 5. CHANNEL INFO & SUBSCRIBE SECTION */}
          <View style={styles.channelInfoSection}>
            <TouchableOpacity 
              style={styles.channelInfoLeft}
              onPress={navigateToUserProfile}
            >
              <Image 
                source={{ 
                  uri: userProfile?.avatar || `https://via.placeholder.com/36x36.png?text=${video.username.charAt(0).toUpperCase()}` 
                }}
                style={styles.channelAvatar}
              />
              <View style={styles.channelTextInfo}>
                <Text style={styles.channelName}>{userProfile?.username || video.username}</Text>
                <Text style={styles.subscriberCount}>
                  {formatCount(subscriberCount)} subscribers
                </Text>
              </View>
            </TouchableOpacity>
            
            {user && user.uid !== video.userId && (
              <TouchableOpacity 
                style={[
                  styles.subscribeButton, 
                  isSubscribed && styles.subscribedButton
                ]}
                onPress={handleSubscribeToggle}
              >
                <Text style={[
                  styles.subscribeButtonText,
                  isSubscribed && styles.subscribedButtonText
                ]}>
                  {isSubscribed ? 'Subscribed' : 'Subscribe'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 6. ENGAGEMENT BAR (Icons Row) */}
          <View style={styles.engagementBar}>
            <TouchableOpacity 
              style={styles.engagementButton}
              onPress={handleLikeToggle}
            >
              <Ionicons 
                name={isLiked ? "thumbs-up" : "thumbs-up-outline"} 
                size={24} 
                color={isLiked ? "#ff0000" : "#000"} 
              />
              <Text style={[styles.engagementText, isLiked && styles.likedText]}>
                {formatCount(likeCount)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.engagementButton}>
              <Ionicons name="chatbubble-outline" size={24} color="#000" />
              <Text style={styles.engagementText}>{formatCount(commentsCount)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.engagementButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color="#000" />
              <Text style={styles.engagementText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.engagementButton}>
              <Ionicons name="download-outline" size={24} color="#000" />
              <Text style={styles.engagementText}>Download</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.engagementButton}>
              <Ionicons name="bookmark-outline" size={24} color="#000" />
              <Text style={styles.engagementText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.engagementButton}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {/* 7. COMMENT PREVIEW SECTION */}
          <View style={styles.commentPreviewSection}>
            <Text style={styles.commentsHeader}>Comments {commentsCount}</Text>
            
            {comments.length > 0 && (
              <TouchableOpacity style={styles.commentPreview}>
                <Image 
                  source={{ 
                    uri: comments[0].avatar || `https://via.placeholder.com/32x32.png?text=${comments[0].username.charAt(0).toUpperCase()}` 
                  }}
                  style={styles.commentPreviewAvatar}
                />
                <View style={styles.commentPreviewContent}>
                  <Text style={styles.commentPreviewAuthor}>@{comments[0].username}</Text>
                  <Text style={styles.commentPreviewText} numberOfLines={2}>
                    {comments[0].text}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Add Comment Input */}
            {user && (
              <View style={styles.addCommentPreview}>
                <Image 
                  source={{ 
                    uri: `https://via.placeholder.com/32x32.png?text=${user.email?.charAt(0).toUpperCase() || 'U'}` 
                  }}
                  style={styles.commentPreviewAvatar}
                />
                <TextInput
                  style={styles.commentPreviewInput}
                  placeholder="Add a comment..."
                  value={newComment}
                  onChangeText={setNewComment}
                  onSubmitEditing={handleCommentSubmit}
                  returnKeyType="send"
                />
              </View>
            )}
          </View>

          {/* 8. NEXT VIDEO PREVIEW (Bottom Edge) */}
          <View style={styles.nextVideoPreview}>
            <Image 
              source={{ uri: 'https://via.placeholder.com/400x200.png?text=Next+Video' }}
              style={styles.nextVideoThumbnail}
            />
            <View style={styles.nextVideoOverlay}>
              <Text style={styles.nextVideoText}>Up next</Text>
            </View>
          </View>

          {/* Bottom padding for safe scrolling */}
          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // MAIN CONTAINER
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  
  // 1. TOP NAVIGATION BAR
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  navCenter: {
    flex: 1,
  },
  moreButton: {
    padding: 8,
  },
  backButton: {
    padding: 8,
  },
  
  // SCROLL CONTAINER
  scrollContainer: {
    flex: 1,
  },
  
  // 2. INLINE VIDEO PLAYER
  videoPlayerSection: {
    backgroundColor: '#000',
    aspectRatio: 16/9,
    position: 'relative',
  },
  inlineVideo: {
    width: '100%',
    height: '100%',
  },
  videoControlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonCenter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  errorSubtext: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 4,
  },
  videoProgressSection: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarContainer: {
    flex: 1,
    height: 44, // Larger touch area for better interaction
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 12, // Extra padding for touch area
  },
  progressBarTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 20, // Center vertically in the 44px container
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    width: '100%',
  },
  progressBarBuffer: {
    position: 'absolute',
    left: 0,
    top: 20, // Center vertically in the 44px container
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 2,
    maxWidth: '100%',
  },
  progressBarFill: {
    position: 'absolute',
    left: 0,
    top: 20, // Center vertically in the 44px container
    height: 4,
    backgroundColor: '#ff0000',
    borderRadius: 2,
    maxWidth: '100%',
  },
  progressBarScrubber: {
    position: 'absolute',
    top: 16, // Center on the progress bar (44px container, 12px scrubber)
    width: 12,
    height: 12,
    backgroundColor: '#ff0000',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 4,
  },
  progressPreviewTooltip: {
    position: 'absolute',
    bottom: 30,
    width: 60,
    height: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressPreviewText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  videoTimeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    minWidth: 80,
    textAlign: 'right',
  },
  
  // 3. SPONSORED SECTION
  sponsoredSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  sponsoredText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  
  // 4. VIDEO METADATA SECTION
  videoMetadataSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    lineHeight: 22,
    marginBottom: 8,
  },
  viewsTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  viewsTimeText: {
    fontSize: 14,
    color: '#666',
  },
  moreText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  
  // 5. CHANNEL INFO SECTION
  channelInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  channelInfoLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  channelTextInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  subscriberCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  subscribeButton: {
    backgroundColor: '#ff0000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  subscribedButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  subscribeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  subscribedButtonText: {
    color: '#666',
  },
  
  // 6. ENGAGEMENT BAR
  engagementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  engagementButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  engagementText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  likedText: {
    color: '#ff0000',
  },
  
  // 7. COMMENT PREVIEW SECTION
  commentPreviewSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentsHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  commentPreview: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentPreviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentPreviewContent: {
    flex: 1,
  },
  commentPreviewAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  commentPreviewText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
  },
  addCommentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentPreviewInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    paddingVertical: 8,
  },
  
  // 8. NEXT VIDEO PREVIEW
  nextVideoPreview: {
    height: 120,
    backgroundColor: '#f0f0f0',
    position: 'relative',
    marginTop: 16,
  },
  nextVideoThumbnail: {
    width: '100%',
    height: '100%',
  },
  nextVideoOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  nextVideoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  
  // UTILITY STYLES
  bottomPadding: {
    height: 100,
  },
  
  // COMMENT ITEM STYLES (for legacy support)
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  commentTime: {
    fontSize: 12,
    color: '#666',
  },
  commentAction: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  
  // Video container and controls
  videoContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16/9,
  },
  videoControlsOverlayNew: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playPauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoProgressOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  
  // Skip indicator styles
  skipIndicatorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    pointerEvents: 'none',
  },
  skipIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 25,
    gap: 10,
  },
  skipIndicatorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default TrendsVideoPlayer;
