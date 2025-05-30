import * as Sentry from '@sentry/react-native';

export function initializeSentry() {
  try {
    Sentry.init({
      dsn: 'https://95ca621b3a918874f6289b653a3e3f6a@o4509201331978240.ingest.de.sentry.io/4509201333092432',
      // Adds more context data to events (IP address, cookies, user, etc.)
      // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
      sendDefaultPii: true,
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for tracing.
      // We recommend adjusting this value in production.
      // Learn more at
      // https://docs.sentry.io/platforms/react-native/configuration/options/#traces-sample-rate
      tracesSampleRate: 1.0,
      debug: __DEV__, // Enable debug mode in development
      environment: __DEV__ ? 'development' : 'production',
    });

    console.log('Sentry initialized successfully');
  } catch (error) {
    console.warn('Sentry initialization failed:', error);
  }
}

// Export commonly used functions
export const { captureException, captureMessage, addBreadcrumb } = Sentry;
export default Sentry;
