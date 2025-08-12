import { Ionicons } from '@expo/vector-icons';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface MuxVideoPlayerProps {
  playbackId: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  style?: any;
  onPlaybackStatusUpdate?: (status: AVPlaybackStatus) => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function MuxVideoPlayer({
  playbackId,
  playbackUrl,
  thumbnailUrl,
  width = screenWidth,
  height = screenWidth * 0.5625, // 16:9 aspect ratio
  autoplay = false,
  loop = false,
  muted = true,
  controls = true,
  style,
  onPlaybackStatusUpdate,
}: MuxVideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Generate Mux URLs if not provided, with better error handling
  const generateVideoUrl = () => {
    if (playbackUrl) return playbackUrl;
    if (playbackId) return `https://stream.mux.com/${playbackId}.mp4`;
    return null;
  };

  const generateThumbnailUrl = () => {
    if (thumbnailUrl) return thumbnailUrl;
    if (playbackId) return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&width=${Math.round(width)}&height=${Math.round(height)}&fit_mode=crop`;
    return null;
  };

  const videoUrl = generateVideoUrl();
  const posterUrl = generateThumbnailUrl();

  const handlePlayPause = async () => {
    if (!videoRef.current) return;

    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    } catch (err) {
      console.error('Error controlling video playback:', err);
    }
  };

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoading(false);
      setIsPlaying(status.isPlaying);
      setError(null);
    } else if (status.error) {
      setIsLoading(false);
      const errorMessage = status.error;
      setError(errorMessage);
      console.error('Video playback error:', status.error);
      
      // Auto-retry for network errors
      const errorString = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
      const isNetworkError = errorString.includes('-1100') || 
                           errorString.includes('NSURLErrorDomain') ||
                           errorString.includes('network') ||
                           errorString.includes('connection');
      
      if (isNetworkError && retryCount < 3) {
        console.log(`🔄 Auto-retrying video load (attempt ${retryCount + 1}/3)`);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          setError(null);
          setIsLoading(true);
          videoRef.current?.loadAsync({ uri: videoUrl || '' }, {}, false);
        }, 1500);
      }
    }

    onPlaybackStatusUpdate?.(status);
  };

  const handleLoad = () => {
    setIsLoading(false);
    setError(null);
    setRetryCount(0); // Reset retry count on successful load
  };

  const handleError = (error: string) => {
    setIsLoading(false);
    setError(error);
    console.error('Video load error:', error);
  };

  // Don't render anything if no valid video URL
  if (!videoUrl) {
    return (
      <View style={[styles.container, { width, height }, style]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ff4444" />
          <Text style={styles.errorText}>No video URL provided</Text>
          <Text style={styles.errorSubtext}>Invalid playback ID or URL</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { width, height }, style]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ff4444" />
          <Text style={styles.errorText}>Failed to load video</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height }, style]}>
      <Video
        ref={videoRef}
        source={{ uri: videoUrl }}
        style={[styles.video, { width, height }]}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={autoplay}
        isLooping={loop}
        isMuted={muted}
        useNativeControls={!controls}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        onLoad={handleLoad}
        onError={handleError}
        {...(posterUrl && { posterSource: { uri: posterUrl } })}
        usePoster={!!posterUrl}
      />
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading video...</Text>
        </View>
      )}

      {controls && !isLoading && !error && (
        <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
          <View style={styles.playButtonBackground}>
            <Ionicons 
              name={isPlaying ? 'pause' : 'play'} 
              size={32} 
              color="#fff" 
              style={!isPlaying ? { marginLeft: 4 } : undefined}
            />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  video: {
    backgroundColor: '#000',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ff4444',
    marginTop: 12,
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -35 }, { translateY: -35 }],
  },
  playButtonBackground: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
});
