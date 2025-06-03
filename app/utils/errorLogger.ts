import {
  addBreadcrumb,
  captureAPIError,
  captureAuthError,
  captureDatabaseError,
  captureError,
  captureMessage,
  captureNavigationError,
  captureNetworkError,
  capturePerformanceError,
  captureStorageError,
  captureUIError,
  captureValidationError,
  captureWorkoutError,
  simpleErrorHandler,
  type ErrorContext,
} from '../services/sentry/simpleErrorHandler';

/**
 * Error Logger Utility for MindMuscle.AI
 *
 * This utility provides easy-to-use functions for logging errors, warnings, and issues
 * throughout the entire application. All logs are automatically sent to Sentry.
 *
 * Usage Examples:
 *
 * // Basic error logging
 * logError(new Error('Something went wrong'), { component: 'MyComponent' });
 *
 * // Log warnings and info messages
 * logWarning('User attempted invalid action', { userId: '123' });
 * logInfo('User completed workout', { workoutId: 'abc' });
 *
 * // Category-specific logging
 * logNavigationError(error, '/home', '/profile');
 * logDatabaseError(error, 'users', 'insert');
 * logWorkoutError(error, 'workout123', 'exercise456');
 *
 * // Performance issues
 * logPerformanceIssue('Slow API response', 'api_call', 5000);
 *
 * // Add breadcrumbs for debugging
 * addDebugBreadcrumb('User clicked button', { buttonId: 'submit' });
 */

// Basic logging functions

/**
 * Log an error with optional context
 */
export const logError = (error: Error, context?: Partial<ErrorContext>): void => {
  captureError(error, context);
};

/**
 * Log a warning message
 */
export const logWarning = (message: string, context?: Partial<ErrorContext>): void => {
  captureMessage(message, 'warning', context);
};

/**
 * Log an info message
 */
export const logInfo = (message: string, context?: Partial<ErrorContext>): void => {
  captureMessage(message, 'info', context);
};

/**
 * Add a breadcrumb for debugging
 */
export const addDebugBreadcrumb = (message: string, data?: Record<string, unknown>): void => {
  addBreadcrumb(message, 'debug', data);
};

// Category-specific logging functions

/**
 * Log navigation-related errors
 */
export const logNavigationError = (error: Error, fromRoute?: string, toRoute?: string): void => {
  captureNavigationError(error, fromRoute, toRoute);
};

/**
 * Log database-related errors
 */
export const logDatabaseError = (error: Error, table?: string, operation?: string): void => {
  captureDatabaseError(error, table, operation);
};

/**
 * Log authentication-related errors
 */
export const logAuthError = (error: Error, authAction?: string): void => {
  captureAuthError(error, authAction);
};

/**
 * Log workout-related errors
 */
export const logWorkoutError = (error: Error, workoutId?: string, exerciseId?: string): void => {
  captureWorkoutError(error, workoutId, exerciseId);
};

/**
 * Log UI-related errors
 */
export const logUIError = (error: Error, component?: string, screen?: string): void => {
  captureUIError(error, component, screen);
};

/**
 * Log network-related errors
 */
export const logNetworkError = (
  error: Error,
  url?: string,
  method?: string,
  status?: number,
): void => {
  captureNetworkError(error, url, method, status);
};

/**
 * Log storage-related errors
 */
export const logStorageError = (error: Error, storageType?: string, operation?: string): void => {
  captureStorageError(error, storageType, operation);
};

/**
 * Log API-related errors
 */
export const logAPIError = (error: Error, endpoint?: string, service?: string): void => {
  captureAPIError(error, endpoint, service);
};

/**
 * Log validation-related errors
 */
export const logValidationError = (error: Error, field?: string, value?: unknown): void => {
  captureValidationError(error, field, value);
};

/**
 * Log performance issues
 */
export const logPerformanceIssue = (message: string, metric?: string, value?: number): void => {
  capturePerformanceError(message, metric, value);
};

// Utility functions for common scenarios

/**
 * Log a try-catch error with automatic context
 */
export const logTryCatchError = (
  error: unknown,
  operation: string,
  context?: Partial<ErrorContext>,
): void => {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  logError(errorObj, {
    ...context,
    operation,
    errorType: 'try_catch',
  });
};

/**
 * Log an async operation error
 */
export const logAsyncError = (
  error: unknown,
  operation: string,
  context?: Partial<ErrorContext>,
): void => {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  logError(errorObj, {
    ...context,
    operation,
    errorType: 'async_operation',
  });
};

/**
 * Log a component lifecycle error
 */
