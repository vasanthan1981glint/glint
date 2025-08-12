// Advanced Comment Service - YouTube/Glint-style optimizations
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { CommentCountService } from './commentCountService';

export interface Comment {
  id: string;
  user: string;
  userId: string;
  text: string;
  avatar: string;
  timestamp: Date | any;
  postId: string;
  likes?: number;
  replies?: Comment[];
  isEdited?: boolean;
  parentCommentId?: string | null; // For replies
}

export interface PaginatedComments {
  comments: Comment[];
  hasMore: boolean;
  lastDoc: any;
  totalCount: number;
}

class CommentService {
  private cache = new Map<string, PaginatedComments>();
  private readonly COMMENTS_PER_PAGE = 20;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private subscribers = new Map<string, () => void>();

  // 1. OPTIMIZED PAGINATION - Load comments in chunks (simplified for now)
  async getComments(
    postId: string, 
    pageSize: number = this.COMMENTS_PER_PAGE,
    paginationDoc?: any,
    bypassCache: boolean = false
  ): Promise<PaginatedComments> {
    try {
      // Check cache first only if not bypassing cache (Principle #3: Caching)
      const cacheKey = `${postId}_${paginationDoc?.id || 'first'}`;
      
      if (!bypassCache) {
        const cached = this.cache.get(cacheKey);
        if (cached && this.isCacheValid(cacheKey)) {
          console.log('📋 Serving comments from cache');
          return cached;
        }
      } else {
        console.log('🚫 Bypassing cache for fresh data');
      }

      // Improved query: filter by postId server-side and paginate
      let q = query(
        collection(db, 'comments'),
        where('postId', '==', postId),
        where('parentCommentId', '==', null),
        orderBy('timestamp', 'desc'),
        limit(pageSize + 1) // Get one extra to check if there are more
      );

      if (paginationDoc) {
        q = query(q, startAfter(paginationDoc));
      }

      const snapshot = await getDocs(q);
      const comments: Comment[] = [];
      snapshot.docs.forEach((doc, index) => {
        if (index < pageSize) {
          const data = doc.data();
          let timestamp: Date;
          if (data.timestamp) {
            if (typeof data.timestamp.toDate === 'function') {
              timestamp = data.timestamp.toDate();
            } else if (data.timestamp instanceof Date) {
              timestamp = data.timestamp;
            } else if (typeof data.timestamp === 'number') {
              timestamp = new Date(data.timestamp);
            } else if (typeof data.timestamp === 'string') {
              timestamp = new Date(data.timestamp);
            } else {
              timestamp = new Date();
            }
          } else {
            timestamp = new Date();
          }
          comments.push({
            id: doc.id,
            ...data,
            timestamp: timestamp
          } as Comment);
        }
      });

      await this.attachReplyCounts(comments);
      
      // Load replies for each comment
      await this.loadRepliesForComments(comments);
      
      // Load likes for each comment
      await this.loadLikesForComments(comments);

      const hasMore = snapshot.docs.length > pageSize;
      const nextPaginationDoc = hasMore ? snapshot.docs[pageSize - 1] : snapshot.docs[snapshot.docs.length - 1] || null;

      const result: PaginatedComments = {
        comments,
        hasMore,
        lastDoc: nextPaginationDoc,
        totalCount: await CommentCountService.getCommentCount(postId)
      };
      this.cache.set(cacheKey, result);
      setTimeout(() => this.cache.delete(cacheKey), this.CACHE_DURATION);

      console.log(`📊 Loaded ${comments.length} comments for post ${postId}`);
      return result;

    } catch (error) {
      console.error('Error fetching comments:', error);
      throw error;
    }
  }

