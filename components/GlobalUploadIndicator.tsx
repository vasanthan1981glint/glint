/**
 * Global Upload Indicator
 * Shows upload progress across all screens
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    View
} from 'react-native';
import backgroundUploadService, { BackgroundUploadProgress } from '../lib/backgroundUploadService';

const { width: screenWidth } = Dimensions.get('window');

export const GlobalUploadIndicator: React.FC = () => {
  const [uploads, setUploads] = useState<BackgroundUploadProgress[]>([]);
  const [visible, setVisible] = useState(false);
  const slideAnim = new Animated.Value(-100);

  useEffect(() => {
    // Check for existing uploads
    const activeUploads = backgroundUploadService.getActiveUploads();
    if (activeUploads.length > 0) {
      setUploads(activeUploads.map(job => job.progress));
      setVisible(true);
    }

    // Listen for upload updates
    const handleProgress = (uploadId: string, progress: BackgroundUploadProgress) => {
      setUploads(prev => {
        const updated = prev.filter(p => p.videoId !== uploadId);
        updated.push(progress);
        return updated;
      });
      
      if (!visible) {
        setVisible(true);
      }
    };

    const handleComplete = (uploadId: string) => {
      setUploads(prev => {
        const filtered = prev.filter(p => p.videoId !== uploadId);
        if (filtered.length === 0) {
          setVisible(false);
        }
        return filtered;
      });
    };

    // Subscribe to events
    backgroundUploadService.onProgressUpdate(handleProgress);
    backgroundUploadService.onUploadComplete(handleComplete);

    return () => {
      backgroundUploadService.offProgressUpdate(handleProgress);
      backgroundUploadService.offUploadComplete(handleComplete);
    };
  }, [visible]);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible || uploads.length === 0) {
    return null;
  }

  const currentUpload = uploads[0]; // Show first upload
  const progressPercentage = Math.round(currentUpload.progress);

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <LinearGradient
        colors={['#007AFF', '#0051D2']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.content}>
          <View style={styles.leftSection}>
            <Ionicons name="cloud-upload" size={16} color="white" />
            <Text style={styles.title}>Uploading video...</Text>
          </View>
          
          <View style={styles.rightSection}>
            <Text style={styles.progress}>{progressPercentage}%</Text>
            {uploads.length > 1 && (
              <Text style={styles.queue}>+{uploads.length - 1}</Text>
            )}
          </View>
        </View>
        
        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar, 
              { width: `${progressPercentage}%` }
            ]} 
          />
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  gradient: {
    paddingHorizontal: 16,
    paddingTop: 50, // Account for status bar
    paddingBottom: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  progress: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  queue: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    marginLeft: 4,
  },
  progressBarContainer: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1,
  },
  progressBar: {
    height: 2,
    backgroundColor: 'white',
    borderRadius: 1,
  },
});

export default GlobalUploadIndicator;
