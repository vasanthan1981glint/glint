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
import { useState } from 'react';
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
import { AuthGuard } from '../components/AuthGuard';
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
  const router = useRouter();

  const handleLogin = async () => {
    if (!input || !password) {
      Alert.alert('Missing Info', 'Please enter your email/username and password.');
      return;
    }

    try {
      let email = input;

      // If input is not an email, search for username
      if (!input.includes('@')) {
        const usersQuery = query(collection(db, 'users'), where('username', '==', input));
        const querySnapshot = await getDocs(usersQuery);

        if (querySnapshot.empty) {
          Alert.alert('User Not Found', 'No user found with that username.');
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
          return;
        }

        // Create user document if it doesn't exist
        await createUserIfNotExists(user);
        
        // Authentication context will handle the redirect automatically
        console.log('✅ Login successful, authentication context will handle redirect');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
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
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f8f8" />
      
      {/* DEV: Quick home access */}
      <TouchableOpacity
        style={styles.homeDevButton}
        onPress={() => router.push('/home')}
      >
        <Text style={styles.homeDevText}>DEV Home</Text>
      </TouchableOpacity>

      {/* Skip login button */}
      <View style={styles.skipContainer}>
        <TouchableOpacity onPress={() => router.push('/home')}>
          <LinearGradient colors={['#FF6B35', '#F7931E']} style={styles.skipGradient}>
            <Text style={styles.skipText}>Skip</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <LinearGradient colors={['#f8f8f8', '#e8e8e8']} style={styles.gradient}>
        <SafeAreaView style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <KeyboardAvoidingView
              style={styles.keyboard}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <Text style={styles.title}>Welcome to Glint</Text>

              <TextInput
                style={styles.input}
                placeholder="Email or Username"
                value={input}
                onChangeText={setInput}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <View style={styles.button}>
                <TouchableOpacity onPress={handleLogin}>
                  <LinearGradient colors={['#667eea', '#764ba2']} style={styles.exactGradientButton}>
                    <Text style={styles.exactButtonText}>Log In</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text style={styles.link}>Don&apos;t have an account? Sign up</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/forgot')}>
                <Text style={styles.link}>Forgot Password?</Text>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

// Wrap LoginScreen with AuthGuard to redirect authenticated users
function AuthenticatedLoginScreen() {
  return (
    <AuthGuard requireAuth={false}>
      <LoginScreen />
    </AuthGuard>
  );
}

export default AuthenticatedLoginScreen;

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
