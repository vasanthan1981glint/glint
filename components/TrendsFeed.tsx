import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { db } from '../firebaseConfig';
import { formatCount } from '../utils/formatUtils';
import TrendsVideoPlayer from './TrendsVideoPlayer';

const screenWidth = Dimensions.get('window').width;

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

interface TrendsFeedProps {
  refreshKey?: number;
}

const TrendsFeed: React.FC<TrendsFeedProps> = ({ refreshKey }) => {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [playerVisible, setPlayerVisible] = useState(false);

  const VIDEOS_PER_PAGE = 10;

  // Load initial videos
  const loadVideos = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setLastDoc(null);
        setHasMore(true);
      } else {
        setLoading(true);
      }

      console.log('🔥 Loading trending videos...');

      // Priority order: Videos uploaded to Trends tab first, then other trending content
      // This ensures that when users upload to Trends, their content appears in the feed
      let videosQuery = query(
        collection(db, 'videos'),
        orderBy('createdAt', 'desc'),
        limit(VIDEOS_PER_PAGE)
      );

      // If loading more, start after the last document
      if (!isRefresh && lastDoc) {
        videosQuery = query(
          collection(db, 'videos'),
          orderBy('createdAt', 'desc'),
          startAfter(lastDoc),
          limit(VIDEOS_PER_PAGE)
        );
      }

      const snapshot = await getDocs(videosQuery);
      const newVideos: Video[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Prioritize videos uploaded specifically to Trends tab
        const isTrendingUpload = data.uploadTab === 'Trends';
        const isValidVideo = data.processed && data.status === 'ready' && (data.videoUrl || data.playbackUrl);
        
        console.log(`📹 Processing trending video: ${doc.id}`);
        console.log(`   - Upload Tab: ${data.uploadTab}`);
        console.log(`   - Content Type: ${data.contentType}`);
        console.log(`   - Processed: ${data.processed}`);
        console.log(`   - Status: ${data.status}`);
        console.log(`   - Has Video URL: ${!!(data.videoUrl || data.playbackUrl)}`);
        console.log(`   - Is Trending Upload: ${isTrendingUpload}`);
        console.log(`   - Is Valid Video: ${isValidVideo}`);
        
        // Include trending uploads and other quality videos
        if (isValidVideo && (isTrendingUpload || Math.random() > 0.3)) {
          console.log(`✅ INCLUDED in Trends: Video ${doc.id}`);
          newVideos.push({
            id: doc.id,
            userId: data.userId,
            username: data.username || 'Unknown User',
            caption: data.caption || 'No caption',
            thumbnailUrl: data.thumbnailUrl || 'https://via.placeholder.com/300x200.png?text=Video+Thumbnail',
            videoUrl: data.playbackUrl || data.videoUrl,
            playbackUrl: data.playbackUrl || data.videoUrl,
            views: data.views || 0,
            likes: data.likes || 0,
            createdAt: data.createdAt,
            processed: data.processed,
            status: data.status,
            uploadTab: data.uploadTab,
            contentType: data.contentType,
          });
        } else {
          console.log(`🚫 EXCLUDED from Trends: Video ${doc.id} - Not valid or not selected`);
        }
      });

      // Sort to prioritize Trends uploads at the top
      newVideos.sort((a, b) => {
        const aIsTrending = a.uploadTab === 'Trends';
        const bIsTrending = b.uploadTab === 'Trends';
        
        if (aIsTrending && !bIsTrending) return -1;
        if (!aIsTrending && bIsTrending) return 1;
        
        // If both are trending or both are not, sort by date
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      console.log(`🔥 Loaded ${newVideos.length} trending videos`);
      console.log(`📈 ${newVideos.filter(v => v.uploadTab === 'Trends').length} videos uploaded to Trends`);
      console.log(`🎬 ${newVideos.filter(v => v.uploadTab !== 'Trends').length} other trending videos`);

      // Update state
      if (isRefresh) {
        setVideos(newVideos);
      } else {
        setVideos(prev => [...prev, ...newVideos]);
      }

      // Set last document for pagination
      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }

      // Check if there are more videos
      setHasMore(snapshot.docs.length === VIDEOS_PER_PAGE);

    } catch (error) {
      console.error('❌ Error loading trending videos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [lastDoc]);

  // Load more videos when reaching the end
  const loadMoreVideos = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    
    setLoadingMore(true);
    await loadVideos(false);
  }, [loadVideos, loadingMore, hasMore, lastDoc]);

  // Refresh videos
  const onRefresh = useCallback(() => {
    loadVideos(true);
  }, [loadVideos]);

  // Initial load and refresh when refreshKey changes
  useEffect(() => {
    loadVideos(true);
  }, [refreshKey]);

  // Navigate to video player
  const handleVideoPress = (video: Video) => {
    console.log('🎬 Opening video:', video.id);
    setSelectedVideo(video);
    setPlayerVisible(true);
  };

  // Close video player
  const handleClosePlayer = () => {
    setPlayerVisible(false);
    setSelectedVideo(null);
  };

  // Navigate to user profile
  const handleUserPress = (userId: string) => {
    router.push({
      pathname: '/(tabs)/me',
      params: { userId }
    });
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
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
  };

  // Render video item in YouTube-style list format
  const renderVideoItem = ({ item }: { item: Video }) => (
    <TouchableOpacity 
      style={styles.videoItem} 
      onPress={() => handleVideoPress(item)}
      activeOpacity={0.7}
    >
      {/* Left side: Thumbnail */}
      <View style={styles.thumbnailContainer}>
        <Image 
          source={{ uri: item.thumbnailUrl }} 
          style={styles.thumbnail}
          resizeMode="cover"
        />
      </View>
      
      {/* Right side: Video info */}
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>
          {item.caption || 'Untitled Video'}
        </Text>
        
        <Text style={styles.channelName} numberOfLines={1}>
          @{item.username}
        </Text>
        
        <View style={styles.videoStats}>
          <Text style={styles.statsText}>
            {formatCount(item.views)} views
          </Text>
          <Text style={styles.statsDot}>•</Text>
          <Text style={styles.statsText}>
            {formatTimeAgo(item.createdAt)}
          </Text>
        </View>
      </View>
      
      {/* Right side: Options menu */}
      <TouchableOpacity style={styles.optionsButton}>
        <Ionicons name="ellipsis-vertical" size={16} color="#666" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Render footer
  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>Loading more videos...</Text>
      </View>
    );
  };

  // Render empty state
  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading trending videos...</Text>
        </View>
      );
    }

    return (
      <View style={styles.centered}>
        <Ionicons name="trending-up" size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>No Trending Videos</Text>
        <Text style={styles.emptySubtitle}>
          Be the first to upload and start the trend!
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
            colors={['#007AFF']}
          />
        }
        onEndReached={loadMoreVideos}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={videos.length === 0 ? styles.emptyContainer : styles.listContainer}
      />
      
      {/* Trends Video Player Modal */}
      {selectedVideo && (
        <TrendsVideoPlayer
          visible={playerVisible}
          video={selectedVideo}
          onClose={handleClosePlayer}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContainer: {
    paddingTop: 8,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  // YouTube-style horizontal video item
  videoItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'flex-start',
    backgroundColor: '#fff',
  },
  // Left side thumbnail (YouTube-style)
  thumbnailContainer: {
    position: 'relative',
    width: 160,
    height: 90,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  // Right side video info
  videoInfo: {
    flex: 1,
    paddingTop: 2,
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#0f0f0f',
    lineHeight: 20,
    marginBottom: 4,
  },
  channelName: {
    fontSize: 12,
    color: '#606060',
    marginBottom: 4,
    fontWeight: '400',
  },
  videoStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statsText: {
    fontSize: 12,
    color: '#606060',
  },
  statsDot: {
    fontSize: 12,
    color: '#606060',
    marginHorizontal: 4,
  },
  // Right side options button
  optionsButton: {
    padding: 8,
    marginLeft: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default TrendsFeed;
