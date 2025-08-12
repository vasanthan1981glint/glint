import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { UniversalVideoPlayer } from '../components/UniversalVideoPlayer';
import { useDeviceAdapter } from '../lib/deviceAdaptation';
import GlintCommentModal from './GlintCommentModal';

interface Reel {
  id: string;
  video: string;
  user: string;
  caption: string;
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
}

export const UniversalHomeScreen: React.FC = () => {
  // Device adaptation for universal compatibility
  const { screenDimensions, videoContainer, responsiveUI, safeAreaInsets } = useDeviceAdapter();
  
  // Get native screen dimensions for absolute full screen
  const nativeScreenHeight = Dimensions.get('window').height;
  const nativeScreenWidth = Dimensions.get('window').width;
  
  // Sample data
  const [reels] = useState<Reel[]>([
    {
      id: '1',
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      user: 'creator_1',
      caption: 'Amazing video content! 🔥',
      likes: 1234,
      comments: 89,
      shares: 45,
      isLiked: false,
    },
    {
      id: '2',
      video: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      user: 'creator_2',
      caption: 'Check this out! 🎬',
      likes: 2567,
      comments: 156,
      shares: 78,
      isLiked: true,
    },
    // Add more reels as needed
  ]);

  // State management
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [currentReelId, setCurrentReelId] = useState<string>('');
  const [preloadedIndexes, setPreloadedIndexes] = useState<Set<number>>(new Set([0, 1]));
  
  // Refs
  const flatListRef = useRef<FlatList>(null);
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 300,
  });

  // 8. Safe Area & Orientation Handling
  useEffect(() => {
    // Set status bar style based on platform
    if (Platform.OS === 'ios') {
      StatusBar.setBarStyle('light-content', true);
    } else {
      StatusBar.setBarStyle('light-content', true);
      StatusBar.setBackgroundColor('transparent', true);
      StatusBar.setTranslucent(true);
    }
  }, []);

  // 5. Lazy Load and Preload Videos
  const preloadAdjacentVideos = useCallback((index: number) => {
    const newPreloadedIndexes = new Set(preloadedIndexes);
    
    // Preload current, next, and previous videos
    [-1, 0, 1].forEach(offset => {
      const targetIndex = index + offset;
      if (targetIndex >= 0 && targetIndex < reels.length) {
        newPreloadedIndexes.add(targetIndex);
      }
    });
    
    setPreloadedIndexes(newPreloadedIndexes);
  }, [preloadedIndexes, reels.length]);

  // Handle viewability change for auto-play control
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      setCurrentIndex(newIndex);
      preloadAdjacentVideos(newIndex);
    }
  }, [preloadAdjacentVideos]);

  // 4. Handle Vertical Swipe Gestures
  const handleSwipeUp = useCallback(() => {
    const nextIndex = Math.min(currentIndex + 1, reels.length - 1);
    if (nextIndex !== currentIndex) {
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }
  }, [currentIndex, reels.length]);

  const handleSwipeDown = useCallback(() => {
    const prevIndex = Math.max(currentIndex - 1, 0);
    if (prevIndex !== currentIndex) {
      flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
    }
  }, [currentIndex]);

  // Comment modal handlers
  const openComments = (reelId: string) => {
    setCurrentReelId(reelId);
    setShowComments(true);
  };

  const closeComments = () => {
    setShowComments(false);
    setCurrentReelId('');
  };

  // Format numbers for display
  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    } else if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  };

  // 2. Render Video Container with YouTube Shorts Style Layout
  const renderReel = ({ item, index }: { item: Reel; index: number }) => {
    const isActive = index === currentIndex;
    const isVisible = Math.abs(index - currentIndex) <= 1;
    const shouldPreload = preloadedIndexes.has(index);

    return (
      <View style={[
        universalHomeStyles.reelContainer,
        {
          width: nativeScreenWidth,  // Use native full screen width
          height: nativeScreenHeight, // Use native full screen height
        }
      ]}>
        {/* Full Screen Video Player - YouTube Shorts Style */}
        <UniversalVideoPlayer
          videoUri={item.video}
          isVisible={isVisible}
          isActive={isActive}
          onSwipeUp={handleSwipeUp}
          onSwipeDown={handleSwipeDown}
          onLoadStart={() => console.log(`Loading video ${index}`)}
          onLoadComplete={() => console.log(`Video ${index} loaded`)}
          style={universalHomeStyles.fullScreenVideo}
        />

        {/* YouTube Shorts Progress Bar */}
        <View style={[
          universalHomeStyles.progressBarContainer,
          {
            top: safeAreaInsets.top + 10,
            left: responsiveUI.spacingM,
            right: responsiveUI.spacingM,
          }
        ]}>
          <View style={universalHomeStyles.progressBarBackground}>
            <Animated.View 
              style={[
                universalHomeStyles.progressBarFill,
                { 
                  width: `${Math.random() * 100}%` // TODO: Connect to actual video progress
                }
              ]} 
            />
          </View>
        </View>

        {/* YouTube Shorts Style UI Overlays */}
        
        {/* Top safe area overlay */}
        <View style={[
          universalHomeStyles.topOverlay,
          { 
            paddingTop: safeAreaInsets.top,
            height: safeAreaInsets.top + 60,
          }
        ]} />
        
        {/* Bottom gradient for better text visibility */}
        <View style={[
          universalHomeStyles.bottomGradient,
          { 
            height: 200,
            bottom: 0,
          }
        ]} />

        {/* Right Side Action Buttons - YouTube Style */}
        <View style={[
          universalHomeStyles.rightActionBar,
          {
            right: responsiveUI.spacingM,
            bottom: safeAreaInsets.bottom + 100, // Much closer to bottom tabs
            width: responsiveUI.buttonLarge + 20,
          }
        ]}>
          {/* Creator Profile Picture */}
          <TouchableOpacity style={[
            universalHomeStyles.profileButton,
            { 
              width: responsiveUI.buttonLarge,
              height: responsiveUI.buttonLarge,
              marginBottom: responsiveUI.spacingL,
            }
          ]}>
            <View style={[
              universalHomeStyles.profilePic,
              { 
                width: responsiveUI.buttonLarge,
                height: responsiveUI.buttonLarge,
                borderRadius: responsiveUI.buttonLarge / 2,
              }
            ]}>
              <Text style={[universalHomeStyles.profileInitial, { fontSize: responsiveUI.fontLarge }]}>
                {item.user[0].toUpperCase()}
              </Text>
            </View>
            {/* Follow plus icon */}
            <View style={[
              universalHomeStyles.followPlusIcon,
              { 
                width: 24,
                height: 24,
                bottom: -4,
              }
            ]}>
              <Ionicons name="add" size={16} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Like Button */}
          <TouchableOpacity 
            style={[universalHomeStyles.actionButton, { marginBottom: responsiveUI.spacingL }]}
            onPress={() => {/* Handle like */}}
          >
            <Ionicons 
              name={item.isLiked ? "heart" : "heart-outline"} 
              size={responsiveUI.iconXL} 
              color={item.isLiked ? "#ff3040" : "#fff"} 
            />
            <Text style={[universalHomeStyles.actionCount, { fontSize: responsiveUI.fontSmall }]}>
              {formatCount(item.likes)}
            </Text>
          </TouchableOpacity>

          {/* Comment Button */}
          <TouchableOpacity 
            style={[universalHomeStyles.actionButton, { marginBottom: responsiveUI.spacingL }]}
            onPress={() => openComments(item.id)}
          >
            <Ionicons name="chatbubble-outline" size={responsiveUI.iconXL} color="#fff" />
            <Text style={[universalHomeStyles.actionCount, { fontSize: responsiveUI.fontSmall }]}>
              {formatCount(item.comments)}
            </Text>
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity 
            style={[universalHomeStyles.actionButton, { marginBottom: responsiveUI.spacingL }]}
            onPress={() => {/* Handle share */}}
          >
            <Ionicons name="arrow-redo-outline" size={responsiveUI.iconXL} color="#fff" />
            <Text style={[universalHomeStyles.actionCount, { fontSize: responsiveUI.fontSmall }]}>
              {formatCount(item.shares)}
            </Text>
          </TouchableOpacity>

          {/* More Options */}
          <TouchableOpacity 
            style={universalHomeStyles.actionButton}
            onPress={() => {/* Handle more options */}}
          >
            <Ionicons name="ellipsis-horizontal" size={responsiveUI.iconLarge} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Bottom Left Content Info - YouTube Style */}
        <View style={[
          universalHomeStyles.bottomContent,
          {
            left: responsiveUI.spacingM,
            right: 100, // Leave space for right action bar
            bottom: safeAreaInsets.bottom + 120, // Much closer to bottom tabs
            maxHeight: 200,
          }
        ]}>
          {/* User Profile Info - YouTube Shorts Style */}
          <TouchableOpacity style={universalHomeStyles.userNameRow}>
            <Text style={[universalHomeStyles.username, { fontSize: responsiveUI.fontLarge }]}>
              @{item.user}
            </Text>
            <Ionicons name="checkmark-circle" size={16} color="#1DA1F2" style={{ marginLeft: 4 }} />
            
            {/* Follow Button - Inline with username */}
            <TouchableOpacity style={[
              universalHomeStyles.followButtonInline,
              { 
                marginLeft: responsiveUI.spacingM,
                paddingHorizontal: responsiveUI.spacingM,
                paddingVertical: responsiveUI.spacingS,
              }
            ]}>
              <Text style={[universalHomeStyles.followTextInline, { fontSize: responsiveUI.fontSmall }]}>
                Follow
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Video Description with hashtags and mentions */}
          <View style={universalHomeStyles.descriptionContainer}>
            <Text 
              style={[universalHomeStyles.caption, { fontSize: responsiveUI.fontMedium }]}
              numberOfLines={2}
            >
              {item.caption.split(' ').map((word, index) => {
                if (word.startsWith('#')) {
                  return (
                    <Text key={index} style={universalHomeStyles.hashtag}>
                      {word}{' '}
                    </Text>
                  );
                } else if (word.startsWith('@')) {
                  return (
                    <Text key={index} style={universalHomeStyles.mention}>
                      {word}{' '}
                    </Text>
                  );
                } else {
                  return word + ' ';
                }
              })}
            </Text>
            
            {/* Show more button */}
            <TouchableOpacity style={universalHomeStyles.showMoreButton}>
              <Text style={[universalHomeStyles.showMoreText, { fontSize: responsiveUI.fontSmall }]}>
                more
              </Text>
            </TouchableOpacity>
          </View>

          {/* Music/Audio Info - YouTube Shorts Style */}
          <TouchableOpacity style={[
            universalHomeStyles.musicRow,
            { marginTop: responsiveUI.spacingS }
          ]}>
            <Ionicons name="musical-notes" size={14} color="#fff" />
            <Text style={[universalHomeStyles.musicText, { fontSize: responsiveUI.fontSmall }]}>
              Original Audio - {item.user}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={universalHomeStyles.container}>
      {/* Full-screen YouTube Shorts style video feed */}
      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={renderReel}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={nativeScreenHeight} // Use native full screen height
        snapToAlignment="center"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        // Performance optimizations for better full-screen
        removeClippedSubviews={false}
        maxToRenderPerBatch={1}
        windowSize={1}
        initialNumToRender={1}
        bounces={false}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        getItemLayout={(_, index) => ({
          length: nativeScreenHeight,
          offset: nativeScreenHeight * index,
          index,
        })}
      />

      {/* Glint Comment Modal */}
      <GlintCommentModal
        visible={showComments}
        onClose={closeComments}
        postId={currentReelId}
        comments={[
          { 
            id: '1', 
            user: 'user1', 
            text: 'Amazing content!', 
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
            avatar: 'https://via.placeholder.com/40',
            likes: 5
          },
          { 
            id: '2', 
            user: 'user2', 
            text: 'Love this! 🔥', 
            timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1h ago
            avatar: 'https://via.placeholder.com/40',
            likes: 2
          },
        ]}
        commentsLoading={false}
        hasMoreComments={false}
        totalComments={2}
        addComment={async (text: string, parentId?: string, userProfile?: any) => {
          console.log('Add comment:', text, 'parentId:', parentId);
        }}
        deleteComment={async (commentId: string) => {
          console.log('Delete comment:', commentId);
        }}
        loadMoreComments={async () => {
          console.log('Load more comments');
        }}
        refreshComments={async () => {
          console.log('Refresh comments');
        }}
        commentLikes={{}}
        commentLikeCounts={{}}
        toggleCommentLike={async (commentId: string) => {
          console.log('Toggle like for comment:', commentId);
        }}
        currentUserProfile={{
          avatar: 'https://via.placeholder.com/40',
          username: 'currentUser'
        }}
        navigateToUser={(username: string) => {
          console.log('Navigate to user:', username);
        }}
        onReportComment={async (commentId: string, reason: string, details?: string) => {
          console.log('Report comment:', commentId, 'reason:', reason);
        }}
      />
    </View>
  );
};

const universalHomeStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  reelContainer: {
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden', // Prevent any content overflow
  },
  
  // Full screen video
  fullScreenVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  
  // Top overlay for status bar area
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 10,
  },
  
  // Right action bar (YouTube style)
  rightActionBar: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 20,
  },
  
  // Profile button with plus icon
  profileButton: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  profilePic: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  
  profileInitial: {
    color: '#fff',
    fontWeight: 'bold',
  },
  
  followPlusIcon: {
    position: 'absolute',
    backgroundColor: '#ff3040',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Action buttons
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  
  actionCount: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  // Bottom content area
  bottomContent: {
    position: 'absolute',
    zIndex: 15,
  },
  
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  
  musicText: {
    color: '#fff',
    marginLeft: 4,
    fontWeight: '500',
  },

  // Progress Bar Styles
  progressBarContainer: {
    position: 'absolute',
    zIndex: 30,
    height: 4,
  },
  
  progressBarBackground: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ff3040',
    borderRadius: 2,
  },

  // Enhanced user profile styles
  followButtonInline: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginLeft: 8,
  },
  
  followTextInline: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  
  // Enhanced description styles
  descriptionContainer: {
    marginBottom: 8,
  },
  
  hashtag: {
    color: '#54a3ff',
    fontWeight: '600',
  },
  
  mention: {
    color: '#fff',
    fontWeight: '600',
  },
  
  showMoreButton: {
    marginTop: 2,
  },
  
  showMoreText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    fontSize: 13,
  },

  // Legacy styles for compatibility
  videoPlayer: {
    flex: 1,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  actionButtons: {
    position: 'absolute',
    alignItems: 'center',
    gap: 16,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  userInfo: {
    position: 'absolute',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  username: {
    color: '#fff',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  followButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  followText: {
    color: '#fff',
    fontWeight: '600',
  },
  caption: {
    color: '#fff',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default UniversalHomeScreen;
