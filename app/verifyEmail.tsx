import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { sendEmailVerification } from 'firebase/auth';
import { useEffect } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
} from 'react-native';
import { auth } from '../firebaseConfig';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams();

  useEffect(() => {
    let checkCount = 0;

    const interval = setInterval(async () => {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        clearInterval(interval);
        router.replace('/profile');
      }

      checkCount++;
      if (checkCount >= 3) {
        clearInterval(interval);
        const slowInterval = setInterval(async () => {
          await auth.currentUser?.reload();
          if (auth.currentUser?.emailVerified) {
            clearInterval(slowInterval);
            router.replace('/profile');
          }
        }, 4000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const resendVerification = async () => {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        Alert.alert('Verification email sent again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleManualCheck = async () => {
    try {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        router.replace('/profile');
      } else {
        Alert.alert('Still Not Verified', 'Please verify your email and try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to check status.');
    }
  };

  return (
    <LinearGradient
      colors={['#f8f8f8', '#f2f2f2', '#fbe4c3']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <Text style={styles.title}>Verify Your Email</Text>
      <Text style={styles.email}>{email}</Text>
      <Text style={styles.message}>
        Please check your inbox and click the verification link to continue.
      </Text>
      <Text style={styles.note}>This may take a moment...</Text>

      <TouchableOpacity onPress={resendVerification} style={styles.button}>
        <LinearGradient
          colors={['#FF3D3D', '#FFBB00', '#00FFB3', '#00B0FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientButton}
        >
          <Text style={styles.buttonText}>Resend Verification Email</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleManualCheck} style={styles.button}>
        <LinearGradient
          colors={['#FF3D3D', '#FFBB00', '#00FFB3', '#00B0FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientButton}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </LinearGradient>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#000' },
  email: { fontSize: 16, fontWeight: '600', marginBottom: 8, textAlign: 'center', color: '#000' },
  message: { textAlign: 'center', fontSize: 15, marginBottom: 10, color: '#000' },
  note: { textAlign: 'center', fontSize: 14, marginBottom: 25, color: '#555' },
  button: {
    width: '80%',
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
});
