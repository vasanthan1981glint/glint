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
  const { user } = useLocalSearchParams();
  const avatarUri = 'https://i.pravatar.cc/150?u=' + user;
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* 🧑‍ Profile Info */}
      <View style={styles.profileSection}>
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
        <Text style={styles.username}>{user}</Text>
        <Text style={styles.subText}>Calling...</Text>
      </View>

      {/* 🔘 Call Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.button}>
          <Ionicons name="mic-off" size={28} color="#fff" />
          <Text style={styles.btnLabel}>Mute</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.endButton]} onPress={() => router.back()}>
          <Ionicons name="call" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.button}>
          <Ionicons name="volume-high" size={28} color="#fff" />
          <Text style={styles.btnLabel}>Speaker</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
    paddingBottom: 60,
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 120,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fff',
    marginBottom: 16,
  },
  username: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  subText: {
    color: '#aaa',
    fontSize: 16,
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 40,
  },
  button: {
    alignItems: 'center',
  },
  endButton: {
    backgroundColor: '#ff3b30',
    padding: 18,
    borderRadius: 50,
  },
  btnLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 6,
  },
});
