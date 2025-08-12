// Enhanced Video Processing Pipeline
// Handles complete end-to-end video processing with aspect ratio preservation

export interface VideoMetadata {
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'portrait' | 'landscape' | 'square';
  duration: number;
  frameRate: number;
  fileSize: number;
  format: string;
  bitrate?: number;
}

export interface ProcessedVideoVariant {
  resolution: '480p' | '720p' | '1080p' | '1440p' | '4K';
  width: number;
  height: number;
  url: string;
  fileSize: number;
  bitrate: number;
}

export interface VideoProcessingResult {
  originalMetadata: VideoMetadata;
  variants: ProcessedVideoVariant[];
  thumbnails: {
    url: string;
    width: number;
    height: number;
    timeOffset: number;
  }[];
  previewClip?: {
    url: string;
    duration: number;
  };
  cdnUrls: {
    [resolution: string]: string;
  };
  playbackPolicy: {
    renderingMode: 'contain' | 'cover' | 'fill';
    backgroundFill: 'solid' | 'blur' | 'gradient';
    backgroundColor?: string;
  };
}

export interface UploadStageProgress {
  stage: 'metadata' | 'upload' | 'transcoding' | 'cdn' | 'complete';
  progress: number;
  message: string;
  currentResolution?: string;
  estimatedTime?: string;
}

class VideoProcessingPipeline {
  private apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

  // Stage 1: Extract Video Metadata on Device
  async extractVideoMetadata(videoUri: string): Promise<VideoMetadata> {
    console.log('📊 Stage 1: Extracting video metadata...');
    
    try {
      // Use React Native Video or expo-av to get metadata
      const { Video } = await import('expo-av');
      
      return new Promise((resolve, reject) => {
        const video = new Video({});
        video.loadAsync({ uri: videoUri })
          .then((status: any) => {
            if (status.isLoaded) {
              const metadata: VideoMetadata = {
                width: status.naturalSize?.width || 1080,
                height: status.naturalSize?.height || 1920,
                aspectRatio: (status.naturalSize?.width || 1080) / (status.naturalSize?.height || 1920),
                orientation: this.determineOrientation(
                  status.naturalSize?.width || 1080, 
                  status.naturalSize?.height || 1920
                ),
                duration: status.durationMillis || 0,
                frameRate: 30, // Default, would need native module for exact
                fileSize: 0, // Would need file system access
                format: 'mp4'
              };

              console.log('📐 Video metadata extracted:', metadata);
              resolve(metadata);
            } else {
              reject(new Error('Failed to load video for metadata extraction'));
            }
          })
          .catch(reject);
      });
    } catch (error) {
      console.error('❌ Metadata extraction failed:', error);
      // Fallback metadata
      return {
        width: 1080,
        height: 1920,
        aspectRatio: 0.5625,
        orientation: 'portrait',
        duration: 30000,
        frameRate: 30,
        fileSize: 0,
        format: 'mp4'
      };
    }
  }

