import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebaseConfig';
import { formatCount } from '../utils/formatUtils';

interface VideoAnalytics {
  videoId: string;
  title: string;
  views: number;
  totalWatchTime: number;
  uniqueViewers: number;
  createdAt: string;
}

interface AnalyticsDashboardProps {
  userId?: string;
  visible: boolean;
  onClose: () => void;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ 
  userId, 
  visible, 
  onClose 
}) => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<VideoAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalViews, setTotalViews] = useState(0);
  const [totalVideos, setTotalVideos] = useState(0);

  const targetUserId = userId || user?.uid;

  useEffect(() => {
    if (visible && targetUserId) {
      loadAnalytics();
    }
  }, [visible, targetUserId]);

  const loadAnalytics = async () => {
    if (!targetUserId) return;

    try {
      setLoading(true);
      console.log('📊 Loading analytics for user:', targetUserId);

      // Get all videos for this user
      const videosQuery = query(
        collection(db, 'videos'),
        where('userId', '==', targetUserId)
      );

      const videosSnapshot = await getDocs(videosQuery);
      const videoAnalytics: VideoAnalytics[] = [];
      let totalViewCount = 0;

      // Process each video
      for (const videoDoc of videosSnapshot.docs) {
        const videoData = videoDoc.data();
        const views = videoData.views || 0;
        totalViewCount += views;

        // Get view records for detailed analytics
        const viewsQuery = query(
          collection(db, 'views'),
          where('videoId', '==', videoDoc.id)
        );
        
        let uniqueViewers = 0;
        let totalWatchTime = 0;

        try {
          const viewsSnapshot = await getDocs(viewsQuery);
          const deviceFingerprints = new Set();
          
          viewsSnapshot.forEach((viewDoc) => {
            const viewData = viewDoc.data();
            totalWatchTime += viewData.watchTime || 0;
            
            if (viewData.deviceInfo) {
              deviceFingerprints.add(viewData.deviceInfo);
            }
          });
          
          uniqueViewers = deviceFingerprints.size;
        } catch (error) {
          console.warn('Failed to load detailed view analytics:', error);
        }

        videoAnalytics.push({
          videoId: videoDoc.id,
          title: videoData.caption || `Video ${videoDoc.id.substring(0, 8)}`,
          views,
          totalWatchTime,
          uniqueViewers,
          createdAt: videoData.createdAt || new Date().toISOString()
        });
      }

      // Sort by views (highest first)
      videoAnalytics.sort((a, b) => b.views - a.views);

      setAnalytics(videoAnalytics);
      setTotalViews(totalViewCount);
      setTotalVideos(videoAnalytics.length);

      console.log('✅ Analytics loaded:', {
        totalVideos: videoAnalytics.length,
        totalViews: totalViewCount
      });
    } catch (error) {
      console.error('❌ Error loading analytics:', error);
      Alert.alert('Error', 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Video Analytics</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {/* Summary Stats */}
          <View style={styles.summaryContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{formatCount(totalViews)}</Text>
              <Text style={styles.statLabel}>Total Views</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{totalVideos}</Text>
              <Text style={styles.statLabel}>Videos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {totalVideos > 0 ? formatCount(Math.round(totalViews / totalVideos)) : '0'}
              </Text>
              <Text style={styles.statLabel}>Avg Views</Text>
            </View>
          </View>

          {/* Video List */}
          <View style={styles.videoListContainer}>
            <Text style={styles.sectionTitle}>Video Performance</Text>
            
            {analytics.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No videos with analytics data yet</Text>
                <Text style={styles.emptySubtext}>Upload videos and get views to see analytics</Text>
              </View>
            ) : (
              analytics.map((video, index) => (
                <View key={video.videoId} style={styles.videoCard}>
                  <View style={styles.videoRank}>
                    <Text style={styles.rankText}>#{index + 1}</Text>
                  </View>
                  
                  <View style={styles.videoInfo}>
                    <Text style={styles.videoTitle} numberOfLines={2}>
                      {video.title}
                    </Text>
                    <Text style={styles.videoDate}>
                      {new Date(video.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  <View style={styles.videoStats}>
                    <View style={styles.statRow}>
                      <Ionicons name="eye" size={16} color="#666" />
                      <Text style={styles.statText}>{formatCount(video.views)}</Text>
                    </View>
                    
                    {video.uniqueViewers > 0 && (
                      <View style={styles.statRow}>
                        <Ionicons name="people" size={16} color="#666" />
                        <Text style={styles.statText}>{video.uniqueViewers}</Text>
                      </View>
                    )}
                    
                    {video.totalWatchTime > 0 && (
                      <View style={styles.statRow}>
                        <Ionicons name="time" size={16} color="#666" />
                        <Text style={styles.statText}>{formatDuration(video.totalWatchTime)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  videoListContainer: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  videoCard: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  videoRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  videoInfo: {
    flex: 1,
    marginRight: 12,
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    lineHeight: 18,
  },
  videoDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  videoStats: {
    alignItems: 'flex-end',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
});

export default AnalyticsDashboard;
