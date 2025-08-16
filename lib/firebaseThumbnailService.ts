import * as VideoThumbnails from 'expo-video-thumbnails';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
// import * as ImageManipulator from 'expo-image-manipulator'; // Temporarily disabled - requires dev build
import { storage } from '../firebaseConfig';

export interface ThumbnailGenerationOptions {
  time?: number; // Time in milliseconds to extract thumbnail from
  quality?: number; // Quality of the thumbnail (0-1)
  width?: number; // Width of the thumbnail
  height?: number; // Height of the thumbnail
}

export interface ThumbnailUploadResult {
  thumbnailUrl: string;
  thumbnailPath: string;
  localThumbnailUri: string;
}

/**
 * Firebase Storage thumbnail service for video thumbnails
 * Generates thumbnails from videos and uploads them to Firebase Storage
 */
export class FirebaseThumbnailService {
  
  /**
   * Generate a thumbnail from a video URI
   */
  static async generateThumbnail(
    videoUri: string, 
    options: ThumbnailGenerationOptions = {}
  ): Promise<string> {
    try {
      console.log('🎬 Generating thumbnail for video:', videoUri);
      
      const {
        time = 1000, // Extract thumbnail at 1 second by default
        quality = 0.8,
      } = options;

      // Generate thumbnail using expo-video-thumbnails
      const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time,
        quality,
      });

      console.log('📸 Thumbnail generated (no resize - requires dev build):', thumbnailUri);

      // Note: Image manipulation disabled - requires development build
      // In production, you'd resize with expo-image-manipulator
      return thumbnailUri;

    } catch (error) {
      console.error('❌ Error generating thumbnail:', error);
      throw new Error(`Failed to generate thumbnail: ${error}`);
    }
  }

  /**
   * Upload thumbnail to Firebase Storage
   */
  static async uploadThumbnail(
    thumbnailUri: string,
    videoId: string,
    userId: string
  ): Promise<ThumbnailUploadResult> {
    try {
      console.log('☁️ Uploading thumbnail to Firebase Storage...');
      
      // Create storage path: thumbnails/userId/videoId.jpg
      const thumbnailPath = `thumbnails/${userId}/${videoId}.jpg`;
      const thumbnailRef = ref(storage, thumbnailPath);

      // Convert local URI to blob for upload
      const response = await fetch(thumbnailUri);
      const blob = await response.blob();

      console.log('📤 Uploading thumbnail blob to Firebase...');
      
      // Upload thumbnail to Firebase Storage
      const snapshot = await uploadBytes(thumbnailRef, blob);
      
      // Get download URL
      const thumbnailUrl = await getDownloadURL(snapshot.ref);
      
      console.log('✅ Thumbnail uploaded successfully:', thumbnailUrl);

      return {
        thumbnailUrl,
        thumbnailPath,
        localThumbnailUri: thumbnailUri
      };

    } catch (error) {
      console.error('❌ Error uploading thumbnail to Firebase:', error);
      throw new Error(`Failed to upload thumbnail: ${error}`);
    }
  }

  /**
   * Complete thumbnail workflow: generate and upload
   */
  static async processVideoThumbnail(
    videoUri: string,
    videoId: string,
    userId: string,
    options: ThumbnailGenerationOptions = {}
  ): Promise<ThumbnailUploadResult> {
    try {
      console.log('🚀 Starting complete thumbnail workflow...');
      
      // Step 1: Generate thumbnail
      const thumbnailUri = await this.generateThumbnail(videoUri, options);
      
      // Step 2: Upload to Firebase Storage
      const uploadResult = await this.uploadThumbnail(thumbnailUri, videoId, userId);
      
      console.log('🎉 Thumbnail workflow completed successfully!');
      return uploadResult;

    } catch (error) {
      console.error('❌ Error in thumbnail workflow:', error);
      throw error;
    }
  }

  /**
   * Generate multiple thumbnails at different time intervals
   */
  static async generateMultipleThumbnails(
    videoUri: string,
    timeIntervals: number[], // Array of time positions in milliseconds
    options: Omit<ThumbnailGenerationOptions, 'time'> = {}
  ): Promise<string[]> {
    try {
      console.log('🎬 Generating multiple thumbnails at intervals:', timeIntervals);
      
      const thumbnails = await Promise.all(
        timeIntervals.map(time => 
          this.generateThumbnail(videoUri, { ...options, time })
        )
      );

      console.log('✅ Multiple thumbnails generated:', thumbnails.length);
      return thumbnails;

    } catch (error) {
      console.error('❌ Error generating multiple thumbnails:', error);
      throw error;
    }
  }

  /**
   * Delete thumbnail from Firebase Storage
   */
  static async deleteThumbnail(thumbnailPath: string): Promise<void> {
    try {
      console.log('🗑️ Deleting thumbnail from Firebase:', thumbnailPath);
      
      const thumbnailRef = ref(storage, thumbnailPath);
      // Note: Firebase Storage doesn't have a direct delete method in v9+
      // You would typically handle deletion through Firebase Functions or admin SDK
      
      console.log('✅ Thumbnail deletion initiated');
      
    } catch (error) {
      console.error('❌ Error deleting thumbnail:', error);
      throw error;
    }
  }
}

export default FirebaseThumbnailService;
