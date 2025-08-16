import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Dimensions,
    Image,
    Modal,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatCount } from '../utils/formatUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Video {
  id: string;
  userId: string;
  username: string;
  caption: string;
  thumbnailUrl: string;
  videoUrl: string;
  playbackUrl: string;
  views: number;
  likes: number;
  createdAt: string;
  processed: boolean;
  status: string;
  uploadTab?: string;
  contentType?: string;
}

interface TrendsVideoPlayerProps {
  visible: boolean;
  video: Video;
  onClose: () => void;
}

const TrendsVideoPlayer: React.FC<TrendsVideoPlayerProps> = ({ visible, video, onClose }) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(video.likes || 0);
  const [showDescription, setShowDescription] = useState(false);

  // Format time ago
  const formatTimeAgo = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
    
    if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }, []);

  // Handle like toggle
  const handleLikeToggle = () => {
    setIsLiked(prev => !prev);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
  };

  // Navigate to user profile
  const navigateToUserProfile = () => {
    onClose();
    router.push({
      pathname: '/(tabs)/me',
      params: { userId: video.userId }
    });
  };

  // Handle share
  const handleShare = () => {
    // Implement share functionality
    console.log('Sharing video:', video.id);
  };

  if (!visible || !video) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Trending Video</Text>
            {video.uploadTab === 'Trends' && (
              <Text style={styles.headerSubtitle}>Posted to Trends</Text>
            )}
          </View>
          
          <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
            <Ionicons name="share-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Video Area - Using thumbnail for now */}
        <View style={styles.videoContainer}>
          <Image 
            source={{ uri: video.thumbnailUrl }} 
            style={styles.videoThumbnail}
            resizeMode="cover"
          />
          <View style={styles.playButtonOverlay}>
            <TouchableOpacity style={styles.playButton}>
              <Ionicons name="play" size={60} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Video Info Section */}
        <View style={styles.infoSection}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Title/Caption */}
            <View style={styles.titleSection}>
              <Text style={styles.videoTitle} numberOfLines={showDescription ? undefined : 2}>
                {video.caption}
              </Text>
              {video.caption.length > 100 && (
                <TouchableOpacity onPress={() => setShowDescription(!showDescription)}>
                  <Text style={styles.showMoreText}>
                    {showDescription ? 'Show less' : 'Show more'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Video Stats */}
            <View style={styles.statsSection}>
              <Text style={styles.statsText}>
                {formatCount(video.views)} views • {formatTimeAgo(video.createdAt)}
              </Text>
              {video.uploadTab === 'Trends' && (
                <View style={styles.trendingBadge}>
                  <Ionicons name="trending-up" size={16} color="#FF4500" />
                  <Text style={styles.trendingText}>Trending</Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity 
                style={[styles.actionButton, isLiked && styles.likedButton]} 
                onPress={handleLikeToggle}
              >
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={24} 
                  color={isLiked ? "#FF3040" : "#666"} 
                />
                <Text style={[styles.actionText, isLiked && styles.likedText]}>
                  {formatCount(likeCount)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="chatbubble-outline" size={24} color="#666" />
                <Text style={styles.actionText}>113</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                <Ionicons name="share-outline" size={24} color="#666" />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="bookmark-outline" size={24} color="#666" />
                <Text style={styles.actionText}>Save</Text>
              </TouchableOpacity>
            </View>

            {/* Channel Info */}
            <TouchableOpacity style={styles.channelSection} onPress={navigateToUserProfile}>
              <Image 
                source={{ uri: `https://via.placeholder.com/40x40.png?text=${video.username.charAt(0).toUpperCase()}` }}
                style={styles.channelAvatar}
              />
              <View style={styles.channelInfo}>
                <Text style={styles.channelName}>@{video.username}</Text>
                <Text style={styles.channelSubscribers}>1.57M subscribers</Text>
              </View>
              <TouchableOpacity style={styles.subscribeButton}>
                <Text style={styles.subscribeText}>Subscribe</Text>
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Comments Section */}
            <View style={styles.commentsSection}>
              <Text style={styles.commentsTitle}>Comments 113</Text>
              
              {/* Sample Comment */}
              <View style={styles.commentItem}>
                <Image 
                  source={{ uri: 'https://via.placeholder.com/32x32.png?text=U' }}
                  style={styles.commentAvatar}
                />
                <View style={styles.commentContent}>
                  <Text style={styles.commentAuthor}>@user123</Text>
                  <Text style={styles.commentText}>
                    செம்ம கலக்கல்! இந்த வீடியோ பார்த்ததுங்க...
                  </Text>
                  <View style={styles.commentActions}>
                    <Text style={styles.commentTime}>8d ago</Text>
                    <TouchableOpacity>
                      <Text style={styles.commentAction}>Like</Text>
                    </TouchableOpacity>
                    <TouchableOpacity>
                      <Text style={styles.commentAction}>Reply</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#FF4500',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  shareButton: {
    padding: 8,
  },
  videoContainer: {
    height: screenHeight * 0.4,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: -16,
    paddingTop: 20,
  },
  titleSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    lineHeight: 24,
  },
  showMoreText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  statsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 69, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  trendingText: {
    fontSize: 12,
    color: '#FF4500',
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  likedButton: {
    // Style for liked state
  },
  actionText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  likedText: {
    color: '#FF3040',
  },
  channelSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  channelAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  channelSubscribers: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  subscribeButton: {
    backgroundColor: '#FF0000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  subscribeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  commentsSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  commentTime: {
    fontSize: 12,
    color: '#666',
  },
  commentAction: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
});

export default TrendsVideoPlayer;
