import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';

interface RNVideoPlayerProps {
  source: { uri: string };
  style?: any;
  onLoad?: (data: any) => void;
  onProgress?: (data: any) => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
  paused?: boolean;
  muted?: boolean;
  repeat?: boolean;
  resizeMode?: 'contain' | 'cover' | 'stretch';
}

export const RNVideoPlayer: React.FC<RNVideoPlayerProps> = ({
  source,
  style,
  onLoad,
  onProgress,
  onEnd,
  onError,
  paused = false,
  muted = false,
  repeat = true,
  resizeMode = 'cover'
}) => {
  const videoRef = useRef<Video>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleLoad = useCallback((data: any) => {
    console.log('✅ Video loaded:', data);
    setLoading(false);
    setError(false);
    onLoad?.(data);
  }, [onLoad]);

  const handleError = useCallback((error: any) => {
    console.error('❌ Video error:', error);
    setLoading(false);
    setError(true);
    onError?.(error);
  }, [onError]);

  const handleProgress = useCallback((data: any) => {
    onProgress?.(data);
  }, [onProgress]);

  const handleBuffer = useCallback((data: { isBuffering: boolean }) => {
    console.log('📶 Video buffering:', data.isBuffering);
  }, []);

  return (
    <View style={[styles.container, style]}>
      <Video
        ref={videoRef}
        source={source}
        style={styles.video}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onEnd={onEnd}
        onError={handleError}
        onBuffer={handleBuffer}
        paused={paused}
        muted={muted}
        repeat={repeat}
        resizeMode={resizeMode}
        progressUpdateInterval={250}
        controls={false}
        playInBackground={false}
        playWhenInactive={false}
        bufferConfig={{
          minBufferMs: 15000,
          maxBufferMs: 50000,
          bufferForPlaybackMs: 2500,
          bufferForPlaybackAfterRebufferMs: 5000
        }}
      />
      
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ECDC4" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});
