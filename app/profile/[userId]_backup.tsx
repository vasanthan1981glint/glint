import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, increment, query, setDoc, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EnhancedVideoGrid from '../../components/EnhancedVideoGrid';
import { VerticalVideoPlayer } from '../../components/VerticalVideoPlayer';
import { auth, db } from '../../firebaseConfig';
import { formatCount } from '../../utils/formatUtils';

const screenWidth = Dimensions.get('window').width;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  // Check if viewing another user's profile
  const viewingUserId = params.userId as string;
  const isOwnProfile = !viewingUserId || viewingUserId === auth.currentUser?.uid;

  // Basic profile state
  const [username, setUsername] = useState('glint_user');
  const [bio, setBio] = useState('Welcome to Glint ✨');
  const [avatar, setAvatar] = useState('https://via.placeholder.com/150');
  const [glints, setGlints] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'Glints' | 'Picks'>('Glints');
  const [refreshKey, setRefreshKey] = useState(0);

  // Video player state
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<any[]>([]);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);

  // Menu state for report/block
  const [showActionMenu, setShowActionMenu] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      // Determine which user's profile to fetch
      const targetUserId = viewingUserId || currentUser.uid;
      setProfileUserId(targetUserId);

      try {
        // Fetch the target user's profile
        const userDoc = await getDoc(doc(db, 'users', targetUserId));
        if (userDoc.exists()) {
          const data = userDoc.data();

          setUsername(data.username || 'glint_user');
          setBio(data.bio || 'Welcome to Glint ✨');
          setAvatar(data.photo || 'https://via.placeholder.com/150');
          setFollowers(data.followers || 0);
          setFollowing(data.following || 0);

          // Count user's videos for accurate glint count
          const videosQuery = query(
            collection(db, 'videos'),
            where('userId', '==', targetUserId)
          );
          const videosSnapshot = await getDocs(videosQuery);
          setGlints(videosSnapshot.size);

          // If not own profile, check follow status
          if (!isOwnProfile) {
            await checkFollowStatus(currentUser.uid, targetUserId);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, [viewingUserId, isOwnProfile]);

  // Check if current user is following the profile user
  const checkFollowStatus = async (currentUserId: string, targetUserId: string) => {
    try {
      const followDoc = await getDoc(doc(db, 'follows', `${currentUserId}_${targetUserId}`));
      setIsFollowing(followDoc.exists());
    } catch (error) {
      console.error('❌ Error checking follow status:', error);
    }
  };

  // Handle follow/unfollow
  const handleFollowToggle = async () => {
    if (!auth.currentUser || !profileUserId || followLoading) return;
    
    setFollowLoading(true);
    
    try {
      const currentUserId = auth.currentUser.uid;
      const followDocId = `${currentUserId}_${profileUserId}`;
      const followDoc = doc(db, 'follows', followDocId);
      
      if (isFollowing) {
        // Unfollow
        await setDoc(followDoc, { deleted: true });
        await updateDoc(doc(db, 'users', profileUserId), {
          followers: increment(-1)
        });
        await updateDoc(doc(db, 'users', currentUserId), {
          following: increment(-1)
        });
        
        setIsFollowing(false);
        setFollowers(prev => prev - 1);
      } else {
        // Follow
        await setDoc(followDoc, {
          followerId: currentUserId,
          followingId: profileUserId,
          createdAt: new Date().toISOString()
        });
        await updateDoc(doc(db, 'users', profileUserId), {
          followers: increment(1)
        });
        await updateDoc(doc(db, 'users', currentUserId), {
          following: increment(1)
        });
        
        setIsFollowing(true);
        setFollowers(prev => prev + 1);
      }
    } catch (error) {
      console.error('❌ Error toggling follow:', error);
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    } finally {
      setFollowLoading(false);
    }
  };

  // Handle report/block actions
  const handleReportUser = () => {
    setShowActionMenu(false);
    Alert.alert(
      'Report User',
      'What would you like to report this user for?',
      [
        { text: 'Inappropriate Content', onPress: () => console.log('Reported for inappropriate content') },
        { text: 'Spam', onPress: () => console.log('Reported for spam') },
        { text: 'Harassment', onPress: () => console.log('Reported for harassment') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleBlockUser = () => {
    setShowActionMenu(false);
    Alert.alert(
      'Block User',
      `Are you sure you want to block @${username}? They won't be able to see your profile or contact you.`,
      [
        { 
          text: 'Block', 
          style: 'destructive',
          onPress: () => {
            console.log('Blocked user:', username);
            Alert.alert('User Blocked', `You have blocked @${username}`);
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  // Handle video press from grid - opens VerticalVideoPlayer
  const handleVideoPress = (video: any) => {
    console.log('🎬 Opening video player for:', video.assetId);
    
    // Convert single video to array format for VerticalVideoPlayer
    const playerVideo = {
      ...video,
      thumbnailUrl: video.thumbnailUrl || '',
      id: video.assetId,
      likes: video.likes || 0,
      comments: video.comments || 0,
      processed: video.processed || true,
    };
    
    setSelectedVideos([playerVideo]);
    setSelectedVideoIndex(0);
    setShowVideoPlayer(true);
  };

  const handleVideoPlayerClose = () => {
    setShowVideoPlayer(false);
    setSelectedVideos([]);
    setSelectedVideoIndex(0);
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <View style={styles.leftSection}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.username}>@{username}</Text>
          </View>
          <View style={styles.topBarIcons}>
            {!isOwnProfile ? (
              <TouchableOpacity 
                style={styles.settingsIcon} 
                onPress={() => setShowActionMenu(true)}
              >
                <Ionicons name="ellipsis-horizontal" size={22} color="#000" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.settingsIcon} onPress={() => router.push('/settings')}>
                <Ionicons name="ellipsis-vertical" size={22} color="#000" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.avatarSection}>
          <Image source={{ uri: avatar }} style={styles.avatar} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{formatCount(glints)}</Text>
            <Text style={styles.statLabel}>Glints</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{formatCount(followers)}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{formatCount(following)}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        <View style={styles.bio}>
          <Text style={styles.bioText}>{bio}</Text>
        </View>

        <View style={styles.buttonRow}>
          {isOwnProfile ? (
            <TouchableOpacity style={styles.fullButton} onPress={() => router.push('/edit-profile')}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[
                styles.fullButton,
                isFollowing ? styles.followingButton : styles.notFollowingButton
              ]} 
              onPress={handleFollowToggle}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? "#666" : "#fff"} />
              ) : (
                <Text style={[
                  styles.followButtonText, 
                  isFollowing ? styles.followingButtonText : styles.notFollowingButtonText
                ]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.tabs}>
          {['Glints', 'Picks'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab as any)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.contentContainer}>
        {activeTab === 'Glints' && profileUserId && (
          <EnhancedVideoGrid 
            key={refreshKey} 
            refreshTrigger={refreshKey}
            userId={profileUserId}
            onVideoPress={handleVideoPress}
          />
        )}

        {activeTab === 'Glints' && !profileUserId && (
          <View style={styles.centeredBox}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.placeholderText}>Loading profile...</Text>
          </View>
        )}

        {activeTab === 'Picks' && (
          <View style={styles.centeredBox}>
            <Text style={styles.placeholderText}>Coming Soon 🤝</Text>
          </View>
        )}
      </View>

      {/* Vertical Video Player Modal */}
      <Modal
        visible={showVideoPlayer}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <VerticalVideoPlayer
          videos={selectedVideos}
          initialVideoIndex={selectedVideoIndex}
          onClose={handleVideoPlayerClose}
        />
      </Modal>

      {/* Action Menu Modal for Report/Block */}
      <Modal
        visible={showActionMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowActionMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionMenu(false)}
        >
          <View style={styles.actionMenuContainer}>
            <TouchableOpacity style={styles.actionMenuItem} onPress={handleReportUser}>
              <Ionicons name="flag-outline" size={20} color="#FF3B30" />
              <Text style={styles.actionMenuText}>Report</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionMenuItem} onPress={handleBlockUser}>
              <Ionicons name="ban-outline" size={20} color="#FF3B30" />
              <Text style={styles.actionMenuText}>Block</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionMenuItem, styles.cancelMenuItem]} 
              onPress={() => setShowActionMenu(false)}
            >
              <Text style={styles.cancelMenuText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  contentContainer: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  username: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  topBarIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsIcon: { padding: 4 },
  avatarSection: { alignItems: 'center', marginTop: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  stat: { alignItems: 'center', marginHorizontal: 20 },
  statNumber: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  statLabel: { fontSize: 13, color: '#555' },
  bio: { alignItems: 'center', marginTop: 12 },
  bioText: { fontSize: 14, color: '#000' },
  buttonRow: { marginTop: 16, paddingHorizontal: 60 },
  fullButton: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  editButtonText: { 
    color: '#000', 
    fontSize: 14, 
    fontWeight: '500' 
  },
  // Follow button styles
  notFollowingButton: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  followingButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notFollowingButtonText: {
    color: '#fff',
  },
  followingButtonText: {
    color: '#000',
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  tab: { paddingHorizontal: 20, paddingBottom: 10 },
  tabText: { fontSize: 14, color: '#888' },
  activeTab: { borderBottomWidth: 2, borderColor: '#000' },
  activeTabText: { color: '#000', fontWeight: '600' },
  centeredBox: { alignItems: 'center', justifyContent: 'center', height: 200 },
  placeholderText: { fontSize: 15, color: '#666' },
  
  // Action Menu Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionMenuContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 200,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cancelMenuItem: {
    borderBottomWidth: 0,
    justifyContent: 'center',
  },
  actionMenuText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
    marginLeft: 12,
  },
  cancelMenuText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
    textAlign: 'center',
  },
});
