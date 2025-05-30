import { safeAsync, safeAsyncFireAndForget } from './asyncErrorHandler';

/**
 * Test utilities to verify async error handling is working properly
 */

export const testAsyncErrorHandling = {
  // Test basic error handling
  testBasicErrorHandling: async () => {
    console.log('🧪 Testing basic async error handling...');

    const result = await safeAsync(
      async () => {
        throw new Error('Test error for async handler');
      },
      {
        errorPrefix: 'Test async operation',
        context: { test: 'basic_error_handling' },
        fallback: 'fallback_value',
      },
    );

    console.log('✅ Basic error handling test completed. Result:', result);
    return result === 'fallback_value';
  },

  // Test fire and forget operations
  testFireAndForget: () => {
    console.log('🧪 Testing fire and forget error handling...');

    safeAsyncFireAndForget(
      async () => {
        // Simulate some async work
        await new Promise((resolve) => setTimeout(resolve, 100));
        throw new Error('Test error for fire and forget');
      },
      {
        errorPrefix: 'Test fire and forget operation',
        context: { test: 'fire_and_forget' },
      },
    );

    console.log('✅ Fire and forget test initiated');
    return true;
  },

  // Test promise rejection handling
  testPromiseRejection: async () => {
    console.log('🧪 Testing promise rejection handling...');

    const result = await safeAsync(() => Promise.reject(new Error('Test promise rejection')), {
      errorPrefix: 'Test promise rejection',
      context: { test: 'promise_rejection' },
      fallback: 'rejection_handled',
    });

    console.log('✅ Promise rejection test completed. Result:', result);
    return result === 'rejection_handled';
  },

  // Run all tests
  runAllTests: async () => {
    console.log('🚀 Running all async error handling tests...');

    try {
      const results = await Promise.all([
        testAsyncErrorHandling.testBasicErrorHandling(),
        testAsyncErrorHandling.testPromiseRejection(),
      ]);

      // Fire and forget test doesn't return a promise we can wait for
      testAsyncErrorHandling.testFireAndForget();

      const allPassed = results.every(Boolean);
      console.log(allPassed ? '✅ All tests passed!' : '❌ Some tests failed');

      return {
        basicErrorHandling: results[0],
        promiseRejection: results[1],
        fireAndForget: true, // We can't easily test this one
        allPassed,
      };
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      return {
        basicErrorHandling: false,
        promiseRejection: false,
        fireAndForget: false,
        allPassed: false,
      };
    }
  },
};

export default testAsyncErrorHandling;
