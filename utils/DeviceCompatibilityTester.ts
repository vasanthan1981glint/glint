import React from 'react';
import { Dimensions, PixelRatio, Platform } from 'react-native';

// ✅ 20. Device Compatibility Testing Utilities

export interface DeviceInfo {
  // Screen specifications
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  screenDensity: 'low' | 'medium' | 'high' | 'xhigh' | 'xxhigh' | 'xxxhigh';
  
  // Device categorization
  deviceType: 'phone' | 'tablet' | 'foldable' | 'tv';
  deviceSize: 'small' | 'medium' | 'large' | 'xlarge';
  
  // Platform info
  platform: 'ios' | 'android' | 'web';
  platformVersion?: string;
  
  // Display characteristics
  aspectRatio: number;
  orientation: 'portrait' | 'landscape';
  hasNotch: boolean;
  hasDynamicIsland: boolean;
  hasHomeIndicator: boolean;
  
  // Performance indicators
  memoryClass?: 'low' | 'medium' | 'high';
  cpuClass?: 'low' | 'medium' | 'high';
  
  // Accessibility features
  supportsAccessibility: boolean;
  supportsHaptics: boolean;
  supportsVoiceOver: boolean;
  
  // Video playback capabilities
  videoCapabilities: {
    maxResolution: '480p' | '720p' | '1080p' | '4K';
    hardwareAcceleration: boolean;
    codecSupport: string[];
  };
}

export class DeviceCompatibilityTester {
  private deviceInfo: DeviceInfo;
  
  constructor() {
    this.deviceInfo = this.analyzeDevice();
  }
  
  // ✅ Analyze current device comprehensively
  private analyzeDevice(): DeviceInfo {
    const { width, height } = Dimensions.get('window');
    const pixelRatio = PixelRatio.get();
    const screenDensity = this.getScreenDensity(pixelRatio);
    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    
    return {
      screenWidth: width,
      screenHeight: height,
      pixelRatio,
      screenDensity,
      deviceType: this.getDeviceType(width, height),
      deviceSize: this.getDeviceSize(width, height),
      platform: Platform.OS as 'ios' | 'android' | 'web',
      platformVersion: Platform.Version?.toString(),
      aspectRatio,
      orientation: width > height ? 'landscape' : 'portrait',
      hasNotch: this.detectNotch(width, height),
      hasDynamicIsland: this.detectDynamicIsland(width, height),
      hasHomeIndicator: this.detectHomeIndicator(),
      memoryClass: this.estimateMemoryClass(),
      cpuClass: this.estimateCpuClass(),
      supportsAccessibility: this.checkAccessibilitySupport(),
      supportsHaptics: this.checkHapticsSupport(),
      supportsVoiceOver: this.checkVoiceOverSupport(),
      videoCapabilities: this.analyzeVideoCapabilities(),
    };
  }
  
  // Screen density classification
  private getScreenDensity(pixelRatio: number): DeviceInfo['screenDensity'] {
    if (pixelRatio <= 1) return 'low';
    if (pixelRatio <= 1.5) return 'medium';
    if (pixelRatio <= 2) return 'high';
    if (pixelRatio <= 3) return 'xhigh';
    if (pixelRatio <= 4) return 'xxhigh';
    return 'xxxhigh';
  }
  
  // Device type detection
  private getDeviceType(width: number, height: number): DeviceInfo['deviceType'] {
    const minDimension = Math.min(width, height);
    const maxDimension = Math.max(width, height);
    
    // TV detection (very large screens)
    if (minDimension > 1200 || maxDimension > 1920) {
      return 'tv';
    }
    
    // Tablet detection
    if (minDimension >= 768 || (minDimension >= 600 && maxDimension >= 900)) {
      return 'tablet';
    }
    
    // Foldable detection (unusual aspect ratios when unfolded)
    const aspectRatio = maxDimension / minDimension;
    if (aspectRatio > 2.5 && minDimension > 500) {
      return 'foldable';
    }
    
    return 'phone';
  }
  
  // Device size classification
  private getDeviceSize(width: number, height: number): DeviceInfo['deviceSize'] {
    const maxDimension = Math.max(width, height);
    
    if (maxDimension < 750) return 'small';
    if (maxDimension < 900) return 'medium';
    if (maxDimension < 1200) return 'large';
    return 'xlarge';
  }
  
