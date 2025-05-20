import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { auth } from '../firebaseConfig';

const db = getFirestore();

export default function LoginScreen() {
  const [input, setInput] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = async () => {
    if (!input || !password) {
      Alert.alert('Missing Info', 'Please enter your email/username and password.');
      return;
    }

    let emailToUse = input;

    if (!input.includes('@')) {
      try {
        const q = query(collection(db, 'users'), where('username', '==', input));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          Alert.alert('Login failed', 'Username not found.');
          return;
        }

        const userData = snapshot.docs[0].data();
        emailToUse = userData.email;
      } catch (error) {
        Alert.alert('Login failed', 'Something went wrong.');
        return;
      }
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailToUse, password);
      const user = userCredential.user;

      if (user && !user.emailVerified) {
        Alert.alert('Verify your email', 'Please check your inbox before logging in.');
        return;
      }

      router.replace('/home');
    } catch (error) {
      Alert.alert('Login failed', 'Email or password is incorrect.');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
      <LinearGradient
        colors={['#f8f8f8', '#f2f2f2', '#fbe4c3']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradient}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <TouchableOpacity onPress={() => router.push('/home')} style={styles.homeDevButton}>
            <Text style={styles.homeDevText}>🏠 Home</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/skip-warning')} style={styles.skipContainer}>
            <LinearGradient
              colors={['#FF3D3D', '#FFBB00', '#00FFB3', '#00B0FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.skipGradient}
            >
              <Text style={styles.skipText}>Skip</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.keyboard}
            >
              <Text style={styles.title}>Welcome to Glint Chat ✨</Text>

              <TextInput
                placeholder="Enter your email or username"
                value={input}
                onChangeText={setInput}
                style={styles.input}
                placeholderTextColor="#999"
              />
              <TextInput
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
                placeholderTextColor="#999"
              />

              <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <LinearGradient
                  colors={['#FF3D3D', '#FFBB00', '#00FFB3', '#00B0FF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.exactGradientButton}
                >
                  <Text style={styles.exactButtonText}>Continue</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/forgot')}>
                <Text style={styles.link}>Forgot Password?</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text style={styles.link}>Don't have an account? Sign Up</Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  gradient: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeDevButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  homeDevText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  skipContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  skipGradient: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  skipText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#222',
    textAlign: 'center',
  },
  input: {
    width: '80%',
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    width: '80%',
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
  link: {
    color: '#333',
    textDecorationLine: 'underline',
    fontSize: 14,
    marginTop: 10,
  },
});
