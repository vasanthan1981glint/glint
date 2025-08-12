import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { ProfileImageCache } from '../lib/profileImageCache';

/**
 * FastProfileAvatar - YouTube-style profile picture component
 * Features:
 * - Instant placeholder display
 * - Progressive loading (blur → full image)
 * - Automatic caching and preloading
 * - Fallback to initials on error
 * - CDN optimization
 */

interface FastProfileAvatarProps {
  userId?: string;
  imageURI?: string;
  username?: string;
  size?: number;
  style?: ViewStyle;
  priority?: 'high' | 'normal' | 'low';
  showInitialsPlaceholder?: boolean;
  borderWidth?: number;
  borderColor?: string;
}

export default function FastProfileAvatar({
  userId,
  imageURI,
  username = 'User',
  size = 40,
  style,
  priority = 'normal',
  showInitialsPlaceholder = true,
  borderWidth = 0,
  borderColor = '#E0E0E0'
}: FastProfileAvatarProps) {
  const [cachedImageURI, setCachedImageURI] = useState<string>('');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true);

  // Debug logging
  console.log('🖼️ FastProfileAvatar props:', { 
    userId, 
    imageURI, 
    username, 
    size, 
    priority,
    showInitialsPlaceholder 
  });

  // Generate initials from username for placeholder
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
  };

  // Generate background color from username for consistent placeholder colors
  const getPlaceholderColor = (name: string): string => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#FF8A80', '#82B1FF', '#A5D6A7', '#FFD54F'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Load cached image on mount or when imageURI changes
  useEffect(() => {
    let isMounted = true;

    const loadCachedImage = async () => {
      if (!imageURI) {
        setShowPlaceholder(true);
        return;
      }

      try {
        console.log('🔍 Loading cached profile image...', { userId, imageURI: imageURI.slice(0, 50) });
        
        const optimizedURI = await ProfileImageCache.getCachedImageURI(
          imageURI, 
          size, 
          userId
        );

        if (isMounted) {
          setCachedImageURI(optimizedURI);
          
          // Preload the image to trigger loading
          if (optimizedURI && priority === 'high') {
            ProfileImageCache.addToPreloadQueue(optimizedURI, 'high', userId);
          }
        }
      } catch (error) {
        console.log('❌ Profile image cache error:', error);
        if (isMounted) {
          setImageError(true);
          setShowPlaceholder(true);
        }
      }
    };

    loadCachedImage();

    return () => {
      isMounted = false;
    };
  }, [imageURI, size, userId, priority]);

  // Handle image load success
  const handleImageLoad = () => {
    console.log('✅ Profile image loaded successfully');
    setImageLoaded(true);
    setImageError(false);
    setShowPlaceholder(false);
  };

  // Handle image load error
  const handleImageError = () => {
    console.log('❌ Profile image failed to load');
    setImageError(true);
    setImageLoaded(false);
    setShowPlaceholder(true);
  };

  const avatarSize = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth,
    borderColor
  };

  const containerStyle = [
    styles.container,
    avatarSize,
    style
  ];

  // Show initials placeholder while loading or on error
  if (showPlaceholder && showInitialsPlaceholder) {
    const initials = getInitials(username);
    const backgroundColor = getPlaceholderColor(username);
    
    return (
      <View style={[containerStyle, { backgroundColor }, styles.placeholder]}>
        <Text style={[
          styles.initialsText, 
          { fontSize: size * 0.4, color: '#FFFFFF' }
        ]}>
          {initials}
        </Text>
        
        {/* Show loading image behind placeholder if we have a URI */}
        {cachedImageURI && !imageError && (
          <Image
            source={{ uri: cachedImageURI }}
            style={[avatarSize, styles.hiddenImage]}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}
      </View>
    );
  }

  // Show the actual image
  if (cachedImageURI && !imageError) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri: cachedImageURI }}
          style={avatarSize}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
        
        {/* Show placeholder overlay while image is loading */}
        {!imageLoaded && showInitialsPlaceholder && (
          <View style={[
            avatarSize, 
            styles.placeholderOverlay,
            { backgroundColor: getPlaceholderColor(username) }
          ]}>
            <Text style={[
              styles.initialsText, 
              { fontSize: size * 0.4, color: '#FFFFFF' }
            ]}>
              {getInitials(username)}
            </Text>
          </View>
        )}
      </View>
    );
  }

  // Fallback: Simple colored circle with initials
  return (
    <View style={[
      containerStyle, 
      { backgroundColor: getPlaceholderColor(username) },
      styles.placeholder
    ]}>
      <Text style={[
        styles.initialsText, 
        { fontSize: size * 0.4, color: '#FFFFFF' }
      ]}>
        {getInitials(username)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  initialsText: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  hiddenImage: {
    position: 'absolute',
    opacity: 0, // Hidden while loading
  },
});
