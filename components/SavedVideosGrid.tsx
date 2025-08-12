import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth, db } from '../firebaseConfig';
import { SavedVideo, savedVideosService } from '../lib/savedVideosService';
import { VerticalVideoPlayer } from './VerticalVideoPlayer';

const { width: screenWidth } = Dimensions.get('window');

interface SavedVideosGridProps {
  refreshTrigger?: number;
}

// VideoData interface compatible with VerticalVideoPlayer
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

interface SavedVideosGridProps {
  refreshTrigger?: number;
}

const SavedVideosGrid: React.FC<SavedVideosGridProps> = ({ refreshTrigger = 0 }) => {
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoData | null>(null);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number>(0);
  const [videoDataList, setVideoDataList] = useState<VideoData[]>([]);
  
  // Real-time stats state
  const [videoStats, setVideoStats] = useState<{ [videoId: string]: { views: number; likes: number } }>({});

  // Function to fetch real-time video stats
  const fetchVideoStats = async (videoId: string) => {
    try {
      const videoRef = doc(db, 'videos', videoId);
      const videoSnap = await getDoc(videoRef);
      
      if (videoSnap.exists()) {
        const data = videoSnap.data();
        const stats = {
          views: data.views || 0,
          likes: data.likes || 0
        };
        
        setVideoStats(prev => ({
          ...prev,
          [videoId]: stats
        }));
      }
    } catch (error) {
      console.error('Error fetching video stats:', error);
    }
  };

  // Fetch stats for all saved videos
  const fetchAllVideoStats = async (videos: SavedVideo[]) => {
    const promises = videos.map(video => fetchVideoStats(video.videoId));
    await Promise.all(promises);
  };

  useEffect(() => {
    loadSavedVideos();
  }, [refreshTrigger]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Set up real-time listener
    const unsubscribe = savedVideosService.onSavedVideosChange(user.uid, (videos) => {
      setSavedVideos(videos);
      
      // Fetch real-time stats for all videos
      fetchAllVideoStats(videos);
      
      // Convert saved videos to VideoData format for VerticalVideoPlayer
      const videoData: VideoData[] = videos
        .filter(sv => sv.videoData) // Only include videos with valid data
        .map(sv => ({
          assetId: sv.videoId,
          playbackUrl: sv.videoData.playbackUrl || '',
          thumbnailUrl: sv.videoData.thumbnailUrl || '',
          username: sv.videoData.username || 'Unknown',
          userId: sv.videoData.userId || '',
          views: sv.videoData.views || 0,
          createdAt: sv.videoData.createdAt || sv.savedAt,
          caption: sv.videoData.caption || '',
        }));
      
      setVideoDataList(videoData);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, []);

  const loadSavedVideos = async () => {
    try {
      setLoading(true);
      const videos = await savedVideosService.getSavedVideos();
      setSavedVideos(videos);
    } catch (error) {
      console.error('Error loading saved videos:', error);
      Alert.alert('Error', 'Failed to load saved videos');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadSavedVideos();
  };

  const handleUnsaveVideo = async (videoId: string, videoTitle?: string) => {
    Alert.alert(
      'Remove from Saved',
      `Remove "${videoTitle || 'this video'}" from your saved videos?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await savedVideosService.unsaveVideo(videoId);
            } catch (error) {
              Alert.alert('Error', 'Failed to remove video from saved');
            }
          },
        },
      ]
    );
  };

  const navigateToVideo = (video: SavedVideo, index: number) => {
    if (!video.videoData) {
      Alert.alert('Error', 'Video data not available');
      return;
    }

    // Convert SavedVideo to VideoData format
    const videoData: VideoData = {
      assetId: video.videoId,
      playbackUrl: video.videoData.playbackUrl || '',
      thumbnailUrl: video.videoData.thumbnailUrl || '',
      username: video.videoData.username || 'Unknown',
      userId: video.videoData.userId || '',
      views: video.videoData.views || 0,
      createdAt: video.videoData.createdAt || video.savedAt,
      caption: video.videoData.caption || '',
    };

    setSelectedVideo(videoData);
    setSelectedVideoIndex(index);
  };

  const renderVideoItem = ({ item, index }: { item: SavedVideo; index: number }) => {
    const video = item.videoData;
    if (!video) {
      return (
        <View style={styles.videoItem}>
          <View style={styles.unavailableVideo}>
            <Ionicons name="alert-circle" size={24} color="#666" />
            <Text style={styles.unavailableText}>Video unavailable</Text>
          </View>
          <TouchableOpacity
            style={styles.unsaveButton}
            onPress={() => handleUnsaveVideo(item.videoId)}
          >
            <Ionicons name="bookmark" size={16} color="#ff4444" />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <TouchableOpacity style={styles.videoItem} onPress={() => navigateToVideo(item, index)}>
        <View style={styles.videoContainer}>
          {video.thumbnailUrl ? (
            <Image source={{ uri: video.thumbnailUrl }} style={styles.thumbnail} />
          ) : (
            <View style={styles.placeholderThumbnail}>
              <Ionicons name="play" size={30} color="#fff" />
            </View>
          )}
          
          <TouchableOpacity
            style={styles.unsaveButton}
            onPress={(e) => {
              e.stopPropagation();
              handleUnsaveVideo(item.videoId, video.caption);
            }}
          >
            <Ionicons name="bookmark" size={16} color="#ff4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.videoInfo}>
          <Text style={styles.videoCaption} numberOfLines={2}>
            {video.caption || 'No caption'}
          </Text>
          <Text style={styles.videoUsername}>@{video.username || 'unknown'}</Text>
          <Text style={styles.savedDate}>
            Saved {new Date(item.savedAt).toLocaleDateString()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading saved videos...</Text>
      </View>
    );
  }

  if (savedVideos.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="bookmark-outline" size={64} color="#ccc" />
        <Text style={styles.emptyTitle}>No Saved Videos</Text>
        <Text style={styles.emptySubtitle}>
          Videos you save will appear here
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={savedVideos}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      {/* Full Screen Video Modal */}
      <Modal
        visible={selectedVideo !== null}
        animationType="fade"
        onRequestClose={() => setSelectedVideo(null)}
        presentationStyle="fullScreen"
      >
        {selectedVideo && videoDataList.length > 0 && (
          <VerticalVideoPlayer
            videos={videoDataList}
            initialVideoIndex={selectedVideoIndex}
            onClose={() => setSelectedVideo(null)}
            showCloseButton={true}
          />
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  gridContainer: {
    paddingBottom: 100,
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
  emptyTitle: {
    color: '#000000',
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#888888',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  videoItem: {
    position: 'relative',
    backgroundColor: '#E5E5E5',
    margin: 0,
    width: screenWidth / 2,
    height: (screenWidth / 2) * (16 / 9), // 16:9 aspect ratio
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
    height: '80%', // Leave space for caption
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E5E5',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
  },
  videoStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
  },
  unsaveButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    padding: 8,
  },
  videoInfo: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    height: '20%',
  },
  videoCaption: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  videoUsername: {
    color: '#666666',
    fontSize: 10,
    marginBottom: 2,
  },
  savedDate: {
    color: '#999999',
    fontSize: 9,
  },
  unavailableVideo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
    aspectRatio: 9 / 16,
  },
  unavailableText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
});

export default SavedVideosGrid;
