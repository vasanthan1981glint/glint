import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ChatRoom() {
  const router = useRouter();
  const { user } = useLocalSearchParams();
  const [message, setMessage] = useState('');
  const avatarUri = 'https://i.pravatar.cc/150?u=' + user;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* 🔝 Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>

          <Image source={{ uri: avatarUri }} style={styles.avatar} />
          <Text style={styles.username}>{user}</Text>

          <View style={styles.actions}>
            {/* ✅ Call button */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push({ pathname: '/call', params: { user } })}
            >
              <Ionicons name="call-outline" size={22} color="#000" />
            </TouchableOpacity>

            {/* ✅ Video call button */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push({ pathname: '/video-call', params: { user } })}
            >
              <Ionicons name="videocam-outline" size={22} color="#000" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton}>
              <Feather name="more-vertical" size={22} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 💬 Chat placeholder */}
        <View style={styles.chatArea}>
          <Text style={styles.placeholder}>
            Chat with @{user} will appear here
          </Text>
        </View>

        {/* 📝 Message input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity>
            <Ionicons name="camera" size={24} color="#007aff" />
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              placeholder="Message..."
              placeholderTextColor="#999"
              style={styles.input}
              value={message}
              onChangeText={setMessage}
            />
            <TouchableOpacity>
              <Ionicons name="mic-outline" size={20} color="#555" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => {
              if (message.trim()) {
                setMessage('');
              }
            }}
            style={{ marginLeft: 6 }}
          >
            <Ionicons name="send" size={22} color="#007aff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 12,
  },
  username: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
  },
  iconButton: {
    marginLeft: 16,
  },
  chatArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    color: '#999',
    fontSize: 15,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: Platform.OS === 'ios' ? 10 : 6,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: '#ccc',
    backgroundColor: '#fff',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f1f1',
    borderRadius: 25,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 8,
  },
});
