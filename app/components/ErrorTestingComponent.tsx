import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Button, Card, Title, Paragraph, Divider } from 'react-native-paper';
import { ErrorTester } from '../utils/errorTestingUtils';

/**
 * ErrorTestingComponent - A development-only component for testing
 * the global error tracking functionality with Reactotron.
 * 
 * This component provides buttons to trigger various types of errors
 * and verify that they are properly captured and displayed in Reactotron.
 */
const ErrorTestingComponent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  if (!__DEV__) {
    return null; // Don't render in production
  }

  const handleErrorTest = async (testName: string, testFunction: () => void | Promise<void | unknown>) => {
    try {
      Alert.alert(
        'Error Test',
        `About to trigger: ${testName}\n\nCheck Reactotron for the error display!`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Trigger Error',
            style: 'destructive',
            onPress: async () => {
              try {
                await testFunction();
              } catch (error) {
                console.log(`✅ ${testName} successfully triggered:`, error);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.log(`Error in handleErrorTest for ${testName}:`, error);
    }
  };

  const handleRunAllTests = () => {
    Alert.alert(
      'Run All Error Tests',
      'This will trigger multiple errors in sequence. Check Reactotron to see them all!',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Run All Tests',
          style: 'destructive',
          onPress: () => {
            ErrorTester.runAll();
          },
        },
      ]
    );
  };

  if (!isVisible) {
    return (
      <View style={styles.container}>
        <Button
          mode="outlined"
          onPress={() => setIsVisible(true)}
          style={styles.toggleButton}
        >
          🧪 Show Error Testing Panel
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>🧪 Error Testing Panel</Title>
          <Paragraph>
            Test the global error tracking functionality. All errors will be captured and displayed in Reactotron.
          </Paragraph>
          
          <Divider style={styles.divider} />
          
          <View style={styles.buttonGrid}>
            <Button
              mode="contained"
              onPress={() => handleErrorTest('Runtime Error', ErrorTester.runtime)}
              style={styles.button}
              buttonColor="#FF6B6B"
            >
              Runtime Error
            </Button>
            
            <Button
              mode="contained"
              onPress={() => handleErrorTest('Type Error', ErrorTester.type)}
              style={styles.button}
              buttonColor="#4ECDC4"
            >
              Type Error
            </Button>
            
            <Button
              mode="contained"
              onPress={() => handleErrorTest('JSON Error', ErrorTester.json)}
              style={styles.button}
              buttonColor="#45B7D1"
            >
              JSON Error
            </Button>
            
            <Button
              mode="contained"
              onPress={() => handleErrorTest('Custom Error', ErrorTester.custom)}
              style={styles.button}
              buttonColor="#96CEB4"
            >
              Custom Error
            </Button>
            
            <Button
              mode="contained"
              onPress={() => handleErrorTest('Nested Error', ErrorTester.nested)}
              style={styles.button}
              buttonColor="#FFEAA7"
            >
              Nested Error
            </Button>
            
            <Button
              mode="contained"
              onPress={() => handleErrorTest('Async Error', ErrorTester.async)}
              style={styles.button}
              buttonColor="#DDA0DD"
            >
              Async Error
            </Button>
            
            <Button
              mode="contained"
              onPress={() => handleErrorTest('Component Error', ErrorTester.component)}
              style={styles.button}
              buttonColor="#F4A261"
            >
              Component Error
            </Button>
            
            <Button
              mode="contained"
              onPress={() => handleErrorTest('Context Error', () => ErrorTester.withContext(''))}
              style={styles.button}
              buttonColor="#E76F51"
            >
              Context Error
            </Button>
          </View>
          
          <Divider style={styles.divider} />
          
          <Button
            mode="contained"
            onPress={handleRunAllTests}
            style={[styles.button, styles.runAllButton]}
            buttonColor="#2A9D8F"
          >
            🚀 Run All Error Tests
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => setIsVisible(false)}
            style={styles.button}
          >
            Hide Panel
          </Button>
        </Card.Content>
      </Card>
    </View>
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
  divider: {
    marginVertical: 16,
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  button: {
    width: '48%',
    marginVertical: 4,
  },
  runAllButton: {
    width: '100%',
    marginVertical: 8,
  },
});

export default ErrorTestingComponent; 