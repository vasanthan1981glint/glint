import { Dimensions, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Device adaptation utilities for universal compatibility
export class DeviceAdapter {
  private static instance: DeviceAdapter;
  private screenData: {
    width: number;
    height: number;
    scale: number;
    fontScale: number;
  };

  private constructor() {
    this.screenData = Dimensions.get('screen');
    this.setupDimensionListener();
  }

  public static getInstance(): DeviceAdapter {
    if (!DeviceAdapter.instance) {
      DeviceAdapter.instance = new DeviceAdapter();
    }
    return DeviceAdapter.instance;
  }

  private setupDimensionListener() {
    Dimensions.addEventListener('change', ({ screen }) => {
      this.screenData = screen;
    });
  }

  // 1. Get Device Screen Dimensions
  public getScreenDimensions() {
    const { width, height } = this.screenData;
    const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;
    
    return {
      width,
      height,
      scale: this.screenData.scale,
      fontScale: this.screenData.fontScale,
      statusBarHeight,
      isSmallDevice: width < 375,
      isMediumDevice: width >= 375 && width < 414,
      isLargeDevice: width >= 414,
      aspectRatio: width / height,
    };
  }

  // 2. Calculate Video Container Dimensions
  public getVideoContainerDimensions(safeAreaInsets: any) {
    const screen = this.getScreenDimensions();
    const { top, bottom } = safeAreaInsets;
    
    // Full screen video container
    const containerWidth = screen.width;
    const containerHeight = screen.height;
    
    // Video dimensions for 9:16 aspect ratio
    const targetAspectRatio = 9 / 16;
    const screenAspectRatio = screen.aspectRatio;
    
    let videoWidth: number;
    let videoHeight: number;
    
    if (screenAspectRatio > targetAspectRatio) {
      // Screen is wider than 9:16, fit to height
      videoHeight = containerHeight;
      videoWidth = videoHeight * targetAspectRatio;
    } else {
      // Screen is taller than 9:16, fit to width
      videoWidth = containerWidth;
      videoHeight = videoWidth / targetAspectRatio;
    }
    
    return {
      containerWidth,
      containerHeight,
      videoWidth,
      videoHeight,
      safeTop: top,
      safeBottom: bottom,
      videoOffsetX: (containerWidth - videoWidth) / 2,
      videoOffsetY: (containerHeight - videoHeight) / 2,
    };
  }

  // 3. Get Responsive UI Dimensions
  public getResponsiveUI() {
    const screen = this.getScreenDimensions();
    const baseWidth = 375; // iPhone SE width as base
    const scaleFactor = screen.width / baseWidth;
    
    return {
      // Icon sizes
      iconSmall: Math.round(16 * scaleFactor),
      iconMedium: Math.round(24 * scaleFactor),
      iconLarge: Math.round(32 * scaleFactor),
      iconXL: Math.round(48 * scaleFactor),
      
      // Font sizes
      fontSmall: Math.round(12 * scaleFactor),
      fontMedium: Math.round(14 * scaleFactor),
      fontLarge: Math.round(16 * scaleFactor),
      fontXL: Math.round(18 * scaleFactor),
      
      // Spacing
      spacingXS: Math.round(4 * scaleFactor),
      spacingS: Math.round(8 * scaleFactor),
      spacingM: Math.round(12 * scaleFactor),
      spacingL: Math.round(16 * scaleFactor),
      spacingXL: Math.round(24 * scaleFactor),
      
      // Button sizes
      buttonSmall: Math.round(32 * scaleFactor),
      buttonMedium: Math.round(44 * scaleFactor),
      buttonLarge: Math.round(56 * scaleFactor),
      
      // Comment modal dimensions
      commentModalHeight: screen.height * 0.75,
      commentModalMaxHeight: screen.height * 0.9,
      
      // Safe areas
      tabBarHeight: Math.round(60 * scaleFactor),
      typeBarHeight: Math.round(50 * scaleFactor),
    };
  }

  // 4. Get Gesture Thresholds
  public getGestureThresholds() {
    const screen = this.getScreenDimensions();
    
    return {
      swipeVelocity: 1000,
      swipeDistance: screen.height * 0.2, // 20% of screen height
      panThreshold: 10,
      snapThreshold: screen.height * 0.5,
    };
  }

  // 5. Get Platform-specific Settings
  public getPlatformSettings() {
    return {
      isIOS: Platform.OS === 'ios',
      isAndroid: Platform.OS === 'android',
      
      // Video settings
      videoResizeMode: 'cover' as const,
      shouldUseNativeControls: false,
      autoPlay: true,
      
      // Keyboard settings
      keyboardAvoidingBehavior: Platform.OS === 'ios' ? 'padding' : 'height',
      keyboardVerticalOffset: Platform.OS === 'ios' ? 0 : 20,
      
      // Animation settings
      animationDuration: Platform.OS === 'ios' ? 300 : 250,
      springConfig: {
        damping: 15,
        mass: 1,
        stiffness: 150,
      },
    };
  }
}

// Hook for using device adapter in components
export const useDeviceAdapter = () => {
  const safeAreaInsets = useSafeAreaInsets();
  const adapter = DeviceAdapter.getInstance();
  
  return {
    screenDimensions: adapter.getScreenDimensions(),
    videoContainer: adapter.getVideoContainerDimensions(safeAreaInsets),
    responsiveUI: adapter.getResponsiveUI(),
    gestureThresholds: adapter.getGestureThresholds(),
    platformSettings: adapter.getPlatformSettings(),
    safeAreaInsets,
  };
};
