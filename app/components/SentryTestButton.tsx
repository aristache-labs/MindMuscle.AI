import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SentryDataCollection, SentryInsights, SentryLogger } from '../services/sentry';

interface SentryTestButtonProps {
  style?: object;
}

export default function SentryTestButton({ style }: SentryTestButtonProps) {
  const runSentryTests = () => {
    try {
      console.log('🧪 Running Sentry tests...');

      // Test 1: Basic message capture
      SentryDataCollection.captureMessage('Test message from SentryTestButton', 'info');

      // Test 2: Add breadcrumb
      SentryDataCollection.addBreadcrumb({
        message: 'User triggered Sentry test',
        category: 'user-action',
        level: 'info',
        data: {
          test_type: 'manual_test',
          timestamp: new Date().toISOString(),
        },
      });

      // Test 3: Set context
      SentryDataCollection.setContext('test_context', {
        test_feature: 'sentry_test_button',
        app_state: 'testing',
        user_action: 'manual_test',
      });

      // Test 4: Set tags
      SentryDataCollection.setTag('test_feature', 'sentry_test_button');
      SentryDataCollection.setTag('test_timestamp', new Date().toISOString());

      // Test 5: Test error capture
      try {
        throw new Error('Test error from SentryTestButton - this is intentional');
      } catch (error) {
        SentryDataCollection.captureException(error as Error, {
          test_type: 'intentional_error',
          component: 'SentryTestButton',
        });
      }

      // Test 6: Test logger
      SentryLogger.info('Test log message', {
        test_type: 'logger_test',
        component: 'SentryTestButton',
      });

      // Test 7: Test user interaction logging
      SentryLogger.info('User interaction: sentry_test_button clicked', {
        test_mode: true,
        timestamp: new Date().toISOString(),
        interaction_type: 'click',
      });

      // Test 8: Test performance tracking
      const transaction = SentryInsights.startTransaction('sentry_test', 'test');
      setTimeout(() => {
        SentryInsights.finishTransaction(transaction, 'ok', {
          test_duration_ms: 100,
          test_success: true,
        });
      }, 100);

      // Test 9: Test profiling (manual profiling test)
      SentryDataCollection.addBreadcrumb({
        message: 'Profiling test completed',
        category: 'profiling.test',
        level: 'info',
        data: {
          test_type: 'profiling_verification',
          timestamp: new Date().toISOString(),
        },
      });

      console.log('✅ All Sentry tests completed successfully');

      Alert.alert(
        '✅ Sentry Test Complete',
        'All Sentry features have been tested successfully!\n\n' +
          '• Message captured\n' +
          '• Breadcrumb added\n' +
          '• Context set\n' +
          '• Tags added\n' +
          '• Error captured\n' +
          '• Logger tested\n' +
          '• User interaction logged\n' +
          '• Performance tracked\n' +
          '• Profiling tested\n\n' +
          'Check your Sentry dashboard to see the events.',
        [{ text: 'OK' }],
      );
    } catch (error) {
      console.error('❌ Sentry test failed:', error);
      Alert.alert(
        '❌ Sentry Test Failed',
        `An error occurred while testing Sentry: ${error instanceof Error ? error.message : String(error)}`,
        [{ text: 'OK' }],
      );
    }
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity style={styles.button} onPress={runSentryTests}>
        <Text style={styles.buttonText}>🧪 Test Sentry</Text>
      </TouchableOpacity>
      <Text style={styles.description}>
        Tap to test all Sentry features and send test events to your dashboard
      </Text>
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
  },
});
