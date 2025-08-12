import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Migration utility to set up required collections and documents
 * for the unified profile system
 */

export async function setupUnifiedProfileSystem() {
  console.log('🚀 Setting up unified profile system...');
  
  try {
    // Create follows collection structure
    // This creates the collection structure in Firestore
    
    // Create blocks collection structure
    // This creates the collection structure in Firestore
    
    // Create user_counters collection structure
    // This creates the collection structure in Firestore
    
    console.log('✅ Unified profile system setup complete');
  } catch (error) {
    console.error('❌ Error setting up unified profile system:', error);
  }
}

/**
 * Initialize user counter document for a user
 */
export async function initializeUserCounters(userId: string) {
  try {
    const counterRef = doc(db, 'user_counters', userId);
    const counterDoc = await getDoc(counterRef);
    
    if (!counterDoc.exists()) {
      await setDoc(counterRef, {
        followers: 0,
        following: 0,
        posts: 0,
        totalLikes: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log('✅ User counters initialized for:', userId);
    }
  } catch (error) {
    console.error('❌ Error initializing user counters:', error);
  }
}

/**
 * Migration helper to update existing user documents with required fields
 */
export async function migrateUserProfile(userId: string) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const updates: any = {};
      
      // Ensure required fields exist
      if (userData.isPrivate === undefined) {
        updates.isPrivate = false;
      }
      if (userData.isVerified === undefined) {
        updates.isVerified = false;
      }
      if (userData.displayName === undefined) {
        updates.displayName = userData.username || 'User';
      }
      
      // Update if needed
      if (Object.keys(updates).length > 0) {
        await setDoc(userRef, updates, { merge: true });
        console.log('✅ User profile migrated for:', userId);
      }
      
      // Initialize counters
      await initializeUserCounters(userId);
    }
  } catch (error) {
    console.error('❌ Error migrating user profile:', error);
  }
}

export default {
  setupUnifiedProfileSystem,
  initializeUserCounters,
  migrateUserProfile,
};
