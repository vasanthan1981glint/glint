import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, increment, query, setDoc, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnalyticsDashboard from '../../components/AnalyticsDashboard';
import CustomThumbnailPicker from '../../components/CustomThumbnailPicker';
import EnhancedVideoGrid from '../../components/EnhancedVideoGrid';
import { GlintUploadModal, UploadProgress } from '../../components/GlintUploadModal';
import SavedVideosGrid from '../../components/SavedVideosGrid';
import VideoSelectionModal from '../../components/VideoSelectionModal';
import { useAuth } from '../../contexts/AuthContext';
import { auth, db } from '../../firebaseConfig';
import { followService } from '../../lib/followService';
import { useFollowActions, useFollowState } from '../../lib/followStore';
import { useUserStore } from '../../lib/userStore';
import { formatCount } from '../../utils/formatUtils';

const screenWidth = Dimensions.get('window').width;

function MyProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const videoGridRef = useRef<any>(null);

  // Extract and stabilize user ID
  const currentUserId = user?.uid;

  // Check if viewing another user's profile
  const viewingUserId = params.userId as string;
  const isOwnProfile = !viewingUserId || viewingUserId === currentUserId;
  
  // Use a stable profileUserId value
  const profileUserId = viewingUserId || currentUserId || '';

  // Use global follow state for consistency
  const shouldUseFollowState = !isOwnProfile && profileUserId && currentUserId && profileUserId !== currentUserId;
  const { isFollowing, isLoading: followLoading } = useFollowState(shouldUseFollowState ? profileUserId : '');
  const { toggleFollow } = useFollowActions();

  const [username, setUsername] = useState('glint_user');
  const [bio, setBio] = useState('Welcome to Glint ✨');
  const [avatar, setAvatar] = useState('https://via.placeholder.com/150');
  const [glints, setGlints] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isPrivate, setIsPrivate] = useState(false);
  const [activeTab, setActiveTab] = useState<'Glints' | 'Picks' | 'Analytics' | 'Saved'>('Glints');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showVideoSelection, setShowVideoSelection] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [videoRefreshTrigger, setVideoRefreshTrigger] = useState(0);
  const [currentUploadProgress, setCurrentUploadProgress] = useState<UploadProgress>({
    progress: 0,
    stage: 'compressing',
    message: 'Preparing upload...'
  });
  const [pendingVideoUri, setPendingVideoUri] = useState<string | null>(null);
  const [showThumbnailSelector, setShowThumbnailSelector] = useState(false);
  const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(null);
  const [videoCaption, setVideoCaption] = useState('');
  const [processingVideo, setProcessingVideo] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    console.log('☁️ Google Cloud Storage video upload system enabled');
  }, []);

  // Fetch profile data and update states
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user || !profileUserId || !currentUserId) return;

      const targetUserId = profileUserId;

      console.log('👤 Current user ID:', currentUserId);
      console.log('🔍 Viewing profile of:', targetUserId);
      console.log('🏠 Is own profile:', isOwnProfile);

      try {
        // Fetch the target user's profile
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        if (userDoc.exists()) {
          const data = userDoc.data();

          const avatarUrl = data.photo || 'https://via.placeholder.com/150';
          const usernameValue = data.username || 'glint_user';
          const bioValue = data.bio || 'Welcome to Glint ✨';

          setUsername(usernameValue);
          setBio(bioValue);
          setAvatar(avatarUrl);
          setIsPrivate(data.private || false);

          // Get real-time follow stats using the follow service
          if (targetUserId) {
            try {
              const stats = await followService.getUserFollowStats(targetUserId, currentUserId);
              setFollowers(stats.followersCount);
              setFollowing(stats.followingCount);
              console.log('📊 Updated follow stats:', stats);
            } catch (error) {
              console.error('❌ Error getting follow stats:', error);
              // Fallback to cached values
              setFollowers(data.followers || 0);
              setFollowing(data.following || 0);
            }
          }

          // Count user's videos for accurate glint count
          const videosQuery = query(
            collection(db, 'videos'),
            where('userId', '==', targetUserId)
          );
          const videosSnapshot = await getDocs(videosQuery);
          setGlints(videosSnapshot.size);

          // If viewing own profile, update global state
          if (isOwnProfile) {
            const { setAvatar: setGlobalAvatar, setUsername: setGlobalUsername, setBio: setGlobalBio } =
              useUserStore.getState();

            setGlobalUsername(usernameValue);
            setGlobalBio(bioValue);
            setGlobalAvatar(avatarUrl);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, [profileUserId, currentUserId, user, isOwnProfile]);

  // Handle follow/unfollow using global store
  const handleFollowToggle = async () => {
    if (!currentUserId || !profileUserId || followLoading) return;
    
    try {
      const success = await toggleFollow(currentUserId, profileUserId);
      
      if (success) {
        // Refresh follow stats from server
        try {
          const stats = await followService.getUserFollowStats(profileUserId, currentUserId);
          setFollowers(stats.followersCount);
          console.log('✅ Follow stats refreshed after toggle:', stats);
        } catch (error) {
          console.warn('⚠️ Could not refresh follow stats:', error);
          // Optimistic update as fallback
          if (isFollowing) {
            setFollowers(prev => prev - 1);
          } else {
            setFollowers(prev => prev + 1);
          }
        }
        console.log('✅ Follow toggle successful');
      } else {
        console.warn('⚠️ Follow toggle failed');
        Alert.alert('Error', 'Failed to update follow status. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Error in follow toggle:', error);
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    }
  };

  // Enhanced video picker with Glint-style upload
  const pickVideo = async () => {
    if (uploading) return; // Prevent multiple uploads
    setShowVideoSelection(true);
  };

  // Handle thumbnail selection
  const handleThumbnailSelected = (thumbnail: string) => {
    setSelectedThumbnail(thumbnail);
    console.log('📸 Thumbnail selected:', thumbnail);
  };

  // Handle caption change
  const handleCaptionChange = (caption: string) => {
    setVideoCaption(caption);
    console.log('📝 Caption updated:', caption);
  };

  // Proceed with video upload after thumbnail selection
  const proceedWithUpload = async () => {
    if (uploading) {
      console.log('⚠️ Upload already in progress, ignoring proceed request');
      return;
    }
    
    if (!pendingVideoUri || !selectedThumbnail) {
      Alert.alert('Error', 'Please select a thumbnail before proceeding.');
      return;
    }

    if (!videoCaption.trim()) {
      Alert.alert('Error', 'Please add a caption for your video.');
      return;
    }

    try {
      setUploading(true);
      setShowThumbnailSelector(false);
      
      console.log('📤 Starting Google Cloud Storage upload process...');
      
      // Upload to Google Cloud Storage via Railway backend
      await uploadVideoToMux(pendingVideoUri, {
        caption: videoCaption,
        thumbnailUri: selectedThumbnail
      });
      
      // Clear pending states
      setPendingVideoUri(null);
      setSelectedThumbnail(null);
      setVideoCaption('');
      setShowThumbnailSelector(false);
      setUploading(false);
      
    } catch (error) {
      console.error('❌ Upload failed:', error);
      setUploading(false);
      Alert.alert('Upload Failed', 'Failed to upload video. Please try again.');
    }
  };

  // Cancel thumbnail selection
  const cancelThumbnailSelection = () => {
    setShowThumbnailSelector(false);
    setPendingVideoUri(null);
    setSelectedThumbnail(null);
    setVideoCaption('');
    setProcessingVideo(false);
  };

  const recordVideo = async () => {
    try {
      console.log('Requesting camera permission...');
      
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission required', 'Camera permission is required to record videos!');
        return;
      }

      console.log('Opening camera...');
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 60,
        videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
      });

      if (!result.canceled) {
        const videoUri = result.assets[0].uri;
        console.log('Video recorded:', videoUri);
        
        setProcessingVideo(true);
        setShowVideoSelection(false);
        
        setTimeout(() => {
          setPendingVideoUri(videoUri);
          setProcessingVideo(false);
          setShowThumbnailSelector(true);
        }, 1500);
      }
    } catch (error) {
      console.error('Error recording video:', error);
      Alert.alert('Error', 'Failed to record video.');
      setProcessingVideo(false);
    }
  };

  const selectFromGallery = async () => {
    try {
      console.log('📱 Requesting media library permission...');
      
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('📊 Permission status:', permissionResult.status);

      if (permissionResult.status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access media library is required!');
        return;
      }

      console.log('🎬 Opening video picker...');

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 60,
        videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
      });

      if (pickerResult.canceled) {
        console.log('Video selection was cancelled.');
        return;
      }

      const videoUri = pickerResult.assets[0].uri;
      console.log('✅ Video selected:', videoUri);
      
      setProcessingVideo(true);
      setShowVideoSelection(false);
      
      setTimeout(() => {
        setPendingVideoUri(videoUri);
        setProcessingVideo(false);
        setShowThumbnailSelector(true);
      }, 1000);
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video.');
      setProcessingVideo(false);
    }
  };

  // Google Cloud Storage upload function using Railway backend
  const uploadVideoToMux = async (videoUri: string, editParams?: any) => {
    const uploadId = `gcs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('☁️ Google Cloud Storage upload started with ID:', uploadId);
    
    try {
      setShowUploadModal(true);
      
      setCurrentUploadProgress({
        progress: 10,
        stage: 'uploading',
        message: 'Preparing your video for upload...'
      });

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('❌ Authentication required');
      }

      setCurrentUploadProgress({
        progress: 20,
        stage: 'uploading',
        message: 'Getting signed upload URL...'
      });

      // Get signed upload URL from Railway backend
      const signedUrlResponse = await fetch('https://glint-production-f754.up.railway.app/upload/signed-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: `video_${Date.now()}.mp4`,
          contentType: 'video/mp4',
          userId: currentUser.uid
        }),
      });

      if (!signedUrlResponse.ok) {
        throw new Error(`Failed to get upload URL: ${signedUrlResponse.statusText}`);
      }

      const { uploadUrl, videoUrl, fileName } = await signedUrlResponse.json();
      console.log('✅ Got signed upload URL:', { uploadUrl, videoUrl, fileName });

      setCurrentUploadProgress({
        progress: 40,
        stage: 'uploading',
        message: 'Uploading to Google Cloud Storage...'
      });

      // Upload video to Google Cloud Storage using signed URL
      const videoBlob = await fetch(videoUri).then(r => r.blob());
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: videoBlob,
        headers: {
          'Content-Type': 'video/mp4',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload to Google Cloud failed: ${uploadResponse.statusText}`);
      }

      console.log('✅ Video uploaded to Google Cloud Storage successfully');

      setCurrentUploadProgress({
        progress: 70,
        stage: 'processing',
        message: 'Processing video metadata...'
      });

      // Upload thumbnail if custom one is provided
      let thumbnailUrl = '';
      if (editParams?.thumbnailUri && !editParams.thumbnailUri.startsWith('placeholder:')) {
        try {
          const thumbnailSignedUrlResponse = await fetch('https://glint-production-f754.up.railway.app/upload/signed-url', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileName: `thumbnail_${Date.now()}.jpg`,
              contentType: 'image/jpeg',
              userId: currentUser.uid
            }),
          });

          if (thumbnailSignedUrlResponse.ok) {
            const { uploadUrl: thumbUploadUrl, videoUrl: thumbVideoUrl } = await thumbnailSignedUrlResponse.json();
            
            const thumbnailBlob = await fetch(editParams.thumbnailUri).then(r => r.blob());
            const thumbUploadResponse = await fetch(thumbUploadUrl, {
              method: 'PUT',
              body: thumbnailBlob,
              headers: {
                'Content-Type': 'image/jpeg',
              },
            });

            if (thumbUploadResponse.ok) {
              thumbnailUrl = thumbVideoUrl;
              console.log('✅ Thumbnail uploaded:', thumbnailUrl);
            }
          }
        } catch (error) {
          console.warn('⚠️ Failed to upload thumbnail:', error);
        }
      }

      setCurrentUploadProgress({
        progress: 90,
        stage: 'processing',
        message: 'Saving video metadata...'
      });

      // Create video document with Google Cloud Storage data
      const videoDoc = {
        userId: currentUser.uid,
        id: uploadId,
        videoUrl: videoUrl,
        playbackUrl: videoUrl,
        thumbnailUrl: thumbnailUrl || `https://via.placeholder.com/300x200.png?text=Video+Thumbnail`,
        fileName: fileName,
        createdAt: new Date().toISOString(),
        username: username || currentUser.email?.split('@')[0] || 'user',
        caption: editParams?.caption || 'New video',
        views: 0,
        likes: 0,
        processed: true,
        status: 'ready',
        storage: 'google-cloud',
        isRealVideo: true,
        uploadedAt: new Date().toISOString(),
        bucketName: 'glint-videos',
      };

      // Save to Firebase
      await setDoc(doc(db, 'videos', uploadId), videoDoc);
      console.log('✅ Video saved to Firebase:', uploadId);

      // Also create post document
      const postDoc = {
        videoId: uploadId,
        userId: currentUser.uid,
        username: videoDoc.username,
        caption: videoDoc.caption,
        thumbnailUrl: videoDoc.thumbnailUrl,
        playbackUrl: videoDoc.playbackUrl,
        videoUrl: videoDoc.videoUrl,
        createdAt: new Date().toISOString(),
        likes: 0,
        comments: 0,
        views: 0,
        processed: true,
        status: 'ready',
        storage: 'google-cloud',
      };

      await setDoc(doc(db, 'posts', uploadId), postDoc);
      console.log('✅ Post saved:', uploadId);

      setCurrentUploadProgress({
        progress: 100,
        stage: 'complete',
        message: 'Video uploaded successfully!'
      });

      // Refresh video grid
      setVideoRefreshTrigger(prev => prev + 1);
      setRefreshKey(prev => prev + 1);
      
      // Update user's video count
      if (auth.currentUser) {
        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), {
            glints: increment(1)
          });
          setGlints(prev => prev + 1);
        } catch (error) {
          console.warn('⚠️ Failed to update user glint count:', error);
          setGlints(prev => prev + 1);
        }
      }
      
      setTimeout(() => {
        setShowUploadModal(false);
        Alert.alert('🎉 Upload Complete!', 'Your video has been uploaded to Google Cloud Storage successfully!');
      }, 1000);
      
      console.log('☁️ Google Cloud Storage upload completed successfully');
      
    } catch (error: any) {
      console.error('❌ Google Cloud Storage upload failed:', error);
      Alert.alert('Upload Failed', `Failed to upload video to Google Cloud Storage: ${error?.message || 'Unknown error'}`);
      setShowUploadModal(false);
      throw error;
    }
  };

  const renderStats = () => (
    <View style={styles.statsContainer}>
      <View style={styles.stat}>
        <Text style={styles.statNumber}>{formatCount(glints)}</Text>
        <Text style={styles.statLabel}>Glints</Text>
      </View>
      <View style={styles.stat}>
        <Text style={styles.statNumber}>{formatCount(followers)}</Text>
        <Text style={styles.statLabel}>Followers</Text>
      </View>
      <View style={styles.stat}>
        <Text style={styles.statNumber}>{formatCount(following)}</Text>
        <Text style={styles.statLabel}>Following</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <Text style={styles.username}>@{username}</Text>
          <View style={styles.topBarIcons}>
            {isOwnProfile ? (
              <TouchableOpacity 
                style={[styles.iconButton, uploading && styles.iconButtonDisabled]} 
                onPress={pickVideo}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#666" />
                ) : (
                  <Ionicons name="add-circle-outline" size={32} color="#000" />
                )}
              </TouchableOpacity>
            ) : null}
            {isOwnProfile ? (
              <TouchableOpacity style={styles.settingsIcon} onPress={() => router.push('/settings')}>
                <Ionicons name="ellipsis-vertical" size={22} color="#000" />
              </TouchableOpacity>
            ) : null}
            {!isOwnProfile ? (
              <TouchableOpacity style={styles.settingsIcon}>
                <Ionicons name="ellipsis-horizontal" size={22} color="#000" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {uploadProgress ? (
          <View style={styles.uploadProgress}>
            <Text style={styles.uploadProgressText}>{uploadProgress}</Text>
          </View>
        ) : null}

        <View style={styles.avatarSection}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{formatCount(glints)}</Text>
            <Text style={styles.statLabel}>Glints</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{formatCount(followers)}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{formatCount(following)}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        <View style={styles.bio}>
          <Text style={styles.bioText}>{bio}</Text>
        </View>

        <View style={styles.buttonRow}>
          {isOwnProfile ? (
            <TouchableOpacity style={styles.fullButton} onPress={() => router.push('/edit-profile')}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.followButtonContainer}>
              <TouchableOpacity 
                style={[
                  styles.followButton, 
                  isFollowing ? styles.followingButton : styles.notFollowingButton
                ]} 
                onPress={handleFollowToggle}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color={isFollowing ? "#666" : "#fff"} />
                ) : (
                  <Text style={[
                    styles.followButtonText, 
                    isFollowing ? styles.followingButtonText : styles.notFollowingButtonText
                  ]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.messageButton}>
                <Text style={styles.messageButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Test button removed */}

        <View style={styles.tabs}>
          {['Glints', 'Picks', 'Analytics', 'Saved'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab as any)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isPrivate && activeTab !== 'Glints' ? (
        <View style={styles.privateContainer}>
          <Text style={styles.privateText}>This account is private</Text>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          {activeTab === 'Glints' && profileUserId && (
            <EnhancedVideoGrid 
              key={`${refreshKey}-${videoRefreshTrigger}`} 
              refreshTrigger={videoRefreshTrigger}
              userId={profileUserId}
            />
          )}

          {activeTab === 'Glints' && !profileUserId && (
            <View style={styles.centeredBox}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.placeholderText}>Loading profile...</Text>
            </View>
          )}

          {activeTab === 'Picks' && (
            <View style={styles.centeredBox}>
              <Text style={styles.placeholderText}>Coming Soon 🤝</Text>
            </View>
          )}

          {activeTab === 'Analytics' && isOwnProfile && (
            <>
              {followers >= 10000 ? (
                <TouchableOpacity 
                  style={styles.analyticsButton}
                  onPress={() => setShowAnalytics(true)}
                >
                  <View style={styles.analyticsContent}>
                    <Ionicons name="analytics" size={32} color="#007AFF" />
                    <Text style={styles.analyticsTitle}>View Analytics</Text>
                    <Text style={styles.analyticsSubtitle}>
                      See detailed view tracking, watch time, and audience insights
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.centeredBox}>
                  <View style={styles.analyticsContent}>
                    <Ionicons name="lock-closed" size={32} color="#888888" />
                    <Text style={styles.analyticsTitle}>Analytics Locked</Text>
                    <Text style={styles.analyticsSubtitle}>
                      You will unlock when you reach 10,000 followers 👊
                    </Text>
                    <Text style={styles.followerCountText}>
                      {followers.toLocaleString()} / 10,000 followers
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}

          {activeTab === 'Analytics' && !isOwnProfile && (
            <View style={styles.centeredBox}>
              <Text style={styles.placeholderText}>Analytics are private.</Text>
            </View>
          )}

          {activeTab === 'Saved' && (
            <SavedVideosGrid 
              refreshTrigger={refreshKey}
            />
          )}
        </View>
      )}
      
      {/* Upload Progress Modal */}
      {isOwnProfile ? (
        <GlintUploadModal
          visible={showUploadModal}
          progress={currentUploadProgress}
          onClose={() => setShowUploadModal(false)}
        />
      ) : null}

      {/* Video Selection Modal */}
      {isOwnProfile ? (
        <VideoSelectionModal
          visible={showVideoSelection}
          onClose={() => setShowVideoSelection(false)}
          onRecordVideo={recordVideo}
          onSelectFromGallery={selectFromGallery}
        />
      ) : null}

      {/* Processing Modal */}
      {isOwnProfile ? (
        <Modal
          visible={processingVideo}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.processingOverlay}>
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.processingTitle}>Processing Video...</Text>
              <Text style={styles.processingSubtitle}>Preparing your video for editing</Text>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Thumbnail Selector Modal */}
      {isOwnProfile && pendingVideoUri ? (
        <Modal
          visible={showThumbnailSelector}
          animationType="slide"
          presentationStyle="fullScreen"
        >
          <SafeAreaView style={styles.thumbnailModalContainer}>
            <View style={{ flex: 1, padding: 16 }}>
              <CustomThumbnailPicker
                selectedThumbnail={selectedThumbnail || undefined}
                onThumbnailSelect={handleThumbnailSelected}
                caption={videoCaption}
                onCaptionChange={setVideoCaption}
                style={{ flex: 1 }}
              />
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
                <TouchableOpacity 
                  style={{ 
                    paddingHorizontal: 24, 
                    paddingVertical: 12, 
                    backgroundColor: '#f0f0f0', 
                    borderRadius: 8 
                  }} 
                  onPress={cancelThumbnailSelection}
                >
                  <Text style={{ color: '#666', fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={{ 
                    paddingHorizontal: 24, 
                    paddingVertical: 12, 
                    backgroundColor: uploading ? '#999' : (selectedThumbnail ? '#007AFF' : '#ccc'), 
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }} 
                  onPress={proceedWithUpload}
                  disabled={!selectedThumbnail || uploading}
                >
                  {uploading && <ActivityIndicator size="small" color="white" />}
                  <Text style={{ color: 'white', fontWeight: '600' }}>
                    {uploading ? 'Uploading...' : 'Upload'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
      
      {/* Analytics Modal */}
      {isOwnProfile ? (
        <Modal
          visible={showAnalytics}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <AnalyticsDashboard
            userId={profileUserId}
            visible={showAnalytics}
            onClose={() => setShowAnalytics(false)}
          />
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  contentContainer: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
  },
  username: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  topBarIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: { padding: 4 },
  iconButtonDisabled: { opacity: 0.5 },
  settingsIcon: { padding: 4 },
  uploadProgress: {
    backgroundColor: '#f0f8ff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    borderColor: '#0095f6',
    borderWidth: 1,
  },
  uploadProgressText: {
    color: '#0095f6',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  avatarSection: { alignItems: 'center', marginTop: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  stat: { alignItems: 'center', marginHorizontal: 20 },
  statNumber: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  statLabel: { fontSize: 13, color: '#555' },
  bio: { alignItems: 'center', marginTop: 12 },
  bioText: { fontSize: 14, color: '#000' },
  buttonRow: { marginTop: 16, paddingHorizontal: 60 },
  fullButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },
  editButtonText: { color: '#000', fontSize: 14, fontWeight: '500' },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  tab: { paddingHorizontal: 20, paddingBottom: 10 },
  tabText: { fontSize: 14, color: '#888' },
  activeTab: { borderBottomWidth: 2, borderColor: '#000' },
  activeTabText: { color: '#000', fontWeight: '600' },
  gridContainer: { marginTop: 12, paddingBottom: 100 },
  gridItemWrapper: {
    width: screenWidth / 3,
    height: screenWidth / 3,
    padding: 1,
  },
  gridItem: { width: '100%', height: '100%' },
  privateContainer: { alignItems: 'center', marginTop: 40 },
  privateText: { fontSize: 16, color: '#666' },
  centeredBox: { alignItems: 'center', justifyContent: 'center', height: 200 },
  placeholderText: { fontSize: 15, color: '#666' },
  
  // Thumbnail Modal Styles
  thumbnailModalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  
  // Video Processing Modal Styles
  processingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    margin: 20,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    textAlign: 'center',
  },
  processingSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  processingSteps: {
    marginTop: 20,
    alignItems: 'center',
  },
  processingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 122, 255, 0.2)',
  },
  processingStepText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 8,
  },
  
  // Follow Button Styles
  followButtonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  followButton: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  notFollowingButton: {
    backgroundColor: '#007AFF',
  },
  followingButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notFollowingButtonText: {
    color: '#fff',
  },
  followingButtonText: {
    color: '#000',
  },
  messageButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  messageButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Analytics Button Styles
  analyticsButton: {
    margin: 16,
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  analyticsContent: {
    alignItems: 'center',
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 12,
    marginBottom: 8,
  },
  analyticsSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  followerCountText: {
    fontSize: 12,
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
});

export default MyProfileScreen; 
