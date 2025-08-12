import { useLocalSearchParams, useRouter } from 'expo-router';
import { applyActionCode } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { auth } from '../firebaseConfig';

export default function VerifyOrResetScreen() {
  const { mode, oobCode } = useLocalSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState('Please wait...');

  useEffect(() => {
    if (!mode || !oobCode) {
      setMessage('Invalid link');
      return;
    }

    const handleAction = async () => {
      try {
        if (mode === 'verifyEmail') {
          await applyActionCode(auth, oobCode as string);
          setMessage('Email verified successfully!');
          setTimeout(() => router.replace('/profile'), 2000);
        } else if (mode === 'resetPassword') {
          router.replace({ pathname: '/forgot', params: { oobCode } });
        } else {
          setMessage('Unsupported action.');
        }
      } catch (error: any) {
        setMessage(error.message);
      }
    };

    handleAction();
  }, [mode, oobCode]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
      {message === 'Please wait...' && <ActivityIndicator size="large" color="#000" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  text: { fontSize: 18, textAlign: 'center', marginBottom: 20 },
});
