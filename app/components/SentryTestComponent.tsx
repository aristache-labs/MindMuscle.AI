import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  SentryDataCollection,
  SentryInsights,
  SentryLogger,
  SentryTesting,
} from '../services/sentry';

interface TestStats {
  basicTests: number;
  errorTests: number;
  performanceTests: number;
  profilingTests: number;
  comprehensiveTests: number;
  manualMessages: number;
  manualErrors: number;
  lastTestTime: number | null;
}

/**
 * Sentry Test Component
 *
 * This component provides manual testing capabilities for Sentry functionality.
 * Use this when you need to verify Sentry is working correctly without
 * automatic test events being sent during app initialization.
 */
export default function SentryTestComponent() {
  const [testStats, setTestStats] = useState<TestStats>({
    basicTests: 0,
    errorTests: 0,
    performanceTests: 0,
    profilingTests: 0,
    comprehensiveTests: 0,
    manualMessages: 0,
    manualErrors: 0,
    lastTestTime: null,
  });

  // Track component lifecycle
  useEffect(() => {
    SentryDataCollection.addBreadcrumb({
      message: 'SentryTestComponent mounted',
      category: 'ui.lifecycle',
      data: {
        timestamp: new Date().toISOString(),
        component: 'SentryTestComponent',
        purpose: 'comprehensive_sentry_testing',
      },
    });

    // Set context for test component
    SentryDataCollection.setContext('test_component_advanced', {
      component: 'SentryTestComponent',
      mounted_at: new Date().toISOString(),
      purpose: 'advanced_sentry_testing',
      features: [
        'basic_tests',
        'error_tests',
        'performance_tests',
        'profiling_tests',
        'manual_events',
      ],
    });

    return () => {
      SentryDataCollection.addBreadcrumb({
        message: 'SentryTestComponent unmounted',
        category: 'ui.lifecycle',
        data: {
          timestamp: new Date().toISOString(),
          component: 'SentryTestComponent',
          totalTestsExecuted: Object.values(testStats).reduce(
            (sum, val) => sum + (typeof val === 'number' ? val : 0),
            0,
          ),
          testStats,
        },
      });
    };
  }, [testStats]);

  // Track test statistics changes
  useEffect(() => {
    const totalTests = Object.values(testStats).reduce(
      (sum, val) => sum + (typeof val === 'number' ? val : 0),
      0,
    );

    if (totalTests > 0) {
      SentryInsights.trackFeatureUsage('sentry_test_component_usage', {
        totalTests,
        testBreakdown: testStats,
        lastTestTime: testStats.lastTestTime
          ? new Date(testStats.lastTestTime).toISOString()
          : null,
        component: 'SentryTestComponent',
      });
    }
  }, [testStats]);

  // Helper function to update test stats and track performance
  const updateTestStats = (testType: keyof TestStats, duration?: number) => {
    const now = performance.now();

    setTestStats((prev) => ({
      ...prev,
      [testType]: (prev[testType] as number) + 1,
      lastTestTime: now,
    }));

    if (duration !== undefined) {
      SentryInsights.trackPerformanceMetric(`${testType}_duration`, duration, 'ms');
    }

    SentryDataCollection.addBreadcrumb({
      message: `Test completed: ${testType}`,
      category: 'test.completion',
      data: {
        testType,
        duration: duration?.toFixed(2),
        timestamp: new Date().toISOString(),
        component: 'SentryTestComponent',
      },
    });
  };

  const handleBasicTest = () => {
    const startTime = performance.now();

    try {
      SentryDataCollection.addBreadcrumb({
        message: 'Basic Sentry test started',
        category: 'test.execution',
        data: {
          testType: 'basic',
          timestamp: new Date().toISOString(),
          component: 'SentryTestComponent',
        },
      });

      SentryTesting.testMessage();

      const duration = performance.now() - startTime;
      updateTestStats('basicTests', duration);

      SentryLogger.info('Basic Sentry test completed successfully', {
        test_type: 'basic',
        duration_ms: duration.toFixed(2),
        component: 'SentryTestComponent',
      });

      Alert.alert('Basic Test', 'Test message sent ✅');
    } catch (error) {
      const duration = performance.now() - startTime;

      SentryDataCollection.captureException(error as Error, {
        component: 'SentryTestComponent',
        action: 'basic_test_execution',
        duration_ms: duration.toFixed(2),
      });

      Alert.alert('Basic Test', 'Failed ❌');
    }
  };

  const handleErrorTest = () => {
    const startTime = performance.now();

    try {
      SentryDataCollection.addBreadcrumb({
        message: 'Error Sentry test started',
        category: 'test.execution',
        data: {
          testType: 'error',
          timestamp: new Date().toISOString(),
          component: 'SentryTestComponent',
        },
      });

      SentryTesting.testError();

      const duration = performance.now() - startTime;
      updateTestStats('errorTests', duration);

      SentryLogger.info('Error Sentry test completed successfully', {
        test_type: 'error',
        duration_ms: duration.toFixed(2),
        component: 'SentryTestComponent',
      });

      Alert.alert('Error Test', 'Test error sent ✅');
    } catch (error) {
      const duration = performance.now() - startTime;

      SentryDataCollection.captureException(error as Error, {
        component: 'SentryTestComponent',
        action: 'error_test_execution',
        duration_ms: duration.toFixed(2),
      });

      Alert.alert('Error Test', 'Failed ❌');
    }
  };

  const handlePerformanceTest = async () => {
    const startTime = performance.now();

    try {
      SentryDataCollection.addBreadcrumb({
        message: 'Performance Sentry test started',
        category: 'test.execution',
        data: {
          testType: 'performance',
          timestamp: new Date().toISOString(),
          component: 'SentryTestComponent',
        },
      });

      SentryTesting.testBreadcrumb();

      const duration = performance.now() - startTime;
      updateTestStats('performanceTests', duration);

      SentryLogger.info('Performance Sentry test completed successfully', {
        test_type: 'performance',
        duration_ms: duration.toFixed(2),
        component: 'SentryTestComponent',
      });

      Alert.alert('Performance Test', 'Test breadcrumb sent ✅');
    } catch (error) {
      const duration = performance.now() - startTime;

      SentryDataCollection.captureException(error as Error, {
        component: 'SentryTestComponent',
        action: 'performance_test_execution',
        duration_ms: duration.toFixed(2),
      });

      Alert.alert('Performance Test', 'Failed ❌');
    }
  };

  const handleProfilingTest = async () => {
    const startTime = performance.now();

    try {
      SentryDataCollection.addBreadcrumb({
        message: 'Profiling Sentry test started',
        category: 'test.execution',
        data: {
          testType: 'profiling',
          timestamp: new Date().toISOString(),
          component: 'SentryTestComponent',
        },
      });

      SentryTesting.testSessionReplay();

      const duration = performance.now() - startTime;
      updateTestStats('profilingTests', duration);

      SentryLogger.info('Profiling Sentry test completed successfully', {
        test_type: 'profiling',
        duration_ms: duration.toFixed(2),
        component: 'SentryTestComponent',
      });

      Alert.alert('Profiling Test', 'Session Replay test sent ✅\nCheck Sentry Dashboard');
    } catch (error) {
      const duration = performance.now() - startTime;

      SentryDataCollection.captureException(error as Error, {
        component: 'SentryTestComponent',
        action: 'profiling_test_execution',
        duration_ms: duration.toFixed(2),
      });

      Alert.alert('Profiling Test', 'Failed ❌');
    }
  };

  const handleComprehensiveTest = async () => {
    const startTime = performance.now();

    try {
      SentryDataCollection.addBreadcrumb({
        message: 'Comprehensive Sentry test started',
        category: 'test.execution',
        data: {
          testType: 'comprehensive',
          timestamp: new Date().toISOString(),
          component: 'SentryTestComponent',
        },
      });

      await SentryTesting.testAll();

      const duration = performance.now() - startTime;
      updateTestStats('comprehensiveTests', duration);

      SentryLogger.info('Comprehensive Sentry test completed successfully', {
        test_type: 'comprehensive',
        duration_ms: duration.toFixed(2),
        component: 'SentryTestComponent',
      });

      Alert.alert('Comprehensive Test', 'All tests completed ✅\nCheck Sentry Dashboard');
    } catch (error) {
      const duration = performance.now() - startTime;

      SentryDataCollection.captureException(error as Error, {
        component: 'SentryTestComponent',
        action: 'comprehensive_test_execution',
        duration_ms: duration.toFixed(2),
      });

      Alert.alert('Comprehensive Test', 'Failed ❌');
    }
  };

  const handleTestMessage = () => {
    const startTime = performance.now();

    try {
      SentryDataCollection.addBreadcrumb({
        message: 'Manual test message started',
        category: 'test.manual',
        data: {
          testType: 'manual_message',
          timestamp: new Date().toISOString(),
          component: 'SentryTestComponent',
        },
      });

      SentryDataCollection.captureMessage('Manual test message from Sentry Test Component', 'info');

      const duration = performance.now() - startTime;
      updateTestStats('manualMessages', duration);

      SentryLogger.info('Manual test message sent successfully', {
        test_type: 'manual_message',
        duration_ms: duration.toFixed(2),
        component: 'SentryTestComponent',
      });

      Alert.alert('Test Message', 'Sent to Sentry ✅');
    } catch (error) {
      const duration = performance.now() - startTime;

      SentryDataCollection.captureException(error as Error, {
        component: 'SentryTestComponent',
        action: 'manual_message_execution',
        duration_ms: duration.toFixed(2),
      });

      Alert.alert('Test Message', 'Failed ❌');
    }
  };

  const handleTestError = () => {
    const startTime = performance.now();

    try {
      SentryDataCollection.addBreadcrumb({
        message: 'Manual test error started',
        category: 'test.manual',
        data: {
          testType: 'manual_error',
          timestamp: new Date().toISOString(),
          component: 'SentryTestComponent',
        },
      });

      try {
        throw new Error('Manual test error from Sentry Test Component');
      } catch (testError) {
        SentryDataCollection.captureException(testError as Error, {
          test_type: 'manual_error_test',
          component: 'SentryTestComponent',
          timestamp: new Date().toISOString(),
        });
      }

      const duration = performance.now() - startTime;
      updateTestStats('manualErrors', duration);

      SentryLogger.info('Manual test error sent successfully', {
        test_type: 'manual_error',
        duration_ms: duration.toFixed(2),
        component: 'SentryTestComponent',
      });

      Alert.alert('Test Error', 'Sent to Sentry ✅');
    } catch (error) {
      const duration = performance.now() - startTime;

      SentryDataCollection.captureException(error as Error, {
        component: 'SentryTestComponent',
        action: 'manual_error_execution',
        duration_ms: duration.toFixed(2),
      });

      Alert.alert('Test Error', 'Failed ❌');
    }
  };

  // Track button interactions
  const trackButtonPress = (buttonName: string, testType: string) => {
    SentryDataCollection.addBreadcrumb({
      message: `Button pressed: ${buttonName}`,
      category: 'ui.interaction',
      data: {
        buttonName,
        testType,
        timestamp: new Date().toISOString(),
        component: 'SentryTestComponent',
        currentStats: testStats,
      },
    });

    SentryInsights.trackUserBehavior('sentry_test_component_button_press', {
      button_name: buttonName,
      test_type: testType,
      current_stats: testStats,
      component: 'SentryTestComponent',
    });
  };

  const totalTests = Object.values(testStats).reduce(
    (sum, val) => sum + (typeof val === 'number' ? val : 0),
    0,
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sentry Test Component</Text>
      <Text style={styles.subtitle}>Manual testing for Sentry functionality</Text>

      {totalTests > 0 && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Test Statistics</Text>
          <Text style={styles.statsText}>Total Tests: {totalTests}</Text>
          <Text style={styles.statsText}>
            Last Test:{' '}
            {testStats.lastTestTime ? new Date(testStats.lastTestTime).toLocaleTimeString() : 'N/A'}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Tests</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            trackButtonPress('Test Basic Functionality', 'basic');
            handleBasicTest();
          }}
        >
          <Text style={styles.buttonText}>
            Test Basic Functionality {testStats.basicTests > 0 ? `(${testStats.basicTests})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            trackButtonPress('Test Error Capture', 'error');
            handleErrorTest();
          }}
        >
          <Text style={styles.buttonText}>
            Test Error Capture {testStats.errorTests > 0 ? `(${testStats.errorTests})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            trackButtonPress('Test Performance Monitoring', 'performance');
            handlePerformanceTest();
          }}
        >
          <Text style={styles.buttonText}>
            Test Performance Monitoring{' '}
            {testStats.performanceTests > 0 ? `(${testStats.performanceTests})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Advanced Tests</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            trackButtonPress('Test Profiling', 'profiling');
            handleProfilingTest();
          }}
        >
          <Text style={styles.buttonText}>
            Test Profiling {testStats.profilingTests > 0 ? `(${testStats.profilingTests})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            trackButtonPress('Run All Tests', 'comprehensive');
            handleComprehensiveTest();
          }}
        >
          <Text style={styles.buttonText}>
            Run All Tests{' '}
            {testStats.comprehensiveTests > 0 ? `(${testStats.comprehensiveTests})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual Events</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            trackButtonPress('Send Test Message', 'manual_message');
            handleTestMessage();
          }}
        >
          <Text style={styles.buttonText}>
            Send Test Message {testStats.manualMessages > 0 ? `(${testStats.manualMessages})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.errorButton]}
          onPress={() => {
            trackButtonPress('Send Test Error', 'manual_error');
            handleTestError();
          }}
        >
          <Text style={styles.buttonText}>
            Send Test Error {testStats.manualErrors > 0 ? `(${testStats.manualErrors})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.note}>
        Note: These tests will send events to your Sentry dashboard. Use only when you need to
        verify Sentry functionality.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  statsContainer: {
    backgroundColor: '#e8f4f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#b3d9e6',
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
    textAlign: 'center',
  },
  statsText: {
    fontSize: 12,
    color: '#555',
    textAlign: 'center',
    marginBottom: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  note: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 16,
  },
});
