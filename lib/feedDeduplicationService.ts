/**
 * 🔄 FEED DEDUPLICATION SERVICE
 * Prevents infinite loading of the same videos
 */

interface LoadedVideo {
  id: string;
  loadedAt: number;
  source: string; // 'initial' | 'pagination' | 'refresh'
}

class FeedDeduplicationService {
  private loadedVideos: Map<string, LoadedVideo> = new Map();
  private lastLoadTime: number = 0;
  private minLoadInterval: number = 2000; // 2 seconds between loads

  /**
   * Check if videos have already been loaded recently
   */
  isDuplicateLoad(videoIds: string[], source: string = 'unknown'): boolean {
    const now = Date.now();
    
    // Prevent too frequent loading
    if (now - this.lastLoadTime < this.minLoadInterval) {
      console.log(`⏳ Feed loading too frequent, skipping (${now - this.lastLoadTime}ms ago)`);
      return true;
    }

    // Check if majority of videos are already loaded
    const alreadyLoaded = videoIds.filter(id => this.loadedVideos.has(id));
    const duplicateRatio = alreadyLoaded.length / videoIds.length;

    if (duplicateRatio > 0.8) { // More than 80% already loaded
      console.log(`🔄 Duplicate load detected: ${alreadyLoaded.length}/${videoIds.length} videos already loaded`);
      return true;
    }

    return false;
  }

  /**
   * Mark videos as loaded
   */
  markVideosLoaded(videoIds: string[], source: string = 'unknown'): void {
    const now = Date.now();
    
    videoIds.forEach(id => {
      this.loadedVideos.set(id, {
        id,
        loadedAt: now,
        source
      });
    });

    this.lastLoadTime = now;
    
    // Cleanup old entries (keep only last 1000 videos)
    if (this.loadedVideos.size > 1000) {
      this.cleanupOldEntries();
    }

    console.log(`📝 Marked ${videoIds.length} videos as loaded from ${source}`);
  }

  /**
   * Remove duplicate videos from a list
   */
  removeDuplicates<T extends { id?: string; assetId?: string }>(videos: T[]): T[] {
    const seen = new Set<string>();
    const uniqueVideos: T[] = [];

    for (const video of videos) {
      const id = video.id || video.assetId;
      if (id && !seen.has(id)) {
        seen.add(id);
        uniqueVideos.push(video);
      } else if (id) {
        console.log(`🔄 Removed duplicate video: ${id}`);
      }
    }

    if (uniqueVideos.length !== videos.length) {
      console.log(`🔄 Deduplication: ${videos.length} → ${uniqueVideos.length} videos`);
    }

    return uniqueVideos;
  }

  /**
   * Filter out recently loaded videos
   */
  filterNewVideos<T extends { id?: string; assetId?: string }>(videos: T[]): T[] {
    const newVideos = videos.filter(video => {
      const id = video.id || video.assetId;
      return id && !this.loadedVideos.has(id);
    });

    if (newVideos.length !== videos.length) {
      console.log(`🆕 New videos: ${newVideos.length}/${videos.length}`);
    }

    return newVideos;
  }

  /**
   * Clean up old entries to prevent memory bloat
   */
  private cleanupOldEntries(): void {
    const entries = Array.from(this.loadedVideos.entries());
    entries.sort((a, b) => b[1].loadedAt - a[1].loadedAt); // Sort by newest first
    
    // Keep only the newest 500 entries
    const toKeep = entries.slice(0, 500);
    this.loadedVideos.clear();
    
    toKeep.forEach(([id, data]) => {
      this.loadedVideos.set(id, data);
    });

    console.log(`🧹 Cleaned up old feed entries, kept ${toKeep.length}`);
  }

  /**
   * Reset the service (useful for refresh operations)
   */
  reset(): void {
    console.log('🔄 Resetting feed deduplication service');
    this.loadedVideos.clear();
    this.lastLoadTime = 0;
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalLoaded: number;
    loadingSources: { [source: string]: number };
    oldestEntry: number;
    newestEntry: number;
  } {
    const entries = Array.from(this.loadedVideos.values());
    const now = Date.now();
    
    const sources: { [source: string]: number } = {};
    entries.forEach(entry => {
      sources[entry.source] = (sources[entry.source] || 0) + 1;
    });

    return {
      totalLoaded: entries.length,
      loadingSources: sources,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map(e => now - e.loadedAt)) : 0,
      newestEntry: entries.length > 0 ? Math.max(...entries.map(e => now - e.loadedAt)) : 0
    };
  }

  /**
   * Check if a specific video was loaded recently
   */
  wasRecentlyLoaded(videoId: string, withinMs: number = 30000): boolean {
    const entry = this.loadedVideos.get(videoId);
    if (!entry) return false;
    
    return (Date.now() - entry.loadedAt) < withinMs;
  }
}

export const feedDeduplicationService = new FeedDeduplicationService();
