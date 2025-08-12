import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../firebaseConfig';
import { savedVideosService } from '../lib/savedVideosService';
import { videoDeleteService } from '../lib/videoDeleteService';
import SmartThumbnail from './SmartThumbnail';
import { VerticalVideoPlayer } from './VerticalVideoPlayer';
import VideoOptionsModal from './VideoOptionsModal';
import ViewCountDisplay from './ViewCountDisplay';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface EnhancedVideoGridProps {
  refreshTrigger?: number;
  onVideoPress?: (video: VideoData) => void;
  userId?: string; // Optional userId to show specific user's videos
}

interface VideoData {
  assetId: string;
  playbackUrl: string;
  thumbnailUrl: string;
  username: string;
  userId: string;
  views?: number;
  createdAt: string;
  caption?: string;
  thumbnailType?: string;
  thumbnailGenerated?: string;
  hasCustomThumbnail?: boolean;
  hasThumbnail?: boolean;
  isDeleting?: boolean;
}

const EnhancedVideoGrid: React.FC<EnhancedVideoGridProps> = ({ refreshTrigger, onVideoPress, userId }) => {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number>(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showVideoOptionsModal, setShowVideoOptionsModal] = useState(false);
  const [selectedVideoForOptions, setSelectedVideoForOptions] = useState<VideoData | null>(null);
  const [isCurrentUserOwner, setIsCurrentUserOwner] = useState(false);
  const [saved, setSaved] = useState<{ [key: string]: boolean }>({});

  // Determine which user's videos to fetch
  const targetUserId = userId || user?.uid;

  useEffect(() => {
    if (targetUserId) {
      loadUserVideos();
    }
  }, [targetUserId]);

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      console.log('🔄 Refreshing glint grid with trigger:', refreshTrigger);
      console.log('👤 Target user ID:', targetUserId);
      console.log('📊 Current videos count:', videos.length);
      loadUserVideos();
    }
  }, [refreshTrigger]);

  // Real-time thumbnail updates listener
  useEffect(() => {
    if (!targetUserId) return;

    console.log('🎬 Setting up real-time thumbnail listener');
    
    // Function to check for thumbnail updates
    const checkThumbnailUpdates = async () => {
      try {
        // Get current videos without dependency issues
        const currentVideos = videos;
        
        // Only update if we have videos loaded
        if (currentVideos.length === 0) {
          console.log('📋 No videos loaded yet, skipping thumbnail check');
          return;
        }

        console.log(`🔍 Checking thumbnails for ${currentVideos.length} videos`);
        
        // Check for thumbnail updates on ALL videos
        let hasUpdates = false;

        const updatedVideos = await Promise.all(
          currentVideos.map(async (video) => {
            // Check Firebase for updated thumbnail on ALL videos
            try {
              const videosQuery = query(
                collection(db, 'videos'),
                where('assetId', '==', video.assetId)
              );
              
              const snapshot = await getDocs(videosQuery);
              if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const data = doc.data();
                
                // If we found a Firebase thumbnail URL and it's different from current
                if (data.thumbnailUrl && 
                    data.thumbnailUrl.includes('firebasestorage.googleapis.com') &&
                    data.thumbnailUrl !== video.thumbnailUrl) {
                  
                  console.log(`🆕 Found updated thumbnail for ${video.assetId}:`);
                  console.log(`   Old: ${video.thumbnailUrl?.substring(0, 50)}...`);
                  console.log(`   New: ${data.thumbnailUrl}`);
                  hasUpdates = true;
                  return { ...video, thumbnailUrl: data.thumbnailUrl };
                }
              }
            } catch (error) {
              console.warn(`⚠️ Error checking thumbnail update for ${video.assetId}:`, error);
            }

            return video;
          })
        );

        // Update state if we found new thumbnails
        if (hasUpdates) {
          console.log('✅ Updating glint grid with new thumbnails');
          setVideos(updatedVideos);
        } else {
          console.log('📋 No thumbnail updates found');
        }

      } catch (error) {
        console.warn('⚠️ Error in thumbnail update check:', error);
      }
    };

    // Run immediately on mount
    console.log('🚀 Running initial thumbnail check');
    checkThumbnailUpdates();
    
    // Poll for thumbnail updates every 3 seconds
    const thumbnailUpdateInterval = setInterval(() => {
      console.log('⏰ Running scheduled thumbnail check');
      checkThumbnailUpdates();
    }, 3000);

    // Cleanup interval on unmount
    return () => {
      console.log('🧹 Cleaning up thumbnail update listener');
      clearInterval(thumbnailUpdateInterval);
    };
  }, [targetUserId]); // Removed videos.length dependency

    const handleOptionsPress = async (video: VideoData) => {
    setSelectedVideoForOptions(video);
    try {
      // Check if current user is the video owner
      const currentUser = auth?.currentUser;
      const isOwner = currentUser && video.userId === currentUser.uid;
      setIsCurrentUserOwner(isOwner || false);
    } catch (error) {
      console.error('Error checking video ownership:', error);
      setIsCurrentUserOwner(false);
    }
    setShowVideoOptionsModal(true);
  };

  const handleVideoDelete = async (videoId: string) => {
    try {
      // Show loading state immediately
      setVideos(prevVideos => 
        prevVideos.map(video => 
          video.assetId === videoId 
            ? { ...video, isDeleting: true } 
            : video
        )
      );

      await videoDeleteService.deleteVideo(videoId);
      
      // Remove video from current list immediately
      setVideos(prevVideos => prevVideos.filter(video => video.assetId !== videoId));
      
      // Close modal and reset states
      setShowVideoOptionsModal(false);
      setSelectedVideoForOptions(null);
      setIsCurrentUserOwner(false);
      
      console.log(`✅ Video ${videoId} removed from UI`);
      Alert.alert('Success', 'Video deleted successfully');
    } catch (error) {
      console.error('Error deleting video:', error);
      
      // Remove loading state on error
      setVideos(prevVideos => 
        prevVideos.map(video => 
          video.assetId === videoId 
            ? { ...video, isDeleting: false } 
            : video
        )
      );
      
      Alert.alert('Error', 'Failed to delete video. Please try again.');
    }
  };

  const loadUserVideos = async (loadMore = false) => {
    if (!targetUserId) return;

    try {
      if (!loadMore) {
        setLoading(true);
      }
      
      console.log('🎬 Loading videos for user:', targetUserId);
      console.log('📋 Load more:', loadMore);
      console.log('📊 Current videos count:', videos.length);

      // Unlimited scroll - load many videos for the target user
      // TEMPORARY FIX: Remove processed filter to avoid composite index requirement
      const videosQuery = query(
        collection(db, 'videos'),
        where('userId', '==', targetUserId),
        // where('processed', '==', true), // Temporarily commented out to avoid index requirement
        limit(loadMore ? videos.length + 50 : 200)
      );

      console.log('🔍 Executing Firebase query for user videos...');
      const querySnapshot = await getDocs(videosQuery);
      console.log('📄 Firebase query returned', querySnapshot.size, 'documents');
      
      const videoList: VideoData[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        console.log('📹 Processing video document:', doc.id);
        console.log('   - Asset ID:', data.assetId);
        console.log('   - User ID:', data.userId);
        console.log('   - Processed:', data.processed);
        console.log('   - Status:', data.status);
        console.log('   - Playback URL:', data.playbackUrl?.substring(0, 50) + '...');
        console.log('   - Thumbnail URL:', data.thumbnailUrl?.substring(0, 50) + '...');
        
        // FIXED: Only include videos with valid playback URLs to prevent broken videos
        if (!data.playbackUrl || data.playbackUrl.trim() === '') {
          console.log(`⚠️ Skipping video ${doc.id} - no valid playback URL`);
          return;
        }
        
        const videoData = {
          assetId: data.assetId || doc.id,
          playbackUrl: data.playbackUrl || '',
          thumbnailUrl: data.thumbnailUrl || '',
          username: data.username || 'User',
          userId: data.userId,
          views: data.views || 0,
          createdAt: data.createdAt || new Date().toISOString(),
          caption: data.caption || '',
          thumbnailType: data.thumbnailType,
          thumbnailGenerated: data.thumbnailGenerated,
          hasCustomThumbnail: data.hasCustomThumbnail || false,
          hasThumbnail: data.hasThumbnail || !!data.thumbnailUrl,
        };
        
        // Debug thumbnail URLs
        console.log(`🖼️ Video ${videoData.assetId} thumbnail:`, videoData.thumbnailUrl);
        console.log(`📊 Video ${videoData.assetId} thumbnail type:`, videoData.thumbnailType);
        console.log(`🔍 Video ${videoData.assetId} has thumbnail:`, videoData.hasThumbnail);
        console.log(`🔥 Video ${videoData.assetId} is Firebase thumbnail:`, data.thumbnailUrl?.includes('firebasestorage.googleapis.com'));
        
        videoList.push(videoData);
      });

      console.log('✅ Processed', videoList.length, 'valid videos');

      // Sort newest first - new uploads appear at top
      videoList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      console.log('📅 Videos sorted by creation date (newest first)');

      // Generate thumbnails if needed or if current ones are invalid
      const enhancedVideos = await Promise.all(
        videoList.map(async (video) => {
          let thumbnailUrl = video.thumbnailUrl;
          
          // Check if thumbnail URL is missing, empty, or potentially invalid
          const isFirebaseThumbnail = thumbnailUrl?.includes('firebasestorage.googleapis.com');
          const isValidSvgThumbnail = thumbnailUrl?.startsWith('data:image/svg+xml');
          const isValidPlaceholder = thumbnailUrl?.includes('via.placeholder.com');
          
          const needsNewThumbnail = !thumbnailUrl || 
                                  thumbnailUrl === '' || 
                                  (thumbnailUrl.startsWith('file://') && !isFirebaseThumbnail) ||
                                  (thumbnailUrl.startsWith('content://') && !isFirebaseThumbnail) ||
                                  (!isFirebaseThumbnail && !isValidSvgThumbnail && !isValidPlaceholder);
          
          // If we have a Firebase thumbnail, use it directly
          if (isFirebaseThumbnail) {
            console.log(`✅ Using Firebase thumbnail for video ${video.assetId}: ${thumbnailUrl}`);
            return { ...video, thumbnailUrl };
          }
          
          // If we have a valid SVG or placeholder, use it
          if (isValidSvgThumbnail || isValidPlaceholder) {
            console.log(`✅ Using existing thumbnail for video ${video.assetId}: ${thumbnailUrl.substring(0, 50)}...`);
            return { ...video, thumbnailUrl };
          }
          
          if (needsNewThumbnail) {
            console.log(`🔄 Generating simple thumbnail for video ${video.assetId}`);
            
            const timeStamp = new Date(video.createdAt).getTime();
            const colors = ['FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7', 'DDA0DD'];
            const icons = ['🎬', '💎', '⚡', '🌟', '🔮', '🎪'];
            const colorIndex = Math.abs(timeStamp) % colors.length;
            const iconIndex = Math.abs(timeStamp) % icons.length;
            
            // Use a very simple SVG that React Native can handle
            const svgContent = `<svg width="640" height="360" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#${colors[colorIndex]}"/><text x="320" y="180" text-anchor="middle" font-family="Arial" font-size="48" fill="white">${icons[iconIndex]}</text><text x="320" y="220" text-anchor="middle" font-family="Arial" font-size="16" fill="white">Glint Video</text></svg>`;
            
            thumbnailUrl = `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
            console.log(`✅ Generated simple thumbnail for video ${video.assetId}`);
          }
          
          return { ...video, thumbnailUrl };
        })
      );

      setVideos(enhancedVideos);
      console.log(`✅ Final result: Loaded ${enhancedVideos.length} enhanced videos for user ${targetUserId}`);
      console.log('📋 Video asset IDs:', enhancedVideos.map(v => v.assetId));

      // Load saved status for each video if user is authenticated
      if (auth.currentUser && enhancedVideos.length > 0) {
        enhancedVideos.forEach(async (video) => {
          try {
            const isSaved = await savedVideosService.isVideoSaved(video.assetId);
            setSaved((prev) => ({
              ...prev,
              [video.assetId]: isSaved,
            }));
          } catch (error) {
            console.error('Error checking saved status for', video.assetId, error);
          }
        });
      }

    } catch (error) {
      console.error('❌ Error loading glints:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  // Save video functionality
  const toggleSave = async (videoId: string) => {
    if (!auth.currentUser) {
      Alert.alert('Sign In Required', 'Please sign in to save videos');
      return;
    }

    try {
      // Instantly update UI for fast feedback
      const wasSaved = saved[videoId];
      setSaved((prev) => ({ ...prev, [videoId]: !prev[videoId] }));

      // Backend sync
      const newSaveStatus = await savedVideosService.toggleSaveVideo(videoId);
      
      // Update UI with actual result from backend
      setSaved((prev) => ({ ...prev, [videoId]: newSaveStatus }));

      // Show success message
      Alert.alert(
        newSaveStatus ? 'Saved' : 'Removed', 
        newSaveStatus ? 'Video saved to your collection' : 'Video removed from saved'
      );
    } catch (error) {
      // Revert UI if failed
      setSaved((prev) => ({ ...prev, [videoId]: saved[videoId] }));
      Alert.alert('Error', 'Failed to save video. Please try again.');
      console.error('Save error:', error);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && videos.length >= 50) {
      setLoadingMore(true);
      loadUserVideos(true);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUserVideos();
  }, []);

  const handleVideoPress = (video: VideoData, index: number) => {
    if (onVideoPress) {
      onVideoPress(video);
    } else {
      setSelectedVideo(video);
      setSelectedVideoIndex(index);
    }
  };

  const navigateToNextVideo = () => {
    const nextIndex = selectedVideoIndex + 1;
    if (nextIndex < videos.length) {
      setSelectedVideoIndex(nextIndex);
      setSelectedVideo(videos[nextIndex]);
    }
  };

  const navigateToPreviousVideo = () => {
    const prevIndex = selectedVideoIndex - 1;
    if (prevIndex >= 0) {
      setSelectedVideoIndex(prevIndex);
      setSelectedVideo(videos[prevIndex]);
    }
  };

  const renderVideoItem = ({ item, index }: { item: VideoData; index: number }) => {
    // Safety check for item
    if (!item || !item.assetId) {
      console.warn('Invalid video item:', item);
      return <View style={{ width: screenWidth / 3, height: screenWidth / 3 * 1.4 }} />;
    }

    // Perfect fit - no spacing between videos
    const itemWidth = screenWidth / 3;
    const itemHeight = itemWidth * 1.4;

    return (
      <TouchableOpacity
        style={[styles.videoItem, { width: itemWidth, height: itemHeight }]}
        onPress={() => !item.isDeleting && handleVideoPress(item, index)}
        activeOpacity={item.isDeleting ? 1 : 0.9}
        disabled={item.isDeleting}
      >
        <SmartThumbnail
          videoUrl={item.playbackUrl}
          thumbnailUrl={item.thumbnailUrl}
          style={styles.thumbnailImage}
          onLoad={() => {
            console.log(`✅ Thumbnail loaded successfully for video ${item.assetId}`);
          }}
          onError={(error) => {
            console.warn(`❌ Thumbnail failed to load for video ${item.assetId}:`, error);
            console.warn(`🔗 Failed thumbnail URL:`, item.thumbnailUrl);
          }}
        />
        
        {/* View Count */}
        <View style={styles.viewCountOverlay}>
          <ViewCountDisplay 
            videoId={item.assetId}
            style={styles.viewCountText}
            suffix=""
          />
        </View>

        {/* Save Button - Show for videos not owned by current user */}
        {user?.uid !== item.userId && auth.currentUser && (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={(e) => {
              e.stopPropagation();
              toggleSave(item.assetId);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={saved[item.assetId] ? "bookmark" : "bookmark-outline"}
              size={16}
              color={saved[item.assetId] ? "#007AFF" : "#fff"}
            />
          </TouchableOpacity>
        )}

        {/* Options Button - Only show if current user is video owner */}
        {user?.uid === item.userId && (
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={(e) => {
              e.stopPropagation();
              handleOptionsPress(item);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.optionsButtonText}>⋯</Text>
          </TouchableOpacity>
        )}

        {/* Deleting Overlay */}
        {item.isDeleting && (
          <View style={styles.deletingOverlay}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.deletingText}>Deleting...</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading glints...</Text>
      </View>
    );
  }

  if (videos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>✨</Text>
        <Text style={styles.emptyTitle}>No glints yet</Text>
        <Text style={styles.emptySubtitle}>
          Upload unlimited glints - they'll appear here instantly with newest first!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={(item) => String(item.assetId || Math.random())}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#007AFF']}
            tintColor="#007AFF"
          />
        }
        contentContainerStyle={styles.gridContainer}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? (
          <View style={styles.loadingMoreContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.loadingMoreText}>Loading more...</Text>
          </View>
        ) : null}
      />

      {/* Full Screen Video Modal */}
      <Modal
        visible={selectedVideo !== null}
        animationType="fade"
        onRequestClose={() => setSelectedVideo(null)}
        presentationStyle="fullScreen"
      >
        {selectedVideo && (
          <VerticalVideoPlayer
            videos={videos}
            initialVideoIndex={selectedVideoIndex}
            onClose={() => setSelectedVideo(null)}
            showCloseButton={true}
          />
        )}
      </Modal>

      {/* Video Options Modal */}
      <VideoOptionsModal
        visible={showVideoOptionsModal}
        onClose={() => {
          setShowVideoOptionsModal(false);
          setSelectedVideoForOptions(null);
          setIsCurrentUserOwner(false);
        }}
        videoId={selectedVideoForOptions?.assetId || ''}
        videoTitle={selectedVideoForOptions?.caption}
        isOwner={isCurrentUserOwner}
        onVideoDeleted={handleVideoDelete}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    color: '#000000',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#000000',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#888888',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  gridContainer: {
    paddingBottom: 100,
  },
  videoItem: {
    position: 'relative',
    backgroundColor: '#E5E5E5',
    margin: 0, // No spacing between videos
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E5E5',
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  playIconText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 1,
  },
  viewCountOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  viewCountText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '500',
  },
  saveButton: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  deletingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deletingText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingMoreText: {
    marginLeft: 8,
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default EnhancedVideoGrid;