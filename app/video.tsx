import { Video } from 'expo-av';
import React from 'react';
import { StyleSheet, View } from 'react-native';

// Define ResizeMode enum manually
enum ResizeMode {
  COVER = 'cover',
  CONTAIN = 'contain',
  STRETCH = 'stretch',
}

export default function MuxVideoPlayer() {
  const playbackId = 'F5JTp02U31fp1ftu02u701CnKLIjLg002ZmwexGY7omMhq00'; // Your Mux playback ID

  // Mux playback URL format (HLS)
  const videoUri = `https://stream.mux.com/${playbackId}.m3u8`;

  return (
    <View style={styles.container}>
      <Video
        source={{ uri: videoUri }}
        style={styles.video}
        resizeMode={ResizeMode.COVER} // Use manual enum value here
        shouldPlay
        isLooping
        useNativeControls
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000', // Black background for video
  },
  video: {
    width: '100%',
    height: 300,
  },
});
