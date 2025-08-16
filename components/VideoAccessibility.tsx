import React from 'react';
import { AccessibilityInfo, Platform, Text, View } from 'react-native';
import { VideoData } from './ShortFormVideoPlayer';

// ✅ 18. Accessibility Support Component
interface VideoAccessibilityProps {
  video: VideoData;
  isPlaying: boolean;
  progress: number;
  isCurrentVideo: boolean;
  children: React.ReactNode;
}

export const VideoAccessibility: React.FC<VideoAccessibilityProps> = ({
  video,
  isPlaying,
  progress,
  isCurrentVideo,
  children,
}) => {
  
  // Generate comprehensive content description
  const generateContentDescription = () => {
    const playbackStatus = isPlaying ? 'playing' : 'paused';
    const progressText = `${Math.round(progress * 100)}% complete`;
    const captionText = video.caption ? `, caption: ${video.caption}` : '';
    
    return `Video by ${video.username}, ${playbackStatus}, ${progressText}${captionText}`;
  };
  
  // Generate accessibility hint
  const generateAccessibilityHint = () => {
    if (!isCurrentVideo) {
      return 'Swipe up or down to navigate to this video';
    }
    
    const hints = [];
    if (isPlaying) {
      hints.push('Tap to pause');
    } else {
      hints.push('Tap to play');
    }
    hints.push('Double tap for like');
    hints.push('Swipe up for next video');
    hints.push('Swipe down for previous video');
    
    return hints.join(', ');
  };
  
  return (
    <View
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={generateContentDescription()}
      accessibilityHint={generateAccessibilityHint()}
      accessibilityState={{
        selected: isCurrentVideo,
        disabled: false,
      }}
      accessibilityActions={[
        { name: 'activate', label: isPlaying ? 'Pause video' : 'Play video' },
        { name: 'increment', label: 'Next video' },
        { name: 'decrement', label: 'Previous video' },
        { name: 'longpress', label: 'Video options' },
      ]}
    >
      {children}
      
      {/* Screen reader only content */}
      <Text
        style={{ 
          position: 'absolute', 
          left: -10000,
          top: 'auto',
          width: 1,
          height: 1,
          overflow: 'hidden'
        }}
        accessible={false}
        importantForAccessibility="no"
      >
        Video content: {video.caption || 'No caption available'}
        Created by: {video.username}
        Duration: Video duration information
        Current status: {isPlaying ? 'Playing' : 'Paused'}
      </Text>
    </View>
  );
};

// ✅ 16. Dynamic Text Layout with RTL Support
interface RTLTextProps {
  children: React.ReactNode;
  style?: any;
}

export const RTLText: React.FC<RTLTextProps> = ({ children, style }) => {
  const [isRTL, setIsRTL] = React.useState(false);
  
  React.useEffect(() => {
    if (Platform.OS === 'ios') {
      // For iOS, we can detect RTL from the system
      const isRTLSystem = require('react-native').I18nManager.isRTL;
      setIsRTL(isRTLSystem);
    } else {
      // For Android, we might need to detect from content or locale
      // This is a simplified version - in production you'd use proper i18n
      const textContent = String(children);
      const rtlRegex = /[\u0590-\u083F]|[\u08A0-\u08FF]|[\uFB1D-\uFDFF]|[\uFE70-\uFEFF]/mg;
      setIsRTL(rtlRegex.test(textContent));
    }
  }, [children]);
  
  return (
    <Text 
      style={[
        style,
        {
          textAlign: isRTL ? 'right' : 'left',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        }
      ]}
    >
      {children}
    </Text>
  );
};

// ✅ Keyboard Navigation Support
export const useKeyboardNavigation = (
  onPlayPause: () => void,
  onNext: () => void,
  onPrevious: () => void,
  onLike: () => void,
  onShare: () => void
) => {
  React.useEffect(() => {
    if (Platform.OS !== 'web') return; // Only for web platform
    
    const handleKeyPress = (event: KeyboardEvent) => {
      switch (event.key) {
        case ' ':
        case 'k':
          event.preventDefault();
          onPlayPause();
          break;
        case 'ArrowUp':
          event.preventDefault();
          onPrevious();
          break;
        case 'ArrowDown':
          event.preventDefault();
          onNext();
          break;
        case 'l':
          event.preventDefault();
          onLike();
          break;
        case 's':
          event.preventDefault();
          onShare();
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [onPlayPause, onNext, onPrevious, onLike, onShare]);
};

// ✅ High Contrast Mode Support
export const useHighContrastMode = () => {
  const [isHighContrast, setIsHighContrast] = React.useState(false);
  
  React.useEffect(() => {
    if (Platform.OS === 'ios') {
      AccessibilityInfo.isHighTextContrastEnabled().then(setIsHighContrast);
      
      const subscription = AccessibilityInfo.addEventListener(
        'highTextContrastChanged',
        setIsHighContrast
      );
      
      return () => subscription?.remove();
    }
  }, []);
  
  return isHighContrast;
};

// ✅ Reduce Motion Support  
export const useReduceMotion = () => {
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = React.useState(false);
  
  React.useEffect(() => {
    if (Platform.OS === 'ios') {
      AccessibilityInfo.isReduceMotionEnabled().then(setIsReduceMotionEnabled);
      
      const subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        setIsReduceMotionEnabled
      );
      
      return () => subscription?.remove();
    }
  }, []);
  
  return isReduceMotionEnabled;
};

// ✅ Voice Over / TalkBack Support
export const useScreenReader = () => {
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = React.useState(false);
  
  React.useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setIsScreenReaderEnabled);
    
    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsScreenReaderEnabled
    );
    
    return () => subscription?.remove();
  }, []);
  
  return isScreenReaderEnabled;
};
