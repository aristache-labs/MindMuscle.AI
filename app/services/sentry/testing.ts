import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

/**
 * Manual Sentry Testing Utilities
 * Use these functions to manually test Sentry integration
 */
export const SentryTesting = {
  // Test basic message capture
  testMessage: () => {
    console.log('🧪 Testing Sentry message capture...');
    Sentry.captureMessage('Manual test message from MindMuscle.AI', 'info');
    console.log('✅ Test message sent to Sentry');
  },

  // Test error capture
  testError: () => {
    console.log('🧪 Testing Sentry error capture...');
    const testError = new Error('Manual test error from MindMuscle.AI');
    testError.stack = 'Test stack trace for debugging';
    Sentry.captureException(testError);
    console.log('✅ Test error sent to Sentry');
  },

  // Test navigation error capture
  testNavigationError: () => {
    console.log('🧪 Testing Sentry navigation error capture...');
    const navigationError = new Error(
      'The action \'REPLACE\' with payload {"name":"(auth)","params":{"screen":"login","params":{}}} was not handled by any navigator.\n\nDo you have a route named \'(auth)\'?',
    );

    Sentry.withScope((scope) => {
      scope.setTag('error_type', 'navigation_error');
      scope.setTag('navigation_error_type', 'route_not_found');
      scope.setLevel('warning');
      scope.setContext('navigation_error_context', {
        attempted_route: '(auth)',
        action: 'REPLACE',
        error_source: 'manual_test',
        timestamp: new Date().toISOString(),
      });

      Sentry.captureException(navigationError);
    });

    console.log('✅ Test navigation error sent to Sentry');
  },

  // Test logout tracking
  testLogoutTracking: () => {
    console.log('🧪 Testing logout tracking...');

    Sentry.addBreadcrumb({
      message: 'User action: logout',
      category: 'user-action',
      level: 'info',
      data: {
        action: 'logout',
        test_mode: true,
        timestamp: new Date().toISOString(),
      },
    });

    Sentry.setUser(null); // Clear user context

    console.log('✅ Test logout tracking sent to Sentry');
  },

  // Test breadcrumb
  testBreadcrumb: () => {
    console.log('🧪 Testing Sentry breadcrumb...');
    Sentry.addBreadcrumb({
      message: 'Manual test breadcrumb',
      category: 'debug.manual_test',
      level: 'info',
      data: {
        test_type: 'manual_breadcrumb',
        timestamp: new Date().toISOString(),
        platform: Constants.platform?.ios ? 'ios' : 'android',
      },
    });
    console.log('✅ Test breadcrumb added');
  },

  // Test Session Replay
  testSessionReplay: () => {
    console.log('🧪 Testing Session Replay...');
    if (Constants.appOwnership === 'expo') {
      console.log('⚠️ Session Replay is disabled in Expo Go');
      return;
    }

    Sentry.addBreadcrumb({
      message: 'Manual Session Replay test',
      category: 'replay.manual_test',
      level: 'info',
      data: {
        test_timestamp: new Date().toISOString(),
        platform: Constants.platform?.ios ? 'ios' : 'android',
      },
    });

    console.log('✅ Session Replay test data sent');
  },

  // Test workout context
  testWorkoutContext: () => {
    console.log('🧪 Testing workout context...');
    Sentry.setContext('workout_session', {
      workout_id: 'test_workout_123',
      plan_id: 'test_plan_456',
      exercise_count: 5,
      estimated_duration_minutes: 30,
      session_start: new Date().toISOString(),
      platform: Constants.platform?.ios ? 'ios' : 'android',
    });

    Sentry.addBreadcrumb({
      message: 'Workout event: start - test_workout_123',
      category: 'workout',
      level: 'info',
      data: {
        workout_id: 'test_workout_123',
        exercise_id: 'test_exercise_789',
        test_mode: true,
        timestamp: new Date().toISOString(),
      },
    });

    console.log('✅ Workout context test sent');
  },

  // Test all Sentry features
  testAll: async () => {
    console.log('🧪 Running comprehensive Sentry test...');
    SentryTesting.testMessage();
    SentryTesting.testBreadcrumb();
    SentryTesting.testNavigationError();
    SentryTesting.testLogoutTracking();
    SentryTesting.testSessionReplay();
    SentryTesting.testWorkoutContext();
    SentryTesting.testError(); // Test error last
    console.log('✅ All Sentry tests completed - check your Sentry dashboard');
  },

  // Test performance tracking
  testPerformance: () => {
    console.log('🧪 Testing performance tracking...');

    const startTime = Date.now();

    // Simulate some work
    setTimeout(() => {
      const duration = Date.now() - startTime;

      Sentry.addBreadcrumb({
        message: `Performance test completed in ${duration}ms`,
        category: 'performance.test',
        level: 'info',
        data: {
          operation: 'test_performance',
          duration_ms: duration,
          timestamp: new Date().toISOString(),
        },
      });

      console.log('✅ Performance test data sent to Sentry');
    }, 100);
  },

  // Check Sentry configuration
  checkConfig: () => {
    console.log('🔧 Sentry Configuration Check:');
    console.log('DSN:', Constants.expoConfig?.extra?.sentryDsn ? '✅ Configured' : '❌ Missing');
    console.log('Environment:', Constants.expoConfig?.extra?.environment || 'development');
    console.log('Platform:', Constants.platform?.ios ? 'iOS' : 'Android');
    console.log(
      'Expo Go:',
      Constants.appOwnership === 'expo' ? '⚠️ Yes (limited features)' : '✅ No',
    );
    console.log('Development Mode:', __DEV__ ? '✅ Yes' : '❌ No');
    console.log(
      'Session Replay:',
      Constants.appOwnership !== 'expo' ? '✅ Enabled' : '❌ Disabled',
    );
  },
};

// Default export to satisfy Expo Router (this file should not be a route)
export default function TestingRouterPlaceholder() {
  return null;
}
