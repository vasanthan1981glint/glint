// Upload Retry Service
// Provides utilities to retry failed uploads

import AsyncStorage from '@react-native-async-storage/async-storage';

interface RetryableUpload {
  uploadId: string;
  videoUri: string;
  caption: string;
  customThumbnail?: string;
  failureReason: string;
  retryCount: number;
  lastAttempt: string;
}

class UploadRetryService {
  private static readonly FAILED_UPLOADS_KEY = 'failedUploads';
  private static readonly MAX_RETRIES = 3;

  // Save a failed upload for retry
  async saveFailedUpload(uploadId: string, uploadData: {
    videoUri: string;
    caption: string;
    customThumbnail?: string;
    failureReason: string;
  }): Promise<void> {
    try {
      const existingFailed = await this.getFailedUploads();
      const existing = existingFailed.find(upload => upload.uploadId === uploadId);
      
      const failedUpload: RetryableUpload = {
        uploadId,
        videoUri: uploadData.videoUri,
        caption: uploadData.caption,
        customThumbnail: uploadData.customThumbnail,
        failureReason: uploadData.failureReason,
        retryCount: existing ? existing.retryCount + 1 : 1,
        lastAttempt: new Date().toISOString()
      };

      // Only save if we haven't exceeded max retries
      if (failedUpload.retryCount <= UploadRetryService.MAX_RETRIES) {
        const updatedFailed = existingFailed.filter(upload => upload.uploadId !== uploadId);
        updatedFailed.push(failedUpload);
        
        await AsyncStorage.setItem(
          UploadRetryService.FAILED_UPLOADS_KEY, 
          JSON.stringify(updatedFailed)
        );
        
        console.log(`💾 Saved failed upload for retry (attempt ${failedUpload.retryCount}/${UploadRetryService.MAX_RETRIES}):`, uploadId);
      } else {
        console.log(`❌ Upload ${uploadId} exceeded max retries, not saving for retry`);
      }
    } catch (error) {
      console.error('Failed to save failed upload:', error);
    }
  }

  // Get all failed uploads
  async getFailedUploads(): Promise<RetryableUpload[]> {
    try {
      const failedUploadsJson = await AsyncStorage.getItem(UploadRetryService.FAILED_UPLOADS_KEY);
      return failedUploadsJson ? JSON.parse(failedUploadsJson) : [];
    } catch (error) {
      console.error('Failed to get failed uploads:', error);
      return [];
    }
  }

  // Remove a failed upload (successful retry or user dismissal)
  async removeFailedUpload(uploadId: string): Promise<void> {
    try {
      const existingFailed = await this.getFailedUploads();
      const updatedFailed = existingFailed.filter(upload => upload.uploadId !== uploadId);
      
      await AsyncStorage.setItem(
        UploadRetryService.FAILED_UPLOADS_KEY, 
        JSON.stringify(updatedFailed)
      );
      
      console.log(`🗑️ Removed failed upload:`, uploadId);
    } catch (error) {
      console.error('Failed to remove failed upload:', error);
    }
  }

  // Clear all failed uploads
  async clearAllFailedUploads(): Promise<void> {
    try {
      await AsyncStorage.removeItem(UploadRetryService.FAILED_UPLOADS_KEY);
      console.log('🧹 Cleared all failed uploads');
    } catch (error) {
      console.error('Failed to clear failed uploads:', error);
    }
  }

  // Check if an upload can be retried
  canRetry(upload: RetryableUpload): boolean {
    return upload.retryCount < UploadRetryService.MAX_RETRIES;
  }

  // Get user-friendly error message for failed upload
  getFailureMessage(upload: RetryableUpload): string {
    if (upload.failureReason.includes('timeout')) {
      return `Video processing timed out (Attempt ${upload.retryCount}/${UploadRetryService.MAX_RETRIES})`;
    } else if (upload.failureReason.includes('connection')) {
      return `Connection failed (Attempt ${upload.retryCount}/${UploadRetryService.MAX_RETRIES})`;
    } else if (upload.failureReason.includes('processing failed')) {
      return `Video processing failed (Attempt ${upload.retryCount}/${UploadRetryService.MAX_RETRIES})`;
    } else {
      return `Upload failed (Attempt ${upload.retryCount}/${UploadRetryService.MAX_RETRIES})`;
    }
  }

  // Get time since last attempt
  getTimeSinceLastAttempt(upload: RetryableUpload): string {
    const lastAttempt = new Date(upload.lastAttempt);
    const now = new Date();
    const diffMs = now.getTime() - lastAttempt.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}

export default new UploadRetryService();
export type { RetryableUpload };
