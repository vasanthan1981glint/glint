import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  Clipboard,
  Alert,
  Linking,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EnhancedCaptionInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
  style?: any;
  multiline?: boolean;
  showPasteButton?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');
const MAX_CAPTION_LENGTH = 2200; // Instagram-like limit

const EnhancedCaptionInput: React.FC<EnhancedCaptionInputProps> = ({
  value,
  onChangeText,
  placeholder = "Write a caption...",
  maxLength = MAX_CAPTION_LENGTH,
  style,
  multiline = true,
  showPasteButton = true
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showCharCount, setShowCharCount] = useState(false);
  const textInputRef = useRef<TextInput>(null);

  const handlePaste = async () => {
    try {
      const clipboardContent = await Clipboard.getString();
      if (clipboardContent) {
        const newText = value + clipboardContent;
        if (newText.length <= maxLength) {
          onChangeText(newText);
        } else {
          Alert.alert(
            'Text too long',
            `Caption cannot exceed ${maxLength} characters. The pasted text will be trimmed.`,
            [
              {
                text: 'Cancel',
                style: 'cancel'
              },
              {
                text: 'Paste anyway',
                onPress: () => {
                  const trimmedText = newText.substring(0, maxLength);
                  onChangeText(trimmedText);
                }
              }
            ]
          );
        }
      } else {
        Alert.alert('Nothing to paste', 'Clipboard is empty');
      }
    } catch (error) {
      console.error('Error pasting from clipboard:', error);
      Alert.alert('Error', 'Failed to paste from clipboard');
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    setShowCharCount(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setShowCharCount(value.length > maxLength * 0.8); // Show count when near limit
  };

  const isNearLimit = value.length > maxLength * 0.8;
  const isOverLimit = value.length > maxLength;

  return (
    <View style={[styles.container, style]}>
      <View style={[
        styles.inputContainer,
        isFocused && styles.inputContainerFocused,
        isOverLimit && styles.inputContainerError
      ]}>
        <TextInput
          ref={textInputRef}
          style={[
            styles.textInput,
            multiline && styles.multilineInput
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#999"
          multiline={multiline}
          maxLength={maxLength}
          onFocus={handleFocus}
          onBlur={handleBlur}
          textAlignVertical="top"
          returnKeyType="default"
          blurOnSubmit={false}
        />
        
        {showPasteButton && (
          <TouchableOpacity
            style={styles.pasteButton}
            onPress={handlePaste}
          >
            <Ionicons name="clipboard-outline" size={20} color="#007AFF" />
            <Text style={styles.pasteText}>Paste</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Character Count */}
      {(showCharCount || isNearLimit) && (
        <View style={styles.footer}>
          <Text style={[
            styles.charCount,
            isNearLimit && styles.charCountWarning,
            isOverLimit && styles.charCountError
          ]}>
            {value.length}/{maxLength}
          </Text>
        </View>
      )}

      {/* Tips */}
      {isFocused && (
        <View style={styles.tips}>
          <Text style={styles.tipText}>
            💡 Add hashtags and mentions. Links will be clickable when posted.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: '#E1E8ED',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 100,
    position: 'relative',
  },
  inputContainerFocused: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: '#FF3B30',
  },
  textInput: {
    fontSize: 16,
    color: '#000',
    flex: 1,
    paddingRight: 80, // Space for paste button
  },
  multilineInput: {
    textAlignVertical: 'top',
    minHeight: 80,
  },
  pasteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pasteText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  charCount: {
    fontSize: 12,
    color: '#8E8E93',
  },
  charCountWarning: {
    color: '#FF9500',
  },
  charCountError: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  tips: {
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  tipText: {
    fontSize: 12,
    color: '#007AFF',
    lineHeight: 16,
  },
});

export default EnhancedCaptionInput;
