import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface YouTubePlayButtonProps {
  isPlaying: boolean;
  onPress: () => void;
  size?: number;
  style?: any;
  showBackground?: boolean;
  disabled?: boolean;
}

const YouTubePlayButton: React.FC<YouTubePlayButtonProps> = ({
  isPlaying,
  onPress,
  size = 50,
  style,
  showBackground = true,
  disabled = false
}) => {
  const [scaleAnim] = React.useState(new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const iconSize = size * 0.6;
  const containerSize = size;

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.touchable, style]}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          styles.container,
          {
            width: containerSize,
            height: containerSize,
            borderRadius: containerSize / 2,
            transform: [{ scale: scaleAnim }],
          },
          showBackground && styles.backgroundStyle,
          disabled && styles.disabledStyle,
        ]}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={iconSize}
          color="white"
          style={[
            styles.icon,
            !isPlaying && { marginLeft: 2 }, // Adjust play icon position
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  backgroundStyle: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  disabledStyle: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  icon: {
    textAlign: 'center',
  },
});

export default YouTubePlayButton;
