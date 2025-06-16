import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Global type declarations
declare const window: Window | undefined;

/**
 * Simple Global Error Handler for MindMuscle.AI
 *
 * This module provides comprehensive error logging and monitoring across the entire application.
 * It captures all types of errors, warnings, and issues from every file and folder.
 */

// Types for different error categories
export type ErrorCategory =
  | 'javascript_error'
  | 'promise_rejection'
  | 'navigation_error'
  | 'network_error'
  | 'database_error'
  | 'auth_error'
  | 'workout_error'
  | 'ui_error'
  | 'performance_error'
  | 'memory_error'
  | 'storage_error'
  | 'api_error'
  | 'validation_error'
  | 'unknown_error';

interface ErrorContext {
  category: ErrorCategory;
  component?: string;
  screen?: string;
  userId?: string;
  sessionId?: string;
  timestamp: string;
  platform: string;
  appVersion: string;
  buildNumber: string;
  [key: string]: unknown;
}

class SimpleErrorHandler {
  private static instance: SimpleErrorHandler;
  private sessionId: string;
  private isInitialized = false;

  private constructor() {
    this.sessionId = this.generateSessionId();
  }

  public static getInstance(): SimpleErrorHandler {
    if (!SimpleErrorHandler.instance) {
      SimpleErrorHandler.instance = new SimpleErrorHandler();
    }
    return SimpleErrorHandler.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createBaseContext(): ErrorContext {
    return {
      category: 'unknown_error',
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      appVersion: Constants.expoConfig?.version || '1.0.0',
      buildNumber: Constants.expoConfig?.extra?.buildNumber || '1',
      sessionId: this.sessionId,
    };
  }

  public initialize(): void {
    if (this.isInitialized) {
      console.warn('SimpleErrorHandler already initialized');
      return;
    }

    // Setup unhandled promise rejection capture
    this.setupUnhandledRejectionCapture();

    // Setup global JavaScript error handler
    this.setupGlobalJavaScriptErrorHandler();

    this.isInitialized = true;

    // Send initialization event
    this.captureMessage('SimpleErrorHandler initialized successfully', 'info', {
      category: 'javascript_error',
    });

    console.log('🚀 SimpleErrorHandler initialized with comprehensive monitoring');
  }

  private setupUnhandledRejectionCapture(): void {
    // Handle unhandled promise rejections
    const originalHandler = global.onunhandledrejection;

    global.onunhandledrejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

      const context = this.createBaseContext();
      context.category = 'promise_rejection';
      context.promiseRejectionReason = event.reason;

      this.captureException(error, context);

      // Call original handler if it exists and is compatible
      if (originalHandler && typeof originalHandler === 'function') {
        try {
          // Check if we're in a browser environment with window context
          if (typeof window !== 'undefined' && originalHandler.call) {
            originalHandler.call(window, event);
          } else {
            // In React Native, just call the function directly
            (originalHandler as (event: PromiseRejectionEvent) => void)(event);
          }
        } catch (handlerError) {
          console.error('Error in original unhandled rejection handler:', handlerError);
        }
      }

      // Prevent default behavior
      event.preventDefault();
    };
  }

