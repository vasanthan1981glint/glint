// Device compatibility utilities for universal phone support
import { Dimensions, Platform, StatusBar } from 'react-native';

interface DeviceInfo {
  screenWidth: number;
  screenHeight: number;
  isSmallDevice: boolean;
  isTablet: boolean;
  statusBarHeight: number;
  isIos: boolean;
  isAndroid: boolean;
}

export const getDeviceInfo = (): DeviceInfo => {
  const { width, height } = Dimensions.get('window');
  
  return {
    screenWidth: width,
    screenHeight: height,
    isSmallDevice: width < 375, // iPhone SE and similar
    isTablet: width >= 768, // iPad and large tablets
    statusBarHeight: Platform.OS === 'ios' ? 20 : StatusBar.currentHeight || 0,
    isIos: Platform.OS === 'ios',
    isAndroid: Platform.OS === 'android',
  };
};

export const getResponsiveFontSize = (baseSize: number): number => {
  const { screenWidth, isSmallDevice } = getDeviceInfo();
  
  if (isSmallDevice) {
    return Math.max(baseSize - 2, 10); // Smaller fonts for small devices, min 10
  }
  
  if (screenWidth > 400) {
    return baseSize;
  }
  
  return Math.max(baseSize - 1, 10);
};

export const getResponsiveSpacing = (baseSpacing: number): number => {
  const { isSmallDevice } = getDeviceInfo();
  return isSmallDevice ? Math.max(baseSpacing * 0.8, 4) : baseSpacing;
};

export const getVideoGridItemSize = (): number => {
  const { screenWidth } = getDeviceInfo();
  return (screenWidth - 6) / 3; // Account for 2px gaps between 3 columns
};

export const formatError = (error: any): string => {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.toString) return error.toString();
  return 'An unexpected error occurred';
};
