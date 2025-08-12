import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    Unsubscribe,
    where
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { notificationService } from './notificationService';

export interface FollowRelationship {
  followerId: string;
  followingId: string;
  createdAt: any;
}

export interface UserFollowStats {
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}

class FollowService {
  private followListeners: Map<string, Unsubscribe> = new Map();
  private followStatsCache: Map<string, { stats: UserFollowStats; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  // Add operation tracking to prevent duplicate operations
  private pendingOperations: Map<string, Promise<boolean>> = new Map();
  private lastOperationTime: Map<string, number> = new Map();
  private readonly DEBOUNCE_TIME = 1000; // 1 second debounce

  /**
   * Follow a user with debouncing and duplicate prevention
   */
  async followUser(currentUserId: string, targetUserId: string): Promise<boolean> {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
      console.warn('Invalid follow attempt:', { currentUserId, targetUserId });
      return false;
    }

    const operationKey = `${currentUserId}_${targetUserId}_follow`;
    
    // Check for recent operation (debouncing)
    const lastOperation = this.lastOperationTime.get(operationKey);
    const now = Date.now();
    if (lastOperation && (now - lastOperation) < this.DEBOUNCE_TIME) {
      console.log(`⏱️ Follow operation debounced for ${operationKey}`);
      return false;
    }

    // Check if operation is already pending
    const pendingOperation = this.pendingOperations.get(operationKey);
    if (pendingOperation) {
      console.log(`⏳ Follow operation already pending for ${operationKey}`);
      return pendingOperation;
    }

    // Set operation time
    this.lastOperationTime.set(operationKey, now);

    // Create and track the operation
    const operation = this.executeFollowOperation(currentUserId, targetUserId);
    this.pendingOperations.set(operationKey, operation);

    try {
      const result = await operation;
      return result;
    } finally {
      // Clean up pending operation
      this.pendingOperations.delete(operationKey);
    }
  }

  /**
   * Execute the actual follow operation
   */
  private async executeFollowOperation(currentUserId: string, targetUserId: string): Promise<boolean> {
    try {
      const followId = `${currentUserId}_${targetUserId}`;
      const followRef = doc(db, 'follows', followId);

      // Check if already following to prevent duplicates
      const existingFollow = await getDoc(followRef);
      if (existingFollow.exists()) {
        console.log(`⚠️ User ${currentUserId} already follows ${targetUserId}`);
        return true; // Return true since the desired state is achieved
      }

      await setDoc(followRef, {
        followerId: currentUserId,
        followingId: targetUserId,
        createdAt: serverTimestamp()
      });

      console.log(`✅ User ${currentUserId} followed ${targetUserId}`);
      
      // Clear cache for both users
      this.followStatsCache.delete(currentUserId);
      this.followStatsCache.delete(targetUserId);

      // Send follow notification (non-blocking)
      this.sendFollowNotificationSafely(currentUserId, targetUserId);
      
      return true;
    } catch (error) {
      console.error('❌ Error following user:', error);
      return false;
    }
  }

  /**
   * Send follow notification with better error handling
   */
  private async sendFollowNotificationSafely(currentUserId: string, targetUserId: string): Promise<void> {
    try {
      // Get follower's profile to include in notification
      const followerDoc = await getDoc(doc(db, 'users', currentUserId));
      if (followerDoc.exists()) {
        const followerData = followerDoc.data();
        
        // Use a simpler notification approach that doesn't require complex permissions
        const notificationData = {
          userId: targetUserId,
          fromUserId: currentUserId,
          type: 'follow',
          title: 'New Follower',
          message: `${followerData.username || 'Someone'} started following you`,
          data: {
            username: followerData.username || 'Someone',
            avatar: followerData.avatar || ''
          },
          read: false,
          createdAt: serverTimestamp()
        };

        // Add notification directly to Firestore
        await addDoc(collection(db, 'notifications'), notificationData);
        console.log(`✅ Follow notification sent successfully`);
      }
    } catch (notificationError) {
      console.warn('⚠️ Failed to send follow notification:', notificationError);
      // Don't fail the follow operation if notification fails
    }
  }

