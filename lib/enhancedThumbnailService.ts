// Enhanced Video Thumbnail Service - Real Frame Extraction
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
  width?: number; // Thumbnail width
  height?: number; // Thumbnail height
}

class EnhancedThumbnailService {
  
  // Extract actual frame from video using expo-video-thumbnails
  async extractVideoFrame(
    videoUri: string, 
    options: ThumbnailOptions = {}
  ): Promise<string | null> {
    try {
      console.log('🖼️ Extracting real frame from video:', videoUri);
      
      // Check if expo-video-thumbnails is available
      if (!VideoThumbnails) {
        console.warn('⚠️ expo-video-thumbnails not available, using smart thumbnail');
        return this.generateSmartVideoThumbnail(videoUri, options);
      }
      
      const { time = 1000, quality = 0.8 } = options; // Default to 1 second, high quality
      
      // Extract real video frame
      const result = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: time, // Time in milliseconds
        quality: quality, // Quality from 0 to 1
      });
      
      console.log('✅ Real video frame extracted:', result.uri);
      return result.uri;
      
    } catch (error) {
      console.error('❌ Frame extraction failed:', error);
      // Fall back to smart thumbnail generation
      return this.generateSmartVideoThumbnail(videoUri, options);
    }
  }
  
  // Smart video thumbnail generation (fallback approach)
  async generateSmartVideoThumbnail(
    videoUri: string,
    options: ThumbnailOptions = {}
  ): Promise<string | null> {
    try {
      console.log('🎨 Generating smart video thumbnail for:', videoUri);
      
      const { width = 640, height = 360 } = options;
      
      // Extract video info from URI
      const videoFilename = videoUri.split('/').pop() || 'video';
      const videoId = videoFilename.split('.')[0];
      
      // Create a smart placeholder based on video characteristics
      const timestamp = Date.now();
      const videoDate = new Date(timestamp).toLocaleDateString();
      
      // Generate different thumbnail styles based on video name/time
      const thumbnailStyles = [
        { bg: '2C3E50', fg: 'FFFFFF', text: `📹 ${videoDate}` },
        { bg: '3498DB', fg: 'FFFFFF', text: `🎬 Video ${videoId.substring(0, 6)}` },
        { bg: '9B59B6', fg: 'FFFFFF', text: `✨ My Content` },
        { bg: 'E74C3C', fg: 'FFFFFF', text: `🔥 New Video` },
        { bg: '27AE60', fg: 'FFFFFF', text: `🚀 Just Posted` }
      ];
      
      // Select style based on video hash
      const styleIndex = Math.abs(videoId.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % thumbnailStyles.length;
      const style = thumbnailStyles[styleIndex];
      
      const thumbnailUrl = `https://via.placeholder.com/${width}x${height}/${style.bg}/${style.fg}?text=${encodeURIComponent(style.text)}`;
      
      console.log('✅ Smart thumbnail generated:', thumbnailUrl);
      return thumbnailUrl;
      
    } catch (error) {
      console.error('❌ Smart thumbnail generation failed:', error);
      return null;
    }
  }
  
  // Upload thumbnail to Firebase Storage - Enhanced for all thumbnail types
  async uploadThumbnailToFirebase(
    thumbnailUri: string,
    videoAssetId: string
  ): Promise<string | null> {
    try {
      console.log('☁️ Uploading thumbnail to Firebase Storage...');
      console.log('📎 Thumbnail URI:', thumbnailUri);
      
      // Handle different thumbnail types
      if (thumbnailUri.startsWith('https://via.placeholder.com')) {
        console.log('📎 Using placeholder thumbnail directly');
        return thumbnailUri;
      }
      
      if (thumbnailUri.startsWith('data:image/svg+xml')) {
        console.log('📎 Using SVG thumbnail directly');
        return thumbnailUri;
      }
      
      // Create unique thumbnail filename with timestamp for uniqueness
      const timestamp = Date.now();
      const thumbnailFilename = `thumbnails/${videoAssetId}_${timestamp}.jpg`;
      const thumbnailRef = ref(storage, thumbnailFilename);
      
      let blob: Blob;
      
      if (thumbnailUri.startsWith('file://') || thumbnailUri.startsWith('content://')) {
        // Local file - fetch and convert to blob
        console.log('📱 Uploading local thumbnail file...');
        const response = await fetch(thumbnailUri);
        blob = await response.blob();
      } else if (thumbnailUri.startsWith('data:image/')) {
        // Data URI - convert to blob
        console.log('🖼️ Converting data URI to blob...');
        const base64Data = thumbnailUri.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: 'image/jpeg' });
      } else {
        // Remote URL - fetch and convert to blob
        console.log('🌐 Fetching remote thumbnail...');
        const response = await fetch(thumbnailUri);
        blob = await response.blob();
      }
      
      // Upload to Firebase Storage
      console.log('⬆️ Uploading to Firebase Storage...');
      await uploadBytes(thumbnailRef, blob);
      
      // Get download URL
      const downloadURL = await getDownloadURL(thumbnailRef);
      
      console.log('✅ Thumbnail uploaded to Firebase Storage:', downloadURL);
      return downloadURL;
      
    } catch (error) {
      console.error('❌ Thumbnail upload failed:', error);
      console.log('🔄 Falling back to generated thumbnail...');
      // Return a generated thumbnail as fallback
      return this.generateRandomVideoThumbnail(videoAssetId);
    }
  }
  
  // Main function: Generate and upload thumbnail - Enhanced for Firebase Storage
  async generateAndUploadThumbnail(
    videoUri: string,
    videoAssetId: string,
    options: ThumbnailOptions = {}
  ): Promise<string | null> {
    try {
      console.log('🎬 Creating REAL video thumbnail for video:', videoAssetId);
      console.log('📹 Video URI:', videoUri);
      console.log('⚙️ Options:', options);
      
      let thumbnailUri: string | null = null;
      
      // First, try to extract real video frame
      if (VideoThumbnails) {
        try {
          console.log('🖼️ Extracting real video frame...');
          
          const { time = 1000, quality = 0.8 } = options; // Default to 1 second, high quality
          
          const result = await VideoThumbnails.getThumbnailAsync(videoUri, {
            time: time, // Time in milliseconds
            quality: quality, // Quality from 0 to 1
          });
          
          thumbnailUri = result.uri;
          console.log('✅ Real video thumbnail extracted:', thumbnailUri);
          
        } catch (extractError) {
          console.warn('⚠️ Video frame extraction failed:', extractError);
          console.log('🔄 Falling back to smart placeholder...');
        }
      } else {
        console.log('⚠️ expo-video-thumbnails not available, using smart placeholder');
      }
      
      // If real extraction failed, try alternative approach or return null
      if (!thumbnailUri) {
        console.log('⚠️ Real thumbnail extraction failed, trying alternative...');
        
        // Try with different time point
        if (VideoThumbnails) {
          try {
            const { time = 2000, quality = 0.8 } = options; // Try 2 seconds
            
            const result = await VideoThumbnails.getThumbnailAsync(videoUri, {
              time: time,
              quality: quality,
            });
            
            thumbnailUri = result.uri;
            console.log('✅ Alternative real video thumbnail extracted:', thumbnailUri);
          } catch (alternativeError) {
            console.warn('⚠️ Alternative extraction also failed:', alternativeError);
          }
        }
        
        // If still no real thumbnail, return null instead of placeholder
        if (!thumbnailUri) {
          console.log('❌ Could not extract real thumbnail, returning null');
          return null;
        }
      }
      
      // Upload the thumbnail to Firebase Storage for public access
      const uploadedThumbnailUrl = await this.uploadThumbnailToFirebase(thumbnailUri, videoAssetId);
      
      if (uploadedThumbnailUrl) {
        const isRealThumbnail = thumbnailUri.startsWith('file://') || thumbnailUri.startsWith('content://');
        console.log(`✅ ${isRealThumbnail ? 'REAL' : 'PLACEHOLDER'} thumbnail uploaded successfully:`, uploadedThumbnailUrl);
        return uploadedThumbnailUrl;
      } else {
        console.log('⚠️ Upload failed, returning null');
        return null;
      }
      
    } catch (error) {
      console.error('❌ Complete thumbnail process failed:', error);
      return null; // Return null instead of fallback
    }
  }
  
  // Upload custom user thumbnail to Firebase Storage
  async uploadCustomThumbnail(
    customThumbnailUri: string,
    videoAssetId: string
  ): Promise<string | null> {
    try {
      console.log('🖼️ Uploading custom user thumbnail to Firebase...');
      
      // Upload the custom thumbnail to Firebase Storage
      const uploadedUrl = await this.uploadThumbnailToFirebase(customThumbnailUri, videoAssetId);
      
      if (uploadedUrl) {
        console.log('✅ Custom thumbnail uploaded successfully:', uploadedUrl);
        return uploadedUrl;
      } else {
        console.log('⚠️ Custom thumbnail upload failed, generating fallback');
        return this.generateRandomVideoThumbnail(videoAssetId);
      }
      
    } catch (error) {
      console.error('❌ Custom thumbnail upload failed:', error);
      return this.generateRandomVideoThumbnail(videoAssetId);
    }
  }
  
  // Generate random/varied thumbnails for videos without custom ones
  generateRandomVideoThumbnail(videoAssetId: string): string {
    const videoId = videoAssetId.replace('firebase_', '');
    const timestamp = parseInt(videoId) || Date.now();
    
    // Create variety based on timestamp and video characteristics
    const date = new Date(timestamp);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const day = date.getDate();
    
    // Simple themes for placeholder.com (iOS compatible)
    const themes = [
      { bg: '1ABC9C', text: 'Video' },
      { bg: 'E74C3C', text: 'Content' },
      { bg: '3498DB', text: 'Media' },
      { bg: '9B59B6', text: 'Clip' },
      { bg: 'F39C12', text: 'Upload' },
      { bg: '2ECC71', text: 'Stream' },
      { bg: '34495E', text: 'Play' },
      { bg: 'E67E22', text: 'Watch' }
    ];
    
    // Select theme based on multiple factors for more variety
    const themeIndex = (hour + minute + day + videoId.length) % themes.length;
    const theme = themes[themeIndex];
    
    // Use via.placeholder.com instead of SVG for maximum iOS compatibility
    const width = 640;
    const height = 360;
    const bgColor = theme.bg;
    const textColor = 'FFFFFF';
    const text = encodeURIComponent(theme.text);
    
    const thumbnailUrl = `https://via.placeholder.com/${width}x${height}/${bgColor}/${textColor}?text=${text}`;
    
    console.log(`⚠️ Last resort placeholder thumbnail for ${videoAssetId}:`, theme.text);
    return thumbnailUrl;
  }
  
  // Generate fallback thumbnail - now returns empty string instead of placeholder
  generateFallbackThumbnail(videoAssetId: string): string {
    console.log('⚠️ No fallback thumbnail generated for:', videoAssetId);
    return ''; // Return empty string instead of placeholder
  }
  
  // Generate view count overlay thumbnails (like TikTok/Instagram)
  generateViewCountThumbnail(videoAssetId: string, viewCount: number = 0): string {
    const formattedViews = this.formatViewCount(viewCount);
    const videoId = videoAssetId.substring(0, 8);
    
    // Style based on view count
    let style;
    if (viewCount >= 1000000) {
      style = { bg: 'E74C3C', fg: 'FFFFFF', icon: '🔥', label: 'Viral' };
    } else if (viewCount >= 100000) {
      style = { bg: 'F39C12', fg: 'FFFFFF', icon: '⭐', label: 'Popular' };
    } else if (viewCount >= 10000) {
      style = { bg: '3498DB', fg: 'FFFFFF', icon: '📈', label: 'Trending' };
    } else {
      style = { bg: '2C3E50', fg: 'FFFFFF', icon: '📹', label: 'Video' };
    }
    
    const thumbnailText = `${style.icon} ${formattedViews} views`;
    const thumbnailUrl = `https://via.placeholder.com/640x360/${style.bg}/${style.fg}?text=${encodeURIComponent(thumbnailText)}`;
    
    return thumbnailUrl;
  }
  
  // Format view count (1.2M, 45K, etc.)
  formatViewCount(count: number): string {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    } else {
      return count.toString();
    }
  }
}

export default new EnhancedThumbnailService();
