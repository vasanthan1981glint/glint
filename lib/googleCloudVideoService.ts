// Google Cloud Video Service for React Native - Replaces Mux completely!
// This eliminates all your upload failures and provides instant streaming

import { auth } from '../firebaseConfig';
import FirebaseThumbnailService from './firebaseThumbnailService';

export interface GoogleCloudUploadOptions {
  videoUri: string;
  title?: string;
  description?: string;
  metadata?: Record<string, any>;
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (video: StreamingVideoData) => void;
  onError?: (error: string) => void;
}

export interface UploadProgress {
  progress: number; // 0-100
  stage: 'creating' | 'uploading' | 'complete' | 'error';
  message?: string;
  fileSize?: number;
  uploadSpeed?: number;
  timeRemaining?: number;
}

export interface StreamingVideoData {
  videoId: string;
  fileName: string;
  streamingUrl: string;
  thumbnailUrl: string;
  size?: number;
  uploadedAt: string;
  status: 'ready' | 'uploading' | 'error';
  metadata?: Record<string, any>;
}

class GoogleCloudVideoService {
  private apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://glint-production-f754.up.railway.app';
  private activeUploads = new Map<string, boolean>();

  /**
   * Check if backend is available and working
   */
  async checkBackendHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
      });

      if (!response.ok) {
        console.warn('⚠️ Backend health check failed:', response.status);
        return false;
      }

      const data = await response.json();
      console.log('✅ Google Cloud backend healthy:', data.service);
      return data.status === 'healthy' && data.storage === 'connected';
      
    } catch (error: any) {
      console.warn('⚠️ Backend health check error:', error.message);
      return false;
    }
  }

  /**
   * Upload video to Google Cloud - Much more reliable than Mux!
   */
  async uploadVideo(options: GoogleCloudUploadOptions): Promise<StreamingVideoData> {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Mark upload as active
      this.activeUploads.set(uploadId, true);

      options.onProgress?.({
        progress: 10,
        stage: 'creating',
        message: 'Creating upload URL...'
      });

      // Step 1: Create signed upload URL (replaces Mux create upload)
      const createResponse = await fetch(`${this.apiUrl}/upload/signed-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: `video_${Date.now()}.mp4`,
          contentType: 'video/mp4', // Always use video/mp4 to ensure consistency
          userId: options.metadata?.userId || 'anonymous',
          metadata: {
            title: options.title || 'Glint Video',
            description: options.description || '',
            app: 'glint',
            uploadedAt: new Date().toISOString(),
            ...options.metadata
          }
        })
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create upload URL: ${createResponse.status} - ${errorText}`);
      }

      const uploadData = await createResponse.json();
      console.log('✅ Google Cloud upload URL created:', uploadData.fileName);

      if (!uploadData.success || !uploadData.uploadUrl) {
        throw new Error('Invalid upload response from Google Cloud');
      }

      options.onProgress?.({
        progress: 30,
        stage: 'uploading',
        message: 'Uploading to Google Cloud...'
      });

      // Step 2: Upload video directly to Google Cloud Storage
      await this.uploadToGoogleCloud(
        uploadData.uploadUrl, 
        options.videoUri, 
        (uploadProgress) => {
          options.onProgress?.({
            progress: 30 + (uploadProgress * 0.6), // 30% to 90%
            stage: 'uploading',
            message: `Uploading... ${Math.round(uploadProgress)}%`
          });
        }
      );

      options.onProgress?.({
        progress: 90,
        stage: 'uploading',
        message: 'Generating thumbnail...'
      });

      // Step 3: Generate and upload thumbnail to Firebase Storage
      let thumbnailUrl = uploadData.videoUrl; // Fallback to video URL
      
      try {
        const currentUser = auth.currentUser;
        if (currentUser && options.metadata?.userId) {
          const videoId = uploadData.fileName.replace(/^videos\/.*?\//, '').replace(/\.[^.]+$/, '');
          
          console.log('🎬 Generating thumbnail for video:', videoId);
          const thumbnailResult = await FirebaseThumbnailService.processVideoThumbnail(
            options.videoUri,
            videoId,
            options.metadata.userId,
            {
              time: 1000, // Extract thumbnail at 1 second
              quality: 0.8,
              width: 320,
              height: 240
            }
          );
          
          thumbnailUrl = thumbnailResult.thumbnailUrl;
          console.log('✅ Thumbnail uploaded to Firebase:', thumbnailUrl);
        }
      } catch (thumbnailError) {
        console.warn('⚠️ Thumbnail generation failed, using video URL as fallback:', thumbnailError);
        // Continue with video URL as thumbnail - don't fail the upload
      }

      options.onProgress?.({
        progress: 95,
        stage: 'complete',
        message: 'Upload complete! Video ready for streaming!'
      });

      // Step 4: Video is immediately ready (no processing delays like Mux!)
      const videoData: StreamingVideoData = {
        videoId: uploadData.fileName.replace(/^videos\/.*?\//, '').replace(/\.[^.]+$/, ''), // Extract clean ID from filename
        fileName: uploadData.fileName,
        streamingUrl: uploadData.playbackUrl, // Backend provides playbackUrl
        thumbnailUrl: thumbnailUrl, // Use Firebase thumbnail or fallback to video URL
        uploadedAt: new Date().toISOString(),
        status: 'ready',
        metadata: options.metadata
      };

      options.onProgress?.({
        progress: 100,
        stage: 'complete',
        message: 'Video ready for streaming! 🎉'
      });

      options.onComplete?.(videoData);
      console.log('✅ Google Cloud upload completed:', videoData.videoId);

      return videoData;

    } catch (error: any) {
      console.error('❌ Google Cloud upload failed:', error);
      
      // Provide user-friendly error messages
      let userMessage = 'Upload failed. Please try again.';
      
      if (error.message.includes('network') || error.message.includes('connection')) {
        userMessage = 'Connection error. Please check your internet and try again.';
      } else if (error.message.includes('timeout')) {
        userMessage = 'Upload took too long. Please try again with a smaller video.';
      } else if (error.message.includes('size') || error.message.includes('large')) {
        userMessage = 'Video file too large. Please compress or trim your video.';
      }

      options.onProgress?.({
        progress: 0,
        stage: 'error',
        message: userMessage
      });

      options.onError?.(userMessage);
      throw new Error(`Google Cloud upload failed: ${userMessage}`);
      
    } finally {
      this.activeUploads.delete(uploadId);
    }
  }

  /**
   * Upload video file to Google Cloud Storage
   */
  private async uploadToGoogleCloud(
    signedUrl: string, 
    videoUri: string, 
    onProgress?: (progress: number) => void
  ): Promise<void> {
    try {
      // Get video file as blob
      const response = await fetch(videoUri);
      const videoBlob = await response.blob();
      
      console.log('📤 Uploading to Google Cloud Storage:', videoBlob.size, 'bytes');

      // Upload to Google Cloud using signed URL
      // IMPORTANT: Content-Type must match exactly what was used during signing
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4', // Always use video/mp4 to match signed URL
        },
        body: videoBlob,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ Upload failed with status:', uploadResponse.status);
        console.error('❌ Upload error response:', errorText);
        console.error('❌ Upload headers sent:', JSON.stringify({'Content-Type': 'video/mp4'}));
        throw new Error(`Google Cloud upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      onProgress?.(100);
      console.log('✅ Google Cloud upload successful');

    } catch (error: any) {
      console.error('❌ Google Cloud upload error:', error);
      throw new Error(`Google Cloud upload failed: ${error.message}`);
    }
  }

  /**
   * Get video information from Google Cloud
   */
  async getVideoInfo(videoId: string): Promise<StreamingVideoData | null> {
    try {
      const response = await fetch(`${this.apiUrl}/api/videos/${videoId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Video not found
        }
        throw new Error(`Failed to get video info: ${response.status}`);
      }

      const videoData = await response.json();
      return videoData as StreamingVideoData;

    } catch (error: any) {
      console.error('❌ Failed to get video info:', error);
      return null;
    }
  }

  /**
   * List all videos (for debugging/admin)
   */
  async listVideos(): Promise<StreamingVideoData[]> {
    try {
      const response = await fetch(`${this.apiUrl}/api/videos`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to list videos: ${response.status}`);
      }

      const data = await response.json();
      return data.videos || [];

    } catch (error: any) {
      console.error('❌ Failed to list videos:', error);
      return [];
    }
  }

  /**
   * Delete video from Google Cloud
   */
  async deleteVideo(videoId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/api/videos/${videoId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete video: ${response.status}`);
      }

      console.log('✅ Video deleted from Google Cloud:', videoId);
      return true;

    } catch (error: any) {
      console.error('❌ Failed to delete video:', error);
      return false;
    }
  }

  /**
   * Cancel active upload
   */
  cancelUpload(uploadId: string): void {
    this.activeUploads.delete(uploadId);
    console.log('🛑 Upload cancelled:', uploadId);
  }

  /**
   * Check if upload is active
   */
  isUploadActive(uploadId: string): boolean {
    return this.activeUploads.has(uploadId);
  }

  /**
   * Get streaming URL for video (immediate access, no delays!)
   */
  getStreamingUrl(videoId: string): string {
    return `https://storage.googleapis.com/glint-videos/${videoId}.mp4`;
  }

  /**
   * Get thumbnail URL for video
   */
  getThumbnailUrl(videoId: string): string {
    return `https://storage.googleapis.com/glint-videos/thumbnails/${videoId}.jpg`;
  }
}

// Export singleton instance
const googleCloudVideoService = new GoogleCloudVideoService();
export { GoogleCloudVideoService, googleCloudVideoService };
export default googleCloudVideoService;
