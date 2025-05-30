import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Card, Title, Paragraph, Divider, Chip } from 'react-native-paper';
import {
  useRenderDebugger,
  useContextDebugger,
  trackUserAction,
  debugApiCall,
  benchmark,
  trackAsyncOperation,
  DebugUtils,
} from '../utils/debuggingUtils';

/**
 * ReactotronDemoComponent - Demonstrates advanced Reactotron tips and tricks
 *
 * This component showcases various debugging techniques and utilities
 * that enhance the Reactotron debugging experience.
 */
const ReactotronDemoComponent: React.FC = () => {
  const [counter, setCounter] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [apiData, setApiData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Demonstrate render debugging
  useRenderDebugger('ReactotronDemoComponent', { counter, isVisible }, { apiData, isLoading });

  // Demonstrate context debugging (simulated)
  useContextDebugger('DemoContext', { counter, apiData });

  if (!__DEV__) {
    return null; // Don't render in production
  }

  // Demonstrate basic console.tron usage
  const handleBasicLogging = () => {
    console.tron?.log('Basic log message');
    console.tron?.logImportant('Important message with indicator');
    console.tron?.display({
      name: '🎯 Fancy Display',
      value: { counter, timestamp: new Date().toISOString() },
      preview: `Counter is now ${counter}`,
      important: counter > 5,
    });
  };

  // Demonstrate enhanced console methods
  const handleEnhancedLogging = () => {
    console.tron?.success('Operation completed successfully', { counter });
    console.tron?.display({
      name: '⚠️ Warning',
      value: { message: 'Counter is getting high', counter, threshold: 10 },
      preview: 'Warning: Counter is getting high',
      important: true,
    });
    console.tron?.error('Simulated error', new Error('This is a test error'));
  };

  // Demonstrate API call debugging
  const handleApiCallDemo = async () => {
    setIsLoading(true);
    trackUserAction('api_call_demo_started', { counter });

    try {
      const result = await debugApiCall(
        'https://jsonplaceholder.typicode.com/posts/1',
        { method: 'GET' },
        async () => {
          const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
          return response.json();
        },
      );

      setApiData(result);
      console.tron?.success('API call completed', result);
    } catch (error) {
      console.tron?.error('API call failed', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Demonstrate performance benchmarking
  const handlePerformanceDemo = () => {
    // Synchronous benchmark
    const result = benchmark(
      () => {
        // Simulate some work
        let sum = 0;
        for (let i = 0; i < 1000000; i++) {
          sum += i;
        }
        return sum;
      },
      'Heavy Calculation',
      50,
    );

    console.tron?.display({
      name: '⚡ Benchmark Result',
      value: { result, operation: 'Heavy Calculation' },
      preview: `Calculation result: ${result}`,
    });
  };

  // Demonstrate async operation tracking
  const handleAsyncDemo = async () => {
    await trackAsyncOperation(
      'Simulated Async Work',
      async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve('Async work completed');
          }, 1000);
        });
      },
      { includeResult: true },
    );
  };

  // Demonstrate state tracking
  const handleStateDemo = () => {
    const oldCounter = counter;
    const newCounter = counter + 1;

    DebugUtils.trackStateChange('counter', oldCounter, newCounter, 'increment');
    setCounter(newCounter);
  };

  // Demonstrate user action tracking
  const handleUserActionDemo = () => {
    trackUserAction(
      'button_clicked',
      {
        buttonName: 'User Action Demo',
        counter,
        timestamp: new Date().toISOString(),
      },
      counter > 10,
    );
  };

  // Demonstrate navigation tracking
  const handleNavigationDemo = () => {
    console.tron?.display({
      name: '🧭 Navigation',
      value: {
        routeName: 'DemoScreen',
        params: { counter, fromComponent: 'ReactotronDemoComponent' },
      },
      preview: 'Navigate to: DemoScreen',
      important: false,
    });
  };

  // Demonstrate clearing Reactotron
  const handleClearDemo = () => {
    console.tron?.logImportant('About to clear Reactotron...');
    setTimeout(() => {
      if (
        global.reactotron &&
        typeof (global.reactotron as { clear?: () => void }).clear === 'function'
      ) {
        (global.reactotron as { clear: () => void }).clear();
      }
      console.tron?.logImportant('Reactotron cleared! 🧹');
    }, 1000);
  };

  if (!isVisible) {
    return (
      <View style={styles.container}>
        <Button mode="outlined" onPress={() => setIsVisible(true)} style={styles.toggleButton}>
          🎯 Show Reactotron Tips & Tricks Demo
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>🎯 Reactotron Tips & Tricks Demo</Title>
          <Paragraph>
            This component demonstrates advanced Reactotron debugging techniques. Check Reactotron
            to see the enhanced logging in action!
          </Paragraph>

          <View style={styles.statusContainer}>
            <Chip icon="counter" style={styles.chip}>
              Counter: {counter}
            </Chip>
            <Chip icon={isLoading ? 'loading' : 'check'} style={styles.chip}>
              {isLoading ? 'Loading...' : 'Ready'}
            </Chip>
          </View>

          <Divider style={styles.divider} />

          <Title style={styles.sectionTitle}>Basic Console Methods</Title>
          <View style={styles.buttonRow}>
            <Button
              mode="contained"
              onPress={handleBasicLogging}
              style={styles.button}
              buttonColor="#4CAF50"
            >
              Basic Logging
            </Button>

            <Button
              mode="contained"
              onPress={handleEnhancedLogging}
              style={styles.button}
              buttonColor="#FF9800"
            >
              Enhanced Logging
            </Button>
          </View>

          <Divider style={styles.divider} />

          <Title style={styles.sectionTitle}>API & Network Debugging</Title>
          <View style={styles.buttonRow}>
            <Button
              mode="contained"
              onPress={handleApiCallDemo}
              style={styles.button}
              buttonColor="#2196F3"
              loading={isLoading}
              disabled={isLoading}
            >
              API Call Demo
            </Button>

            <Button
              mode="contained"
              onPress={() => DebugUtils.createNetworkInterceptor()}
              style={styles.button}
              buttonColor="#9C27B0"
            >
              Enable Network Interceptor
            </Button>
          </View>

          <Divider style={styles.divider} />

          <Title style={styles.sectionTitle}>Performance & State Tracking</Title>
          <View style={styles.buttonRow}>
            <Button
              mode="contained"
              onPress={handlePerformanceDemo}
              style={styles.button}
              buttonColor="#FF5722"
            >
              Performance Demo
            </Button>

            <Button
              mode="contained"
              onPress={handleStateDemo}
              style={styles.button}
              buttonColor="#795548"
            >
              State Tracking
            </Button>
          </View>

          <View style={styles.buttonRow}>
            <Button
              mode="contained"
              onPress={handleAsyncDemo}
              style={styles.button}
              buttonColor="#607D8B"
            >
              Async Tracking
            </Button>

            <Button
              mode="contained"
              onPress={handleUserActionDemo}
              style={styles.button}
              buttonColor="#E91E63"
            >
              User Action
            </Button>
          </View>

          <Divider style={styles.divider} />

          <Title style={styles.sectionTitle}>Navigation & Utilities</Title>
          <View style={styles.buttonRow}>
            <Button
              mode="contained"
              onPress={handleNavigationDemo}
              style={styles.button}
              buttonColor="#3F51B5"
            >
              Navigation Demo
            </Button>

            <Button
              mode="contained"
              onPress={handleClearDemo}
              style={styles.button}
              buttonColor="#F44336"
            >
              Clear Reactotron
            </Button>
          </View>

          <Divider style={styles.divider} />

          <Title style={styles.sectionTitle}>Global Utilities</Title>
          <Paragraph style={styles.utilityText}>Available in console:</Paragraph>
          <Paragraph style={styles.codeText}>
            • console.tron.* - Enhanced logging methods{'\n'}• ErrorTester.* - Error testing
            utilities{'\n'}• DebugUtils.* - Advanced debugging utilities{'\n'}• global.reactotron -
            Direct Reactotron access
          </Paragraph>

          <Button mode="outlined" onPress={() => setIsVisible(false)} style={styles.button}>
            Hide Demo
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  toggleButton: {
    marginVertical: 8,
  },
  card: {
    elevation: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  chip: {
    marginRight: 8,
    marginBottom: 4,
  },
  divider: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  button: {
    width: '48%',
    marginVertical: 4,
  },
  utilityText: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
});

export default ReactotronDemoComponent;
