import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { initializeApp } from 'firebase/app';
import { initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Import getReactNativePersistence with type assertion for Firebase 12.0.0
const { getReactNativePersistence } = require('firebase/auth') as any;

console.log('🔥 Loading Firebase configuration (TypeScript)...');

// 🔒 SECURE: Firebase config from environment variables
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: Constants.expoConfig?.extra?.firebaseProjectId || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: Constants.expoConfig?.extra?.firebaseAppId || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// 🔒 SECURITY: Validate Firebase configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error('🚨 SECURITY ERROR: Firebase configuration is missing or invalid');
}

const app = initializeApp(firebaseConfig);
console.log('🔥 Firebase app initialized');

// Initialize auth with AsyncStorage persistence
// This ensures users stay logged in after closing and reopening the app
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

console.log('🔥 Firebase Auth initialized with AsyncStorage persistence!');

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };

