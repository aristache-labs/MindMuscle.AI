import { Redirect } from 'expo-router';
import { useAuth } from '@store/AuthContext';
import InitialLoadingScreen from './components/InitialLoadingScreen';

export default function Index() {
  const { session, loading } = useAuth();

  // Show loading screen while checking authentication state
  if (loading) {
    return <InitialLoadingScreen showProgress={true} message="Loading..." />;
  }

  // Redirect based on authentication state
  if (session) {
    // User is authenticated, redirect to main app
    return <Redirect href="/(tabs)" />;
  } else {
    // User is not authenticated, redirect to login
    return <Redirect href="/(auth)/login" />;
  }
}
