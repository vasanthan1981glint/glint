/**
 * Complete Video Upload Component
 * Handles video selection, upload, and real-time progress tracking
 */

import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as VideoThumbnails from 'expo-video-thumbnails';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import backgroundUploadService, { BackgroundUploadProgress } from '../lib/backgroundUploadService';

const { width, height } = Dimensions.get('window');

interface VideoUploadComponentProps {
  onUploadStart?: () => void;
  onUploadComplete?: (videoData: any) => void;
  onUploadError?: (error: string) => void;
  disabled?: boolean;
}

export default function VideoUploadComponent({
  onUploadStart,
  onUploadComplete,
  onUploadError,
  disabled = false
}: VideoUploadComponentProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<BackgroundUploadProgress | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [videoMetadata, setVideoMetadata] = useState<any>(null);

  // Request camera/media permissions
  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Camera and media library access are required to upload videos.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  // Select video from camera
  const recordVideo = async () => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60, // 60 seconds max
      });

      if (!result.canceled && result.assets[0]) {
        await handleVideoSelected(result.assets[0]);
      }
    } catch (error) {
      console.error('Error recording video:', error);
      Alert.alert('Error', 'Failed to record video. Please try again.');
    }
  };

  // Select video from gallery
  const selectFromGallery = async () => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        await handleVideoSelected(result.assets[0]);
      }
    } catch (error) {
      console.error('Error selecting video:', error);
      Alert.alert('Error', 'Failed to select video. Please try again.');
    }
  };

  // Handle selected video
  const handleVideoSelected = async (videoAsset: any) => {
    try {
      console.log('📹 Video selected:', videoAsset);
      
      // Generate thumbnail
      const thumbnail = await VideoThumbnails.getThumbnailAsync(videoAsset.uri, {
        time: 1000, // 1 second
        quality: 0.8,
      });

      const metadata = {
        uri: videoAsset.uri,
        duration: videoAsset.duration || 0,
        width: videoAsset.width || 720,
        height: videoAsset.height || 1280,
        fileSize: videoAsset.fileSize || 0,
        mimeType: videoAsset.mimeType || 'video/mp4',
        thumbnail: thumbnail.uri,
      };

      setSelectedVideo(videoAsset);
      setVideoMetadata(metadata);
      setShowPreview(true);

    } catch (error) {
      console.error('Error processing video:', error);
      Alert.alert('Error', 'Failed to process video. Please try again.');
    }
  };

  // Start upload process
  const startUpload = async (title: string = '', description: string = '') => {
    if (!selectedVideo || !videoMetadata) {
      Alert.alert('Error', 'No video selected');
      return;
    }

    setUploading(true);
    setShowPreview(false);
    onUploadStart?.();

    try {
      console.log('🚀 Starting video upload...');

      // Use background upload service for better UX
      const uploadId = await backgroundUploadService.startBackgroundUpload(
        selectedVideo.uri,
        title || 'Untitled Video',
        videoMetadata.thumbnail
      );

      console.log('✅ Upload initiated:', uploadId);

      // Monitor upload progress using onProgress callback
      backgroundUploadService.onProgress(uploadId, (currentProgress) => {
        setProgress(currentProgress);

        if (currentProgress?.stage === 'complete') {
          setUploading(false);
          setProgress(null);
          setSelectedVideo(null);
          setVideoMetadata(null);
          onUploadComplete?.(currentProgress);
        } else if (currentProgress?.stage === 'error') {
          setUploading(false);
          setProgress(null);
          onUploadError?.(currentProgress.message || 'Upload failed');
        }
      });

    } catch (error: any) {
      console.error('❌ Upload failed:', error);
      setUploading(false);
      setProgress(null);
      onUploadError?.(error.message || 'Upload failed');
    }
  };

  // Show upload options
  const showUploadOptions = () => {
    Alert.alert(
      'Upload Video',
      'Choose how you want to add your video',
      [
        { text: 'Record Video', onPress: recordVideo },
        { text: 'Choose from Gallery', onPress: selectFromGallery },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Upload Button */}
      <TouchableOpacity
        style={[styles.uploadButton, disabled && styles.disabledButton]}
        onPress={showUploadOptions}
        disabled={disabled || uploading}
      >
        <LinearGradient
          colors={['#6366f1', '#8b5cf6']}
          style={styles.gradientButton}
        >
          {uploading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <MaterialIcons name="video-camera-back" size={24} color="white" />
          )}
          <Text style={styles.uploadButtonText}>
            {uploading ? 'Uploading...' : 'Upload Video'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Upload Progress */}
      {progress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>{progress.message}</Text>
            <Text style={styles.progressPercentage}>
              {Math.round(progress.progress)}%
            </Text>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View 
              style={[styles.progressBar, { width: `${progress.progress}%` }]} 
            />
          </View>

          <View style={styles.progressDetails}>
            <Text style={styles.progressText}>Stage: {progress.stage}</Text>
            {progress.fileSize && (
              <Text style={styles.progressText}>
                Size: {progress.fileSize}
              </Text>
            )}
            {progress.uploadSpeed && (
              <Text style={styles.progressText}>
                Speed: {progress.uploadSpeed}/s
              </Text>
            )}
            {progress.timeRemaining && (
              <Text style={styles.progressText}>
                Time left: {progress.timeRemaining}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Video Preview Modal */}
      <Modal
        visible={showPreview}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <TouchableOpacity
              onPress={() => setShowPreview(false)}
              style={styles.cancelButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Video Preview</Text>
            <TouchableOpacity
              onPress={() => startUpload()}
              style={styles.uploadConfirmButton}
            >
              <Text style={styles.uploadConfirmText}>Upload</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.previewContent}>
            {selectedVideo && (
              <Video
                source={{ uri: selectedVideo.uri }}
                style={styles.previewVideo}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={false}
              />
            )}

            {videoMetadata && (
              <View style={styles.videoInfo}>
                <Text style={styles.videoInfoTitle}>Video Details</Text>
                <View style={styles.videoInfoRow}>
                  <Text style={styles.videoInfoLabel}>Duration:</Text>
                  <Text style={styles.videoInfoValue}>
                    {formatDuration(videoMetadata.duration)}
                  </Text>
                </View>
                <View style={styles.videoInfoRow}>
                  <Text style={styles.videoInfoLabel}>Size:</Text>
                  <Text style={styles.videoInfoValue}>
                    {formatFileSize(videoMetadata.fileSize)}
                  </Text>
                </View>
                <View style={styles.videoInfoRow}>
                  <Text style={styles.videoInfoLabel}>Resolution:</Text>
                  <Text style={styles.videoInfoValue}>
                    {videoMetadata.width} × {videoMetadata.height}
                  </Text>
                </View>
                <View style={styles.videoInfoRow}>
                  <Text style={styles.videoInfoLabel}>Format:</Text>
                  <Text style={styles.videoInfoValue}>
                    {videoMetadata.mimeType}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  uploadButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.5,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 3,
  },
  progressDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cancelButton: {
    padding: 8,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  uploadConfirmButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  uploadConfirmText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  previewContent: {
    flex: 1,
  },
  previewVideo: {
    width: width,
    height: width * (16/9),
    backgroundColor: '#000',
  },
  videoInfo: {
    padding: 16,
  },
  videoInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  videoInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  videoInfoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  videoInfoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
});