  // Notch detection
  private detectNotch(width: number, height: number): boolean {
    if (Platform.OS === 'ios') {
      // iPhone X and newer dimensions
      const iosNotchDimensions = [
        [375, 812], // iPhone X, XS, 11 Pro
        [414, 896], // iPhone XR, XS Max, 11, 11 Pro Max
        [390, 844], // iPhone 12, 12 Pro
        [428, 926], // iPhone 12 Pro Max
        [375, 812], // iPhone 13 mini
        [390, 844], // iPhone 13, 13 Pro
        [428, 926], // iPhone 13 Pro Max
      ];
      
      return iosNotchDimensions.some(([w, h]) => 
        (width === w && height === h) || (width === h && height === w)
      );
    }
    
    // Android notch detection (heuristic)
    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    return aspectRatio > 2.0 && Math.max(width, height) >= 800;
  }
  
  // Dynamic Island detection (iPhone 14 Pro+)
  private detectDynamicIsland(width: number, height: number): boolean {
    if (Platform.OS !== 'ios') return false;
    
    const dynamicIslandDimensions = [
      [393, 852], // iPhone 14 Pro
      [430, 932], // iPhone 14 Pro Max
    ];
    
    return dynamicIslandDimensions.some(([w, h]) => 
      (width === w && height === h) || (width === h && height === w)
    );
  }
  
  // Home indicator detection
  private detectHomeIndicator(): boolean {
    if (Platform.OS === 'ios') {
      // iOS devices with home indicator (iPhone X+)
      return this.deviceInfo?.hasNotch || this.deviceInfo?.hasDynamicIsland || false;
    }
    
    // Android devices with gesture navigation
    const { height } = Dimensions.get('window');
    return height >= 800; // Most modern Android devices
  }
  
  // Memory class estimation
  private estimateMemoryClass(): DeviceInfo['memoryClass'] {
    const { screenWidth, screenHeight, pixelRatio } = this.deviceInfo || {};
    const totalPixels = (screenWidth || 0) * (screenHeight || 0) * (pixelRatio || 1);
    
    // Estimate based on screen complexity and platform
    if (Platform.OS === 'ios') {
      if (totalPixels > 2000000) return 'high';
      if (totalPixels > 1000000) return 'medium';
      return 'low';
    } else {
      // Android varies more widely
      if (totalPixels > 3000000) return 'high';
      if (totalPixels > 1500000) return 'medium';
      return 'low';
    }
  }
  
  // CPU class estimation
  private estimateCpuClass(): DeviceInfo['cpuClass'] {
    const currentYear = new Date().getFullYear();
    const platformVersion = parseFloat(this.deviceInfo?.platformVersion || '0');
    
    if (Platform.OS === 'ios') {
      // iOS version as proxy for device age/performance
      if (platformVersion >= 15) return 'high';
      if (platformVersion >= 13) return 'medium';
      return 'low';
    } else {
      // Android API level as proxy
      if (platformVersion >= 30) return 'high'; // Android 11+
      if (platformVersion >= 26) return 'medium'; // Android 8+
      return 'low';
    }
  }
  
  // Accessibility support check
  private checkAccessibilitySupport(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }
  
  // Haptics support check
  private checkHapticsSupport(): boolean {
    return Platform.OS === 'ios' || (Platform.OS === 'android' && Platform.Version >= 23);
  }
  
  // VoiceOver/TalkBack support check
  private checkVoiceOverSupport(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }
  
  // Video capabilities analysis
  private analyzeVideoCapabilities(): DeviceInfo['videoCapabilities'] {
    const { deviceSize, memoryClass, cpuClass } = this.deviceInfo || {};
    
    let maxResolution: DeviceInfo['videoCapabilities']['maxResolution'] = '480p';
    let hardwareAcceleration = true;
    
    // Estimate max resolution based on device capabilities
    if (cpuClass === 'high' && memoryClass === 'high') {
      maxResolution = '4K';
    } else if (cpuClass === 'medium' || memoryClass === 'medium') {
      maxResolution = '1080p';
    } else if (deviceSize === 'large' || deviceSize === 'xlarge') {
      maxResolution = '720p';
    }
    
    // Hardware acceleration availability
    if (Platform.OS === 'ios') {
      hardwareAcceleration = true; // Generally available on iOS
    } else {
      hardwareAcceleration = (Platform.Version as number) >= 21; // Android 5.0+
    }
    
    const codecSupport = ['h264', 'aac'];
    if (Platform.OS === 'ios' || (Platform.Version as number) >= 24) {
      codecSupport.push('hevc', 'vp9');
    }
    
    return {
      maxResolution,
      hardwareAcceleration,
      codecSupport,
    };
  }
  
  // ✅ Public methods for testing layout compatibility
  
  getDeviceInfo(): DeviceInfo {
    return this.deviceInfo;
  }
  
  // Test if device can handle high-quality video
  canHandleHighQualityVideo(): boolean {
    const { videoCapabilities, memoryClass, cpuClass } = this.deviceInfo;
    return videoCapabilities.maxResolution === '1080p' || 
           videoCapabilities.maxResolution === '4K' ||
           (memoryClass === 'high' && cpuClass === 'high');
  }
  
