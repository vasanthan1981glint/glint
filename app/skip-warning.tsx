import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SkipWarningScreen() {
  const router = useRouter();

  const handleContinue = () => {
    router.replace('/skip-profile');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <LinearGradient colors={['#f8f8f8', '#f2f2f2', '#fbe4c3']} style={styles.container}>
      <View style={styles.box}>
        <Text style={styles.title}>Are you sure?</Text>
        <Text style={styles.message}>
          If you skip, you won’t be able to log in again later. It's better to sign up or log in now.
        </Text>

        <TouchableOpacity onPress={handleContinue} style={styles.button}>
          <LinearGradient
            colors={['#FF3D3D', '#FFBB00', '#00FFB3', '#00B0FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.exactGradientButton}
          >
            <Text style={styles.exactButtonText}>Continue Anyway</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleBack}>
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  box: { width: '85%', backgroundColor: '#fff', padding: 24, borderRadius: 16, elevation: 2 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  message: { fontSize: 16, color: '#444', marginBottom: 20, textAlign: 'center' },
  button: {
    width: '100%',
    borderRadius: 50,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 10,
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
  backText: { color: '#333', fontSize: 15, textAlign: 'center', marginTop: 10 },
});
