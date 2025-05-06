import { useRouter, Redirect } from 'expo-router';
import { useAuth } from '@store/AuthContext';
import { logger } from '@utils/logger';

export default function Index() {
  const { session, loading } = useAuth();

  // Don't show anything while checking authentication state
  if (loading) {
    return null;
  }

  // Log authentication status
  if (!session) {
    logger.info('User not authenticated in index, redirecting to login');
    return <Redirect href="/(auth)/login" />;
  } else {
    logger.info('User authenticated in index, redirecting to main app');
    return <Redirect href="/(tabs)" />;
  }
} 