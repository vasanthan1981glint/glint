import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export interface SavedVideo {
  id: string;
  videoId: string;
  userId: string;
  savedAt: string;
  videoData?: any; // The actual video document data
}

class SavedVideosService {
  // Save a video for the current user
  async saveVideo(videoId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // console.log(`🔍 SaveVideo called - videoId: ${videoId}, userId: ${user.uid}`);
    // console.log(`🔍 User details - email: ${user.email}, emailVerified: ${user.emailVerified}`);

    try {
      // Check if already saved
      // console.log('🔍 Checking if video is already saved...');
      const existingSave = await this.isVideoSaved(videoId);
      if (existingSave) {
        console.log('Video already saved, skipping...');
        return;
      }

      // Add to saved videos collection
      const savedVideoData = {
        videoId,
        userId: user.uid,
        savedAt: new Date().toISOString(),
      };

      // console.log('🔍 Adding video to savedVideos collection...', savedVideoData);
      // console.log('🔍 Using Firebase config from auth:', {
      //   projectId: auth.app.options.projectId,
      //   appName: auth.app.name
      // });
      
      const docRef = await addDoc(collection(db, 'savedVideos'), savedVideoData);
      console.log('✅ Video saved successfully with ID:', docRef.id);
    } catch (error) {
      console.error('❌ Error saving video:', error);
      console.error('❌ Error details:', {
        code: (error as any)?.code,
        message: (error as any)?.message,
        customData: (error as any)?.customData
      });
      throw error;
    }
  }

  // Remove a video from saved
  async unsaveVideo(videoId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      // Find the saved video document
      const q = query(
        collection(db, 'savedVideos'),
        where('videoId', '==', videoId),
        where('userId', '==', user.uid)
      );

      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docToDelete = querySnapshot.docs[0];
        await deleteDoc(docToDelete.ref);
        console.log('✅ Video unsaved successfully');
      }
    } catch (error) {
      console.error('❌ Error unsaving video:', error);
      throw error;
    }
  }

  // Check if a video is saved by the current user
  async isVideoSaved(videoId: string): Promise<boolean> {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No authenticated user for isVideoSaved');
      return false;
    }

    // console.log(`🔍 Checking if video ${videoId} is saved for user ${user.uid}`);

    try {
      const q = query(
        collection(db, 'savedVideos'),
        where('videoId', '==', videoId),
        where('userId', '==', user.uid)
      );

      // console.log('🔍 Executing isVideoSaved query...');
      const querySnapshot = await getDocs(q);
      const isSaved = !querySnapshot.empty;
      // console.log(`✅ Video ${videoId} saved status: ${isSaved}`);
      return isSaved;
    } catch (error) {
      console.error('❌ Error checking if video is saved:', error);
      throw error;
    }
  }

  // Get all saved videos for the current user with video data
  async getSavedVideos(): Promise<SavedVideo[]> {
    const user = auth.currentUser;
    if (!user) {
      console.log('❌ No authenticated user for getSavedVideos');
      return [];
    }

    // console.log(`🔍 Getting saved videos for user: ${user.uid}`);

    try {
      // Use simple query without orderBy to avoid index requirement for now
      const q = query(
        collection(db, 'savedVideos'),
        where('userId', '==', user.uid)
      );

      // console.log('🔍 Executing savedVideos query...');
      const querySnapshot = await getDocs(q);
      // console.log(`✅ Query executed, found ${querySnapshot.docs.length} saved videos`);
      
      const savedVideos: SavedVideo[] = [];

      // Fetch video data for each saved video
      for (const docSnapshot of querySnapshot.docs) {
        const savedVideoData = docSnapshot.data() as Omit<SavedVideo, 'id'>;
        // console.log(`🔍 Processing saved video: ${savedVideoData.videoId}`);
        
        // Get the actual video document
        try {
          const videoDoc = await getDoc(doc(db, 'videos', savedVideoData.videoId));
          if (videoDoc.exists()) {
            savedVideos.push({
              id: docSnapshot.id,
              ...savedVideoData,
              videoData: { id: videoDoc.id, ...videoDoc.data() }
            });
          }
        } catch (videoError) {
          console.warn(`Could not fetch video data for ${savedVideoData.videoId}:`, videoError);
          // Still add the saved video without video data
          savedVideos.push({
            id: docSnapshot.id,
            ...savedVideoData,
            videoData: null
          });
        }
      }

      // Sort in JavaScript instead of Firestore for now
      savedVideos.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

      // console.log(`✅ Returning ${savedVideos.length} saved videos`);
      return savedVideos;
    } catch (error) {
      console.error('❌ Error fetching saved videos:', error);
      throw error;
    }
  }

  // Real-time listener for saved videos
  onSavedVideosChange(userId: string, callback: (savedVideos: SavedVideo[]) => void) {
    // Use simple query without orderBy to avoid index requirement for now
    const q = query(
      collection(db, 'savedVideos'),
      where('userId', '==', userId)
    );

    return onSnapshot(q, async (querySnapshot) => {
      const savedVideos: SavedVideo[] = [];

      for (const docSnapshot of querySnapshot.docs) {
        const savedVideoData = docSnapshot.data() as Omit<SavedVideo, 'id'>;
        
        try {
          const videoDoc = await getDoc(doc(db, 'videos', savedVideoData.videoId));
          if (videoDoc.exists()) {
            savedVideos.push({
              id: docSnapshot.id,
              ...savedVideoData,
              videoData: { id: videoDoc.id, ...videoDoc.data() }
            });
          }
        } catch (videoError) {
          console.warn(`Could not fetch video data for ${savedVideoData.videoId}:`, videoError);
          savedVideos.push({
            id: docSnapshot.id,
            ...savedVideoData,
            videoData: null
          });
        }
      }

      // Sort in JavaScript instead of Firestore for now
      savedVideos.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

      callback(savedVideos);
    });
  }

  // Toggle save status
  async toggleSaveVideo(videoId: string): Promise<boolean> {
    const isSaved = await this.isVideoSaved(videoId);
    
    if (isSaved) {
      await this.unsaveVideo(videoId);
      return false;
    } else {
      await this.saveVideo(videoId);
      return true;
    }
  }
}

export const savedVideosService = new SavedVideosService();
