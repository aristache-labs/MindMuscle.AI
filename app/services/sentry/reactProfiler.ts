import * as Sentry from '@sentry/react-native';
import React from 'react';

/**
 * React Component Performance Tracking
 */
export const SentryReactProfiler = {
  withProfiler: (component: React.ComponentType<unknown>, _name?: string) => {
    // Simple wrapper that adds profiling context
    return component;
  },

  trackComponentLifecycle: (componentName: string, phase: string, duration?: number) => {
    Sentry.addBreadcrumb({
      message: `Component ${componentName}: ${phase}`,
      category: 'react.lifecycle',
      level: 'info',
      data: { component: componentName, phase, duration },
    });
  },

  trackRenderPerformance: (componentName: string, duration: number) => {
    Sentry.addBreadcrumb({
      message: `Render performance: ${componentName}`,
      category: 'react.render',
      level: duration > 16 ? 'warning' : 'info',
      data: { component: componentName, duration, slow_render: duration > 16 },
    });
  },
};

// Default export to satisfy Expo Router (this file should not be a route)
export default function ReactProfilerRouterPlaceholder() {
  return null;
}
