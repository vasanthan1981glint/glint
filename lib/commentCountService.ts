// YouTube-style Comment Count Service - Accurate & Persistent
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface PostStats {
  commentCount: number;
  lastUpdated: Date;
}

class CommentCountService {
  private static cache = new Map<string, PostStats>();
  private static readonly CACHE_DURATION = 30000; // 30 seconds

  /**
   * Get accurate comment count for a post (like YouTube)
   * Always returns the real count from database
   */
  static async getCommentCount(postId: string): Promise<number> {
    try {
      // First check if we have a denormalized count in the post document
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      
      if (postSnap.exists()) {
        const data = postSnap.data();
        if (data.commentCount !== undefined && typeof data.commentCount === 'number') {
          console.log(`📊 Comment count from post metadata: ${data.commentCount}`);
          return data.commentCount;
        }
      }

      // Fallback: Count comments directly from comments collection
      console.log('📊 Counting comments directly from database...');
      const q = query(
        collection(db, 'comments'),
        where('postId', '==', postId),
        where('parentCommentId', '==', null) // Only count top-level comments
      );
      
      const snapshot = await getDocs(q);
      const realCount = snapshot.size;
      
      // Update the post document with the real count
      await this.updatePostCommentCount(postId, realCount);
      
      console.log(`✅ Real comment count for post ${postId}: ${realCount}`);
      return realCount;
      
    } catch (error) {
      console.error('❌ Error getting comment count:', error);
      return 0;
    }
  }

  /**
   * Increment comment count when a new comment is added
   * This ensures the count is always accurate
   */
  static async incrementCommentCount(postId: string): Promise<number> {
    try {
      const postRef = doc(db, 'posts', postId);
      
      // Use a transaction to ensure atomic increment
      const newCount = await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        
        if (!postDoc.exists()) {
          // Create post document with initial count
          transaction.set(postRef, {
            id: postId,
            commentCount: 1,
            createdAt: new Date(),
            lastCommentAt: new Date()
          });
          return 1;
        } else {
          // Increment existing count
          const currentCount = postDoc.data().commentCount || 0;
          const newCount = currentCount + 1;
          transaction.update(postRef, {
            commentCount: newCount,
            lastCommentAt: new Date()
          });
          return newCount;
        }
      });

      console.log(`✅ Comment count incremented to ${newCount} for post ${postId}`);
      return newCount;
      
    } catch (error) {
      console.error('❌ Error incrementing comment count:', error);
      throw error;
    }
  }

  /**
   * Decrement comment count when a comment is deleted
   */
  static async decrementCommentCount(postId: string): Promise<number> {
    try {
      const postRef = doc(db, 'posts', postId);
      
      const newCount = await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        
        if (postDoc.exists()) {
          const currentCount = postDoc.data().commentCount || 0;
          const newCount = Math.max(0, currentCount - 1); // Never go below 0
          transaction.update(postRef, {
            commentCount: newCount,
            lastCommentAt: new Date()
          });
          return newCount;
        }
        return 0;
      });

      console.log(`✅ Comment count decremented to ${newCount} for post ${postId}`);
      return newCount;
      
    } catch (error) {
      console.error('❌ Error decrementing comment count:', error);
      throw error;
    }
  }

  /**
   * Fix/recalculate comment count for a post
   * Use this if counts get out of sync
   */
  static async recalculateCommentCount(postId: string): Promise<number> {
    try {
      console.log(`🔧 Recalculating comment count for post ${postId}...`);
      
      // Count actual comments in database
      const q = query(
        collection(db, 'comments'),
        where('postId', '==', postId),
        where('parentCommentId', '==', null)
      );
      
      const snapshot = await getDocs(q);
      const realCount = snapshot.size;
      
      // Update post document with correct count
      await this.updatePostCommentCount(postId, realCount);
      
      console.log(`✅ Recalculated comment count: ${realCount}`);
      return realCount;
      
    } catch (error) {
      console.error('❌ Error recalculating comment count:', error);
      throw error;
    }
  }

  /**
   * Update the comment count in the post document
   */
  private static async updatePostCommentCount(postId: string, count: number): Promise<void> {
    try {
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        commentCount: count,
        lastUpdated: new Date()
      });
    } catch (error) {
      // If post doesn't exist, create it
      console.log('Post document does not exist, creating...');
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        id: postId,
        commentCount: count,
        createdAt: new Date(),
        lastUpdated: new Date()
      });
    }
  }

  /**
   * Batch fix comment counts for multiple posts
   * Useful for maintenance/fixes
   */
  static async batchRecalculateCommentCounts(postIds: string[]): Promise<void> {
    try {
      console.log(`🔧 Batch recalculating comment counts for ${postIds.length} posts...`);
      
      const batch = writeBatch(db);
      
      for (const postId of postIds) {
        const q = query(
          collection(db, 'comments'),
          where('postId', '==', postId),
          where('parentCommentId', '==', null)
        );
        
        const snapshot = await getDocs(q);
        const count = snapshot.size;
        
        const postRef = doc(db, 'posts', postId);
        batch.update(postRef, {
          commentCount: count,
          lastUpdated: new Date()
        });
      }
      
      await batch.commit();
      console.log('✅ Batch comment count update completed');
      
    } catch (error) {
      console.error('❌ Error in batch recalculation:', error);
      throw error;
    }
  }
}

export { CommentCountService };
