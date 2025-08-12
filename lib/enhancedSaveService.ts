import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    limit as firestoreLimit,
    getDocs,
    orderBy,
    query,
    where
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export interface SavedVideo {
  id: string;
  videoId: string;
  userId: string;
  savedAt: string;
  savedId?: string; // ID of the save record in database
  videoData?: any;
}

export interface SaveResponse {
  saved: boolean;
  message: string;
  timestamp: string;
}

export interface SavedVideosResponse {
  savedVideos: SavedVideo[];
  total: number;
  hasMore: boolean;
  timestamp: string;
}

class EnhancedSaveService {
  private cache: Map<string, boolean> = new Map(); // Cache save status
  private saveQueue: Map<string, Promise<boolean>> = new Map(); // Prevent duplicate requests

  constructor() {
    console.log(`🔗 Enhanced Save Service initialized with Firebase-only approach`);
  }

  /**
   * Check if a video is saved by the current user
   */
  async isSaved(videoId: string): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) return false;

    const cacheKey = `${user.uid}_${videoId}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const q = query(
        collection(db, 'saves'),
        where('userId', '==', user.uid),
        where('videoId', '==', videoId)
      );
      
      const querySnapshot = await getDocs(q);
      const saved = !querySnapshot.empty;
      
      // Update cache
      this.cache.set(cacheKey, saved);
      
      return saved;
    } catch (error) {
      console.error('Error checking save status:', error);
      return false;
    }
  }

  /**
   * Toggle save status for a video
   */
  async toggleSave(videoId: string): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    console.log(`🔄 Toggle save for video ${videoId}`);

    // Prevent duplicate requests for the same video
    const existingRequest = this.saveQueue.get(videoId);
    if (existingRequest) {
      console.log(`⏳ Using existing save request for video ${videoId}`);
      return existingRequest;
    }

    // Create new save request
    const saveRequest = this.performToggleSave(videoId, user.uid);
    this.saveQueue.set(videoId, saveRequest);

    try {
      const result = await saveRequest;
      return result;
    } finally {
      // Clean up the queue
      this.saveQueue.delete(videoId);
    }
  }

  /**
   * Perform the actual save/unsave operation
   */
  private async performToggleSave(videoId: string, userId: string): Promise<boolean> {
    const cacheKey = `${userId}_${videoId}`;
    
    try {
      console.log(`🔐 User ID for save operation: ${userId}`);
      console.log(`🎥 Video ID for save operation: ${videoId}`);
      console.log(`🔑 Current auth user:`, auth.currentUser?.uid);
      
      // First, try to add the save directly without checking if it exists
      // This is simpler and avoids the compound query that might need an index
      const saveData = {
        userId,
        videoId,
        savedAt: new Date().toISOString(),
        createdAt: new Date()
      };
      
      console.log(`� Attempting to create save document with data:`, saveData);
      const docRef = await addDoc(collection(db, 'saves'), saveData);
      
      console.log(`✅ Saved video ${videoId} with doc ID: ${docRef.id}`);
      this.cache.set(cacheKey, true);
      return true;
      
    } catch (error) {
      console.error('Error creating save:', error);
      // If save failed, try to check if it already exists and remove it
      try {
        console.log(`🔍 Checking if save already exists to remove it...`);
        const q = query(
          collection(db, 'saves'),
          where('userId', '==', userId),
          where('videoId', '==', videoId)
        );
        
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const saveDoc = querySnapshot.docs[0];
          console.log(`�️ Attempting to delete existing save document: ${saveDoc.id}`);
          await deleteDoc(doc(db, 'saves', saveDoc.id));
          
          console.log(`❌ Unsaved video ${videoId}`);
          this.cache.set(cacheKey, false);
          return false;
        }
      } catch (deleteError) {
        console.error('Error removing save:', deleteError);
      }
      throw error;
    }
  }

  /**
   * Get all saved videos for the current user
   */
  async getSavedVideos(page: number = 1, limit: number = 20): Promise<SavedVideosResponse> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      console.log(`📥 Fetching saved videos for user ${user.uid}, page ${page}`);

      let q = query(
        collection(db, 'saves'),
        where('userId', '==', user.uid),
        orderBy('savedAt', 'desc'),
        firestoreLimit(limit)
      );

      // For pagination, we would need to implement startAfter with the last document
      // For now, keeping it simple
      
      const querySnapshot = await getDocs(q);
      
      const savedVideos: SavedVideo[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        savedId: doc.id,
        videoId: doc.data().videoId,
        userId: doc.data().userId,
        savedAt: doc.data().savedAt,
      }));

      console.log(`📊 Found ${savedVideos.length} saved videos`);

      return {
        savedVideos,
        total: savedVideos.length,
        hasMore: savedVideos.length === limit,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching saved videos:', error);
      throw error;
    }
  }

  /**
   * Remove a video from saved list
   */
  async removeSave(videoId: string): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      const q = query(
        collection(db, 'saves'),
        where('userId', '==', user.uid),
        where('videoId', '==', videoId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const saveDoc = querySnapshot.docs[0];
        await deleteDoc(doc(db, 'saves', saveDoc.id));
        
        // Update cache
        const cacheKey = `${user.uid}_${videoId}`;
        this.cache.set(cacheKey, false);
        
        console.log(`🗑️ Removed save for video ${videoId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error removing save:', error);
      throw error;
    }
  }

  /**
   * Clear cache (useful for logout or refresh)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Save cache cleared');
  }

  /**
   * Get save status from cache (instant response)
   */
  getCachedSaveStatus(videoId: string): boolean | null {
    const user = auth.currentUser;
    if (!user) return null;

    const cacheKey = `${user.uid}_${videoId}`;
    return this.cache.get(cacheKey) || null;
  }
}

// Export singleton instance
export const enhancedSaveService = new EnhancedSaveService();
