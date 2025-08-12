// app/settings.tsx

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../firebaseConfig';

function SettingsScreen() {
  const router = useRouter();
  const { signOutUser } = useAuth(); // Use AuthContext logout
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setIsPrivate(data.private || false);
        setShowHistory(data.showHistory ?? true);
      }
    };
    loadSettings();
  }, []);

  const handleLogout = async () => {
    try {
      await signOutUser(); // Use AuthContext logout method
      // AuthContext will handle redirect automatically
    } catch (err: any) {
      Alert.alert('Logout failed', err.message);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: handleLogout },
    ]);
  };

  const toggleSetting = async (key: string, value: boolean) => {
    const userRef = doc(db, 'users', auth.currentUser?.uid!);
    await updateDoc(userRef, { [key]: value });
  };

  const togglePrivateAccount = async () => {
    const newValue = !isPrivate;
    setIsPrivate(newValue);
    await toggleSetting('private', newValue);
    Alert.alert(
      newValue ? 'Switched to Private' : 'Switched to Public',
      newValue
        ? 'Only approved followers can view your content now.'
        : 'Your account is now public. Anyone can view your content.'
    );
  };

  const handleHistoryToggle = async () => {
    const newValue = !showHistory;
    setShowHistory(newValue);
    await toggleSetting('showHistory', newValue);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.section}>Account</Text>
        <TouchableOpacity style={styles.item} onPress={() => router.push('/edit-profile')}>
          <Text style={styles.itemText}>Edit Profile</Text>
        </TouchableOpacity>

        <Text style={styles.section}>Privacy</Text>

        <View style={styles.item}>
          <Text style={styles.itemText}>Notifications</Text>
          <Switch
            value={notificationsEnabled}
            onValueChange={(val) => {
              setNotificationsEnabled(val);
            }}
          />
        </View>

        <View style={styles.itemColumn}>
          <View style={styles.rowBetween}>
            <Text style={styles.itemText}>Private Account</Text>
            <Switch value={isPrivate} onValueChange={togglePrivateAccount} />
          </View>
          <Text style={styles.subText}>
            {isPrivate
              ? 'Only approved followers can see your content.'
              : 'Anyone can view your content and follow you.'}
          </Text>
        </View>

        {/* 🔘 Show History Switch with Info */}
        <View style={styles.itemColumn}>
          <View style={styles.rowBetween}>
            <Text style={styles.itemText}>Show History</Text>
            <Switch value={showHistory} onValueChange={handleHistoryToggle} />
          </View>
          {!showHistory && (
            <Text style={styles.subText}>
              History is turned off. Your watch and activity logs are hidden.
            </Text>
          )}
        </View>

        <TouchableOpacity style={styles.item} onPress={() => router.push('/saved')}>
          <Text style={styles.itemText}>Saved</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.item} onPress={() => router.push('/blocked')}>
          <Text style={styles.itemText}>Blocked Accounts</Text>
        </TouchableOpacity>

        <Text style={styles.section}>Legal</Text>
        <TouchableOpacity style={styles.item} onPress={() => router.push('/terms')}>
          <Text style={styles.itemText}>Terms & Privacy</Text>
        </TouchableOpacity>

        <Text style={styles.section}>Danger Zone</Text>
        <TouchableOpacity style={[styles.item, styles.logout]} onPress={confirmLogout}>
          <Text style={[styles.itemText, styles.logoutText]}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

export default SettingsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  title: { fontSize: 18, fontWeight: '600' },
  list: { padding: 20 },
  section: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#888',
    marginTop: 30,
    marginBottom: 10,
  },
  item: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemColumn: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemText: { fontSize: 16, color: '#333' },
  subText: {
    fontSize: 13,
    color: '#777',
    marginTop: 6,
  },
  logout: { marginTop: 10 },
  logoutText: { color: 'red' },
});
