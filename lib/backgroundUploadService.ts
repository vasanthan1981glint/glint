/**
 * Background Upload Service - YouTube-Style Non-Blocking Upload
 * Allows users to continue using the app while videos upload in background
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Alert } from 'react-native';

export interface BackgroundUploadProgress {
  stage: 'preparing' | 'compressing' | 'uploading' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
  fileSize?: string;
  uploadSpeed?: string;
  timeRemaining?: string;
  videoId: string;
  fileName: string;
}

export interface UploadJobInfo {
  id: string;
  videoUri: string;
  caption: string;
  customThumbnail?: string;
  userId: string;
  startTime: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: BackgroundUploadProgress;
  uploadContext?: 'Glints' | 'Trends'; // Track upload context
}

class BackgroundUploadService {
  private uploadJobs: Map<string, UploadJobInfo> = new Map();
  private isUploading = false;
  private progressCallbacks: Map<string, (progress: BackgroundUploadProgress) => void> = new Map();
  private uploadCompleteCallbacks: ((uploadId: string) => void)[] = [];
  private progressUpdateCallbacks: ((uploadId: string, progress: BackgroundUploadProgress) => void)[] = [];

  /**
   * Subscribe to upload progress events
   */
  onProgressUpdate(callback: (uploadId: string, progress: BackgroundUploadProgress) => void): void {
    this.progressUpdateCallbacks.push(callback);
  }

  /**
   * Unsubscribe from upload progress events
   */
  offProgressUpdate(callback: (uploadId: string, progress: BackgroundUploadProgress) => void): void {
    const index = this.progressUpdateCallbacks.indexOf(callback);
    if (index > -1) {
      this.progressUpdateCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of progress updates
   */
  private notifyProgressUpdate(uploadId: string, progress: BackgroundUploadProgress): void {
    this.progressUpdateCallbacks.forEach(callback => {
      try {
        callback(uploadId, progress);
      } catch (error) {
        console.error('Error in progress update callback:', error);
      }
    });
  }

  /**
   * Subscribe to upload completion events
   */
  onUploadComplete(callback: (uploadId: string) => void): void {
    this.uploadCompleteCallbacks.push(callback);
  }

  /**
   * Unsubscribe from upload completion events
   */
  offUploadComplete(callback: (uploadId: string) => void): void {
    const index = this.uploadCompleteCallbacks.indexOf(callback);
    if (index > -1) {
      this.uploadCompleteCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all listeners when upload completes
   */
  private notifyUploadComplete(uploadId: string): void {
    this.uploadCompleteCallbacks.forEach(callback => {
      try {
        callback(uploadId);
      } catch (error) {
        console.error('Error in upload complete callback:', error);
      }
    });
  }

  /**
   * Start a background upload and return to me.tsx immediately
   */
  async startBackgroundUpload(
    videoUri: string,
    caption: string,
    customThumbnail?: string,
    uploadContext?: 'Glints' | 'Trends'
  ): Promise<string> {
    try {
      console.log('🚀 BACKGROUND SERVICE: Starting upload process...');
      console.log('📹 Video URI:', videoUri);
      console.log('📝 Caption:', caption);
      console.log('📸 Custom thumbnail:', customThumbnail);
      console.log('🎯 Upload context:', uploadContext || 'Glints (default)');
      
      // Generate unique upload ID
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log('🎯 Generated upload ID:', uploadId);
      
      // Get user info
      console.log('🔐 Getting authentication...');
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        console.error('❌ No authenticated user found');
        throw new Error('User not authenticated - please sign in again');
      }
      
      console.log('✅ User authenticated:', user.uid);

      // Create upload job
      const uploadJob: UploadJobInfo = {
        id: uploadId,
        videoUri,
        caption,
        customThumbnail,
        userId: user.uid,
        startTime: Date.now(),
        status: 'pending',
        uploadContext: uploadContext || 'Glints', // Default to Glints if not specified
        progress: {
          stage: 'preparing',
          progress: 0,
          message: 'Preparing your video...',
          videoId: uploadId,
          fileName: `video_${Date.now()}.mp4`
        }
      };

      console.log('📋 Created upload job:', uploadJob);

      // Store upload job
      this.uploadJobs.set(uploadId, uploadJob);
      await this.saveUploadJobsToStorage();
      console.log('💾 Upload job saved to storage');

      // Show upload indicator immediately
      this.showUploadIndicator(uploadJob);
      console.log('📊 Upload indicator shown');

      // Navigate to me.tsx immediately (non-blocking)
      console.log('🧭 Navigating to profile...');
      router.push('/(tabs)/me');

      // Start upload process in background
      console.log('🚀 Starting background processing...');
      this.processUploadInBackground(uploadId);

      console.log('✅ BACKGROUND SERVICE: Upload started successfully');
      return uploadId;

    } catch (error: any) {
      console.error('❌ BACKGROUND SERVICE: Failed to start upload:', error);
      console.error('❌ Error details:', {
        message: error?.message || 'Unknown error',
        code: error?.code || 'unknown',
        stack: error?.stack || 'No stack trace'
      });
      
      Alert.alert('Upload Error', `Failed to start upload: ${error?.message || 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Process upload in background without blocking UI
   */
  private async processUploadInBackground(uploadId: string): Promise<void> {
    const uploadJob = this.uploadJobs.get(uploadId);
    if (!uploadJob) {
      console.error('❌ BACKGROUND PROCESS: Upload job not found:', uploadId);
      return;
    }

    try {
      console.log('📤 BACKGROUND PROCESS: Starting upload for:', uploadId);
      console.log('📋 Upload job details:', {
        id: uploadJob.id,
        userId: uploadJob.userId,
        videoUri: uploadJob.videoUri,
        caption: uploadJob.caption
      });

      // Update status to uploading
      uploadJob.status = 'uploading';
      uploadJob.progress.stage = 'uploading';
      uploadJob.progress.message = 'Uploading to cloud...';
      this.updateUploadProgress(uploadId, uploadJob.progress);

      // Import Google Cloud service for reliable video hosting
      console.log('📦 Importing Google Cloud service...');
      const GoogleCloudVideoService = await import('./googleCloudVideoService');
      console.log('✅ Google Cloud service imported successfully');

      // Upload video with progress tracking using Google Cloud (reliable hosting)
      console.log('☁️ Starting Google Cloud upload...');
      let uploadedVideo;
      
      try {
        const videoService = GoogleCloudVideoService.default;
        uploadedVideo = await videoService.uploadVideo({
          videoUri: decodeURIComponent(uploadJob.videoUri),
          title: uploadJob.caption || 'Video Upload',
          metadata: {
            userId: uploadJob.userId,
            caption: uploadJob.caption,
            uploadId: uploadId
          },
          onProgress: (progress) => {
            console.log('📊 Google Cloud upload progress:', progress);
            // Update progress in real-time
            uploadJob.progress = {
              ...uploadJob.progress,
              stage: progress.stage === 'creating' ? 'preparing' : progress.stage,
              progress: progress.progress,
              message: progress.message || 'Uploading...'
            };
            this.updateUploadProgress(uploadId, uploadJob.progress);
          }
        });
        console.log('✅ Google Cloud upload completed:', uploadedVideo);
      } catch (googleCloudError: any) {
        console.warn('⚠️ Google Cloud upload failed:', googleCloudError.message);
        
                // Provide more specific error messages based on the error type
        let userMessage = 'Upload failed. Tap to retry.';
        
        if (googleCloudError.message.includes('too large') || googleCloudError.message.includes('size')) {
          userMessage = 'Video file too large. Please compress or trim your video.';
        } else if (googleCloudError.message.includes('processing failed')) {
          userMessage = 'Video processing failed. Please check your video and try again.';
        } else if (googleCloudError.message.includes('connection')) {
          userMessage = 'Network connection failed. Please check your internet and try again.';
        } else if (googleCloudError.message.includes('timeout')) {
          userMessage = 'Upload timed out. Please try again with a smaller video.';
        }
        
        uploadJob.progress = {
          ...uploadJob.progress,
          stage: 'error',
          progress: 0,
          message: userMessage
        };
        this.updateUploadProgress(uploadId, uploadJob.progress);
        
        throw new Error(`Google Cloud upload failed: ${googleCloudError.message}. Please try uploading your video again.`);
      }

      if (!uploadedVideo || !uploadedVideo.videoId) {
        throw new Error('Upload failed - no video ID returned from Google Cloud');
      }

      console.log('💾 Starting Firebase save...');
      // Save to Firebase
      await this.saveVideoToFirebase(uploadJob, uploadedVideo);
      console.log('✅ Firebase save completed');

      // Mark as completed
      uploadJob.status = 'completed';
      uploadJob.progress = {
        ...uploadJob.progress,
        stage: 'complete',
        progress: 100,
        message: 'Upload complete! Your video is now live 🎉'
      };
      this.updateUploadProgress(uploadId, uploadJob.progress);

      // Auto-hide after 3 seconds
      setTimeout(() => {
        this.hideUploadIndicator(uploadId);
      }, 3000);

      console.log('✅ BACKGROUND PROCESS: Upload completed successfully:', uploadId);
      
      // Show success notification
      setTimeout(() => {
        console.log('🎉 Upload Complete! Your video is now live and ready to be watched!');
      }, 500);
      
      // Notify upload completion
      this.notifyUploadComplete(uploadId);

    } catch (error: any) {
      console.error('❌ BACKGROUND PROCESS: Upload failed for:', uploadId, error);
      console.error('❌ Error details:', {
        message: error?.message || 'Unknown error',
        code: error?.code || 'unknown',
        stack: error?.stack || 'No stack trace'
      });
      
      // Mark as failed
      uploadJob.status = 'failed';
      uploadJob.progress = {
        ...uploadJob.progress,
        stage: 'error',
        progress: 0,
        message: 'Upload failed. Tap to retry.'
      };
      this.updateUploadProgress(uploadId, uploadJob.progress);
    }

    // Save updated jobs to storage
    await this.saveUploadJobsToStorage();
  }

  /**
   * Save video to Firebase database
   */
  private async saveVideoToFirebase(uploadJob: UploadJobInfo, uploadedVideo: any): Promise<void> {
    console.log('💾 FIREBASE SAVE: Starting save process...');
    console.log('📋 Upload job:', uploadJob);
    console.log('🎬 Uploaded video data:', uploadedVideo);
    
    try {
      console.log('📦 Importing Firebase modules...');
      const { doc, setDoc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../firebaseConfig');
      console.log('✅ Firebase modules imported successfully');

      // Get user profile for username
      let username = 'glint_user';
      try {
        console.log('👤 Fetching user profile...');
        const userDoc = await getDoc(doc(db, 'users', uploadJob.userId));
        if (userDoc.exists()) {
          username = userDoc.data().username || 'glint_user';
          console.log('✅ Username fetched:', username);
        } else {
          console.warn('⚠️ User document not found, using default username');
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch username, using default:', error);
      }

      // Handle thumbnail
      let thumbnailUrl = uploadedVideo.thumbnailUrl;
      console.log('📸 Initial thumbnail URL:', thumbnailUrl);
      
      if (uploadJob.customThumbnail) {
        try {
          console.log('📤 Uploading custom thumbnail...');
          // Upload custom thumbnail to Firebase Storage
          const { ref, uploadBytes, getDownloadURL, getStorage } = await import('firebase/storage');
          
          const storage = getStorage();
          const thumbnailRef = ref(storage, `thumbnails/${uploadedVideo.videoId}_custom.jpg`);
          
          const response = await fetch(uploadJob.customThumbnail);
          const blob = await response.blob();
          
          const uploadResult = await uploadBytes(thumbnailRef, blob);
          thumbnailUrl = await getDownloadURL(uploadResult.ref);
          
          console.log('✅ Custom thumbnail uploaded:', thumbnailUrl);
        } catch (thumbnailError) {
          console.warn('⚠️ Custom thumbnail upload failed, using default:', thumbnailError);
        }
      }

      // Create video document for Google Cloud
      const videoDoc = {
        userId: uploadJob.userId,
        assetId: uploadedVideo.videoId, // Google Cloud uses videoId
        playbackUrl: uploadedVideo.streamingUrl, // Google Cloud uses streamingUrl
        thumbnailUrl: thumbnailUrl,
        thumbnailType: uploadJob.customThumbnail ? 'custom' : 'auto',
        createdAt: new Date().toISOString(),
        username: username,
        caption: uploadJob.caption || 'My Video',
        views: 0,
        likes: 0,
        processed: true,
        status: 'ready', // Google Cloud videos are immediately ready
        uploadMethod: 'background',
        uploadId: uploadJob.id,
        isRealVideo: true,
        hasCustomThumbnail: !!uploadJob.customThumbnail,
        uploadTab: uploadJob.uploadContext || 'Glints', // Track which tab the video was uploaded from
        contentType: uploadJob.uploadContext === 'Trends' ? 'trending' : 'glint' // Track content type
      };

      console.log('📝 Video document to save:', videoDoc);
      console.log('🎯 Document ID (videoId):', uploadedVideo.videoId);

      console.log('💾 Saving to Firebase...');
      await setDoc(doc(db, 'videos', uploadedVideo.videoId), videoDoc);
      console.log('✅ Video document saved to Firebase successfully');
      
      // Also save to posts collection for feed display
      console.log('📝 Saving to posts collection for feed...');
      await setDoc(doc(db, 'posts', uploadedVideo.videoId), {
        ...videoDoc,
        type: 'video',
        uploadTab: uploadJob.uploadContext || 'Glints',
        contentType: uploadJob.uploadContext === 'Trends' ? 'trending' : 'glint'
      });
      console.log('✅ Post document saved to Firebase successfully');
      
      // If uploaded for Trends, also save to trends collection
      if (uploadJob.uploadContext === 'Trends') {
        console.log('🔥 Saving to trends collection for Trends tab...');
        await setDoc(doc(db, 'trends', uploadedVideo.videoId), {
          ...videoDoc,
          trendingScore: 0,
          trendingDate: new Date().toISOString(),
          category: 'user-generated'
        });
        console.log('✅ Trend document saved to Firebase successfully');
      }
      
      // VERIFICATION: Immediately check if the document was saved
      try {
        console.log('🔍 VERIFICATION: Checking if document was saved...');
        const savedDoc = await getDoc(doc(db, 'videos', uploadedVideo.videoId));
        if (savedDoc.exists()) {
          console.log('🔍 VERIFICATION: ✅ Video document confirmed in Firebase:', savedDoc.data());
        } else {
          console.error('🔍 VERIFICATION: ❌ Video document NOT found in Firebase after save!');
          throw new Error('Document save verification failed - document not found after save');
        }
      } catch (verifyError) {
        console.error('🔍 VERIFICATION: ❌ Error during save verification:', verifyError);
        throw new Error(`Save verification failed: ${(verifyError as any)?.message || 'Unknown error'}`);
      }
      
    } catch (error: any) {
      console.error('❌ FIREBASE SAVE: Failed to save video to Firebase:', error);
      console.error('❌ Error details:', {
        message: error?.message || 'Unknown error',
        code: error?.code || 'unknown',
        stack: error?.stack || 'No stack trace'
      });
      throw error;
    }
  }

  /**
   * Show upload indicator (YouTube-style)
   */
  private showUploadIndicator(uploadJob: UploadJobInfo): void {
    console.log('📱 Showing YouTube-style upload indicator:', uploadJob.id);
    
    // Emit event to show upload indicator in UI
    // This would be caught by a global upload indicator component
    this.updateUploadProgress(uploadJob.id, uploadJob.progress);
  }

  /**
   * Hide upload indicator
   */
  private hideUploadIndicator(uploadId: string): void {
    console.log('📱 Hiding upload indicator:', uploadId);
    
    // Remove upload job
    this.uploadJobs.delete(uploadId);
    this.progressCallbacks.delete(uploadId);
    this.saveUploadJobsToStorage();
  }

  /**
   * Update upload progress and notify listeners
   */
  private updateUploadProgress(uploadId: string, progress: BackgroundUploadProgress): void {
    // Call progress callback if registered
    const callback = this.progressCallbacks.get(uploadId);
    if (callback) {
      callback(progress);
    }

    // Notify global progress listeners
    this.notifyProgressUpdate(uploadId, progress);

    // You could also emit a global event here for UI components to listen to
    console.log(`📊 Upload progress ${uploadId}:`, `${progress.progress}% - ${progress.message}`);
  }

  /**
   * Register progress callback for UI updates
   */
  public onProgress(uploadId: string, callback: (progress: BackgroundUploadProgress) => void): void {
    this.progressCallbacks.set(uploadId, callback);
  }

  /**
   * Get all active uploads
   */
  public getActiveUploads(): UploadJobInfo[] {
    return Array.from(this.uploadJobs.values()).filter(job => 
      job.status === 'pending' || job.status === 'uploading'
    );
  }

  /**
   * Get completed uploads
   */
  public getCompletedUploads(): UploadJobInfo[] {
    return Array.from(this.uploadJobs.values()).filter(job => 
      job.status === 'completed'
    );
  }

  /**
   * Retry failed upload
   */
  public async retryUpload(uploadId: string): Promise<void> {
    const uploadJob = this.uploadJobs.get(uploadId);
    if (!uploadJob) {
      console.error('❌ Upload job not found for retry:', uploadId);
      return;
    }

    console.log('🔄 Retrying upload:', uploadId);
    uploadJob.status = 'pending';
    uploadJob.progress.stage = 'preparing';
    uploadJob.progress.progress = 0;
    uploadJob.progress.message = 'Retrying upload...';
    
    this.updateUploadProgress(uploadId, uploadJob.progress);
    this.processUploadInBackground(uploadId);
  }

  /**
   * Save upload jobs to persistent storage
   */
  private async saveUploadJobsToStorage(): Promise<void> {
    try {
      const jobs = Array.from(this.uploadJobs.values());
      await AsyncStorage.setItem('background_uploads', JSON.stringify(jobs));
    } catch (error) {
      console.error('❌ Failed to save upload jobs:', error);
    }
  }

  /**
   * Load upload jobs from persistent storage
   * FIXED: No longer resumes incomplete uploads to prevent duplicates
   */
  public async loadUploadJobsFromStorage(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('background_uploads');
      if (stored) {
        const jobs: UploadJobInfo[] = JSON.parse(stored);
        
        // Restore jobs map but don't auto-resume to prevent duplicates
        jobs.forEach(job => {
          this.uploadJobs.set(job.id, job);
          
          // FIXED: Mark incomplete uploads as failed instead of resuming
          // This prevents duplicate uploads when app restarts
          if (job.status === 'pending' || job.status === 'uploading') {
            console.log('⚠️ Marking incomplete upload as failed to prevent duplicate:', job.id);
            job.status = 'failed';
            job.progress.stage = 'error';
            job.progress.message = 'Upload interrupted - please try again';
          }
        });
        
        console.log(`📂 Loaded ${jobs.length} upload jobs from storage (no auto-resume)`);
      }
    } catch (error) {
      console.error('❌ Failed to load upload jobs:', error);
    }
  }
}

// Create singleton instance
export const backgroundUploadService = new BackgroundUploadService();

export default backgroundUploadService;
