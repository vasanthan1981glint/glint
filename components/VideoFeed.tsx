/**
 * Video Feed Component
 * Displays videos with Mux streaming and comprehensive features
 */

import { MaterialIcons } from '@expo/vector-icons';
import { getAuth } from 'firebase/auth';
import { collection, doc, getFirestore, increment, limit, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import { ResizeMode, Video } from 'expo-av';

const { width, height } = Dimensions.get('window');

interface VideoData {
  id: string;
  userId: string;
  username: string;
  userPhotoURL?: string;
  caption: string;
  playbackUrl: string;
  streamingUrl?: string; // Google Cloud uses streamingUrl
  playbackId: string;
  videoId?: string; // Google Cloud uses videoId
  thumbnailUrl?: string;
  assetId: string;
  duration?: number;
  createdAt: any;
  likes: number;
  comments: number;
  views: number;
  isLiked?: boolean;
  isSaved?: boolean;
}

interface VideoFeedProps {
  userId?: string; // Optional: filter by specific user
  refreshing?: boolean;
  onRefresh?: () => void;
}

export default function VideoFeed({ userId, refreshing = false, onRefresh }: VideoFeedProps) {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const db = getFirestore();
  const auth = getAuth();

  useEffect(() => {
    setCurrentUser(auth.currentUser);
    loadVideos();
  }, [userId]);

  const loadVideos = useCallback(() => {
    setLoading(true);
    
    try {
      // Create query
      let videosQuery;
      
      if (userId) {
        // Load videos for specific user
        videosQuery = query(
          collection(db, 'videos'),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
      } else {
        // Load all videos for feed
        videosQuery = query(
          collection(db, 'videos'),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
      }

      // Subscribe to real-time updates
      const unsubscribe = onSnapshot(videosQuery, (snapshot) => {
        const videoList: VideoData[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          
          // Only show videos that have Mux data
          if (data.playbackUrl && data.assetId) {
            videoList.push({
              id: doc.id,
              userId: data.userId,
              username: data.username || 'Anonymous',
              userPhotoURL: data.userPhotoURL,
              caption: data.caption || '',
              playbackUrl: data.playbackUrl,
              playbackId: data.playbackId,
              thumbnailUrl: data.thumbnailUrl,
              assetId: data.assetId,
              duration: data.duration,
              createdAt: data.createdAt,
              likes: data.likes || 0,
              comments: data.comments || 0,
              views: data.views || 0,
              isLiked: data.likedBy?.includes(currentUser?.uid) || false,
              isSaved: data.savedBy?.includes(currentUser?.uid) || false,
            });
          }
        });

        setVideos(videoList);
        setLoading(false);
      }, (error) => {
        console.error('Error loading videos:', error);
        setLoading(false);
        Alert.alert('Error', 'Failed to load videos. Please try again.');
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up video subscription:', error);
      setLoading(false);
    }
  }, [userId, currentUser?.uid]);

  const handleLike = async (videoId: string, currentlyLiked: boolean) => {
    if (!currentUser) {
      Alert.alert('Please Sign In', 'You need to sign in to like videos.');
      return;
    }

    try {
      const videoRef = doc(db, 'videos', videoId);
      
      if (currentlyLiked) {
        // Unlike
        await updateDoc(videoRef, {
          likes: increment(-1),
          likedBy: videos.find(v => v.id === videoId)?.likes || 0 > 1 
            ? videos.find(v => v.id === videoId)?.likes || [] 
            : []
        });
      } else {
        // Like
        await updateDoc(videoRef, {
          likes: increment(1)
        });
      }

      // Update local state
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { 
              ...video, 
              isLiked: !currentlyLiked,
              likes: currentlyLiked ? video.likes - 1 : video.likes + 1
            }
          : video
      ));

    } catch (error) {
      console.error('Error liking video:', error);
      Alert.alert('Error', 'Failed to like video. Please try again.');
    }
  };

  const handleSave = async (videoId: string, currentlySaved: boolean) => {
    if (!currentUser) {
      Alert.alert('Please Sign In', 'You need to sign in to save videos.');
      return;
    }

    try {
      const videoRef = doc(db, 'videos', videoId);
      
      // Update saved status (you'd implement this in your Firestore rules)
      console.log(`${currentlySaved ? 'Unsaving' : 'Saving'} video ${videoId}`);
      
      // Update local state
      setVideos(prev => prev.map(video => 
        video.id === videoId 
          ? { ...video, isSaved: !currentlySaved }
          : video
      ));

    } catch (error) {
      console.error('Error saving video:', error);
      Alert.alert('Error', 'Failed to save video. Please try again.');
    }
  };

  const handleShare = (video: VideoData) => {
    // Implement share functionality
    Alert.alert(
      'Share Video',
      `Share "${video.caption}" by ${video.username}`,
      [
        { text: 'Copy Link', onPress: () => console.log('Copy link') },
        { text: 'Share', onPress: () => console.log('Share video') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const incrementView = async (videoId: string) => {
    try {
      const videoRef = doc(db, 'videos', videoId);
      await updateDoc(videoRef, {
        views: increment(1)
      });
    } catch (error) {
      console.error('Error incrementing view:', error);
    }
  };

  const renderVideoItem = ({ item }: { item: VideoData }) => (
    <View style={styles.videoItem}>
      {/* Video Player */}
      <Video
        source={{ uri: item.streamingUrl || item.playbackUrl }}
        style={styles.videoPlayer}
        shouldPlay={false}
        isMuted={true}
        resizeMode={ResizeMode.COVER}
        onPlaybackStatusUpdate={(status: any) => {
          // Track when video starts playing for view counting
          if (status.isLoaded && status.shouldPlay && !status.positionMillis) {
            incrementView(item.id);
          }
        }}
      />

      {/* Video Overlay Info */}
      <View style={styles.videoOverlay}>
        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.userAvatar}>
            <MaterialIcons name="person" size={20} color="#6b7280" />
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.username}>{item.username}</Text>
            <Text style={styles.caption} numberOfLines={2}>
              {item.caption}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleLike(item.id, item.isLiked || false)}
          >
            <MaterialIcons 
              name={item.isLiked ? "favorite" : "favorite-border"} 
              size={24} 
              color={item.isLiked ? "#ef4444" : "white"} 
            />
            <Text style={styles.actionText}>{item.likes}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <MaterialIcons name="chat-bubble-outline" size={24} color="white" />
            <Text style={styles.actionText}>{item.comments}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleSave(item.id, item.isSaved || false)}
          >
            <MaterialIcons 
              name={item.isSaved ? "bookmark" : "bookmark-border"} 
              size={24} 
              color={item.isSaved ? "#fbbf24" : "white"} 
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleShare(item)}
          >
            <MaterialIcons name="share" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Video Stats */}
      <View style={styles.videoStats}>
        <View style={styles.statItem}>
          <MaterialIcons name="play-arrow" size={16} color="#6b7280" />
          <Text style={styles.statText}>{item.views} views</Text>
        </View>
        
        {item.duration && (
          <View style={styles.statItem}>
            <MaterialIcons name="schedule" size={16} color="#6b7280" />
            <Text style={styles.statText}>
              {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
            </Text>
          </View>
        )}

        <View style={styles.statItem}>
          <MaterialIcons name="hd" size={16} color="#6366f1" />
          <Text style={[styles.statText, { color: '#6366f1' }]}>Mux HD</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading videos...</Text>
      </View>
    );
  }

  if (videos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <MaterialIcons name="video-library" size={64} color="#d1d5db" />
        <Text style={styles.emptyTitle}>No Videos Yet</Text>
        <Text style={styles.emptySubtitle}>
          {userId ? 'This user hasn\'t uploaded any videos yet.' : 'Be the first to upload a video!'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={videos}
      renderItem={renderVideoItem}
      keyExtractor={(item) => item.id}
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#6366f1"
        />
      }
      initialNumToRender={3}
      maxToRenderPerBatch={5}
      windowSize={10}
      removeClippedSubviews={true}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  videoItem: {
    marginBottom: 24,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  videoPlayer: {
    width: '100%',
    aspectRatio: 9/16,
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  caption: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 16,
  },
  actionButtons: {
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontSize: 11,
    color: 'white',
    fontWeight: '500',
  },
  videoStats: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 16,
    backgroundColor: '#f9fafb',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
});
