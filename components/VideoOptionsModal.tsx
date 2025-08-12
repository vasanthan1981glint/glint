import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { videoDeleteService } from '../lib/videoDeleteService';
import ExpandableCaptionDisplay from './ExpandableCaptionDisplay';

interface VideoOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle?: string;
  videoCaption?: string;
  videoViews?: number;
  videoCreatedAt?: string;
  videoUsername?: string;
  isOwner: boolean;
  onVideoDeleted?: (videoId: string) => void;
}

const VideoOptionsModal: React.FC<VideoOptionsModalProps> = ({
  visible,
  onClose,
  videoId,
  videoTitle,
  videoCaption,
  videoViews = 0,
  videoCreatedAt,
  videoUsername,
  isOwner,
  onVideoDeleted
}) => {
  const insets = useSafeAreaInsets();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteVideo = async () => {
    try {
      setDeleting(true);
      
      const result = await videoDeleteService.confirmAndDeleteVideo(
        videoId, 
        videoTitle || 'this video'
      );
      
      if (result.success) {
        // Show success message
        Alert.alert(
          'Success',
          'Video deleted successfully',
          [
            {
              text: 'OK',
              onPress: () => {
                onVideoDeleted?.(videoId);
                onClose();
              }
            }
          ]
        );
      } else if (result.message !== 'Deletion cancelled') {
        // Show error message (but not if user cancelled)
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      console.error('Error in delete handler:', error);
      Alert.alert('Error', 'Failed to delete video. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleReportVideo = () => {
    Alert.alert(
      'Report Video',
      'This feature will be available soon.',
      [{ text: 'OK' }]
    );
  };

  const handleShareVideo = () => {
    Alert.alert(
      'Share Video',
      'This feature will be available soon.',
      [{ text: 'OK' }]
    );
  };

  const handleCopyLink = () => {
    Alert.alert(
      'Copy Link',
      'Link copied to clipboard!',
      [{ text: 'OK' }]
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Video Options</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Video Info */}
            <View style={styles.videoInfo}>
              {videoCaption && videoCreatedAt ? (
                <ExpandableCaptionDisplay
                  caption={videoCaption}
                  views={videoViews}
                  createdAt={videoCreatedAt}
                  username={videoUsername}
                  maxLines={3}
                  style={styles.expandableCaption}
                  textStyle={styles.captionDisplayText}
                  showViewsAndDate={true}
                />
              ) : (
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {videoTitle || 'Video'}
                </Text>
              )}
              {isOwner && (
                <View style={styles.ownerBadge}>
                  <Ionicons name="person" size={12} color="#007AFF" />
                  <Text style={styles.ownerText}>Your video</Text>
                </View>
              )}
            </View>

            {/* Options List */}
            <View style={styles.optionsList}>
              {/* Share Option */}
              <TouchableOpacity 
                style={styles.optionItem} 
                onPress={handleShareVideo}
                disabled={deleting}
              >
                <Ionicons name="share-outline" size={24} color="#333" />
                <Text style={styles.optionText}>Share Video</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              {/* Copy Link Option */}
              <TouchableOpacity 
                style={styles.optionItem} 
                onPress={handleCopyLink}
                disabled={deleting}
              >
                <Ionicons name="link-outline" size={24} color="#333" />
                <Text style={styles.optionText}>Copy Link</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>

              {/* Owner-only options */}
              {isOwner ? (
                <>
                  <View style={styles.separator} />
                  
                  {/* Delete Option (Owner only) */}
                  <TouchableOpacity 
                    style={[styles.optionItem, styles.dangerOption]} 
                    onPress={handleDeleteVideo}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <ActivityIndicator size="small" color="#FF3B30" />
                    ) : (
                      <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                    )}
                    <Text style={[styles.optionText, styles.dangerText]}>
                      {deleting ? 'Deleting...' : 'Delete Video'}
                    </Text>
                    {!deleting && <Ionicons name="chevron-forward" size={20} color="#FF3B30" />}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.separator} />
                  
                  {/* Report Option (Non-owners) */}
                  <TouchableOpacity 
                    style={styles.optionItem} 
                    onPress={handleReportVideo}
                    disabled={deleting}
                  >
                    <Ionicons name="flag-outline" size={24} color="#FF3B30" />
                    <Text style={[styles.optionText, styles.dangerText]}>Report Video</Text>
                    <Ionicons name="chevron-forward" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Cancel Button */}
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={onClose}
              disabled={deleting}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 8,
  },
  videoInfo: {
    marginBottom: 20,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    lineHeight: 22,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  ownerText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 4,
  },
  optionsList: {
    marginBottom: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    marginLeft: 16,
  },
  dangerOption: {
    // Additional styling for dangerous actions
  },
  dangerText: {
    color: '#FF3B30',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E5E5',
    marginVertical: 8,
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
  },
  expandableCaption: {
    marginVertical: 4,
  },
  captionDisplayText: {
    fontSize: 15,
    color: '#000',
    lineHeight: 20,
  },
});

export default VideoOptionsModal;
