import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

export function initializeSentry() {
  try {
    // Get DSN from app.json
    const sentryDsn = Constants.expoConfig?.extra?.sentryDsn || '';
    
    if (!sentryDsn) {
      console.warn('Sentry DSN is not configured');
      return;
    }
    
    Sentry.init({
      dsn: sentryDsn,
      debug: __DEV__,
      environment: Constants.expoConfig?.extra?.environment || 'development',
      tracesSampleRate: 1.0,
      sendDefaultPii: true
    });
    
    console.log('Sentry initialized successfully');
  } catch (error) {
    console.warn('Sentry initialization failed:', error);
  }
}

// Export commonly used functions
export const { captureException, captureMessage, addBreadcrumb } = Sentry;
export default Sentry;