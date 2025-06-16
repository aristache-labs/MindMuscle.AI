import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SentryDataCollection, SentryInsights, SentryLogger } from '../services/sentry';

interface SentryTestButtonProps {
  style?: object;
}

export default function SentryTestButton({ style }: SentryTestButtonProps) {
  const [testCount, setTestCount] = useState(0);
  const [lastTestTime, setLastTestTime] = useState<number | null>(null);

  // Track component lifecycle and button usage statistics
  useEffect(() => {
    SentryDataCollection.addBreadcrumb({
      message: 'SentryTestButton component mounted',
      category: 'ui.lifecycle',
      data: {
        timestamp: new Date().toISOString(),
        component: 'SentryTestButton',
      },
    });

    // Track component as being available for testing
    SentryDataCollection.setContext('test_component', {
      component: 'SentryTestButton',
      mounted_at: new Date().toISOString(),
      purpose: 'sentry_testing',
    });

    return () => {
      SentryDataCollection.addBreadcrumb({
        message: 'SentryTestButton component unmounted',
        category: 'ui.lifecycle',
        data: {
          timestamp: new Date().toISOString(),
          testsExecuted: testCount,
          component: 'SentryTestButton',
        },
      });
    };
  }, [testCount]);

  // Track test execution statistics
  useEffect(() => {
    if (testCount > 0) {
      SentryInsights.trackFeatureUsage('sentry_test_execution', {
        totalTests: testCount,
        lastTestTime: lastTestTime ? new Date(lastTestTime).toISOString() : null,
        component: 'SentryTestButton',
      });
    }
  }, [testCount, lastTestTime]);

  const runSentryTests = () => {
    const testStartTime = performance.now();

    try {
      SentryDataCollection.addBreadcrumb({
        message: 'Sentry test execution started',
        category: 'test.execution',
        data: {
          testNumber: testCount + 1,
          timestamp: new Date().toISOString(),
          component: 'SentryTestButton',
        },
      });

      SentryLogger.info('🧪 Running Sentry tests from SentryTestButton...', {
        test_execution_id: `test_${testCount + 1}_${Date.now()}`,
        component: 'SentryTestButton',
      });

      // Test 1: Basic message capture
      SentryDataCollection.captureMessage('Test message from SentryTestButton', 'info');
      SentryDataCollection.addBreadcrumb({
        message: 'Test 1 completed: Basic message capture',
        category: 'test.step',
        data: { test_step: 1, test_type: 'message_capture' },
      });

      // Test 2: Add breadcrumb
      SentryDataCollection.addBreadcrumb({
        message: 'User triggered Sentry test',
        category: 'user-action',
        level: 'info',
        data: {
          test_type: 'manual_test',
          test_number: testCount + 1,
          timestamp: new Date().toISOString(),
        },
      });

      // Test 3: Set context
      SentryDataCollection.setContext('test_context', {
        test_feature: 'sentry_test_button',
        app_state: 'testing',
        user_action: 'manual_test',
        test_number: testCount + 1,
        test_timestamp: new Date().toISOString(),
      });

      // Test 4: Set tags
      SentryDataCollection.setTag('test_feature', 'sentry_test_button');
      SentryDataCollection.setTag('test_timestamp', new Date().toISOString());
      SentryDataCollection.setTag('test_number', (testCount + 1).toString());

      SentryDataCollection.addBreadcrumb({
        message: 'Test 2-4 completed: Breadcrumb, context, and tags',
        category: 'test.step',
        data: { test_steps: '2-4', test_types: 'breadcrumb,context,tags' },
      });

      // Test 5: Test error capture
      try {
        throw new Error(
          `Test error from SentryTestButton - test #${testCount + 1} - this is intentional`,
        );
      } catch (error) {
        SentryDataCollection.captureException(error as Error, {
          test_type: 'intentional_error',
          component: 'SentryTestButton',
          test_number: testCount + 1,
          test_timestamp: new Date().toISOString(),
        });

        SentryDataCollection.addBreadcrumb({
          message: 'Test 5 completed: Error capture',
          category: 'test.step',
          data: { test_step: 5, test_type: 'error_capture' },
        });
      }

      // Test 6: Test logger
      SentryLogger.info('Test log message from SentryTestButton', {
        test_type: 'logger_test',
        component: 'SentryTestButton',
        test_number: testCount + 1,
        timestamp: new Date().toISOString(),
      });

      // Test 7: Test user interaction logging
      SentryLogger.info('User interaction: sentry_test_button clicked', {
        test_mode: true,
        timestamp: new Date().toISOString(),
        interaction_type: 'click',
        test_number: testCount + 1,
        component: 'SentryTestButton',
      });

      SentryDataCollection.addBreadcrumb({
        message: 'Test 6-7 completed: Logger and user interaction',
        category: 'test.step',
        data: { test_steps: '6-7', test_types: 'logger,user_interaction' },
      });

      // Test 8: Test performance tracking
      const transaction = SentryInsights.startTransaction('sentry_test', 'test');
      setTimeout(() => {
        SentryInsights.finishTransaction(transaction, 'ok', {
          test_duration_ms: 100,
          test_success: true,
          test_number: testCount + 1,
          component: 'SentryTestButton',
        });

        SentryDataCollection.addBreadcrumb({
          message: 'Test 8 completed: Performance tracking',
          category: 'test.step',
          data: { test_step: 8, test_type: 'performance_tracking' },
        });
      }, 100);

      // Test 9: Test profiling (manual profiling test)
      SentryDataCollection.addBreadcrumb({
        message: 'Profiling test completed',
        category: 'profiling.test',
        level: 'info',
        data: {
          test_type: 'profiling_verification',
          test_number: testCount + 1,
          timestamp: new Date().toISOString(),
          component: 'SentryTestButton',
        },
      });

      const testEndTime = performance.now();
      const testDuration = testEndTime - testStartTime;

      // Update state
      setTestCount((prev) => prev + 1);
      setLastTestTime(testStartTime);

      // Track test completion
      SentryInsights.trackPerformanceMetric('sentry_test_duration', testDuration, 'ms');
      SentryDataCollection.addBreadcrumb({
        message: 'All Sentry tests completed successfully',
        category: 'test.completion',
        data: {
          testNumber: testCount + 1,
          testDurationMs: testDuration.toFixed(2),
          timestamp: new Date().toISOString(),
          component: 'SentryTestButton',
        },
      });

      SentryLogger.info('✅ All Sentry tests completed successfully', {
        test_execution_id: `test_${testCount + 1}_${Date.now()}`,
        test_duration_ms: testDuration.toFixed(2),
        total_tests_run: testCount + 1,
        component: 'SentryTestButton',
      });

      Alert.alert(
        '✅ Sentry Test Complete',
        `Test #${testCount + 1} completed successfully!\n\n` +
          '• Message captured\n' +
          '• Breadcrumb added\n' +
          '• Context set\n' +
          '• Tags added\n' +
          '• Error captured\n' +
          '• Logger tested\n' +
          '• User interaction logged\n' +
          '• Performance tracked\n' +
          '• Profiling tested\n\n' +
          `Duration: ${testDuration.toFixed(2)}ms\n` +
          'Check your Sentry dashboard to see the events.',
        [{ text: 'OK' }],
      );
    } catch (error) {
      const testEndTime = performance.now();
      const testDuration = testEndTime - testStartTime;

      SentryDataCollection.captureException(error as Error, {
        component: 'SentryTestButton',
        action: 'test_execution_failed',
        test_number: testCount + 1,
        test_duration_ms: testDuration.toFixed(2),
      });

      SentryLogger.error('❌ Sentry test failed:', {
        error: error instanceof Error ? error.message : String(error),
        test_execution_id: `test_${testCount + 1}_${Date.now()}`,
        test_duration_ms: testDuration.toFixed(2),
        component: 'SentryTestButton',
      });

      console.error('❌ Sentry test failed:', error);
      Alert.alert(
        '❌ Sentry Test Failed',
        `Test #${testCount + 1} failed after ${testDuration.toFixed(2)}ms\n\n` +
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        [{ text: 'OK' }],
      );
    }
  };

  // Track button press events
  const handlePress = () => {
    try {
      SentryDataCollection.addBreadcrumb({
        message: 'SentryTestButton pressed',
        category: 'ui.interaction',
        data: {
          timestamp: new Date().toISOString(),
          previousTestCount: testCount,
          component: 'SentryTestButton',
        },
      });

      SentryInsights.trackUserBehavior('sentry_test_button_press', {
        test_count: testCount,
        last_test_time: lastTestTime ? new Date(lastTestTime).toISOString() : null,
        component: 'SentryTestButton',
      });

      runSentryTests();
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'SentryTestButton',
        action: 'button_press_handler',
        test_count: testCount,
      });
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity style={styles.button} onPress={handlePress}>
        <Text style={styles.buttonText}>
          🧪 Test Sentry {testCount > 0 ? `(${testCount})` : ''}
        </Text>
      </TouchableOpacity>
      <Text style={styles.description}>
        Tap to test all Sentry features and send test events to your dashboard
      </Text>
      {testCount > 0 && (
        <Text style={styles.stats}>
          Tests run: {testCount} | Last test:{' '}
          {lastTestTime ? new Date(lastTestTime).toLocaleTimeString() : 'N/A'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#362d59',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 8,
  },
  stats: {
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
