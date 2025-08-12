import React, { useState } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';

interface ExpandableCaptionProps {
  caption: string;
  maxLines?: number;
  style?: any;
  textStyle?: any;
  expandStyle?: any;
}

const ExpandableCaption: React.FC<ExpandableCaptionProps> = ({
  caption,
  maxLines = 1,
  style,
  textStyle,
  expandStyle
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReadMore, setShowReadMore] = useState(false);

  if (!caption || caption.trim().length === 0) {
    return null;
  }

  const handleTextLayout = (event: any) => {
    const { lines } = event.nativeEvent;
    if (lines.length > maxLines && !isExpanded) {
      setShowReadMore(true);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={[styles.container, style]}>
      <Text
        style={[styles.captionText, textStyle]}
        numberOfLines={isExpanded ? undefined : maxLines}
        onTextLayout={handleTextLayout}
      >
        {caption}
      </Text>
      
      {showReadMore && (
        <TouchableOpacity onPress={toggleExpanded} style={[styles.readMoreButton, expandStyle]}>
          <Text style={styles.readMoreText}>
            {isExpanded ? 'Show less' : 'Read more'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  captionText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  readMoreButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  readMoreText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default ExpandableCaption;
