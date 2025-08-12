import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';

const { width, height } = Dimensions.get('window');

export const SplashLoadingScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const dotAnim1 = useRef(new Animated.Value(0)).current;
  const dotAnim2 = useRef(new Animated.Value(0)).current;
  const dotAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Main logo animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Loading dots animation
    const animateDots = () => {
      const sequence = Animated.sequence([
        Animated.timing(dotAnim1, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnim2, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnim3, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnim1, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnim2, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(dotAnim3, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]);
      
      Animated.loop(sequence).start();
    };

    // Start dots animation after logo appears
    const timer = setTimeout(animateDots, 600);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.container}>
        {/* Background gradient effect */}
        <View style={styles.gradientOverlay} />
        
        {/* Main content */}
        <Animated.View 
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          {/* App Logo/Name */}
          <Text style={styles.appName}>glint</Text>
          <Text style={styles.tagline}>Connect • Share • Discover</Text>
        </Animated.View>

        {/* Loading animation */}
        <View style={styles.loadingContainer}>
          <View style={styles.dotsContainer}>
            <Animated.View 
              style={[
                styles.dot,
                { opacity: dotAnim1 }
              ]} 
            />
            <Animated.View 
              style={[
                styles.dot,
                { opacity: dotAnim2 }
              ]} 
            />
            <Animated.View 
              style={[
                styles.dot,
                { opacity: dotAnim3 }
              ]} 
            />
          </View>
          <Text style={styles.loadingText}>Preparing your experience...</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Powered by Firebase</Text>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 123, 255, 0.05)',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: height * 0.15,
  },
  appName: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 2,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#999',
    fontWeight: '400',
    letterSpacing: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    position: 'absolute',
    bottom: height * 0.25,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007bff',
    marginHorizontal: 4,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#444',
    fontWeight: '400',
  },
});
