// Updated Background Upload Service - Google Cloud Version
// Replaces Mux with reliable Google Cloud uploads!

import AsyncStorage from '@react-native-async-storage/async-storage';
import GoogleCloudVideoService, {
    GoogleCloudUploadOptions,
    StreamingVideoData,
    UploadProgress
} from './googleCloudVideoService';

interface UploadJob {
  id: string;
  videoUri: string;
  title?: string;
  description?: string;
  metadata?: Record<string, any>;
  progress: UploadProgress;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  retryCount: number;
  createdAt: string;
  completedAt?: string;
}

class BackgroundUploadService {
  private uploadQueue: UploadJob[] = [];
  private isProcessing = false;
  private listeners: ((jobs: UploadJob[]) => void)[] = [];
  private maxRetries = 3;

  constructor() {
    this.loadUploadQueue();
  }

  /**
   * Add video to upload queue - much more reliable than Mux!
   */
  async addToQueue(options: Omit<GoogleCloudUploadOptions, 'onProgress' | 'onComplete' | 'onError'>): Promise<string> {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const uploadJob: UploadJob = {
      id: uploadId,
      videoUri: options.videoUri,
      title: options.title,
      description: options.description,
      metadata: options.metadata,
      progress: {
        progress: 0,
        stage: 'creating',
        message: 'Added to upload queue...'
      },
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString()
    };

    this.uploadQueue.push(uploadJob);
    await this.saveUploadQueue();
    this.notifyListeners();

    console.log('📥 Added to Google Cloud upload queue:', uploadId);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return uploadId;
  }

  /**
   * Process upload queue in background
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    console.log('🔄 Processing Google Cloud upload queue...');

    while (this.uploadQueue.length > 0) {
      const pendingJobs = this.uploadQueue.filter(job => job.status === 'pending');
      
      if (pendingJobs.length === 0) {
        break;
      }

      const job = pendingJobs[0];
      await this.processUploadJob(job);
    }

    this.isProcessing = false;
    console.log('✅ Upload queue processing complete');
  }

  /**
   * Process individual upload job
   */
  private async processUploadJob(job: UploadJob): Promise<void> {
    try {
      console.log('🚀 Processing upload job:', job.id);
      
      // Update job status
      job.status = 'uploading';
      job.progress = {
        progress: 5,
        stage: 'uploading',
        message: 'Starting Google Cloud upload...'
      };
      this.updateUploadProgress(job.id, job.progress);

      // Upload to Google Cloud
      const videoData = await GoogleCloudVideoService.uploadVideo({
        videoUri: job.videoUri,
        title: job.title,
        description: job.description,
        metadata: job.metadata,
        onProgress: (progress) => {
          console.log('📊 Upload progress for', job.id, ':', progress);
          job.progress = progress;
          this.updateUploadProgress(job.id, progress);
        }
      });

      // Mark as completed
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.progress = {
        progress: 100,
        stage: 'complete',
        message: 'Upload successful! Video ready for streaming! 🎉'
      };

      console.log('✅ Google Cloud upload completed:', job.id, videoData.videoId);
      
      // Save video data to your database here if needed
      await this.saveVideoToDatabase(videoData, job);

      this.updateUploadProgress(job.id, job.progress);
      await this.saveUploadQueue();

    } catch (error: any) {
      console.error('❌ Upload job failed:', job.id, error.message);
      
      job.retryCount++;
      
      if (job.retryCount < this.maxRetries) {
        // Retry the upload
        job.status = 'pending';
        job.progress = {
          progress: 0,
          stage: 'error',
          message: `Upload failed. Retrying... (${job.retryCount}/${this.maxRetries})`
        };
        
        console.log(`🔄 Retrying upload ${job.id} (attempt ${job.retryCount + 1})`);
        
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } else {
        // Max retries reached
        job.status = 'failed';
        job.progress = {
          progress: 0,
          stage: 'error',
          message: 'Upload failed after multiple attempts. Please try again.'
        };
        
        console.error('💥 Upload job permanently failed:', job.id);
      }

      this.updateUploadProgress(job.id, job.progress);
      await this.saveUploadQueue();
    }
  }

