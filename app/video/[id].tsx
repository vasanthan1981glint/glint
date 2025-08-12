import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UniversalVideoPlayer } from '../../components/UniversalVideoPlayer';

export default function VideoPlayerScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Get the proper Mux video URL format
  const videoUrl = `https://stream.mux.com/${id}.m3u8`; // Use HLS format for better compatibility

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Video</Text>
      </View>

      {/* Video Player */}
      <View style={styles.videoContainer}>
        <UniversalVideoPlayer
          videoUri={videoUrl}
          isVisible={true}
          isActive={true}
          style={styles.video}
        />
      </View>

      {/* Video Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.videoTitle}>Video ID: {id}</Text>
        <Text style={styles.videoDescription}>
          Your uploaded video playing from Mux
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  videoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  videoDescription: {
    color: '#ccc',
    fontSize: 14,
  },
});
