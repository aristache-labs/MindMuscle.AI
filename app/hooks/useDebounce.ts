import { useState, useEffect, useRef, useCallback } from 'react';
import { useSentryDataCollection } from './useSentryDataCollection';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  const sentry = useSentryDataCollection({
    componentName: 'useDebounce',
    autoSetUser: false,
  });

  useEffect(() => {
    const startTime = Date.now();

    sentry.addBreadcrumb({
      message: 'Debounce timer started',
      category: 'debounce',
      level: 'debug',
      data: { delay, valueType: typeof value },
    });

    const timer = setTimeout(() => {
      const actualDelay = Date.now() - startTime;

      sentry.trackPerformance('debounce_delay', actualDelay, 'ms');

      sentry.addBreadcrumb({
        message: 'Debounce value updated',
        category: 'debounce',
        level: 'debug',
        data: {
          expectedDelay: delay,
          actualDelay,
          valueType: typeof value,
        },
      });

      setDebouncedValue(value);
    }, delay);

    return () => {
      const cancelledAfter = Date.now() - startTime;

      if (cancelledAfter < delay) {
        sentry.addBreadcrumb({
          message: 'Debounce timer cancelled',
          category: 'debounce',
          level: 'debug',
          data: {
            delay,
            cancelledAfter,
            valueType: typeof value,
          },
        });
      }

      clearTimeout(timer);
    };
  }, [value, delay, sentry]);

  return debouncedValue;
}

// Add default export to fix the warning
export default useDebounce;

// Navigation-specific debounce hook
export function useNavigationDebounce(delay: number = 500) {
  const lastNavigationRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sentry = useSentryDataCollection({
    componentName: 'useNavigationDebounce',
    autoSetUser: false,
  });

  // Track navigation debounce metrics
  useEffect(() => {
    sentry.setContext('navigation_debounce', {
      delay,
      initialized: true,
      timestamp: new Date().toISOString(),
    });

    sentry.addBreadcrumb({
      message: 'Navigation debounce initialized',
      category: 'navigation',
      level: 'info',
      data: { delay },
    });
  }, [delay, sentry]);

  return useCallback(
    (navigationFn: () => void) => {
      const now = Date.now();
      const timeSinceLastNavigation = now - lastNavigationRef.current;

      try {
        sentry.addBreadcrumb({
          message: 'Navigation attempt',
          category: 'navigation',
          level: 'info',
          data: {
            timeSinceLastNavigation,
            delay,
            hasTimeout: !!timeoutRef.current,
          },
        });

        // Clear any pending navigation
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);

          sentry.addBreadcrumb({
            message: 'Previous navigation cancelled',
            category: 'navigation',
            level: 'debug',
          });
        }

        // Check if enough time has passed since last navigation
        if (timeSinceLastNavigation > delay) {
          lastNavigationRef.current = now;

          sentry.trackPerformance('navigation_debounce_immediate', 0, 'ms');

          sentry.addBreadcrumb({
            message: 'Navigation executed immediately',
            category: 'navigation',
            level: 'info',
            data: { timeSinceLastNavigation },
          });

          // Add a small delay to ensure current operations complete
          timeoutRef.current = setTimeout(() => {
            try {
              navigationFn();

              sentry.addBreadcrumb({
                message: 'Navigation completed successfully',
                category: 'navigation',
                level: 'info',
              });
            } catch (error) {
              sentry.captureException(error as Error, {
                navigation_context: 'debounced_navigation',
                delay,
                timeSinceLastNavigation,
              });
            }
          }, 50);
        } else {
          const remainingDelay = delay - timeSinceLastNavigation;

          sentry.trackPerformance('navigation_debounce_blocked', remainingDelay, 'ms');

          sentry.addBreadcrumb({
            message: 'Navigation blocked by debounce',
            category: 'navigation',
            level: 'debug',
            data: {
              timeSinceLastNavigation,
              remainingDelay,
            },
          });
        }
      } catch (error) {
        sentry.captureException(error as Error, {
          navigation_debounce_error: true,
          delay,
          timeSinceLastNavigation,
        });
      }
    },
    [delay, sentry],
  );
}
