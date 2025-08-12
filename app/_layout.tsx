import { LogBox, Platform } from 'react-native';
import { enableScreens } from 'react-native-screens'; // Call this before your component

import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as NavigationBar from 'expo-navigation-bar';
import { Slot, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import GlobalUploadIndicator from '../components/GlobalUploadIndicator';
import { AuthProvider } from '../contexts/AuthContext'; // Added import

// Suppress expo-av deprecation warning globally
LogBox.ignoreLogs([
  '[expo-av]: Expo AV has been deprecated and will be removed in SDK 54.',
  '[expo-av]: Video component from `expo-av` is deprecated in favor of `expo-video`.',
  '⚠️ [expo-av]: Video component from `expo-av` is deprecated in favor of `expo-video`.',
  'expo-av',
  'deprecated',
]);

// Optional: Extra console.warn override to fully hide the warning (use with caution)
if (__DEV__) {
  const originalWarn = console.warn;
  const originalLog = console.log;
  
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && (
      args[0].includes('Expo AV has been deprecated') ||
      args[0].includes('Video component from `expo-av` is deprecated') ||
      args[0].includes('expo-av') ||
      args[0].includes('expo-video')
    )) {
      return;
    }
    originalWarn(...args);
  };
  
  console.log = (...args) => {
    if (typeof args[0] === 'string' && (
      args[0].includes('⚠️ [expo-av]') ||
      args[0].includes('Video component from `expo-av` is deprecated')
    )) {
      return;
    }
    originalLog(...args);
  };
}

enableScreens();

export default function RootLayout() {
  const pathname = usePathname();
  const isHomeScreen = pathname === '/home';

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync(isHomeScreen ? '#000' : '#fff');
      NavigationBar.setButtonStyleAsync(isHomeScreen ? 'light' : 'dark');
    }
  }, [pathname]);

  return (
    <AuthProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider value={DefaultTheme}>
            <Slot />
            <GlobalUploadIndicator />
            <StatusBar
              style={isHomeScreen ? 'light' : 'dark'}
              backgroundColor={isHomeScreen ? '#000' : '#fff'}
              translucent={false}
            />
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AuthProvider>
  );
}
