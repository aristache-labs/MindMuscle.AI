import * as Sentry from '@sentry/react-native';
import { safeAsync, safeAsyncFireAndForget } from './asyncErrorHandler';
import { startTransaction } from './sentryCompat';

/**
 * Test utilities to verify async error handling is working properly
 */

export const testAsyncErrorHandling = {
  // Test basic error handling
  testBasicErrorHandling: async () => {
    const transaction = startTransaction({
      name: 'testBasicErrorHandling',
      op: 'async_error_testing',
    });

    try {
      console.log('🧪 Testing basic async error handling...');

      Sentry.addBreadcrumb({
        message: 'Starting basic async error handling test',
        category: 'async_testing',
        level: 'info',
      });

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

      const testPassed = result === 'fallback_value';
      console.log('✅ Basic error handling test completed. Result:', result);

      Sentry.addBreadcrumb({
        message: 'Basic error handling test completed',
        category: 'async_testing',
        data: {
          result,
          test_passed: testPassed,
        },
        level: testPassed ? 'info' : 'error',
      });

      Sentry.setTag('async_testing.basic_error_handling', testPassed);
      return testPassed;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'testAsyncErrorHandler',
          function: 'testBasicErrorHandling',
        },
      });
      return false;
    } finally {
      transaction.finish();
    }
  },

  // Test fire and forget operations
  testFireAndForget: () => {
    try {
      console.log('🧪 Testing fire and forget error handling...');

      Sentry.addBreadcrumb({
        message: 'Starting fire and forget test',
        category: 'async_testing',
        level: 'info',
      });

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

      Sentry.addBreadcrumb({
        message: 'Fire and forget test initiated successfully',
        category: 'async_testing',
        level: 'info',
      });

      Sentry.setTag('async_testing.fire_and_forget', true);
      return true;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'testAsyncErrorHandler',
          function: 'testFireAndForget',
        },
      });
      return false;
    }
  },

  // Test promise rejection handling
  testPromiseRejection: async () => {
    const transaction = startTransaction({
      name: 'testPromiseRejection',
      op: 'async_error_testing',
    });

    try {
      console.log('🧪 Testing promise rejection handling...');

      Sentry.addBreadcrumb({
        message: 'Starting promise rejection test',
        category: 'async_testing',
        level: 'info',
      });

      const result = await safeAsync(() => Promise.reject(new Error('Test promise rejection')), {
        errorPrefix: 'Test promise rejection',
        context: { test: 'promise_rejection' },
        fallback: 'rejection_handled',
      });

      const testPassed = result === 'rejection_handled';
      console.log('✅ Promise rejection test completed. Result:', result);

      Sentry.addBreadcrumb({
        message: 'Promise rejection test completed',
        category: 'async_testing',
        data: {
          result,
          test_passed: testPassed,
        },
        level: testPassed ? 'info' : 'error',
      });

      Sentry.setTag('async_testing.promise_rejection', testPassed);
      return testPassed;
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          component: 'testAsyncErrorHandler',
          function: 'testPromiseRejection',
        },
      });
      return false;
    } finally {
      transaction.finish();
    }
  },

  // Run all tests
  runAllTests: async () => {
    const transaction = startTransaction({
      name: 'runAllAsyncErrorTests',
      op: 'async_error_testing',
    });

    try {
      console.log('🚀 Running all async error handling tests...');

      Sentry.addBreadcrumb({
        message: 'Starting complete async error handling test suite',
        category: 'async_testing',
        level: 'info',
      });

      const results = await Promise.all([
        testAsyncErrorHandling.testBasicErrorHandling(),
        testAsyncErrorHandling.testPromiseRejection(),
      ]);

      // Fire and forget test doesn't return a promise we can wait for
      const fireAndForgetResult = testAsyncErrorHandling.testFireAndForget();

      const allPassed = results.every(Boolean) && fireAndForgetResult;
      console.log(allPassed ? '✅ All tests passed!' : '❌ Some tests failed');

      const testResults = {
        basicErrorHandling: results[0],
        promiseRejection: results[1],
        fireAndForget: fireAndForgetResult,
        allPassed,
      };

      Sentry.addBreadcrumb({
        message: 'Async error handling test suite completed',
        category: 'async_testing',
        data: testResults,
        level: allPassed ? 'info' : 'error',
      });

      // Set comprehensive tags for monitoring
      Sentry.setTag('async_testing.suite_completed', true);
      Sentry.setTag('async_testing.all_tests_passed', allPassed);

      return testResults;
    } catch (error) {
      console.error('❌ Test suite failed:', error);

      Sentry.captureException(error, {
        tags: {
          component: 'testAsyncErrorHandler',
          function: 'runAllTests',
        },
        contexts: {
          async_testing: {
            test_phase: 'test_suite_execution',
          },
        },
      });

      const failedResults = {
        basicErrorHandling: false,
        promiseRejection: false,
        fireAndForget: false,
        allPassed: false,
      };

      Sentry.setTag('async_testing.suite_failed', true);
      return failedResults;
    } finally {
      transaction.finish();
    }
  },
};

export default testAsyncErrorHandling;
