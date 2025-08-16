// app/saved.tsx - Enhanced Saved Videos Screen with API Integration

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { enhancedSaveService, SavedVideo } from '../lib/enhancedSaveService';

const { width } = Dimensions.get('window');
const itemWidth = width / 2 - 15;

export default function SavedScreen() {
  const router = useRouter();
  const { userProfile } = useAuth();
  const [savedVideos, setSavedVideos] = useState<SavedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Load saved videos
  const loadSavedVideos = useCallback(async (refresh = false) => {
    if (!userProfile?.uid) return;

    try {
      if (refresh) {
        setRefreshing(true);
      }

      const response = await enhancedSaveService.getSavedVideos(20, 0);
      setSavedVideos(response.savedVideos);
      setHasMore(response.hasMore);

      console.log(`✅ Loaded ${response.savedVideos.length} saved videos`);
    } catch (error) {
      console.error('Failed to load saved videos:', error);
      Alert.alert('Error', 'Failed to load saved videos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userProfile?.uid]);

  // Load more videos (pagination)
  const loadMoreVideos = useCallback(async () => {
    if (!hasMore || loadingMore || !userProfile?.uid) return;

    try {
      setLoadingMore(true);
      const response = await enhancedSaveService.getSavedVideos(20, savedVideos.length);
      
      setSavedVideos(prev => [...prev, ...response.savedVideos]);
      setHasMore(response.hasMore);

      console.log(`✅ Loaded ${response.savedVideos.length} more saved videos`);
    } catch (error) {
      console.error('Failed to load more saved videos:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, userProfile?.uid, savedVideos.length]);

  // Remove from saved
  const handleRemoveSave = useCallback(async (videoId: string, savedId: string) => {
    try {
      await enhancedSaveService.removeSave(videoId);
      
      // Remove from local state
      setSavedVideos(prev => prev.filter(video => video.savedId !== savedId));
      
      Alert.alert('Removed', 'Video removed from saved list');
    } catch (error) {
      console.error('Failed to remove save:', error);
      Alert.alert('Error', 'Failed to remove video from saved list');
    }
  }, []);

  // Open video player
  const handlePlayVideo = useCallback((video: SavedVideo) => {
    // For now, just show an alert. You can implement navigation to video player
    Alert.alert('Play Video', `Playing: ${video.videoData?.caption || 'Saved Video'}`);
  }, []);

  // Load videos when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadSavedVideos();
    }, [loadSavedVideos])
  );

  // Format save date
  const formatSaveDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours}h ago`;
      if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
      return `${Math.floor(diffInHours / 168)}w ago`;
    } catch {
      return 'Recently';
    }
  };

  // Render video item
  const renderVideoItem = ({ item }: { item: SavedVideo }) => (
    <View style={styles.videoItem}>
      <Pressable
        style={styles.videoContainer}
        onPress={() => handlePlayVideo(item)}
      >
        <View style={styles.thumbnailContainer}>
          {item.videoData?.thumbnail ? (
            <Image 
              source={{ uri: item.videoData.thumbnail }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumbnail, styles.placeholderThumbnail]}>
              <Ionicons name="videocam" size={40} color="#666" />
            </View>
          )}
          
          <View style={styles.playButtonOverlay}>
            <Ionicons name="play" size={24} color="white" />
          </View>
        </View>

        <View style={styles.videoInfo}>
          <Text style={styles.videoTitle} numberOfLines={2}>
            {item.videoData?.caption || item.videoData?.title || 'Saved Video'}
          </Text>
          
          <Text style={styles.videoMeta}>
            Saved {formatSaveDate(item.savedAt)}
          </Text>
        </View>
      </Pressable>

      <Pressable
        style={styles.removeButton}
        onPress={() => {
          Alert.alert(
            'Remove from Saved',
            'Are you sure you want to remove this video from your saved list?',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Remove', 
                style: 'destructive',
                onPress: () => handleRemoveSave(item.videoId, item.savedId!)
              }
            ]
          );
        }}
      >
        <Ionicons name="close-circle" size={20} color="#FF3B30" />
      </Pressable>
    </View>
  );

  // Loading state
  if (loading && savedVideos.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.title}>Saved Videos</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading saved videos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state
  if (!loading && savedVideos.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.title}>Saved Videos</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={64} color="#666" />
          <Text style={styles.emptyTitle}>No saved videos</Text>
          <Text style={styles.emptySubtitle}>
            Videos you save will appear here
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Saved Videos</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={savedVideos}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item.savedId || item.videoId}
        numColumns={2}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadSavedVideos(true)}
            tintColor="#007AFF"
          />
        }
        onEndReached={loadMoreVideos}
        onEndReachedThreshold={0.1}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#007AFF" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  grid: {
    padding: 10,
  },
  videoItem: {
    width: itemWidth,
    marginHorizontal: 5,
    marginBottom: 20,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    overflow: 'hidden',
  },
  videoContainer: {
    position: 'relative',
  },
  thumbnailContainer: {
    width: '100%',
    height: itemWidth * 1.2,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
  },
  placeholderThumbnail: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoInfo: {
    padding: 12,
  },
  videoTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  videoMeta: {
    color: '#999',
    fontSize: 12,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
