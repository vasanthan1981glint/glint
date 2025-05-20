import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [messages] = useState([
    { id: '1', text: 'Hi', read: true },
    { id: '2', text: 'New message!', read: false },
    { id: '3', text: 'Yo!', read: false },
  ]);
  const unreadMessages = messages.filter((m) => !m.read).length;
  const formatBadgeCount = (count: number) => (count > 99 ? '99+' : count.toString());

  const [reels, setReels] = useState([
    {
      id: '1',
      video: 'https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4',
      user: 'glint_user1',
      caption: 'Living the moment ✨',
      song: 'Cool Beat - DJ Mix',
    },
    {
      id: '2',
      video: 'https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4',
      user: 'glint_user2',
      caption: 'Nature hits different 🌿',
      song: 'Vibes - Chillhop',
    },
  ]);

  const videoRefs = useRef<Video[]>([]);
  const [pausedIndexes, setPausedIndexes] = useState<number[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const togglePlayPause = (index: number) => {
    const video = videoRefs.current[index];
    if (!video) return;
    const isPaused = pausedIndexes.includes(index);
    isPaused ? video.playAsync() : video.pauseAsync();
    setPausedIndexes(
      isPaused ? pausedIndexes.filter(i => i !== index) : [...pausedIndexes, index]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      const newReel = {
        id: Date.now().toString(),
        video: 'https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4',
        user: 'new_user_' + Math.floor(Math.random() * 1000),
        caption: '🔥 New reel just dropped!',
        song: 'Fresh Beat - AutoMix',
      };
      setReels((prev) => [newReel, ...prev]);
      setRefreshing(false);
    }, 1500);
  };

  const viewabilityConfig = { itemVisiblePercentThreshold: 80 };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    videoRefs.current.forEach((player, index) => {
      if (!player) return;
      const isVisible = viewableItems.some((vi: any) => vi.index === index);
      isVisible ? player.playAsync() : player.pauseAsync();
    });
    setPausedIndexes([]);
  });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <FlatList
        data={reels}
        keyExtractor={(item) => item.id}
        pagingEnabled
        snapToAlignment="start"
        decelerationRate="fast"
        snapToInterval={height}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={['#fff']}
            progressBackgroundColor="#000"
          />
        }
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => (
          <View style={styles.container}>
            <TouchableWithoutFeedback onPress={() => togglePlayPause(index)}>
              <Video
                ref={(ref) => {
                  if (ref) videoRefs.current[index] = ref;
                }}
                source={{ uri: item.video }}
                style={styles.video}
                resizeMode={ResizeMode.COVER}
                isLooping
              />
            </TouchableWithoutFeedback>

            <View style={styles.overlay}>
              <View style={[
                styles.bottomLeft,
                { bottom: Platform.OS === 'ios' ? insets.bottom + 100 : 100 }
              ]}>
                <Text style={styles.username}>@{item.user}</Text>
                <Text style={styles.caption}>{item.caption}</Text>
                <Text style={styles.song}>🎵 {item.song}</Text>
              </View>

              <View style={[
                styles.rightIcons,
                { bottom: Platform.OS === 'ios' ? insets.bottom + 100 : 100 }
              ]}>
                <TouchableOpacity style={styles.icon}>
                  <Ionicons name="heart-outline" size={28} color="#fff" />
                  <Text style={styles.iconText}>124K</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.icon}>
                  <Ionicons name="chatbubble-outline" size={28} color="#fff" />
                  <Text style={styles.iconText}>91</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.icon}>
                  <Ionicons name="arrow-redo-outline" size={28} color="#fff" />
                  <Text style={styles.iconText}>Share</Text>
                </TouchableOpacity>
                <Image
                  source={{ uri: 'https://via.placeholder.com/40' }}
                  style={styles.profilePic}
                />
                <TouchableOpacity style={[styles.icon, { marginTop: 20 }]}>
                  <Ionicons name="ellipsis-vertical" size={26} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      {/* ✅ Top Bar (moved down properly) */}
      <View style={[styles.topBar, { top: insets.top + 10 }]}>
        <TouchableOpacity>
          <Ionicons name="camera-outline" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 18 }}>
          <TouchableOpacity>
            <Ionicons name="star-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/chat')} style={{ position: 'relative' }}>
            <Ionicons name="chatbubble-outline" size={24} color="#fff" />
            {unreadMessages > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{formatBadgeCount(unreadMessages)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  container: {
    height: height,
    width: '100%',
    backgroundColor: '#000',
  },
  video: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    bottom: 0,
    justifyContent: 'space-between',
  },
  bottomLeft: {
    position: 'absolute',
    left: 0,
  },
  rightIcons: {
    position: 'absolute',
    right: 0,
    alignItems: 'center',
  },
  username: { color: '#fff', fontWeight: 'bold', fontSize: 17, marginBottom: 6 },
  caption: { color: '#fff', fontSize: 15, marginBottom: 6 },
  song: { color: '#ccc', fontSize: 13, marginBottom: 14 },
  icon: { marginBottom: 12, alignItems: 'center' },
  iconText: { color: '#fff', fontSize: 12, marginTop: 4 },
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    marginTop: 8,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 200,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: 'red',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 12,
  },
});
