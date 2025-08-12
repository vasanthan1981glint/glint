import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { createUserWithEmailAndPassword, sendEmailVerification, User } from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { auth, db } from '../firebaseConfig';

const createUserIfNotExists = async (user: User) => {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      username: user.email?.split('@')[0] || 'new_user',
      email: user.email,
      bio: '',
      photo: '',
      dob: '',
      createdAt: Timestamp.now(),
    });
  }
};

function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignup = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
        await createUserIfNotExists(user); // ✅ Create Firestore profile
        await sendEmailVerification(user);
        router.push('/verifyEmail');
      }
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        const currentUser = auth.currentUser;
        if (currentUser && !currentUser.emailVerified) {
          await sendEmailVerification(currentUser);
          Alert.alert('Email already registered', 'Verification email resent.');
          router.push('/verifyEmail');
        } else {
          Alert.alert('Sign up failed', 'Email is already in use.');
        }
      } else if (error.code === 'auth/invalid-email') {
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
      } else {
        Alert.alert('Sign up failed', error.message);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <LinearGradient
        colors={['#f8f8f8', '#f2f2f2', '#fbe4c3']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.container}
      >
        <Text style={styles.title}>Create Your Glint Account</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity onPress={handleSignup} style={styles.button}>
          <LinearGradient
            colors={['#FF3D3D', '#FFBB00', '#00FFB3', '#00B0FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/')}>
          <Text style={styles.link}>Already have an account? Log In</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.goBack}>← Go Back</Text>
        </TouchableOpacity>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}
export default SignUpScreen;

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  input: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  button: {
    width: '100%',
    borderRadius: 50,
    overflow: 'hidden',
    marginTop: 10,
  },
  gradientButton: {
    paddingVertical: 14,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
  },
  link: {
    color: '#333',
    textDecorationLine: 'underline',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
  goBack: {
    color: '#333',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
  },
});
