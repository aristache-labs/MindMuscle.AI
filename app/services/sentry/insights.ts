import * as Sentry from '@sentry/react-native';

/**
 * Sentry Insights Utilities
 */
export const SentryInsights = {
  trackUserBehavior: (action: string, data?: Record<string, unknown>) => {
    Sentry.addBreadcrumb({ message: `User behavior: ${action}`, category: 'user.behavior', data });
  },

  trackPerformanceMetric: (metric: string, value: number, unit?: string) => {
    Sentry.addBreadcrumb({
      message: `Performance: ${metric}`,
      category: 'performance',
      data: { metric, value, unit },
    });
  },

  trackFeatureUsage: (feature: string, data?: Record<string, unknown>) => {
    Sentry.addBreadcrumb({ message: `Feature used: ${feature}`, category: 'feature.usage', data });
  },

  startTransaction: (name: string, operation: string = 'custom') => {
    return Sentry.startSpan(
      {
        name,
        op: operation,
        attributes: {
          platform: 'mobile',
          transaction_type: 'custom',
        },
      },
      (span) => {
        return {
          span,
          finish: () => {
            // Span automatically finishes when the callback returns
          },
          setData: (key: string, value: string | number | boolean) => {
            span.setAttributes({ [key]: value });
          },
          setTag: (key: string, value: string) => {
            span.setAttributes({ [key]: value });
          },
          setStatus: (status: string) => {
            span.setStatus({ code: status === 'ok' ? 1 : 2, message: status });
          },
        };
      },
    );
  },

  finishTransaction: (transaction: any, status: string, data?: Record<string, unknown>) => {
    if (transaction && transaction.setStatus) {
      transaction.setStatus(status);
    }
    if (transaction && transaction.setData && data) {
      Object.entries(data).forEach(([key, value]) => {
        transaction.setData(key, value);
      });
    }
    if (transaction && transaction.finish) {
      transaction.finish();
    }
  },
};
