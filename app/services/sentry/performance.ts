/**
 * Performance Monitoring (Stub)
 */
export const SentryPerformance = {
  measureIOSOperation: async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
    return await operation();
  },
};

// Default export to satisfy Expo Router (this file should not be a route)
export default function PerformanceRouterPlaceholder() {
  return null;
}