  /**
   * Unfollow a user with debouncing and duplicate prevention
   */
  async unfollowUser(currentUserId: string, targetUserId: string): Promise<boolean> {
    if (!currentUserId || !targetUserId) {
      console.warn('Invalid unfollow attempt:', { currentUserId, targetUserId });
      return false;
    }

    const operationKey = `${currentUserId}_${targetUserId}_unfollow`;
    
    // Check for recent operation (debouncing)
    const lastOperation = this.lastOperationTime.get(operationKey);
    const now = Date.now();
    if (lastOperation && (now - lastOperation) < this.DEBOUNCE_TIME) {
      console.log(`⏱️ Unfollow operation debounced for ${operationKey}`);
      return false;
    }

    // Check if operation is already pending
    const pendingOperation = this.pendingOperations.get(operationKey);
    if (pendingOperation) {
      console.log(`⏳ Unfollow operation already pending for ${operationKey}`);
      return pendingOperation;
    }

    // Set operation time
    this.lastOperationTime.set(operationKey, now);

    // Create and track the operation
    const operation = this.executeUnfollowOperation(currentUserId, targetUserId);
    this.pendingOperations.set(operationKey, operation);

    try {
      const result = await operation;
      return result;
    } finally {
      // Clean up pending operation
      this.pendingOperations.delete(operationKey);
    }
  }

  /**
   * Execute the actual unfollow operation
   */
  private async executeUnfollowOperation(currentUserId: string, targetUserId: string): Promise<boolean> {
    try {
      const followId = `${currentUserId}_${targetUserId}`;
      const followRef = doc(db, 'follows', followId);

      // Check if the follow relationship exists
      const existingFollow = await getDoc(followRef);
      if (!existingFollow.exists()) {
        console.log(`⚠️ User ${currentUserId} is not following ${targetUserId}`);
        return true; // Return true since the desired state is achieved
      }

      await deleteDoc(followRef);

      console.log(`✅ User ${currentUserId} unfollowed ${targetUserId}`);
      
      // Clear cache for both users
      this.followStatsCache.delete(currentUserId);
      this.followStatsCache.delete(targetUserId);
      
      return true;
    } catch (error) {
      console.error('❌ Error unfollowing user:', error);
      return false;
    }
  }

  /**
   * Check if current user is following target user
   */
  async isFollowing(currentUserId: string, targetUserId: string): Promise<boolean> {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
      return false;
    }

