import { Ionicons } from '@expo/vector-icons';
import { Video as ExpoVideo, ResizeMode } from 'expo-av';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Image,
    Modal,
    PanResponder,
    SafeAreaView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

interface Video {
  id: string;
  userId: string;
  username: string;
  caption: string;
  thumbnailUrl: string;
  videoUrl: string;
  playbackUrl: string;
  views: number;
  likes: number;
  createdAt: string;
  processed: boolean;
  status: string;
  uploadTab?: string;
  contentType?: string;
}

interface TrendsVideoPlayerProps {
  visible: boolean;
  video: Video;
  onClose: () => void;
}

const TrendsVideoPlayer: React.FC<TrendsVideoPlayerProps> = ({ visible, video, onClose }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const videoRef = useRef<ExpoVideo>(null);
  const lastDragUpdate = useRef<any>(0);
  
  // Basic states
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackStatus, setPlaybackStatus] = useState<any>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  
  // Progress bar states
  const [isDragging, setIsDragging] = useState(false);
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const [showProgressPreview, setShowProgressPreview] = useState(false);
  const [previewPosition, setPreviewPosition] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const controlsTimeoutRef = useRef<any>(null);

  // Format time function
  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Reset states when modal closes
  useEffect(() => {
    if (!visible) {
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pauseAsync();
      }
    }
  }, [visible]);

  // Get video source
  const getVideoSource = useCallback((): { uri: string } | undefined => {
    if (!video) return undefined;
    const url = video.playbackUrl || video.videoUrl;
    return url ? { uri: url } : undefined;
  }, [video]);

  // Video handlers
  const onPlaybackStatusUpdate = useCallback((status: any) => {
    setPlaybackStatus(status);
    if (status.isLoaded) {
      setVideoLoaded(true);
      setVideoError(false);
      setIsPlaying(status.isPlaying);
    } else if (status.error) {
      setVideoError(true);
      setVideoLoaded(false);
    }
  }, []);

  const onVideoLoad = (status: any) => {
    console.log('Video loaded successfully:', status);
    setVideoLoaded(true);
    setVideoError(false);
  };

  const onVideoError = (error: any) => {
    console.error('Video error:', error);
    setVideoError(true);
    setVideoLoaded(false);
  };

  // Controls functions
  const showVideoControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const hideVideoControls = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(false);
  }, []);

  const handleVideoTouch = useCallback(() => {
    if (showControls) {
      hideVideoControls();
    } else {
      showVideoControls();
    }
  }, [showControls, showVideoControls, hideVideoControls]);

  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current || !playbackStatus) return;
    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  }, [isPlaying, playbackStatus]);

  // Progress bar handlers
  const handleProgressBarLayout = useCallback((event: any) => {
    const { width } = event.nativeEvent.layout;
    if (width !== progressBarWidth) {
      setProgressBarWidth(width);
    }
  }, [progressBarWidth]);

  const handleProgressBarPress = useCallback((event: any) => {
    if (!playbackStatus || !playbackStatus.durationMillis || !progressBarWidth || progressBarWidth <= 0) return;
    const touchX = event.nativeEvent.locationX;
    const percentage = Math.max(0, Math.min(1, touchX / progressBarWidth));
    const newPosition = percentage * playbackStatus.durationMillis;
    if (videoRef.current && !isNaN(newPosition) && isFinite(newPosition)) {
      videoRef.current.setPositionAsync(newPosition);
    }
  }, [playbackStatus, progressBarWidth]);

  const handleProgressBarPanStart = useCallback((event: any) => {
    setIsDragging(true);
    if (progressBarWidth > 0) {
      const touchX = Math.max(0, Math.min(progressBarWidth, event.nativeEvent.x));
      const percentage = Math.max(0, Math.min(1, touchX / progressBarWidth));
      if (!isNaN(percentage) && isFinite(percentage)) {
        setPreviewPosition(percentage);
        setShowProgressPreview(true);
      }
    }
  }, [progressBarWidth]);

  const handleProgressBarPanMove = useCallback((event: any) => {
    if (!isDragging || !progressBarWidth || progressBarWidth <= 0) return;
    const touchX = Math.max(0, Math.min(progressBarWidth, event.nativeEvent.x));
    const percentage = Math.max(0, Math.min(1, touchX / progressBarWidth));
    if (isNaN(percentage) || !isFinite(percentage)) return;
    setPreviewPosition(percentage);
    setShowProgressPreview(true);
  }, [isDragging, progressBarWidth]);

  const handleProgressBarPanEnd = useCallback((event: any) => {
    if (!playbackStatus || !playbackStatus.durationMillis || !progressBarWidth || progressBarWidth <= 0) {
      setIsDragging(false);
      setShowProgressPreview(false);
      return;
    }
    const touchX = Math.max(0, Math.min(progressBarWidth, event.nativeEvent.x));
    const percentage = Math.max(0, Math.min(1, touchX / progressBarWidth));
    if (isNaN(percentage) || !isFinite(percentage)) {
      setIsDragging(false);
      setShowProgressPreview(false);
      return;
    }
    const newPosition = percentage * playbackStatus.durationMillis;
    if (isNaN(newPosition) || !isFinite(newPosition)) {
      setIsDragging(false);
      setShowProgressPreview(false);
      return;
    }
    if (videoRef.current) {
      videoRef.current.setPositionAsync(newPosition);
    }
    setIsDragging(false);
    setShowProgressPreview(false);
  }, [playbackStatus, progressBarWidth]);

  const getCurrentProgress = useCallback(() => {
    if (isDragging && !isNaN(previewPosition) && isFinite(previewPosition)) {
      return Math.max(0, Math.min(1, previewPosition));
    }
    if (playbackStatus && playbackStatus.isLoaded && playbackStatus.durationMillis > 0) {
      const progress = playbackStatus.positionMillis / playbackStatus.durationMillis;
      if (isNaN(progress) || !isFinite(progress)) return 0;
      return Math.max(0, Math.min(1, progress));
    }
    return 0;
  }, [isDragging, previewPosition, playbackStatus]);

  // Create PanResponder for progress bar
  const progressBarPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: handleProgressBarPanStart,
    onPanResponderMove: handleProgressBarPanMove,
    onPanResponderRelease: handleProgressBarPanEnd,
    onPanResponderTerminate: handleProgressBarPanEnd,
  }), [handleProgressBarPanStart, handleProgressBarPanMove, handleProgressBarPanEnd]);

  if (!visible || !video) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView style={styles.container}>
        
        {/* Top Navigation Bar */}
        <View style={styles.topNavBar}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Video Player Section */}
        <View style={styles.videoPlayerSection}>
          {!videoError ? (
            <TouchableOpacity 
              style={styles.videoContainer} 
              activeOpacity={1} 
              onPress={handleVideoTouch}
            >
              <ExpoVideo
                ref={videoRef}
                source={getVideoSource()}
                style={styles.inlineVideo}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={false}
                isLooping={false}
                onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                onLoad={onVideoLoad}
                onError={onVideoError}
                useNativeControls={false}
                volume={1.0}
                isMuted={false}
                usePoster={true}
                posterSource={{ uri: video.thumbnailUrl }}
                posterStyle={styles.inlineVideo}
                progressUpdateIntervalMillis={100}
              />
              
              {/* Video Controls Overlay - Only visible when showControls is true */}
              {showControls && (
                <View style={styles.videoControlsOverlay}>
                  <TouchableOpacity 
                    style={styles.playPauseButton}
                    onPress={togglePlayPause}
                  >
                    <Ionicons 
                      name={isPlaying ? "pause" : "play"} 
                      size={48} 
                      color="#fff" 
                    />
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Progress Bar - Always visible when video is loaded */}
              {playbackStatus && playbackStatus.isLoaded && videoLoaded && !videoError && (
                <View style={styles.videoProgressOverlay}>
                  <TouchableOpacity
                    style={styles.progressBarContainer}
                    activeOpacity={1}
                    onLayout={handleProgressBarLayout}
                    onPress={handleProgressBarPress}
                    {...progressBarPanResponder.panHandlers}
                  >
                    {/* Background track */}
                    <View style={styles.progressBarTrack} />
                    
                    {/* Buffer progress */}
                    {playbackStatus.playableDurationMillis && playbackStatus.durationMillis > 0 && progressBarWidth > 0 && (
                      <View 
                        style={[
                          styles.progressBarBuffer,
                          {
                            width: Math.min(progressBarWidth, (playbackStatus.playableDurationMillis / playbackStatus.durationMillis) * progressBarWidth) || 0
                          }
                        ]}
                      />
                    )}
                    
                    {/* Progress fill */}
                    <View 
                      style={[
                        styles.progressBarFill, 
                        { 
                          width: progressBarWidth > 0 ? Math.max(0, Math.min(progressBarWidth, getCurrentProgress() * progressBarWidth)) : 0
                        }
                      ]} 
                    />
                    
                    {/* Scrubber dot */}
                    <View 
                      style={[
                        styles.progressBarScrubber,
                        {
                          left: progressBarWidth > 0 ? Math.max(0, Math.min(progressBarWidth - 6, getCurrentProgress() * progressBarWidth - 6)) : 0,
                          opacity: isDragging ? 1 : 0.9,
                          transform: [{ scale: isDragging ? 1.3 : 1.1 }],
                        }
                      ]}
                    />
                    
                    {/* Progress preview tooltip */}
                    {showProgressPreview && playbackStatus.durationMillis > 0 && progressBarWidth > 0 && 
                     !isNaN(previewPosition) && isFinite(previewPosition) && (
                      <View 
                        style={[
                          styles.progressPreviewTooltip,
                          {
                            left: Math.max(30, Math.min(progressBarWidth - 30, previewPosition * progressBarWidth)) || 30,
                          }
                        ]}
                      >
                        <Text style={styles.progressPreviewText}>
                          {formatTime((previewPosition || 0) * playbackStatus.durationMillis) || '0:00'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            // Fallback to thumbnail if video fails to load
            <Image 
              source={{ uri: video.thumbnailUrl }} 
              style={styles.inlineVideo}
              resizeMode="cover"
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  videoPlayerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  inlineVideo: {
    width: '100%',
    height: '100%',
  },
  videoControlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playPauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoProgressOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  progressBarContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 10,
  },
  progressBarTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 18,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    width: '100%',
  },
  progressBarBuffer: {
    position: 'absolute',
    left: 0,
    top: 18,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 2,
    maxWidth: '100%',
  },
  progressBarFill: {
    position: 'absolute',
    left: 0,
    top: 18,
    height: 4,
    backgroundColor: '#ff0000',
    borderRadius: 2,
    maxWidth: '100%',
  },
  progressBarScrubber: {
    position: 'absolute',
    top: 14,
    width: 12,
    height: 12,
    backgroundColor: '#ff0000',
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  progressPreviewTooltip: {
    position: 'absolute',
    bottom: 25,
    width: 60,
    height: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressPreviewText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
});

export default TrendsVideoPlayer;
