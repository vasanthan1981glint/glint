import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebaseConfig';
import { ProfilePreloader } from '../lib/profilePreloader';
import { useUserStore } from '../lib/userStore';

// Conditionally import SecureStore
let SecureStore: any = null;
try {
  SecureStore = require('expo-secure-store');
} catch (error) {
  console.log('ExpoSecureStore not available, will use AsyncStorage fallback');
}

// Types for our authentication context
interface UserProfile {
  uid: string;
  email: string;
  username: string;
  bio?: string;
  photo?: string;
  dob?: string;
  emailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOutUser: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  // Get UserStore functions to populate with real user data
  const { setAvatar, setUsername, setBio } = useUserStore();

  // Function to fetch user profile from Firestore
  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const profile = {
          uid: userId,
          email: data.email || '',
          username: data.username || '',
          bio: data.bio || '',
          photo: data.photo || '',
          dob: data.dob || '',
          emailVerified: user?.emailVerified || false,
        };

        // 🚀 Populate UserStore with real Firebase data
        console.log('🔄 Updating UserStore with Firebase profile:', profile);
        setUsername(profile.username || `user_${userId.slice(-4)}`);
        setAvatar(profile.photo || 'https://randomuser.me/api/portraits/men/32.jpg');
        setBio(profile.bio || 'Welcome to Glint ✨');

        return profile;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  };

  // Function to refresh user profile
  const refreshUserProfile = async () => {
    if (user) {
      const profile = await fetchUserProfile(user.uid);
      setUserProfile(profile);
    }
  };

  // Safe storage functions with SecureStore fallback to AsyncStorage
  const storeAuthToken = async (token: string) => {
    try {
      // Try SecureStore first (for native builds) if available
      if (SecureStore) {
        await SecureStore.setItemAsync('userToken', token);
        return;
      }
    } catch (error) {
      console.log('SecureStore failed, falling back to AsyncStorage');
    }
    
    try {
      // Fallback to AsyncStorage (for web/Expo Go)
      await AsyncStorage.setItem('userToken', token);
    } catch (asyncError) {
      console.error('Error storing auth token:', asyncError);
    }
  };

  // Function to retrieve authentication token
  const getAuthToken = async (): Promise<string | null> => {
    try {
      // Try SecureStore first if available
      if (SecureStore) {
        return await SecureStore.getItemAsync('userToken');
      }
    } catch (error) {
      console.log('SecureStore failed, falling back to AsyncStorage');
    }
    
    try {
      // Fallback to AsyncStorage
      return await AsyncStorage.getItem('userToken');
    } catch (asyncError) {
      console.error('Error retrieving auth token:', asyncError);
      return null;
    }
  };

  // Function to remove authentication token
  const removeAuthToken = async () => {
    try {
      // Try SecureStore first if available
      if (SecureStore) {
        await SecureStore.deleteItemAsync('userToken');
        return;
      }
    } catch (error) {
      console.log('SecureStore failed, falling back to AsyncStorage');
    }
    
    try {
      // Fallback to AsyncStorage
      await AsyncStorage.removeItem('userToken');
    } catch (asyncError) {
      console.error('Error removing auth token:', asyncError);
    }
  };

  // Sign out function
  const signOutUser = async () => {
    try {
      // End preload session before signing out
      ProfilePreloader.endPreloadSession();
      
      // Clear UserStore
      setAvatar('https://via.placeholder.com/150');
      setUsername('glint_user');
      setBio('Welcome to Glint ✨');
      
      await signOut(auth);
      await removeAuthToken();
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Initialize authentication listener
  useEffect(() => {
    console.log('� Auth context initializing...');
    
    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('🔐 Auth state changed:', firebaseUser ? `User ${firebaseUser.uid}` : 'No user');
      
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Background operations - don't await these
        setTimeout(async () => {
          try {
            const token = await firebaseUser.getIdToken();
            await storeAuthToken(token);
            console.log('💾 Auth token stored successfully');
          } catch (error) {
            console.error('Error getting token:', error);
          }
          
          const profile = await fetchUserProfile(firebaseUser.uid);
          setUserProfile(profile);
          
          // Start YouTube-style profile preloading after authentication
          if (profile) {
            console.log('🚀 Starting YouTube-style profile preloading...');
            ProfilePreloader.startPreloadSession(firebaseUser.uid);
          }
        }, 0);
      } else {
        // End preload session when user logs out
        ProfilePreloader.endPreloadSession();
        
        // Clear UserStore when no user
        setAvatar('https://via.placeholder.com/150');
        setUsername('glint_user');
        setBio('Welcome to Glint ✨');
        
        setUser(null);
        setUserProfile(null);
        await removeAuthToken();
      }
      
      // Auth check complete
      setIsLoading(false);
      setInitialCheckDone(true);
    });

    // Quick initial check - but don't set loading to false here
    const currentUser = auth.currentUser;
    if (currentUser) {
      console.log('🚀 Found existing user immediately');
      setUser(currentUser);
      
      // Load profile in background
      setTimeout(async () => {
        const profile = await fetchUserProfile(currentUser.uid);
        setUserProfile(profile);
        
        // Start preloading for returning users too
        if (profile) {
          console.log('🚀 Starting YouTube-style profile preloading for returning user...');
          ProfilePreloader.startPreloadSession(currentUser.uid);
        }
      }, 0);
    }

    // Cleanup function
    return () => unsubscribe();
  }, []); // Only run once

  const value: AuthContextType = {
    user,
    userProfile,
    isLoading,
    isAuthenticated: !!user && !!userProfile,
    signOutUser,
    refreshUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