    try {
      const followId = `${currentUserId}_${targetUserId}`;
      const followRef = doc(db, 'follows', followId);
      const followDoc = await getDoc(followRef);

      return followDoc.exists();
    } catch (error) {
      console.error('❌ Error checking follow status:', error);
      return false;
    }
  }

  /**
   * Get follow statistics for a user
   */
  async getUserFollowStats(userId: string, currentUserId?: string): Promise<UserFollowStats> {
    if (!userId) {
      return { followersCount: 0, followingCount: 0, isFollowing: false };
    }

    try {
      // Check cache first
      const cached = this.followStatsCache.get(userId);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        return cached.stats;
      }

      // Get followers count
      const followersQuery = query(
        collection(db, 'follows'),
        where('followingId', '==', userId)
      );
      const followersSnapshot = await getDocs(followersQuery);
      const followersCount = followersSnapshot.size;

      // Get following count
      const followingQuery = query(
        collection(db, 'follows'),
        where('followerId', '==', userId)
      );
      const followingSnapshot = await getDocs(followingQuery);
      const followingCount = followingSnapshot.size;

      // Check if current user is following this user
      let isFollowing = false;
      if (currentUserId && currentUserId !== userId) {
        isFollowing = await this.isFollowing(currentUserId, userId);
      }

      const stats: UserFollowStats = {
        followersCount,
        followingCount,
        isFollowing
      };

      // Cache the results
      this.followStatsCache.set(userId, {
        stats,
        timestamp: Date.now()
      });

      return stats;
    } catch (error) {
      console.error('❌ Error getting follow stats:', error);
      return { followersCount: 0, followingCount: 0, isFollowing: false };
    }
  }

  /**
   * Get list of users that the current user is following
   */
  async getFollowing(userId: string, limit: number = 50): Promise<string[]> {
    if (!userId) return [];

    try {
      const followingQuery = query(
        collection(db, 'follows'),
        where('followerId', '==', userId)
      );
      
      const followingSnapshot = await getDocs(followingQuery);
      return followingSnapshot.docs.map(doc => doc.data().followingId);
    } catch (error) {
      console.error('❌ Error getting following list:', error);
      return [];
    }
  }

  /**
   * Get list of users that follow the current user
   */
  async getFollowers(userId: string, limit: number = 50): Promise<string[]> {
    if (!userId) return [];

    try {
      const followersQuery = query(
        collection(db, 'follows'),
        where('followingId', '==', userId)
      );
      
      const followersSnapshot = await getDocs(followersQuery);
      return followersSnapshot.docs.map(doc => doc.data().followerId);
    } catch (error) {
      console.error('❌ Error getting followers list:', error);
      return [];
    }
  }

  /**
   * Set up real-time listener for follow status changes
   */
  setupFollowListener(
    currentUserId: string, 
    targetUserId: string, 
    callback: (isFollowing: boolean) => void
  ): Unsubscribe | null {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
      return null;
    }

    try {
      const followId = `${currentUserId}_${targetUserId}`;
      const followRef = doc(db, 'follows', followId);

      const unsubscribe = onSnapshot(followRef, (doc) => {
        callback(doc.exists());
      });

      // Store listener for cleanup
      this.followListeners.set(followId, unsubscribe);
      
      return unsubscribe;
    } catch (error) {
      console.error('❌ Error setting up follow listener:', error);
      return null;
    }
  }

  /**
   * Clean up follow listeners
   */
  cleanupFollowListeners() {
    this.followListeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.followListeners.clear();
  }

  /**
   * Toggle follow status (follow if not following, unfollow if following) with enhanced debouncing
   */
  async toggleFollow(currentUserId: string, targetUserId: string): Promise<boolean> {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
      return false;
    }

    const operationKey = `${currentUserId}_${targetUserId}_toggle`;
    
    // Check for recent operation (debouncing)
    const lastOperation = this.lastOperationTime.get(operationKey);
    const now = Date.now();
    if (lastOperation && (now - lastOperation) < this.DEBOUNCE_TIME) {
      console.log(`⏱️ Toggle follow operation debounced for ${operationKey}`);
      return false;
    }

    // Check if operation is already pending
    const pendingOperation = this.pendingOperations.get(operationKey);
    if (pendingOperation) {
      console.log(`⏳ Toggle follow operation already pending for ${operationKey}`);
      return pendingOperation;
    }

    // Set operation time
    this.lastOperationTime.set(operationKey, now);

    try {
      const isCurrentlyFollowing = await this.isFollowing(currentUserId, targetUserId);
      
      let result: boolean;
      if (isCurrentlyFollowing) {
        console.log(`🔄 Toggling to unfollow: ${currentUserId} -> ${targetUserId}`);
        result = await this.executeUnfollowOperation(currentUserId, targetUserId);
      } else {
        console.log(`🔄 Toggling to follow: ${currentUserId} -> ${targetUserId}`);
        result = await this.executeFollowOperation(currentUserId, targetUserId);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error toggling follow status:', error);
      return false;
    }
  }

  /**
   * Clear all caches and pending operations
   */
  clearCache() {
    this.followStatsCache.clear();
    this.pendingOperations.clear();
    this.lastOperationTime.clear();
  }

  /**
   * Clear specific user operations (useful for logout)
   */
  clearUserOperations(userId: string) {
    // Clear operations for this user
    const keysToDelete: string[] = [];
    this.pendingOperations.forEach((_, key) => {
      if (key.includes(userId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => {
      this.pendingOperations.delete(key);
      this.lastOperationTime.delete(key);
    });
    
    // Clear cache for this user
    this.followStatsCache.delete(userId);
  }
}

// Export singleton instance
export const followService = new FollowService();
export default followService;
