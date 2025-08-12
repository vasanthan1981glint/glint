import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface VideoSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onRecordVideo?: () => void;
  onSelectFromGallery?: () => void;
}

export default function VideoSelectionModal({ visible, onClose, onRecordVideo, onSelectFromGallery }: VideoSelectionModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);

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
      console.log('🎥 Requesting camera permission...');
      
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
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
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

  const selectFromGallery = async () => {
    try {
      setIsLoadingGallery(true); // Show loading immediately
      
      // Call parent function if provided, otherwise use default behavior
      if (onSelectFromGallery) {
        onClose();
        onSelectFromGallery();
        // Reset loading after a brief delay to allow parent processing
        setTimeout(() => setIsLoadingGallery(false), 500);
        return;
      }

      // Default behavior (for backward compatibility)
      console.log('📱 Requesting media library permission...');
      
      // Check if media library is available
      const mediaAvailable = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!mediaAvailable.canAskAgain && mediaAvailable.status !== 'granted') {
        Alert.alert(
          'Photo Library Access Required',
          'Please enable photo library access in your device settings to select videos.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => ImagePicker.requestMediaLibraryPermissionsAsync() }
          ]
        );
        return;
      }

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('📊 Permission status:', permissionResult.status);

      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission Required', 'Permission to access media library is required!');
        return;
      }

      console.log('🎬 Opening video picker...');

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: Platform.OS === 'ios', // Only allow editing on iOS
        quality: Platform.OS === 'android' ? 0.8 : 1, // Better performance on Android
        videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
      });

      if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
        const videoUri = pickerResult.assets[0].uri;
        console.log('✅ Video selected:', videoUri);
        
        // BYPASS old me.tsx flow entirely - go straight to caption screen
        console.log('🚀 BYPASSING thumbnail generation, going direct to caption');
        
        setIsLoadingGallery(true);
        
        setTimeout(() => {
          onClose();
          // Navigate directly to caption page - this bypasses all thumbnail generation
          router.push(`/caption/${encodeURIComponent(videoUri)}`);
          setIsLoadingGallery(false);
        }, 50);
      } else {
        setIsLoadingGallery(false);
      }
    } catch (error: any) {
      console.error('❌ Error selecting video:', error);
      Alert.alert('Selection Error', error.message || 'Failed to select video. Please try again.');
    } finally {
      setIsLoadingGallery(false); // Hide loading
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
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Video</Text>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
              disabled={isLoadingCamera || isLoadingGallery}
            >
              <Ionicons name="close" size={24} color={isLoadingCamera || isLoadingGallery ? "#ccc" : "#000"} />
            </TouchableOpacity>
          </View>

          <View style={styles.options}>
            <TouchableOpacity 
              style={[styles.option, isLoadingCamera && styles.optionDisabled]} 
              onPress={recordVideo}
              disabled={isLoadingCamera || isLoadingGallery}
            >
              <View style={styles.iconContainer}>
                {isLoadingCamera ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={screenWidth > 400 ? 32 : 28} color="#fff" />
                )}
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionText}>
                  {isLoadingCamera ? 'Opening Camera...' : 'Camera'}
                </Text>
                <Text style={styles.optionSubtext}>Record a new video</Text>
              </View>
              {!isLoadingCamera && <Ionicons name="chevron-forward" size={20} color="#ccc" />}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.option, isLoadingGallery && styles.optionDisabled]} 
              onPress={selectFromGallery}
              disabled={isLoadingCamera || isLoadingGallery}
            >
              <View style={[styles.iconContainer, { backgroundColor: '#8E4EC6' }]}>
                {isLoadingGallery ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="image" size={screenWidth > 400 ? 32 : 28} color="#fff" />
                )}
              </View>
              <View style={styles.optionContent}>
                <Text style={styles.optionText}>
                  {isLoadingGallery ? 'Opening Gallery...' : 'Gallery'}
                </Text>
                <Text style={styles.optionSubtext}>Choose from your videos</Text>
              </View>
              {!isLoadingGallery && <Ionicons name="chevron-forward" size={20} color="#ccc" />}
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Global Loading Overlay */}
        {(isLoadingCamera || isLoadingGallery) && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>
                {isLoadingCamera ? 'Opening Camera...' : 'Opening Gallery...'}
              </Text>
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
    paddingBottom: 20,
    maxHeight: screenHeight * 0.6, // Responsive height
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: screenWidth > 400 ? 20 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: screenWidth > 400 ? 20 : 18,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  options: {
    padding: screenWidth > 400 ? 20 : 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: screenWidth > 400 ? 15 : 12,
    paddingHorizontal: screenWidth > 400 ? 16 : 12,
    borderRadius: 12,
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
    minHeight: screenWidth > 400 ? 70 : 60, // Ensure consistent height
  },
  optionDisabled: {
    opacity: 0.6,
    backgroundColor: '#f0f0f0',
  },
  iconContainer: {
    width: screenWidth > 400 ? 50 : 45,
    height: screenWidth > 400 ? 50 : 45,
    borderRadius: screenWidth > 400 ? 25 : 22.5,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  optionContent: {
    flex: 1,
    justifyContent: 'center',
  },
  optionText: {
    fontSize: screenWidth > 400 ? 18 : 16,
    fontWeight: '600',
    color: '#000',
  },
  optionSubtext: {
    fontSize: screenWidth > 400 ? 14 : 12,
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
});
