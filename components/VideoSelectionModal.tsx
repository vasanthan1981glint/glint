import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface VideoSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onRecordVideo?: () => void;
  uploadContext?: string;
}

export default function VideoSelectionModal({ visible, onClose, onRecordVideo, uploadContext }: VideoSelectionModalProps) {
  const router = useRouter();
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);

  const recordVideo = async () => {
    try {
      setIsLoadingCamera(true); // Show loading immediately
      
      // Call parent function if provided, otherwise use default behavior
      if (onRecordVideo) {
        onClose();
        onRecordVideo();
        // Reset loading after a brief delay to allow parent processing
        setTimeout(() => setIsLoadingCamera(false), 500);
        return;
      }

      // Default behavior (for backward compatibility)
      console.log(`🎥 Requesting camera permission for ${uploadContext || 'default'} upload...`);
      
      // Check if camera is available
      const cameraAvailable = await ImagePicker.getCameraPermissionsAsync();
      if (!cameraAvailable.canAskAgain && cameraAvailable.status !== 'granted') {
        Alert.alert(
          'Camera Access Required',
          'Please enable camera access in your device settings to record videos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => ImagePicker.requestCameraPermissionsAsync() }
          ]
        );
        return;
      }

      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to record videos!');
        return;
      }

      console.log('📱 Opening camera...');
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        allowsEditing: Platform.OS === 'ios', // Only allow editing on iOS for better compatibility
        quality: Platform.OS === 'android' ? 0.8 : 1, // Slightly lower quality on Android for performance
        videoMaxDuration: 60,
        videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const videoUri = result.assets[0].uri;
        console.log('✅ Video recorded:', videoUri);
        onClose();
        // Navigate directly to caption page with trim functionality
        router.push(`/caption/${encodeURIComponent(videoUri)}`);
      }
    } catch (error: any) {
      console.error('❌ Error recording video:', error);
      Alert.alert('Recording Error', 'Failed to record video. Please try again.');
    } finally {
      setIsLoadingCamera(false); // Hide loading
    }
  };

  const handleTrendsPress = async () => {
    try {
      console.log('🔥 Opening gallery for Trends upload...');
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access to select videos for Trends.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => ImagePicker.requestMediaLibraryPermissionsAsync() }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: Platform.OS === 'ios',
        quality: 1,
        videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
      });

      if (!result.canceled && result.assets?.[0]) {
        const videoUri = result.assets[0].uri;
        console.log('✅ Video selected for Trends:', videoUri);
        onClose();
        // Navigate to caption screen with Trends context
        router.push(`/caption/${encodeURIComponent(videoUri)}?uploadTab=Trends`);
      }
    } catch (error: any) {
      console.error('❌ Error selecting video for Trends:', error);
      Alert.alert('Selection Error', 'Failed to select video for Trends. Please try again.');
    }
  };

  const handleGalleryPress = async () => {
    try {
      onClose();
      
      // Request permission for media library access
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access to select videos from your gallery.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => ImagePicker.requestMediaLibraryPermissionsAsync() }
          ]
        );
        return;
      }

      console.log(`📱 Opening gallery for video selection (${uploadContext || 'default'} upload)...`);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const videoUri = result.assets[0].uri;
        console.log('✅ Video selected from gallery:', videoUri);
        
        // Navigate to caption page with upload context
        if (uploadContext) {
          router.push({
            pathname: `/caption/${encodeURIComponent(videoUri)}` as any,
            params: { context: uploadContext }
          });
        } else {
          router.push(`/caption/${encodeURIComponent(videoUri)}` as any);
        }
      }
    } catch (error: any) {
      console.error('❌ Error selecting video from gallery:', error);
      Alert.alert('Selection Error', 'Failed to select video from gallery. Please try again.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {uploadContext ? `Create for ${uploadContext}` : 'Create'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          
          {uploadContext && (
            <View style={styles.contextIndicator}>
              <Ionicons 
                name={uploadContext === 'Trends' ? 'trending-up' : uploadContext === 'Glints' ? 'sparkles' : 'bookmark'} 
                size={16} 
                color="#007AFF" 
              />
              <Text style={styles.contextText}>
                Uploading to {uploadContext} tab
              </Text>
            </View>
          )}
          
          <View style={styles.options}>
            <View style={styles.regularOptionsRow}>
              <TouchableOpacity 
                style={[styles.option, isLoadingCamera && styles.optionDisabled]} 
                onPress={recordVideo}
                disabled={isLoadingCamera}
              >
                <View style={styles.iconContainer}>
                  {isLoadingCamera ? (
                    <ActivityIndicator size="small" color="#1DA1F2" />
                  ) : (
                    <Ionicons name="camera" size={24} color="#1DA1F2" />
                  )}
                </View>
                <Text style={styles.optionText}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.option} 
                onPress={handleGalleryPress}
              >
                <View style={styles.iconContainer}>
                  <Ionicons name="images" size={24} color="#1DA1F2" />
                </View>
                <Text style={styles.optionText}>Gallery</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.trendsOption} 
              onPress={handleTrendsPress}
            >
              <View style={styles.trendsIconContainer}>
                <Ionicons name="trending-up" size={24} color="#fff" />
              </View>
              <Text style={styles.trendsOptionText}>Upload to Trends</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Global Loading Overlay */}
        {isLoadingCamera && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Opening Camera...</Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: screenHeight * 0.4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  options: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  regularOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  optionDisabled: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  optionSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
  },
  contextIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 8,
    gap: 8,
  },
  contextText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  trendsOption: {
    backgroundColor: '#FF4500',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 20,
    marginHorizontal: 4,
    marginTop: 8,
    shadowColor: '#FF4500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  trendsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  trendsOptionText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
});
