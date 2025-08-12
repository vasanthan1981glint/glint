/**
 * YouTube-Style Upload Indicator
 * Non-blocking upload progress indicator that appears at the bottom of screen
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import backgroundUploadService, { BackgroundUploadProgress } from '../lib/backgroundUploadService';

interface Props {
  uploadId?: string;
  visible?: boolean;
  onPress?: () => void;
  onClose?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export const YouTubeStyleUploadIndicator: React.FC<Props> = ({
  uploadId,
  visible = false,
  onPress,
  onClose
}) => {
  const [progress, setProgress] = useState<BackgroundUploadProgress | null>(null);
  const [isVisible, setIsVisible] = useState(visible);
  const slideAnim = useState(new Animated.Value(100))[0]; // Start below screen

  useEffect(() => {
    if (uploadId) {
      // Register for progress updates
      backgroundUploadService.onProgress(uploadId, (newProgress) => {
        setProgress(newProgress);
        
        // Auto-show when upload starts
        if (!isVisible && (newProgress.stage === 'preparing' || newProgress.stage === 'uploading')) {
          showIndicator();
        }
        
        // Auto-hide when complete (after delay)
        if (newProgress.stage === 'complete') {
          setTimeout(() => {
            hideIndicator();
          }, 3000);
        }
      });
    }
  }, [uploadId]);

  useEffect(() => {
    if (visible) {
      showIndicator();
    } else {
      hideIndicator();
    }
  }, [visible]);

  const showIndicator = () => {
    setIsVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8
    }).start();
  };

  const hideIndicator = () => {
    Animated.timing(slideAnim, {
      toValue: 100,
      duration: 300,
      useNativeDriver: true
    }).start(() => {
      setIsVisible(false);
    });
  };

  const getStageIcon = () => {
    if (!progress) return '⬆️';
    switch (progress.stage) {
      case 'preparing': return '⚙️';
      case 'compressing': return '🔄';
      case 'uploading': return '⬆️';
      case 'processing': return '⚡';
      case 'complete': return '✅';
      case 'error': return '❌';
      default: return '⬆️';
    }
  };

  const getStageColor = (): [string, string] => {
    if (!progress) return ['#007AFF', '#0056CC'];
    switch (progress.stage) {
      case 'preparing': return ['#FF9500', '#CC7700'];
      case 'compressing': return ['#FF6B35', '#CC5329'];
      case 'uploading': return ['#007AFF', '#0056CC'];
      case 'processing': return ['#4CAF50', '#45A049'];
      case 'complete': return ['#00C851', '#00A144'];
      case 'error': return ['#FF4444', '#CC0000'];
      default: return ['#007AFF', '#0056CC'];
    }
  };

  const getProgressText = () => {
    if (!progress) return 'Uploading...';
    
    if (progress.stage === 'complete') {
      return 'Upload complete! 🎉';
    }
    
    if (progress.stage === 'error') {
      return 'Upload failed. Tap to retry';
    }
    
    return `${progress.message} (${Math.round(progress.progress)}%)`;
  };

  const handlePress = () => {
    if (progress?.stage === 'error' && uploadId) {
      // Retry failed upload
      backgroundUploadService.retryUpload(uploadId);
    } else if (onPress) {
      onPress();
    }
  };

  const handleClose = () => {
    hideIndicator();
    if (onClose) {
      onClose();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <LinearGradient
        colors={getStageColor()}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <TouchableOpacity
          style={styles.content}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{getStageIcon()}</Text>
          </View>

          {/* Progress Info */}
          <View style={styles.textContainer}>
            <Text style={styles.titleText} numberOfLines={1}>
              {progress?.fileName || 'Video Upload'}
            </Text>
            <Text style={styles.progressText} numberOfLines={1}>
              {getProgressText()}
            </Text>
          </View>

          {/* Progress Bar */}
          {progress && progress.stage !== 'complete' && progress.stage !== 'error' && (
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { width: `${progress.progress}%` }
                  ]} 
                />
              </View>
            </View>
          )}

          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color="rgba(255, 255, 255, 0.8)" />
          </TouchableOpacity>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 90 : 70, // Above tab bar
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  gradient: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    minHeight: 64,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  titleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  progressText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '400',
  },
  progressBarContainer: {
    marginRight: 12,
    width: 60,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default YouTubeStyleUploadIndicator;
