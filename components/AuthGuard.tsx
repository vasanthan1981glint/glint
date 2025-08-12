import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean; // If true, redirects to login if not authenticated
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  requireAuth = true
}) => {
  const { user, userProfile, isLoading, isAuthenticated } = useAuth();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (!isLoading && !hasRedirected) {
      if (requireAuth && !isAuthenticated) {
        // User is not authenticated, redirect to login
        console.log('🚫 User not authenticated, redirecting to login');
        setHasRedirected(true);
        router.replace('/');
      } else if (!requireAuth && isAuthenticated) {
        // User is authenticated but on auth screen, redirect to home immediately
        console.log('✅ User authenticated, redirecting to home');
        setHasRedirected(true);
        router.replace('/(tabs)/home');
      }
    }
  }, [isLoading, isAuthenticated, requireAuth, hasRedirected]);

  // Show super minimal loading - almost no delay
  if (isLoading) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: '#000'
      }}>
        {/* Empty black screen for instant transition */}
      </View>
    );
  }

  // If we're redirecting, show nothing to avoid flash
  if (hasRedirected) {
    return null;
  }

  // If requireAuth is true and user is not authenticated, don't render children
  if (requireAuth && !isAuthenticated) {
    return null;
  }

  // If requireAuth is false and user is authenticated, don't render children
  if (!requireAuth && isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard;
