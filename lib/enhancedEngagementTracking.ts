/**
 * Enhanced Engagement Tracking Service
 * Captures YouTube Shorts-style user signals and video performance metrics
 */

import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    increment,
    limit,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// 📊 Real-time engagement event
export interface EngagementEvent {
  userId: string;
  videoId: string;
  sessionId: string;
  
  // Event details
  eventType: 'watch_start' | 'watch_progress' | 'watch_complete' | 'like' | 'comment' | 'share' | 'skip' | 'rewatch' | 'follow' | 'save';
  timestamp: Date;
  
  // Context
  context: {
    watchTime: number; // seconds watched so far
    totalDuration: number; // total video duration
    completionRate: number; // 0-100
    skipReason?: 'quick_skip' | 'mid_skip' | 'completed';
    deviceType: 'mobile' | 'tablet' | 'desktop';
    sessionLength: number; // total session time so far
    previousAction?: string; // what user did just before this
  };
  
  // Video context
  videoContext: {
    position: number; // position in feed (0, 1, 2, etc.)
    loadTime: number; // how long video took to load
    isFromFollowedUser: boolean;
    discoveryMethod: 'feed' | 'search' | 'trending' | 'following';
  };
  
  // Quality signals
  qualitySignals: {
    rebufferingEvents: number; // how many times video paused to buffer
    videoQuality: string; // resolution played
    audioEnabled: boolean;
    playbackSpeed: number;
  };
}

// 🎯 Session tracking for user behavior
export interface UserSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  
  // Session metrics
  metrics: {
    totalWatchTime: number;
    videosWatched: number;
    videosCompleted: number;
    videosSkipped: number;
    interactions: number; // likes, comments, shares, etc.
    searchesPerformed: number;
    sessionDuration: number;
  };
  
  // Behavior patterns
  patterns: {
    avgTimePerVideo: number;
    skipRate: number;
    engagementRate: number;
    retentionRate: number;
    peakEngagementTime: number; // minutes into session when most engaged
  };
  
  // Context
  context: {
    deviceType: 'mobile' | 'tablet' | 'desktop';
    timeOfDay: number; // hour 0-23
    dayOfWeek: number; // 0-6
    location?: string;
    referralSource?: string;
  };
}

// 🔥 Real-time video performance tracking
export interface RealTimeVideoMetrics {
  videoId: string;
  uploaderId: string;
  
  // Live metrics (updated every few seconds)
  liveMetrics: {
    currentViewers: number;
    viewsPerMinute: number;
    likesPerMinute: number;
    commentsPerMinute: number;
    sharesPerMinute: number;
    lastUpdated: Date;
  };
  
  // Aggregated metrics (updated periodically)
  aggregated: {
    totalViews: number;
    uniqueViews: number;
    totalWatchTime: number;
    avgWatchTime: number;
    completionRate: number;
    engagementRate: number;
    skipRate: number;
    rewatchRate: number;
    viralityScore: number;
  };
  
  // Retention curve (percentage of viewers at each point)
  retentionCurve: {
    timePoints: number[]; // seconds into video
    retentionRates: number[]; // percentage still watching
  };
  
  // Audience insights
  audience: {
    demographics: {
      ageGroups: { [key: string]: number };
      locations: { [key: string]: number };
      deviceTypes: { [key: string]: number };
    };
    behaviorPatterns: {
      avgSessionLength: number;
      typicalSkipTime: number;
      rewatchBehavior: 'loop' | 'intentional' | 'none';
    };
  };
}

class EnhancedEngagementTrackingService {
  private currentSession: UserSession | null = null;
  private currentVideoId: string | null = null;
  private watchStartTime: number = 0;
  private sessionEvents: EngagementEvent[] = [];
  private performanceUpdateInterval: any = null;
  
  /**
   * 🚀 Start tracking user session
   */
  async startSession(userId: string, context: any = {}): Promise<string> {
    const sessionId = `${userId}_${Date.now()}`;
    
    this.currentSession = {
      sessionId,
      userId,
      startTime: new Date(),
      metrics: {
        totalWatchTime: 0,
        videosWatched: 0,
        videosCompleted: 0,
        videosSkipped: 0,
        interactions: 0,
        searchesPerformed: 0,
        sessionDuration: 0
      },
      patterns: {
        avgTimePerVideo: 0,
        skipRate: 0,
        engagementRate: 0,
        retentionRate: 0,
        peakEngagementTime: 0
      },
      context: {
        deviceType: context.deviceType || 'mobile',
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay(),
        location: context.location,
        referralSource: context.referralSource
      }
    };
    
    console.log(`📱 Started tracking session: ${sessionId}`);
    
    // Start real-time performance monitoring
    this.startPerformanceMonitoring();
    
    return sessionId;
  }
  
