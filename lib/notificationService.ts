import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    Unsubscribe,
    updateDoc,
    where
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface NotificationData {
  id: string;
  userId: string; // recipient
  fromUserId: string; // sender
  type: 'follow' | 'like' | 'comment' | 'mention';
  title: string;
  message: string;
  data?: {
    videoId?: string;
    commentId?: string;
    username?: string;
    avatar?: string;
  };
  read: boolean;
  createdAt: any;
}

export interface NotificationTemplate {
  type: 'follow' | 'like' | 'comment' | 'mention';
  title: string;
  message: string;
}

class NotificationService {
  private notificationListeners: Map<string, Unsubscribe> = new Map();

  /**
   * Notification templates
   */
  private templates: Record<string, NotificationTemplate> = {
    follow: {
      type: 'follow',
      title: 'New Follower',
      message: '{username} started following you'
    },
    like: {
      type: 'like',
      title: 'New Like',
      message: '{username} liked your video'
    },
    comment: {
      type: 'comment',
      title: 'New Comment',
      message: '{username} commented on your video'
    },
    mention: {
      type: 'mention',
      title: 'You were mentioned',
      message: '{username} mentioned you in a comment'
    }
  };

  /**
   * Send a follow notification
   */
  async sendFollowNotification(
    followerId: string,
    followingId: string,
    followerUsername: string,
    followerAvatar: string
  ): Promise<boolean> {
    // Don't send notification to self
    if (followerId === followingId) {
      return false;
    }

    try {
      const template = this.templates.follow;
      
      await addDoc(collection(db, 'notifications'), {
        userId: followingId,
        fromUserId: followerId,
        type: template.type,
        title: template.title,
        message: template.message.replace('{username}', followerUsername),
        data: {
          username: followerUsername,
          avatar: followerAvatar
        },
        read: false,
        createdAt: serverTimestamp()
      });

      console.log(`✅ Follow notification sent from ${followerId} to ${followingId}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending follow notification:', error);
      return false;
    }
  }

  /**
   * Send a like notification
   */
  async sendLikeNotification(
    likerId: string,
    videoOwnerId: string,
    videoId: string,
    likerUsername: string,
    likerAvatar: string
  ): Promise<boolean> {
    // Don't send notification to self
    if (likerId === videoOwnerId) {
      return false;
    }

    try {
      const template = this.templates.like;
      
      await addDoc(collection(db, 'notifications'), {
        userId: videoOwnerId,
        fromUserId: likerId,
        type: template.type,
        title: template.title,
        message: template.message.replace('{username}', likerUsername),
        data: {
          videoId,
          username: likerUsername,
          avatar: likerAvatar
        },
        read: false,
        createdAt: serverTimestamp()
      });

      console.log(`✅ Like notification sent from ${likerId} to ${videoOwnerId}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending like notification:', error);
      return false;
    }
  }

  /**
   * Send a comment notification
   */
  async sendCommentNotification(
    commenterId: string,
    videoOwnerId: string,
    videoId: string,
    commentId: string,
    commenterUsername: string,
    commenterAvatar: string
  ): Promise<boolean> {
    // Don't send notification to self
    if (commenterId === videoOwnerId) {
      return false;
    }

    try {
      const template = this.templates.comment;
      
      await addDoc(collection(db, 'notifications'), {
        userId: videoOwnerId,
        fromUserId: commenterId,
        type: template.type,
        title: template.title,
        message: template.message.replace('{username}', commenterUsername),
        data: {
          videoId,
          commentId,
          username: commenterUsername,
          avatar: commenterAvatar
        },
        read: false,
        createdAt: serverTimestamp()
      });

      console.log(`✅ Comment notification sent from ${commenterId} to ${videoOwnerId}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending comment notification:', error);
      return false;
    }
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(userId: string, limitCount: number = 50): Promise<NotificationData[]> {
    if (!userId) return [];

    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const notificationsSnapshot = await getDocs(notificationsQuery);
      return notificationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as NotificationData));
    } catch (error) {
      console.error('❌ Error getting user notifications:', error);
      return [];
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true
      });

      console.log(`✅ Notification ${notificationId} marked as read`);
      return true;
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );

      const notificationsSnapshot = await getDocs(notificationsQuery);
      const batch = [];

      for (const doc of notificationsSnapshot.docs) {
        batch.push(updateDoc(doc.ref, { read: true }));
      }

      await Promise.all(batch);

      console.log(`✅ All notifications marked as read for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      return false;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await deleteDoc(notificationRef);

      console.log(`✅ Notification ${notificationId} deleted`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      return false;
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (!userId) return 0;

    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );

      const notificationsSnapshot = await getDocs(notificationsQuery);
      return notificationsSnapshot.size;
    } catch (error) {
      console.error('❌ Error getting unread notification count:', error);
      return 0;
    }
  }

  /**
   * Set up real-time listener for user notifications
   */
  setupNotificationListener(
    userId: string,
    callback: (notifications: NotificationData[]) => void
  ): Unsubscribe | null {
    if (!userId) return null;

    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as NotificationData));

        callback(notifications);
      });

      // Store listener for cleanup
      this.notificationListeners.set(userId, unsubscribe);
      
      return unsubscribe;
    } catch (error) {
      console.error('❌ Error setting up notification listener:', error);
      return null;
    }
  }

  /**
   * Clean up notification listeners
   */
  cleanupNotificationListeners() {
    this.notificationListeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.notificationListeners.clear();
  }

  /**
   * Remove specific notification listener
   */
  removeNotificationListener(userId: string) {
    const unsubscribe = this.notificationListeners.get(userId);
    if (unsubscribe) {
      unsubscribe();
      this.notificationListeners.delete(userId);
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
