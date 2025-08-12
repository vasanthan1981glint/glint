// Ultra-Fast Video Upload Service
// Bypasses all thumbnail generation and goes straight to upload

import { Alert } from 'react-native';

interface FastUploadOptions {
  skipThumbnails?: boolean;
  skipCompression?: boolean;
  quality?: 'low' | 'medium';
}

class FastUploadService {
  /**
   * Upload video directly without any thumbnail generation delays
   */
  async uploadVideoDirectly(
    videoUri: string, 
    options: FastUploadOptions = {}
  ): Promise<void> {
    const {
      skipThumbnails = true,
      skipCompression = true,
      quality = 'low'
    } = options;

    try {
      console.log('🚀 INSTANT UPLOAD: Starting ultra-fast video upload...');
      console.log('📹 Video URI:', videoUri);
      console.log('⚡ Options:', { skipThumbnails, skipCompression, quality });

      // Show instant upload modal
      this.showFastUploadModal();

      // Import Firebase services
      const { getAuth } = await import('firebase/auth');
      const { doc, setDoc, getFirestore, serverTimestamp } = await import('firebase/firestore');
      const { ref, uploadBytes, getDownloadURL, getStorage } = await import('firebase/storage');

      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create unique video ID
      const videoId = `fast_${Date.now()}`;
      
      // Convert video URI to blob for upload
      const response = await fetch(videoUri);
      const blob = await response.blob();

      console.log('📤 Uploading video blob directly to Firebase...');

      // Upload to Firebase Storage
      const storage = getStorage();
      const videoRef = ref(storage, `videos/${videoId}_video.mp4`);
      
      const uploadResult = await uploadBytes(videoRef, blob);
      const downloadURL = await getDownloadURL(uploadResult.ref);

      console.log('✅ Video uploaded to:', downloadURL);

      // Save to Firestore without thumbnail
      const db = getFirestore();
      const videoDoc = {
        assetId: videoId,
        playbackUrl: downloadURL,
        userId: user.uid,
        caption: 'Uploaded via fast mode', // Default caption
        createdAt: serverTimestamp(),
        uploadedAt: serverTimestamp(),
        status: 'ready',
        storage: 'firebase',
        processed: true,
        likes: 0,
        views: 0,
        isRealVideo: true,
        thumbnailUrl: null, // No thumbnail for ultra-fast mode
        fastUpload: true, // Mark as fast upload
        deviceInfo: {
          platform: 'mobile',
          fastMode: true,
          timestamp: Date.now()
        }
      };

      await setDoc(doc(db, 'videos', videoId), videoDoc);

      console.log('✅ INSTANT UPLOAD COMPLETE! Video saved to Firestore');

      // Show success and navigate
      Alert.alert(
        'Upload Complete! ⚡',
        'Your video was uploaded in ultra-fast mode!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back or refresh
              this.hideFastUploadModal();
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Fast upload failed:', error);
      Alert.alert(
        'Upload Failed',
        'Fast upload failed. Please try the normal upload mode.',
        [
          {
            text: 'OK',
            onPress: () => this.hideFastUploadModal()
          }
        ]
      );
    }
  }

  private showFastUploadModal() {
    // This would show a minimal upload progress modal
    console.log('📱 Showing fast upload modal...');
  }

  private hideFastUploadModal() {
    // This would hide the upload modal
    console.log('📱 Hiding fast upload modal...');
  }
}

// Export singleton instance
const fastUploadService = new FastUploadService();

export const uploadVideoDirectly = (videoUri: string, options?: FastUploadOptions) => 
  fastUploadService.uploadVideoDirectly(videoUri, options);

export default fastUploadService;