  /**
   * 🎬 Start tracking video watch
   */
  async startWatchingVideo(
    videoId: string, 
    userId: string, 
    position: number = 0,
    context: any = {}
  ): Promise<void> {
    this.currentVideoId = videoId;
    this.watchStartTime = Date.now();
    
    // Create watch start event
    const event: EngagementEvent = {
      userId,
      videoId,
      sessionId: this.currentSession?.sessionId || `${userId}_${Date.now()}`,
      eventType: 'watch_start',
      timestamp: new Date(),
      context: {
        watchTime: 0,
        totalDuration: context.totalDuration || 30,
        completionRate: 0,
        deviceType: context.deviceType || 'mobile',
        sessionLength: this.getSessionLength(),
        previousAction: context.previousAction
      },
      videoContext: {
        position,
        loadTime: context.loadTime || 0,
        isFromFollowedUser: context.isFromFollowedUser || false,
        discoveryMethod: context.discoveryMethod || 'feed'
      },
      qualitySignals: {
        rebufferingEvents: 0,
        videoQuality: context.videoQuality || '720p',
        audioEnabled: context.audioEnabled !== false,
        playbackSpeed: 1.0
      }
    };
    
    // Track the event
    await this.trackEvent(event);
    
    // Update session metrics
    if (this.currentSession) {
      this.currentSession.metrics.videosWatched++;
    }
    
    console.log(`📊 Started tracking engagement for video ${videoId}`);
  }
  
  /**
   * ⏸️ Track video progress (called periodically)
   */
  async trackWatchProgress(
    videoId: string,
    userId: string,
    currentTime: number,
    totalDuration: number
  ): Promise<void> {
    if (this.currentVideoId !== videoId) return;
    
    const watchTime = Math.floor((Date.now() - this.watchStartTime) / 1000);
    const completionRate = (currentTime / totalDuration) * 100;
    
    // Create progress event
    const event: EngagementEvent = {
      userId,
      videoId,
      sessionId: this.currentSession?.sessionId || `${userId}_${Date.now()}`,
      eventType: 'watch_progress',
      timestamp: new Date(),
      context: {
        watchTime,
        totalDuration,
        completionRate,
        deviceType: this.currentSession?.context.deviceType || 'mobile',
        sessionLength: this.getSessionLength()
      },
      videoContext: {
        position: 0,
        loadTime: 0,
        isFromFollowedUser: false,
        discoveryMethod: 'feed'
      },
      qualitySignals: {
        rebufferingEvents: 0,
        videoQuality: '720p',
        audioEnabled: true,
        playbackSpeed: 1.0
      }
    };
    
    // Track event (only every 5 seconds to avoid spam)
    if (watchTime % 5 === 0) {
      await this.trackEvent(event);
    }
    
    // Update session watch time
    if (this.currentSession) {
      this.currentSession.metrics.totalWatchTime = Math.max(
        this.currentSession.metrics.totalWatchTime,
        watchTime
      );
    }
  }
  
  /**
   * ⚡ Track video skip
   */
  async trackVideoSkip(
    videoId: string,
    userId: string,
    skipTime: number,
    totalDuration: number,
    skipReason: 'quick_skip' | 'mid_skip' | 'completed' = 'mid_skip'
  ): Promise<void> {
    const watchTime = Math.floor((Date.now() - this.watchStartTime) / 1000);
    const completionRate = (skipTime / totalDuration) * 100;
    
    const event: EngagementEvent = {
      userId,
      videoId,
      sessionId: this.currentSession?.sessionId || `${userId}_${Date.now()}`,
      eventType: 'skip',
      timestamp: new Date(),
      context: {
        watchTime,
        totalDuration,
        completionRate,
        skipReason,
        deviceType: this.currentSession?.context.deviceType || 'mobile',
        sessionLength: this.getSessionLength()
      },
      videoContext: {
        position: 0,
        loadTime: 0,
        isFromFollowedUser: false,
        discoveryMethod: 'feed'
      },
      qualitySignals: {
        rebufferingEvents: 0,
        videoQuality: '720p',
        audioEnabled: true,
        playbackSpeed: 1.0
      }
    };
    
    await this.trackEvent(event);
    
    // Update session metrics
    if (this.currentSession) {
      this.currentSession.metrics.videosSkipped++;
    }
    
    // Update video performance
    await this.updateVideoPerformance(videoId, 'skip', { skipTime, completionRate });
    
    console.log(`⚡ Tracked skip for video ${videoId} at ${skipTime}s (${completionRate.toFixed(1)}%)`);
  }
  
