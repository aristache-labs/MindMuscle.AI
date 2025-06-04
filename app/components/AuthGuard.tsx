import { Redirect, usePathname } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { logger } from '../utils/logger';
import { useAuth } from '../store/AuthContext';
import InitialLoadingScreen from './InitialLoadingScreen';

// Debug settings for AuthGuard
const DEBUG_MODE = false; // Enable extended authentication loading screen
const DEBUG_AUTH_DELAY = 10000; // 10 seconds delay for testing loading screen

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  // Auth-exempt paths (login, register, etc.)
  const authExemptPaths = [
    '/(auth)/login',
    '/(auth)/register',
    '/(auth)/forgot-password',
    '/(auth)/reset-password',
    // Add flattened routes without group prefixes for compatibility with Expo Router URL structure
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
  ];

  const isAuthExempt = authExemptPaths.some((path) => pathname.includes(path));

  // Handle authentication check with optional debug delay
  useEffect(() => {
    if (!loading && !authCheckComplete) {
      if (DEBUG_MODE) {
        console.log(`Debug mode: Delaying auth check by ${DEBUG_AUTH_DELAY / 1000} seconds`);

        // Apply debug delay
        const debugTimer = setTimeout(() => {
          setAuthCheckComplete(true);
        }, DEBUG_AUTH_DELAY);

        return () => clearTimeout(debugTimer);
      } else {
        // No debug delay, proceed immediately
        setAuthCheckComplete(true);
      }
    }
  }, [loading, authCheckComplete]);

  // If we're loading the auth state or during debug delay, show loading screen
  if (loading || (DEBUG_MODE && !authCheckComplete)) {
    return <InitialLoadingScreen showProgress={true} message="Checking authentication..." />;
  }

  // Handle navigation logic
  if (authCheckComplete) {
    // If user is not authenticated and not on an auth-exempt page, redirect to login
    if (!session && !isAuthExempt) {
      logger.info('User not authenticated, redirecting to login', {
        context: { currentPath: pathname },
      });
      return <Redirect href="/(auth)/login" />;
    }

    // If user is authenticated and on an auth page, redirect to main app
    if (session && isAuthExempt) {
      logger.info('User authenticated on auth page, redirecting to main app');
      return <Redirect href="/(tabs)" />;
    }
  }

  // Show children for all other cases
  return <>{children}</>;
}
