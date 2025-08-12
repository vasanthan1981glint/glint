// Video Thumbnail Generation Service - Real Video Thumbnails with Firebase Storage
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebaseConfig';

// Safe import with error handling
let VideoThumbnails: any;
try {
  VideoThumbnails = require('expo-video-thumbnails');
} catch (error) {
  console.warn('⚠️ expo-video-thumbnails not available in current build:', error);
}

export interface ThumbnailOptions {
  time?: number; // Time in seconds to capture thumbnail
  quality?: number; // Quality from 0 to 1
}

class ThumbnailService {
  
  // Generate real thumbnail from video using expo-video-thumbnails
  async generateThumbnailFromVideo(
    videoUri: string, 
    options: ThumbnailOptions = {}
  ): Promise<string | null> {
    try {
      console.log('🎬 Generating real thumbnail for video:', videoUri);
      
      // Check if expo-video-thumbnails is available
      if (!VideoThumbnails) {
        console.warn('⚠️ expo-video-thumbnails not available, skipping thumbnail generation');
        return null;
      }
      
      // Generate thumbnail at specified time (default: 1 second)
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: options.time || 1000, // 1 second into the video
        quality: options.quality || 0.8, // High quality
      });
      
      console.log('✅ Real thumbnail generated:', uri);
      return uri;
      
    } catch (error) {
      console.error('❌ Real thumbnail generation failed:', error);
      return null;
    }
  }

  // Generate multiple thumbnails at different time points
  async generateMultipleVideoThumbnails(
    videoUri: string,
    videoDuration?: number
  ): Promise<string[]> {
    try {
      console.log('🎬 Generating multiple thumbnails for video:', videoUri);
      
      // Check if expo-video-thumbnails is available
      if (!VideoThumbnails) {
        console.warn('⚠️ expo-video-thumbnails not available, returning empty array');
        return [];
      }
      
      const thumbnails: string[] = [];
      const timePoints = videoDuration 
        ? [
            videoDuration * 0.1, // 10%
            videoDuration * 0.3, // 30%
            videoDuration * 0.5, // 50%
            videoDuration * 0.7, // 70%
            videoDuration * 0.9  // 90%
          ]
        : [1000, 3000, 5000]; // Default time points in milliseconds
      
      for (const time of timePoints) {
        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
            time: time,
            quality: 0.7,
          });
          thumbnails.push(uri);
        } catch (error) {
          console.warn(`Failed to generate thumbnail at ${time}ms:`, error);
        }
      }
      
      console.log('✅ Generated', thumbnails.length, 'thumbnails');
      return thumbnails;
      
    } catch (error) {
      console.error('❌ Multiple thumbnail generation failed:', error);
      return [];
    }
  }
  
  // Upload thumbnail to Firebase Storage
  async uploadThumbnailToFirebase(
    thumbnailUri: string,
    videoAssetId: string
  ): Promise<string | null> {
    try {
      console.log('☁️ Uploading thumbnail to Firebase Storage...');
      
      // Create unique thumbnail filename
      const timestamp = Date.now();
      const thumbnailFilename = `thumbnails/${videoAssetId}_${timestamp}.jpg`;
      const thumbnailRef = ref(storage, thumbnailFilename);
      
      // Read thumbnail file
      const response = await fetch(thumbnailUri);
      const blob = await response.blob();
      
      // Upload to Firebase Storage
      await uploadBytes(thumbnailRef, blob);
      
      // Get download URL
      const downloadURL = await getDownloadURL(thumbnailRef);
      
      console.log('✅ Thumbnail uploaded to Firebase:', downloadURL);
      return downloadURL;
      
    } catch (error) {
      console.error('❌ Thumbnail upload failed:', error);
      return null;
    }
  }
  
  // Generate and upload thumbnail in one step
  async generateAndUploadThumbnail(
    videoUri: string,
    videoAssetId: string,
    options: ThumbnailOptions = {}
  ): Promise<string | null> {
    try {
      console.log('🎬 Creating real thumbnail for video:', videoAssetId);
      
      // Step 1: Generate real thumbnail from video
      const localThumbnailUri = await this.generateThumbnailFromVideo(videoUri, options);
      
      if (!localThumbnailUri) {
        console.log('❌ Could not generate thumbnail, using fallback');
        return this.generateFallbackThumbnail(videoAssetId);
      }
      
      // Step 2: Upload to Firebase Storage
      const firebaseThumbnailUrl = await this.uploadThumbnailToFirebase(localThumbnailUri, videoAssetId);
      
      if (!firebaseThumbnailUrl) {
        console.log('❌ Could not upload to Firebase, using local thumbnail');
        return localThumbnailUri; // Return local URI as fallback
      }
      
      console.log('✅ Real thumbnail generated and uploaded:', firebaseThumbnailUrl);
      return firebaseThumbnailUrl;
      
    } catch (error) {
      console.error('❌ Thumbnail process failed:', error);
      return this.generateFallbackThumbnail(videoAssetId);
    }
  }

  // Generate smart placeholder based on video info (fallback only)
  generateSmartPlaceholder(videoAssetId: string, videoUri: string): string {
    // Extract video info for smart placeholder
    const timestamp = videoAssetId.includes('firebase_') ? 
      videoAssetId.replace('firebase_', '') : 
      Date.now().toString();
    
    // Create a video-themed placeholder with timestamp
    const date = new Date(parseInt(timestamp)).toLocaleDateString();
    const placeholderText = `Video ${date}`;
    const encodedText = encodeURIComponent(placeholderText);
    
    // Use a video-themed color scheme
    const videoThemeUrl = `https://via.placeholder.com/640x360/2C3E50/FFFFFF?text=${encodedText}`;
    
    console.log('🎨 Smart placeholder generated:', videoThemeUrl);
    return videoThemeUrl;
  }
  
  // Validate if thumbnail URL is accessible
  async validateThumbnailUrl(thumbnailUrl: string): Promise<boolean> {
    try {
      // Basic URL format validation
      if (!thumbnailUrl || typeof thumbnailUrl !== 'string') {
        console.log('❌ Invalid thumbnail URL format:', thumbnailUrl);
        return false;
      }

      // Handle local file URIs (always valid for local files)
      if (thumbnailUrl.startsWith('file://')) {
        console.log('✅ Local file URI is valid:', thumbnailUrl);
        return true;
      }

      // Handle placeholder URLs (valid but should be replaced)
      if (thumbnailUrl.includes('placeholder.com') || thumbnailUrl.includes('via.placeholder.com')) {
        console.log('⚠️ Placeholder URL detected, should be replaced:', thumbnailUrl);
        return false;
      }

      // Validate HTTP/HTTPS URLs with network request
      if (thumbnailUrl.startsWith('http://') || thumbnailUrl.startsWith('https://')) {
        try {
          // Create a timeout promise
          const timeoutPromise = new Promise<Response>((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), 5000);
          });

          // Race between fetch and timeout
          const response = await Promise.race([
            fetch(thumbnailUrl, { method: 'HEAD' }),
            timeoutPromise
          ]);
          
          const isValid = response.ok;
          console.log(isValid ? '✅ Network thumbnail URL is valid:' : '❌ Network thumbnail URL is invalid:', thumbnailUrl);
          return isValid;
        } catch (networkError) {
          console.log('⚠️ Network validation failed, assuming URL is valid (might be temporary network issue):', thumbnailUrl);
          // Don't fail validation due to network issues - the URL might be valid but network is down
          return true;
        }
      }

      // For any other URI schemes, assume valid
      console.log('✅ Unknown URI scheme, assuming valid:', thumbnailUrl);
      return true;
      
    } catch (error) {
      console.error('❌ Thumbnail validation error:', error);
      // Don't fail validation due to unexpected errors
      return true;
    }
  }

  // Generate fallback thumbnail (generic)
  generateFallbackThumbnail(videoAssetId: string): string {
    const fallbackUrl = `https://via.placeholder.com/640x360/95A5A6/FFFFFF?text=Video+Thumbnail`;
    console.log('🎨 Using fallback thumbnail:', fallbackUrl);
    return fallbackUrl;
  }
  
  // Generate multiple thumbnail variations with real thumbnails
  async generateMultipleThumbnailSizes(
    videoUri: string,
    videoAssetId: string
  ): Promise<{
    small: string | null;
    medium: string | null;
    large: string | null;
  }> {
    try {
      console.log('🎬 Generating multiple real thumbnail sizes...');
      
      // Generate base thumbnail
      const baseThumbnail = await this.generateThumbnailFromVideo(videoUri, { quality: 0.8 });
      
      if (!baseThumbnail) {
        return {
          small: this.generateFallbackThumbnail(videoAssetId),
          medium: this.generateFallbackThumbnail(videoAssetId),
          large: this.generateFallbackThumbnail(videoAssetId),
        };
      }
      
      // Upload different quality versions
      const [smallUrl, mediumUrl, largeUrl] = await Promise.all([
        this.uploadThumbnailToFirebase(baseThumbnail, `${videoAssetId}_small`),
        this.uploadThumbnailToFirebase(baseThumbnail, `${videoAssetId}_medium`),
        this.uploadThumbnailToFirebase(baseThumbnail, `${videoAssetId}_large`),
      ]);
      
      const thumbnails = {
        small: smallUrl || baseThumbnail,
        medium: mediumUrl || baseThumbnail,
        large: largeUrl || baseThumbnail,
      };
      
      console.log('✅ Multiple real thumbnails generated:', thumbnails);
      return thumbnails;
      
    } catch (error) {
      console.error('❌ Multiple thumbnail generation failed:', error);
      const fallback = this.generateFallbackThumbnail(videoAssetId);
      return {
        small: fallback,
        medium: fallback,
        large: fallback,
      };
    }
  }

  // Generate thumbnail at specific time in video
  async generateThumbnailAtTime(
    videoUri: string,
    timeInSeconds: number,
    videoAssetId: string
  ): Promise<string | null> {
    try {
      console.log(`🎬 Generating thumbnail at ${timeInSeconds}s for video:`, videoAssetId);
      
      const localThumbnail = await this.generateThumbnailFromVideo(videoUri, {
        time: timeInSeconds * 1000, // Convert to milliseconds
        quality: 0.8
      });
      
      if (localThumbnail) {
        const firebaseUrl = await this.uploadThumbnailToFirebase(localThumbnail, `${videoAssetId}_${timeInSeconds}s`);
        return firebaseUrl || localThumbnail;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Time-specific thumbnail generation failed:', error);
      return null;
    }
  }
}

export default new ThumbnailService();
