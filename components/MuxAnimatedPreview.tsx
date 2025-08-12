import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ActivityIndicator, ImageStyle, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { buildMuxAnimatedUrl, MuxAnimatedOptions } from '../lib/muxThumb';

interface MuxAnimatedPreviewProps {
  playbackId: string;
  start?: number;
  end?: number;
  fps?: number;
  width?: number;
  height?: number;
  style?: ImageStyle;
  fallbackUri?: string;
  onLoad?: () => void;
  onError?: (error: any) => void;
  showLoading?: boolean;
}

const AnimatedImage = Animated.createAnimatedComponent(Image);

export default function MuxAnimatedPreview({
  playbackId,
  start = 2,
  end = 7,
  fps = 10,
  width,
  height,
  style,
  fallbackUri,
  onLoad,
  onError,
  showLoading = true
}: MuxAnimatedPreviewProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const opacity = useSharedValue(0);

  const handleLoad = () => {
    setIsLoading(false);
    opacity.value = withTiming(1, { duration: 300 });
    onLoad?.();
  };

  const handleError = (error: any) => {
    console.log('🎬 Mux animated preview failed, using fallback:', error);
    setHasError(true);
    setIsLoading(false);
    onError?.(error);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const animationOptions: MuxAnimatedOptions = {
    start,
    end,
    fps,
    width,
    height
  };

  // Use fallback if there's an error, otherwise use Mux animated preview
  const imageSource = hasError && fallbackUri 
    ? { uri: fallbackUri }
    : { uri: buildMuxAnimatedUrl(playbackId, animationOptions) };

  return (
    <View style={style}>
      <AnimatedImage
        source={imageSource}
        style={[{ width: '100%', height: '100%' }, animatedStyle]}
        contentFit="cover"
        transition={300}
        cachePolicy="memory-disk"
        onLoad={handleLoad}
        onError={handleError}
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
      />
      
      {isLoading && showLoading && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.3)'
        }}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
    </View>
  );
}
