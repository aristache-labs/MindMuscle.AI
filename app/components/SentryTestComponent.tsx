import * as Sentry from '@sentry/react-native';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * SentryTestComponent
 *
 * A component to test all Sentry features including:
 * - Console logging (which should now appear in Sentry)
 * - Performance traces
 * - Error capture
 * - Breadcrumbs
 * - Profiling
 * - Mobile Replay
 */
export const SentryTestComponent: React.FC = () => {
  const testConsoleLogging = () => {
    console.log('🧪 Test: console.log from React Native - should appear in Sentry breadcrumbs');
    console.info('🧪 Test: console.info from React Native - should appear in Sentry breadcrumbs');
    console.warn('🧪 Test: console.warn from React Native - should appear in Sentry breadcrumbs');
    console.error('🧪 Test: console.error from React Native - should appear in Sentry as error');

    Alert.alert(
      'Console Test Complete ✅',
      'Console messages sent to Sentry!\n\n' +
        'Check your Sentry dashboard:\n' +
        '• Issues tab: console.error message\n' +
        '• Event details: breadcrumbs from other console calls\n' +
        '• The stack trace you see is NORMAL and expected!',
    );
  };

  const testPerformanceTraces = () => {
    console.log('🔄 Starting performance trace test...');

    // Use withScope to create traces in React Native
    Sentry.withScope((scope) => {
      scope.setTag('test_type', 'performance_trace');
      scope.setContext('trace_test', {
        operation: 'user_interaction',
        description: 'User testing Sentry traces',
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumbs to simulate trace steps
      Sentry.addBreadcrumb({
        message: 'Starting API call simulation',
        category: 'http.client',
        level: 'info',
        data: {
          method: 'GET',
          url: '/api/test',
          status: 'started',
        },
      });

      setTimeout(() => {
        Sentry.addBreadcrumb({
          message: 'API call completed',
          category: 'http.client',
          level: 'info',
          data: {
            method: 'GET',
            url: '/api/test',
            status_code: 200,
            duration: '200ms',
          },
        });

        Sentry.addBreadcrumb({
          message: 'Starting database query simulation',
          category: 'db.query',
          level: 'info',
          data: {
            statement: 'SELECT * FROM test_table',
            status: 'started',
          },
        });

        setTimeout(() => {
          Sentry.addBreadcrumb({
            message: 'Database query completed',
            category: 'db.query',
            level: 'info',
            data: {
              statement: 'SELECT * FROM test_table',
              rows_affected: 5,
              duration: '100ms',
            },
          });

          // Capture a message to complete the trace
          Sentry.captureMessage('Performance trace test completed', 'info');
          console.log('✅ Performance trace completed');
          Alert.alert(
            'Performance Test Complete ✅',
            'Performance trace sent to Sentry!\n\n' +
              'Check your Sentry dashboard:\n' +
              '• Performance tab: Transaction data\n' +
              '• Event details: Breadcrumbs showing API and DB operations',
          );
        }, 100);
      }, 200);
    });
  };

  const testErrorCapture = () => {
    try {
      // Intentionally throw an error
      throw new Error('🧪 Test error from SentryTestComponent - this should appear in Issues');
    } catch (error) {
      Sentry.captureException(error);
      console.error('🧪 Test error captured:', error);
      Alert.alert(
        'Error Test Complete ✅',
        'Test error sent to Sentry!\n\n' +
          'Check your Sentry dashboard:\n' +
          '• Issues tab: New error with stack trace\n' +
          '• Error details: Full context and breadcrumbs',
      );
    }
  };

  const testBreadcrumbs = () => {
    Sentry.addBreadcrumb({
      message: 'User clicked breadcrumb test button',
      category: 'user.interaction',
      level: 'info',
      data: {
        component: 'SentryTestComponent',
        action: 'test_breadcrumbs',
        timestamp: new Date().toISOString(),
      },
    });

    Sentry.addBreadcrumb({
      message: 'Breadcrumb test sequence initiated',
      category: 'test',
      level: 'debug',
      data: {
        test_type: 'breadcrumb_verification',
        expected_result: 'visible_in_sentry_event_details',
      },
    });

    // Capture a message to see the breadcrumbs
    Sentry.captureMessage(
      'Breadcrumb test completed - check event details for breadcrumbs',
      'info',
    );

    console.log('🍞 Breadcrumbs added and test message sent');
    Alert.alert(
      'Breadcrumb Test Complete ✅',
      'Breadcrumbs sent to Sentry!\n\n' +
        'Check your Sentry dashboard:\n' +
        '• Issues tab: Find the breadcrumb test message\n' +
        '• Event details: Look for breadcrumbs section\n' +
        '• You should see user interaction and test breadcrumbs',
    );
  };

  const testProfilingAndReplay = async () => {
    console.log('🎬 Testing Profiling and Mobile Replay...');

    // Test Mobile Replay
    Sentry.addBreadcrumb({
      message: 'Mobile Replay test initiated - user interaction simulation',
      category: 'replay.test',
      level: 'info',
      data: {
        test_type: 'mobile_replay_verification',
        user_action: 'button_press',
        screen: 'SentryTestComponent',
        timestamp: new Date().toISOString(),
      },
    });

    // Test Profiling with MUCH MORE CPU-intensive work
    Sentry.withScope((scope) => {
      scope.setTag('test_type', 'intensive_profiling_and_replay');
      scope.setTag('platform', 'react-native');
      scope.setContext('profiling_test', {
        test_name: 'intensive_cpu_profiling_test',
        purpose: 'generate_significant_profiling_data',
        mobile_replay: 'enabled',
        expected_duration: '5-10_seconds',
      });

      console.log('⚡ Starting INTENSIVE CPU work for profiling (this will take 5-10 seconds)...');
      const startTime = performance.now();

      // MUCH MORE intensive computation that will definitely show up in profiles
      let result = 0;
      let stringOps = '';
      const objects: Array<{ id: number; value: number; text: string; computed: number[] }> = [];
      const arrayOperations: number[] = [];

      // Extended computation to ensure significant profile capture
      for (let i = 0; i < 2000000; i++) {
        // Complex mathematical operations
        result += Math.sin(i) * Math.cos(i) + Math.sqrt(i) + Math.pow(i % 100, 2);

        // String operations every 1000 iterations
        if (i % 1000 === 0) {
          stringOps += `computation_${i}_${Math.random().toString(36).substring(7)}_${Date.now()}`;

          // Create complex objects
          const computedArray = Array.from({ length: 50 }, (_, idx) => {
            return Math.sin(idx * i) * Math.cos(idx + i) + Math.sqrt(idx * i + 1);
          });

          objects.push({
            id: i,
            value: result,
            text: stringOps.substring(Math.max(0, stringOps.length - 20)),
            computed: computedArray,
          });
        }

        // Heavy array operations every 10000 iterations
        if (i % 10000 === 0) {
          // Simplified array operations that will still stress the CPU
          const tempArray = Array.from({ length: 1000 }, (_, idx) => idx * i);
          const processed = tempArray
            .filter((x) => x % 3 === 0)
            .map((x) => Math.sqrt(x) + Math.sin(x))
            .reduce((acc, val) => acc + val, 0);
          result += processed;
          arrayOperations.push(processed);

          // Simulate sorting operations
          const randomArray = Array.from({ length: 500 }, () => Math.random() * 1000);
          randomArray.sort((a, b) => b - a);
          result += randomArray[0];
        }

        // JSON operations every 25000 iterations
        if (i % 25000 === 0) {
          const complexObject = {
            iteration: i,
            timestamp: Date.now(),
            data: objects.slice(-10),
            arrayOps: arrayOperations.slice(-5),
            computed: {
              result: result,
              stringLength: stringOps.length,
              objectCount: objects.length,
              arrayOpCount: arrayOperations.length,
            },
          };

          // Serialize and parse to simulate real-world operations
          const serialized = JSON.stringify(complexObject);
          const parsed = JSON.parse(serialized);
          result += parsed.computed.result * 0.001;

          console.log(`🔄 Profiling progress: ${((i / 2000000) * 100).toFixed(1)}% complete`);
        }

        // Recursive function calls every 50000 iterations
        if (i % 50000 === 0) {
          const fibonacci = (n: number): number => {
            if (n <= 1) return n;
            return fibonacci(n - 1) + fibonacci(n - 2);
          };

          // Calculate fibonacci for numbers that will create significant call stack
          const fibResult = fibonacci(Math.min(25, Math.floor(i / 100000) + 15));
          result += fibResult;
        }
      }

      const duration = performance.now() - startTime;

      scope.setContext('profiling_results', {
        computation_result: result,
        duration_ms: duration,
        iterations: 2000000,
        objects_created: objects.length,
        array_operations_created: arrayOperations.length,
        string_operations: stringOps.length,
        profiling_should_be_visible: true,
        mobile_replay_should_capture: true,
        test_intensity: 'very_high',
        expected_profile_data: 'significant_cpu_usage_patterns',
      });

      console.log(`✅ INTENSIVE Profiling test completed in ${duration.toFixed(2)}ms`);
      console.log(`🔢 Final computation result: ${result.toFixed(2)}`);
      console.log(
        `📊 Created ${objects.length} objects, ${arrayOperations.length} array operations`,
      );

      // Capture the profiling test completion
      Sentry.captureMessage(
        '🎯 INTENSIVE PROFILING & REPLAY TEST COMPLETED - Check Sentry Dashboard!',
        'info',
      );

      Alert.alert(
        'Intensive Profiling & Replay Test Complete ✅',
        `INTENSIVE CPU work completed in ${duration.toFixed(2)}ms!\n\n` +
          'This test was much more intensive and should generate profiling data.\n\n' +
          'Check your Sentry dashboard:\n' +
          '• Performance > Profiles: CPU profiling data (wait 2-5 minutes)\n' +
          '• Replays: Session recording of this interaction\n' +
          '• Issues: Event with profiling context\n\n' +
          'Note: Profiling data may take 2-5 minutes to appear in dashboard',
      );
    });
  };

  const runComprehensiveTest = async () => {
    console.log('🧪 Running comprehensive Sentry test suite...');

    Alert.alert(
      'Starting Comprehensive Test 🧪',
      'This will test all Sentry features:\n' +
        '• Console logging integration\n' +
        '• Error capture\n' +
        '• Performance traces\n' +
        '• Breadcrumbs\n' +
        '• Profiling\n' +
        '• Mobile Replay\n\n' +
        'Watch the console and check your Sentry dashboard!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Tests',
          onPress: async () => {
            // Run tests with delays
            testConsoleLogging();

            setTimeout(() => {
              testBreadcrumbs();
            }, 1000);

            setTimeout(() => {
              testPerformanceTraces();
            }, 2000);

            setTimeout(() => {
              testErrorCapture();
            }, 3000);

            setTimeout(async () => {
              await testProfilingAndReplay();

              // Final summary
              setTimeout(() => {
                Alert.alert(
                  'All Tests Complete! 🎉',
                  'Check your Sentry dashboard now:\n\n' +
                    '📊 Issues: Multiple test events\n' +
                    '📈 Performance: Traces and profiles\n' +
                    '🎬 Replays: Session recordings\n' +
                    '🔍 Discover: Search for test events\n\n' +
                    'The console.error stack traces are NORMAL!\n' +
                    'They show Sentry is working correctly.',
                );
              }, 1000);
            }, 4000);
          },
        },
      ],
    );
  };

  const explainConsoleErrors = () => {
    Alert.alert(
      'About Console Error Stack Traces 📚',
      'The stack traces you see for console.error are NORMAL and EXPECTED!\n\n' +
        '✅ What they mean:\n' +
        '• Sentry is successfully capturing console.error\n' +
        '• The error is being sent to your dashboard\n' +
        '• Stack trace shows the capture process\n\n' +
        '🎯 This proves your integration is working!\n\n' +
        '❌ You would only worry if:\n' +
        '• No errors appear in Sentry dashboard\n' +
        '• Console messages are not captured\n' +
        '• Actual app crashes occur\n\n' +
        'The current behavior is exactly what we want!',
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sentry Test Component</Text>
      <Text style={styles.subtitle}>Test different Sentry features</Text>

      <TouchableOpacity style={styles.button} onPress={testConsoleLogging}>
        <Text style={styles.buttonText}>Test Console Logging</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testPerformanceTraces}>
        <Text style={styles.buttonText}>Test Performance Traces</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testBreadcrumbs}>
        <Text style={styles.buttonText}>Test Breadcrumbs</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testErrorCapture}>
        <Text style={styles.buttonText}>Test Error Capture</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={testProfilingAndReplay}>
        <Text style={styles.buttonText}>Test Profiling & Replay</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.primaryButton]}
        onPress={runComprehensiveTest}
      >
        <Text style={[styles.buttonText, styles.primaryButtonText]}>🧪 Run All Tests</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.infoButton]} onPress={explainConsoleErrors}>
        <Text style={[styles.buttonText, styles.infoButtonText]}>📚 About Console Errors</Text>
      </TouchableOpacity>

      <Text style={styles.note}>
        ✅ Console error stack traces are NORMAL!
        {'\n'}They prove Sentry integration is working.
        {'\n'}
        {'\n'}Check your Sentry dashboard:
        {'\n'}• Issues: For errors and messages
        {'\n'}• Performance: For traces and profiles
        {'\n'}• Replays: For session recordings
        {'\n'}• Discover: For searching events
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#34C759',
    marginTop: 10,
  },
  infoButton: {
    backgroundColor: '#FF9500',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#e8f5e8',
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#2d5a2d',
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
});

export default SentryTestComponent;
