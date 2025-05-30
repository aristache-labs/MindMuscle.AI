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

      // Data Collection Configuration
      // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/

      // Adds more context data to events (IP address, cookies, user, etc.)
      // Set to true to send PII data like user info, device names, etc.
      sendDefaultPii: true,

      // Configure what data to send
      beforeSend(event, _hint) {
        // You can filter or modify events before they're sent
        // This is useful for scrubbing sensitive data

        // Example: Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers['Authorization'];
          delete event.request.headers['Cookie'];
        }

        // Example: Scrub sensitive query parameters
        if (event.request?.query_string && typeof event.request.query_string === 'string') {
          // Remove sensitive query parameters
          event.request.query_string = event.request.query_string
            .replace(/password=[^&]*/gi, 'password=[Filtered]')
            .replace(/token=[^&]*/gi, 'token=[Filtered]');
        }

        return event;
      },

      // Breadcrumbs configuration
      integrations: [
        Sentry.breadcrumbsIntegration({
          // Console logs are sent by default, set to false to disable
          console: true,
          // DOM events breadcrumbs
          dom: true,
          // Fetch/XHR breadcrumbs
          fetch: true,
          // History API breadcrumbs
          history: true,
          // Sentry SDK internal errors
          sentry: true,
        }),

        // HTTP client integration for request/response data
        Sentry.httpClientIntegration({
          // Capture failed requests
          failedRequestStatusCodes: [400, 599],
          // Capture successful requests (optional)
          // captureRequestBody: true,
          // captureResponseBody: true,
        }),

        // HTTP context integration for User-Agent and other HTTP context
        Sentry.httpContextIntegration(),

        // Screenshot integration (disabled by default for privacy)
        Sentry.screenshotIntegration(),

        // View hierarchy integration (disabled by default for privacy)
        Sentry.viewHierarchyIntegration(),
      ],

      // Performance monitoring
      tracesSampleRate: __DEV__ ? 1.0 : 0.1, // Lower in production
      profilesSampleRate: __DEV__ ? 1.0 : 0.1, // Lower in production

      // Session tracking
      autoSessionTracking: true,

      // Debug configuration
      debug: __DEV__,
      environment: Constants.expoConfig?.extra?.environment || 'development',

      // Release and dist for better error tracking
      release: Constants.expoConfig?.version || '1.0.0',
      dist: Constants.expoConfig?.extra?.buildNumber || '1',

      // Enable native crash handling
      enableNativeCrashHandling: true,

      // Enable auto session tracking
      enableAutoSessionTracking: true,

      // Session timeout (in seconds)
      sessionTrackingIntervalMillis: 30000,

      // Maximum breadcrumbs
      maxBreadcrumbs: 100,

      // Attach stack trace to messages
      attachStacktrace: true,

      // Send client reports
      sendClientReports: true,
    });

    // Set user context if available
    Sentry.setUser({
      // Don't set PII here unless sendDefaultPii is true
      // id: 'user-id',
      // email: 'user@example.com',
      // username: 'username',
      ip_address: '{{auto}}', // Let Sentry determine IP automatically
    });

    // Set additional context
    Sentry.setContext('app_info', {
      app_version: Constants.expoConfig?.version,
      expo_version: Constants.expoConfig?.sdkVersion,
      platform: Constants.platform?.ios ? 'ios' : 'android',
    });

    // Log initialization success
    if (__DEV__) {
      console.log('Sentry initialized successfully with DSN:', sentryDsn);
      console.log('Sentry configuration:', {
        sendDefaultPii: true,
        environment: Constants.expoConfig?.extra?.environment || 'development',
        release: Constants.expoConfig?.version || '1.0.0',
      });
    }
  } catch (error) {
    console.warn('Sentry initialization failed:', error);
  }
}

// Utility functions for data collection management
export const SentryDataCollection = {
  // Set user information (respects sendDefaultPii setting)
  setUser: (user: { id?: string; email?: string; username?: string; ip_address?: string }) => {
    Sentry.setUser(user);
  },

  // Clear user information
  clearUser: () => {
    Sentry.setUser(null);
  },

  // Add custom context
  setContext: (key: string, context: Record<string, any>) => {
    Sentry.setContext(key, context);
  },

  // Add tags for filtering
  setTag: (key: string, value: string) => {
    Sentry.setTag(key, value);
  },

  // Add breadcrumb manually
  addBreadcrumb: (breadcrumb: {
    message: string;
    category?: string;
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
    data?: Record<string, any>;
  }) => {
    Sentry.addBreadcrumb(breadcrumb);
  },

  // Capture exception with additional context
  captureException: (error: Error, context?: Record<string, any>) => {
    if (context) {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([key, value]) => {
          scope.setContext(key, value);
        });
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  },

  // Capture message with level
  captureMessage: (
    message: string,
    level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  ) => {
    Sentry.captureMessage(message, level);
  },
};

// Export commonly used functions
export const { captureException, captureMessage, addBreadcrumb } = Sentry;
export default Sentry;
