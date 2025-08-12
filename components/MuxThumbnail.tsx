import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ImageStyle } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { buildMuxThumbUrl, MuxThumbnailOptions } from '../lib/muxThumb';

interface MuxThumbnailProps {
  playbackId: string;
  opts?: MuxThumbnailOptions;
  style?: ImageStyle;
  fallbackUri?: string;
  onLoad?: () => void;
  onError?: (error: any) => void;
}

const AnimatedImage = Animated.createAnimatedComponent(Image);

export default function MuxThumbnail({
  playbackId,
  opts = {},
  style,
  fallbackUri,
  onLoad,
  onError
}: MuxThumbnailProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const opacity = useSharedValue(0);

  const handleLoad = () => {
    setIsLoading(false);
    opacity.value = withTiming(1, { duration: 300 });
    onLoad?.();
  };

  const handleError = (error: any) => {
    console.log('🖼️ Mux thumbnail failed, using fallback:', error);
    setHasError(true);
    setIsLoading(false);
    onError?.(error);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Use fallback if there's an error, otherwise use Mux thumbnail
  const imageSource = hasError && fallbackUri 
    ? { uri: fallbackUri }
    : { uri: buildMuxThumbUrl(playbackId, opts) };

  return (
    <AnimatedImage
      source={imageSource}
      style={[style, animatedStyle]}
      contentFit="cover"
      transition={300}
      cachePolicy="memory-disk"
      onLoad={handleLoad}
      onError={handleError}
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
    />
  );
}
