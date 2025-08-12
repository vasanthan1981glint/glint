import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ImageStyle, Text, View } from 'react-native';
// import { extractMuxPlaybackId } from '../lib/muxThumb'; // Disabled for now
import MuxThumbnail from './MuxThumbnail';

interface SmartThumbnailProps {
  videoUrl?: string;
  thumbnailUrl?: string;
  playbackId?: string;
  style?: ImageStyle;
  fallbackText?: string;
  onLoad?: () => void;
  onError?: (error: any) => void;
}

export default function SmartThumbnail({
  videoUrl,
  thumbnailUrl,
  playbackId,
  style,
  fallbackText = '📹',
  onLoad,
  onError
}: SmartThumbnailProps) {
  const [hasError, setHasError] = useState(false);

  // Extract playback ID from video URL if not provided
  // TODO: Re-enable when Mux is integrated
  const extractedPlaybackId = playbackId; // || (videoUrl ? extractMuxPlaybackId(videoUrl) : null);

  const handleError = (error: any) => {
    setHasError(true);
    onError?.(error);
  };

  // If we have a Mux playback ID, use Mux thumbnail
  if (extractedPlaybackId && !hasError) {
    return (
      <MuxThumbnail
        playbackId={extractedPlaybackId}
        opts={{ time: 5, width: 720, format: 'jpg' }}
        style={style}
        fallbackUri={thumbnailUrl}
        onLoad={onLoad}
        onError={handleError}
      />
    );
  }

  // Fallback to regular thumbnail URL
  if (thumbnailUrl && !hasError) {
    return (
      <Image
        source={{ uri: thumbnailUrl }}
        style={style}
        contentFit="cover"
        transition={300}
        cachePolicy="memory-disk"
        onLoad={onLoad}
        onError={handleError}
      />
    );
  }

  // Final fallback - show placeholder
  return (
    <View style={[style, { 
      backgroundColor: '#f0f0f0', 
      justifyContent: 'center', 
      alignItems: 'center' 
    }]}>
      <Text style={{ fontSize: 24 }}>{fallbackText}</Text>
    </View>
  );
}
