import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React, { useState } from 'react';
import { Alert, Dimensions, Linking, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatViewCount } from '../utils/formatUtils';

dayjs.extend(relativeTime);

interface ExpandableCaptionDisplayProps {
  caption: string;
  views?: number;
  createdAt: string;
  username?: string;
  maxLines?: number;
  style?: any;
  textStyle?: any;
  showViewsAndDate?: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ExpandableCaptionDisplay: React.FC<ExpandableCaptionDisplayProps> = ({
  caption,
  views = 0,
  createdAt,
  username,
  maxLines = 2,
  style,
  textStyle,
  showViewsAndDate = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullModal, setShowFullModal] = useState(false);
  const [textHeight, setTextHeight] = useState(0);
  const [fullTextHeight, setFullTextHeight] = useState(0);

  // Format view count
  // Format date
  const formatDate = (dateString: string): string => {
    try {
      return dayjs(dateString).fromNow();
    } catch (error) {
      return 'Recently';
    }
  };

  // Detect and handle links
  const detectLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b)/g;
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    const mentionRegex = /@[a-zA-Z0-9_.]+/g;

    const parts = [];
    let lastIndex = 0;

    // Process URLs
    text.replace(urlRegex, (match, offset) => {
      if (offset > lastIndex) {
        parts.push({ type: 'text', content: text.substring(lastIndex, offset) });
      }
      parts.push({ type: 'link', content: match });
      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      
      // Process hashtags and mentions in remaining text
      let processedText = remainingText;
      const elements = [];
      let textLastIndex = 0;

      // Find hashtags
      remainingText.replace(hashtagRegex, (match, offset) => {
        if (offset > textLastIndex) {
          elements.push({ type: 'text', content: remainingText.substring(textLastIndex, offset) });
        }
        elements.push({ type: 'hashtag', content: match });
        textLastIndex = offset + match.length;
        return match;
      });

      // Find mentions
      remainingText.replace(mentionRegex, (match, offset) => {
        if (offset > textLastIndex) {
          elements.push({ type: 'text', content: remainingText.substring(textLastIndex, offset) });
        }
        elements.push({ type: 'mention', content: match });
        textLastIndex = offset + match.length;
        return match;
      });

      if (textLastIndex < remainingText.length) {
        elements.push({ type: 'text', content: remainingText.substring(textLastIndex) });
      }

      parts.push(...elements);
    }

    return parts.length > 0 ? parts : [{ type: 'text', content: text }];
  };

  const handleLinkPress = async (url: string) => {
    try {
      let processedUrl = url;
      
      // Add protocol if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (url.startsWith('www.')) {
          processedUrl = 'https://' + url;
        } else if (url.includes('@')) {
          processedUrl = 'mailto:' + url;
        } else {
          processedUrl = 'https://' + url;
        }
      }

      const supported = await Linking.canOpenURL(processedUrl);
      if (supported) {
        await Linking.openURL(processedUrl);
      } else {
        Alert.alert('Error', 'Unable to open this link');
      }
    } catch (error) {
      console.error('Error opening link:', error);
      Alert.alert('Error', 'Failed to open link');
    }
  };

  const handleHashtagPress = (hashtag: string) => {
    Alert.alert('Hashtag', `Search for ${hashtag} - Feature coming soon!`);
  };

  const handleMentionPress = (mention: string) => {
    Alert.alert('Mention', `View ${mention} profile - Feature coming soon!`);
  };

  const renderTextWithLinks = (text: string, isFullText = false) => {
    const parts = detectLinks(text);
    
    return parts.map((part, index) => {
      switch (part.type) {
        case 'link':
          return (
            <Text
              key={index}
              style={[textStyle, styles.linkText]}
              onPress={() => handleLinkPress(part.content)}
            >
              {part.content}
            </Text>
          );
        case 'hashtag':
          return (
            <Text
              key={index}
              style={[textStyle, styles.hashtagText]}
              onPress={() => handleHashtagPress(part.content)}
            >
              {part.content}
            </Text>
          );
        case 'mention':
          return (
            <Text
              key={index}
              style={[textStyle, styles.mentionText]}
              onPress={() => handleMentionPress(part.content)}
            >
              {part.content}
            </Text>
          );
        default:
          return (
            <Text key={index} style={textStyle}>
              {part.content}
            </Text>
          );
      }
    });
  };

  const needsTruncation = fullTextHeight > textHeight && textHeight > 0;
  const shouldShowReadMore = !isExpanded && needsTruncation;

  return (
    <View style={[styles.container, style]}>
      {/* Main Caption Display */}
      <View style={styles.captionContainer}>
        {username && (
          <Text style={[textStyle, styles.username]}>
            {username}
            <Text style={[textStyle, styles.captionText]}> </Text>
          </Text>
        )}
        
        <Text
          style={[textStyle, styles.captionText]}
          numberOfLines={isExpanded ? undefined : maxLines}
          onLayout={(event) => {
            if (!isExpanded) {
              setTextHeight(event.nativeEvent.layout.height);
            }
          }}
        >
          {renderTextWithLinks(caption)}
        </Text>

        {/* Hidden text to measure full height */}
        <Text
          style={[textStyle, styles.hiddenText]}
          onLayout={(event) => {
            setFullTextHeight(event.nativeEvent.layout.height);
          }}
        >
          {caption}
        </Text>

        {/* Read More/Less Button */}
        {needsTruncation && (
          <TouchableOpacity
            onPress={() => {
              if (isExpanded) {
                setIsExpanded(false);
              } else {
                setShowFullModal(true);
              }
            }}
            style={styles.readMoreButton}
          >
            <Text style={[textStyle, styles.readMoreText]}>
              {isExpanded ? '...less' : '...more'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Views and Date */}
      {showViewsAndDate && (
        <View style={styles.metaInfo}>
          <Text style={styles.metaText}>
            {formatViewCount(views)} view{views === 1 ? '' : 's'}
          </Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>
            {formatDate(createdAt)}
          </Text>
        </View>
      )}

      {/* Full Caption Modal */}
      <Modal
        visible={showFullModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFullModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowFullModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Caption</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Modal Content */}
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.modalCaptionContainer}>
              {username && (
                <Text style={styles.modalUsername}>
                  {username}
                </Text>
              )}
              
              <Text style={styles.modalCaptionText}>
                {renderTextWithLinks(caption, true)}
              </Text>

              {/* Meta Info in Modal */}
              <View style={styles.modalMetaInfo}>
                <Text style={styles.modalMetaText}>
                  {formatViewCount(views)} view{views === 1 ? '' : 's'} • {formatDate(createdAt)}
                </Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  captionContainer: {
    position: 'relative',
  },
  username: {
    fontWeight: '600',
    color: '#000',
  },
  captionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#000',
  },
  hiddenText: {
    position: 'absolute',
    opacity: 0,
    zIndex: -1,
    fontSize: 14,
    lineHeight: 20,
  },
  linkText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  hashtagText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  mentionText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  readMoreButton: {
    marginTop: 4,
  },
  readMoreText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  metaText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 12,
    color: '#8E8E93',
    marginHorizontal: 6,
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalCaptionContainer: {
    flex: 1,
  },
  modalUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  modalCaptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#000',
  },
  modalMetaInfo: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E1E8ED',
  },
  modalMetaText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
});

export default ExpandableCaptionDisplay;
