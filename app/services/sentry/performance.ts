/**
 * Performance Monitoring (Stub)
 */
export const SentryPerformance = {
  measureIOSOperation: async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
    return await operation();
  },
};
