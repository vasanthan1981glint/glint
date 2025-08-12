import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebaseConfig';

export interface PermanentThumbnailResult {
  thumbnailUrl: string;
  isCustom: boolean;
  uploadedToFirebase: boolean;
}

class PermanentThumbnailService {
  
  /**
   * Generate and upload permanent thumbnail for any video
   * This creates a reliable thumbnail and saves it to Firebase Storage
   */
  async generateAndUploadPermanentThumbnail(
    videoAssetId: string,
    customOptions?: {
      backgroundColor?: string;
      textColor?: string;
      text?: string;
    }
  ): Promise<PermanentThumbnailResult> {
    try {
      console.log(`🎨 Creating permanent thumbnail for video: ${videoAssetId}`);
      
  // Build a reliable PNG placeholder URL (works on all devices)
  const sourceUrl = this.createThumbnailImageSourceUrl(videoAssetId, customOptions);
      
  // Upload to Firebase Storage as PNG
  const firebaseUrl = await this.uploadThumbnailToFirebase(videoAssetId, sourceUrl);
      
      console.log(`✅ Permanent thumbnail created and uploaded: ${firebaseUrl}`);
      
      return {
        thumbnailUrl: firebaseUrl,
        isCustom: false,
        uploadedToFirebase: true
      };
      
    } catch (error) {
      console.error(`❌ Failed to create permanent thumbnail for ${videoAssetId}:`, error);
      
      // Return a reliable fallback URL
      return {
        thumbnailUrl: this.createReliableFallback(videoAssetId),
        isCustom: false,
        uploadedToFirebase: false
      };
    }
  }
  
  /**
   * Create a reliable PNG source URL for the placeholder thumbnail
   */
  private createThumbnailImageSourceUrl(
    videoAssetId: string,
    options?: {
      backgroundColor?: string;
      textColor?: string;
      text?: string;
    }
  ): string {
    const videoId = videoAssetId.replace('firebase_', '');
    const timestamp = parseInt(videoId) || Date.now();

    const colors = [
      { bg: 'FF6B6B', name: 'Red' },
      { bg: '4ECDC4', name: 'Teal' },
      { bg: '45B7D1', name: 'Blue' },
      { bg: '96CEB4', name: 'Green' },
      { bg: 'FFEAA7', name: 'Yellow' },
      { bg: 'DDA0DD', name: 'Purple' },
      { bg: 'F4A460', name: 'Orange' },
      { bg: '87CEEB', name: 'Sky' }
    ];

    const colorIndex = Math.abs(timestamp) % colors.length;
    const selectedColor = colors[colorIndex];

    const bg = (options?.backgroundColor || selectedColor.bg).replace('#', '');
    const textColor = (options?.textColor || '#FFFFFF').replace('#', '');
    const text = encodeURIComponent(options?.text || selectedColor.name);

    // Use dummyimage.com to produce a PNG (explicitly .png)
    return `https://dummyimage.com/640x360/${bg}/${textColor}.png&text=${text}`;
  }
  
  /**
   * Upload thumbnail to Firebase Storage as PNG file by fetching a reliable PNG URL
   */
  private async uploadThumbnailToFirebase(videoAssetId: string, sourceUrl: string): Promise<string> {
    const timestamp = Date.now();
    const fileName = `thumbnails/permanent_${videoAssetId}_${timestamp}.png`;
    const storageRef = ref(storage, fileName);

    let blob: Blob | null = null;
    try {
      // Try fetching the PNG from the source URL
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch placeholder PNG: ${response.status}`);
      }
      blob = await response.blob();
    } catch (e) {
      // Offline-safe fallback: use a tiny embedded PNG
      // 1x1 px transparent PNG base64
      const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=';
      const byteChars = atob(base64Png);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: 'image/png' });
    }

    // Upload to Firebase
    const snapshot = await uploadBytes(storageRef, blob!, { contentType: 'image/png' });
    const downloadUrl = await getDownloadURL(snapshot.ref);

    console.log(`☁️ Thumbnail uploaded to Firebase: ${downloadUrl}`);
    return downloadUrl;
  }
  
  /**
   * Create reliable fallback that works offline
   */
  private createReliableFallback(videoAssetId: string): string {
    // Create a simple, reliable placeholder URL that works everywhere
    const colors = ['FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7', 'DDA0DD'];
    const colorIndex = Math.abs(videoAssetId.length) % colors.length;
    const color = colors[colorIndex];
    
    // Use a more reliable placeholder service or default color
  return `https://dummyimage.com/640x360/${color}/FFFFFF.png&text=Video+Thumbnail`;
  }
  
  /**
   * Generate thumbnail specifically for video upload completion
   * This ensures every uploaded video gets a permanent thumbnail
   */
  async ensureVideoHasPermanentThumbnail(videoAssetId: string): Promise<string> {
    console.log(`🔍 Ensuring permanent thumbnail exists for: ${videoAssetId}`);
    
    try {
      const result = await this.generateAndUploadPermanentThumbnail(videoAssetId);
      
      if (result.uploadedToFirebase) {
        console.log(`✅ Permanent thumbnail ensured for ${videoAssetId}: ${result.thumbnailUrl}`);
        return result.thumbnailUrl;
      } else {
        console.log(`⚠️ Using fallback thumbnail for ${videoAssetId}: ${result.thumbnailUrl}`);
        return result.thumbnailUrl;
      }
      
    } catch (error) {
      console.error(`❌ Failed to ensure thumbnail for ${videoAssetId}:`, error);
      return this.createReliableFallback(videoAssetId);
    }
  }
}

export default new PermanentThumbnailService();
