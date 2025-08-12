import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Dimensions, Modal, StyleSheet, Text, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

interface VideoProcessingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: number;
  fileSize?: string;
}

export const VideoProcessingOverlay: React.FC<VideoProcessingOverlayProps> = ({
  visible,
  message = "Processing video...",
  progress = 0,
  fileSize = ""
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Pulse animation for the icon
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );

      // Rotation animation for loading effect
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );

      pulseAnimation.start();
      rotateAnimation.start();

      return () => {
        pulseAnimation.stop();
        rotateAnimation.stop();
      };
    }
  }, [visible, pulseAnim, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Debug logging
  if (__DEV__) {
    console.log('🔍 VideoProcessingOverlay rendering with visible:', visible, 'progress:', progress);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#4ECDC4', '#44A08D']}
          style={styles.container}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Animated Icon */}
          <Animated.View 
            style={[
              styles.iconContainer,
              { transform: [{ scale: pulseAnim }] }
            ]}
          >
            <Text style={styles.icon}>🎬</Text>
          </Animated.View>

          {/* Loading Spinner with rotation */}
          <Animated.View 
            style={[
              styles.spinnerContainer,
              { transform: [{ rotate: spin }] }
            ]}
          >
            <ActivityIndicator size="large" color="#fff" />
          </Animated.View>

          {/* Loading dots animation */}
          <View style={styles.dotsContainer}>
            <Text style={styles.dots}>●</Text>
            <Text style={[styles.dots, { opacity: 0.7 }]}>●</Text>
            <Text style={[styles.dots, { opacity: 0.4 }]}>●</Text>
          </View>

          {/* Message */}
          <Text style={styles.title}>Getting Your Video Ready</Text>
          <Text style={styles.message}>{message}</Text>

          {/* File Size Info */}
          {fileSize && (
            <Text style={styles.fileSize}>File size: {fileSize}</Text>
          )}

          {/* Progress Bar */}
          {progress > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <Animated.View 
                  style={[
                    styles.progressBarFill,
                    { 
                      width: `${progress}%`,
                      opacity: pulseAnim.interpolate({
                        inputRange: [1, 1.2],
                        outputRange: [0.8, 1],
                      })
                    }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>{Math.round(progress)}%</Text>
            </View>
          )}

          {/* Tips */}
          <View style={styles.tipsContainer}>
            {progress > 0 ? (
              <>
                <Text style={styles.tip}>⏱️ Processing your video...</Text>
                <Text style={styles.tip}>🎥 Larger files take a moment longer</Text>
              </>
            ) : (
              <>
                <Text style={styles.tip}>💡 This should only take a moment</Text>
                <Text style={styles.tip}>🎥 Your video is being optimized for the best quality</Text>
              </>
            )}
          </View>

          {/* Bottom progress bar visual effect (only if no main progress) */}
          {progress === 0 && (
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill,
                    { 
                      width: '70%',
                      opacity: pulseAnim.interpolate({
                        inputRange: [1, 1.2],
                        outputRange: [0.7, 1],
                      })
                    }
                  ]} 
                />
              </View>
            </View>
          )}
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: screenWidth * 0.85,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 20,
  },
  icon: {
    fontSize: 60,
  },
  spinnerContainer: {
    marginBottom: 15,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 5,
  },
  dots: {
    fontSize: 12,
    color: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 20,
  },
  fileSize: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: '500',
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#fff',
    marginTop: 8,
    fontWeight: '600',
  },
  tipsContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  tip: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 5,
  },
  progressBarContainer: {
    width: '100%',
    marginTop: 10,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
});