  // 2. REALTIME UPDATES - Simplified to avoid complex indexes
  subscribeToNewComments(
    postId: string, 
    onNewComment: (comment: Comment) => void,
    onCommentDeleted?: (commentId: string) => void
  ): () => void {
    console.log(`🔴 LIVE: Subscribing to new comments for post ${postId}`);
    
    // Simplified query - get recent comments and filter client-side
    const q = query(
      collection(db, 'comments'),
      orderBy('timestamp', 'desc'),
      limit(20) // Get recent comments
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          
          // Filter client-side for now
          if (data.postId === postId && !data.parentCommentId) {
            // Handle various timestamp formats from Firebase
            let timestamp: Date;
            if (data.timestamp) {
              if (typeof data.timestamp.toDate === 'function') {
                // Firestore Timestamp object
                timestamp = data.timestamp.toDate();
              } else if (data.timestamp instanceof Date) {
                // Already a Date object
                timestamp = data.timestamp;
              } else if (typeof data.timestamp === 'number') {
                // Unix timestamp
                timestamp = new Date(data.timestamp);
              } else if (typeof data.timestamp === 'string') {
                // ISO string
                timestamp = new Date(data.timestamp);
              } else {
                // Fallback to current time
                timestamp = new Date();
              }
            } else {
              // No timestamp provided
              timestamp = new Date();
            }
            
            const comment = {
              id: change.doc.id,
              ...data,
              timestamp: timestamp
            } as Comment;
            
            console.log('🔴 LIVE: New comment received:', comment.text.substring(0, 30) + '...');
            onNewComment(comment);
          }
        } else if (change.type === 'removed' && onCommentDeleted) {
          // Handle real-time comment deletions
          const data = change.doc.data();
          if (data.postId === postId) {
            console.log('🔴 LIVE: Comment deleted:', change.doc.id);
            onCommentDeleted(change.doc.id);
          }
        }
      });
    });

    this.subscribers.set(postId, unsubscribe);
    return unsubscribe;
  }

  // 3. ASYNCHRONOUS COMMENT POSTING - Instant UI update, background processing
  async addComment(
    postId: string,
    text: string,
    userId: string,
    userInfo: { username: string; avatar: string },
    parentCommentId?: string
  ): Promise<Comment> {
    // Create optimistic comment for instant UI (Principle #6: Async Processing)
    const optimisticComment: Comment = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user: userInfo.username,
      userId,
      text: text.trim(),
      avatar: userInfo.avatar,
      timestamp: new Date(),
      postId,
      likes: 0,
      parentCommentId: parentCommentId || null,
      replies: []
    };

  try {
    // Add comment to Firestore first
    const commentData = {
      user: userInfo.username,
      userId,
      text: text.trim(),
      avatar: userInfo.avatar,
      timestamp: serverTimestamp(),
      postId,
      likes: 0,
      parentCommentId: parentCommentId || null,
      // Add metadata for moderation/analytics
      metadata: {
        ipHash: 'hashed_ip', // In real app, hash user IP
        userAgent: 'app_version',
        language: 'en',
        createdAt: serverTimestamp()
      }
    };

    const docRef = await addDoc(collection(db, 'comments'), commentData);
    console.log(`💬 Comment added: ${docRef.id} to post ${postId}`);

    // Use accurate comment count service (only for top-level comments)
    if (!parentCommentId) {
      const newCount = await CommentCountService.incrementCommentCount(postId);
      console.log(`✅ Comment added, new count: ${newCount}`);
    }

    // If it's a reply, update parent comment reply count
    if (parentCommentId) {
      try {
        const parentRef = doc(db, 'comments', parentCommentId);
        await updateDoc(parentRef, {
          replyCount: increment(1)
        });
        console.log('✅ Updated parent comment reply count');
      } catch (parentError) {
        console.log('ℹ️ Parent comment does not exist, skipping reply count update');
      }
    }

    // Return the comment with real ID
    const realComment = {
      ...optimisticComment,
      id: docRef.id
    };

    // Invalidate cache
    this.invalidateCache(postId);

    console.log('✅ Comment successfully saved to database');
    return realComment;

    } catch (error) {
      console.error('❌ Failed to save comment:', error);
      throw error;
    }
  }

  // 4. OPTIMIZED REPLY LOADING - Load replies on demand
  async getReplies(commentId: string): Promise<Comment[]> {
    try {
      const q = query(
        collection(db, 'comments'),
        where('parentCommentId', '==', commentId),
        orderBy('timestamp', 'asc'), // Replies in chronological order
        limit(10) // Limit initial replies
      );

      const snapshot = await getDocs(q);
      const replies: Comment[] = [];

      snapshot.forEach(doc => {
        replies.push({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date(),
          likes: 0 // Will be loaded separately
        } as Comment);
      });

      // Load likes for replies
      await this.loadLikesForComments(replies);

      console.log(`📝 Loaded ${replies.length} replies for comment ${commentId}`);
      return replies;

    } catch (error) {
      console.error('Error fetching replies:', error);
      return [];
    }
  }

  // 5. BATCH OPERATIONS - Update multiple comments efficiently
  async batchUpdateComments(updates: { id: string; data: Partial<Comment> }[]): Promise<void> {
    const batch = writeBatch(db);
    
    updates.forEach(({ id, data }) => {
      const commentRef = doc(db, 'comments', id);
      batch.update(commentRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
    console.log(`🔄 Batch updated ${updates.length} comments`);
  }

  // LIKE/UNLIKE COMMENT OR REPLY
  async likeComment(commentId: string, incrementBy: number = 1): Promise<void> {
    try {
      const commentRef = doc(db, 'comments', commentId);
      await updateDoc(commentRef, {
        likes: increment(incrementBy)
      });
      console.log(`✅ Updated likes for comment ${commentId} by ${incrementBy}`);
    } catch (error) {
      console.error('❌ Failed to update likes:', error);
      throw error;
    }
  }

  // 6. SMART CACHING UTILITIES
  private isCacheValid(cacheKey: string): boolean {
    // Simple time-based cache validation
    // In production, you might use more sophisticated cache invalidation
    return this.cache.has(cacheKey);
  }

  // Public method to clear cache for external use
  public clearCache(postId: string): void {
    this.invalidateCache(postId);
    console.log('🗑️ Public cache cleared for post:', postId);
  }

  // Public method to clear ALL cache (for aggressive cache clearing)
  public clearAllCache(): void {
    this.cache.clear();
    console.log('🧹 ALL cache cleared');
  }

  private invalidateCache(postId: string): void {
    // Remove all cached entries for this post
    for (const key of this.cache.keys()) {
      if (key.startsWith(postId)) {
        this.cache.delete(key);
      }
    }
    console.log(`🗑️ Cache invalidated for post ${postId}`);
  }

  // 6. DELETE COMMENT - Properly handle deletion with cache invalidation
  async deleteComment(commentId: string, postId: string): Promise<void> {
    try {
      console.log('🗑️ CommentService: Deleting comment:', commentId);
      
      // First, get the comment document reference
      const commentRef = doc(db, 'comments', commentId);
      
      // Delete from Firebase
      await deleteDoc(commentRef);
      console.log('✅ CommentService: Firebase deletion successful');
      
      // Clear ALL cache to ensure no stale data
      this.clearAllCache();
      console.log('✅ CommentService: All cache cleared');
      
      // Force a longer delay to ensure Firebase consistency across all regions
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('⏱️ CommentService: Waited for Firebase consistency');
      
    } catch (error: any) {
      console.error('❌ CommentService: Failed to delete comment:', error);
      if (error?.code === 'permission-denied') {
        throw new Error('You do not have permission to delete this comment');
      } else if (error?.code === 'not-found') {
        console.log('📝 CommentService: Comment already deleted or does not exist');
        // Still clear cache in case it was cached
        this.clearAllCache();
        return; // Don't throw error for already deleted comments
      }
      throw error;
    }
  }

  // 7. ANALYTICS & PERFORMANCE MONITORING
  private async attachReplyCounts(comments: Comment[]): Promise<void> {
    if (comments.length === 0) return;

    // Batch query for reply counts to minimize database calls
    const replyCountPromises = comments.map(async (comment) => {
      const q = query(
        collection(db, 'comments'),
        where('parentCommentId', '==', comment.id)
      );
      const snapshot = await getDocs(q);
      comment.replies = comment.replies || [];
      // Add reply count metadata without loading full replies
      (comment as any).replyCount = snapshot.size;
    });

    await Promise.all(replyCountPromises);
  }

  // Load replies for comments
  private async loadRepliesForComments(comments: Comment[]): Promise<void> {
    if (comments.length === 0) return;

    // Load replies for each comment
    const replyPromises = comments.map(async (comment) => {
      comment.replies = await this.getReplies(comment.id);
    });

    await Promise.all(replyPromises);
    console.log(`📝 Loaded replies for ${comments.length} comments`);
  }

  // Load likes for comments
  private async loadLikesForComments(comments: Comment[]): Promise<void> {
    if (comments.length === 0) return;

    // Load likes for each comment
    const likePromises = comments.map(async (comment) => {
      try {
        const likesSnapshot = await getDocs(collection(db, 'comments', comment.id, 'likes'));
        comment.likes = likesSnapshot.size;
        
        // Also load likes for replies
        if (comment.replies && comment.replies.length > 0) {
          const replyLikePromises = comment.replies.map(async (reply) => {
            const replyLikesSnapshot = await getDocs(collection(db, 'comments', reply.id, 'likes'));
            reply.likes = replyLikesSnapshot.size;
          });
          await Promise.all(replyLikePromises);
        }
      } catch (error) {
        console.error(`Error loading likes for comment ${comment.id}:`, error);
        comment.likes = 0;
      }
    });

    await Promise.all(likePromises);
    console.log(`❤️ Loaded likes for ${comments.length} comments`);
  }

  private async getCommentCount(postId: string): Promise<number> {
    try {
      // Try to get from post metadata first (denormalized)
      const postDoc = await getDocs(query(
        collection(db, 'posts'),
        where('id', '==', postId),
        limit(1)
      ));

      if (!postDoc.empty) {
        const postData = postDoc.docs[0].data();
        if (postData.commentCount !== undefined) {
          return postData.commentCount;
        }
      }

      // Fallback: count comments directly
      const q = query(
        collection(db, 'comments'),
        where('postId', '==', postId),
        where('parentCommentId', '==', null)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;

    } catch (error) {
      console.error('Error getting comment count:', error);
      return 0;
    }
  }

  // 8. CLEANUP - Unsubscribe from all realtime listeners
  cleanup(): void {
    this.subscribers.forEach((unsubscribe) => unsubscribe());
    this.subscribers.clear();
    this.cache.clear();
    console.log('🧹 CommentService cleaned up');
  }
}

// Export singleton instance
export const commentService = new CommentService();