  /**
   * 👍 Track user interaction (like, comment, share, etc.)
   */
  async trackInteraction(
    videoId: string,
    userId: string,
    interactionType: 'like' | 'comment' | 'share' | 'follow' | 'save',
    value: boolean = true
  ): Promise<void> {
    const watchTime = this.currentVideoId === videoId ? 
      Math.floor((Date.now() - this.watchStartTime) / 1000) : 0;
    
    const event: EngagementEvent = {
      userId,
      videoId,
      sessionId: this.currentSession?.sessionId || `${userId}_${Date.now()}`,
      eventType: interactionType,
      timestamp: new Date(),
      context: {
        watchTime,
        totalDuration: 30, // estimate
        completionRate: 0,
        deviceType: this.currentSession?.context.deviceType || 'mobile',
        sessionLength: this.getSessionLength()
      },
      videoContext: {
        position: 0,
        loadTime: 0,
        isFromFollowedUser: false,
        discoveryMethod: 'feed'
      },
      qualitySignals: {
        rebufferingEvents: 0,
        videoQuality: '720p',
        audioEnabled: true,
        playbackSpeed: 1.0
      }
    };
    
    await this.trackEvent(event);
    
    // Update session metrics
    if (this.currentSession && value) {
      this.currentSession.metrics.interactions++;
    }
    
    // Update video performance
    await this.updateVideoPerformance(videoId, interactionType, { value });
    
    console.log(`👍 Tracked ${interactionType} for video ${videoId}`);
  }
  
  /**
   * 🔄 Track video rewatch
   */
  async trackRewatch(videoId: string, userId: string): Promise<void> {
    const event: EngagementEvent = {
      userId,
      videoId,
      sessionId: this.currentSession?.sessionId || `${userId}_${Date.now()}`,
      eventType: 'rewatch',
      timestamp: new Date(),
      context: {
        watchTime: 0,
        totalDuration: 30,
        completionRate: 0,
        deviceType: this.currentSession?.context.deviceType || 'mobile',
        sessionLength: this.getSessionLength()
      },
      videoContext: {
        position: 0,
        loadTime: 0,
        isFromFollowedUser: false,
        discoveryMethod: 'feed'
      },
      qualitySignals: {
        rebufferingEvents: 0,
        videoQuality: '720p',
        audioEnabled: true,
        playbackSpeed: 1.0
      }
    };
    
    await this.trackEvent(event);
    
    // Update video performance
    await this.updateVideoPerformance(videoId, 'rewatch', {});
    
    console.log(`🔄 Tracked rewatch for video ${videoId}`);
  }
  
  /**
   * 📊 Update real-time video performance metrics
   */
  private async updateVideoPerformance(
    videoId: string, 
    action: string, 
    data: any
  ): Promise<void> {
    try {
      const metricsRef = doc(db, 'realTimeVideoMetrics', videoId);
      const batch = writeBatch(db);
      
      // Update counters based on action
      const updates: any = {
        'aggregated.lastUpdated': serverTimestamp()
      };
      
      switch (action) {
        case 'watch_start':
          updates['aggregated.totalViews'] = increment(1);
          updates['liveMetrics.viewsPerMinute'] = increment(1);
          break;
        case 'like':
          updates['liveMetrics.likesPerMinute'] = increment(data.value ? 1 : -1);
          break;
        case 'comment':
          updates['liveMetrics.commentsPerMinute'] = increment(1);
          break;
        case 'share':
          updates['liveMetrics.sharesPerMinute'] = increment(1);
          break;
        case 'skip':
          // Update skip rate and average skip time
          break;
        case 'rewatch':
          // Update rewatch metrics
          break;
      }
      
      batch.update(metricsRef, updates);
      await batch.commit();
      
    } catch (error) {
      console.error('Error updating video performance:', error);
    }
  }
  
