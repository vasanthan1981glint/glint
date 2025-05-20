import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const fullChatList = [
  { id: '1', name: 'spamzz_kay12', status: 'Active 12m ago', avatar: 'https://i.pravatar.cc/150?img=1' },
  { id: '2', name: 'Ethan Guo', status: 'Sent 18h ago', avatar: 'https://i.pravatar.cc/150?img=2' },
  { id: '3', name: 'Daniel Daniel', status: 'Active 5m ago', avatar: 'https://i.pravatar.cc/150?img=3' },
  { id: '4', name: '구가노못..', status: 'Active today', avatar: 'https://i.pravatar.cc/150?img=4' },
  { id: '5', name: 'Aliyan', status: 'Seen Monday', avatar: 'https://i.pravatar.cc/150?img=5' },
  { id: '6', name: 'Nafil Mohamed', status: 'Sent', avatar: 'https://i.pravatar.cc/150?img=6' },
  { id: '7', name: 'TechWiser', status: 'Active 3h ago', avatar: 'https://i.pravatar.cc/150?img=7' },
];

export default function ChatListScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();

  const filteredChats = fullChatList.filter(chat =>
    chat.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top + 10 : 0 }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />

      {/* 🔝 Top Title */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Chats</Text>
      </View>

      {/* 🔍 Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#888" />
        <TextInput
          placeholder="Search"
          placeholderTextColor="#888"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* 👥 User List */}
      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatItem}
            onPress={() =>
              router.push({ pathname: '/chat-room', params: { user: item.name } })
            }
          >
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <View style={styles.chatInfo}>
              <Text style={styles.chatName}>{item.name}</Text>
              <Text style={styles.chatStatus}>{item.status}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No chats found.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
  },
  headerContainer: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  headerText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: '#000',
    marginLeft: 8,
    fontSize: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  chatStatus: {
    color: '#444',
    fontSize: 13,
    marginTop: 2,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#aaa',
    fontSize: 16,
  },
});
