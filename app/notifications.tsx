import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { NotificationData, notificationService } from '../lib/notificationService';

dayjs.extend(relativeTime);

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userNotifications = await notificationService.getUserNotifications(user.uid, 50);
      setNotifications(userNotifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const handleNotificationPress = async (notification: NotificationData) => {
    // Mark as read if not already read
    if (!notification.read) {
      await notificationService.markAsRead(notification.id);
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
    }

    // Navigate based on notification type
    switch (notification.type) {
      case 'follow':
        if (notification.data?.username) {
          router.push(`/user/${notification.data.username}`);
        }
        break;
      case 'like':
      case 'comment':
        if (notification.data?.videoId) {
          // Navigate to video - you'll need to implement this route
          console.log('Navigate to video:', notification.data.videoId);
        }
        break;
      default:
        break;
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;
    
    try {
      await notificationService.markAllAsRead(user.uid);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'follow':
        return 'person-add';
      case 'like':
        return 'heart';
      case 'comment':
        return 'chatbox';
      case 'mention':
        return 'at';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'follow':
        return '#4ECDC4';
      case 'like':
        return '#FF6B6B';
      case 'comment':
        return '#4ECDC4';
      case 'mention':
        return '#FFE66D';
      default:
        return '#4ECDC4';
    }
  };

  const renderNotification = ({ item }: { item: NotificationData }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        !item.read && styles.unreadNotification
      ]}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.notificationLeft}>
        <View style={[
          styles.iconContainer,
          { backgroundColor: getNotificationColor(item.type) }
        ]}>
          <Ionicons 
            name={getNotificationIcon(item.type)} 
            size={20} 
            color="white" 
          />
        </View>
        
        {item.data?.avatar && (
          <Image 
            source={{ uri: item.data.avatar }} 
            style={styles.avatar} 
          />
        )}
      </View>
      
      <View style={styles.notificationContent}>
        <Text style={[
          styles.notificationMessage,
          !item.read && styles.unreadText
        ]}>
          {item.message}
        </Text>
        <Text style={styles.notificationTime}>
          {dayjs(item.createdAt?.toDate?.() || item.createdAt).fromNow()}
        </Text>
      </View>
      
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  useEffect(() => {
    if (user) {
      // Set up real-time listener
      const unsubscribe = notificationService.setupNotificationListener(
        user.uid,
        (newNotifications) => {
          setNotifications(newNotifications);
          setLoading(false);
        }
      );

      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Please sign in to view notifications</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
          <Text style={styles.markAllText}>Mark All Read</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#4ECDC4"
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#4ECDC4" />
              <Text style={styles.loadingText}>Loading notifications...</Text>
            </View>
          ) : (
            <View style={styles.centerContainer}>
              <Ionicons name="notifications-outline" size={64} color="#666" />
              <Text style={styles.emptyText}>No notifications yet</Text>
              <Text style={styles.emptySubtext}>You'll see notifications here when people interact with your content</Text>
            </View>
          )
        }
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  
  backButton: {
    padding: 8,
  },
  
  title: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  
  markAllText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: '600',
  },
  
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  
  unreadNotification: {
    backgroundColor: '#111',
  },
  
  notificationLeft: {
    position: 'relative',
    marginRight: 12,
  },
  
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  avatar: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
  },
  
  notificationContent: {
    flex: 1,
  },
  
  notificationMessage: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  
  unreadText: {
    color: 'white',
    fontWeight: '500',
  },
  
  notificationTime: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ECDC4',
    marginLeft: 12,
  },
  
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  
  emptyContainer: {
    flexGrow: 1,
  },
  
  loadingText: {
    color: '#ccc',
    fontSize: 16,
    marginTop: 16,
  },
  
  emptyText: {
    color: '#ccc',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    textAlign: 'center',
  },
});
