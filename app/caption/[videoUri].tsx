import { Ionicons } from '@expo/vector-icons';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlintUploadModal, UploadProgress } from '../../components/GlintUploadModal';
import { useAuth } from '../../contexts/AuthContext';
import LocalThumbnailService, { GeneratedThumbnail } from '../../lib/localThumbnailService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CaptionScreen() {
  const { videoUri, context, uploadTab } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const videoRef = useRef<Video>(null);
  
  // Get custom thumbnail from URL params if available
  const customThumbnail = useLocalSearchParams().customThumbnail as string;
  
  // Upload context from profile tab (Glints, Trends, Saved) or from upload screen
  const uploadContext = (uploadTab || context) as string;
  
  // Video state
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: 'compressing',
    progress: 0,
    message: 'Getting everything ready'
  });
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expandedCaption, setExpandedCaption] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(true); // Add immediate loading state
  
  // Thumbnail functionality
  const [selectedThumbnail, setSelectedThumbnail] = useState<GeneratedThumbnail | null>(null);
  const [autoThumbnail, setAutoThumbnail] = useState<GeneratedThumbnail | null>(null);

  // Auto-hide loading after maximum time to prevent infinite loading
  useEffect(() => {
    const maxLoadingTime = setTimeout(() => {
      console.log('🕒 Auto-hiding loading screen after maximum wait time');
      setIsLoadingVideo(false);
    }, 500); // Reduced to 500ms maximum loading time for ultra-fast experience

    // Also hide loading immediately if video is ready super fast
    const quickHide = setTimeout(() => {
      if (videoDuration > 0) {
        console.log('⚡ Video loaded super fast, hiding loading immediately');
        setIsLoadingVideo(false);
      }
    }, 100); // Check after 100ms if video is already loaded

    return () => {
      clearTimeout(maxLoadingTime);
      clearTimeout(quickHide);
    };
  }, [videoDuration]);

  // Auto-generate thumbnail when video is ready
  useEffect(() => {
    if (videoDuration > 0 && videoUri && !autoThumbnail) {
      generateAutoThumbnail();
    }
  }, [videoDuration, videoUri]);

  // Generate auto-thumbnail for Firebase
  const generateAutoThumbnail = async () => {
    try {
      console.log('🖼️ Generating auto-thumbnail for video...');
      
      const thumbnails = await LocalThumbnailService.generateAutoThumbnails(
        decodeURIComponent(videoUri as string),
        { 
          quality: 0.7,
          timePoints: [0.5] // Generate at 50% of video 
        }
      );
      
      if (thumbnails.length > 0) {
        const autoThumb = thumbnails[0];
        setAutoThumbnail(autoThumb);
        console.log('✅ Auto-thumbnail generated:', autoThumb.uri);
      }
    } catch (error) {
      console.warn('⚠️ Auto-thumbnail generation failed:', error);
      // Create a fallback placeholder
      setAutoThumbnail({
        uri: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="0 0 160 90"><rect width="160" height="90" fill="#4ECDC4"/><text x="80" y="45" text-anchor="middle" dy="0.3em" fill="white" font-family="Arial" font-size="12">Auto</text></svg>',
        timePoint: 0.5,
        isCustom: false,
        timestamp: Date.now()
      });
    }
  };

  // Handle adding custom thumbnail from gallery
  const handleAddThumbnail = async () => {
    try {
      // Request permission to access media library
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('Permission Required', 'Please allow access to your photo library to select a thumbnail.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9], // Video thumbnail aspect ratio
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const selectedImage = result.assets[0];
        
        // Create a GeneratedThumbnail object from the selected image
        const customThumbnail: GeneratedThumbnail = {
          uri: selectedImage.uri,
          timePoint: 0, // Not applicable for custom images
          isCustom: true,
          timestamp: Date.now()
        };

        setSelectedThumbnail(customThumbnail);
        console.log('✅ Custom thumbnail selected:', selectedImage.uri);
      }
    } catch (error) {
      console.error('❌ Error selecting thumbnail:', error);
      Alert.alert('Error', 'Failed to select thumbnail. Please try again.');
    }
  };

  // Video playback status handler
  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setVideoDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);
      // Hide loading state when video is ready
      if (isLoadingVideo) {
        setIsLoadingVideo(false);
      }
    }
  };

  // Format time in mm:ss
  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePost = async () => {
    if (!videoUri || !user?.uid) {
      Alert.alert('Error', 'Missing video or user information');
      return;
    }

    setUploading(true);

    try {
      console.log('🚀 CAPTION SCREEN: Starting YouTube-style background upload...');
      console.log('📱 Video URI:', videoUri);
      console.log('👤 User ID:', user?.uid);
      console.log('📝 Caption:', caption || 'My Video');
      console.log('📸 Selected thumbnail:', selectedThumbnail);
      console.log('🎯 Custom thumbnail URI:', selectedThumbnail?.isCustom ? selectedThumbnail.uri : 'none');
      console.log('📂 Upload context:', uploadContext || 'default');
      
      // Import and start background upload service
      console.log('📦 Importing background upload service...');
      const backgroundUploadModule = await import('../../lib/backgroundUploadService');
      const backgroundUploadService = backgroundUploadModule.default;
      
      console.log('✅ Background upload service imported successfully');
      
      const uploadId = await backgroundUploadService.startBackgroundUpload(
        decodeURIComponent(videoUri as string),
        caption || 'My Video',
        selectedThumbnail?.isCustom ? selectedThumbnail.uri : undefined,
        uploadContext as 'Glints' | 'Trends'
      );

      console.log('✅ CAPTION SCREEN: Background upload started successfully:', uploadId);
      console.log('🎯 Upload ID generated:', uploadId);
      
      // Show immediate success feedback with context
      const contextMessage = uploadContext ? ` to ${uploadContext}` : '';
      Alert.alert(
        '🎉 Upload Started!', 
        `Your video is uploading${contextMessage} in the background. You can continue using the app!`,
        [{ text: 'Great!', style: 'default' }]
      );
      
      // Navigation happens inside backgroundUploadService.startBackgroundUpload
      // No need to block here - user can continue using the app

    } catch (error: any) {
      console.error('❌ CAPTION SCREEN: Background upload start failed:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      
      Alert.alert(
        'Upload Failed', 
        `Error: ${error.message}\n\nPlease try again or contact support.`,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setUploading(false);
    }
  };

  const handleBack = () => {
    // Navigate back to me.tsx instead of going back to previous screen
    router.push('/(tabs)/me');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Ultra-fast loading overlay for video processing */}
      {isLoadingVideo && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingTitle}>Almost Ready...</Text>
            <Text style={styles.loadingSubtitle}>
              Loading your video ⚡
            </Text>
          </View>
        </View>
      )}
      
      <ScrollView contentContainerStyle={{ paddingTop: insets.top }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Add Caption</Text>
            {uploadContext && (
              <Text style={styles.uploadContext}>
                Uploading to {uploadContext}
              </Text>
            )}
          </View>
          <TouchableOpacity 
            onPress={handlePost}
            style={[styles.postButton, uploading && styles.postButtonDisabled]}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Video Preview */}
        <View style={[styles.videoPreview, { height: screenWidth * 0.6 }]}>
          {videoUri && (
            <Video
              ref={videoRef}
              source={{ uri: decodeURIComponent(videoUri as string) }}
              style={styles.video}
              resizeMode={ResizeMode.COVER}
              shouldPlay={isPlaying}
              isLooping={false}
              useNativeControls={false}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              onError={(error) => {
                console.error('Video preview error:', error);
              }}
            />
          )}
          <TouchableOpacity 
            style={styles.playOverlay}
            onPress={() => {
              if (videoRef.current) {
                if (isPlaying) {
                  videoRef.current.pauseAsync();
                } else {
                  videoRef.current.playAsync();
                }
              }
            }}
          >
            <Ionicons 
              name={isPlaying ? "pause" : "play"} 
              size={screenWidth > 400 ? 24 : 20} 
              color="#fff" 
            />
          </TouchableOpacity>
        </View>

        {/* Enhanced Caption Input */}
        <View style={styles.captionSection}>
          <View style={styles.captionHeader}>
            <Text style={styles.sectionTitle}>Write a caption</Text>
            <Text style={styles.charCount}>{caption.length}/500</Text>
          </View>
          
          <TextInput
            style={[
              styles.captionInput,
              caption.length > 100 && styles.captionInputExpanded
            ]}
            value={caption}
            onChangeText={setCaption}
            placeholder="What's happening in your video? Share your story..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            scrollEnabled={false}
            textAlignVertical="top"
          />
          
          {caption.length > 100 && (
            <TouchableOpacity
              style={styles.readMoreButton}
              onPress={() => setExpandedCaption(!expandedCaption)}
            >
              <Text style={styles.readMoreText}>
                {expandedCaption ? 'Show less' : 'Read more'}
              </Text>
            </TouchableOpacity>
          )}
          
          <View style={styles.captionPreview}>
            <Text style={styles.previewLabel}>Preview:</Text>
            <Text 
              style={styles.previewText} 
              numberOfLines={expandedCaption ? undefined : 2}
            >
              {caption || "Your caption will appear here..."}
            </Text>
          </View>
        </View>
        {/* Hashtag Suggestions */}
        <View style={styles.hashtagSection}>
          <Text style={styles.sectionTitle}>Suggested hashtags</Text>
          <View style={styles.hashtagContainer}>
            {['#video', '#glint', '#creative', '#viral', '#trending'].map((tag) => (
              <TouchableOpacity
                key={tag}
                style={styles.hashtag}
                onPress={() => setCaption(prev => prev + ' ' + tag)}
              >
                <Text style={styles.hashtagText}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Thumbnail Selection */}
        <View style={styles.thumbnailSection}>
          <View style={styles.thumbnailHeader}>
            <Text style={styles.sectionTitle}>🖼️ Video Thumbnail</Text>
            <TouchableOpacity 
              style={styles.thumbnailSelectButton}
              onPress={handleAddThumbnail}
            >
              <Text style={styles.thumbnailSelectText}>Add</Text>
            </TouchableOpacity>
          </View>
          
          {/* Thumbnail Preview */}
          <View style={styles.thumbnailPreview}>
            {(selectedThumbnail || autoThumbnail) ? (
              <Image 
                source={{ uri: (selectedThumbnail || autoThumbnail)?.uri }} 
                style={styles.thumbnailImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Text style={styles.thumbnailPlaceholderText}>Auto thumbnail will be generated</Text>
              </View>
            )}
          </View>
          
          {selectedThumbnail && (
            <Text style={styles.thumbnailStatus}>✅ Custom image selected</Text>
          )}
          {!selectedThumbnail && autoThumbnail && (
            <Text style={styles.thumbnailStatus}>🤖 Auto-generated thumbnail</Text>
          )}
        </View>

        {/* Privacy Settings */}
        <View style={styles.privacySection}>
          <View style={styles.privacyOption}>
            <Ionicons name="globe-outline" size={20} color="#666" />
            <Text style={styles.privacyText}>Public</Text>
            <Text style={styles.privacySubtext}>Everyone can see this video</Text>
          </View>
        </View>
      </ScrollView>

      {/* Upload Progress Modal */}
      <GlintUploadModal
        visible={showUploadModal}
        progress={uploadProgress}
        onClose={() => setShowUploadModal(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: screenWidth > 400 ? 18 : 16,
    fontWeight: '600',
    color: '#000',
  },
  postButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: screenWidth > 400 ? 20 : 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: screenWidth > 400 ? 70 : 60,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#ccc',
  },
  postButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: screenWidth > 400 ? 16 : 14,
  },
  videoPreview: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
    minHeight: 200, // Ensure minimum height
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: screenWidth > 400 ? 16 : 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  captionInput: {
    fontSize: screenWidth > 400 ? 16 : 14,
    color: '#000',
    minHeight: screenWidth > 400 ? 100 : 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
  },
  hashtagSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  hashtagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hashtag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: screenWidth > 400 ? 12 : 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  hashtagText: {
    fontSize: screenWidth > 400 ? 14 : 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  privacySection: {
    padding: 16,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyText: {
    fontSize: screenWidth > 400 ? 16 : 14,
    fontWeight: '500',
    color: '#000',
    marginLeft: 12,
    flex: 1,
  },
  privacySubtext: {
    fontSize: screenWidth > 400 ? 12 : 10,
    color: '#666',
  },
  // Trim controls styles
  trimSection: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  trimTitle: {
    fontSize: screenWidth > 400 ? 16 : 14,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  // Video info button
  infoButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Enhanced caption styles
  captionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  captionInputExpanded: {
    minHeight: 120,
  },
  readMoreButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  readMoreText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  captionPreview: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  previewLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 8,
  },
  previewText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  // Thumbnail styles
  thumbnailSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  thumbnailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  thumbnailSelectButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  thumbnailSelectText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  thumbnailPreview: {
    alignItems: 'center',
    marginBottom: 8,
  },
  thumbnailImage: {
    width: 120,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  thumbnailPlaceholder: {
    width: 120,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  thumbnailPlaceholderText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  thumbnailStatus: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Loading overlay styles
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContent: {
    alignItems: 'center',
    padding: 32,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  uploadContext: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 2,
  },
});
