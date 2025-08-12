import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

interface ReliableThumbnailProps {
  thumbnailUrl: string;
  assetId: string;
  style?: any;
}

export const ReliableThumbnail: React.FC<ReliableThumbnailProps> = ({ 
  thumbnailUrl, 
  assetId, 
  style 
}) => {
  const [imageError, setImageError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);

  // Build a reliable PNG fallback URL (no SVG)
  const getFallbackUrl = (id: string): string => {
    const colors = ['FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7', 'DDA0DD'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = colors[Math.abs(hash) % colors.length];
    const label = ['Video', 'New', 'Pro', 'Hot', 'Live', 'Cool'][Math.abs(hash) % 6];
    return `https://dummyimage.com/640x360/${color}/FFFFFF.png&text=${encodeURIComponent(label)}`;
  };

  const handleError = () => {
    console.log(`❌ Thumbnail failed to load, using fallback: ${thumbnailUrl}`);
    setImageError(true);
  };

  const handleFallbackError = () => {
    console.log(`❌ Fallback failed to load for: ${assetId}`);
    setFallbackError(true);
  };

  // Generate a consistent color based on assetId
  const getColorFromAssetId = (id: string): string => {
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#6366f1'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Generate a simple text label from assetId
  const getTextFromAssetId = (id: string): string => {
    const words = ['Video', 'New', 'Pro', 'Hot', 'Live', 'Cool'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return words[Math.abs(hash) % words.length];
  };

  // If both original and SVG fail, show a simple colored fallback
  if (imageError && fallbackError) {
    const backgroundColor = getColorFromAssetId(assetId);
    const text = getTextFromAssetId(assetId);
    
    return (
      <View style={[style, styles.simpleFallback, { backgroundColor }]}>
        <Text style={styles.fallbackText}>{text}</Text>
        <View style={styles.playButton}>
          <Text style={styles.playIcon}>▶</Text>
        </View>
      </View>
    );
  }

  // If original fails, try PNG fallback
  if (imageError) {
    const fallbackPng = getFallbackUrl(assetId);
    console.log(`❌ Thumbnail failed to load, using fallback: ${fallbackPng}`);
    
    return (
      <Image
        source={{ uri: fallbackPng }}
        style={style}
        resizeMode="cover"
        onError={handleFallbackError}
      />
    );
  }

  // Try original thumbnail first
  return (
    <Image
      source={{ uri: thumbnailUrl }}
      style={style}
      resizeMode="cover"
      onError={handleError}
    />
  );
};

const styles = StyleSheet.create({
  simpleFallback: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fallbackText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Arial',
  },
  playButton: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  playIcon: {
    color: 'white',
    fontSize: 20,
    marginLeft: 4, // Slight offset to center the triangle
  },
});
