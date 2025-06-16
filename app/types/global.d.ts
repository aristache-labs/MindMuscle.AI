/**
 * Global TypeScript declarations for third-party modules without type definitions
 * Enhanced with Sentry monitoring and performance tracking support for MindMuscle.AI
 */

// Declaration for react-native-polyfill-globals
declare module 'react-native-polyfill-globals' {
  export function polyfillGlobals(): void;
  export default polyfillGlobals;
}

// Other module declarations as needed
declare module 'web-streams-polyfill';

// Sentry Module Declarations
declare module '@sentry/react-native' {
  export interface SentryOptions {
    dsn?: string;
    debug?: boolean;
    environment?: string;
    release?: string;
    dist?: string;
    enableAutoSessionTracking?: boolean;
    sessionTrackingIntervalMillis?: number;
    enableOutOfMemoryTracking?: boolean;
    maxBreadcrumbs?: number;
    beforeSend?: (event: SentryEvent) => SentryEvent | null;
    beforeBreadcrumb?: (breadcrumb: SentryBreadcrumb) => SentryBreadcrumb | null;
    integrations?: Integration[];
    tracesSampleRate?: number;
    enableUserInteractionTracing?: boolean;
    enableNativeCrashHandling?: boolean;
    enableNativeNagger?: boolean;
    autoInitializeNativeSdk?: boolean;
    enableWatchdogTerminationTracking?: boolean;
    enableCaptureFailedRequests?: boolean;
    sendClientReports?: boolean;
    maxCacheItems?: number;
    shutdownTimeout?: number;
    enableAppHangTracking?: boolean;
    appHangTimeoutInterval?: number;
    enableUserInteractionBreadcrumbs?: boolean;
    enableAutoBreadcrumbTracking?: boolean;
    enableAutoPerformanceTracking?: boolean;
    enableScreenTracking?: boolean;
    routingInstrumentation?: RoutingInstrumentation;
    attachScreenshot?: boolean;
    attachViewHierarchy?: boolean;
    profilesSampleRate?: number;
    _experiments?: {
      profilesSampleRate?: number;
      replaysSessionSampleRate?: number;
      replaysOnErrorSampleRate?: number;
    };
  }

  export interface SentryEvent {
    event_id?: string;
    message?: string;
    timestamp?: number;
    level?: SentryLevel;
    logger?: string;
    platform?: string;
    sdk?: {
      name?: string;
      version?: string;
    };
    server_name?: string;
    release?: string;
    dist?: string;
    environment?: string;
    modules?: Record<string, string>;
    extra?: Record<string, unknown>;
    tags?: Record<string, string>;
    user?: SentryUser;
    contexts?: Record<string, unknown>;
    breadcrumbs?: SentryBreadcrumb[];
    fingerprint?: string[];
    exception?: {
      values?: SentryException[];
    };
    request?: SentryRequest;
    transaction?: string;
    spans?: SentrySpan[];
  }

  export interface SentryBreadcrumb {
    message?: string;
    category?: string;
    level?: SentryLevel;
    timestamp?: number;
    type?: string;
    data?: Record<string, unknown>;
  }

  export interface SentryUser {
    id?: string;
    username?: string;
    email?: string;
    ip_address?: string;
    subscription?: string;
    segment?: string;
  }

  export interface SentryException {
    type?: string;
    value?: string;
    module?: string;
    thread_id?: number;
    stacktrace?: SentryStacktrace;
    mechanism?: SentryMechanism;
  }

  export interface SentryStacktrace {
    frames?: SentryStackFrame[];
  }

  export interface SentryStackFrame {
    filename?: string;
    function?: string;
    module?: string;
    lineno?: number;
    colno?: number;
    abs_path?: string;
    context_line?: string;
    pre_context?: string[];
    post_context?: string[];
    in_app?: boolean;
    vars?: Record<string, unknown>;
    package?: string;
    platform?: string;
    image_addr?: string;
    instruction_addr?: string;
    symbol_addr?: string;
    symbol?: string;
  }

  export interface SentryMechanism {
    type?: string;
    description?: string;
    help_link?: string;
    handled?: boolean;
    synthetic?: boolean;
    data?: Record<string, unknown>;
    meta?: Record<string, unknown>;
  }

  export interface SentryRequest {
    url?: string;
    method?: string;
    data?: unknown;
    query_string?: string;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
    env?: Record<string, string>;
  }

  export interface SentrySpan {
    span_id?: string;
    trace_id?: string;
    parent_span_id?: string;
    op?: string;
    description?: string;
    status?: string;
    tags?: Record<string, string>;
    data?: Record<string, unknown>;
    timestamp?: number;
    start_timestamp?: number;
  }

  export type SentryLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

  export interface Integration {
    name: string;
    setupOnce?: () => void;
  }

  export interface RoutingInstrumentation {
    registerRoutingInstrumentation?: () => void;
  }

  export interface Transaction {
    setName(name: string): void;
    setTag(key: string, value: string): void;
    setData(key: string, value: unknown): void;
    setStatus(status: string): void;
    finish(): void;
    startChild(spanContext: SpanContext): Span;
  }

  export interface Span {
    setTag(key: string, value: string): void;
    setData(key: string, value: unknown): void;
    setStatus(status: string): void;
    finish(): void;
    startChild(spanContext: SpanContext): Span;
  }

  export interface SpanContext {
    op?: string;
    description?: string;
    tags?: Record<string, string>;
    data?: Record<string, unknown>;
  }

