import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Global Error Handler for MindMuscle.AI
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

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'log';

// React Native global interface extension
declare global {
  interface Global {
    ErrorUtils?: {
      setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
    };
    onunhandledrejection?: ((event: PromiseRejectionEvent) => void) | null;
  }
}

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

interface GlobalErrorHandlerConfig {
  enableConsoleCapture: boolean;
  enableUnhandledRejectionCapture: boolean;
  enableReactErrorBoundary: boolean;
  enableNetworkErrorCapture: boolean;
  enablePerformanceMonitoring: boolean;
  enableMemoryWarningCapture: boolean;
  enableNavigationErrorCapture: boolean;
  enableDatabaseErrorCapture: boolean;
  enableAuthErrorCapture: boolean;
  enableWorkoutErrorCapture: boolean;
  enableUIErrorCapture: boolean;
  enableStorageErrorCapture: boolean;
  enableAPIErrorCapture: boolean;
  enableValidationErrorCapture: boolean;
  maxBreadcrumbs: number;
  sampleRate: number;
  enableDebugLogs: boolean;
}

class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private config: GlobalErrorHandlerConfig;
  private originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
    debug: typeof console.debug;
    info: typeof console.info;
  };
  private sessionId: string;
  private isInitialized = false;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
      info: console.info.bind(console),
    };

    this.config = {
      enableConsoleCapture: true,
      enableUnhandledRejectionCapture: true,
      enableReactErrorBoundary: true,
      enableNetworkErrorCapture: true,
      enablePerformanceMonitoring: true,
      enableMemoryWarningCapture: true,
      enableNavigationErrorCapture: true,
      enableDatabaseErrorCapture: true,
      enableAuthErrorCapture: true,
      enableWorkoutErrorCapture: true,
      enableUIErrorCapture: true,
      enableStorageErrorCapture: true,
      enableAPIErrorCapture: true,
      enableValidationErrorCapture: true,
      maxBreadcrumbs: 100,
      sampleRate: __DEV__ ? 1.0 : 0.8,
      enableDebugLogs: __DEV__,
    };
  }

  public static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
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

  public initialize(customConfig?: Partial<GlobalErrorHandlerConfig>): void {
    if (this.isInitialized) {
      this.originalConsole.warn('GlobalErrorHandler already initialized');
      return;
    }

    // Merge custom config with defaults
    this.config = { ...this.config, ...customConfig };

    // Initialize all error handlers
    this.setupConsoleCapture();
    this.setupUnhandledRejectionCapture();
    this.setupGlobalJavaScriptErrorHandler();
    this.setupNetworkErrorCapture();
    this.setupPerformanceMonitoring();
    this.setupMemoryWarningCapture();

    this.isInitialized = true;

    // Send initialization event
    this.captureMessage('GlobalErrorHandler initialized successfully', 'info', {
      category: 'javascript_error',
      config: this.config,
    });

    this.originalConsole.log('🚀 GlobalErrorHandler initialized with comprehensive monitoring');
  }

  private setupConsoleCapture(): void {
    if (!this.config.enableConsoleCapture) return;

    // Override console methods to capture all logs
    console.log = (...args: unknown[]) => {
      this.originalConsole.log(...args);
      this.captureConsoleMessage('log', args);
    };

    console.warn = (...args: unknown[]) => {
      this.originalConsole.warn(...args);
      this.captureConsoleMessage('warn', args);
    };

    console.error = (...args: unknown[]) => {
      this.originalConsole.error(...args);
      this.captureConsoleMessage('error', args);
    };

    console.debug = (...args: unknown[]) => {
      this.originalConsole.debug(...args);
      if (this.config.enableDebugLogs) {
        this.captureConsoleMessage('debug', args);
      }
    };

    console.info = (...args: unknown[]) => {
      this.originalConsole.info(...args);
      this.captureConsoleMessage('info', args);
    };
  }

  private captureConsoleMessage(level: LogLevel, args: unknown[]): void {
    const message = args
      .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)))
      .join(' ');

    // Skip Sentry's own logs to prevent infinite loops
    if (message.includes('Sentry') || message.includes('sentry')) {
      return;
    }

    const context = this.createBaseContext();
    context.category = this.categorizeConsoleMessage(message);
    context.consoleLevel = level;
    context.originalArgs = args;

    // Convert LogLevel to Sentry SeverityLevel
    const sentryLevel = this.convertToSentryLevel(level);

    // Add breadcrumb for all console messages
    Sentry.addBreadcrumb({
      message: `Console ${level}: ${message}`,
      category: `console.${level}`,
      level: sentryLevel,
      data: {
        args: args.slice(0, 5), // Limit args to prevent large payloads
        sessionId: this.sessionId,
      },
    });

    // Capture errors and warnings as events
    if (level === 'error' || level === 'warn') {
      this.captureMessage(message, level, context);
    }
  }

  private convertToSentryLevel(level: LogLevel): Sentry.SeverityLevel {
    switch (level) {
      case 'log':
      case 'debug':
        return 'debug';
      case 'info':
        return 'info';
      case 'warn':
        return 'warning';
      case 'error':
        return 'error';
      case 'fatal':
        return 'fatal';
      default:
        return 'info';
    }
  }

  // Split the complex categorizeConsoleMessage method into smaller functions
  private categorizeConsoleMessage(message: string): ErrorCategory {
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

  private setupUnhandledRejectionCapture(): void {
    if (!this.config.enableUnhandledRejectionCapture) return;

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
          this.originalConsole.error(
            'Error in original unhandled rejection handler:',
            handlerError,
          );
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

  private setupNetworkErrorCapture(): void {
    if (!this.config.enableNetworkErrorCapture) return;

    // Override fetch to capture network errors
    const originalFetch = global.fetch;
    global.fetch = async (...args: Parameters<typeof fetch>) => {
      const startTime = Date.now();
      const url = this.extractUrlFromFetchArgs(args);

      try {
        const response = await originalFetch(...args);

        // Log successful requests as breadcrumbs
        Sentry.addBreadcrumb({
          message: `Network request: ${response.status} ${url}`,
          category: 'network.success',
          level: 'info',
          data: {
            url,
            status: response.status,
            duration: Date.now() - startTime,
            method: args[1]?.method || 'GET',
          },
        });

        // Capture 4xx and 5xx responses as errors
        if (response.status >= 400) {
          const context = this.createBaseContext();
          context.category = 'network_error';
          context.url = url;
          context.status = response.status;
          context.method = args[1]?.method || 'GET';
          context.duration = Date.now() - startTime;

          this.captureMessage(
            `Network error: ${response.status} ${url}`,
            response.status >= 500 ? 'error' : 'warn',
            context,
          );
        }

        return response;
      } catch (error) {
        const context = this.createBaseContext();
        context.category = 'network_error';
        context.url = url;
        context.method = args[1]?.method || 'GET';
        context.duration = Date.now() - startTime;

        this.captureException(error instanceof Error ? error : new Error(String(error)), context);

        throw error;
      }
    };
  }

  private extractUrlFromFetchArgs(args: Parameters<typeof fetch>): string {
    const firstArg = args[0];
    if (typeof firstArg === 'string') {
      return firstArg;
    }
    if (firstArg instanceof Request) {
      return firstArg.url;
    }
    if (firstArg instanceof URL) {
      return firstArg.toString();
    }
    return 'unknown';
  }

  private setupPerformanceMonitoring(): void {
    if (!this.config.enablePerformanceMonitoring) return;

    // Monitor app state changes
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // This would be implemented with AppState from react-native
      // but we'll add it as a breadcrumb for now
      Sentry.addBreadcrumb({
        message: 'Performance monitoring enabled',
        category: 'performance.setup',
        level: 'info',
      });
    }
  }

  private setupMemoryWarningCapture(): void {
    if (!this.config.enableMemoryWarningCapture || Platform.OS !== 'ios') return;

    // iOS memory warning handling would be implemented here
    // For now, we'll set up the infrastructure
    Sentry.addBreadcrumb({
      message: 'Memory warning capture enabled',
      category: 'memory.setup',
      level: 'info',
    });
  }

  // Public methods for manual error reporting

  public captureException(error: Error, context?: Partial<ErrorContext>): void {
    const fullContext = { ...this.createBaseContext(), ...context };

    Sentry.withScope((scope) => {
      // Set tags
      scope.setTag('error_category', fullContext.category);
      scope.setTag('platform', fullContext.platform);
      scope.setTag('session_id', fullContext.sessionId);

      if (fullContext.component) scope.setTag('component', fullContext.component);
      if (fullContext.screen) scope.setTag('screen', fullContext.screen);
      if (fullContext.userId) scope.setTag('user_id', fullContext.userId);

      // Set context
      scope.setContext('error_details', fullContext);

      // Set level based on category
      const level = this.getErrorLevel(fullContext.category);
      scope.setLevel(level);

      Sentry.captureException(error);
    });
  }

  public captureMessage(
    message: string,
    level: LogLevel = 'info',
    context?: Partial<ErrorContext>,
  ): void {
    const fullContext = { ...this.createBaseContext(), ...context };
    const sentryLevel = this.convertToSentryLevel(level);

    Sentry.withScope((scope) => {
      // Set tags
      scope.setTag('message_category', fullContext.category);
      scope.setTag('platform', fullContext.platform);
      scope.setTag('session_id', fullContext.sessionId);

      if (fullContext.component) scope.setTag('component', fullContext.component);
      if (fullContext.screen) scope.setTag('screen', fullContext.screen);
      if (fullContext.userId) scope.setTag('user_id', fullContext.userId);

      // Set context
      scope.setContext('message_details', fullContext);

      // Set level
      scope.setLevel(sentryLevel);

      Sentry.captureMessage(message, sentryLevel);
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
    this.captureMessage(message, 'warn', {
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

  public updateConfig(newConfig: Partial<GlobalErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): GlobalErrorHandlerConfig {
    return { ...this.config };
  }

  // Test methods for verification

  public testErrorCapture(): void {
    this.originalConsole.log('🧪 Testing GlobalErrorHandler...');

    // Test console capture
    console.warn('Test warning message');
    console.error('Test error message');

    // Test exception capture
    this.captureException(new Error('Test exception'), {
      category: 'javascript_error',
      component: 'GlobalErrorHandler',
    });

    // Test message capture
    this.captureMessage('Test message capture', 'info', {
      category: 'javascript_error',
    });

    // Test breadcrumb
    this.addBreadcrumb('Test breadcrumb', 'test');

    this.originalConsole.log('✅ GlobalErrorHandler test completed');
  }
}

// Export singleton instance
export const globalErrorHandler = GlobalErrorHandler.getInstance();

// Export types
export type { ErrorContext, GlobalErrorHandlerConfig };

// Export convenience functions
export const captureError = (error: Error, context?: Partial<ErrorContext>) =>
  globalErrorHandler.captureException(error, context);

export const captureMessage = (
  message: string,
  level: LogLevel = 'info',
  context?: Partial<ErrorContext>,
) => globalErrorHandler.captureMessage(message, level, context);

export const addBreadcrumb = (message: string, category: string, data?: Record<string, unknown>) =>
  globalErrorHandler.addBreadcrumb(message, category, data);

// Category-specific convenience functions
export const captureNavigationError = (error: Error, fromRoute?: string, toRoute?: string) =>
  globalErrorHandler.captureNavigationError(error, fromRoute, toRoute);

export const captureDatabaseError = (error: Error, table?: string, operation?: string) =>
  globalErrorHandler.captureDatabaseError(error, table, operation);

export const captureAuthError = (error: Error, authAction?: string) =>
  globalErrorHandler.captureAuthError(error, authAction);

export const captureWorkoutError = (error: Error, workoutId?: string, exerciseId?: string) =>
  globalErrorHandler.captureWorkoutError(error, workoutId, exerciseId);

export const captureUIError = (error: Error, component?: string, screen?: string) =>
  globalErrorHandler.captureUIError(error, component, screen);

export const captureNetworkError = (error: Error, url?: string, method?: string, status?: number) =>
  globalErrorHandler.captureNetworkError(error, url, method, status);

export const captureStorageError = (error: Error, storageType?: string, operation?: string) =>
  globalErrorHandler.captureStorageError(error, storageType, operation);

export const captureAPIError = (error: Error, endpoint?: string, service?: string) =>
  globalErrorHandler.captureAPIError(error, endpoint, service);

export const captureValidationError = (error: Error, field?: string, value?: unknown) =>
  globalErrorHandler.captureValidationError(error, field, value);

export const capturePerformanceError = (message: string, metric?: string, value?: number) =>
  globalErrorHandler.capturePerformanceError(message, metric, value);
