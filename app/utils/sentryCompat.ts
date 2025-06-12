import * as Sentry from '@sentry/react-native';

/**
 * Sentry Compatibility Layer
 *
 * This utility provides a compatibility layer for the deprecated startTransaction API.
 * In newer versions of Sentry, startTransaction has been replaced with startSpan.
 */

export interface TransactionLike {
  setStatus(status: string): void;
  setData(key: string, value: string | number | boolean): void;
  setTag(key: string, value: string): void;
  finish(): void;
}

interface StartTransactionOptions {
  name: string;
  op?: string;
  tags?: Record<string, string>;
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Create a transaction-like object using the newer startSpan API
 */
export function createCompatibleTransaction(options: StartTransactionOptions): TransactionLike {
  let isFinished = false;

  return Sentry.startSpan(
    {
      name: options.name,
      op: options.op || 'custom',
      attributes: {
        ...options.tags,
        ...options.attributes,
      },
    },
    (span) => {
      return {
        setStatus: (status: string) => {
          if (!isFinished) {
            span.setStatus({ code: status === 'ok' ? 1 : 2, message: status });
          }
        },
        setData: (key: string, value: string | number | boolean) => {
          if (!isFinished) {
            span.setAttributes({ [key]: value });
          }
        },
        setTag: (key: string, value: string) => {
          if (!isFinished) {
            span.setAttributes({ [key]: value });
          }
        },
        finish: () => {
          isFinished = true;
          // Span automatically finishes when the callback returns
        },
      };
    },
  );
}

/**
 * Compatibility function that mimics the old startTransaction API
 */
export function startTransaction(options: StartTransactionOptions): TransactionLike {
  try {
    return createCompatibleTransaction(options);
  } catch (error) {
    // Fallback to a no-op object if Sentry fails
    console.warn('Failed to create Sentry transaction, using no-op fallback:', error);
    return {
      setStatus: () => {},
      setData: () => {},
      setTag: () => {},
      finish: () => {},
    };
  }
}

// Export for compatibility
export const SentryCompat = {
  startTransaction,
  createCompatibleTransaction,
};

export default SentryCompat;
