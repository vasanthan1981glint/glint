// Example integration of the Complete Short-Form Video System

import React from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ✅ Import our enhanced components
import ShortFormVideoPlayer from '../components/ShortFormVideoPlayer';
import { useNetworkMonitoring } from '../hooks/useNetworkMonitoring';
import { useVideoFeedAnalytics } from '../hooks/useVideoFeedAnalytics';
import { useDeviceCompatibility } from '../utils/DeviceCompatibilityTester';

interface ExampleVideoFeedProps {
  videos: any[];
  userId?: string;
}

export const ExampleVideoFeed: React.FC<ExampleVideoFeedProps> = ({ 
  videos, 
  userId 
}) => {
  const insets = useSafeAreaInsets();
  
  // ✅ 19. Analytics Events - Comprehensive tracking
  const analytics = useVideoFeedAnalytics({ 
    userId, 
    enabled: true 
  });
  
  // ✅ 2. Adaptive Quality Selection - Network monitoring
  const { 
    networkStatus, 
    getRecommendedVideoQuality,
    shouldPreloadVideos,
    shouldAutoPlay 
  } = useNetworkMonitoring();
  
  // ✅ 20. Device Compatibility - Universal support
  const { 
    deviceInfo, 
    layoutConfig, 
    compatibilityReport 
  } = useDeviceCompatibility();
  
  // Log device compatibility report for debugging
  React.useEffect(() => {
    if (__DEV__) {
      console.log('🛠️ Device Compatibility Report:', compatibilityReport);
      console.log('📊 Recommended Quality:', getRecommendedVideoQuality());
      console.log('⚙️ Layout Config:', layoutConfig);
    }
  }, [compatibilityReport, getRecommendedVideoQuality, layoutConfig]);
  
  // ✅ Handle video navigation with analytics
  const handleVideoChange = (index: number) => {
    console.log(`🎬 Video changed to index: ${index}`);
    
    // Stop tracking previous video
    analytics.stopWatching();
    
    // Start tracking new video
    if (videos[index]) {
      analytics.startWatching(videos[index].assetId, 30); // 30 second duration estimate
    }
  };
  
  // ✅ 19. Analytics Events - Track interactions
  const handleLike = (videoId: string) => {
    console.log(`❤️ Liked video: ${videoId}`);
    analytics.trackInteraction(videoId, 'like', true);
  };
  
  const handleComment = (videoId: string) => {
    console.log(`💬 Comment on video: ${videoId}`);
    analytics.trackInteraction(videoId, 'comment', true);
  };
  
  const handleShare = (videoId: string) => {
    console.log(`📤 Shared video: ${videoId}`);
    analytics.trackInteraction(videoId, 'share', true);
  };
  
  const handleSave = (videoId: string) => {
    console.log(`💾 Saved video: ${videoId}`);
    analytics.trackInteraction(videoId, 'save', true);
  };
  
  const handleFollow = (userId: string) => {
    console.log(`👥 Followed user: ${userId}`);
    analytics.trackInteraction(videos[0]?.assetId, 'follow', true);
  };
  
  return (
    <View style={styles.container}>
      {/* ✅ Status Bar Configuration for Full-Screen Experience */}
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent" 
        translucent 
      />
      
      {/* ✅ Complete Short-Form Video Player */}
      <ShortFormVideoPlayer
        videos={videos}
        initialVideoIndex={0}
        isLoading={false}
        onVideoChange={handleVideoChange}
        onLike={handleLike}
        onComment={handleComment}
        onShare={handleShare}
        onSave={handleSave}
        onFollow={handleFollow}
      />
      
      {/* ✅ Development Debug Info */}
      {__DEV__ && (
        <View style={styles.debugOverlay}>
          <View style={styles.debugPanel}>
            <Text style={styles.debugText}>
              📱 Device: {deviceInfo.deviceType} ({deviceInfo.deviceSize})
            </Text>
            <Text style={styles.debugText}>
              🌐 Network: {networkStatus.quality} ({networkStatus.connectionType})
            </Text>
            <Text style={styles.debugText}>
              🎥 Max Quality: {getRecommendedVideoQuality().resolution}
            </Text>
            <Text style={styles.debugText}>
              ⏱️ Watch Time: {analytics.totalWatchTime.toFixed(1)}s
            </Text>
            <Text style={styles.debugText}>
              🎯 Videos Watched: {analytics.sessionMetrics ? Object.keys(analytics.sessionMetrics).length : 0}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  debugOverlay: {
    position: 'absolute',
    top: 60,
    left: 10,
    right: 10,
    zIndex: 9999,
    pointerEvents: 'none',
  },
  debugPanel: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
  },
  debugText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
});

export default ExampleVideoFeed;
