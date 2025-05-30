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
      // Adds more context data to events (IP address, cookies, user, etc.)
      // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
      sendDefaultPii: true,
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
      // We recommend adjusting this value in production.
      // Learn more at
      // https://docs.sentry.io/platforms/react-native/configuration/options/#traces-sample-rate
      tracesSampleRate: 1.0,
      // profilesSampleRate is relative to tracesSampleRate.
      // Here, we'll capture profiles for 100% of transactions.
      profilesSampleRate: 1.0,
      debug: __DEV__, // Enable debug mode in development
      environment: Constants.expoConfig?.extra?.environment || 'development',
    });

    // Log initialization success
    if (__DEV__) {
      console.log('Sentry initialized successfully with DSN:', sentryDsn);
    }
  } catch (error) {
    console.warn('Sentry initialization failed:', error);
  }
}

// Export commonly used functions
export const { captureException, captureMessage, addBreadcrumb } = Sentry;
export default Sentry;
