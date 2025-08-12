import { collection, getDocs, limit, query, startAfter, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebaseConfig';
import { FullScreenVideoPlayer } from './FullScreenVideoPlayer';

const { width: screenWidth } = Dimensions.get('window');
const videoWidth = (screenWidth - 32) / 3; // 3 columns with padding

interface VideoListScreenProps {
  refreshTrigger?: number;
  onVideoPress?: (video: VideoData) => void;
}

interface VideoData {
  assetId: string;
  playbackUrl: string;
  thumbnailUrl: string;
  username: string;
  userId: string;
  views?: number;
  createdAt: string;
}

const VideoListScreen: React.FC<VideoListScreenProps> = ({ refreshTrigger, onVideoPress }) => {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<any>(null);

  const VIDEOS_PER_PAGE = 12; // 4 rows of 3 videos each

  useEffect(() => {
    loadUserVideos(true);
  }, [user]);

  // Additional effect to handle external refresh triggers
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      console.log('🔄 External refresh trigger activated:', refreshTrigger);
      loadUserVideos(true);
    }
  }, [refreshTrigger]);

  const loadUserVideos = async (isRefresh = false) => {
    if (!user) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
        setLastVisible(null);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      // Build query without orderBy to avoid composite index requirement
      let videosQuery = query(
        collection(db, 'videos'),
        where('userId', '==', user.uid),
        limit(VIDEOS_PER_PAGE)
      );

      // If loading more, start after the last document
      if (!isRefresh && lastVisible) {
        videosQuery = query(
          collection(db, 'videos'),
          where('userId', '==', user.uid),
          startAfter(lastVisible),
          limit(VIDEOS_PER_PAGE)
        );
      }

      const querySnapshot = await getDocs(videosQuery);
      const videoList: VideoData[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        videoList.push({
          assetId: data.assetId || doc.id,
          playbackUrl: data.playbackUrl || '',
          thumbnailUrl: data.thumbnailUrl || 'https://via.placeholder.com/320x180',
          username: data.username || 'User',
          userId: data.userId,
          views: data.views || 0,
          createdAt: data.createdAt || new Date().toISOString(),
        });
      });

      // Sort by createdAt in JavaScript (most recent first)
      videoList.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      // Update state
      if (isRefresh) {
        setVideos(videoList);
      } else {
        setVideos(prev => [...prev, ...videoList]);
      }

      // Update pagination state
      if (querySnapshot.docs.length > 0) {
        setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
      }
      
      // Check if there are more videos
      setHasMore(querySnapshot.docs.length === VIDEOS_PER_PAGE);

    } catch (error) {
      console.error('Error loading user videos:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    loadUserVideos(true);
  }, [user]);

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore && !refreshing) {
      loadUserVideos(false);
    }
  }, [loadingMore, hasMore, refreshing]);

  const handleVideoPress = useCallback((video: VideoData) => {
    // If external handler is provided, use it
    if (onVideoPress) {
      onVideoPress(video);
    } else {
      // Default behavior - open the internal full screen player
      setSelectedVideo(video);
    }
  }, [onVideoPress]);

  const renderVideoItem = ({ item }: { item: VideoData }) => (
    <TouchableOpacity
      style={styles.videoItem}
      onPress={() => handleVideoPress(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.thumbnailUrl }}
        style={styles.videoThumbnail}
        resizeMode="cover"
        loadingIndicatorSource={{ uri: 'https://via.placeholder.com/320x180/f0f0f0/cccccc?text=Loading...' }}
      />
      
      {/* Video play icon overlay */}
      <View style={styles.playIconContainer}>
        <View style={styles.playIcon}>
          <Text style={styles.playIconText}>▶</Text>
        </View>
      </View>

      {/* View count overlay */}
      <View style={styles.videoOverlay}>
        <Text style={styles.videoViews}>
          {item.views && item.views > 0 ? item.views.toLocaleString() : '0'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.footerText}>Loading more videos...</Text>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No videos yet</Text>
      <Text style={styles.emptySubtext}>Start creating to see your content here</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading your videos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item.assetId}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.videoGrid}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
            colors={['#007AFF']}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={!loading ? renderEmpty : null}
        maxToRenderPerBatch={12}
        windowSize={10}
        initialNumToRender={12}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({
          length: videoWidth * 1.2 + 16,
          offset: (videoWidth * 1.2 + 16) * Math.floor(index / 3),
          index,
        })}
      />

      {/* Full Screen Video Modal */}
      <Modal
        visible={!!selectedVideo}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
        transparent={false}
        onRequestClose={() => setSelectedVideo(null)}
      >
        {selectedVideo && (
          <FullScreenVideoPlayer
            videoData={selectedVideo}
            onClose={() => setSelectedVideo(null)}
          />
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  videoGrid: {
    padding: 16,
    flexGrow: 1,
  },
  row: {
    justifyContent: 'space-between',
  },
  videoItem: {
    width: videoWidth,
    height: videoWidth * 1.2, // 5:6 aspect ratio for mobile video
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1.0,
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  playIconContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    zIndex: 1,
  },
  playIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 2, // Adjust for visual centering
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoViews: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    width: '100%',
  },
  footerText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
});

export default VideoListScreen;
