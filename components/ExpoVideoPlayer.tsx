import Video from 'expo-video';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface ExpoVideoPlayerProps {
  source: { uri: string };
  style?: any;
  shouldPlay?: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
}

export const ExpoVideoPlayer: React.FC<ExpoVideoPlayerProps> = ({
  source,
  style,
  shouldPlay = false,
  isLooping = true,
  isMuted = false
}) => {
  const videoRef = React.useRef<Video>(null);

  // Update player state when props change
  React.useEffect(() => {
    if (shouldPlay) {
      videoRef.current?.playAsync();
    } else {
      videoRef.current?.pauseAsync();
    }
  }, [shouldPlay]);

  return (
    <View style={[styles.container, style]}>
      <Video 
        ref={videoRef}
        style={styles.video} 
        source={source}
        shouldPlay={shouldPlay}
        isLooping={isLooping}
        resizeMode="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
});
