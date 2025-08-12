import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface UserProfile {
  userId: string;
  username: string;
  avatar: string;
  fullName?: string;
  bio?: string;
  isVerified?: boolean;
}

// In-memory cache for user profiles (like Glint)
const profileCache = new Map<string, UserProfile>();
const cacheExpiry = new Map<string, number>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Active listeners for real-time profile updates
const activeListeners = new Map<string, () => void>();

export class UserProfileService {
  /**
   * Get user profile with caching (Glint approach)
   * First checks cache, then fetches from Firebase if needed
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      // Check cache first
      const cached = profileCache.get(userId);
      const expiry = cacheExpiry.get(userId);
      
      if (cached && expiry && Date.now() < expiry) {
        return cached;
      }

      // Fetch from Firebase
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
                  
        // Try multiple possible avatar field names
        const avatarUrl = userData.avatar || userData.photo || userData.photoURL || userData.profilePicture || userData.image;
        
        console.log(`📄 Loading profile for ${userId}:`, {
          username: userData.username,
          avatar: avatarUrl,
          fullName: userData.fullName,
          allData: userData
        });
        
        const profile: UserProfile = {
          userId,
          username: userData.username || 'Unknown User',
          avatar: avatarUrl || 'https://via.placeholder.com/150',
          fullName: userData.fullName,
          bio: userData.bio,
          isVerified: userData.isVerified || false,
        };

        // Cache the profile
        profileCache.set(userId, profile);
        cacheExpiry.set(userId, Date.now() + CACHE_DURATION);

        return profile;
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
    return null;
  }

  /**
   * Batch fetch multiple user profiles (Glint optimization)
   * Reduces network requests when loading many comments
   */
  static async batchGetUserProfiles(userIds: string[]): Promise<{[userId: string]: UserProfile}> {
    const profiles: {[userId: string]: UserProfile} = {};
    const uncachedIds: string[] = [];

    // Check cache first
    userIds.forEach(userId => {
      const cached = profileCache.get(userId);
      const expiry = cacheExpiry.get(userId);
      
      if (cached && expiry && Date.now() < expiry) {
        profiles[userId] = cached;
      } else {
        uncachedIds.push(userId);
      }
    });

    // Fetch uncached profiles
    if (uncachedIds.length > 0) {
      const fetchPromises = uncachedIds.map(userId => this.getUserProfile(userId));
      const fetchedProfiles = await Promise.all(fetchPromises);
      
      fetchedProfiles.forEach(profile => {
        if (profile) {
          profiles[profile.userId] = profile;
        }
      });
    }

    return profiles;
  }

  /**
   * Subscribe to real-time profile updates (Glint feature)
   * When a user updates their profile, all comments automatically reflect changes
   */
  static subscribeToProfileUpdates(userId: string, callback: (profile: UserProfile | null) => void): () => void {
    // Clean up existing listener if any
    const existingUnsubscribe = activeListeners.get(userId);
    if (existingUnsubscribe) {
      existingUnsubscribe();
    }

    const unsubscribe = onSnapshot(
      doc(db, 'users', userId),
      (doc) => {
        if (doc.exists()) {
          const userData = doc.data();
          
          // Try multiple possible avatar field names
          const avatarUrl = userData.avatar || userData.photo || userData.photoURL || userData.profilePicture || userData.image;
          
          const profile: UserProfile = {
            userId,
            username: userData.username || 'Unknown User',
            avatar: avatarUrl || 'https://via.placeholder.com/150',
            fullName: userData.fullName,
            bio: userData.bio,
            isVerified: userData.isVerified || false,
          };

          // Update cache
          profileCache.set(userId, profile);
          cacheExpiry.set(userId, Date.now() + CACHE_DURATION);

          callback(profile);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error('Error listening to profile updates:', error);
        callback(null);
      }
    );

    activeListeners.set(userId, unsubscribe);
    return unsubscribe;
  }

  /**
   * Clear cache for a specific user (useful when profile is updated)
   */
  static invalidateUserCache(userId: string): void {
    profileCache.delete(userId);
    cacheExpiry.delete(userId);
  }

  /**
   * Clear all cached profiles
   */
  static clearAllCache(): void {
    profileCache.clear();
    cacheExpiry.clear();
  }

  /**
   * Get cached profile without network request
   */
  static getCachedProfile(userId: string): UserProfile | null {
    const cached = profileCache.get(userId);
    const expiry = cacheExpiry.get(userId);
    
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }
    return null;
  }

  /**
   * Preload profiles for better UX (Glint optimization)
   */
  static async preloadProfiles(userIds: string[]): Promise<void> {
    const uncachedIds = userIds.filter(userId => !this.getCachedProfile(userId));
    if (uncachedIds.length > 0) {
      await this.batchGetUserProfiles(uncachedIds);
    }
  }

  /**
   * Clean up all active listeners
   */
  static cleanup(): void {
    activeListeners.forEach(unsubscribe => unsubscribe());
    activeListeners.clear();
  }
}
