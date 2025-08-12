// Firebase configuration with persistent authentication
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

console.log('🔥 Loading Firebase configuration...');

const firebaseConfig = {
  apiKey: "AIzaSyAUs11-YDiNO7C9pv9UR_19bvrbLbJg91A",
  authDomain: "glint-7e3c3.firebaseapp.com",
  projectId: "glint-7e3c3",
  storageBucket: "glint-7e3c3.firebasestorage.app",
  messagingSenderId: "869525277131",
  appId: "1:869525277131:web:b75a03f20fc93f81da0e4e",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log('🔥 Firebase app initialized');

// Initialize auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

console.log('🔥 Firebase Auth initialized with AsyncStorage persistence!');

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
