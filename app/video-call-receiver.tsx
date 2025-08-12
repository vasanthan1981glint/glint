import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

// DISABLED: This component needs Firebase Realtime Database configuration
// The original code was using Firebase v8 compat API which has been deprecated
// To re-enable:
// 1. Set up Firebase Realtime Database in your project
// 2. Add Realtime Database imports to firebaseConfig.ts  
// 3. Convert all firebase.database() calls to v9 API
// 4. Update WebRTC integration

export default function VideoCallReceiver() {
  React.useEffect(() => {
    Alert.alert(
      'Feature Disabled',
      'Video call receiver is temporarily disabled. This feature requires Firebase Realtime Database configuration.',
      [{ text: 'OK' }]
    );
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.message}>
        Video Call Receiver is temporarily disabled.
        {'\n\n'}
        This feature requires Firebase Realtime Database setup and migration to Firebase v9 API.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#000',
  },
  message: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
});
