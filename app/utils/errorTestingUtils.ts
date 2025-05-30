/**
 * Error Testing Utilities for Reactotron Global Error Tracking
 *
 * These utilities help test and demonstrate the global error tracking
 * functionality in development mode. Use these functions to verify
 * that errors are properly captured and displayed in Reactotron.
 *
 * ⚠️ WARNING: These functions intentionally throw errors and should
 * only be used in development mode for testing purposes.
 */

/**
 * Test basic JavaScript runtime errors
 */
export const testRuntimeError = () => {
  if (__DEV__) {
    console.log('🧪 Testing runtime error...');
    // @ts-expect-error - Intentionally accessing undefined property
    const result = undefined.someProperty;
    return result;
  }
};

/**
 * Test type errors
 */
export const testTypeError = () => {
  if (__DEV__) {
    console.log('🧪 Testing type error...');
    // @ts-expect-error - Intentionally calling non-function
    const result = 'string'.call();
    return result;
  }
};

/**
 * Test async errors with Promise rejection
 */
export const testAsyncError = async () => {
  if (__DEV__) {
    console.log('🧪 Testing async error...');
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Test async error from Promise rejection'));
      }, 100);
    });
  }
};

/**
 * Test async/await errors
 */
export const testAsyncAwaitError = async () => {
  if (__DEV__) {
    console.log('🧪 Testing async/await error...');
    throw new Error('Test async/await error');
  }
};

/**
 * Test network-like errors
 */
export const testNetworkError = async () => {
  if (__DEV__) {
    console.log('🧪 Testing network error...');
    const response = await fetch('https://invalid-url-that-does-not-exist.com/api/test');
    return response.json();
  }
};

/**
 * Test JSON parsing errors
 */
export const testJSONError = () => {
  if (__DEV__) {
    console.log('🧪 Testing JSON parsing error...');
    const invalidJSON = '{ invalid json }';
    return JSON.parse(invalidJSON);
  }
};

/**
 * Test custom error with stack trace
 */
export const testCustomError = () => {
  if (__DEV__) {
    console.log('🧪 Testing custom error...');
    const error = new Error('Custom test error with detailed message');
    error.name = 'TestError';
    throw error;
  }
};

/**
 * Test error in nested function calls
 */
export const testNestedError = () => {
  if (__DEV__) {
    console.log('🧪 Testing nested error...');

    const level3 = () => {
      throw new Error('Error from nested function level 3');
    };

    const level2 = () => {
      level3();
    };

    const level1 = () => {
      level2();
    };

    level1();
  }
};

interface ErrorWithContext extends Error {
  context?: {
    userInput: string;
    timestamp: string;
    component: string;
    action: string;
  };
}

/**
 * Test error with additional context
 */
export const testErrorWithContext = (userInput: string) => {
  if (__DEV__) {
    console.log('🧪 Testing error with context...');

    if (!userInput) {
      const error: ErrorWithContext = new Error('Invalid user input provided');
      // Add additional context to the error
      error.context = {
        userInput,
        timestamp: new Date().toISOString(),
        component: 'ErrorTestingUtils',
        action: 'testErrorWithContext',
      };
      throw error;
    }
  }
};

/**
 * Test multiple errors in sequence
 */
export const testMultipleErrors = async () => {
  if (__DEV__) {
    console.log('🧪 Testing multiple errors...');

    // Error 1: Immediate error
    try {
      testRuntimeError();
    } catch (error) {
      console.log('Caught error 1:', error);
    }

    // Error 2: Delayed error
    setTimeout(() => {
      try {
        testTypeError();
      } catch (error) {
        console.log('Caught error 2:', error);
      }
    }, 500);

    // Error 3: Async error
    try {
      await testAsyncError();
    } catch (error) {
      console.log('Caught error 3:', error);
    }
  }
};

interface ComponentError extends Error {
  componentStack?: string;
}

/**
 * Test error boundary simulation
 */
export const testComponentError = () => {
  if (__DEV__) {
    console.log('🧪 Testing component error...');

    // Simulate a React component error
    const error: ComponentError = new Error('Component rendering error');
    error.name = 'ComponentError';
    error.componentStack = `
    in TestComponent (at ErrorTestingUtils.ts:123)
    in ErrorBoundary (at App.tsx:45)
    in App (at index.tsx:12)`;

    throw error;
  }
};

/**
 * Comprehensive error test suite
 */
export const runErrorTestSuite = async () => {
  if (__DEV__) {
    console.log('🧪 Running comprehensive error test suite...');
    console.log('Check Reactotron for error displays!');

    const tests = [
      { name: 'Runtime Error', fn: testRuntimeError },
      { name: 'Type Error', fn: testTypeError },
      { name: 'JSON Error', fn: testJSONError },
      { name: 'Custom Error', fn: testCustomError },
      { name: 'Nested Error', fn: testNestedError },
      { name: 'Component Error', fn: testComponentError },
    ];

    for (const test of tests) {
      try {
        console.log(`Running ${test.name}...`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay between tests
        test.fn();
      } catch (error) {
        console.log(`✅ ${test.name} successfully triggered error:`, (error as Error).message);
      }
    }

    // Test async errors separately
    try {
      console.log('Running Async Error...');
      await testAsyncError();
    } catch (error) {
      console.log('✅ Async Error successfully triggered:', (error as Error).message);
    }

    try {
      console.log('Running Async/Await Error...');
      await testAsyncAwaitError();
    } catch (error) {
      console.log('✅ Async/Await Error successfully triggered:', (error as Error).message);
    }

    console.log('🎉 Error test suite completed! Check Reactotron for all captured errors.');
  }
};

/**
 * Error testing interface for easy access in development
 */
export const ErrorTester = {
  runtime: testRuntimeError,
  type: testTypeError,
  async: testAsyncError,
  asyncAwait: testAsyncAwaitError,
  network: testNetworkError,
  json: testJSONError,
  custom: testCustomError,
  nested: testNestedError,
  withContext: testErrorWithContext,
  multiple: testMultipleErrors,
  component: testComponentError,
  runAll: runErrorTestSuite,
};

// Make ErrorTester available globally in development
if (__DEV__) {
  try {
    // Check if global object is available and not already set
    if (typeof global !== 'undefined' && !(global as Record<string, unknown>).ErrorTester) {
      (global as Record<string, unknown>).ErrorTester = ErrorTester;
      console.log(
        '🧪 ErrorTester available globally. Use ErrorTester.runAll() to test all error types.',
      );
    }
  } catch {
    // Silently fail if there's an issue setting up global error testing
    console.log('ErrorTester setup completed (fallback mode)');
  }
}

// Example of a more robust error logging function
export const logErrorToService = (error: Error, errorInfo?: Record<string, unknown>) => {
  console.error('Logging to service:', error, errorInfo);
  // In a real app, this would send data to Sentry, Firebase, etc.
};
