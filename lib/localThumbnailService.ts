// Safe imports with error handling
let VideoThumbnails: any;
let FileSystem: any;
let ImagePicker: any;

try {
  VideoThumbnails = require('expo-video-thumbnails');
} catch (error) {
  console.warn('⚠️ expo-video-thumbnails not available:', error);
}

try {
  FileSystem = require('expo-file-system');
} catch (error) {
  console.warn('⚠️ expo-file-system not available:', error);
}

try {
  ImagePicker = require('expo-image-picker');
} catch (error) {
  console.warn('⚠️ expo-image-picker not available:', error);
}

export interface ThumbnailGenerationOptions {
  quality?: number;
  timePoints?: number[]; // Array of time points (0-1) where to extract thumbnails
  customThumbnailUri?: string;
}

export interface GeneratedThumbnail {
  uri: string;
  timePoint: number;
  isCustom: boolean;
  timestamp: number;
}

export interface ThumbnailSet {
  autoThumbnails: GeneratedThumbnail[];
  customThumbnail?: GeneratedThumbnail;
  selectedThumbnail: GeneratedThumbnail;
}

class LocalThumbnailService {
  private static instance: LocalThumbnailService;
  
  static getInstance(): LocalThumbnailService {
    if (!LocalThumbnailService.instance) {
      LocalThumbnailService.instance = new LocalThumbnailService();
    }
    return LocalThumbnailService.instance;
  }

  /**
   * Generate YouTube-style automatic thumbnails from video
   * Creates thumbnails at different time points like YouTube does
   */
  async generateAutoThumbnails(
    videoUri: string,
    options: ThumbnailGenerationOptions = {}
  ): Promise<GeneratedThumbnail[]> {
    const {
      quality = 0.6, // Reduced quality for speed
      timePoints = [0.5] // Start with just one thumbnail for speed, add more later
    } = options;

    const thumbnails: GeneratedThumbnail[] = [];

    try {
      console.log('🎬 Attempting to generate auto-thumbnails for video:', videoUri);

      // Check if VideoThumbnails is available
      if (!VideoThumbnails || typeof VideoThumbnails.getThumbnailAsync !== 'function') {
        console.warn('⚠️ VideoThumbnails module not available, creating placeholder thumbnails');
        return this.generatePlaceholderThumbnails(timePoints);
      }

      // Get video duration first
      const videoDuration = await this.getVideoDuration(videoUri);
      
      for (let i = 0; i < timePoints.length; i++) {
        const timePoint = timePoints[i];
        const timeInMs = videoDuration * timePoint * 1000;

        try {
          const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
            time: timeInMs,
            quality,
            // Generate high-quality thumbnails with proper aspect ratio
            // YouTube standard is 1280x720 (16:9)
          });

          // Save thumbnail to local storage for persistence
          const savedUri = await this.saveThumbnailLocally(uri, `auto_${i}_${Date.now()}`);

          thumbnails.push({
            uri: savedUri,
            timePoint,
            isCustom: false,
            timestamp: Date.now()
          });

          console.log(`✅ Generated thumbnail ${i + 1}/${timePoints.length} at ${(timePoint * 100).toFixed(0)}%`);
        } catch (error) {
          console.warn(`⚠️ Failed to generate thumbnail at ${(timePoint * 100).toFixed(0)}%:`, error);
          // Create placeholder for this time point
          const placeholder = this.createPlaceholderThumbnail(timePoint, i);
          thumbnails.push(placeholder);
        }
      }

