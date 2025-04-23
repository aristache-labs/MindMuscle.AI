import { useRouter } from 'expo-router';
import InitialLoadingScreen from './components/InitialLoadingScreen';
import { useState, useEffect } from 'react';
import { useAuth } from './store/AuthContext';
import { View } from 'react-native';
import { logger } from './utils/logger';

export default function Index() {
  const router = useRouter();
  const [showLoading, setShowLoading] = useState(true);
  const [navigated, setNavigated] = useState(false);
  const { session, loading } = useAuth();

  // Handle navigation in a useEffect to ensure component is fully mounted
  useEffect(() => {
    if (!loading && !navigated) {
      // Add a delay for a smoother transition and to ensure layout is ready
      const timer = setTimeout(() => {
        setShowLoading(false);
        
        // Log authentication status
        if (!session) {
          logger.info('User not authenticated in index, redirecting to login');
          // Use another small delay for navigation
          setTimeout(() => {
            setNavigated(true);
            router.replace('/(auth)/login');
          }, 100);
        } else {
          logger.info('User authenticated in index, redirecting to main app');
          // Use another small delay for navigation
          setTimeout(() => {
            setNavigated(true);
            router.replace('/(tabs)');
          }, 100);
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [loading, session, router, navigated]);

  // Show loading screen while checking auth state or during initial load
  if (loading || showLoading) {
    return <InitialLoadingScreen showProgress={true} message="Getting things ready..." />;
  }

  // Return a placeholder view while the navigation is being processed
  return <View style={{ flex: 1 }} />;
} 