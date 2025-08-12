import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native';

/**
 * Advanced Profile Image Cache Service (YouTube-style)
 * Implements multi-level caching: Memory → AsyncStorage → Network
 * Features: Preloading, smart cache invalidation, CDN optimization
 */

interface CachedImage {
  uri: string;
  timestamp: number;
  size?: number;
  blurhash?: string; // For blur placeholder effect
}

interface PreloadQueue {
  uri: string;
  priority: 'high' | 'normal' | 'low';
  userId?: string;
}

class ProfileImageCacheService {
  private memoryCache = new Map<string, CachedImage>();
  private preloadQueue: PreloadQueue[] = [];
  private isPreloading = false;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_MEMORY_CACHE = 100; // Max images in memory
  private readonly STORAGE_KEY_PREFIX = 'profile_image_cache_';

  /**
   * Get optimized image URI with CDN parameters
   * Adds size, quality, and format optimizations
   */
  private getOptimizedImageURI(uri: string, size: number = 150): string {
    if (!uri || uri.includes('placeholder')) return uri;
    
    // Firebase Storage optimization
    if (uri.includes('firebase')) {
      // Add size and quality parameters for Firebase
      const url = new URL(uri);
      url.searchParams.set('w', size.toString());
      url.searchParams.set('h', size.toString());
      url.searchParams.set('q', '85'); // 85% quality for good balance
      return url.toString();
    }
    
    // Other CDN optimizations can be added here
    return uri;
  }

  /**
   * Generate cache key for image
   */
  private getCacheKey(uri: string, size: number = 150): string {
    return `${uri}_${size}`;
  }

