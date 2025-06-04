// Initialize polyfills first (includes early Promise polyfills to prevent Sentry warnings)
import './utils/polyfills';

// Apply splash screen compatibility patch before any other imports
import './utils/splashScreenPatch';

// Configure Reanimated logger to reduce warnings
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';

// Disable strict mode warnings for better development experience
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, // Disable strict mode warnings
});

import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';
import { useFonts } from 'expo-font';
import { Slot, useNavigationContainerRef } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AuthGuard from './components/AuthGuard';
import { QueryProvider } from './components/QueryProvider';
import SplashScreenManager from './components/SplashScreenManager';
import { ThemeProvider } from './constants/theme';
import {
  createExpoRouterNavigationIntegration,
  initializeSentry,
  simpleErrorHandler,
} from './services/sentry';
import { AuthProvider } from './store/AuthContext';
import { MeasurementsProvider } from './store/MeasurementsContext';
import { ProfileProvider } from './store/ProfileContext';
import { setupGlobalAsyncErrorHandler } from './utils/asyncErrorHandler';

// Create navigation integration for Expo Router
const navigationIntegration = createExpoRouterNavigationIntegration(isRunningInExpoGo());

// Initialize Sentry as early as possible with navigation integration
initializeSentry(navigationIntegration);

// Initialize comprehensive error handler
simpleErrorHandler.initialize();

// Setup global async error handler
setupGlobalAsyncErrorHandler();

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);

    // Report to Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorBoundaryStyles.container}>
          <Text style={errorBoundaryStyles.title}>Something went wrong</Text>
          <Text style={errorBoundaryStyles.message}>
            The app encountered an unexpected error. Please restart the app.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={errorBoundaryStyles.errorDetails}>{this.state.error.message}</Text>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

const errorBoundaryStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1a1a1a',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorDetails: {
    fontSize: 12,
    color: '#ff6b6b',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});

// Root component wrapped in SafeAreaProvider
const RootApp = () => {
  const _colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    // Add any custom fonts here if needed
  });

  // Get navigation container ref for Expo Router integration
  const ref = useNavigationContainerRef();

  // Register navigation container with Sentry
  React.useEffect(() => {
    if (ref) {
      navigationIntegration.registerNavigationContainer(ref);
    }
  }, [ref]);

  // Wait for fonts to load
  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryProvider>
            <ThemeProvider>
              <AuthProvider>
                <MeasurementsProvider>
                  <ProfileProvider>
                    <SplashScreenManager>
                      <AuthGuard>
                        <Slot />
                      </AuthGuard>
                    </SplashScreenManager>
                  </ProfileProvider>
                </MeasurementsProvider>
              </AuthProvider>
            </ThemeProvider>
          </QueryProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
};

// Use React.memo for the layout component to ensure consistent static flags
const RootLayout = React.memo(RootApp);

export default Sentry.wrap(RootLayout);
