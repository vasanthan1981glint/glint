import React from 'react';
import { Image, Text, View, ViewStyle } from 'react-native';

/**
 * SimpleProfileAvatar - Simplified profile avatar for debugging
 */

interface SimpleProfileAvatarProps {
  userId?: string;
  imageURI?: string;
  username?: string;
  size?: number;
  style?: ViewStyle;
}

export default function SimpleProfileAvatar({
  userId,
  imageURI,
  username = 'User',
  size = 40,
  style,
}: SimpleProfileAvatarProps) {

  // Generate initials from username
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U';
  };

  // Generate color based on username
  const getPlaceholderColor = (name: string): string => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
      '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
      '#10AC84', '#EE5A6F', '#C44569', '#F8B500', '#6C5CE7'
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const initials = getInitials(username);
  const backgroundColor = getPlaceholderColor(username);

  console.log('🖼️ SimpleProfileAvatar:', { 
    userId, 
    imageURI, 
    username, 
    initials, 
    backgroundColor 
  });

  return (
    <View style={[{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden',
    }, style]}>
      {/* Always show initials as background */}
      <Text style={{
        color: 'white',
        fontSize: size * 0.4,
        fontWeight: '600',
        textAlign: 'center',
      }}>
        {initials}
      </Text>

      {/* Show image on top if available */}
      {imageURI && imageURI !== 'https://via.placeholder.com/150' && (
        <Image
          source={{ uri: imageURI }}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: 'transparent', // Explicit background for image
          }}
          onError={() => {
            console.log('❌ SimpleProfileAvatar image failed to load:', imageURI);
          }}
          onLoad={() => {
            console.log('✅ SimpleProfileAvatar image loaded:', imageURI);
          }}
        />
      )}
    </View>
  );
}
