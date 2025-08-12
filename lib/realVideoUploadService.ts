// Real Video Upload Service using Firebase Storage
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../firebaseConfig';
import { VideoCompressionService } from './videoCompressionService';

export interface UploadProgress {
  progress: number;
  stage: 'compressing' | 'uploading' | 'processing' | 'complete';
  message: string;
  fileSize?: string;
  uploadSpeed?: string;
  timeRemaining?: string;
}

class RealVideoUploadService {
  
  // Upload video to Firebase Storage (real upload)
  async uploadVideoToFirebase(
    videoUri: string, 
    onProgress: (progress: UploadProgress) => void
  ): Promise<any> {
    try {
      console.log('🔥 Starting real Firebase upload...');
      console.log('📹 Video URI:', videoUri);

      onProgress({
        progress: 5,
        stage: 'uploading',
        message: 'Preparing upload...'
      });

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `videos/${timestamp}_video.mp4`;
      const videoRef = ref(storage, filename);

      // Fetch the video file
      const response = await fetch(videoUri);
      const blob = await response.blob();
      const fileSize = VideoCompressionService.formatFileSize(blob.size);

      onProgress({
        progress: 10,
        stage: 'uploading',
        message: 'Starting upload to Firebase...',
        fileSize: fileSize
      });

      // Upload with progress tracking
      const uploadTask = uploadBytesResumable(videoRef, blob);
      const uploadStartTime = Date.now();

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Progress tracking with detailed info
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            const timeElapsed = (Date.now() - uploadStartTime) / 1000; // in seconds
            
            const uploadSpeed = VideoCompressionService.calculateUploadSpeed(snapshot.bytesTransferred, timeElapsed);
            const timeRemaining = VideoCompressionService.estimateTimeRemaining(
              snapshot.bytesTransferred, 
              snapshot.totalBytes, 
              timeElapsed
            );

            onProgress({
              progress: 10 + (progress * 0.8), // 10% to 90%
              stage: 'uploading',
              message: `Uploading... ${Math.round(progress)}%`,
              fileSize: fileSize,
              uploadSpeed: uploadSpeed,
              timeRemaining: timeRemaining
            });
          },
          (error) => {
            console.error('❌ Firebase upload error:', error);
            reject(error);
          },
          async () => {
            // Upload completed
            onProgress({
              progress: 90,
              stage: 'processing',
              message: 'Finalizing upload...'
            });

            try {
              // Get download URL
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              
              onProgress({
                progress: 95,
                stage: 'processing',
                message: 'Preparing video metadata...'
              });

              const assetId = `firebase_${timestamp}`;
              
              // Note: Thumbnail generation is handled by the calling component
              // to ensure Firebase Storage upload and proper public access
              console.log('📱 Video upload complete, thumbnail will be handled separately');
              
              onProgress({
                progress: 100,
                stage: 'complete',
                message: 'Video upload complete!'
              });
              
              console.log('✅ Real video uploaded to Firebase:', downloadURL);
              
              resolve({
                id: assetId,
                assetId: assetId,
                playbackUrl: downloadURL,
                thumbnailUrl: null, // Will be set by calling component
                status: 'ready',
                uploadTime: new Date().toISOString(),
                storage: 'firebase'
              });
            } catch (error) {
              reject(error);
            }
          }
        );
      });

    } catch (error: any) {
      console.error('❌ Firebase upload failed:', error);
      throw new Error(error.message || 'Upload failed');
    }
  }
}

export default new RealVideoUploadService();
