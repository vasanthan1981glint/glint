import { Platform } from 'react-native';

export interface CompressionSettings {
  quality: number;
  bitrate: number;
  maxWidth: number;
  maxHeight: number;
  frameRate: number;
}

export interface CompressionProgress {
  progress: number;
  message: string;
  estimatedSize?: string;
}

export class VideoCompressionService {
  
  static getOptimalSettings(): CompressionSettings {
    const deviceIsHighEnd = Platform.OS === 'ios';
    
    return {
      quality: 0.9, // High quality but compressed
      bitrate: deviceIsHighEnd ? 2000000 : 1500000, // 2Mbps for iOS, 1.5Mbps for Android
      maxWidth: 1080, // Max 1080p width
      maxHeight: 1920, // Max 1080p height
      frameRate: 30, // Standard 30fps
    };
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static estimateCompressionRatio(originalSize: number): number {
    // Estimate compression ratio based on optimal settings
    const settings = this.getOptimalSettings();
    const compressionFactor = settings.quality * 0.7; // Roughly 70% size reduction
    return compressionFactor;
  }

  static getCompressionMessage(progress: number): string {
    if (progress < 20) {
      return "🎥 Analyzing video quality...";
    } else if (progress < 40) {
      return "⚡ Optimizing resolution and bitrate...";
    } else if (progress < 60) {
      return "🗜️ Compressing video data...";
    } else if (progress < 80) {
      return "✨ Applying quality optimizations...";
    } else if (progress < 95) {
      return "🔧 Finalizing compression...";
    } else {
      return "✅ Compression complete!";
    }
  }

  static calculateUploadSpeed(bytesUploaded: number, timeElapsed: number): string {
    if (timeElapsed <= 0) return "Calculating...";
    
    const bytesPerSecond = bytesUploaded / timeElapsed;
    const mbPerSecond = bytesPerSecond / (1024 * 1024);
    
    if (mbPerSecond >= 1) {
      return `${mbPerSecond.toFixed(1)} MB/s`;
    } else {
      const kbPerSecond = bytesPerSecond / 1024;
      return `${kbPerSecond.toFixed(0)} KB/s`;
    }
  }

  static estimateTimeRemaining(bytesUploaded: number, totalBytes: number, timeElapsed: number): string {
    if (timeElapsed <= 0 || bytesUploaded <= 0) return "Calculating...";
    
    const bytesPerSecond = bytesUploaded / timeElapsed;
    const remainingBytes = totalBytes - bytesUploaded;
    const remainingSeconds = remainingBytes / bytesPerSecond;
    
    if (remainingSeconds < 60) {
      return `${Math.ceil(remainingSeconds)}s`;
    } else if (remainingSeconds < 3600) {
      const minutes = Math.ceil(remainingSeconds / 60);
      return `${minutes}m`;
    } else {
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.ceil((remainingSeconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  static getQualityDescription(quality: number): string {
    if (quality >= 0.9) return "High Quality";
    if (quality >= 0.7) return "Good Quality";
    if (quality >= 0.5) return "Standard Quality";
    return "Compressed Quality";
  }
}
