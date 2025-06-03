import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SentryDataCollection, SentryTesting } from '../services/sentry';

/**
 * Sentry Test Component
 *
 * This component provides manual testing capabilities for Sentry functionality.
 * Use this when you need to verify Sentry is working correctly without
 * automatic test events being sent during app initialization.
 */
export default function SentryTestComponent() {
  const handleBasicTest = () => {
    SentryTesting.testMessage();
    Alert.alert('Basic Test', 'Test message sent ✅');
  };

  const handleErrorTest = () => {
    SentryTesting.testError();
    Alert.alert('Error Test', 'Test error sent ✅');
  };

  const handlePerformanceTest = async () => {
    try {
      SentryTesting.testBreadcrumb();
      Alert.alert('Performance Test', 'Test breadcrumb sent ✅');
    } catch {
      Alert.alert('Performance Test', 'Failed ❌');
    }
  };

  const handleProfilingTest = async () => {
    try {
      SentryTesting.testSessionReplay();
      Alert.alert('Profiling Test', 'Session Replay test sent ✅\nCheck Sentry Dashboard');
    } catch {
      Alert.alert('Profiling Test', 'Failed ❌');
    }
  };

  const handleComprehensiveTest = async () => {
    try {
      await SentryTesting.testAll();
      Alert.alert('Comprehensive Test', 'All tests completed ✅\nCheck Sentry Dashboard');
    } catch {
      Alert.alert('Comprehensive Test', 'Failed ❌');
    }
  };

  const handleTestMessage = () => {
    SentryDataCollection.captureMessage('Manual test message from Sentry Test Component', 'info');
    Alert.alert('Test Message', 'Sent to Sentry ✅');
  };

  const handleTestError = () => {
    try {
      throw new Error('Manual test error from Sentry Test Component');
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        test_type: 'manual_error_test',
        component: 'SentryTestComponent',
      });
      Alert.alert('Test Error', 'Sent to Sentry ✅');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sentry Test Component</Text>
      <Text style={styles.subtitle}>Manual testing for Sentry functionality</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Tests</Text>
        <TouchableOpacity style={styles.button} onPress={handleBasicTest}>
          <Text style={styles.buttonText}>Test Basic Functionality</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleErrorTest}>
          <Text style={styles.buttonText}>Test Error Capture</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handlePerformanceTest}>
          <Text style={styles.buttonText}>Test Performance Monitoring</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Advanced Tests</Text>
        <TouchableOpacity style={styles.button} onPress={handleProfilingTest}>
          <Text style={styles.buttonText}>Test Profiling</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleComprehensiveTest}>
          <Text style={styles.buttonText}>Run All Tests</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Manual Events</Text>
        <TouchableOpacity style={styles.button} onPress={handleTestMessage}>
          <Text style={styles.buttonText}>Send Test Message</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.errorButton]} onPress={handleTestError}>
          <Text style={styles.buttonText}>Send Test Error</Text>
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