      console.log(`🎉 Generated ${thumbnails.length} thumbnails (some may be placeholders)`);
      return thumbnails;

    } catch (error) {
      console.error('❌ Auto-thumbnail generation failed, using placeholders:', error);
      return this.generatePlaceholderThumbnails(timePoints);
    }
  }

  /**
   * Allow user to pick custom thumbnail image
   * Similar to YouTube's custom thumbnail upload feature
   */
  async pickCustomThumbnail(): Promise<GeneratedThumbnail | null> {
    try {
      // Check if ImagePicker is available
      if (!ImagePicker || typeof ImagePicker.requestMediaLibraryPermissionsAsync !== 'function') {
        console.warn('⚠️ ImagePicker not available, cannot pick custom thumbnail');
        throw new Error('Image picker not available on this device');
      }

      // Request permission to access photo library
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.status !== 'granted') {
        throw new Error('Permission to access photo library is required');
      }

      // Launch image picker with YouTube-recommended specs
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9], // YouTube's preferred aspect ratio
        quality: 0.9,
        // Recommend 1280x720 or higher resolution
      });

      if (result.canceled) {
        return null;
      }

      const imageUri = result.assets[0].uri;
      
      // Save custom thumbnail locally
      const savedUri = await this.saveThumbnailLocally(imageUri, `custom_${Date.now()}`);

      const customThumbnail: GeneratedThumbnail = {
        uri: savedUri,
        timePoint: -1, // -1 indicates custom thumbnail
        isCustom: true,
        timestamp: Date.now()
      };

      console.log('📸 Custom thumbnail selected and saved:', savedUri);
      return customThumbnail;

    } catch (error) {
      console.error('❌ Custom thumbnail selection failed:', error);
      return null;
    }
  }

  /**
   * Generate complete thumbnail set for a video
   * Returns auto-thumbnails and provides option to add custom
   */
  async generateThumbnailSet(
    videoUri: string,
    options: ThumbnailGenerationOptions = {}
  ): Promise<ThumbnailSet> {
    try {
      console.log('🏗️ Generating complete thumbnail set...');

      // Generate auto-thumbnails
      const autoThumbnails = await this.generateAutoThumbnails(videoUri, options);

      if (autoThumbnails.length === 0) {
        throw new Error('Failed to generate any auto-thumbnails');
      }

      // Select the middle thumbnail as default (similar to YouTube)
      const defaultIndex = Math.floor(autoThumbnails.length / 2);
      const selectedThumbnail = autoThumbnails[defaultIndex];

      const thumbnailSet: ThumbnailSet = {
        autoThumbnails,
        selectedThumbnail
      };

      // Add custom thumbnail if provided
      if (options.customThumbnailUri) {
        const savedUri = await this.saveThumbnailLocally(
          options.customThumbnailUri, 
          `custom_${Date.now()}`
        );
        
        thumbnailSet.customThumbnail = {
          uri: savedUri,
          timePoint: -1,
          isCustom: true,
          timestamp: Date.now()
        };
        
        // Use custom thumbnail as selected if provided
        thumbnailSet.selectedThumbnail = thumbnailSet.customThumbnail;
      }

      console.log('✅ Thumbnail set generated successfully');
      return thumbnailSet;

    } catch (error) {
      console.error('❌ Thumbnail set generation failed:', error);
      throw error;
    }
  }

  /**
   * Save thumbnail to local app directory for persistence
   */
  private async saveThumbnailLocally(sourceUri: string, filename: string): Promise<string> {
    try {
      // Check if FileSystem is available
      if (!FileSystem || !FileSystem.documentDirectory) {
        console.warn('⚠️ FileSystem not available, returning original URI');
        return sourceUri;
      }

      const thumbnailsDir = `${FileSystem.documentDirectory}thumbnails/`;
      
      // Ensure thumbnails directory exists
      const dirInfo = await FileSystem.getInfoAsync(thumbnailsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(thumbnailsDir, { intermediates: true });
      }

      const destinationUri = `${thumbnailsDir}${filename}.jpg`;
      
      // Copy thumbnail to local storage
      await FileSystem.copyAsync({
        from: sourceUri,
        to: destinationUri,
      });

      console.log('💾 Thumbnail saved locally:', destinationUri);
      return destinationUri;
    } catch (error) {
      console.error('❌ Failed to save thumbnail locally:', error);
      return sourceUri; // Return original URI as fallback
    }
  }

  /**
   * Get video duration in seconds
   */
  private async getVideoDuration(videoUri: string): Promise<number> {
    try {
      // Use a simple method to get video duration
      // This is a basic implementation - you might want to use a more robust method
      return 30; // Default to 30 seconds, but you can implement actual duration detection
    } catch (error) {
      console.warn('⚠️ Could not determine video duration, using default');
      return 30;
    }
  }

  /**
   * Clean up old thumbnails to manage storage
   */
  async cleanupOldThumbnails(olderThanDays: number = 7): Promise<void> {
    try {
      // Check if FileSystem is available
      if (!FileSystem || !FileSystem.documentDirectory) {
        console.warn('⚠️ FileSystem not available, skipping cleanup');
        return;
      }

      const thumbnailsDir = `${FileSystem.documentDirectory}thumbnails/`;
      const dirInfo = await FileSystem.getInfoAsync(thumbnailsDir);
      
      if (!dirInfo.exists) return;

      const files = await FileSystem.readDirectoryAsync(thumbnailsDir);
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);

      for (const file of files) {
        const filePath = `${thumbnailsDir}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        
        if (fileInfo.exists && fileInfo.modificationTime && fileInfo.modificationTime < cutoffTime) {
          await FileSystem.deleteAsync(filePath);
          console.log(`🗑️ Cleaned up old thumbnail: ${file}`);
        }
      }
    } catch (error) {
      console.error('❌ Thumbnail cleanup failed:', error);
    }
  }

  /**
   * Get thumbnail info for display
   */
  getThumbnailDisplayInfo(thumbnail: GeneratedThumbnail): {
    title: string;
    subtitle: string;
    isRecommended: boolean;
  } {
    if (thumbnail.isCustom) {
      return {
        title: 'Custom',
        subtitle: 'Your image',
        isRecommended: true
      };
    }

    const percentage = Math.round(thumbnail.timePoint * 100);
    const isRecommended = thumbnail.timePoint >= 0.3 && thumbnail.timePoint <= 0.7;

    return {
      title: `${percentage}%`,
      subtitle: `At ${percentage}% of video`,
      isRecommended
    };
  }

  /**
   * Generate placeholder thumbnails when video thumbnail extraction fails
   */
  private generatePlaceholderThumbnails(timePoints: number[]): GeneratedThumbnail[] {
    console.log('🎨 Creating placeholder thumbnails...');
    
    return timePoints.map((timePoint, index) => 
      this.createPlaceholderThumbnail(timePoint, index)
    );
  }

  /**
   * Create a single placeholder thumbnail
   */
  private createPlaceholderThumbnail(timePoint: number, index: number): GeneratedThumbnail {
    const percentage = Math.round(timePoint * 100);
    
    // Create a data URI for a simple colored placeholder
    const colors = ['4ECDC4', '44A08D', '667eea', '764ba2', 'f093fb'];
    const color = colors[index % colors.length];
    
    // Simple placeholder as data URI (you could also use a placeholder service)
    const placeholderUri = `https://via.placeholder.com/320x180/${color}/FFFFFF?text=${percentage}%25+Video`;
    
    return {
      uri: placeholderUri,
      timePoint,
      isCustom: false,
      timestamp: Date.now()
    };
  }

  /**
   * Check if video thumbnails module is available
   */
  private isVideoThumbnailsAvailable(): boolean {
    try {
      return VideoThumbnails && typeof VideoThumbnails.getThumbnailAsync === 'function';
    } catch (error) {
      return false;
    }
  }

  /**
   * Fast thumbnail save for speed optimization
   */
  private async fastSaveThumbnail(uri: string, filename: string): Promise<string> {
    try {
      if (!FileSystem) {
        return uri; // Return original if FileSystem not available
      }

      const thumbnailDir = `${FileSystem.documentDirectory}thumbnails`;
      await FileSystem.makeDirectoryAsync(thumbnailDir, { intermediates: true });
      
      const newPath = `${thumbnailDir}/${filename}.jpg`;
      await FileSystem.moveAsync({ from: uri, to: newPath });
      
      return newPath;
    } catch (error) {
      console.warn('⚠️ Fast save failed, using original URI:', error);
      return uri;
    }
  }

  /**
   * Generate fast placeholder thumbnails
   */
  private generateFastPlaceholderThumbnails(timePoints: number[]): GeneratedThumbnail[] {
    return timePoints.map((timePoint, index) => this.createFastPlaceholder(timePoint, index));
  }

  /**
   * Create a fast placeholder thumbnail
   */
  private createFastPlaceholder(timePoint: number, index: number): GeneratedThumbnail {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    const color = colors[index % colors.length];
    
    return {
      uri: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90"><rect width="160" height="90" fill="${color}"/><text x="80" y="45" text-anchor="middle" dy="0.3em" fill="white" font-family="Arial" font-size="12">${Math.round(timePoint * 100)}%</text></svg>`,
      timePoint,
      isCustom: false,
      timestamp: Date.now()
    };
  }

  /**
   * Generate additional thumbnails in background (non-blocking)
   */
  private generateAdditionalThumbnailsInBackground(videoUri: string, options: ThumbnailGenerationOptions) {
    setTimeout(async () => {
      try {
        console.log('🔄 Generating additional thumbnails in background...');
        const additionalTimePoints = [0.1, 0.3, 0.7, 0.9];
        
        // This runs in background without blocking the UI
        await this.generateAutoThumbnails(videoUri, {
          ...options,
          timePoints: additionalTimePoints
        });
        
        console.log('✅ Background thumbnails generated');
      } catch (error) {
        console.warn('⚠️ Background thumbnail generation failed:', error);
      }
    }, 1000); // Generate after 1 second in background
  }
}

export default LocalThumbnailService.getInstance();
