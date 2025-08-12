import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    ListRenderItemInfo,
    Platform,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    ViewToken
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth } from '../firebaseConfig';
import { ProfilePreloader } from '../lib/profilePreloader';
import type { UserProfile } from '../lib/userProfileService';
import { UserProfileService } from '../lib/userProfileService';
import { useUserStore } from '../lib/userStore';
import { formatCommentCount, formatLikeCount } from '../utils/formatUtils';
import SimpleProfileAvatar from './SimpleProfileAvatar';

dayjs.extend(relativeTime);

const { height: windowHeight } = Dimensions.get('window');

interface Reel {
  id: string;
  video: string;
  user: string;
  caption: string;
  song: string;
}

interface Comment {
  id: string;
  userId: string; // Store only userId reference like Glint
  text: string;
  timestamp: number;
}

export default function CommentSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Current user's profile from Zustand
  const { avatar: userAvatar, username: userUsername, setAvatar, setUsername } = useUserStore();
  
  // Debug: Log the current user data
  console.log('🔍 CommentSheet - Current user data:', { 
    userAvatar, 
    userUsername, 
    hasAvatar: !!userAvatar,
    hasUsername: !!userUsername,
    avatarLength: userAvatar?.length,
    usernameLength: userUsername?.length,
    authUserId: auth.currentUser?.uid,
    authUserEmail: auth.currentUser?.email
  });

  // Get userBio outside of useEffect
  const { bio: userBio } = useUserStore();
  
  // Set better default values if empty (for testing)
  React.useEffect(() => {
    console.log('🔍 CommentSheet useEffect - Current UserStore values:', { 
      userAvatar, 
      userUsername,
      userBio,
      defaultsNeeded: !userAvatar || !userUsername 
    });
    
    // Only set defaults if we truly have empty values
    if (!userAvatar || userAvatar === 'https://via.placeholder.com/150') {
      console.log('🔄 Setting default avatar (was empty/placeholder)');
      setAvatar('https://randomuser.me/api/portraits/men/32.jpg');
    }
    if (!userUsername || userUsername === 'glint_user') {
      console.log('🔄 Setting default username (was empty/default)');
      setUsername('glint_user_demo');
    }
  }, [userAvatar, userUsername, userBio]);  // Only run when these change
  const [comments, setComments] = useState<Comment[]>([
    // Sample comments with different user IDs for testing
    {
      id: '1',
      userId: 'current_user', // Change to current_user so it shows your profile
      text: 'Amazing video! 🔥',
      timestamp: Date.now() - 3600000,
    },
    {
      id: '2', 
      userId: 'current_user', // Change to current_user so it shows your profile
      text: 'Love this content!',
      timestamp: Date.now() - 1800000,
    }
  ]);
  const [userProfiles, setUserProfiles] = useState<{[userId: string]: UserProfile}>({
    // Pre-populate current user profile immediately
    'current_user': {
      userId: 'current_user',
      username: 'glint_user_demo',
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    },
    // Pre-populate some sample user profiles
    'user1': {
      userId: 'user1',
      username: 'alex_creator',
      avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    },
    'user2': {
      userId: 'user2', 
      username: 'sarah_explorer',
      avatar: 'https://randomuser.me/api/portraits/women/2.jpg',
    }
  });

  // Update current user profile when userStore changes
  React.useEffect(() => {
    const currentUserId = auth.currentUser?.uid || 'current_user';
    const displayUsername = userUsername && userUsername.trim() !== '' && userUsername !== 'glint_user' 
      ? userUsername 
      : 'glint_user_demo';
    const displayAvatar = userAvatar && userAvatar.trim() !== '' 
      ? userAvatar 
      : 'https://randomuser.me/api/portraits/men/32.jpg';
    
    console.log('Updating current user profile:', { currentUserId, displayUsername, displayAvatar });
    
    setUserProfiles(prev => ({
      ...prev,
      [currentUserId]: {
        userId: currentUserId,
        username: displayUsername,
        avatar: displayAvatar,
      }
    }));
  }, [userAvatar, userUsername]);
  const [input, setInput] = useState('');
  const [showComments, setShowComments] = useState(false);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const commentListRef = useRef<FlatList<Comment>>(null);

  const snapPoints = useMemo(() => ['60%', '90%'], []);

  // Load user profiles using Glint approach
  const loadUserProfilesForComments = async (comments: Comment[]) => {
    const uniqueUserIds = [...new Set(comments.map(c => c.userId))];
    const profilesToFetch = uniqueUserIds.filter(userId => !userProfiles[userId]);
    
    if (profilesToFetch.length === 0) return;

    // Use Glint-style batch fetch
    const fetchedProfiles = await UserProfileService.batchGetUserProfiles(profilesToFetch);
    setUserProfiles(prev => ({ ...prev, ...fetchedProfiles }));
  };

  // Load profiles when comments change
  useEffect(() => {
    if (comments.length > 0) {
      loadUserProfilesForComments(comments);
      
      // YouTube-style: Preload comment user images for instant loading
      const commentUserIds = [...new Set(comments.map(c => c.userId))];
      ProfilePreloader.preloadSpecificUsers(commentUserIds, 'high');
    }
  }, [comments]);

  // Setup real-time profile updates (Glint feature)
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    
    Object.keys(userProfiles).forEach(userId => {
      const unsubscribe = UserProfileService.subscribeToProfileUpdates(userId, (updatedProfile) => {
        if (updatedProfile) {
          setUserProfiles(prev => ({
            ...prev,
            [userId]: updatedProfile
          }));
        }
      });
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [Object.keys(userProfiles).join(',')]);

  const openComments = () => {
    setShowComments(true);
    setTimeout(() => bottomSheetRef.current?.snapToIndex(0), 100);
  };

  const closeComments = () => {
    bottomSheetRef.current?.close();
    setTimeout(() => setShowComments(false), 300);
  };

  const [reels, setReels] = useState<Reel[]>([
    {
      id: '1',
      video: 'https://cdn.pixabay.com/vimeo/721273159/City%20Traffic%20Timelapse%204k-112452.mp4',
      user: 'urban_flow',
      caption: 'City lights never sleep 🌃',
      song: 'Night Lights - Synth',
    },
  ]);

  const videoRefs = useRef<Video[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const [liked, setLiked] = useState<{ [key: string]: boolean }>({});
  const [likeCounts, setLikeCounts] = useState<{ [key: string]: number }>({});
  const scaleAnim = useRef<{ [key: string]: Animated.Value }>({});

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      const newReel: Reel = {
        id: Date.now().toString(),
        video: 'https://cdn.pixabay.com/vimeo/785840934/Space%20Nebula%204k-157741.mp4',
        user: 'space_dreamer',
        caption: 'The cosmos is calling 🚀',
        song: 'Galactic Echo',
      };
      setReels(prev => [newReel, ...prev]);
      setRefreshing(false);
    }, 1500);
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    videoRefs.current.forEach((player, index) => {
      if (!player) return;
      const isVisible = viewableItems.some((vi) => vi.index === index);
      isVisible ? player.playAsync() : player.pauseAsync();
    });
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.glintsText}>Glints</Text>
        <View style={styles.iconRow}>
          <TouchableOpacity>
            <Ionicons name="star-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push({ pathname: '/chat' } as any)}>
            <Ionicons name="chatbubble-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList<Reel>
        data={reels}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }: ListRenderItemInfo<Reel>) => (
          <View style={styles.reel}>
            <TouchableWithoutFeedback
              onPress={() => {
                const video = videoRefs.current[index];
                if (!video) return;
                video.getStatusAsync().then((status: AVPlaybackStatus) => {
                  if ('isPlaying' in status && status.isPlaying) {
                    video.pauseAsync();
                  } else {
                    video.playAsync();
                  }
                });
              }}
            >
              <Video
                ref={(ref) => {
                  if (ref) videoRefs.current[index] = ref;
                }}
                source={{ uri: item.video }}
                style={styles.video}
                resizeMode={ResizeMode.COVER}
                isLooping
                shouldPlay
                isMuted={false}
              />
            </TouchableWithoutFeedback>

            <View style={[styles.overlay, { paddingBottom: insets.bottom + 100 }]}>
              <View style={styles.leftText}>
                <Text style={styles.username}>@{item.user}</Text>
                <Text style={styles.caption}>{item.caption}</Text>
                <Text style={styles.song}>🎵 {item.song}</Text>
              </View>

              <View style={styles.rightIcons}>
                <TouchableOpacity
                  style={styles.icon}
                  onPress={() => {
                    const isLiked = liked[item.id];
                    const newValue = !isLiked;
                    setLiked(prev => ({ ...prev, [item.id]: newValue }));
                    setLikeCounts(prev => ({
                      ...prev,
                      [item.id]: (prev[item.id] || 0) + (newValue ? 1 : -1),
                    }));
                    if (!scaleAnim.current[item.id]) {
                      scaleAnim.current[item.id] = new Animated.Value(1);
                    }
                    Animated.sequence([
                      Animated.timing(scaleAnim.current[item.id], {
                        toValue: 1.5,
                        duration: 150,
                        useNativeDriver: true,
                      }),
                      Animated.timing(scaleAnim.current[item.id], {
                        toValue: 1,
                        duration: 150,
                        useNativeDriver: true,
                      }),
                    ]).start();
                  }}
                >
                  <Animated.View style={{ transform: [{ scale: scaleAnim.current[item.id] || new Animated.Value(1) }] }}>
                    <Ionicons
                      name={liked[item.id] ? 'heart' : 'heart-outline'}
                      size={28}
                      color={liked[item.id] ? 'red' : '#fff'}
                    />
                  </Animated.View>
                  <Text style={styles.iconText}>{formatLikeCount(likeCounts[item.id] || 0)}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.icon} onPress={openComments}>
                  <Ionicons name="chatbubble-outline" size={28} color="#fff" />
                  <Text style={styles.iconText}>{formatCommentCount(comments.length)}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.icon}>
                  <Ionicons name="arrow-redo-outline" size={28} color="#fff" />
                  <Text style={styles.iconText}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.icon}>
                  <Ionicons name="bookmark-outline" size={28} color="#fff" />
                  <Text style={styles.iconText}>Save</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.icon}>
                  <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        pagingEnabled
        snapToInterval={windowHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        bounces={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={['#fff']}
            progressBackgroundColor="#000"
          />
        }
      />

      {showComments && (
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          onClose={closeComments}
          enablePanDownToClose
          backgroundStyle={{ backgroundColor: '#fff' }}
          handleIndicatorStyle={{ backgroundColor: '#ccc' }}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 }}>
              <TouchableOpacity onPress={closeComments}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
              <Text style={{ flex: 1, textAlign: 'center', fontWeight: '600', fontSize: 16 }}>
                Comments ({comments.length})
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <FlatList<Comment>
              ref={commentListRef}
              data={comments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }: ListRenderItemInfo<Comment>) => {
                // Get user profile from cache by userId
                const userProfile = userProfiles[item.userId];
                
                console.log('Rendering comment:', { 
                  itemUserId: item.userId, 
                  userProfile, 
                  allProfiles: Object.keys(userProfiles) 
                });
                
                // Better fallbacks for avatar and username
                const avatar = userProfile?.avatar && userProfile.avatar.trim() !== ''
                  ? userProfile.avatar 
                  : 'https://randomuser.me/api/portraits/men/32.jpg';
                const username = userProfile?.username && userProfile.username.trim() !== ''
                  ? userProfile.username 
                  : (item.userId === 'current_user' ? 'glint_user_demo' : 'Unknown User');
                
                return (
                  <View style={styles.igCommentRow}>
                    <SimpleProfileAvatar 
                      userId={item.userId}
                      imageURI={avatar}
                      username={username}
                      size={32}
                      style={styles.igAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.igUsername}>@{username}</Text>
                      <Text style={styles.igComment}>{item.text}</Text>
                    </View>
                  </View>
                );
              }}
            />

            <View style={styles.igInputRow}>
              {/* Current user's avatar */}
              <SimpleProfileAvatar 
                userId={auth.currentUser?.uid || 'current_user'}
                imageURI={userAvatar && userAvatar.trim() !== '' && userAvatar !== 'https://via.placeholder.com/150'
                  ? userAvatar 
                  : undefined} // Let component handle fallback
                username={userUsername && userUsername.trim() !== '' && userUsername !== 'glint_user' 
                  ? userUsername 
                  : `user_${auth.currentUser?.uid?.slice(-4) || 'demo'}`}
                size={32}
                style={styles.igAvatar}
              />
                <TextInput
                  placeholder="Add a comment..."
                  placeholderTextColor="#999"
                  value={input}
                  onChangeText={setInput}
                  style={styles.igTextInput}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (input.trim()) {
                      // Use a fallback user ID if not authenticated
                      const currentUserId = auth.currentUser?.uid || 'current_user';
                      const displayUsername = userUsername && userUsername.trim() !== '' && userUsername !== 'glint_user' 
                        ? userUsername 
                        : 'glint_user_demo';
                      const displayAvatar = userAvatar && userAvatar.trim() !== '' 
                        ? userAvatar 
                        : 'https://randomuser.me/api/portraits/men/32.jpg';
                      
                      console.log('Posting comment with:', { displayUsername, displayAvatar, currentUserId });
                      
                      const newComment: Comment = {
                        id: Date.now().toString(),
                        userId: currentUserId,
                        text: input,
                        timestamp: Date.now(),
                      };
                      
                      // Add current user's profile to cache for immediate display
                      setUserProfiles(prev => ({
                        ...prev,
                        [currentUserId]: {
                          userId: currentUserId,
                          username: displayUsername,
                          avatar: displayAvatar,
                        }
                      }));
                      
                      setComments((prev) => [...prev, newComment]);
                      setInput('');
                      setTimeout(() => {
                        commentListRef.current?.scrollToEnd({ animated: true });
                      }, 100);
                    }
                  }}
                >
                  <Text style={styles.igPostText}>Post</Text>
                </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </BottomSheet>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    zIndex: 100,
    width: '100%',
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  glintsText: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  iconRow: { flexDirection: 'row', gap: 18 },
  reel: { height: windowHeight, width: '100%', backgroundColor: '#000' },
  video: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, width: '100%', height: '100%' },
  overlay: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 16, flexDirection: 'row' },
  leftText: { flex: 1, justifyContent: 'flex-end', paddingBottom: 8 },
  rightIcons: { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 },
  username: { color: '#fff', fontWeight: 'bold', fontSize: 17, marginBottom: 6 },
  caption: { color: '#fff', fontSize: 15, marginBottom: 6 },
  song: { color: '#ccc', fontSize: 13, marginBottom: 14 },
  icon: { marginBottom: 16, alignItems: 'center' },
  iconText: { color: '#fff', fontSize: 12, marginTop: 4 },

  igCommentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  igAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  igUsername: { fontWeight: '600', fontSize: 14, marginBottom: 2, color: '#000' },
  igComment: { fontSize: 14, color: '#333' },
  igInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopColor: '#eee',
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  igTextInput: { flex: 1, fontSize: 14, paddingHorizontal: 10 },
  igPostText: { color: '#0095f6', fontWeight: '600', fontSize: 14 },
});
