// Enhanced Mux Service - React Native Compatible
import { VideoCompressionService } from './videoCompressionService';

interface VideoProcessingOptions {
  quality: 'high' | 'medium' | 'low';
  autoCompress: boolean;
  generateThumbnails: boolean;
  adaptiveBitrate: boolean;
}

export interface UploadProgress {
  progress: number;
  stage: 'compressing' | 'uploading' | 'processing' | 'complete';
  message: string;
  fileSize?: string;
  uploadSpeed?: string;
  timeRemaining?: string;
}

export interface VideoAsset {
  id: string;
  assetId: string;
  playbackUrl: string;
  thumbnailUrl?: string | null;
  status: string;
  uploadTime: string;
  storage?: string;
  isRealVideo?: boolean;
}

class EnhancedMuxService {
  private apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.159:3000';

  // Check if backend is available
  async checkBackendHealth(): Promise<boolean> {
    try {
      console.log('🏥 Checking Mux backend health at:', this.apiUrl);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.apiUrl}/health`, { 
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);
      const data = await response.json();
      console.log('🏥 Backend health check:', data);
      return data.status === 'OK' && data.muxEnabled;
    } catch (error) {
      console.log('⚠️ Backend not available, using development mode');
      return false;
    }
  }

  // React Native compatible file upload to Mux
  async uploadToMux(uploadUrl: string, videoUri: string, onProgress: (progress: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      // For React Native, we need to use XMLHttpRequest for proper upload progress
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          onProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error'));
      });

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', 'video/mp4');

      // For React Native, create a FormData with the file
      const formData = new FormData();
      formData.append('file', {
        uri: videoUri,
        type: 'video/mp4',
        name: 'video.mp4',
      } as any);

      xhr.send(formData);
    });
  }

  // Real Mux upload flow - React Native compatible
  async realMuxUpload(videoUri: string, onProgress: (progress: UploadProgress) => void): Promise<VideoAsset> {
    try {
      onProgress({
        progress: 10,
        stage: 'uploading',
        message: 'Creating upload URL...'
      });

      // Step 1: Create upload URL from your backend
      const createResponse = await fetch(`${this.apiUrl}/api/mux/create-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metadata: {
            title: 'Glint Video',
            app: 'glint',
            uploaded_at: new Date().toISOString()
          }
        })
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Failed to create upload URL: ${createResponse.status} - ${errorText}`);
      }

      const uploadData = await createResponse.json();
      console.log('✅ Mux upload URL created:', uploadData);

      if (!uploadData.success || !uploadData.uploadUrl) {
        throw new Error('Invalid upload response from backend');
      }

      onProgress({
        progress: 20,
        stage: 'uploading',
        message: 'Uploading to Mux...'
      });

      // Step 2: Upload video file to Mux using React Native compatible method
      await this.uploadToMux(uploadData.uploadUrl, videoUri, (uploadProgress) => {
        onProgress({
          progress: 20 + (uploadProgress * 0.5), // 20% to 70%
          stage: 'uploading',
          message: `Uploading... ${Math.round(uploadProgress)}%`
        });
      });

      onProgress({
        progress: 70,
        stage: 'processing',
        message: 'Processing video...'
      });

      // Step 3: Wait for processing and get asset info
      let asset;
      let attempts = 0;
      const maxAttempts = 600; // 10 minutes max wait - doubled timeout for longer videos
      let pollInterval = 2000; // Start with 2 second intervals
      let consecutiveErrors = 0;

      while (attempts < maxAttempts) {
        // Use progressive polling - start slow, get faster, then slow down again
        if (attempts < 10) pollInterval = 2000; // First 20 seconds: every 2 seconds
        else if (attempts < 60) pollInterval = 3000; // Next 2.5 minutes: every 3 seconds  
        else pollInterval = 5000; // After that: every 5 seconds

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        try {
          // Create timeout controller for React Native compatibility
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const assetResponse = await fetch(`${this.apiUrl}/api/mux/asset/${uploadData.assetId}`, {
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (assetResponse.ok) {
            const assetData = await assetResponse.json();
            console.log(`🔍 Asset status check (${attempts}/${maxAttempts}):`, assetData.asset?.status);
            
            if (assetData.success && assetData.asset) {
              if (assetData.asset.status === 'ready') {
                asset = assetData.asset;
                console.log('✅ Asset is ready!', asset.id);
                break;
              } else if (assetData.asset.status === 'errored') {
                console.error('❌ Asset processing failed with error status');
                throw new Error('Video processing failed - please try uploading again');
              }
              // Reset error counter on successful response
              consecutiveErrors = 0;
            }
          } else {
            consecutiveErrors++;
            console.log(`⚠️ Asset check failed (${assetResponse.status}), attempt ${consecutiveErrors}`);
          }
        } catch (error: any) {
          consecutiveErrors++;
          console.log(`⚠️ Asset check error (attempt ${consecutiveErrors}):`, error.message);
          
          // If we have too many consecutive errors, something is seriously wrong
          if (consecutiveErrors >= 5) {
            console.error('❌ Too many consecutive errors checking asset status');
            throw new Error('Unable to check video processing status - please check your connection');
          }
        }
        
        attempts++;
        
        // Update progress with more informative messages
        const progressPercent = 70 + (attempts / maxAttempts) * 25;
        let progressMessage = `Processing video... (${Math.floor(attempts * pollInterval / 1000)}s elapsed)`;
        
        if (attempts > 300) {
          progressMessage = `Still processing... This video may take a bit longer (${Math.floor(attempts * pollInterval / 1000)}s elapsed)`;
        }
        
        onProgress({
          progress: progressPercent,
          stage: 'processing',
          message: progressMessage
        });
      }

      if (!asset) {
        console.warn('⚠️ Mux processing timed out after 10 minutes, falling back to Firebase Storage...');
        throw new Error('Video processing is taking longer than expected. Please try uploading again - some videos need more time to process.');
      }

      onProgress({
        progress: 100,
        stage: 'complete',
        message: 'Upload complete!'
      });

      // Return asset with playback URLs
      const playbackId = asset.playback_urls?.[0]?.id || uploadData.assetId;
      
      return {
        id: uploadData.assetId,
        assetId: uploadData.assetId,
        playbackUrl: `https://stream.mux.com/${playbackId}.mp4`,
        thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&width=320&height=180&fit_mode=crop`,
        status: 'ready',
        uploadTime: new Date().toISOString(),
      };

    } catch (error: any) {
      console.error('❌ Real Mux upload failed:', error);
      throw error;
    }
  }

  // Simplified upload method that works in React Native
  async uploadVideoWithChunks(
    videoUri: string, 
    onProgress: (progress: UploadProgress) => void,
    options: VideoProcessingOptions = {
      quality: 'medium',
      autoCompress: true,
      generateThumbnails: true,
      adaptiveBitrate: true
    }
  ): Promise<VideoAsset> {
    try {
      console.log('🎬 Starting REAL video upload process...');
      console.log('📹 Video URI:', videoUri);
      
      // Stage 1: Compression analysis
      onProgress({
        progress: 5,
        stage: 'compressing',
        message: VideoCompressionService.getCompressionMessage(5)
      });

      // Simulate compression progress with better messages
      for (let i = 0; i < 4; i++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        const compressionProgress = 5 + (i * 5);
        onProgress({
          progress: compressionProgress,
          stage: 'compressing',
          message: VideoCompressionService.getCompressionMessage(compressionProgress)
        });
      }

      // Check if real Mux backend is available FIRST (priority)
      const hasRealMux = await this.checkBackendHealth();
      
      if (hasRealMux) {
        console.log('🎬 Using real Mux integration for professional hosting');
        try {
          return await this.realMuxUpload(videoUri, onProgress);
        } catch (muxError: any) {
          console.warn('⚠️ Mux upload failed, automatically falling back to Firebase Storage:', muxError.message);
          
          // Show user that we're falling back
          onProgress({
            progress: 10,
            stage: 'uploading',
            message: 'Primary upload failed, trying backup method...'
          });
          
          // Fall back to Firebase Storage
          const RealVideoUploadService = await import('./realVideoUploadService');
          return await RealVideoUploadService.default.uploadVideoToFirebase(videoUri, onProgress);
        }
      }

      // Fallback to Firebase Storage if Mux is not available
      console.log('🔥 Mux not available, using Firebase Storage...');
      const RealVideoUploadService = await import('./realVideoUploadService');
      return await RealVideoUploadService.default.uploadVideoToFirebase(videoUri, onProgress);

    } catch (error: any) {
      console.error('❌ Upload failed:', error);
      throw new Error(`Video upload failed: ${error.message || 'Unknown error'}`);
    }
  }
}

export default new EnhancedMuxService();