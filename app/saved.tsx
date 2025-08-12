// app/saved.tsx - Enhanced Saved Videos Screen with API Integration

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
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
      } else {
        setLoading(true);
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

  // Render video item
  const renderVideoItem = ({ item }: { item: SavedVideo }) => (
    <View style={styles.videoItem}>
      <Pressable
        style={styles.videoContainer}
        onPress={() => handlePlayVideo(item)}
      >
        {/* Video Thumbnail */}
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
          
          {/* Play button overlay */}
          <View style={styles.playButtonOverlay}>
            <Ionicons name="play" size={24} color="white" />
          </View>
          
          {/* Duration if available */}
          {item.videoData?.duration && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>
                {formatDuration(item.videoData.duration)}
              </Text>
            </View>
          )}
        </View>

        {/* Video Info */}
        <View style={styles.videoInfo}>
          <Text style={styles.videoTitle} numberOfLines={2}>
            {item.videoData?.caption || item.videoData?.title || 'Saved Video'}
          </Text>
          
          <Text style={styles.videoMeta}>
            Saved {formatSaveDate(item.savedAt)}
          </Text>
        </View>
      </Pressable>

      {/* Remove button */}
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Saved Videos</Text>
        <Text style={styles.count}>{savedVideos.length}</Text>
      </View>

      {/* Content */}
      {savedVideos.length === 0 ? (
        // Empty state
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={80} color="#666" />
          <Text style={styles.emptyTitle}>No Saved Videos</Text>
          <Text style={styles.emptyDescription}>
            Start saving videos you love to see them here
          </Text>
        </View>
      ) : (
        // Video grid
        <FlatList
          data={savedVideos}
          renderItem={renderVideoItem}
          keyExtractor={(item) => item.savedId || item.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadSavedVideos(true)}
              tintColor="#007AFF"
            />
          }
          onEndReached={loadMoreVideos}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => 
            loadingMore ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

// Helper functions
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatSaveDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  count: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
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
  listContainer: {
    padding: 10,
  },
  videoItem: {
    width: itemWidth,
    marginHorizontal: 5,
    marginBottom: 15,
    position: 'relative',
  },
  videoContainer: {
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16/9,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20,
    marginLeft: -20,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyDescription: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  loadMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
