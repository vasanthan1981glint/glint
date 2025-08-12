import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDoc, collection, doc, getDoc, getDocs, increment, setDoc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { auth, db } from '../firebaseConfig';

// Helper function to safely get current user
const getCurrentUser = () => {
  try {
    return auth?.currentUser || null;
  } catch (error) {
    console.error('Error accessing current user:', error);
    return null;
  }
};

interface ViewSession {
  videoId: string;
  userId?: string;
  sessionId: string;
  startTime: number;
  lastUpdateTime: number;
  isValid: boolean;
  hasReachedThreshold: boolean;
  deviceFingerprint: string;
  visibilityPercentage: number;
  networkInfo?: string;
}

interface ViewerIdentity {
  primaryId: string;        // User ID if signed in, device fingerprint if not
  deviceFingerprint: string; // Always track device
  ipAddress?: string;       // For additional verification
  sessionId: string;        // Current session
  isAuthenticated: boolean; // Whether user is signed in
}

interface ViewRecord {
  videoId: string;
  viewerId: string;         // Primary identity (user ID or device fingerprint)
  deviceFingerprint: string;
  timestamp: number;
  watchTime: number;
  sessionId: string;
  deviceInfo: string;
  networkInfo?: string;
  ip?: string;
  visibilityScore: number;
  isAuthenticated: boolean;
}

interface UniqueViewRecord {
  viewerId: string;         // Primary viewer identity
  videoId: string;
  firstViewTime: number;    // When they first viewed this video
  deviceFingerprints: string[]; // All devices they've used
  lastViewAttempt: number;  // Last time they tried to view
  totalAttempts: number;    // How many times they tried to view
}

interface ViewLog {
  userId?: string;
  deviceFingerprint: string;
  videoId: string;
  timestamp: number;
  sessionId: string;
}

class ViewTrackingService {
  private activeSessions = new Map<string, ViewSession>();
  private trackingAttempts = new Map<string, number>(); // Track recent attempts per video
  private ownershipCache = new Map<string, { isOwner: boolean; timestamp: number }>(); // Cache ownership status
  private viewLogCache = new Map<string, ViewLog[]>(); // Local cache of recent views
  private uniqueViewRecords = new Map<string, UniqueViewRecord>(); // Unique view tracking
  private viewCountCache = new Map<string, number>(); // Cache view counts for performance
  private deviceInfo: any = null;
  
  // Configuration constants
  private readonly VIEW_THRESHOLD_MS = 3000; // 3 seconds minimum watch time
  private readonly MIN_VIEW_DURATION = 3; // 3 seconds in seconds (for recordView API)
  private readonly VISIBILITY_THRESHOLD = 50; // 50% visibility required
  private readonly SESSION_TIMEOUT_MS = 30000; // 30 seconds session timeout
  private readonly DUPLICATE_PREVENTION_HOURS = 24; // Prevent duplicate views within 24 hours
  private readonly DEVICE_FINGERPRINT_KEY = 'glint_device_fingerprint';
  private readonly TRACKING_DEBOUNCE_MS = 5000; // Increased to 5 seconds to prevent rapid views
  private readonly OWNERSHIP_CACHE_MS = 5 * 60 * 1000; // Cache ownership for 5 minutes
  private readonly VIEW_LOG_CACHE_MS = 25 * 60 * 60 * 1000; // Cache view logs for 25 hours
  private readonly MAX_VIEWS_PER_HOUR = 10; // Reduced to 10 views per hour per device (more strict)
  private readonly MIN_SESSION_DURATION = 2000; // Minimum 2 seconds before allowing another view
  
  constructor() {
    this.initializeDeviceFingerprint();
    this.initializeDeviceInfo();
    this.startSessionCleanup();
    this.loadViewLogCache();
  }

  /**
   * Initialize device info for anti-manipulation
   */
  private async initializeDeviceInfo() {
    try {
      this.deviceInfo = {
        platform: Platform.OS,
        version: Platform.Version.toString(),
        timestamp: Date.now(),
        randomId: Math.random().toString(36).substr(2, 9),
      };
    } catch (error) {
      console.error('Error initializing device info:', error);
      this.deviceInfo = { error: 'device_info_unavailable' };
    }
  }