  /**
   * 📝 Track engagement event to database
   */
  private async trackEvent(event: EngagementEvent): Promise<void> {
    try {
      // Add to real-time events collection
      await addDoc(collection(db, 'engagementEvents'), {
        ...event,
        timestamp: serverTimestamp()
      });
      
      // Also add to local session cache
      this.sessionEvents.push(event);
      
    } catch (error) {
      console.error('❌ Error tracking engagement event:', error);
    }
  }
  
  /**
   * ⏱️ Get current session length in seconds
   */
  private getSessionLength(): number {
    if (!this.currentSession) return 0;
    return Math.floor((Date.now() - this.currentSession.startTime.getTime()) / 1000);
  }
  
  /**
   * 🏁 End current session
   */
  async endSession(): Promise<void> {
    if (!this.currentSession) return;
    
    // Update session end time and final metrics
    this.currentSession.endTime = new Date();
    this.currentSession.metrics.sessionDuration = this.getSessionLength();
    
    // Calculate final patterns
    if (this.currentSession.metrics.videosWatched > 0) {
      this.currentSession.patterns.avgTimePerVideo = 
        this.currentSession.metrics.totalWatchTime / this.currentSession.metrics.videosWatched;
      
      this.currentSession.patterns.skipRate = 
        this.currentSession.metrics.videosSkipped / this.currentSession.metrics.videosWatched;
      
      this.currentSession.patterns.engagementRate = 
        this.currentSession.metrics.interactions / this.currentSession.metrics.videosWatched;
    }
    
    // Save session to database
    try {
      await setDoc(
        doc(db, 'userSessions', this.currentSession.sessionId), 
        {
          ...this.currentSession,
          endTime: serverTimestamp()
        }
      );
      
      console.log(`🏁 Ended session ${this.currentSession.sessionId} (${this.currentSession.metrics.sessionDuration}s)`);
      
    } catch (error) {
      console.error('Error saving session:', error);
    }
    
    // Stop performance monitoring
    this.stopPerformanceMonitoring();
    
    // Clear session
    this.currentSession = null;
    this.sessionEvents = [];
  }
  
  /**
   * 📈 Start real-time performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Update performance metrics every minute
    this.performanceUpdateInterval = setInterval(() => {
      this.updateRealTimeMetrics();
    }, 60000); // 1 minute
  }
  
  /**
   * 🛑 Stop performance monitoring
   */
  private stopPerformanceMonitoring(): void {
    if (this.performanceUpdateInterval) {
      clearInterval(this.performanceUpdateInterval);
      this.performanceUpdateInterval = null;
    }
  }
  
  /**
   * ⚡ Update real-time metrics
   */
  private async updateRealTimeMetrics(): Promise<void> {
    // Reset per-minute counters
    try {
      const batch = writeBatch(db);
      
      // Reset all per-minute counters
      const activeVideos = await this.getActiveVideos();
      
      for (const videoId of activeVideos) {
        const metricsRef = doc(db, 'realTimeVideoMetrics', videoId);
        batch.update(metricsRef, {
          'liveMetrics.viewsPerMinute': 0,
          'liveMetrics.likesPerMinute': 0,
          'liveMetrics.commentsPerMinute': 0,
          'liveMetrics.sharesPerMinute': 0,
          'liveMetrics.lastUpdated': serverTimestamp()
        });
      }
      
      await batch.commit();
      
    } catch (error) {
      console.error('Error updating real-time metrics:', error);
    }
  }
  
  /**
   * 📊 Get list of videos with recent activity
   */
  private async getActiveVideos(): Promise<string[]> {
    try {
      // Get videos with events in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const eventsQuery = query(
        collection(db, 'engagementEvents'),
        where('timestamp', '>', oneHourAgo),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      
      const eventsSnapshot = await getDocs(eventsQuery);
      const videoIds = new Set<string>();
      
      eventsSnapshot.forEach(doc => {
        const data = doc.data();
        videoIds.add(data.videoId);
      });
      
      return Array.from(videoIds);
      
    } catch (error) {
      console.error('Error getting active videos:', error);
      return [];
    }
  }
  