  private setupGlobalJavaScriptErrorHandler(): void {
    // React Native specific error handling
    const globalWithErrorUtils = global as typeof global & {
      ErrorUtils?: {
        setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
      };
    };

    if (globalWithErrorUtils.ErrorUtils?.setGlobalHandler) {
      globalWithErrorUtils.ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        const context = this.createBaseContext();
        context.category = 'javascript_error';
        context.isFatal = isFatal;
        context.errorType = 'global_javascript_error';

        this.captureException(error, context);
      });
    }
  }

  // Split the complex categorizeMessage method into smaller functions
  private categorizeMessage(message: string): ErrorCategory {
    const lowerMessage = message.toLowerCase();

    // Check navigation errors
    if (this.isNavigationError(lowerMessage)) return 'navigation_error';

    // Check network errors
    if (this.isNetworkError(lowerMessage)) return 'network_error';

    // Check database errors
    if (this.isDatabaseError(lowerMessage)) return 'database_error';

    // Check auth errors
    if (this.isAuthError(lowerMessage)) return 'auth_error';

    // Check workout errors
    if (this.isWorkoutError(lowerMessage)) return 'workout_error';

    // Check UI errors
    if (this.isUIError(lowerMessage)) return 'ui_error';

    // Check storage errors
    if (this.isStorageError(lowerMessage)) return 'storage_error';

    // Check performance errors
    if (this.isPerformanceError(lowerMessage)) return 'performance_error';

    // Check validation errors
    if (this.isValidationError(lowerMessage)) return 'validation_error';

    return 'javascript_error';
  }

  private isNavigationError(message: string): boolean {
    return message.includes('navigation') || message.includes('route');
  }

  private isNetworkError(message: string): boolean {
    return message.includes('network') || message.includes('fetch') || message.includes('api');
  }

  private isDatabaseError(message: string): boolean {
    return message.includes('database') || message.includes('sql') || message.includes('supabase');
  }

  private isAuthError(message: string): boolean {
    return message.includes('auth') || message.includes('login') || message.includes('token');
  }

  private isWorkoutError(message: string): boolean {
    return message.includes('workout') || message.includes('exercise') || message.includes('plan');
  }

  private isUIError(message: string): boolean {
    return message.includes('ui') || message.includes('render') || message.includes('component');
  }

  private isStorageError(message: string): boolean {
    return message.includes('storage') || message.includes('cache') || message.includes('async');
  }

  private isPerformanceError(message: string): boolean {
    return message.includes('memory') || message.includes('performance');
  }

  private isValidationError(message: string): boolean {
    return message.includes('validation') || message.includes('invalid');
  }

  // Public methods for manual error reporting

  public captureException(error: Error, context?: Partial<ErrorContext>): void {
    const fullContext = { ...this.createBaseContext(), ...context };

    Sentry.withScope((scope) => {
      // Set tags
      scope.setTag('error_category', fullContext.category);
      scope.setTag('platform', fullContext.platform);
      scope.setTag('session_id', fullContext.sessionId || 'unknown');

      if (fullContext.component) scope.setTag('component', fullContext.component);
      if (fullContext.screen) scope.setTag('screen', fullContext.screen);
      if (fullContext.userId) scope.setTag('user_id', fullContext.userId);

      // Set context
      scope.setContext('error_details', fullContext);

      // Set level based on category
      const level = this.getErrorLevel(fullContext.category);
      scope.setLevel(level as 'debug' | 'info' | 'warning' | 'error' | 'fatal');

      Sentry.captureException(error);
    });
  }

  public captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    context?: Partial<ErrorContext>,
  ): void {
    const fullContext = { ...this.createBaseContext(), ...context };

    // Auto-categorize if not provided
    if (!context?.category) {
      fullContext.category = this.categorizeMessage(message);
    }

    Sentry.withScope((scope) => {
      // Set tags
      scope.setTag('message_category', fullContext.category);
      scope.setTag('platform', fullContext.platform);
      scope.setTag('session_id', fullContext.sessionId || 'unknown');

      if (fullContext.component) scope.setTag('component', fullContext.component);
      if (fullContext.screen) scope.setTag('screen', fullContext.screen);
      if (fullContext.userId) scope.setTag('user_id', fullContext.userId);

      // Set context
      scope.setContext('message_details', fullContext);

      // Set level
      scope.setLevel(level as 'debug' | 'info' | 'warning' | 'error' | 'fatal');

      Sentry.captureMessage(message, level);
    });
  }

  public addBreadcrumb(message: string, category: string, data?: Record<string, unknown>): void {
    Sentry.addBreadcrumb({
      message,
      category,
      level: 'info',
      data: {
        ...data,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private getErrorLevel(category: ErrorCategory): Sentry.SeverityLevel {
    switch (category) {
      case 'javascript_error':
      case 'promise_rejection':
      case 'database_error':
      case 'auth_error':
        return 'error';
      case 'network_error':
      case 'api_error':
      case 'storage_error':
        return 'warning';
      case 'navigation_error':
      case 'ui_error':
      case 'validation_error':
        return 'info';
      case 'performance_error':
      case 'memory_error':
        return 'warning';
      case 'workout_error':
        return 'info';
      default:
        return 'error';
    }
  }

  // Category-specific error handlers

  public captureNavigationError(error: Error, fromRoute?: string, toRoute?: string): void {
    this.captureException(error, {
      category: 'navigation_error',
      fromRoute,
      toRoute,
    });
  }

  public captureDatabaseError(error: Error, table?: string, operation?: string): void {
    this.captureException(error, {
      category: 'database_error',
      table,
      operation,
    });
  }

  public captureAuthError(error: Error, authAction?: string): void {
    this.captureException(error, {
      category: 'auth_error',
      authAction,
    });
  }

  public captureWorkoutError(error: Error, workoutId?: string, exerciseId?: string): void {
    this.captureException(error, {
      category: 'workout_error',
      workoutId,
      exerciseId,
    });
  }

  public captureUIError(error: Error, component?: string, screen?: string): void {
    this.captureException(error, {
      category: 'ui_error',
      component,
      screen,
    });
  }

  public captureNetworkError(error: Error, url?: string, method?: string, status?: number): void {
    this.captureException(error, {
      category: 'network_error',
      url,
      method,
      status,
    });
  }

  public captureStorageError(error: Error, storageType?: string, operation?: string): void {
    this.captureException(error, {
      category: 'storage_error',
      storageType,
      operation,
    });
  }

  public captureAPIError(error: Error, endpoint?: string, service?: string): void {
    this.captureException(error, {
      category: 'api_error',
      endpoint,
      service,
    });
  }

  public captureValidationError(error: Error, field?: string, value?: unknown): void {
    this.captureException(error, {
      category: 'validation_error',
      field,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    });
  }

  public capturePerformanceError(message: string, metric?: string, value?: number): void {
    this.captureMessage(message, 'warning', {
      category: 'performance_error',
      metric,
      value,
    });
  }

  // Utility methods

  public setUser(userId: string, email?: string, username?: string): void {
    Sentry.setUser({
      id: userId,
      email,
      username,
    });
  }

  public setScreen(screenName: string): void {
    Sentry.setTag('current_screen', screenName);
    Sentry.addBreadcrumb({
      message: `Screen changed to: ${screenName}`,
      category: 'navigation',
      level: 'info',
    });
  }

  public setComponent(componentName: string): void {
    Sentry.setTag('current_component', componentName);
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  // Test methods for verification

  public testErrorCapture(): void {
    console.log('🧪 Testing SimpleErrorHandler...');

    // Test exception capture
    this.captureException(new Error('Test exception'), {
      category: 'javascript_error',
      component: 'SimpleErrorHandler',
    });

    // Test message capture
    this.captureMessage('Test message capture', 'info', {
      category: 'javascript_error',
    });

    // Test breadcrumb
    this.addBreadcrumb('Test breadcrumb', 'test');

    console.log('✅ SimpleErrorHandler test completed');
  }
}

// Export singleton instance
export const simpleErrorHandler = SimpleErrorHandler.getInstance();

// Export types
export type { ErrorContext };

// Export convenience functions
export const captureError = (error: Error, context?: Partial<ErrorContext>) =>
  simpleErrorHandler.captureException(error, context);

export const captureMessage = (
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Partial<ErrorContext>,
) => simpleErrorHandler.captureMessage(message, level, context);

export const addBreadcrumb = (message: string, category: string, data?: Record<string, unknown>) =>
  simpleErrorHandler.addBreadcrumb(message, category, data);

// Category-specific convenience functions
export const captureNavigationError = (error: Error, fromRoute?: string, toRoute?: string) =>
  simpleErrorHandler.captureNavigationError(error, fromRoute, toRoute);

export const captureDatabaseError = (error: Error, table?: string, operation?: string) =>
  simpleErrorHandler.captureDatabaseError(error, table, operation);

export const captureAuthError = (error: Error, authAction?: string) =>
  simpleErrorHandler.captureAuthError(error, authAction);

export const captureWorkoutError = (error: Error, workoutId?: string, exerciseId?: string) =>
  simpleErrorHandler.captureWorkoutError(error, workoutId, exerciseId);

export const captureUIError = (error: Error, component?: string, screen?: string) =>
  simpleErrorHandler.captureUIError(error, component, screen);

export const captureNetworkError = (error: Error, url?: string, method?: string, status?: number) =>
  simpleErrorHandler.captureNetworkError(error, url, method, status);

export const captureStorageError = (error: Error, storageType?: string, operation?: string) =>
  simpleErrorHandler.captureStorageError(error, storageType, operation);

export const captureAPIError = (error: Error, endpoint?: string, service?: string) =>
  simpleErrorHandler.captureAPIError(error, endpoint, service);

export const captureValidationError = (error: Error, field?: string, value?: unknown) =>
  simpleErrorHandler.captureValidationError(error, field, value);

export const capturePerformanceError = (message: string, metric?: string, value?: number) =>
  simpleErrorHandler.capturePerformanceError(message, metric, value);

// Default export to satisfy Expo Router (this file should not be a route)
export default function SimpleErrorHandlerRouterPlaceholder() {
  return null;
}
