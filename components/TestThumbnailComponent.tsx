import React from 'react';
import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// Test SVG thumbnail component
const TestThumbnailComponent = () => {
  // Create a test SVG thumbnail
  const createTestSVG = (color: string, label: string) => {
    const svgContent = `
      <svg width="300" height="534" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${color}"/>
        <text x="50%" y="45%" text-anchor="middle" dy=".3em" 
              font-family="Arial, sans-serif" font-size="32" fill="white">
          ${label}
        </text>
        <circle cx="150" cy="300" r="40" fill="rgba(255,255,255,0.3)"/>
        <polygon points="135,285 135,315 165,300" fill="white"/>
      </svg>
    `.trim();
    
    const encodedSvg = encodeURIComponent(svgContent);
    return `data:image/svg+xml,${encodedSvg}`;
  };

  const testThumbnails = [
    { id: '1', uri: createTestSVG('#4ECDC4', 'Test 1'), label: 'Thumbnail 1' },
    { id: '2', uri: createTestSVG('#667eea', 'Test 2'), label: 'Thumbnail 2' },
    { id: '3', uri: createTestSVG('#f093fb', 'Test 3'), label: 'Thumbnail 3' },
  ];

  const itemWidth = (screenWidth - 20) / 3;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thumbnail Test</Text>
      <View style={styles.grid}>
        {testThumbnails.map((thumb) => (
          <View key={thumb.id} style={[styles.item, { width: itemWidth }]}>
            <Image
              source={{ uri: thumb.uri }}
              style={styles.thumbnail}
              resizeMode="cover"
              onLoad={() => console.log(`✅ ${thumb.label} loaded`)}
              onError={(error) => console.log(`❌ ${thumb.label} failed:`, error)}
            />
            <Text style={styles.label}>{thumb.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  item: {
    alignItems: 'center',
  },
  thumbnail: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  label: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
});

export default TestThumbnailComponent;
