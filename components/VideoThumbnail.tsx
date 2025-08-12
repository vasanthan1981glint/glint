// Video Thumbnail Component - Enhanced with loading states
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

interface VideoThumbnailProps {
  thumbnailUrl: string;
  width?: number;
  height?: number;
  showPlayIcon?: boolean;
  showLoadingIndicator?: boolean;
  fallbackText?: string;
  borderRadius?: number;
}

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  thumbnailUrl,
  width = (screenWidth - 32) / 3,
  height = ((screenWidth - 32) / 3) * (9/16), // 16:9 aspect ratio
  showPlayIcon = true,
  showLoadingIndicator = true,
  fallbackText = 'Video',
  borderRadius = 8,
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  // Generate fallback thumbnail if needed
  const fallbackThumbnail = `https://via.placeholder.com/${Math.round(width)}x${Math.round(height)}/4ECDC4/FFFFFF?text=${encodeURIComponent(fallbackText)}`;

  return (
    <View style={[styles.container, { width, height, borderRadius }]}>
      {/* Main thumbnail image */}
      <Image
        source={{ 
          uri: imageError ? fallbackThumbnail : thumbnailUrl || fallbackThumbnail 
        }}
        style={[styles.thumbnail, { width, height, borderRadius }]}
        resizeMode="cover"
        onLoad={handleImageLoad}
        onError={handleImageError}
      />

      {/* Loading indicator */}
      {imageLoading && showLoadingIndicator && (
        <View style={[styles.loadingContainer, { width, height, borderRadius }]}>
          <ActivityIndicator size="small" color="#4ECDC4" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      {/* Play icon overlay */}
      {showPlayIcon && !imageLoading && (
        <View style={styles.playIconContainer}>
          <View style={styles.playIcon}>
            <Text style={styles.playIconText}>▶</Text>
          </View>
        </View>
      )}

      {/* Error state */}
      {imageError && !imageLoading && (
        <View style={[styles.errorContainer, { width, height, borderRadius }]}>
          <Text style={styles.errorIcon}>🎬</Text>
          <Text style={styles.errorText}>Thumbnail\nUnavailable</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
  },
  thumbnail: {
    backgroundColor: '#f0f0f0',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(240, 240, 240, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  playIconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 2, // Slight offset for visual balance
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(240, 240, 240, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
    lineHeight: 12,
  },
});
