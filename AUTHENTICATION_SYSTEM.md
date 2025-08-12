# 🔐 Glint Authentication System

This document explains the complete authentication system implemented in the Glint React Native app using Firebase Authentication with persistent login capabilities.

## 📋 Overview

The authentication system provides:
- **Secure login/signup** with Firebase Authentication
- **Persistent login** that remembers users across app restarts
- **Automatic token management** with secure storage
- **Session validation** and refresh handling
- **Route protection** with authentication guards
- **Secure logout** with token cleanup

## 🏗️ Architecture

### Core Components

1. **AuthContext** (`contexts/AuthContext.tsx`)
   - Manages global authentication state
   - Handles token storage and retrieval
   - Provides authentication status across the app

2. **AuthGuard** (`components/AuthGuard.tsx`)
   - Protects routes based on authentication status
   - Automatically redirects users to appropriate screens
   - Shows loading states during authentication checks

3. **Secure Storage**
   - Uses `expo-secure-store` for token persistence
   - Encrypted storage on device keychain/keystore
   - Automatic cleanup on logout

## 🔄 Authentication Flow

### 1. App Launch
```
App Start → AuthContext Initialization → Firebase Auth State Check
    ↓
If authenticated → Load User Profile → Navigate to Home
    ↓
If not authenticated → Navigate to Login
```

### 2. Login Process
```
User enters credentials → Firebase signInWithEmailAndPassword
    ↓
Success → Token stored securely → User profile loaded → Navigate to Home
    ↓
Error → Display error message → Stay on login screen
```

### 3. Signup Process
```
User enters email/password → Firebase createUserWithEmailAndPassword
    ↓
Success → Send verification email → Navigate to verification screen
    ↓
Email verified → Create user profile → Login automatically
```

### 4. Persistent Login
```
App restart → Check secure storage for token → Validate with Firebase
    ↓
Valid token → Auto-login → Navigate to Home
    ↓
Invalid/expired → Navigate to Login
```

## 📁 File Structure

```
/contexts/
  AuthContext.tsx          # Main authentication context
/components/
  AuthGuard.tsx           # Route protection component
/app/
  index.tsx               # Login screen (wrapped with AuthGuard)
  signup.tsx              # Signup screen (wrapped with AuthGuard)
  settings.tsx            # Settings with logout (wrapped with AuthGuard)
  _layout.tsx             # Root layout with AuthProvider
  /(tabs)/
    home.tsx              # Protected home screen
```

## 🔧 Implementation Details

### AuthContext Features

```typescript
interface AuthContextType {
  user: User | null;                    // Firebase user object
  userProfile: UserProfile | null;     // Custom user profile from Firestore
  isLoading: boolean;                   // Loading state during checks
  isAuthenticated: boolean;             // Combined auth status
  signOutUser: () => Promise<void>;     // Secure logout function
  refreshUserProfile: () => Promise<void>; // Refresh profile data
}
```

### Secure Token Storage

```typescript
// Store authentication token securely
const storeAuthToken = async (token: string) => {
  await SecureStore.setItemAsync('userToken', token);
};

// Retrieve token on app start
const getAuthToken = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync('userToken');
};

// Clean up on logout
const removeAuthToken = async () => {
  await SecureStore.deleteItemAsync('userToken');
};
```

### AuthGuard Usage

```typescript
// Protect authenticated routes
<AuthGuard requireAuth={true}>
  <HomeScreen />
</AuthGuard>

// Prevent authenticated users from seeing auth screens
<AuthGuard requireAuth={false}>
  <LoginScreen />
</AuthGuard>
```

## 🔒 Security Features

### Token Management
- **Secure Storage**: Tokens stored in device keychain (iOS) or encrypted preferences (Android)
- **Automatic Refresh**: Firebase SDK handles token refresh automatically
- **Expiry Handling**: Invalid/expired tokens trigger re-authentication
- **Clean Logout**: Tokens removed from storage and Firebase session invalidated

### Route Protection
- **Automatic Redirects**: Unauthenticated users redirected to login
- **Loading States**: Proper loading indicators during auth checks
- **Protected Screens**: Home, Settings, Profile require authentication
- **Public Screens**: Login, Signup redirect authenticated users

### User Validation
- **Email Verification**: Required before full access
- **Profile Creation**: Automatic Firestore profile creation
- **Error Handling**: Comprehensive error messages for auth failures

## 🚀 Usage Examples

### Using Authentication in Components

```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { user, userProfile, isAuthenticated, signOutUser } = useAuth();

  if (!isAuthenticated) {
    return <Text>Please log in</Text>;
  }

  return (
    <View>
      <Text>Welcome, {userProfile?.username}!</Text>
      <TouchableOpacity onPress={signOutUser}>
        <Text>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Protecting Screens

```typescript
// Wrap any screen that requires authentication
function ProtectedScreen() {
  return (
    <AuthGuard requireAuth={true}>
      <YourScreenContent />
    </AuthGuard>
  );
}
```

### Handling Logout

```typescript
const handleLogout = async () => {
  try {
    await signOutUser(); // Cleans up tokens and Firebase session
    // AuthContext automatically redirects to login
  } catch (error) {
    console.error('Logout failed:', error);
  }
};
```

## 🐛 Error Handling

The authentication system handles various error scenarios:

- **Network Issues**: Graceful degradation with retry logic
- **Invalid Credentials**: Clear error messages to users
- **Token Expiry**: Automatic re-authentication flow
- **Email Verification**: Prompts for verification when required
- **Account Issues**: Specific messages for disabled/deleted accounts

## 📱 Testing the Authentication System

### Test Scenarios

1. **Fresh Install**
   - App should show login screen
   - No automatic login should occur

2. **Successful Login**
   - Valid credentials should navigate to home
   - Invalid credentials should show error
   - Token should be stored securely

3. **App Restart After Login**
   - Should automatically login user
   - Should navigate directly to home
   - Should load user profile

4. **Logout**
   - Should clear stored token
   - Should navigate to login screen
   - Should prevent access to protected screens

5. **Token Expiry**
   - Expired tokens should trigger re-authentication
   - User should be redirected to login

## 🔄 Migration from Previous System

If you had a previous authentication system:

1. **Remove old auth logic** from individual screens
2. **Wrap screens with AuthGuard** instead of manual checks
3. **Use AuthContext hooks** instead of direct Firebase calls
4. **Update navigation logic** to rely on AuthGuard redirects

## 🛠️ Future Enhancements

Potential improvements to consider:

- **Biometric Authentication**: Add fingerprint/face ID support
- **Social Login**: Google, Apple, Facebook authentication
- **Multi-Factor Authentication**: SMS or TOTP-based 2FA
- **Session Management**: Multiple device session tracking
- **Offline Support**: Cached authentication for offline use

## 📞 Support

For authentication-related issues:

1. Check console logs for Firebase errors
2. Verify Firebase configuration
3. Ensure secure storage permissions
4. Test authentication flow step by step
5. Check network connectivity for token validation

---

This authentication system provides a secure, user-friendly experience with industry-standard security practices. The persistent login feature ensures users stay logged in across app sessions while maintaining security through proper token management.
