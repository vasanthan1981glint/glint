import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../firebaseConfig';

type BlockedUser = {
  id: string;
  name: string;
  avatar: string;
};

export default function BlockedAccounts() {
  const router = useRouter();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlockedUsers = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      const blockedIds: string[] = userDoc.data()?.blocked || [];

      if (blockedIds.length === 0) {
        setBlockedUsers([]);
        setLoading(false);
        return;
      }

      const blockedUserDocs = await Promise.all(
        blockedIds.map((uid) => getDoc(doc(db, 'users', uid)))
      );

      const users = blockedUserDocs
        .filter((doc) => doc.exists())
        .map((d) => ({
          id: d.id,
          name: d.data()?.name || 'Unknown',
          avatar: d.data()?.avatar || d.data()?.photo || 'https://i.pravatar.cc/150?u=default',
        }));

      setBlockedUsers(users);
      setLoading(false);
    };

    fetchBlockedUsers();
  }, []);

  const handleUnblock = async (userId: string) => {
    Alert.alert('Unblock User', 'Are you sure you want to unblock this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        style: 'destructive',
        onPress: async () => {
          const currentUser = auth.currentUser;
          if (!currentUser) return;

          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          const currentBlocked = userSnap.data()?.blocked || [];

          const updated = currentBlocked.filter((id: string) => id !== userId);
          await updateDoc(userRef, { blocked: updated });

          setBlockedUsers((prev) => prev.filter((user) => user.id !== userId));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="black" />
        </TouchableOpacity>
        <Text style={styles.title}>Blocked Accounts</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={blockedUsers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>You have no blocked accounts.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.userRow}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            <Text style={styles.name}>{item.name}</Text>
            <TouchableOpacity
              onPress={() => handleUnblock(item.id)}
              activeOpacity={0.6}
            >
              <Text style={styles.unblockLink}>Unblock</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 18, fontWeight: '600', color: '#000' },
  listContainer: { padding: 20 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  name: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    marginLeft: 12,
  },
  unblockLink: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
    padding: 4,
  },
  emptyText: {
    color: '#999',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
});
