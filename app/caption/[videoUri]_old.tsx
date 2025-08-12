import { Ionicons } from '@expo/vector-icons';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CaptionScreen() {
  // INSTANT LOADING - Get params immediately
  const params = useLocalSearchParams();
  const videoUri = params.videoUri;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  
  console.log('⚡ INSTANT: Caption screen loaded immediately');
  
  // MINIMAL STATE for instant display
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [currentThumbnail, setCurrentThumbnail] = useState<string | undefined>(undefined);
  const [currentThumbnailType, setCurrentThumbnailType] = useState<string | undefined>(undefined);
  const [addingThumbnail, setAddingThumbnail] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  
  // Video ref
  const videoRef = useRef<Video>(null);
  
  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: 'compressing',
    progress: 0,
    message: 'Getting everything ready'
  });

  // Load thumbnail params once
  React.useEffect(() => {
    const thumbnailParams = {
      customThumbnail: params.customThumbnail as string,
      thumbnailType: params.thumbnailType as string,
      thumbnailTimePoint: params.thumbnailTimePoint as string
    };
    
    if (thumbnailParams.customThumbnail) {
      setCurrentThumbnail(thumbnailParams.customThumbnail);
      setCurrentThumbnailType(thumbnailParams.thumbnailType);
    }
  }, []);

  // Handle adding/changing thumbnail
  const handleAddThumbnail = async () => {
    try {
      setAddingThumbnail(true);
      
      // Import LocalThumbnailService dynamically
      const { default: LocalThumbnailService } = await import('../../lib/localThumbnailService');
      
      const newThumbnail = await LocalThumbnailService.pickCustomThumbnail();
      
      if (newThumbnail) {
        setCurrentThumbnail(newThumbnail.uri);
        setCurrentThumbnailType('custom');
        console.log('⚡ New thumbnail selected:', newThumbnail.uri);
      }
    } catch (error) {
      console.error('❌ Failed to add thumbnail:', error);
      Alert.alert('Thumbnail Error', 'Could not add thumbnail. Please try again.');
    } finally {
      setAddingThumbnail(false);
    }
  };

  // Video playback status handler
  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setVideoDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);
    }
  };

  // FAST POST FUNCTION
  const handlePost = async () => {
    if (!videoUri || !user?.uid) {
      Alert.alert('Error', 'Missing video or user information');
      return;
    }

    setUploading(true);
    setShowUploadModal(true);

    try {
      console.log('🎬 Uploading video');

      // Dynamically import Mux service for faster screen loading
      const { default: enhancedMuxService } = await import('../../lib/enhancedMuxService');

      // Upload video with enhanced progress tracking - HIGH QUALITY
      const uploadedVideo = await enhancedMuxService.uploadVideoWithChunks(
        decodeURIComponent(videoUri as string),
        (progress: UploadProgress) => {
          setUploadProgress(progress);
        },
        {
          quality: 'high',
          autoCompress: false,
          generateThumbnails: true,
          adaptiveBitrate: false
        }
      );

      if (!uploadedVideo || !uploadedVideo.assetId) {
        throw new Error('Upload failed - no asset ID returned');
      }

      // Import Firebase functions
      const { doc, setDoc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../../firebaseConfig');

      // Get user profile for username
      let username = 'glint_user';
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          username = userDoc.data().username || 'glint_user';
        }
      } catch (error) {
        console.warn('Could not fetch username, using default');
      }

      // Auto-generate thumbnail if user didn't select one
      let finalThumbnailUrl = currentThumbnail;
      let finalThumbnailType = currentThumbnailType;
      
      if (!currentThumbnail) {
        console.log('🎨 No custom thumbnail selected, auto-generating...');
        
        const { default: thumbnailService } = await import('../../lib/enhancedThumbnailService');
        
        try {
          const autoThumbnail = await thumbnailService.generateAndUploadThumbnail(
            decodeURIComponent(videoUri as string),
            uploadedVideo.assetId,
            { quality: 0.8, time: 1, width: 640, height: 360 }
          );
          
          if (autoThumbnail) {
            finalThumbnailUrl = autoThumbnail;
            finalThumbnailType = 'auto';
            console.log('✅ Auto-thumbnail generated:', autoThumbnail);
          } else {
            finalThumbnailUrl = uploadedVideo.thumbnailUrl || undefined;
            finalThumbnailType = 'auto';
          }
        } catch (thumbnailError) {
          console.error('❌ Auto-thumbnail generation error:', thumbnailError);
          finalThumbnailUrl = uploadedVideo.thumbnailUrl || undefined;
          finalThumbnailType = 'auto';
        }
      }

      // Save video metadata to Firebase database
      const videoDoc = {
        userId: user.uid,
        assetId: uploadedVideo.assetId,
        playbackUrl: uploadedVideo.playbackUrl,
        thumbnailUrl: finalThumbnailUrl,
        thumbnailType: finalThumbnailType,
        createdAt: new Date().toISOString(),
        username: username,
        caption: caption || 'My Video',
        views: 0,
        likes: 0,
        processed: true,
        status: uploadedVideo.status,
        storage: uploadedVideo.storage,
        isRealVideo: true
      };

      await setDoc(doc(db, 'videos', uploadedVideo.assetId), videoDoc);

      // Also create post document for social features
      const postDoc = {
        videoId: uploadedVideo.assetId,
        userId: user.uid,
        username: username,
        caption: caption || videoDoc.caption,
        thumbnailUrl: finalThumbnailUrl,
        playbackUrl: uploadedVideo.playbackUrl,
        createdAt: new Date().toISOString(),
        likes: 0,
        comments: 0,
        views: 0,
        processed: true,
        isRealVideo: true
      };

      await setDoc(doc(db, 'posts', uploadedVideo.assetId), postDoc);

      // Show completion
      setUploadProgress({
        stage: 'complete',
        progress: 100,
        message: finalThumbnailType === 'auto' ? 'Video uploaded with auto-generated thumbnail!' : 'Video uploaded successfully!'
      });

      // Success
      setTimeout(() => {
        setShowUploadModal(false);
        setUploading(false);
        router.replace('/(tabs)/me');
        
        const thumbnailMessage = finalThumbnailType === 'auto' ? 
          '\n\n🎨 Firebase auto-generated a thumbnail for your video!' : 
          '\n\n✅ Your custom thumbnail was saved successfully!';
        Alert.alert('🎉 Success!', `Your video has been uploaded successfully!${thumbnailMessage}`);
      }, 2000);

    } catch (error: any) {
      console.error('❌ Upload error:', error);
      Alert.alert('Upload Failed', `Error: ${error.message}`);
      setUploading(false);
      setShowUploadModal(false);
    }
  };

  const handleBack = () => {
    if (uploading) {
      Alert.alert(
        'Upload in Progress',
        'Are you sure you want to cancel the upload?',
        [
          { text: 'Continue Uploading', style: 'cancel' },
          { text: 'Cancel Upload', style: 'destructive', onPress: () => router.back() }
        ]
      );
    } else {
      router.back();
    }
  };

  // INSTANT SCREEN DISPLAY - Always show immediately
  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ paddingTop: insets.top }}>
        {/* Header - ALWAYS VISIBLE */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Caption</Text>
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

        {/* Video Preview - LOADS IN BACKGROUND */}
        <View style={[styles.videoPreview, { height: screenWidth * 0.6 }]}>
          {/* Always show placeholder while video loads */}
          <View style={styles.videoPlaceholder}>
            <Ionicons name="videocam" size={48} color="#ccc" />
            <Text style={styles.placeholderText}>
              {videoLoading ? 'Loading video...' : 'Video ready'}
            </Text>
          </View>
          
          {/* Video loads in background */}
          {videoUri && (
            <>
              <Video
                ref={videoRef}
                source={{ uri: typeof videoUri === 'string' ? decodeURIComponent(videoUri) : String(videoUri) }}
                style={[styles.video, { opacity: videoLoading ? 0 : 1 }]}
                resizeMode={ResizeMode.COVER}
                shouldPlay={false}
                isLooping={false}
                useNativeControls={false}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                onLoad={() => {
                  console.log('✅ Video loaded quickly');
                  setVideoLoading(false);
                }}
                onError={(error) => {
                  console.error('❌ Video error:', error);
                  setVideoLoading(false);
                }}
              />
              
              {!videoLoading && (
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
                    size={24} 
                    color="#fff" 
                  />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Thumbnail Section */}
        <View style={styles.thumbnailSection}>
          <View style={styles.thumbnailHeader}>
            <Text style={styles.sectionTitle}>Thumbnail</Text>
            <TouchableOpacity
              style={styles.addThumbnailButton}
              onPress={handleAddThumbnail}
              disabled={addingThumbnail}
            >
              {addingThumbnail ? (
                <ActivityIndicator size="small" color="#4ECDC4" />
              ) : (
                <Text style={styles.addThumbnailText}>
                  {currentThumbnail ? 'Change' : 'Add Thumbnail'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          
          {currentThumbnail ? (
            <View style={styles.thumbnailPreview}>
              <Image 
                source={{ uri: currentThumbnail }} 
                style={styles.thumbnailImage}
                resizeMode="cover"
              />
              <Text style={styles.thumbnailHint}>
                {currentThumbnailType === 'custom' ? 'Custom thumbnail' : 'Auto-generated thumbnail'}
              </Text>
            </View>
          ) : (
            <View style={styles.noThumbnailPreview}>
              <Ionicons name="image-outline" size={48} color="#ccc" />
              <Text style={styles.noThumbnailText}>No thumbnail selected</Text>
              <Text style={styles.noThumbnailSubtext}>
                Firebase will auto-generate one when you post
              </Text>
            </View>
          )}
        </View>

        {/* Caption Input */}
        <View style={styles.captionSection}>
          <Text style={styles.sectionTitle}>Write a caption</Text>
          <TextInput
            style={styles.captionInput}
            value={caption}
            onChangeText={setCaption}
            placeholder="What's happening in your video?"
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{caption.length}/500</Text>
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
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#000' },
  postButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  postButtonDisabled: { backgroundColor: '#ccc' },
  postButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  
  videoPreview: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  video: { width: '100%', height: '100%' },
  videoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  loadingText: { color: '#fff', marginTop: 8 },
  playOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 24,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  thumbnailSection: { paddingHorizontal: 16, marginBottom: 20 },
  thumbnailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#000' },
  addThumbnailButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addThumbnailText: { fontSize: 14, color: '#007AFF', fontWeight: '500' },
  
  thumbnailPreview: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  thumbnailImage: { width: 80, height: 45, borderRadius: 8, marginRight: 12 },
  thumbnailHint: { fontSize: 14, color: '#666', flex: 1 },
  
  noThumbnailPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 24,
  },
  noThumbnailText: { fontSize: 16, color: '#666', marginTop: 8 },
  noThumbnailSubtext: { fontSize: 12, color: '#999', marginTop: 4, textAlign: 'center' },
  
  captionSection: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  captionInput: {
    fontSize: 16,
    color: '#000',
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  charCount: { fontSize: 12, color: '#999', textAlign: 'right', marginTop: 8 },
  
  privacySection: { padding: 16 },
  privacyOption: { flexDirection: 'row', alignItems: 'center' },
  privacyText: { fontSize: 16, fontWeight: '500', color: '#000', marginLeft: 12, flex: 1 },
  privacySubtext: { fontSize: 12, color: '#666' },
  
  // New styles for instant loading
  videoPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  placeholderText: { 
    fontSize: 14, 
    color: '#666', 
    marginTop: 8, 
    textAlign: 'center' 
  },
});
