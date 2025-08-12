import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebaseConfig';

const db = getFirestore();

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

function LoginScreen() {
  const [input, setInput] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (isLoggingIn) return; // Prevent multiple login attempts
    
    if (!input || !password) {
      Alert.alert('Missing Info', 'Please enter your email/username and password.');
      return;
    }

    setIsLoggingIn(true);
    
    try {
      let email = input;

      // If input is not an email, search for username
      if (!input.includes('@')) {
        const usersQuery = query(collection(db, 'users'), where('username', '==', input));
        const querySnapshot = await getDocs(usersQuery);

        if (querySnapshot.empty) {
          Alert.alert('User Not Found', 'No user found with that username.');
          setIsLoggingIn(false);
          return;
        }

        const userDoc = querySnapshot.docs[0];
        email = userDoc.data().email;
      }

      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
        // Check if email is verified
        if (!user.emailVerified) {
          Alert.alert(
            'Email Not Verified',
            'Please verify your email before signing in.',
            [{ text: 'OK' }]
          );
          setIsLoggingIn(false);
          return;
        }

        // Create user document if it doesn't exist
        await createUserIfNotExists(user);
        
        // Authentication context will handle the redirect automatically
        console.log('✅ Login successful, authentication context will handle redirect');
        // Don't reset isLoggingIn here - let the auth context handle the redirect
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setIsLoggingIn(false);
      
      let errorMessage = 'Login failed. Please try again.';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      
      Alert.alert('Login Error', errorMessage);
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
        <Text style={styles.title}>Welcome to Glint</Text>

        <TextInput
          style={styles.input}
          placeholder="Email or Username"
          placeholderTextColor="#888"
          value={input}
          onChangeText={setInput}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity onPress={handleLogin} style={styles.button}>
          <LinearGradient
            colors={['#FF3D3D', '#FFBB00', '#00FFB3', '#00B0FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            <Text style={styles.buttonText}>Log In</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/signup')}>
          <Text style={styles.link}>Don&apos;t have an account? Sign up</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/forgot')}>
          <Text style={styles.link}>Forgot Password?</Text>
        </TouchableOpacity>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

// Main Index Component - handles initial routing based on auth state
export default function IndexScreen() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only handle routing after auth loading is complete
    if (!isLoading) {
      if (user) {
        console.log('🏠 User authenticated, redirecting to home');
        router.replace('/(tabs)/home');
      }
      // If no user, stay on this login screen (no redirect needed)
    }
  }, [user, isLoading, router]);

  // Show splash screen while authentication is loading
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#000', marginBottom: 20 }}>Glint</Text>
        <Text style={{ fontSize: 16, color: '#666' }}>Loading...</Text>
      </View>
    );
  }

  // Show login screen when no user is authenticated
  return <LoginScreen />;
}

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
});