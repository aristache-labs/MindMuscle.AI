import { SentryDebug, SentryTesting } from '@/services/sentry';
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Card, Divider, Paragraph, Title } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SentryDebugScreen() {
  const handleTestMessage = () => {
    SentryTesting.testMessage();
  };

  const handleTestError = () => {
    SentryTesting.testError();
  };

  const handleTestBreadcrumb = () => {
    SentryTesting.testBreadcrumb();
  };

  const handleTestSessionReplay = () => {
    SentryTesting.testSessionReplay();
  };

  const handleTestWorkout = () => {
    SentryTesting.testWorkoutContext();
  };

  const handleTestAll = () => {
    SentryTesting.testAll();
  };

  const handleCheckConfig = () => {
    SentryTesting.checkConfig();
  };

  const handleTestUserInteraction = () => {
    SentryDebug.sessionReplay.trackUserInteraction(
      'tap',
      'debug-test-button',
      'sentry-debug-screen',
      { manual_test: true },
    );
    console.log('✅ User interaction tracked');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Card.Content>
            <Title>Sentry Debug & Testing</Title>
            <Paragraph>
              Use these buttons to manually test Sentry integration and verify data is being sent to
              your dashboard.
            </Paragraph>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title>Configuration Check</Title>
            <Button mode="contained" onPress={handleCheckConfig} style={styles.button}>
              Check Sentry Config
            </Button>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        <Card style={styles.card}>
          <Card.Content>
            <Title>Basic Tests</Title>
            <Button mode="outlined" onPress={handleTestMessage} style={styles.button}>
              Test Message Capture
            </Button>
            <Button mode="outlined" onPress={handleTestBreadcrumb} style={styles.button}>
              Test Breadcrumb
            </Button>
            <Button mode="outlined" onPress={handleTestError} style={styles.button}>
              Test Error Capture
            </Button>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        <Card style={styles.card}>
          <Card.Content>
            <Title>Session Replay Tests</Title>
            <Button mode="outlined" onPress={handleTestSessionReplay} style={styles.button}>
              Test Session Replay
            </Button>
            <Button mode="outlined" onPress={handleTestUserInteraction} style={styles.button}>
              Test User Interaction
            </Button>
            <Button mode="outlined" onPress={handleTestWorkout} style={styles.button}>
              Test Workout Context
            </Button>
          </Card.Content>
        </Card>

        <Divider style={styles.divider} />

        <Card style={styles.card}>
          <Card.Content>
            <Title>Comprehensive Test</Title>
            <Button mode="contained" onPress={handleTestAll} style={styles.button}>
              Run All Tests
            </Button>
            <Paragraph style={styles.note}>
              This will send multiple test events to Sentry. Check your console for logs and your
              Sentry dashboard for events.
            </Paragraph>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Title>Instructions</Title>
            <Paragraph>
              1. Press "Check Sentry Config" to verify your setup{'\n'}
              2. Use individual test buttons to test specific features{'\n'}
              3. Check your console for logs{'\n'}
              4. Check your Sentry dashboard for events{'\n'}
              5. Events may take 1-2 minutes to appear in Sentry
            </Paragraph>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  button: {
    marginVertical: 8,
  },
  divider: {
    marginVertical: 16,
  },
  note: {
    marginTop: 8,
    fontSize: 12,
    fontStyle: 'italic',
  },
});