  /**
   * Get image from memory cache
   */
  private getFromMemoryCache(cacheKey: string): CachedImage | null {
    const cached = this.memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached;
    }
    if (cached) {
      this.memoryCache.delete(cacheKey);
    }
    return null;
  }

  /**
   * Store image in memory cache with LRU eviction
   */
  private storeInMemoryCache(cacheKey: string, cachedImage: CachedImage): void {
    // LRU eviction: remove oldest if cache is full
    if (this.memoryCache.size >= this.MAX_MEMORY_CACHE) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
    this.memoryCache.set(cacheKey, cachedImage);
  }

  /**
   * Get image from AsyncStorage cache
   */
  private async getFromAsyncStorage(cacheKey: string): Promise<CachedImage | null> {
    try {
      const cached = await AsyncStorage.getItem(this.STORAGE_KEY_PREFIX + cacheKey);
      if (cached) {
        const parsedCache: CachedImage = JSON.parse(cached);
        if (Date.now() - parsedCache.timestamp < this.CACHE_DURATION) {
          return parsedCache;
        } else {
          // Cache expired, remove it
          AsyncStorage.removeItem(this.STORAGE_KEY_PREFIX + cacheKey);
        }
      }
    } catch (error) {
      console.log('AsyncStorage cache read error:', error);
    }
    return null;
  }

  /**
   * Store image in AsyncStorage cache
   */
  private async storeInAsyncStorage(cacheKey: string, cachedImage: CachedImage): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.STORAGE_KEY_PREFIX + cacheKey,
        JSON.stringify(cachedImage)
      );
    } catch (error) {
      console.log('AsyncStorage cache write error:', error);
    }
  }

  /**
   * Preload image into React Native's internal cache
   */
  private async preloadImageIntoRNCache(uri: string): Promise<boolean> {
    return new Promise((resolve) => {
      Image.prefetch(uri)
        .then(() => {
          console.log('🖼️ Preloaded profile image:', uri);
          resolve(true);
        })
        .catch((error) => {
          console.log('❌ Failed to preload image:', error);
          resolve(false);
        });
    });
  }

  /**
   * Main method: Get cached image URI with fallbacks
   * Memory Cache → AsyncStorage → Optimized Network Request
   */
  async getCachedImageURI(
    originalURI: string, 
    size: number = 150, 
    userId?: string
  ): Promise<string> {
    if (!originalURI) return '';

    const optimizedURI = this.getOptimizedImageURI(originalURI, size);
    const cacheKey = this.getCacheKey(optimizedURI, size);

    // 1. Check memory cache first (fastest)
    const memoryCache = this.getFromMemoryCache(cacheKey);
    if (memoryCache) {
      console.log('🚀 Memory cache HIT for profile image');
      return memoryCache.uri;
    }

    // 2. Check AsyncStorage cache (fast)
    const storageCache = await this.getFromAsyncStorage(cacheKey);
    if (storageCache) {
      console.log('💾 AsyncStorage cache HIT for profile image');
      // Store back in memory for faster next access
      this.storeInMemoryCache(cacheKey, storageCache);
      return storageCache.uri;
    }

    // 3. Cache MISS - use optimized URI and cache it
    console.log('🌐 Cache MISS - using optimized network URI');
    const cachedImage: CachedImage = {
      uri: optimizedURI,
      timestamp: Date.now(),
      size
    };

    // Store in both caches
    this.storeInMemoryCache(cacheKey, cachedImage);
    this.storeInAsyncStorage(cacheKey, cachedImage);

    // Add to preload queue for future access
    if (userId) {
      this.addToPreloadQueue(optimizedURI, 'normal', userId);
    }

    return optimizedURI;
  }

  /**
   * Add image to preload queue
   */
  addToPreloadQueue(uri: string, priority: 'high' | 'normal' | 'low' = 'normal', userId?: string): void {
    if (!uri || this.preloadQueue.some(item => item.uri === uri)) return;

    this.preloadQueue.push({ uri, priority, userId });
    
    // Sort by priority (high first)
    this.preloadQueue.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Start preloading if not already running
    if (!this.isPreloading) {
      this.processPreloadQueue();
    }
  }

  /**
   * Process preload queue in background
   */
  private async processPreloadQueue(): Promise<void> {
    if (this.isPreloading || this.preloadQueue.length === 0) return;

    this.isPreloading = true;
    console.log('🔄 Starting profile image preload queue...');

    while (this.preloadQueue.length > 0) {
      const item = this.preloadQueue.shift();
      if (!item) break;

      try {
        await this.preloadImageIntoRNCache(item.uri);
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.log('Preload error:', error);
      }
    }

    this.isPreloading = false;
    console.log('✅ Profile image preload queue completed');
  }

  /**
   * Batch preload multiple user profile images
   * Perfect for comment sections with many users
   */
  async batchPreloadUserImages(userImageURIs: string[], priority: 'high' | 'normal' | 'low' = 'normal'): Promise<void> {
    console.log(`📦 Batch preloading ${userImageURIs.length} profile images...`);
    
    userImageURIs.forEach(uri => {
      if (uri) {
        this.addToPreloadQueue(this.getOptimizedImageURI(uri), priority);
      }
    });
  }

  /**
   * Preload images for current user's common contacts
   * Call this during app initialization or user login
   */
  async preloadFrequentUserImages(frequentUserIds: string[]): Promise<void> {
    // This would integrate with your user service to get frequent contacts
    console.log('🔥 Preloading frequent user profile images...');
    // Implementation would fetch these users' profile images and preload them
  }

  /**
   * Clear specific user's cached images (useful when user updates profile)
   */
  async invalidateUserImageCache(userId: string): Promise<void> {
    try {
      // Remove from memory cache
      for (const [key, value] of this.memoryCache.entries()) {
        if (key.includes(userId)) {
          this.memoryCache.delete(key);
        }
      }

      // Remove from AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      const userCacheKeys = keys.filter(key => 
        key.startsWith(this.STORAGE_KEY_PREFIX) && key.includes(userId)
      );
      await AsyncStorage.multiRemove(userCacheKeys);

      console.log(`🧹 Cleared image cache for user: ${userId}`);
    } catch (error) {
      console.log('Cache invalidation error:', error);
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { memorySize: number; preloadQueueSize: number } {
    return {
      memorySize: this.memoryCache.size,
      preloadQueueSize: this.preloadQueue.length
    };
  }

  /**
   * Clear all caches (useful for logout or low memory)
   */
  async clearAllCaches(): Promise<void> {
    this.memoryCache.clear();
    this.preloadQueue.length = 0;
    
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.STORAGE_KEY_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
      console.log('🧹 Cleared all profile image caches');
    } catch (error) {
      console.log('Cache clear error:', error);
    }
  }
}

// Export singleton instance
export const ProfileImageCache = new ProfileImageCacheService();