  // Stage 2: Upload with Chunking Support
  async uploadWithChunking(
    videoUri: string, 
    metadata: VideoMetadata,
    onProgress: (progress: UploadStageProgress) => void
  ): Promise<string> {
    console.log('⬆️ Stage 2: Uploading video with chunking...');
    
    onProgress({
      stage: 'upload',
      progress: 0,
      message: 'Starting chunked upload...'
    });

    try {
      // Create upload session
      const uploadResponse = await fetch(`${this.apiUrl}/video/create-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata,
          chunkSize: 1024 * 1024 * 5, // 5MB chunks
          filename: `video_${Date.now()}.mp4`
        })
      });

      const { uploadId, uploadUrl } = await uploadResponse.json();

      // Upload with progress tracking
      await this.performChunkedUpload(videoUri, uploadUrl, (progress) => {
        onProgress({
          stage: 'upload',
          progress: progress,
          message: `Uploading... ${progress.toFixed(1)}%`
        });
      });

      console.log('✅ Upload completed:', uploadId);
      return uploadId;

    } catch (error) {
      console.error('❌ Upload failed:', error);
      throw error;
    }
  }

  // Stage 3: Server-Side Processing
  async processVideo(
    uploadId: string,
    metadata: VideoMetadata,
    onProgress: (progress: UploadStageProgress) => void
  ): Promise<VideoProcessingResult> {
    console.log('⚙️ Stage 3: Server-side video processing...');

    try {
      // Trigger processing
      const processResponse = await fetch(`${this.apiUrl}/video/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          originalMetadata: metadata,
          processingOptions: {
            generateVariants: true,
            resolutions: ['480p', '720p', '1080p'],
            preserveAspectRatio: true,
            generateThumbnails: true,
            createPreview: true
          }
        })
      });

      const { processingId } = await processResponse.json();

      // Poll for processing status
      return await this.pollProcessingStatus(processingId, onProgress);

    } catch (error) {
      console.error('❌ Processing failed:', error);
      throw error;
    }
  }

  // Stage 4: CDN Distribution
  async distributeToCDN(processingResult: VideoProcessingResult): Promise<VideoProcessingResult> {
    console.log('🌍 Stage 4: Distributing to CDN...');

    try {
      const cdnResponse = await fetch(`${this.apiUrl}/video/distribute-cdn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variants: processingResult.variants,
          thumbnails: processingResult.thumbnails
        })
      });

      const cdnUrls = await cdnResponse.json();
      
      return {
        ...processingResult,
        cdnUrls: cdnUrls,
        variants: processingResult.variants.map(variant => ({
          ...variant,
          url: cdnUrls[variant.resolution] || variant.url
        }))
      };

    } catch (error) {
      console.error('❌ CDN distribution failed:', error);
      return processingResult; // Return original URLs as fallback
    }
  }

  // Complete End-to-End Processing
  async processVideoEndToEnd(
    videoUri: string,
    onProgress: (progress: UploadStageProgress) => void
  ): Promise<VideoProcessingResult> {
    console.log('🎬 Starting end-to-end video processing pipeline...');

    try {
      // Stage 1: Extract metadata
      onProgress({
        stage: 'metadata',
        progress: 5,
        message: 'Analyzing video...'
      });
      
      const metadata = await this.extractVideoMetadata(videoUri);

      // Stage 2: Upload
      const uploadId = await this.uploadWithChunking(videoUri, metadata, onProgress);

      // Stage 3: Process
      const processingResult = await this.processVideo(uploadId, metadata, onProgress);

      // Stage 4: CDN
      onProgress({
        stage: 'cdn',
        progress: 90,
        message: 'Distributing globally...'
      });
      
      const finalResult = await this.distributeToCDN(processingResult);

      // Complete
      onProgress({
        stage: 'complete',
        progress: 100,
        message: 'Video ready!'
      });

      console.log('🎉 Video processing pipeline completed!');
      return finalResult;

    } catch (error) {
      console.error('❌ Pipeline failed:', error);
      throw error;
    }
  }

  // Determine Feed Eligibility
  determineVideoFeeds(metadata: VideoMetadata, duration: number): string[] {
    const feeds: string[] = [];

    // Short video feed criteria
    if (duration < 60000) { // Under 60 seconds
      feeds.push('shorts');
    }

    // Always eligible for home feed
    feeds.push('home');

    // Stories feed for very short content
    if (duration < 15000) { // Under 15 seconds
      feeds.push('stories');
    }

    console.log(`📱 Video eligible for feeds: ${feeds.join(', ')}`);
    return feeds;
  }

  // Generate Rendering Policy
  generateRenderingPolicy(metadata: VideoMetadata): VideoProcessingResult['playbackPolicy'] {
    const { aspectRatio, orientation } = metadata;

    // Default to contain for aspect ratio preservation
    let renderingMode: 'contain' | 'cover' | 'fill' = 'contain';
    let backgroundFill: 'solid' | 'blur' | 'gradient' = 'solid';

    // Adjust based on orientation
    if (orientation === 'portrait' && aspectRatio < 0.6) {
      // Very tall videos can use cover
      renderingMode = 'cover';
    }

    // Use blur background for landscape videos in portrait feeds
    if (orientation === 'landscape') {
      backgroundFill = 'blur';
    }

    return {
      renderingMode,
      backgroundFill,
      backgroundColor: '#000000'
    };
  }

  // Helper Methods
  private determineOrientation(width: number, height: number): 'portrait' | 'landscape' | 'square' {
    const aspectRatio = width / height;
    
    if (aspectRatio < 0.9) return 'portrait';
    if (aspectRatio > 1.1) return 'landscape';
    return 'square';
  }

  private async performChunkedUpload(
    videoUri: string, 
    uploadUrl: string, 
    onProgress: (progress: number) => void
  ): Promise<void> {
    // Simplified chunked upload - in real implementation would use proper chunking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', 'video/mp4');

      const formData = new FormData();
      formData.append('video', {
        uri: videoUri,
        type: 'video/mp4',
        name: 'video.mp4'
      } as any);

      xhr.send(formData);
    });
  }

  private async pollProcessingStatus(
    processingId: string,
    onProgress: (progress: UploadStageProgress) => void
  ): Promise<VideoProcessingResult> {
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes maximum

    while (attempts < maxAttempts) {
      try {
        const statusResponse = await fetch(`${this.apiUrl}/video/processing-status/${processingId}`);
        const status = await statusResponse.json();

        onProgress({
          stage: 'transcoding',
          progress: status.progress || 50,
          message: status.message || 'Processing video...',
          currentResolution: status.currentResolution
        });

        if (status.completed) {
          return status.result;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;

      } catch (error) {
        console.error('❌ Polling error:', error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw new Error('Processing timeout');
  }
}

export const videoProcessingPipeline = new VideoProcessingPipeline();
export default videoProcessingPipeline;
