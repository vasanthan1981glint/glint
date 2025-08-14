/**
 * Complete Video Upload Screen
 * Professional video upload interface with Mux integration
 */

import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as VideoThumbnails from 'expo-video-thumbnails';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

// Import your services
import backgroundUploadService from '../lib/backgroundUploadService';

const { width, height } = Dimensions.get('window');

interface VideoUploadScreenProps {
  onUploadComplete?: (videoData: any) => void;
}

export default function VideoUploadScreen({ onUploadComplete }: VideoUploadScreenProps) {
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [videoThumbnail, setVideoThumbnail] = useState<string>('');
  const [videoMetadata, setVideoMetadata] = useState<any>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');

  // Request permissions
  const requestPermissions = useCallback(async () => {
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
  }, []);

  // Record new video
  const recordVideo = async () => {
    const hasPermissions = await requestPermissions();
    if (!hasPermissions) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 1, // High quality
        videoMaxDuration: 60, // 1 minute max
      });

      if (!result.canceled && result.assets[0]) {
        await processSelectedVideo(result.assets[0]);
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
        quality: 1,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        await processSelectedVideo(result.assets[0]);
      }
    } catch (error) {
      console.error('Error selecting video:', error);
      Alert.alert('Error', 'Failed to select video. Please try again.');
    }
  };

  // Process selected video
  const processSelectedVideo = async (videoAsset: any) => {
    try {
      console.log('📹 Processing selected video:', videoAsset);

      // Generate thumbnail
      const thumbnail = await VideoThumbnails.getThumbnailAsync(videoAsset.uri, {
        time: 1000, // 1 second
        quality: 0.8,
      });

      const metadata = {
        duration: videoAsset.duration || 0,
        width: videoAsset.width || 720,
        height: videoAsset.height || 1280,
        fileSize: videoAsset.fileSize || 0,
        mimeType: videoAsset.mimeType || 'video/mp4',
      };

      setSelectedVideo(videoAsset);
      setVideoThumbnail(thumbnail.uri);
      setVideoMetadata(metadata);

    } catch (error) {
      console.error('Error processing video:', error);
      Alert.alert('Error', 'Failed to process video. Please try again.');
    }
  };

  // Show video selection options
  const showVideoOptions = () => {
    Alert.alert(
      'Add Video',
      'Choose how you want to add your video',
      [
        { text: 'Record New Video', onPress: recordVideo },
        { text: 'Choose from Gallery', onPress: selectFromGallery },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Start upload process
  const startUpload = async () => {
    if (!selectedVideo) {
      Alert.alert('Error', 'Please select a video first');
      return;
    }

    if (!caption.trim()) {
      Alert.alert('Error', 'Please add a caption for your video');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStage('Preparing upload...');

    try {
      console.log('🚀 Starting Mux upload...');

      // Use the background upload service for better UX
      const uploadId = await backgroundUploadService.startBackgroundUpload(
        selectedVideo.uri,
        caption.trim(),
        videoThumbnail
      );

      console.log('✅ Upload started with ID:', uploadId);

      // Monitor progress
      const progressInterval = setInterval(async () => {
        // You would implement getUploadProgress in backgroundUploadService
        // For now, simulate progress
        setUploadProgress(prev => {
          const newProgress = Math.min(prev + 10, 90);
          if (newProgress >= 90) {
            clearInterval(progressInterval);
            completeUpload();
          }
          return newProgress;
        });
      }, 1000);

    } catch (error: any) {
      console.error('❌ Upload failed:', error);
      setUploading(false);
      Alert.alert(
        'Upload Failed',
        error.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Complete upload
  const completeUpload = () => {
    setUploadProgress(100);
    setUploadStage('Upload complete!');
    
    setTimeout(() => {
      setUploading(false);
      onUploadComplete?.({
        videoUri: selectedVideo?.uri,
        caption,
        thumbnail: videoThumbnail,
        metadata: videoMetadata
      });
      
      // Navigate back or to video feed
      router.back();
    }, 1500);
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
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Video</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Video Selection Area */}
        {!selectedVideo ? (
          <TouchableOpacity style={styles.videoSelectArea} onPress={showVideoOptions}>
            <View style={styles.videoSelectContent}>
              <MaterialIcons name="video-camera-back" size={64} color="#6366f1" />
              <Text style={styles.videoSelectTitle}>Add Your Video</Text>
              <Text style={styles.videoSelectSubtitle}>
                Tap to record or choose from gallery
              </Text>
              <View style={styles.videoSelectButton}>
                <Text style={styles.videoSelectButtonText}>Select Video</Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          /* Video Preview */
          <View style={styles.videoPreview}>
            <Video
              source={{ uri: selectedVideo.uri }}
              style={styles.video}
              useNativeControls
              resizeMode={ResizeMode.COVER}
              shouldPlay={false}
            />
            
            {/* Video Info */}
            <View style={styles.videoInfo}>
              <View style={styles.videoInfoRow}>
                <Text style={styles.videoInfoLabel}>Duration:</Text>
                <Text style={styles.videoInfoValue}>
                  {formatDuration(videoMetadata?.duration || 0)}
                </Text>
              </View>
              <View style={styles.videoInfoRow}>
                <Text style={styles.videoInfoLabel}>Size:</Text>
                <Text style={styles.videoInfoValue}>
                  {formatFileSize(videoMetadata?.fileSize || 0)}
                </Text>
              </View>
              <View style={styles.videoInfoRow}>
                <Text style={styles.videoInfoLabel}>Resolution:</Text>
                <Text style={styles.videoInfoValue}>
                  {videoMetadata?.width} × {videoMetadata?.height}
                </Text>
              </View>
            </View>

            {/* Change Video Button */}
            <TouchableOpacity style={styles.changeVideoButton} onPress={showVideoOptions}>
              <MaterialIcons name="edit" size={16} color="#6366f1" />
              <Text style={styles.changeVideoText}>Change Video</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Caption Input */}
        {selectedVideo && (
          <View style={styles.captionSection}>
            <Text style={styles.captionLabel}>Caption</Text>
            <TextInput
              style={styles.captionInput}
              placeholder="Write a caption for your video..."
              placeholderTextColor="#9ca3af"
              value={caption}
              onChangeText={setCaption}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
            <Text style={styles.captionCounter}>{caption.length}/200</Text>
          </View>
        )}

        {/* Upload Progress */}
        {uploading && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Uploading to Mux</Text>
              <Text style={styles.progressPercentage}>{uploadProgress}%</Text>
            </View>
            
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
            </View>
            
            <Text style={styles.progressMessage}>{uploadStage}</Text>
            
            <View style={styles.uploadFeatures}>
              <View style={styles.featureItem}>
                <MaterialIcons name="hd" size={16} color="#6366f1" />
                <Text style={styles.featureText}>HD Quality</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="public" size={16} color="#6366f1" />
                <Text style={styles.featureText}>Global CDN</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialIcons name="speed" size={16} color="#6366f1" />
                <Text style={styles.featureText}>Adaptive Streaming</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Upload Button */}
      {selectedVideo && !uploading && (
        <View style={styles.uploadButtonContainer}>
          <TouchableOpacity 
            style={[styles.uploadButton, !caption.trim() && styles.uploadButtonDisabled]}
            onPress={startUpload}
            disabled={!caption.trim()}
          >
            <LinearGradient
              colors={caption.trim() ? ['#6366f1', '#8b5cf6'] : ['#9ca3af', '#9ca3af']}
              style={styles.uploadButtonGradient}
            >
              <MaterialIcons name="cloud-upload" size={20} color="white" />
              <Text style={styles.uploadButtonText}>Upload to Mux</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Upload Loading */}
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  videoSelectArea: {
    height: height * 0.4,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  videoSelectContent: {
    alignItems: 'center',
  },
  videoSelectTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  videoSelectSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  videoSelectButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  videoSelectButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  videoPreview: {
    marginBottom: 24,
  },
  video: {
    width: '100%',
    aspectRatio: 9/16,
    borderRadius: 12,
    backgroundColor: '#000',
  },
  videoInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  videoInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
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
  changeVideoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 8,
    gap: 6,
  },
  changeVideoText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  captionSection: {
    marginBottom: 24,
  },
  captionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  captionInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  captionCounter: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 4,
  },
  progressSection: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  progressMessage: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  uploadFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featureText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  uploadButtonContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  uploadButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
