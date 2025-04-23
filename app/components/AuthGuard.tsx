import React, { useEffect, useState } from 'react';
import { Redirect, usePathname, useRouter } from 'expo-router';
import { useAuth } from '../store/AuthContext';
import InitialLoadingScreen from './InitialLoadingScreen';
import { logger } from '../utils/logger';
import { View } from 'react-native';

// Debug settings for AuthGuard
const DEBUG_MODE = false; // Enable extended authentication loading screen
const DEBUG_AUTH_DELAY = 10000; // 10 seconds delay for testing loading screen

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { session, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [readyToNavigate, setReadyToNavigate] = useState(false);
  const [mountComplete, setMountComplete] = useState(false);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

  // Auth-exempt paths (login, register, etc.)
  const authExemptPaths = [
    '/(auth)/login',
    '/(auth)/register',
    '/(auth)/forgot-password',
    '/(auth)/reset-password',
  ];

  const isAuthExempt = authExemptPaths.some(path => pathname.includes(path));

  // Mark mount as complete after a short delay to ensure React has finished rendering
  useEffect(() => {
    const timer = setTimeout(() => {
      setMountComplete(true);
    }, 200);
    
    return () => clearTimeout(timer);
  }, []);

  // Handle authentication check with optional debug delay
  useEffect(() => {
    if (!loading && mountComplete && !authCheckComplete) {
      if (DEBUG_MODE) {
        console.log(`Debug mode: Delaying auth check by ${DEBUG_AUTH_DELAY/1000} seconds`);
        
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
  }, [loading, mountComplete, authCheckComplete]);

  // Handle navigation after auth check is complete
  useEffect(() => {
    if (authCheckComplete) {
      if (!session && !isAuthExempt) {
        logger.info('User not authenticated, redirecting to login', { 
          context: { currentPath: pathname } 
        });
        
        // Use a slight delay to ensure Root Layout is fully mounted
        const timer = setTimeout(() => {
          setReadyToNavigate(true);
        }, 300);
        
        return () => clearTimeout(timer);
      } else {
        // For authenticated users or exempt pages, no delay needed
        setReadyToNavigate(true);
      }
    }
  }, [authCheckComplete, session, pathname, isAuthExempt]);

  // Programmatic navigation using router.replace instead of Redirect for unauthenticated users
  useEffect(() => {
    if (readyToNavigate && !loading && !session && !isAuthExempt) {
      const timer = setTimeout(() => {
        router.replace('/(auth)/login');
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [readyToNavigate, loading, session, isAuthExempt, router]);

  // If we're loading the auth state or during debug delay, show loading screen
  if (loading || (DEBUG_MODE && !authCheckComplete)) {
    return <InitialLoadingScreen showProgress={true} message="Checking authentication..." />;
  }

  // Instead of using Redirect directly, show children and let the useEffect handle navigation
  return <>{children}</>;
} 