  /**
   * Save video data to your database (customize this)
   */
  private async saveVideoToDatabase(videoData: StreamingVideoData, job: UploadJob): Promise<void> {
    try {
      // You can save to Firebase, your own database, etc.
      console.log('💾 Saving video to database:', videoData.videoId);
      
      // Example: Save to AsyncStorage for now
      const savedVideos = await this.getSavedVideos();
      savedVideos.push({
        ...videoData,
        metadata: {
          ...videoData.metadata,
          title: job.title,
          description: job.description,
          uploadedAt: job.completedAt || new Date().toISOString()
        }
      });
      
      await AsyncStorage.setItem('saved_videos', JSON.stringify(savedVideos));
      console.log('✅ Video saved to database');
      
    } catch (error: any) {
      console.error('⚠️ Failed to save video to database:', error);
      // Non-critical error, upload still succeeded
    }
  }

  /**
   * Get saved videos from database
   */
  async getSavedVideos(): Promise<StreamingVideoData[]> {
    try {
      const saved = await AsyncStorage.getItem('saved_videos');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to get saved videos:', error);
      return [];
    }
  }

  /**
   * Update upload progress and notify listeners
   */
  private updateUploadProgress(uploadId: string, progress: UploadProgress): void {
    const job = this.uploadQueue.find(j => j.id === uploadId);
    if (job) {
      job.progress = progress;
      this.notifyListeners();
    }
  }

  /**
   * Get upload progress for specific job
   */
  getUploadProgress(uploadId: string): UploadProgress | null {
    const job = this.uploadQueue.find(j => j.id === uploadId);
    return job ? job.progress : null;
  }

  /**
   * Get all upload jobs
   */
  getUploadJobs(): UploadJob[] {
    return [...this.uploadQueue];
  }

  /**
   * Remove completed uploads from queue (cleanup)
   */
  async clearCompletedUploads(): Promise<void> {
    this.uploadQueue = this.uploadQueue.filter(job => 
      job.status !== 'completed' && job.status !== 'failed'
    );
    await this.saveUploadQueue();
    this.notifyListeners();
    console.log('🧹 Cleared completed uploads from queue');
  }

  /**
   * Cancel specific upload
   */
  async cancelUpload(uploadId: string): Promise<void> {
    const jobIndex = this.uploadQueue.findIndex(j => j.id === uploadId);
    if (jobIndex !== -1) {
      this.uploadQueue.splice(jobIndex, 1);
      await this.saveUploadQueue();
      this.notifyListeners();
      console.log('🛑 Cancelled upload:', uploadId);
    }
  }

  /**
   * Subscribe to upload progress updates
   */
  subscribe(listener: (jobs: UploadJob[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of queue changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener([...this.uploadQueue]);
      } catch (error) {
        console.error('Error notifying upload listener:', error);
      }
    });
  }

  /**
   * Save upload queue to storage
   */
  private async saveUploadQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('upload_queue', JSON.stringify(this.uploadQueue));
    } catch (error) {
      console.error('Failed to save upload queue:', error);
    }
  }

  /**
   * Load upload queue from storage
   */
  private async loadUploadQueue(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem('upload_queue');
      if (saved) {
        this.uploadQueue = JSON.parse(saved);
        console.log('📥 Loaded upload queue:', this.uploadQueue.length, 'jobs');
        
        // Resume processing if there are pending uploads
        const pendingJobs = this.uploadQueue.filter(job => job.status === 'pending');
        if (pendingJobs.length > 0) {
          console.log('🔄 Resuming', pendingJobs.length, 'pending uploads');
          this.processQueue();
        }
      }
    } catch (error) {
      console.error('Failed to load upload queue:', error);
      this.uploadQueue = [];
    }
  }

  /**
   * Get upload statistics
   */
  getUploadStats(): {
    total: number;
    pending: number;
    uploading: number;
    completed: number;
    failed: number;
  } {
    const stats = {
      total: this.uploadQueue.length,
      pending: 0,
      uploading: 0,
      completed: 0,
      failed: 0
    };

    this.uploadQueue.forEach(job => {
      stats[job.status as keyof typeof stats]++;
    });

    return stats;
  }
}

// Export singleton instance
export default new BackgroundUploadService();
