import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import uuid from 'react-native-uuid';
import { auth, db, storage } from '../firebaseConfig';

export default function EditProfileScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUsername(data.username || '');
        setBio(data.bio || '');
        setAvatar(data.photo || null);
      }
    };
    loadUserData();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      setAvatar(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('User not logged in');
      return;
    }

    if (!username.trim()) {
      Alert.alert('Please enter a username');
      return;
    }

    setUploading(true);

    try {
      let photoURL = avatar;

      if (avatar?.startsWith('file')) {
        const blob: Blob = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.onload = () => resolve(xhr.response);
          xhr.onerror = () => reject(new TypeError('Image upload failed'));
          xhr.responseType = 'blob';
          xhr.open('GET', avatar, true);
          xhr.send(null);
        });

        const fileRef = ref(storage, `profilePhotos/${uuid.v4()}.jpg`);
        await uploadBytes(fileRef, blob);
        photoURL = await getDownloadURL(fileRef);
      }

      const updates: any = {
        username,
        bio,
      };

      if (photoURL) updates.photo = photoURL;

      await updateDoc(doc(db, 'users', currentUser.uid), updates);

      router.replace('/me');
    } catch (err) {
      console.error(err);
      Alert.alert('Failed to save profile');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/me')}>
          <Ionicons name="chevron-back" size={28} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarSection}>
            <Image
              source={{ uri: avatar || 'https://via.placeholder.com/150' }}
              style={styles.avatar}
            />
            <Text style={styles.changePhotoText}>Change Profile Photo</Text>
          </TouchableOpacity>

          <View style={styles.inputBlock}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              style={styles.input}
              placeholderTextColor="#aaa"
              maxLength={20}
            />
          </View>

          <View style={styles.inputBlock}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              multiline
              style={[styles.input, styles.bioInput]}
              placeholderTextColor="#aaa"
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={uploading}>
            <Text style={styles.saveText}>{uploading ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  scroll: { paddingHorizontal: 24, alignItems: 'center' },
  avatarSection: { alignItems: 'center', marginTop: 24, marginBottom: 32 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#eee' },
  changePhotoText: { color: '#007AFF', marginTop: 8, fontSize: 14 },
  inputBlock: { width: '100%', marginBottom: 20 },
  label: { fontSize: 13, color: '#444', marginBottom: 6 },
  input: {
    backgroundColor: '#f4f4f4',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#000',
  },
  bioInput: { height: 100, textAlignVertical: 'top' },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 24,
    alignSelf: 'stretch',
  },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
