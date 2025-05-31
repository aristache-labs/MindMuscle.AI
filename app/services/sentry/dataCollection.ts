import * as Sentry from '@sentry/react-native';

/**
 * Basic Sentry Data Collection Utilities
 * Provides simple wrapper functions for common Sentry operations
 */
export const SentryDataCollection = {
  // Set user information
  setUser: (userData: { id?: string; email?: string; username?: string; ip_address?: string }) => {
    Sentry.setUser(userData);
  },

  // Clear user information
  clearUser: () => {
    Sentry.setUser(null);
  },

  // Set context
  setContext: (key: string, context: Record<string, unknown>) => {
    Sentry.setContext(key, context);
  },

  // Set tag
  setTag: (key: string, value: string) => {
    Sentry.setTag(key, value);
  },

  // Add breadcrumb
  addBreadcrumb: (breadcrumb: {
    message: string;
    category?: string;
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
    data?: Record<string, unknown>;
  }) => {
    Sentry.addBreadcrumb(breadcrumb);
  },

  // Capture exception
  captureException: (error: Error, context?: Record<string, unknown>) => {
    if (context) {
      Sentry.withScope((scope) => {
        scope.setContext('additional_context', context);
        Sentry.captureException(error);
      });
    } else {
      Sentry.captureException(error);
    }
  },

  // Capture message
  captureMessage: (
    message: string,
    level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  ) => {
    Sentry.captureMessage(message, level);
  },
};
