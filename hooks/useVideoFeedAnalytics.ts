import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../firebaseConfig';
import { engagementTrackingService } from '../lib/engagementTrackingService';
import { viewTracker } from '../lib/viewTrackingService';

export interface VideoAnalytics {
  videoId: string;
  userId: string;
  watchTime: number;
  totalDuration: number;
  completionRate: number;
  interactions: {
    liked: boolean;
    commented: boolean;
    shared: boolean;
    saved: boolean;
    followed: boolean;
  };
  engagement: {
    pauseCount: number;
    seekCount: number;
    replayCount: number;
    swipeAwayTime: number;
  };
  device: {
    platform: string;
    screenSize: string;
    connectionType: string;
  };
}

interface UseVideoFeedAnalyticsProps {
  userId?: string;
  enabled?: boolean;
}

export const useVideoFeedAnalytics = ({ 
  userId, 
  enabled = true 
}: UseVideoFeedAnalyticsProps = {}) => {
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [watchStartTime, setWatchStartTime] = useState<number>(0);
  const [totalWatchTime, setTotalWatchTime] = useState<number>(0);
  const [sessionMetrics, setSessionMetrics] = useState<{ [videoId: string]: VideoAnalytics }>({});
  
  // Real-time tracking refs
  const watchTimeInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewTrackingRef = useRef<{ [videoId: string]: boolean }>({});
  const engagementData = useRef<{ [videoId: string]: Partial<VideoAnalytics> }>({});
  
  // ✅ 19. Analytics Events - Start watching video
  const startWatching = useCallback((videoId: string, videoDuration?: number) => {
    if (!enabled || !userId || !videoId) return;
    
    console.log(`📊 Starting watch tracking for video: ${videoId}`);
    
    // Stop previous video tracking
    if (currentVideo && currentVideo !== videoId) {
      stopWatching();
    }
    
    setCurrentVideo(videoId);
    setWatchStartTime(Date.now());
    setTotalWatchTime(0);
    
    // Initialize engagement data
    if (!engagementData.current[videoId]) {
      engagementData.current[videoId] = {
        videoId,
        userId,
        watchTime: 0,
        totalDuration: videoDuration || 0,
        completionRate: 0,
        interactions: {
          liked: false,
          commented: false,
          shared: false,
          saved: false,
          followed: false,
        },
        engagement: {
          pauseCount: 0,
          seekCount: 0,
          replayCount: 0,
          swipeAwayTime: 0,
        },
        device: {
          platform: require('react-native').Platform.OS,
          screenSize: `${require('react-native').Dimensions.get('window').width}x${require('react-native').Dimensions.get('window').height}`,
          connectionType: 'unknown', // Could be enhanced with network info
        },
      };
    }
    
    // Start real-time watch tracking
    watchTimeInterval.current = setInterval(() => {
      const now = Date.now();
      const watchTime = (now - watchStartTime) / 1000;
      setTotalWatchTime(watchTime);
      
      // Update engagement data
      if (engagementData.current[videoId]) {
        engagementData.current[videoId].watchTime = watchTime;
        const totalDuration = engagementData.current[videoId].totalDuration;
        if (totalDuration && totalDuration > 0) {
          engagementData.current[videoId].completionRate = watchTime / totalDuration;
        }
      }
      
      // Record view at 3 seconds (standard)
      if (watchTime >= 3 && !viewTrackingRef.current[videoId]) {
        viewTrackingRef.current[videoId] = true;
        viewTracker.recordView(videoId, 3).then((recorded) => {
          if (recorded) {
            console.log(`👁️ View recorded for video: ${videoId}`);
          }
        }).catch(console.error);
      }
      
      // Track engagement service
      engagementTrackingService.startWatching(videoId, userId);
      
    }, 1000);
    
  }, [enabled, userId, currentVideo, watchStartTime]);
  
  // ✅ 19. Analytics Events - Stop watching video
  const stopWatching = useCallback(() => {
    if (!enabled || !currentVideo) return;
    
    console.log(`📊 Stopping watch tracking for video: ${currentVideo}`);
    
    if (watchTimeInterval.current) {
      clearInterval(watchTimeInterval.current);
      watchTimeInterval.current = null;
    }
    
    const finalWatchTime = (Date.now() - watchStartTime) / 1000;
    
    // Final analytics update
    if (engagementData.current[currentVideo]) {
      engagementData.current[currentVideo].watchTime = finalWatchTime;
      
      // Save session metrics
      setSessionMetrics(prev => ({
        ...prev,
        [currentVideo]: engagementData.current[currentVideo] as VideoAnalytics
      }));
      
      // Save to Firebase
      saveAnalyticsData(currentVideo, engagementData.current[currentVideo] as VideoAnalytics);
    }
    
    // Stop engagement service tracking
    engagementTrackingService.stopWatching();
    
    setCurrentVideo(null);
    setWatchStartTime(0);
    setTotalWatchTime(0);
    
  }, [enabled, currentVideo, watchStartTime]);
  
  // ✅ 19. Analytics Events - Track interactions
  const trackInteraction = useCallback((
    videoId: string, 
    action: 'like' | 'comment' | 'share' | 'save' | 'follow',
    value: boolean = true
  ) => {
    if (!enabled || !userId || !videoId) return;
    
    console.log(`📊 Tracking ${action} interaction for video: ${videoId}`);
    
    // Update engagement data
    if (engagementData.current[videoId]) {
      const interactions = engagementData.current[videoId].interactions;
      if (interactions) {
        if (action === 'follow') {
          interactions.followed = value;
        } else {
          // Map action names to property names
          const actionMap: { [key: string]: keyof typeof interactions } = {
            'like': 'liked',
            'comment': 'commented',
            'share': 'shared',
            'save': 'saved'
          };
          const propName = actionMap[action];
          if (propName) {
            interactions[propName] = value;
          }
        }
      }
    }
    
    // Track with engagement service
    engagementTrackingService.trackInteraction(videoId, userId, action, value);
    
    // For immediate actions, save analytics
    saveAnalyticsData(videoId, engagementData.current[videoId] as VideoAnalytics);
    
  }, [enabled, userId]);
  
  // ✅ 19. Analytics Events - Track engagement actions
  const trackEngagement = useCallback((
    videoId: string,
    action: 'pause' | 'seek' | 'replay' | 'swipe_away',
    metadata?: any
  ) => {
    if (!enabled || !userId || !videoId) return;
    
    console.log(`📊 Tracking ${action} engagement for video: ${videoId}`);
    
    if (engagementData.current[videoId]) {
      const engagement = engagementData.current[videoId].engagement!;
      
      switch (action) {
        case 'pause':
          engagement.pauseCount++;
          break;
        case 'seek':
          engagement.seekCount++;
          break;
        case 'replay':
          engagement.replayCount++;
          break;
        case 'swipe_away':
          engagement.swipeAwayTime = metadata?.watchTime || totalWatchTime;
          break;
      }
    }
    
  }, [enabled, userId, totalWatchTime]);
  
  // Save analytics data to Firebase
  const saveAnalyticsData = useCallback(async (videoId: string, analytics: VideoAnalytics) => {
    if (!enabled || !userId) return;
    
    try {
      await addDoc(collection(db, 'videoAnalytics'), {
        ...analytics,
        timestamp: serverTimestamp(),
        sessionId: `${userId}_${Date.now()}`,
        version: '2.0', // Analytics schema version
      });
      
      console.log(`📊 Analytics saved for video: ${videoId}`);
      
    } catch (error) {
      console.error('Error saving analytics:', error);
    }
  }, [enabled, userId]);
  
  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchTimeInterval.current) {
        clearInterval(watchTimeInterval.current);
      }
      
      // Save any pending analytics
      if (currentVideo && engagementData.current[currentVideo]) {
        saveAnalyticsData(currentVideo, engagementData.current[currentVideo] as VideoAnalytics);
      }
    };
  }, [currentVideo, saveAnalyticsData]);
  
  // Get session summary for current video
  const getCurrentVideoAnalytics = useCallback(() => {
    if (!currentVideo || !engagementData.current[currentVideo]) return null;
    
    return {
      ...engagementData.current[currentVideo],
      watchTime: totalWatchTime,
      completionRate: engagementData.current[currentVideo].totalDuration 
        ? totalWatchTime / engagementData.current[currentVideo].totalDuration! 
        : 0,
    };
  }, [currentVideo, totalWatchTime]);
  
  // Get session summary for all videos
  const getSessionSummary = useCallback(() => {
    const videos = Object.keys(sessionMetrics);
    const totalVideosWatched = videos.length;
    const totalSessionTime = Object.values(sessionMetrics)
      .reduce((sum, metrics) => sum + metrics.watchTime, 0);
    const averageCompletionRate = videos.length > 0
      ? Object.values(sessionMetrics)
          .reduce((sum, metrics) => sum + metrics.completionRate, 0) / videos.length
      : 0;
    
    return {
      totalVideosWatched,
      totalSessionTime,
      averageCompletionRate,
      sessionMetrics,
    };
  }, [sessionMetrics]);
  
  return {
    // State
    currentVideo,
    totalWatchTime,
    sessionMetrics,
    
    // Actions
    startWatching,
    stopWatching,
    trackInteraction,
    trackEngagement,
    
    // Analytics
    getCurrentVideoAnalytics,
    getSessionSummary,
    
    // Utils
    isTracking: !!currentVideo,
    enabled,
  };
};

export default useVideoFeedAnalytics;
