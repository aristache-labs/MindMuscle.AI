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

// Type definitions for Sentry APIs
interface SentryTransaction {
  setStatus(status: string): void;
  setData(key: string, value: string | number | boolean): void;
  setTag(key: string, value: string): void;
  finish(): void;
}

interface SentrySpan {
  setStatus(status: { code: number; message: string }): void;
  setAttributes(attributes: Record<string, string | number | boolean>): void;
}

interface SentryWithStartTransaction {
  startTransaction(options: {
    name: string;
    op?: string;
    tags?: Record<string, string>;
    data?: Record<string, string | number | boolean>;
  }): SentryTransaction;
}

interface SentryWithStartSpan {
  startSpan<T>(
    options: {
      name: string;
      op?: string;
      attributes?: Record<string, string | number | boolean>;
    },
    callback: (span: SentrySpan) => T,
  ): T;
}

interface StartTransactionOptions {
  name: string;
  op?: string;
  tags?: Record<string, string>;
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Create a transaction-like object using the available API
 */
export function createCompatibleTransaction(options: StartTransactionOptions): TransactionLike {
  let isFinished = false;

  // Try to use the appropriate API based on what's available
  try {
    // First, try the old startTransaction API for v6.x compatibility
    const sentryWithTransaction = Sentry as unknown as SentryWithStartTransaction;
    if (typeof sentryWithTransaction.startTransaction === 'function') {
      const transaction = sentryWithTransaction.startTransaction({
        name: options.name,
        op: options.op || 'custom',
        tags: options.tags,
        data: options.attributes,
      });

      return {
        setStatus: (status: string) => {
          if (!isFinished && transaction && typeof transaction.setStatus === 'function') {
            transaction.setStatus(status);
          }
        },
        setData: (key: string, value: string | number | boolean) => {
          if (!isFinished && transaction && typeof transaction.setData === 'function') {
            transaction.setData(key, value);
          }
        },
        setTag: (key: string, value: string) => {
          if (!isFinished && transaction && typeof transaction.setTag === 'function') {
            transaction.setTag(key, value);
          }
        },
        finish: () => {
          if (!isFinished && transaction && typeof transaction.finish === 'function') {
            transaction.finish();
          }
          isFinished = true;
        },
      };
    }

    // Fallback to startSpan for v7.x+
    const sentryWithSpan = Sentry as unknown as SentryWithStartSpan;
    if (typeof sentryWithSpan.startSpan === 'function') {
      return sentryWithSpan.startSpan(
        {
          name: options.name,
          op: options.op || 'custom',
          attributes: {
            ...options.tags,
            ...options.attributes,
          },
        },
        (span: SentrySpan) => {
          return {
            setStatus: (status: string) => {
              if (!isFinished && span && typeof span.setStatus === 'function') {
                span.setStatus({ code: status === 'ok' ? 1 : 2, message: status });
              }
            },
            setData: (key: string, value: string | number | boolean) => {
              if (!isFinished && span && typeof span.setAttributes === 'function') {
                span.setAttributes({ [key]: value });
              }
            },
            setTag: (key: string, value: string) => {
              if (!isFinished && span && typeof span.setAttributes === 'function') {
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

    // If neither API is available, throw to trigger fallback
    throw new Error('No compatible Sentry transaction API available');
  } catch (error) {
    console.warn('Sentry transaction creation failed, using no-op fallback:', error);
    // Return a no-op transaction for graceful degradation
    return {
      setStatus: () => {},
      setData: () => {},
      setTag: () => {},
      finish: () => {},
    };
  }
}

/**
 * Compatibility function that mimics the old startTransaction API
 */
export function startTransaction(options: StartTransactionOptions): TransactionLike {
  try {
    // Check if Sentry is properly initialized
    if (!Sentry || typeof Sentry !== 'object') {
      throw new Error('Sentry is not available or not initialized');
    }

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
