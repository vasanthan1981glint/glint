import { collection, deleteDoc, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { Alert } from 'react-native';
import { auth, db, storage } from '../firebaseConfig';

// Helper function to safely get current user
const getCurrentUser = () => {
  try {
    return auth?.currentUser || null;
  } catch (error) {
    console.error('Error accessing current user:', error);
    return null;
  }
};

interface DeleteVideoResult {
  success: boolean;
  message: string;
  error?: string;
}

class VideoDeleteService {
  /**
   * Check if current user owns the video
   */
  async isVideoOwner(videoId: string): Promise<boolean> {
    try {
      // Check if auth is available
      if (!auth) {
        console.error('Firebase auth not initialized');
        return false;
      }

      const currentUser = getCurrentUser();
      if (!currentUser) {
        return false;
      }

      const videoRef = doc(db, 'videos', videoId);
      const videoDoc = await getDoc(videoRef);
      
      if (videoDoc.exists()) {
        const videoData = videoDoc.data();
        return videoData.userId === currentUser.uid;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking video ownership:', error);
      return false;
    }
  }

  /**
   * Delete video and all related data
   */
  async deleteVideo(videoId: string): Promise<DeleteVideoResult> {
    try {
      console.log(`🗑️ Starting video deletion process for: ${videoId}`);
      
      // Verify ownership
      const isOwner = await this.isVideoOwner(videoId);
      if (!isOwner) {
        return {
          success: false,
          message: 'You can only delete your own videos',
          error: 'Unauthorized'
        };
      }

      // Get video data before deletion for logging
      const videoRef = doc(db, 'videos', videoId);
      const videoDoc = await getDoc(videoRef);
      
      if (!videoDoc.exists()) {
        return {
          success: false,
          message: 'Video not found',
          error: 'Not found'
        };
      }

      const videoData = videoDoc.data();
      console.log(`📹 Deleting video: ${videoData.caption || 'Untitled'}`);

      // Delete files from Firebase Storage first
      try {
        console.log('🗑️ Deleting files from Firebase Storage...');
        
        // Delete video file
        if (videoData.playbackUrl) {
          const videoPath = this.extractStoragePathFromUrl(videoData.playbackUrl);
          if (videoPath) {
            const videoRef = ref(storage, videoPath);
            await deleteObject(videoRef);
            console.log('✅ Video file deleted from storage');
          }
        }

        // Delete thumbnail file
        if (videoData.thumbnailUrl) {
          const thumbnailPath = this.extractStoragePathFromUrl(videoData.thumbnailUrl);
          if (thumbnailPath) {
            const thumbnailRef = ref(storage, thumbnailPath);
            await deleteObject(thumbnailRef);
            console.log('✅ Thumbnail file deleted from storage');
          }
        }

        // Delete any additional stored files
        if (videoData.originalVideoUrl) {
          const originalPath = this.extractStoragePathFromUrl(videoData.originalVideoUrl);
          if (originalPath) {
            const originalRef = ref(storage, originalPath);
            await deleteObject(originalRef);
            console.log('✅ Original video file deleted from storage');
          }
        }
      } catch (storageError) {
        console.warn('⚠️ Some storage files could not be deleted:', storageError);
        // Continue with Firestore deletion even if storage deletion fails
      }

      // Delete main video document
      await deleteDoc(videoRef);
      console.log('✅ Main video document deleted');

      // Delete corresponding post document (if exists)
      try {
        const postRef = doc(db, 'posts', videoId);
        const postDoc = await getDoc(postRef);
        if (postDoc.exists()) {
          await deleteDoc(postRef);
          console.log('✅ Post document deleted');
        }
      } catch (error) {
        console.warn('⚠️ Post document deletion failed (non-critical):', error);
      }

      // Delete all view analytics for this video
      try {
        const viewsQuery = query(
          collection(db, 'views'),
          where('videoId', '==', videoId)
        );
        const viewsSnapshot = await getDocs(viewsQuery);
        
        const deletionPromises = viewsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletionPromises);
        
        console.log(`✅ Deleted ${viewsSnapshot.size} view analytics records`);
      } catch (error) {
        console.warn('⚠️ View analytics deletion failed (non-critical):', error);
      }

      // Delete any comments on this video
      try {
        const commentsQuery = query(
          collection(db, 'comments'),
          where('postId', '==', videoId)
        );
        const commentsSnapshot = await getDocs(commentsQuery);
        
        const commentDeletionPromises = commentsSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(commentDeletionPromises);
        
        console.log(`✅ Deleted ${commentsSnapshot.size} comments`);
      } catch (error) {
        console.warn('⚠️ Comments deletion failed (non-critical):', error);
      }

      // Delete any likes on this video
      try {
        const likesQuery = query(
          collection(db, 'likes'),
          where('postId', '==', videoId)
        );
        const likesSnapshot = await getDocs(likesQuery);
        
        const likesDeletionPromises = likesSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(likesDeletionPromises);
        
        console.log(`✅ Deleted ${likesSnapshot.size} likes`);
      } catch (error) {
        console.warn('⚠️ Likes deletion failed (non-critical):', error);
      }

      console.log(`🎉 Video ${videoId} successfully deleted with all related data`);
      
      return {
        success: true,
        message: 'Video deleted successfully'
      };

    } catch (error: any) {
      console.error('❌ Error deleting video:', error);
      return {
        success: false,
        message: 'Failed to delete video. Please try again.',
        error: (error && (error as any).message) ? (error as any).message : 'Unknown error'
      };
    }
  }

  /**
   * Extract Firebase Storage path from download URL
   */
  private extractStoragePathFromUrl(url: string): string | null {
    try {
      // Handle Firebase Storage URLs in format:
      // https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fto%2Ffile.ext?alt=media&token=...
      if (url.includes('firebasestorage.googleapis.com')) {
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
        if (pathMatch) {
          // Decode the URL-encoded path
          return decodeURIComponent(pathMatch[1]);
        }
      }
      
      // Handle simple storage paths (if stored as direct paths)
      if (url.startsWith('videos/') || url.startsWith('thumbnails/')) {
        return url;
      }
      
      console.warn('Could not extract storage path from URL:', url);
      return null;
    } catch (error) {
      console.error('Error extracting storage path:', error);
      return null;
    }
  }

  /**
   * Show confirmation dialog and delete video
   */
  async confirmAndDeleteVideo(videoId: string, videoTitle?: string): Promise<DeleteVideoResult> {
    return new Promise((resolve) => {
      const title = videoTitle || 'this video';
      
      Alert.alert(
        'Delete Video',
        `Are you sure you want to delete ${title}? This action cannot be undone.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve({
              success: false,
              message: 'Deletion cancelled'
            })
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const result = await this.deleteVideo(videoId);
              resolve(result);
            }
          }
        ]
      );
    });
  }

  /**
   * Batch delete multiple videos (for future use)
   */
  async deleteMultipleVideos(videoIds: string[]): Promise<DeleteVideoResult[]> {
    const results: DeleteVideoResult[] = [];
    
    for (const videoId of videoIds) {
      const result = await this.deleteVideo(videoId);
      results.push(result);
    }
    
    return results;
  }
}

// Export singleton instance
export const videoDeleteService = new VideoDeleteService();

// Export individual methods for convenience
export const deleteVideo = (videoId: string) => videoDeleteService.deleteVideo(videoId);
export const confirmAndDeleteVideo = (videoId: string, videoTitle?: string) => 
  videoDeleteService.confirmAndDeleteVideo(videoId, videoTitle);
export const isVideoOwner = (videoId: string) => videoDeleteService.isVideoOwner(videoId);

export default VideoDeleteService;
