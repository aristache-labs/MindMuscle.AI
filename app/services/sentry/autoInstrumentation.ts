import * as Sentry from '@sentry/react-native';

/**
 * Automatic Instrumentation Utilities
 */
export const SentryAutoInstrumentation = {
  trackAppStart: () => {
    Sentry.addBreadcrumb({
      message: 'App start tracked',
      category: 'app.start',
      level: 'info',
    });
  },

  trackFrameMetrics: (slowFrames: number, frozenFrames: number, totalFrames: number) => {
    Sentry.addBreadcrumb({
      message: 'Frame metrics tracked',
      category: 'performance.frames',
      level: 'info',
      data: { slow_frames: slowFrames, frozen_frames: frozenFrames, total_frames: totalFrames },
    });
  },

  trackUserInteraction: (
    action: string,
    element: string,
    screen: string,
    additionalData?: Record<string, unknown>,
  ) => {
    Sentry.addBreadcrumb({
      message: `User interaction: ${action} on ${element}`,
      category: 'user.interaction',
      level: 'info',
      data: {
        action,
        element,
        screen,
        timestamp: new Date().toISOString(),
        ...additionalData,
      },
    });
  },

  enhanceNetworkSpan: (
    method: string,
    url: string,
    status?: number,
    duration?: number,
    error?: string,
  ) => {
    Sentry.addBreadcrumb({
      message: `${method.toUpperCase()} ${url}${status ? ` - ${status}` : ''}`,
      category: 'http',
      level: error ? 'error' : status && status >= 400 ? 'warning' : 'info',
      data: {
        method: method.toUpperCase(),
        url,
        status_code: status,
        duration_ms: duration,
        error_message: error,
        timestamp: new Date().toISOString(),
      },
    });
  },

  trackJSStall: (duration: number, threshold: number, actualDuration: number) => {
    Sentry.addBreadcrumb({
      message: `JS Stall detected: ${duration}ms`,
      category: 'performance.js_stall',
      level: duration > threshold ? 'warning' : 'info',
      data: {
        duration_ms: duration,
        threshold_ms: threshold,
        actual_duration_ms: actualDuration,
        timestamp: new Date().toISOString(),
      },
    });

    if (duration > threshold) {
      Sentry.captureMessage(
        `JS Stall detected: ${duration}ms (threshold: ${threshold}ms)`,
        'warning',
      );
    }
  },
};
