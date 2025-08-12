import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    increment,
    limit as limitQuery,
    orderBy,
    query,
    setDoc,
    startAfter,
    updateDoc,
    where
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Types
export interface UserProfile {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  isPrivate: boolean;
  createdAt: string;
  followers: number;
  following: number;
  posts: number;
  totalLikes?: number;
  isVerified?: boolean;
}

export interface ViewerState {
  isMe: boolean;
  isFollowing: boolean;
  followRequestPending: boolean;
  isBlockedByUser: boolean;
  iBlockedUser: boolean;
}

export interface ProfileStats {
  followers: number;
  following: number;
  posts: number;
  totalLikes?: number;
}

export interface MediaItem {
  id: string;
  authorId: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  createdAt: string;
  views: number;
  likes: number;
  comments: number;
}

export interface ProfileResponse {
  user: UserProfile;
  viewerState: ViewerState;
  stats: ProfileStats;
  media: {
    items: MediaItem[];
    nextCursor?: string;
  };
}

export interface FollowRelation {
  followerId: string;
  followingId: string;
  status: 'accepted' | 'pending';
  createdAt: string;
}

// Profile Service Class
class ProfileService {
  
  // Load complete profile data
  async loadProfile(profileUserId: string, viewerId: string, cursor?: string): Promise<ProfileResponse> {
    try {
      // Get user profile
      const userDoc = await getDoc(doc(db, 'users', profileUserId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const user: UserProfile = {
        id: profileUserId,
        handle: userData.username || 'user',
        displayName: userData.displayName || userData.username || 'User',
        avatarUrl: userData.photo,
        bio: userData.bio,
        isPrivate: userData.isPrivate || false,
        createdAt: userData.createdAt,
        followers: userData.followers || 0,
        following: userData.following || 0,
        posts: userData.posts || 0,
        totalLikes: userData.totalLikes || 0,
        isVerified: userData.isVerified || false,
      };

      // Initialize user counters if they don't exist
      await this.ensureUserCounters(profileUserId);

      // Get viewer state
      const viewerState = await this.getViewerState(profileUserId, viewerId);

      // Get stats (could be cached counters)
      const stats = await this.getProfileStats(profileUserId);

      // Get media based on privacy and viewer permissions
      // Handle media loading failure gracefully - don't fail the entire profile
      let media: { items: MediaItem[], nextCursor?: string } = { items: [] };
      try {
        media = await this.getProfileMedia(profileUserId, viewerId, viewerState, cursor);
      } catch (mediaError) {
        console.warn('Error loading profile media, using empty media list:', mediaError);
        // Media will default to empty array, EnhancedVideoGrid will handle its own loading
      }

      return {
        user,
        viewerState,
        stats,
        media,
      };
    } catch (error) {
      console.error('Error loading profile:', error);
      throw error;
    }
  }

  // Ensure user counters exist
  private async ensureUserCounters(userId: string): Promise<void> {
    try {
      const counterRef = doc(db, 'user_counters', userId);
      const counterDoc = await getDoc(counterRef);
      
      if (!counterDoc.exists()) {
        await setDoc(counterRef, {
          followers: 0,
          following: 0,
          posts: 0,
          totalLikes: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.warn('Could not ensure user counters (permissions issue):', error);
      // This is non-critical, profile can still function without counters
    }
  }

  // Get viewer's relationship state with profile user
  private async getViewerState(profileUserId: string, viewerId: string): Promise<ViewerState> {
    const isMe = profileUserId === viewerId;

    if (isMe) {
      return {
        isMe: true,
        isFollowing: false,
        followRequestPending: false,
        isBlockedByUser: false,
        iBlockedUser: false,
      };
    }

    try {
      // Check follow relationship
      const followQuery = query(
        collection(db, 'follows'),
        where('followerId', '==', viewerId),
        where('followingId', '==', profileUserId)
      );
      const followDocs = await getDocs(followQuery);
      const followRelation = followDocs.docs[0]?.data() as FollowRelation | undefined;

      // Check if blocked
      const blockQuery = query(
        collection(db, 'blocks'),
        where('blockerId', 'in', [viewerId, profileUserId]),
        where('blockedId', 'in', [viewerId, profileUserId])
      );
      const blockDocs = await getDocs(blockQuery);
      
      let isBlockedByUser = false;
      let iBlockedUser = false;
      
      blockDocs.docs.forEach(blockDoc => {
        const blockData = blockDoc.data();
        if (blockData.blockerId === profileUserId && blockData.blockedId === viewerId) {
          isBlockedByUser = true;
        }
        if (blockData.blockerId === viewerId && blockData.blockedId === profileUserId) {
          iBlockedUser = true;
        }
      });

      return {
        isMe: false,
        isFollowing: followRelation?.status === 'accepted',
        followRequestPending: followRelation?.status === 'pending',
        isBlockedByUser,
        iBlockedUser,
      };
    } catch (error) {
      console.warn('Error getting viewer state, falling back to default:', error);
      // Fallback to basic state if permissions fail
      return {
        isMe: false,
        isFollowing: false,
        followRequestPending: false,
        isBlockedByUser: false,
        iBlockedUser: false,
      };
    }
  }

  // Get profile statistics
  private async getProfileStats(profileUserId: string): Promise<ProfileStats> {
    try {
      // Try to get from cached counters first
      const counterDoc = await getDoc(doc(db, 'user_counters', profileUserId));
      
      if (counterDoc.exists()) {
        const data = counterDoc.data();
        return {
          followers: data.followers || 0,
          following: data.following || 0,
          posts: data.posts || 0,
          totalLikes: data.totalLikes || 0,
        };
      }
    } catch (error) {
      console.warn('Error accessing user_counters, using fallback counting:', error);
    }

    try {
      // Fallback to real-time counting (slower)
      const [followersQuery, followingQuery] = await Promise.all([
        getDocs(query(collection(db, 'follows'), where('followingId', '==', profileUserId), where('status', '==', 'accepted'))),
        getDocs(query(collection(db, 'follows'), where('followerId', '==', profileUserId), where('status', '==', 'accepted')))
      ]);

      let postsCount = 0;
      try {
        // Try to get posts count, but handle index errors gracefully
        const postsQuery = await getDocs(query(collection(db, 'videos'), where('userId', '==', profileUserId)));
        postsCount = postsQuery.size;
      } catch (indexError) {
        console.warn('Could not count posts due to index requirement, using fallback:', indexError);
        // For now, we'll leave posts as 0 and let the media grid handle its own query
        postsCount = 0;
      }

      const stats = {
        followers: followersQuery.size,
        following: followingQuery.size,
        posts: postsCount,
        totalLikes: 0, // Would need to sum from all posts
      };

      // Try to cache the results
      try {
        await setDoc(doc(db, 'user_counters', profileUserId), stats);
      } catch (cacheError) {
        console.warn('Could not cache user stats:', cacheError);
      }

      return stats;
    } catch (error) {
      console.warn('Error with fallback counting, using basic stats:', error);
      // Final fallback - use basic stats from user document or zeros
      return {
        followers: 0,
        following: 0,
        posts: 0,
        totalLikes: 0,
      };
    }
  }

  // Get user's media based on privacy settings
  private async getProfileMedia(
    profileUserId: string, 
    viewerId: string, 
    viewerState: ViewerState, 
    cursor?: string
  ): Promise<{ items: MediaItem[], nextCursor?: string }> {
    
    // Check if viewer can see media
    if (!this.canViewMedia(viewerState)) {
      return { items: [] };
    }

    try {
      let mediaQuery = query(
        collection(db, 'videos'),
        where('userId', '==', profileUserId),
        orderBy('createdAt', 'desc'),
        limitQuery(12)
      );

      if (cursor) {
        const cursorDoc = await getDoc(doc(db, 'videos', cursor));
        if (cursorDoc.exists()) {
          mediaQuery = query(
            collection(db, 'videos'),
            where('userId', '==', profileUserId),
            orderBy('createdAt', 'desc'),
            startAfter(cursorDoc),
            limitQuery(12)
          );
        }
      }

      const mediaSnapshot = await getDocs(mediaQuery);
      const items: MediaItem[] = [];
      
      mediaSnapshot.forEach(doc => {
        const data = doc.data();
        items.push({
        id: doc.id,
        authorId: data.userId,
        mediaUrl: data.playbackUrl || data.url,
        thumbnailUrl: data.thumbnailUrl,
        caption: data.caption,
        createdAt: data.createdAt,
        views: data.views || 0,
        likes: data.likes || 0,
        comments: data.comments || 0,
      });
    });

    const lastDoc = mediaSnapshot.docs[mediaSnapshot.docs.length - 1];
    const nextCursor = lastDoc?.id;

    return {
      items,
      nextCursor: items.length === 12 ? nextCursor : undefined,
    };
    } catch (error) {
      console.warn('Error loading profile media due to index requirement:', error);
      // Return empty media list as fallback
      return { items: [] };
    }
  }

  // Check if viewer can see profile media
  private canViewMedia(viewerState: ViewerState): boolean {
    if (viewerState.isMe) return true;
    if (viewerState.isBlockedByUser || viewerState.iBlockedUser) return false;
    
    // For private accounts, must be following
    // This logic will be determined by the user's privacy settings
    // For now, we'll handle it in the component based on user.isPrivate
    return true;
  }

  // Follow/Unfollow actions
  async followUser(followerId: string, followingId: string, isPrivateTarget: boolean): Promise<{ status: 'accepted' | 'pending' }> {
    const followDocId = `${followerId}_${followingId}`;
    const status = isPrivateTarget ? 'pending' : 'accepted';
    
    const followData: FollowRelation = {
      followerId,
      followingId,
      status,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'follows', followDocId), followData);

    // Update counters only if accepted
    if (status === 'accepted') {
      await this.updateFollowCounters(followerId, followingId, 'increment');
    }

    return { status };
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const followDocId = `${followerId}_${followingId}`;
    
    // Check if follow exists and is accepted
    const followDoc = await getDoc(doc(db, 'follows', followDocId));
    const wasAccepted = followDoc.exists() && followDoc.data()?.status === 'accepted';
    
    await deleteDoc(doc(db, 'follows', followDocId));

    // Update counters only if was accepted
    if (wasAccepted) {
      await this.updateFollowCounters(followerId, followingId, 'decrement');
    }
  }

  // Update follow counters
  private async updateFollowCounters(followerId: string, followingId: string, action: 'increment' | 'decrement'): Promise<void> {
    const delta = action === 'increment' ? 1 : -1;
    
    const followerCounterRef = doc(db, 'user_counters', followerId);
    const followingCounterRef = doc(db, 'user_counters', followingId);

    await Promise.all([
      updateDoc(followerCounterRef, { following: increment(delta) }),
      updateDoc(followingCounterRef, { followers: increment(delta) }),
    ]);
  }

  // Get followers list
  async getFollowersList(userId: string, cursor?: string, limitCount: number = 20): Promise<{ users: UserProfile[], nextCursor?: string }> {
    let followersQuery = query(
      collection(db, 'follows'),
      where('followingId', '==', userId),
      where('status', '==', 'accepted'),
      orderBy('createdAt', 'desc'),
      limitQuery(limitCount)
    );

    if (cursor) {
      const cursorDoc = await getDoc(doc(db, 'follows', cursor));
      if (cursorDoc.exists()) {
        followersQuery = query(
          collection(db, 'follows'),
          where('followingId', '==', userId),
          where('status', '==', 'accepted'),
          orderBy('createdAt', 'desc'),
          startAfter(cursorDoc),
          limitQuery(limitCount)
        );
      }
    }

    const followersSnapshot = await getDocs(followersQuery);
    const followerIds = followersSnapshot.docs.map(doc => doc.data().followerId);
    
    // Get user profiles for followers
    const users: UserProfile[] = [];
    for (const followerId of followerIds) {
      const userDoc = await getDoc(doc(db, 'users', followerId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        users.push({
          id: followerId,
          handle: userData.username || 'user',
          displayName: userData.displayName || userData.username || 'User',
          avatarUrl: userData.photo,
          bio: userData.bio,
          isPrivate: userData.isPrivate || false,
          createdAt: userData.createdAt,
          followers: userData.followers || 0,
          following: userData.following || 0,
          posts: userData.posts || 0,
          isVerified: userData.isVerified || false,
        });
      }
    }

    const lastDoc = followersSnapshot.docs[followersSnapshot.docs.length - 1];
    const nextCursor = lastDoc?.id;

    return {
      users,
      nextCursor: users.length === limitCount ? nextCursor : undefined,
    };
  }

  // Get following list
  async getFollowingList(userId: string, cursor?: string, limitCount: number = 20): Promise<{ users: UserProfile[], nextCursor?: string }> {
    let followingQuery = query(
      collection(db, 'follows'),
      where('followerId', '==', userId),
      where('status', '==', 'accepted'),
      orderBy('createdAt', 'desc'),
      limitQuery(limitCount)
    );

    if (cursor) {
      const cursorDoc = await getDoc(doc(db, 'follows', cursor));
      if (cursorDoc.exists()) {
        followingQuery = query(
          collection(db, 'follows'),
          where('followerId', '==', userId),
          where('status', '==', 'accepted'),
          orderBy('createdAt', 'desc'),
          startAfter(cursorDoc),
          limitQuery(limitCount)
        );
      }
    }

    const followingSnapshot = await getDocs(followingQuery);
    const followingIds = followingSnapshot.docs.map(doc => doc.data().followingId);
    
    // Get user profiles for following
    const users: UserProfile[] = [];
    for (const followingId of followingIds) {
      const userDoc = await getDoc(doc(db, 'users', followingId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        users.push({
          id: followingId,
          handle: userData.username || 'user',
          displayName: userData.displayName || userData.username || 'User',
          avatarUrl: userData.photo,
          bio: userData.bio,
          isPrivate: userData.isPrivate || false,
          createdAt: userData.createdAt,
          followers: userData.followers || 0,
          following: userData.following || 0,
          posts: userData.posts || 0,
          isVerified: userData.isVerified || false,
        });
      }
    }

    const lastDoc = followingSnapshot.docs[followingSnapshot.docs.length - 1];
    const nextCursor = lastDoc?.id;

    return {
      users,
      nextCursor: users.length === limitCount ? nextCursor : undefined,
    };
  }

  // Block/Unblock user
  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    const blockDocId = `${blockerId}_${blockedId}`;
    await setDoc(doc(db, 'blocks', blockDocId), {
      blockerId,
      blockedId,
      createdAt: new Date().toISOString(),
    });

    // Remove follow relationship if exists
    const followDocId = `${blockerId}_${blockedId}`;
    const reverseFollowDocId = `${blockedId}_${blockerId}`;
    
    await Promise.all([
      deleteDoc(doc(db, 'follows', followDocId)),
      deleteDoc(doc(db, 'follows', reverseFollowDocId)),
    ]);
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    const blockDocId = `${blockerId}_${blockedId}`;
    await deleteDoc(doc(db, 'blocks', blockDocId));
  }
}

export const profileService = new ProfileService();