  /**
   * Initialize unique device fingerprint for anti-fraud measures
   */
  private async initializeDeviceFingerprint(): Promise<string> {
    try {
      let fingerprint = await AsyncStorage.getItem(this.DEVICE_FINGERPRINT_KEY);
      if (!fingerprint) {
        // Generate unique device fingerprint with device-specific data
        const deviceData = [
          Platform.OS,
          Platform.Version.toString(),
          Date.now().toString(),
          Math.random().toString(36).substr(2, 9)
        ];
        fingerprint = `fp_${deviceData.join('_')}`;
        await AsyncStorage.setItem(this.DEVICE_FINGERPRINT_KEY, fingerprint);
      }
      return fingerprint;
    } catch (error) {
      console.error('Error initializing device fingerprint:', error);
      return `fp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Load view log cache from AsyncStorage
   */
  private async loadViewLogCache() {
    try {
      const cached = await AsyncStorage.getItem('view_log_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        this.viewLogCache = new Map(parsed);
      }
    } catch (error) {
      console.error('Error loading view log cache:', error);
    }
  }

  /**
   * Save view log cache to AsyncStorage
   */
  private async saveViewLogCache() {
    try {
      const cacheArray = Array.from(this.viewLogCache.entries());
      await AsyncStorage.setItem('view_log_cache', JSON.stringify(cacheArray));
    } catch (error) {
      console.error('Error saving view log cache:', error);
    }
  }

  /**
   * Clean up expired sessions and caches periodically
   */
  private startSessionCleanup() {
    setInterval(() => {
      const now = Date.now();
      
      // Clean up expired sessions
      for (const [sessionId, session] of this.activeSessions.entries()) {
        if (now - session.lastUpdateTime > this.SESSION_TIMEOUT_MS) {
          console.log(`🧹 Cleaning up expired session: ${sessionId}`);
          this.activeSessions.delete(sessionId);
        }
      }
      
      // Clean up tracking attempts older than debounce period
      for (const [videoId, lastAttempt] of this.trackingAttempts.entries()) {
        if (now - lastAttempt > this.TRACKING_DEBOUNCE_MS) {
          this.trackingAttempts.delete(videoId);
        }
      }
      
      // Clean up old ownership cache entries
      for (const [videoId, cache] of this.ownershipCache.entries()) {
        if (now - cache.timestamp > this.OWNERSHIP_CACHE_MS) {
          this.ownershipCache.delete(videoId);
        }
      }
      
      // Clean up old view log cache entries
      for (const [key, logs] of this.viewLogCache.entries()) {
        const filteredLogs = logs.filter(log => 
          now - log.timestamp < this.VIEW_LOG_CACHE_MS
        );
        if (filteredLogs.length === 0) {
          this.viewLogCache.delete(key);
        } else if (filteredLogs.length !== logs.length) {
          this.viewLogCache.set(key, filteredLogs);
        }
      }
    }, 60000); // Clean up every minute
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if view is from a valid user (anti-bot measures)
   */
  private async isValidViewer(): Promise<boolean> {
    try {
      // Check if auth is available
      if (!auth) {
        console.warn('Firebase auth not initialized, treating as anonymous user');
        return true; // Allow anonymous viewing but with bot detection
      }

      // Check if user is authenticated (higher trust score)
      const currentUser = getCurrentUser();
      if (currentUser) {
        // Authenticated users are considered valid
        return true;
      }

      // For anonymous users, implement basic bot detection
      // Check for rapid successive calls (bot-like behavior)
      const lastViewTime = await AsyncStorage.getItem('last_view_time');
      const now = Date.now();
      
      if (lastViewTime) {
        const timeDiff = now - parseInt(lastViewTime);
        if (timeDiff < 1000) { // Less than 1 second between views
          console.warn('⚠️ Potential bot behavior detected - too rapid views');
          return false;
        }
      }
      
      await AsyncStorage.setItem('last_view_time', now.toString());
      return true;
    } catch (error) {
      console.error('Error validating viewer:', error);
      return true; // Default to valid if check fails
    }
  }

  /**
   * Get viewer identity - the anchor for view tracking
   */
  private async getViewerIdentity(): Promise<ViewerIdentity> {
    const currentUser = getCurrentUser();
    const deviceFingerprint = await this.initializeDeviceFingerprint();
    const sessionId = this.generateSessionId();
    
    // If signed in: use user ID as primary identity
    // If not signed in: use device fingerprint as primary identity
    const primaryId = currentUser?.uid || deviceFingerprint;
    
    return {
      primaryId,
      deviceFingerprint,
      sessionId,
      isAuthenticated: !!currentUser?.uid,
      // ipAddress could be added here if available
    };
  }

  /**
   * CORE: Check if this viewer has already viewed this video (STRICT)
   */
  private async hasViewerSeenVideo(videoId: string): Promise<{
    hasViewed: boolean;
    lastViewTime?: number;
    reason?: string;
  }> {
    const viewerIdentity = await this.getViewerIdentity();
    const now = Date.now();
    const cooldownMs = this.DUPLICATE_PREVENTION_HOURS * 60 * 60 * 1000;
    
    console.log(`🔍 Checking if viewer ${viewerIdentity.primaryId} has seen video ${videoId}`);
    
    // Check local unique view records first (most reliable)
    const uniqueKey = `${viewerIdentity.primaryId}_${videoId}`;
    let uniqueRecord = this.uniqueViewRecords.get(uniqueKey);
    
    // Load from AsyncStorage if not in memory
    if (!uniqueRecord) {
      try {
        const stored = await AsyncStorage.getItem(`unique_view_${uniqueKey}`);
        if (stored) {
          uniqueRecord = JSON.parse(stored);
          this.uniqueViewRecords.set(uniqueKey, uniqueRecord!);
        }
      } catch (error) {
        console.log('Error loading unique view record:', error);
      }
    }
    
    if (uniqueRecord) {
      const timeSinceFirstView = now - uniqueRecord.firstViewTime;
      const timeSinceLastAttempt = now - uniqueRecord.lastViewAttempt;
      
      // If within cooldown period, it's a duplicate
      if (timeSinceLastAttempt < cooldownMs) {
        console.log(`🚫 DUPLICATE: Viewer ${viewerIdentity.primaryId} already viewed video ${videoId} ${Math.round(timeSinceLastAttempt / 1000 / 60)} minutes ago`);
        
        // Update attempt counter
        uniqueRecord.lastViewAttempt = now;
        uniqueRecord.totalAttempts += 1;
        await this.saveUniqueViewRecord(uniqueKey, uniqueRecord);
        
        return {
          hasViewed: true,
          lastViewTime: uniqueRecord.firstViewTime,
          reason: 'within_cooldown_period'
        };
      }
    }
    
    // For authenticated users, also check if they viewed on other devices
    if (viewerIdentity.isAuthenticated) {
      const userKey = `user_${viewerIdentity.primaryId}_${videoId}`;
      try {
        const userViewData = await AsyncStorage.getItem(userKey);
        if (userViewData) {
          const userData = JSON.parse(userViewData);
          const timeSinceUserView = now - userData.timestamp;
          
          if (timeSinceUserView < cooldownMs) {
            console.log(`🚫 DUPLICATE: User ${viewerIdentity.primaryId} already viewed video ${videoId} on another device`);
            return {
              hasViewed: true,
              lastViewTime: userData.timestamp,
              reason: 'viewed_on_other_device'
            };
          }
        }
      } catch (error) {
        console.log('Error checking user view data:', error);
      }
    }
    
    console.log(`✅ NEW VIEW: Viewer ${viewerIdentity.primaryId} has not seen video ${videoId} recently`);
    return { hasViewed: false };
  }

  /**
   * Save unique view record
   */
  private async saveUniqueViewRecord(uniqueKey: string, record: UniqueViewRecord): Promise<void> {
    try {
      this.uniqueViewRecords.set(uniqueKey, record);
      await AsyncStorage.setItem(`unique_view_${uniqueKey}`, JSON.stringify(record));
    } catch (error) {
      console.error('Error saving unique view record:', error);
    }
  }

  /**
   * Record a new unique view
   */
  private async recordUniqueView(videoId: string, watchTime: number): Promise<void> {
    const viewerIdentity = await this.getViewerIdentity();
    const now = Date.now();
    const uniqueKey = `${viewerIdentity.primaryId}_${videoId}`;
    
    // Create or update unique view record
    const uniqueRecord: UniqueViewRecord = {
      viewerId: viewerIdentity.primaryId,
      videoId,
      firstViewTime: now,
      deviceFingerprints: [viewerIdentity.deviceFingerprint],
      lastViewAttempt: now,
      totalAttempts: 1
    };
    
    await this.saveUniqueViewRecord(uniqueKey, uniqueRecord);
    
    // For authenticated users, also save cross-device record
    if (viewerIdentity.isAuthenticated) {
      const userKey = `user_${viewerIdentity.primaryId}_${videoId}`;
      const userData = {
        timestamp: now,
        watchTime,
        deviceFingerprint: viewerIdentity.deviceFingerprint
      };
      await AsyncStorage.setItem(userKey, JSON.stringify(userData));
    }
    
    console.log(`✅ UNIQUE VIEW RECORDED: ${viewerIdentity.primaryId} -> ${videoId}`);
  }

  // Enhanced duplicate view detection is implemented later in the file

  /**
   * Check if current user is the owner of the video
   */
  private async isVideoOwner(videoId: string): Promise<boolean> {
    try {
      // Check if auth is available
      if (!auth) {
        console.error('Firebase auth not initialized');
        return false;
      }

      const currentUser = getCurrentUser();
      if (!currentUser) {
        return false; // Anonymous users can't be owners
      }

      // Check cache first
      const cached = this.ownershipCache.get(videoId);
      if (cached && (Date.now() - cached.timestamp) < this.OWNERSHIP_CACHE_MS) {
        return cached.isOwner;
      }

      // Get video document to check ownership
      const videoRef = doc(db, 'videos', videoId);
      const videoDoc = await getDoc(videoRef);
      
      if (!videoDoc.exists()) {
        // Video doesn't exist - might have been deleted
        throw new Error('Video not found');
      }
      
      const videoData = videoDoc.data();
      const isOwner = videoData.userId === currentUser.uid;
      
      // Cache the result
      this.ownershipCache.set(videoId, {
        isOwner,
        timestamp: Date.now()
      });
      
      if (isOwner) {
        console.log(`👤 Video owner detected - User ${currentUser.uid} viewing their own video ${videoId}`);
      }
      
      return isOwner;
    } catch (error) {
      console.error('Error checking video ownership:', error);
      return false; // Default to not owner if check fails
    }
  }

  /**
   * Quick ownership check without logging (for pre-filtering)
   */
  async isCurrentUserVideoOwner(videoId: string): Promise<boolean> {
    try {
      if (!auth) return false;
      const currentUser = getCurrentUser();
      if (!currentUser) return false;

      // Check cache first
      const cached = this.ownershipCache.get(videoId);
      if (cached && (Date.now() - cached.timestamp) < this.OWNERSHIP_CACHE_MS) {
        return cached.isOwner;
      }

      // If not cached, do a quick check
      const videoRef = doc(db, 'videos', videoId);
      const videoDoc = await getDoc(videoRef);
      
      if (!videoDoc.exists()) {
        return false;
      }
      
      const videoData = videoDoc.data();
      const isOwner = videoData.userId === currentUser.uid;
      
      // Cache the result
      this.ownershipCache.set(videoId, {
        isOwner,
        timestamp: Date.now()
      });
      
      return isOwner;
    } catch (error) {
      return false;
    }
  }

  /**
   * PUBLIC API: Simple view recording for home.tsx
   */
  async recordView(videoId: string, watchTime: number = 3): Promise<boolean> {
    try {
      // Convert seconds to milliseconds for internal consistency
      const watchTimeMs = watchTime * 1000;
      
      // Step 1: Check if this viewer has already viewed this video
      const duplicateCheck = await this.hasViewerSeenVideo(videoId);
      if (duplicateCheck.hasViewed) {
        console.log(`🚫 View rejected: ${duplicateCheck.reason}`);
        return false;
      }

      // Step 2: Validate watch time
      if (watchTimeMs < this.VIEW_THRESHOLD_MS) {
        console.log(`🚫 View rejected: Insufficient watch time (${watchTime}s < ${this.VIEW_THRESHOLD_MS/1000}s)`);
        return false;
      }

      // Step 3: Record the unique view locally
      await this.recordUniqueView(videoId, watchTimeMs);

      // Step 4: Update Firebase view count
      try {
        const videoRef = doc(db, 'videos', videoId);
        await updateDoc(videoRef, {
          views: increment(1),
          lastViewedAt: new Date().toISOString()
        });

        // Get updated count and cache it
        const videoDoc = await getDoc(videoRef);
        if (videoDoc.exists()) {
          const newCount = videoDoc.data().views || 1;
          const cacheKey = `view_count_${videoId}`;
          this.viewCountCache.set(cacheKey, newCount);
          console.log(`✅ View recorded for video ${videoId}, new count: ${newCount}`);
        }
      } catch (firebaseError) {
        console.error('Firebase update failed (continuing anyway):', firebaseError);
      }

      return true;
    } catch (error) {
      console.error('Error recording view:', error);
      return false;
    }
  }

  /**
   * Start tracking a video view
   */
  async startViewTracking(videoId: string): Promise<string> {
    try {
      // Check for recent tracking attempts (debounce)
      const now = Date.now();
      const lastAttempt = this.trackingAttempts.get(videoId);
      if (lastAttempt && (now - lastAttempt) < this.TRACKING_DEBOUNCE_MS) {
        // Silent fail for debounced requests to reduce log spam
        throw new Error(`debounced`);
      }
      
      // Update tracking attempt timestamp
      this.trackingAttempts.set(videoId, now);
      
      console.log(`📊 Starting view tracking for video: ${videoId}`);
      
      // Check if current user is the video owner
      const isOwner = await this.isVideoOwner(videoId);
      if (isOwner) {
        throw new Error('Video owner views are not counted');
      }
      
      // Validate viewer
      const isValid = await this.isValidViewer();
      if (!isValid) {
        throw new Error('Invalid viewer detected');
      }

      const sessionId = this.generateSessionId();
      const fingerprint = await this.initializeDeviceFingerprint();
      const currentUser = getCurrentUser();
      
      // Check for duplicate view
      const isDuplicate = await this.isDuplicateView(videoId, sessionId);
      if (isDuplicate) {
        throw new Error('Duplicate view detected');
      }

      // Create view session
      const session: ViewSession = {
        videoId,
        userId: currentUser?.uid,
        sessionId,
        startTime: Date.now(),
        lastUpdateTime: Date.now(),
        isValid: true,
        hasReachedThreshold: false,
        deviceFingerprint: fingerprint,
        visibilityPercentage: 100 // Default to 100% visibility
      };

      this.activeSessions.set(sessionId, session);
      
      console.log(`✅ View tracking started - Session: ${sessionId}`);
      return sessionId;
    } catch (error) {
      console.error('❌ Error starting view tracking:', error);
      throw error;
    }
  }

  /**
   * Update view tracking progress
   */
  async updateViewProgress(sessionId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session || !session.isValid) {
        return;
      }

      const now = Date.now();
      const watchTime = now - session.startTime;
      
      // Update session
      session.lastUpdateTime = now;

      // Check if view threshold is reached
      if (watchTime >= this.VIEW_THRESHOLD_MS && !session.hasReachedThreshold) {
        console.log(`🎯 View threshold reached for video ${session.videoId} (${watchTime}ms)`);
        session.hasReachedThreshold = true;
        
        // Record the valid view
        await this.recordValidView(session, watchTime);
      }
    } catch (error) {
      console.error('Error updating view progress:', error);
    }
  }

  /**
   * Stop view tracking
   */
  async stopViewTracking(sessionId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return;
      }

      const totalWatchTime = Date.now() - session.startTime;
      console.log(`🛑 Stopping view tracking - Session: ${sessionId}, Watch time: ${totalWatchTime}ms`);

      // If threshold was reached, make sure view was recorded
      if (session.hasReachedThreshold) {
        await this.recordValidView(session, totalWatchTime);
      }

      // Clean up session
      this.activeSessions.delete(sessionId);
    } catch (error) {
      console.error('Error stopping view tracking:', error);
    }
  }

  /**
   * Record a valid view in Firebase (internal method)
   */
  private async recordValidView(session: ViewSession, watchTime: number): Promise<void> {
    try {
      const currentUser = getCurrentUser();
      const fingerprint = await this.initializeDeviceFingerprint();
      const now = Date.now();
      
      console.log(`💾 Recording LEGITIMATE view for video ${session.videoId}, user: ${currentUser?.uid || 'anonymous'}, watch time: ${watchTime}ms`);
      
      // Store comprehensive view prevention data locally
      const viewData = {
        sessionId: session.sessionId,
        timestamp: now,
        watchTime,
        userId: currentUser?.uid,
        deviceFingerprint: fingerprint
      };
      
      // Store for both user and device to prevent cross-account duplicate views
      if (currentUser?.uid) {
        const userKey = `user_${currentUser.uid}_${session.videoId}`;
        await AsyncStorage.setItem(userKey, JSON.stringify(viewData));
      }
      
      const deviceKey = `device_${fingerprint}_${session.videoId}`;
      await AsyncStorage.setItem(deviceKey, JSON.stringify(viewData));

      // Log to view cache for immediate duplicate prevention
      const viewLog: ViewLog = {
        userId: currentUser?.uid,
        deviceFingerprint: fingerprint,
        videoId: session.videoId,
        timestamp: now,
        sessionId: session.sessionId
      };
      
      await this.logView(viewLog);

      // Update video view count in Firebase
      const videoRef = doc(db, 'videos', session.videoId);
      await updateDoc(videoRef, {
        views: increment(1),
        lastViewedAt: new Date().toISOString()
      });

      // Get viewer identity
      const viewerIdentity = await this.getViewerIdentity();
      
      // Record detailed view analytics
      const viewRecord: ViewRecord = {
        videoId: session.videoId,
        viewerId: viewerIdentity.primaryId,
        deviceFingerprint: session.deviceFingerprint,
        timestamp: now,
        watchTime,
        sessionId: session.sessionId,
        deviceInfo: JSON.stringify(this.deviceInfo || {}),
        visibilityScore: session.visibilityPercentage,
        isAuthenticated: viewerIdentity.isAuthenticated
      };

      // Store in views collection for analytics
      const viewDocRef = doc(db, 'views', `${session.sessionId}_${session.videoId}`);
      await setDoc(viewDocRef, viewRecord);

      console.log(`✅ View successfully recorded for video ${session.videoId}`);

    } catch (error) {
      console.error('❌ Error recording view:', error);
      throw error;
    }
  }

  /**
   * Get current view count for a video
   */
  async getViewCount(videoId: string): Promise<number> {
    try {
      const videoRef = doc(db, 'videos', videoId);
      const videoDoc = await getDoc(videoRef);
      
      if (videoDoc.exists()) {
        return videoDoc.data().views || 0;
      }
      return 0;
    } catch (error) {
      console.error('Error getting view count:', error);
      return 0;
    }
  }

  /**
   * Check if video is currently in visible area (for manual validation)
   */
  isVideoInViewport(videoElement: any): boolean {
    // This would be used with Intersection Observer in web or 
    // viewport checking in React Native
    return true; // Simplified for this implementation
  }

  /**
   * Get analytics data for views
   */
  async getViewAnalytics(videoId: string): Promise<any> {
    try {
      // This could be expanded to provide detailed analytics
      // from the views collection
      return {
        totalViews: await this.getViewCount(videoId),
        uniqueViewers: 0, // Could be calculated from views collection
        averageWatchTime: 0, // Could be calculated from views collection
        lastViewed: null
      };
    } catch (error) {
      console.error('Error getting view analytics:', error);
      return null;
    }
  }

  /**
   * Enhanced duplicate view detection with multiple criteria
   */
  private async isDuplicateView(videoId: string, sessionId: string): Promise<boolean> {
    const currentUser = getCurrentUser();
    const fingerprint = await this.initializeDeviceFingerprint();
    const now = Date.now();
    const cutoffTime = now - (this.DUPLICATE_PREVENTION_HOURS * 60 * 60 * 1000);

    // STRICT: Check if the same video was viewed recently (within 1 hour) for quick switching
    const oneHourAgo = now - (60 * 60 * 1000);
    
    console.log(`🔍 Checking duplicate view for video ${videoId}, user: ${currentUser?.uid || 'anonymous'}, device: ${fingerprint}`);

    // Check local cache first (faster and more reliable)
    const cacheKey = currentUser?.uid || fingerprint;
    const cachedLogs = this.viewLogCache.get(cacheKey) || [];
    
    // Check for any recent views of this video (stricter check)
    const recentViews = cachedLogs.filter(log => 
      log.videoId === videoId && 
      (log.timestamp > oneHourAgo) // Within 1 hour
    );

    if (recentViews.length > 0) {
      const lastView = recentViews[recentViews.length - 1];
      const timeSinceLastView = now - lastView.timestamp;
      console.log(`🚫 Duplicate view detected in cache for video ${videoId}, last viewed ${Math.round(timeSinceLastView / 1000 / 60)} minutes ago`);
      return true;
    }

    // Check for views within 24 hours for long-term duplicate prevention
    const dayViews = cachedLogs.filter(log => 
      log.videoId === videoId && 
      log.timestamp > cutoffTime
    );

    if (dayViews.length > 0) {
      console.log(`🚫 Video ${videoId} already viewed today by this user/device`);
      return true;
    }

    // Enhanced Firebase check with better error handling
    try {
      // Check both user and device in a more targeted way
      if (currentUser?.uid) {
        const userKey = `user_${currentUser.uid}_${videoId}`;
        const userViewCheck = await AsyncStorage.getItem(userKey);
        if (userViewCheck) {
          const lastUserView = JSON.parse(userViewCheck);
          if (now - lastUserView.timestamp < this.DUPLICATE_PREVENTION_HOURS * 60 * 60 * 1000) {
            console.log(`� User ${currentUser.uid} already viewed video ${videoId} recently`);
            return true;
          }
        }
      }

      // Check device fingerprint
      const deviceKey = `device_${fingerprint}_${videoId}`;
      const deviceViewCheck = await AsyncStorage.getItem(deviceKey);
      if (deviceViewCheck) {
        const lastDeviceView = JSON.parse(deviceViewCheck);
        if (now - lastDeviceView.timestamp < this.DUPLICATE_PREVENTION_HOURS * 60 * 60 * 1000) {
          console.log(`🚫 Device ${fingerprint} already viewed video ${videoId} recently`);
          return true;
        }
      }

    } catch (error) {
      console.log('🔄 Local storage check failed:', error);
    }

    console.log(`✅ No duplicate detected for video ${videoId}, allowing view`);
    return false;
  }

  /**
   * Anti-spam protection: Check if device is making too many views per hour
   */
  private async checkSpamProtection(): Promise<boolean> {
    const fingerprint = await this.initializeDeviceFingerprint();
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    const cacheKey = fingerprint;
    const cachedLogs = this.viewLogCache.get(cacheKey) || [];
    const recentViews = cachedLogs.filter(log => log.timestamp > oneHourAgo);

    if (recentViews.length >= this.MAX_VIEWS_PER_HOUR) {
      console.log(`🚫 Spam protection triggered: ${recentViews.length} views in last hour`);
      return false; // Block view
    }

    return true; // Allow view
  }

  /**
   * Update session visibility percentage
   */
  async updateVisibility(sessionId: string, visibilityPercentage: number): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.visibilityPercentage = visibilityPercentage;
      session.lastUpdateTime = Date.now();
      
      // If visibility drops below threshold, invalidate session
      if (visibilityPercentage < this.VISIBILITY_THRESHOLD) {
        session.isValid = false;
        console.log(`👁️ Session ${sessionId} invalidated due to low visibility: ${visibilityPercentage}%`);
      } else if (!session.isValid && visibilityPercentage >= this.VISIBILITY_THRESHOLD) {
        // Re-validate if visibility improves
        session.isValid = true;
        console.log(`👁️ Session ${sessionId} re-validated due to improved visibility: ${visibilityPercentage}%`);
      }
    }
  }

  /**
   * Log view to local cache and Firebase
   */
  private async logView(viewLog: ViewLog): Promise<void> {
    const cacheKey = viewLog.userId || viewLog.deviceFingerprint;
    
    // Update local cache
    const existingLogs = this.viewLogCache.get(cacheKey) || [];
    existingLogs.push(viewLog);
    this.viewLogCache.set(cacheKey, existingLogs);
    
    // Save to AsyncStorage
    await this.saveViewLogCache();
    
    // Save to Firebase for cross-device detection
    try {
      await addDoc(collection(db, 'viewLogs'), viewLog);
      console.log(`📝 View logged to Firebase: ${viewLog.videoId}`);
    } catch (error) {
      console.log('🔄 Firebase view logging failed, continuing with local cache only:', error);
      // Continue without Firebase logging - local cache is sufficient for basic duplicate prevention
    }
  }

  /**
   * Enhanced view eligibility check
   */
  private async isViewEligible(videoId: string, sessionId: string, watchTime: number): Promise<{
    eligible: boolean;
    reason?: string;
  }> {
    // Check watch time threshold
    if (watchTime < this.VIEW_THRESHOLD_MS) {
      return { eligible: false, reason: 'insufficient_watch_time' };
    }

    // Check visibility
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isValid) {
      return { eligible: false, reason: 'invalid_session' };
    }

    if (session.visibilityPercentage < this.VISIBILITY_THRESHOLD) {
      return { eligible: false, reason: 'insufficient_visibility' };
    }

    // Check for duplicates
    const isDuplicate = await this.isDuplicateView(videoId, sessionId);
    if (isDuplicate) {
      return { eligible: false, reason: 'duplicate_view' };
    }

    // Check spam protection
    const passesSpamCheck = await this.checkSpamProtection();
    if (!passesSpamCheck) {
      return { eligible: false, reason: 'spam_protection' };
    }

    return { eligible: true };
  }

  /**
   * Get view statistics for analytics
   */
  async getViewStats(): Promise<{
    totalViews: number;
    uniqueViewers: number;
    averageWatchTime: number;
    topVideos: Array<{ videoId: string; views: number }>;
  }> {
    try {
      const viewLogsSnapshot = await getDocs(collection(db, 'viewLogs'));
      const viewLogs = viewLogsSnapshot.docs.map(doc => doc.data());
      
      const uniqueViewers = new Set();
      let totalWatchTime = 0;
      const videoViews: { [videoId: string]: number } = {};
      
      viewLogs.forEach((log: any) => {
        const viewerId = log.userId || log.deviceFingerprint;
        uniqueViewers.add(viewerId);
        totalWatchTime += log.watchTime || 0;
        videoViews[log.videoId] = (videoViews[log.videoId] || 0) + 1;
      });
      
      const topVideos = Object.entries(videoViews)
        .map(([videoId, views]) => ({ videoId, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);
      
      return {
        totalViews: viewLogs.length,
        uniqueViewers: uniqueViewers.size,
        averageWatchTime: viewLogs.length > 0 ? totalWatchTime / viewLogs.length : 0,
        topVideos
      };
    } catch (error) {
      console.error('Error getting view stats:', error);
      return {
        totalViews: 0,
        uniqueViewers: 0,
        averageWatchTime: 0,
        topVideos: []
      };
    }
  }

  /**
   * Clear all view data (for testing/debugging purposes)
   */
  async clearAllViewData(): Promise<void> {
    try {
      console.log('🧹 Clearing all view tracking data...');
      
      // Clear local caches
      this.viewLogCache.clear();
      this.activeSessions.clear();
      this.trackingAttempts.clear();
      
      // Clear AsyncStorage view data
      const keys = await AsyncStorage.getAllKeys();
      const viewKeys = keys.filter(key => 
        key.startsWith('view_') || 
        key.startsWith('user_') || 
        key.startsWith('device_')
      );
      
      if (viewKeys.length > 0) {
        await AsyncStorage.multiRemove(viewKeys);
        console.log(`🧹 Cleared ${viewKeys.length} view records from local storage`);
      }
      
      // Save empty cache
      await this.saveViewLogCache();
      
      console.log('✅ All view tracking data cleared');
    } catch (error) {
      console.error('❌ Error clearing view data:', error);
    }
  }

  /**
   * Get debug info about current view tracking state
   */
  getDebugInfo(): any {
    return {
      activeSessions: Array.from(this.activeSessions.entries()),
      cachedViews: Array.from(this.viewLogCache.entries()),
      trackingAttempts: Array.from(this.trackingAttempts.entries()),
      config: {
        viewThreshold: this.VIEW_THRESHOLD_MS,
        duplicatePrevention: this.DUPLICATE_PREVENTION_HOURS,
        maxViewsPerHour: this.MAX_VIEWS_PER_HOUR,
        trackingDebounce: this.TRACKING_DEBOUNCE_MS
      }
    };
  }
}

// Export singleton instance
export const viewTracker = new ViewTrackingService();
export default ViewTrackingService;
