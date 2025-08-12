import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import {
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function CallScreen() {
  const params = useLocalSearchParams();
  const user = typeof params.user === 'string' ? params.user : 'User';
  const avatar = typeof params.avatar === 'string' ? params.avatar : 'https://i.pravatar.cc/150?u=default';

  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* 🔝 Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color="white" />
        </TouchableOpacity>
        <View style={styles.topText}>
          <Text style={styles.userName}>{user}</Text>
          <Text style={styles.status}>Calling...</Text>
        </View>
        <View style={{ width: 28 }} />
      </View>

      {/* 🧑 Profile */}
      <View style={styles.profileSection}>
        <Image source={{ uri: avatar }} style={styles.avatar} />
      </View>

      {/* 🔘 Bottom Controls */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.button}>
          <Ionicons name="mic-off" size={28} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.endButton]}>
          <Ionicons name="call" size={28} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
          <Ionicons name="volume-high" size={28} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
    justifyContent: 'space-between',
  },
  topText: {
    alignItems: 'center',
  },
  userName: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  status: {
    color: '#aaa',
    fontSize: 14,
  },
  profileSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#222',
    padding: 20,
    borderRadius: 50,
  },
  endButton: {
    backgroundColor: 'red',
  },
});
