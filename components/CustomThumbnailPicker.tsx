import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

interface CustomThumbnailPickerProps {
  selectedThumbnail?: string;
  onThumbnailSelect: (uri: string) => void;
  caption?: string;
  onCaptionChange?: (caption: string) => void;
  style?: any;
}

export default function CustomThumbnailPicker({
  selectedThumbnail,
  onThumbnailSelect,
  caption = '',
  onCaptionChange,
  style
}: CustomThumbnailPickerProps) {
  const [customThumbnail, setCustomThumbnail] = useState<string | null>(null);

  const pickCustomThumbnail = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo library access to upload custom thumbnails');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setCustomThumbnail(uri);
        onThumbnailSelect(uri);
      }
    } catch (error) {
      console.error('Error picking custom thumbnail:', error);
      Alert.alert('Error', 'Failed to pick custom thumbnail');
    }
  };

  const selectPlaceholderThumbnail = (time: number) => {
    const placeholderUrl = `placeholder:${time}`;
    onThumbnailSelect(placeholderUrl);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, style]}>
      <Text style={styles.title}>Choose Thumbnail</Text>
      
      {/* Auto-Generated Thumbnails */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Auto-Generated</Text>
        <View style={styles.thumbnailGrid}>
          {[2, 5, 8, 12].map((time) => (
            <TouchableOpacity
              key={time}
              style={[
                styles.thumbnailOption,
                selectedThumbnail === `placeholder:${time}` && styles.selectedThumbnail
              ]}
              onPress={() => {
                selectPlaceholderThumbnail(time);
              }}
            >
              <View style={[styles.thumbnail, styles.placeholderThumbnail]}>
                <Text style={styles.placeholderText}>Frame {time}s</Text>
              </View>
              <Text style={styles.timeLabel}>{time}s</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Animated Preview Option */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Animated Preview</Text>
        <TouchableOpacity
          style={[
            styles.animatedOption,
            selectedThumbnail === 'placeholder:animated' && styles.selectedThumbnail
          ]}
          onPress={() => {
            onThumbnailSelect('placeholder:animated');
          }}
        >
          <View style={[styles.animatedPreview, styles.placeholderThumbnail]}>
            <Text style={styles.placeholderText}>Animated Preview</Text>
            <Text style={styles.placeholderText}>2-7s</Text>
          </View>
          <Text style={styles.animatedLabel}>2-7s Preview</Text>
        </TouchableOpacity>
      </View>

      {/* Custom Thumbnail Option */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Custom Thumbnail</Text>
        <TouchableOpacity
          style={[
            styles.customOption,
            selectedThumbnail === customThumbnail && styles.selectedThumbnail
          ]}
          onPress={pickCustomThumbnail}
        >
          {customThumbnail ? (
            <Image source={{ uri: customThumbnail }} style={styles.customThumbnail} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Text style={styles.uploadText}>📷</Text>
              <Text style={styles.uploadText}>Upload Custom</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Caption Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Caption</Text>
        <TextInput
          style={styles.captionInput}
          placeholder="Write a caption for your video... 💬"
          placeholderTextColor="#999"
          value={caption}
          onChangeText={onCaptionChange}
          multiline
          maxLength={200}
          textAlignVertical="top"
          returnKeyType="done"
          blurOnSubmit={true}
          onSubmitEditing={Keyboard.dismiss}
        />
        <Text style={styles.captionCounter}>{caption?.length || 0}/200</Text>
      </View>
    </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#666',
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumbnailOption: {
    alignItems: 'center',
    borderRadius: 8,
    padding: 4,
  },
  thumbnail: {
    width: 80,
    height: 45,
    borderRadius: 6,
  },
  timeLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  animatedOption: {
    alignItems: 'center',
    borderRadius: 8,
    padding: 4,
  },
  animatedPreview: {
    width: 160,
    height: 90,
    borderRadius: 6,
  },
  animatedLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  customOption: {
    borderRadius: 8,
    padding: 4,
  },
  customThumbnail: {
    width: 160,
    height: 90,
    borderRadius: 6,
  },
  uploadPlaceholder: {
    width: 160,
    height: 90,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  uploadText: {
    color: '#999',
    fontSize: 14,
  },
  selectedThumbnail: {
    borderWidth: 3,
    borderColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  captionInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    minHeight: 80,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  captionCounter: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 8,
  },
  placeholderThumbnail: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  placeholderText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
