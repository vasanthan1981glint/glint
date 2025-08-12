import { doc, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { db } from '../firebaseConfig';
import { formatViewCount } from '../utils/formatUtils';

interface ViewCountDisplayProps {
  videoId: string;
  style?: any;
  prefix?: string;
  suffix?: string;
}

const ViewCountDisplay: React.FC<ViewCountDisplayProps> = ({ 
  videoId, 
  style, 
  prefix = '', 
  suffix = ' views' 
}) => {
  const [viewCount, setViewCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!videoId) return;

    console.log(`📊 Setting up real-time view count listener for video: ${videoId}`);
    
    // Set up real-time listener for view count changes
    const videoRef = doc(db, 'videos', videoId);
    const unsubscribe = onSnapshot(
      videoRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          const views = data.views || 0;
          setViewCount(views);
          console.log(`📈 View count updated for ${videoId}: ${views}`);
        } else {
          console.warn(`❌ Video document not found: ${videoId}`);
          setViewCount(0);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('❌ Error listening to view count changes:', error);
        setIsLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log(`🔕 Cleaning up view count listener for video: ${videoId}`);
      unsubscribe();
    };
  }, [videoId]);

  if (isLoading) {
    return (
      <Text style={[styles.defaultStyle, style]}>
        {prefix}...{suffix}
      </Text>
    );
  }

  return (
    <Text style={[styles.defaultStyle, style]}>
      {prefix}{formatViewCount(viewCount)}{suffix}
    </Text>
  );
};

const styles = StyleSheet.create({
  defaultStyle: {
    fontSize: 14,
    color: '#666',
  },
});

export default ViewCountDisplay;