export const logComponentError = (
  error: Error,
  componentName: string,
  lifecycle: 'mount' | 'update' | 'unmount' | 'render',
  props?: Record<string, unknown>,
): void => {
  logUIError(error, componentName, undefined);
  addDebugBreadcrumb(`Component ${lifecycle} error in ${componentName}`, {
    lifecycle,
    props: props ? Object.keys(props) : undefined,
  });
};

/**
 * Log a hook error
 */
export const logHookError = (
  error: Error,
  hookName: string,
  context?: Record<string, unknown>,
): void => {
  logError(error, {
    component: hookName,
    category: 'ui_error',
    hookType: 'custom_hook',
    ...context,
  });
};

/**
 * Log a service error
 */
export const logServiceError = (
  error: Error,
  serviceName: string,
  method: string,
  context?: Record<string, unknown>,
): void => {
  logError(error, {
    component: serviceName,
    category: 'api_error',
    serviceMethod: method,
    ...context,
  });
};

/**
 * Log a user action that resulted in an error
 */
export const logUserActionError = (
  error: Error,
  action: string,
  screen?: string,
  context?: Record<string, unknown>,
): void => {
  logError(error, {
    screen,
    category: 'ui_error',
    userAction: action,
    ...context,
  });
  addDebugBreadcrumb(`User action error: ${action}`, {
    screen,
    action,
    ...context,
  });
};

/**
 * Log a form validation error
 */
export const logFormValidationError = (
  error: Error,
  formName: string,
  field?: string,
  value?: unknown,
): void => {
  logValidationError(error, field, value);
  addDebugBreadcrumb(`Form validation error in ${formName}`, {
    formName,
    field,
    hasValue: value !== undefined,
  });
};

/**
 * Log a data loading error
 */
export const logDataLoadingError = (
  error: Error,
  dataType: string,
  source: 'api' | 'database' | 'cache' | 'storage',
  context?: Record<string, unknown>,
): void => {
  const category =
    source === 'api' ? 'api_error' : source === 'database' ? 'database_error' : 'storage_error';

  logError(error, {
    category,
    dataType,
    source,
    ...context,
  });
};

/**
 * Log a timeout error
 */
export const logTimeoutError = (
  operation: string,
  timeoutMs: number,
  context?: Record<string, unknown>,
): void => {
  const error = new Error(`Operation timed out after ${timeoutMs}ms: ${operation}`);
  logError(error, {
    category: 'performance_error',
    operation,
    timeoutMs,
    errorType: 'timeout',
    ...context,
  });
};

/**
 * Log a memory warning
 */
export const logMemoryWarning = (
  availableMemory?: number,
  usedMemory?: number,
  context?: Record<string, unknown>,
): void => {
  logPerformanceIssue('Memory warning detected', 'memory_usage', usedMemory);
  addDebugBreadcrumb('Memory warning', {
    availableMemory,
    usedMemory,
    platform: 'ios',
    ...context,
  });
};

/**
 * Set user context for error tracking
 */
export const setUserContext = (userId: string, email?: string, username?: string): void => {
  simpleErrorHandler.setUser(userId, email, username);
};

/**
 * Set current screen for error tracking
 */
export const setCurrentScreen = (screenName: string): void => {
  simpleErrorHandler.setScreen(screenName);
};

/**
 * Set current component for error tracking
 */
export const setCurrentComponent = (componentName: string): void => {
  simpleErrorHandler.setComponent(componentName);
};

/**
 * Test error logging functionality
 */
export const testErrorLogging = (): void => {
  console.log('🧪 Testing error logging functionality...');

  // Test basic error logging
  logError(new Error('Test error'), { component: 'ErrorLogger' });

  // Test warning and info
  logWarning('Test warning message');
  logInfo('Test info message');

  // Test category-specific logging
  logUIError(new Error('Test UI error'), 'TestComponent', 'TestScreen');
  logPerformanceIssue('Test performance issue', 'test_metric', 100);

  // Test breadcrumbs
  addDebugBreadcrumb('Test breadcrumb', { test: true });

  console.log('✅ Error logging test completed');
};

// Export all functions for easy importing
export default {
  // Basic logging
  logError,
  logWarning,
  logInfo,
  addDebugBreadcrumb,

  // Category-specific logging
  logNavigationError,
  logDatabaseError,
  logAuthError,
  logWorkoutError,
  logUIError,
  logNetworkError,
  logStorageError,
  logAPIError,
  logValidationError,
  logPerformanceIssue,

  // Utility functions
  logTryCatchError,
  logAsyncError,
  logComponentError,
  logHookError,
  logServiceError,
  logUserActionError,
  logFormValidationError,
  logDataLoadingError,
  logTimeoutError,
  logMemoryWarning,

  // Context functions
  setUserContext,
  setCurrentScreen,
  setCurrentComponent,

  // Testing
  testErrorLogging,
};
