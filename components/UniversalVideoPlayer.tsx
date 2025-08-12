import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    PanResponder,
    StyleSheet,
    View
} from 'react-native';
import { useDeviceAdapter } from '../lib/deviceAdaptation';

interface UniversalVideoPlayerProps {
  videoUri: string;
  isVisible: boolean;
  isActive: boolean;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onLoadStart?: () => void;
  onLoadComplete?: () => void;
  onPlaybackStatusUpdate?: (status: AVPlaybackStatus) => void;
  style?: any;
  children?: React.ReactNode;
}

export const UniversalVideoPlayer: React.FC<UniversalVideoPlayerProps> = ({
  videoUri,
  isVisible,
  isActive,
  onSwipeUp,
  onSwipeDown,
  onLoadStart,
  onLoadComplete,
  onPlaybackStatusUpdate,
  style,
  children,
}) => {
  const videoRef = useRef<Video>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [shouldPlay, setShouldPlay] = useState(false);
  
  // Device adaptation
  const { videoContainer, gestureThresholds, platformSettings } = useDeviceAdapter();
  
  // Animated values for gestures
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // 3. Load and Play Video Logic
  useEffect(() => {
    if (isVisible && isActive) {
      setShouldPlay(true);
      setIsLoading(true);
      onLoadStart?.();
    } else {
      setShouldPlay(false);
    }
  }, [isVisible, isActive, onLoadStart]);

  // Preload next video (for lazy loading)
  useEffect(() => {
    if (videoRef.current && videoUri) {
      videoRef.current.loadAsync({ uri: videoUri }, {}, false);
    }
  }, [videoUri]);

  // 4. Handle Vertical Swipe Gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > gestureThresholds.panThreshold &&
               Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        // @ts-ignore - Animated Value private property access
        translateY.setOffset(translateY._value);
        translateY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Provide visual feedback during swipe
        translateY.setValue(gestureState.dy);
        
        // Fade effect based on swipe distance
        const progress = Math.abs(gestureState.dy) / gestureThresholds.swipeDistance;
        opacity.setValue(Math.max(0.3, 1 - progress * 0.7));
      },
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();
        
        const { dy, vy } = gestureState;
        const shouldTriggerSwipe = 
          Math.abs(dy) > gestureThresholds.swipeDistance || 
          Math.abs(vy) > gestureThresholds.swipeVelocity;

        if (shouldTriggerSwipe) {
          if (dy < 0 && onSwipeUp) {
            // Swipe up - next video
            Animated.parallel([
              Animated.timing(translateY, {
                toValue: -videoContainer.containerHeight,
                duration: platformSettings.animationDuration,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: platformSettings.animationDuration,
                useNativeDriver: true,
              }),
            ]).start(() => {
              translateY.setValue(0);
              opacity.setValue(1);
              onSwipeUp();
            });
          } else if (dy > 0 && onSwipeDown) {
            // Swipe down - previous video
            Animated.parallel([
              Animated.timing(translateY, {
                toValue: videoContainer.containerHeight,
                duration: platformSettings.animationDuration,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration: platformSettings.animationDuration,
                useNativeDriver: true,
              }),
            ]).start(() => {
              translateY.setValue(0);
              opacity.setValue(1);
              onSwipeDown();
            });
          } else {
            // Snap back
            Animated.parallel([
              Animated.spring(translateY, {
                toValue: 0,
                ...platformSettings.springConfig,
                useNativeDriver: true,
              }),
              Animated.spring(opacity, {
                toValue: 1,
                ...platformSettings.springConfig,
                useNativeDriver: true,
              }),
            ]).start();
          }
        } else {
          // Snap back to original position
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              ...platformSettings.springConfig,
              useNativeDriver: true,
            }),
            Animated.spring(opacity, {
              toValue: 1,
              ...platformSettings.springConfig,
              useNativeDriver: true,
            }),
          ]).start();
        }
      },
    })
  ).current;

  // 6. Auto Play and Pause Control
  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsBuffering(status.isBuffering || false);
      setIsLoading(false);
      
      if (!status.isBuffering && onLoadComplete) {
        onLoadComplete();
      }
    }
    
    onPlaybackStatusUpdate?.(status);
  }, [onLoadComplete, onPlaybackStatusUpdate]);

  // Video error handling
  const handleVideoError = useCallback((error: string) => {
    console.error('Video playback error:', error);
    setIsLoading(false);
    setIsBuffering(false);
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: style?.width || videoContainer.containerWidth,
          height: style?.height || videoContainer.containerHeight,
          transform: [{ translateY }],
          opacity,
        },
        style,
      ]}
      {...panResponder.panHandlers}
    >
      {/* 2. Render Video Container - YouTube Shorts Style */}
      <Video
        ref={videoRef}
        source={{ uri: videoUri }}
        style={[
          styles.video,
          style?.width && style?.height ? {
            // Full screen mode for YouTube layout - properly centered
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          } : {
            // Standard mode with container calculations
            width: videoContainer.videoWidth,
            height: videoContainer.videoHeight,
            left: videoContainer.videoOffsetX,
            top: videoContainer.videoOffsetY,
          },
        ]}
        shouldPlay={shouldPlay && isActive && isVisible}
        isLooping
        isMuted={false}
        resizeMode={ResizeMode.COVER}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        onError={handleVideoError}
        // 5. Lazy Load and Preload Settings
        progressUpdateIntervalMillis={100}
        positionMillis={0}
        volume={1.0}
        rate={1.0}
        useNativeControls={false}
      />

      {/* Loading indicator */}
      {(isLoading || isBuffering) && (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIndicator} />
        </View>
      )}

      {/* 7. Position UI Overlays */}
      <View style={styles.overlayContainer}>
        {children}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
    flex: 1,
  },
  video: {
    position: 'absolute',
    backgroundColor: '#000',
    // Ensure video fills container properly
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  loadingIndicator: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#fff',
    borderTopColor: 'transparent',
    // Add animation for loading spinner
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none', // Allow touches to pass through to children
  },
});
