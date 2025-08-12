import { collection, getDocs, limit, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { db } from '../firebaseConfig';
import { FullScreenVideoPlayer } from './FullScreenVideoPlayer';

const { width: screenWidth } = Dimensions.get('window');
const videoWidth = (screenWidth - 32) / 3; // 3 columns with padding

interface VideoData {
  assetId: string;
  playbackUrl: string;
  thumbnailUrl: string;
  username: string;
  userId: string;
  views?: number;
  createdAt: string;
}

interface GlintStyleVideoGridProps {
  videos?: VideoData[];
  onVideoPress?: (video: VideoData) => void;
  numColumns?: number;
  showEmpty?: boolean;
}

const GlintStyleVideoGrid: React.FC<GlintStyleVideoGridProps> = ({
  videos: propVideos,
  onVideoPress,
  numColumns = 3,
  showEmpty = true,
}) => {
  const [videos, setVideos] = useState<VideoData[]>(propVideos || []);
  const [loading, setLoading] = useState(!propVideos);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);

  const itemWidth = (screenWidth - 32) / numColumns;

  useEffect(() => {
    if (!propVideos) {
      loadAllVideos();
    }
  }, [propVideos]);

  const loadAllVideos = async () => {
    try {
      setLoading(true);
      // Simple query without orderBy to avoid index issues
      const videosQuery = query(
        collection(db, 'videos'),
        limit(30)
      );

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

      // Sort by createdAt in JavaScript instead of Firestore
      videoList.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // Most recent first
      });

      setVideos(videoList);
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoPress = (video: VideoData) => {
    if (onVideoPress) {
      onVideoPress(video);
    } else {
      setSelectedVideo(video);
    }
  };

  const renderVideoItem = ({ item }: { item: VideoData }) => (
    <TouchableOpacity
      style={[styles.videoItem, { width: itemWidth, height: itemWidth * 1.2 }]}
      onPress={() => handleVideoPress(item)}
    >
      <Image
        source={{ uri: item.thumbnailUrl }}
        style={styles.videoThumbnail}
        resizeMode="cover"
      />
      <View style={styles.videoOverlay}>
        <Text style={styles.videoViews}>
          {item.views?.toLocaleString() || 0}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading videos...</Text>
      </View>
    );
  }

  if (videos.length === 0 && showEmpty) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No videos found</Text>
        <Text style={styles.emptySubtext}>Check back later for new content</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item.assetId}
        numColumns={numColumns}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.videoGrid}
        columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
      />

      {selectedVideo && !onVideoPress && (
        <FullScreenVideoPlayer
          videoData={selectedVideo}
          onClose={() => setSelectedVideo(null)}
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
  },
  row: {
    justifyContent: 'space-between',
  },
  videoItem: {
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
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
});

export default GlintStyleVideoGrid;
