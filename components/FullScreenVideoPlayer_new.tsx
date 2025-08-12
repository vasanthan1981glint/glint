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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebaseConfig';
import { useComments } from '../hooks/useComments';
import { useUserStore } from '../lib/userStore';
import GlintCommentModal from './GlintCommentModal';

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
  };
  onClose: () => void;
}

export const FullScreenVideoPlayer: React.FC<VideoPlayerProps> = ({ videoData, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const videoRef = useRef<Video>(null);
  const { avatar: userAvatar } = useUserStore();
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  
  // Comment like states for GlintCommentModal
  const [commentLikes, setCommentLikes] = useState<{ [id: string]: boolean }>({});
  const [commentLikeCounts, setCommentLikeCounts] = useState<{ [id: string]: number }>({});
  
  // Animations
  const playPauseOpacity = useRef(new Animated.Value(0)).current;
  const playPauseScale = useRef(new Animated.Value(0.5)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // REAL FIREBASE LIKE SYSTEM - Same as home screen
  const likeDebounce = useRef<boolean>(false);

  // ADVANCED COMMENT SYSTEM - YouTube/Glint-style performance
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
    postId: videoData.assetId,
    userId: user?.uid,
    enableRealtime: true,
    pageSize: 20
  });

  // Load like status and count from Firebase
  useEffect(() => {
    if (!user || !videoData.assetId) return;

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

        // Set up real-time listener for like count
        const unsubscribe = onSnapshot(
          collection(db, 'posts', videoData.assetId, 'likes'),
          (snapshot) => {
            setLikeCount(snapshot.size);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error('Error loading like data:', error);
      }
    };

    loadLikeData();
  }, [user, videoData.assetId]);

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

  // Report comment functionality
  const handleReportComment = async (commentId: string, reason: string, details?: string) => {
    try {
      // Add to reports collection
      await setDoc(doc(db, 'reports', `comment_${commentId}_${Date.now()}`), {
        type: 'comment',
        commentId,
        reportedBy: user?.uid,
        reason,
        details,
        timestamp: serverTimestamp(),
        status: 'pending'
      });
      
      Alert.alert('Report Submitted', 'Thank you for helping keep our community safe.');
    } catch (error) {
      console.error('Error reporting comment:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pauseAsync();
      } else {
        videoRef.current.playAsync();
      }
    }
    
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
  }, [isPlaying, playPauseOpacity, playPauseScale]);

  const handleDoubleTapLike = useCallback(() => {
    if (!isLiked) {
      toggleLike(); // Only like if not already liked
    }
  }, [isLiked, toggleLike]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
    }
  };

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Full Screen Video */}
      <TouchableWithoutFeedback 
        onPress={togglePlayPause}
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
            isLooping
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            onError={(error) => {
              console.error('Video playback error:', error);
              Alert.alert('Video Error', 'Unable to play this video');
            }}
            onLoad={() => {
              console.log('Video loaded successfully:', videoData.assetId);
            }}
          />
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

      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowOptionsModal(true)} style={styles.optionsButton}>
          <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Left side content - User info */}
      <View style={[styles.leftContent, { paddingBottom: 80 + insets.bottom }]}>
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
        
        <Text style={styles.caption}>
          Video created on {dayjs(videoData.createdAt).format('MMM D, YYYY')}
        </Text>
        
        <Text style={styles.viewCount}>
          {videoData.views?.toLocaleString() || 0} views
        </Text>
      </View>

      {/* Right side actions */}
      <View style={[styles.rightActions, { paddingBottom: 80 + insets.bottom }]}>
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
          onPress={() => setShowCommentsModal(true)}
        >
          <Ionicons name="chatbubble-outline" size={32} color="#fff" />
          <Text style={styles.actionText}>{totalComments}</Text>
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
        totalComments={totalComments}
        addComment={async (text: string, parentId?: string) => {
          await addComment(text);
        }}
        deleteComment={deleteComment}
        loadMoreComments={loadMoreComments}
        refreshComments={refreshComments}
        commentLikes={commentLikes}
        commentLikeCounts={commentLikeCounts}
        toggleCommentLike={toggleCommentLike}
        currentUserProfile={{
          avatar: userAvatar || 'https://via.placeholder.com/40',
          username: user?.displayName || 'User'
        }}
        navigateToUser={navigateToUser}
        onReportComment={handleReportComment}
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
          
          <TouchableOpacity style={styles.optionItem}>
            <Ionicons name="bookmark-outline" size={24} color="#333" />
            <Text style={styles.optionText}>Save Video</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.optionItem}>
            <Ionicons name="flag-outline" size={24} color="#red" />
            <Text style={[styles.optionText, { color: 'red' }]}>Report Video</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
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
  leftContent: {
    position: 'absolute',
    left: 16,
    bottom: 0,
    maxWidth: screenWidth * 0.7,
    zIndex: 1000,
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
    flex: 1,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userHandle: {
    color: '#ccc',
    fontSize: 12,
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
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
});
