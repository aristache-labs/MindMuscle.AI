import React from 'react';
import { Button, View, StyleSheet } from 'react-native';
import * as Sentry from '@sentry/react-native';

interface SentryTestButtonProps {
  title?: string;
}

const SentryTestButton: React.FC<SentryTestButtonProps> = ({ title = 'Test Sentry Error' }) => {
  const handleTestError = () => {
    try {
      // Send a test exception to Sentry
      Sentry.captureException(new Error('First error - Sentry test'));

      // Also send a test message
      Sentry.captureMessage('Test message from MindMuscle.AI app', 'info');

      console.log('Test error sent to Sentry!');
    } catch (error) {
      console.error('Failed to send test error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Button title={title} onPress={handleTestError} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 10,
  },
});

export default SentryTestButton;
