import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from 'firebase/auth';

const USER_STORAGE_KEY = '@glint_user_session';

export class ManualAuthPersistence {
  // Store user session manually
  static async storeUserSession(user: User) {
    try {
      const userData = {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      console.log('✅ Manual session stored');
    } catch (error) {
      console.error('❌ Error storing session:', error);
    }
  }

  // Retrieve user session manually
  static async getUserSession(): Promise<any | null> {
    try {
      const userData = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (userData) {
        const parsedData = JSON.parse(userData);
        
        // Check if session is less than 30 days old
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - parsedData.timestamp < thirtyDays) {
          console.log('✅ Manual session found');
          return parsedData;
        } else {
          console.log('⏰ Session expired');
          await this.clearUserSession();
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Error retrieving session:', error);
      return null;
    }
  }

  // Clear user session
  static async clearUserSession() {
    try {
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      console.log('🗑️ Manual session cleared');
    } catch (error) {
      console.error('❌ Error clearing session:', error);
    }
  }
}