  export interface Hub {
    captureException(exception: unknown): string;
    captureMessage(message: string, level?: SentryLevel): string;
    captureEvent(event: SentryEvent): string;
    addBreadcrumb(breadcrumb: SentryBreadcrumb): void;
    setUser(user: SentryUser | null): void;
    setTag(key: string, value: string): void;
    setContext(key: string, context: Record<string, unknown> | null): void;
    setExtra(key: string, extra: unknown): void;
    setLevel(level: SentryLevel): void;
    startTransaction(context: TransactionContext): Transaction;
    configureScope(callback: (scope: Scope) => void): void;
  }

  export interface Scope {
    setUser(user: SentryUser | null): void;
    setTag(key: string, value: string): void;
    setTags(tags: Record<string, string>): void;
    setContext(key: string, context: Record<string, unknown> | null): void;
    setContexts(contexts: Record<string, Record<string, unknown>>): void;
    setExtra(key: string, extra: unknown): void;
    setExtras(extras: Record<string, unknown>): void;
    setLevel(level: SentryLevel): void;
    setFingerprint(fingerprint: string[]): void;
    addBreadcrumb(breadcrumb: SentryBreadcrumb): void;
    clear(): void;
  }

  export interface TransactionContext {
    name: string;
    op?: string;
    description?: string;
    tags?: Record<string, string>;
    data?: Record<string, unknown>;
  }

  export function init(options: SentryOptions): void;
  export function captureException(exception: unknown): string;
  export function captureMessage(message: string, level?: SentryLevel): string;
  export function captureEvent(event: SentryEvent): string;
  export function addBreadcrumb(breadcrumb: SentryBreadcrumb): void;
  export function setUser(user: SentryUser | null): void;
  export function setTag(key: string, value: string): void;
  export function setContext(key: string, context: Record<string, unknown> | null): void;
  export function setExtra(key: string, extra: unknown): void;
  export function setLevel(level: SentryLevel): void;
  export function startTransaction(context: TransactionContext): Transaction;
  export function getCurrentHub(): Hub;
  export function configureScope(callback: (scope: Scope) => void): void;
  export function withScope(callback: (scope: Scope) => void): void;
  export function close(timeout?: number): Promise<boolean>;
  export function flush(timeout?: number): Promise<boolean>;
  export function lastEventId(): string | undefined;
}

// Global Performance Monitoring Types
declare global {
  interface Window {
    __SENTRY_DEBUG__?: boolean;
    __SENTRY_RELEASE__?: string;
    __SENTRY_DSN__?: string;
  }

  // Global performance tracking interfaces
  interface PerformanceMetric {
    name: string;
    value: number;
    unit: 'ms' | 'bytes' | 'count' | 'percent';
    timestamp: number;
    context?: Record<string, unknown>;
    tags?: Record<string, string>;
  }

  interface ErrorContext {
    component?: string;
    action?: string;
    userId?: string;
    sessionId?: string;
    additionalData?: Record<string, unknown>;
  }

  interface BreadcrumbData {
    category: string;
    message: string;
    level: 'debug' | 'info' | 'warning' | 'error' | 'fatal';
    data?: Record<string, unknown>;
  }

  // MindMuscle.AI Specific Global Types
  interface WorkoutMetrics {
    workoutId: string;
    duration: number;
    exerciseCount: number;
    setsCompleted: number;
    totalVolume: number;
    calories?: number;
    averageRestTime?: number;
    performanceScore?: number;
  }

  interface ExerciseMetrics {
    exerciseId: string;
    name: string;
    duration: number;
    sets: number;
    reps: number;
    weight: number;
    volume: number;
    restTime: number;
    perceivedExertion?: number;
    formRating?: number;
  }

  interface UserAnalytics {
    userId: string;
    sessionId: string;
    deviceInfo: {
      platform: string;
      version: string;
      model?: string;
      screenSize?: string;
    };
    appInfo: {
      version: string;
      buildNumber: string;
      environment: string;
    };
    preferences: {
      units: 'metric' | 'imperial';
      theme: 'light' | 'dark' | 'auto';
      language: string;
    };
  }

  interface NavigationMetrics {
    route: string;
    previousRoute?: string;
    navigationTime: number;
    loadTime: number;
    interactionDelay?: number;
    screenSize: {
      width: number;
      height: number;
    };
  }

  // Global error handling
  interface AppError extends Error {
    code?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    context?: ErrorContext;
    recoverable: boolean;
    userImpact: 'none' | 'minor' | 'major' | 'blocking';
  }

  // Database monitoring types
  interface DatabaseMetrics {
    operation: 'read' | 'write' | 'update' | 'delete' | 'sync';
    table: string;
    duration: number;
    recordCount?: number;
    success: boolean;
    errorMessage?: string;
    cacheHit?: boolean;
  }

  // API monitoring types
  interface APIMetrics {
    endpoint: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    statusCode: number;
    duration: number;
    requestSize?: number;
    responseSize?: number;
    cached?: boolean;
    retryCount?: number;
  }

  // Memory and performance monitoring
  interface MemoryMetrics {
    used: number;
    total: number;
    percentage: number;
    gcCount?: number;
    gcDuration?: number;
  }

  interface CPUMetrics {
    usage: number;
    idle: number;
    system: number;
    user: number;
  }

  // Image loading and caching metrics
  interface ImageMetrics {
    url: string;
    loadTime: number;
    size: number;
    cached: boolean;
    compressionRatio?: number;
    format: string;
    dimensions: {
      width: number;
      height: number;
    };
  }

  // Workout session monitoring
  interface SessionMetrics {
    sessionId: string;
    type: 'workout' | 'preview' | 'custom' | 'ai_generated';
    startTime: number;
    endTime?: number;
    duration?: number;
    completed: boolean;
    exitReason?: 'completed' | 'cancelled' | 'error' | 'timeout';
    exercisesCompleted: number;
    totalExercises: number;
    completionRate: number;
  }
}

// Default export to satisfy Expo Router
export default function GlobalTypes() {
  return null;
}
