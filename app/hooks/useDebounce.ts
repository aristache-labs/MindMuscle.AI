import { useState, useEffect, useRef, useCallback } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Add default export to fix the warning
export default useDebounce;

// Navigation-specific debounce hook
export function useNavigationDebounce(delay: number = 500) {
  const lastNavigationRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (navigationFn: () => void) => {
      const now = Date.now();

      // Clear any pending navigation
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Check if enough time has passed since last navigation
      if (now - lastNavigationRef.current > delay) {
        lastNavigationRef.current = now;

        // Add a small delay to ensure current operations complete
        timeoutRef.current = setTimeout(() => {
          navigationFn();
        }, 50);
      }
    },
    [delay],
  );
}
