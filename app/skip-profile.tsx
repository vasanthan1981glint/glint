import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { addDoc, collection } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import uuid from 'react-native-uuid';
import { db, storage } from '../firebaseConfig';

export default function SkipProfileScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [dob, setDob] = useState('');
  const [username, setUsername] = useState('');
  const router = useRouter();

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleContinue = async () => {
    if (!image || !bio || !dob || !username) {
      Alert.alert('Please complete all fields.');
      return;
    }

    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new TypeError('Image fetch failed'));
        xhr.responseType = 'blob';
        xhr.open('GET', image!, true);
        xhr.send(null);
      });

      const storageRef = ref(storage, `skippedProfiles/${uuid.v4()}.jpg`);
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      const imageUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'skippedUsers'), {
        username,
        bio,
        dob,
        photo: imageUrl,
        createdAt: new Date().toISOString(),
      });

      router.replace('/home');
    } catch (err: any) {
      console.error('Upload error:', JSON.stringify(err));
      Alert.alert('Upload Failed', err.message || 'Unknown error');
    }
  };

  return (
    <LinearGradient colors={['#f8f8f8', '#f2f2f2', '#fbe4c3']} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Go Back */}
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backButton}>
          <Text style={styles.backText}>← Go Back</Text>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
            <LinearGradient colors={['#FF3D3D', '#FFBB00', '#00FFB3', '#00B0FF']} style={styles.gradientBorder}>
              <View style={styles.innerCircle}>
                {image ? <Image source={{ uri: image }} style={styles.image} /> : <Text style={styles.plus}>+</Text>}
              </View>
            </LinearGradient>
          </TouchableOpacity>
          <TextInput placeholder="Username" style={styles.input} value={username} onChangeText={setUsername} />
          <TextInput placeholder="Bio" style={styles.input} value={bio} onChangeText={setBio} />
          <TextInput
            placeholder="DOB (DD/MM/YYYY)"
            style={styles.input}
            keyboardType="numeric"
            value={dob}
            onChangeText={(text) => {
              const formatted = text
                .replace(/\D/g, '')
                .slice(0, 8)
                .replace(/(\d{2})(\d{0,2})(\d{0,4})/, (_, d1, d2, d3) =>
                  `${d1}${d2 ? '/' + d2 : ''}${d3 ? '/' + d3 : ''}`
                );
              setDob(formatted);
            }}
          />
          <TouchableOpacity onPress={handleContinue} style={styles.button}>
            <LinearGradient
              colors={['#FF3D3D', '#FFBB00', '#00FFB3', '#00B0FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.exactGradientButton}
            >
              <Text style={styles.exactButtonText}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: {
    padding: 20,
  },
  backText: {
    fontSize: 16,
    color: '#333',
  },
  content: { padding: 30, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 15,
  },
  button: {
    width: '100%',
    borderRadius: 50,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 20,
  },
  exactGradientButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exactButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  imagePicker: { alignItems: 'center', marginBottom: 30 },
  gradientBorder: { height: 120, width: 120, borderRadius: 60, padding: 3 },
  innerCircle: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plus: { fontSize: 40, fontWeight: 'bold', color: '#000' },
  image: { width: 114, height: 114, borderRadius: 57 },
});
