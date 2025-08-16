/**
 * 🛡️ MEMORY MANAGEMENT SERVICE
 * Prevents memory leaks and manages video player resources
 */

interface VideoPlayerRef {
  id: string;
  ref: any;
  lastUsed: number;
  isActive: boolean;
}

class MemoryManagementService {
  private videoRefs: Map<string, VideoPlayerRef> = new Map();
  private cleanupTimer: any = null;
  private maxVideoRefs = 5; // Maximum video players in memory
  private cleanupInterval = 30000; // 30 seconds

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Register a video player ref
   */
  registerVideoRef(videoId: string, ref: any): void {
    // If we're at the limit, cleanup oldest refs
    if (this.videoRefs.size >= this.maxVideoRefs) {
      this.cleanupOldestRefs();
    }

    this.videoRefs.set(videoId, {
      id: videoId,
      ref,
      lastUsed: Date.now(),
      isActive: false
    });

    console.log(`🧠 Registered video ref: ${videoId}, total: ${this.videoRefs.size}`);
  }

  /**
   * Mark video as active (currently playing)
   */
  activateVideo(videoId: string): void {
    const videoRef = this.videoRefs.get(videoId);
    if (videoRef) {
      videoRef.isActive = true;
      videoRef.lastUsed = Date.now();
    }
  }

  /**
   * Mark video as inactive
   */
  deactivateVideo(videoId: string): void {
    const videoRef = this.videoRefs.get(videoId);
    if (videoRef) {
      videoRef.isActive = false;
    }
  }

  /**
   * Update last used timestamp
   */
  touchVideo(videoId: string): void {
    const videoRef = this.videoRefs.get(videoId);
    if (videoRef) {
      videoRef.lastUsed = Date.now();
    }
  }

  /**
   * Cleanup oldest video refs
   */
  private cleanupOldestRefs(): void {
    const inactiveRefs = Array.from(this.videoRefs.values())
      .filter(ref => !ref.isActive)
      .sort((a, b) => a.lastUsed - b.lastUsed);

    // Remove the oldest inactive refs
    const toRemove = inactiveRefs.slice(0, Math.max(1, this.videoRefs.size - this.maxVideoRefs + 1));
    
    toRemove.forEach(ref => {
      this.cleanupVideoRef(ref.id);
    });
  }

  /**
   * Cleanup a specific video ref
   */
  private cleanupVideoRef(videoId: string): void {
    const videoRef = this.videoRefs.get(videoId);
    if (videoRef && !videoRef.isActive) {
      try {
        // Attempt to cleanup the video ref
        if (videoRef.ref && typeof videoRef.ref.unloadAsync === 'function') {
          videoRef.ref.unloadAsync();
        }
        this.videoRefs.delete(videoId);
        console.log(`🧹 Cleaned up video ref: ${videoId}`);
      } catch (error) {
        console.warn(`⚠️ Error cleaning up video ref ${videoId}:`, error);
        // Force remove even if cleanup fails
        this.videoRefs.delete(videoId);
      }
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.performMaintenanceCleanup();
    }, this.cleanupInterval);
  }

  /**
   * Perform maintenance cleanup
   */
  private performMaintenanceCleanup(): void {
    const now = Date.now();
    const maxAge = 60000; // 1 minute

    const toCleanup = Array.from(this.videoRefs.entries())
      .filter(([_, ref]) => !ref.isActive && (now - ref.lastUsed) > maxAge)
      .map(([id, _]) => id);

    toCleanup.forEach(id => this.cleanupVideoRef(id));

    if (toCleanup.length > 0) {
      console.log(`🧹 Maintenance cleanup: removed ${toCleanup.length} old video refs`);
    }
  }

  /**
   * Force cleanup all video refs
   */
  cleanup(): void {
    Array.from(this.videoRefs.keys()).forEach(id => {
      this.cleanupVideoRef(id);
    });

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    console.log('🧹 Memory management service cleaned up');
  }

  /**
   * Get memory usage stats
   */
  getMemoryStats(): {
    totalRefs: number;
    activeRefs: number;
    inactiveRefs: number;
    oldestRefAge: number;
  } {
    const refs = Array.from(this.videoRefs.values());
    const now = Date.now();
    
    return {
      totalRefs: refs.length,
      activeRefs: refs.filter(ref => ref.isActive).length,
      inactiveRefs: refs.filter(ref => !ref.isActive).length,
      oldestRefAge: refs.length > 0 ? Math.max(...refs.map(ref => now - ref.lastUsed)) : 0
    };
  }
}

export const memoryManagementService = new MemoryManagementService();