  /**
   * 📊 Get comprehensive analytics for a video
   */
  async getVideoAnalytics(videoId: string): Promise<RealTimeVideoMetrics | null> {
    try {
      const metricsRef = doc(db, 'realTimeVideoMetrics', videoId);
      const metricsDoc = await getDoc(metricsRef);
      
      if (metricsDoc.exists()) {
        return metricsDoc.data() as RealTimeVideoMetrics;
      }
      
      return null;
      
    } catch (error) {
      console.error('Error getting video analytics:', error);
      return null;
    }
  }
  
  /**
   * 📊 Get user behavior insights
   */
  async getUserInsights(userId: string, days: number = 30): Promise<any> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const sessionsQuery = query(
        collection(db, 'userSessions'),
        where('userId', '==', userId),
        where('startTime', '>', startDate),
        orderBy('startTime', 'desc')
      );
      
      const sessionsSnapshot = await getDocs(sessionsQuery);
      const sessions: UserSession[] = [];
      
      sessionsSnapshot.forEach(doc => {
        sessions.push(doc.data() as UserSession);
      });
      
      // Analyze patterns
      const insights = this.analyzeUserSessions(sessions);
      
      return insights;
      
    } catch (error) {
      console.error('Error getting user insights:', error);
      return null;
    }
  }
  
  /**
   * 🧠 Analyze user sessions for patterns
   */
  private analyzeUserSessions(sessions: UserSession[]): any {
    if (sessions.length === 0) return null;
    
    const totalSessions = sessions.length;
    const totalWatchTime = sessions.reduce((sum, s) => sum + s.metrics.totalWatchTime, 0);
    const totalVideos = sessions.reduce((sum, s) => sum + s.metrics.videosWatched, 0);
    const totalInteractions = sessions.reduce((sum, s) => sum + s.metrics.interactions, 0);
    
    return {
      overview: {
        totalSessions,
        avgSessionLength: sessions.reduce((sum, s) => sum + s.metrics.sessionDuration, 0) / totalSessions,
        totalWatchTime,
        avgWatchTimePerSession: totalWatchTime / totalSessions,
        totalVideosWatched: totalVideos,
        avgVideosPerSession: totalVideos / totalSessions,
        totalInteractions,
        avgInteractionsPerSession: totalInteractions / totalSessions
      },
      patterns: {
        avgSkipRate: sessions.reduce((sum, s) => sum + s.patterns.skipRate, 0) / totalSessions,
        avgEngagementRate: sessions.reduce((sum, s) => sum + s.patterns.engagementRate, 0) / totalSessions,
        peakUsageHours: this.calculatePeakUsageHours(sessions),
        preferredDeviceType: this.getPreferredDeviceType(sessions)
      },
      trends: {
        watchTimeOverTime: this.calculateWatchTimeTrend(sessions),
        engagementOverTime: this.calculateEngagementTrend(sessions)
      }
    };
  }
  
  private calculatePeakUsageHours(sessions: UserSession[]): number[] {
    const hourCounts: { [hour: number]: number } = {};
    
    sessions.forEach(session => {
      const hour = session.context.timeOfDay;
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    return Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
  }
  
  private getPreferredDeviceType(sessions: UserSession[]): string {
    const deviceCounts: { [device: string]: number } = {};
    
    sessions.forEach(session => {
      const device = session.context.deviceType;
      deviceCounts[device] = (deviceCounts[device] || 0) + 1;
    });
    
    return Object.entries(deviceCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'mobile';
  }
  
  private calculateWatchTimeTrend(sessions: UserSession[]): any[] {
    // Calculate daily watch time for trend analysis
    const dailyWatchTime: { [date: string]: number } = {};
    
    sessions.forEach(session => {
      const date = session.startTime.toISOString().split('T')[0];
      dailyWatchTime[date] = (dailyWatchTime[date] || 0) + session.metrics.totalWatchTime;
    });
    
    return Object.entries(dailyWatchTime)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, watchTime]) => ({ date, watchTime }));
  }
  
  private calculateEngagementTrend(sessions: UserSession[]): any[] {
    // Calculate daily engagement for trend analysis
    const dailyEngagement: { [date: string]: number } = {};
    
    sessions.forEach(session => {
      const date = session.startTime.toISOString().split('T')[0];
      dailyEngagement[date] = (dailyEngagement[date] || 0) + session.metrics.interactions;
    });
    
    return Object.entries(dailyEngagement)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, interactions]) => ({ date, interactions }));
  }
}

export const enhancedEngagementTrackingService = new EnhancedEngagementTrackingService();
