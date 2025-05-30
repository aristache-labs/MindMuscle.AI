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
      debug: false, // Disable debug mode even in development
      environment: Constants.expoConfig?.extra?.environment || 'development',
      tracesSampleRate: 1.0,
      sendDefaultPii: true,
      // Disable user interaction tracing
      integrations: (integrations) => {
        return integrations.filter(
          (integration) => integration.name !== 'UserInteractionIntegration'
        );
      },
      // Silence Sentry logs
      beforeBreadcrumb(breadcrumb) {
        // Return null to drop the breadcrumb
        return breadcrumb.category === 'console' ? null : breadcrumb;
      }
    });
    
    // Disable console logging from Sentry
    Sentry.setTag('silent', 'true');
    
    // Still log initialization success but only once
    if (!__DEV__) {
      console.log('Sentry initialized successfully');
    }
  } catch (error) {
    console.warn('Sentry initialization failed:', error);
  }
}

// Export commonly used functions
export const { captureException, captureMessage, addBreadcrumb } = Sentry;
export default Sentry;