  // Test if device needs data saving mode
  needsDataSavingMode(): boolean {
    const { memoryClass, deviceSize, screenDensity } = this.deviceInfo;
    return memoryClass === 'low' || 
           deviceSize === 'small' || 
           screenDensity === 'low';
  }
  
  // Test optimal layout configuration
  getOptimalLayoutConfig(): {
    preloadVideos: boolean;
    thumbnailQuality: 'low' | 'medium' | 'high';
    animationDuration: number;
    maxConcurrentVideos: number;
  } {
    const { memoryClass, cpuClass, deviceSize } = this.deviceInfo;
    
    const isHighPerformance = memoryClass === 'high' && cpuClass === 'high';
    const isMediumPerformance = memoryClass === 'medium' || cpuClass === 'medium';
    
    return {
      preloadVideos: isHighPerformance,
      thumbnailQuality: isHighPerformance ? 'high' : isMediumPerformance ? 'medium' : 'low',
      animationDuration: isHighPerformance ? 300 : isMediumPerformance ? 200 : 150,
      maxConcurrentVideos: isHighPerformance ? 5 : isMediumPerformance ? 3 : 2,
    };
  }
  
  // Generate compatibility report
  generateCompatibilityReport(): {
    overall: 'excellent' | 'good' | 'fair' | 'poor';
    recommendations: string[];
    warnings: string[];
    deviceInfo: DeviceInfo;
  } {
    const { memoryClass, cpuClass, videoCapabilities, deviceSize } = this.deviceInfo;
    
    let overall: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
    const recommendations: string[] = [];
    const warnings: string[] = [];
    
    // Overall rating logic
    if (memoryClass === 'high' && cpuClass === 'high') {
      overall = 'excellent';
    } else if (memoryClass === 'medium' || cpuClass === 'medium') {
      overall = 'good';
    } else if (memoryClass === 'low' && cpuClass === 'low') {
      overall = 'poor';
      warnings.push('Device may struggle with high-quality video playback');
    } else {
      overall = 'fair';
    }
    
    // Recommendations
    if (this.needsDataSavingMode()) {
      recommendations.push('Enable data saving mode');
    }
    
    if (videoCapabilities.maxResolution === '480p') {
      recommendations.push('Limit video quality to 480p');
    }
    
    if (deviceSize === 'small') {
      recommendations.push('Use smaller UI elements for better thumb navigation');
    }
    
    if (!videoCapabilities.hardwareAcceleration) {
      warnings.push('Hardware video acceleration not available');
      recommendations.push('Implement software fallback for video decoding');
    }
    
    return {
      overall,
      recommendations,
      warnings,
      deviceInfo: this.deviceInfo,
    };
  }
  
  // Test specific features
  testFeatureSupport(): {
    fullScreenVideo: boolean;
    aspectRatioHandling: boolean;
    safeAreaInsets: boolean;
    snapScrolling: boolean;
    hardwareAcceleration: boolean;
    accessibility: boolean;
  } {
    const { hasNotch, hasDynamicIsland, videoCapabilities, supportsAccessibility } = this.deviceInfo;
    
    return {
      fullScreenVideo: true, // All modern devices support this
      aspectRatioHandling: true, // React Native handles this well
      safeAreaInsets: hasNotch || hasDynamicIsland || Platform.OS === 'android',
      snapScrolling: true, // FlatList supports this universally
      hardwareAcceleration: videoCapabilities.hardwareAcceleration,
      accessibility: supportsAccessibility,
    };
  }
}

// ✅ Global instance for easy access
export const deviceTester = new DeviceCompatibilityTester();

// ✅ Hook for React components
export const useDeviceCompatibility = () => {
  const [deviceInfo, setDeviceInfo] = React.useState<DeviceInfo>(deviceTester.getDeviceInfo());
  
  React.useEffect(() => {
    // Re-analyze on orientation change
    const subscription = Dimensions.addEventListener('change', () => {
      const newTester = new DeviceCompatibilityTester();
      setDeviceInfo(newTester.getDeviceInfo());
    });
    
    return () => subscription?.remove();
  }, []);
  
  return {
    deviceInfo,
    canHandleHighQuality: deviceTester.canHandleHighQualityVideo(),
    needsDataSaving: deviceTester.needsDataSavingMode(),
    layoutConfig: deviceTester.getOptimalLayoutConfig(),
    compatibilityReport: deviceTester.generateCompatibilityReport(),
    featureSupport: deviceTester.testFeatureSupport(),
  };
};

export default DeviceCompatibilityTester;
