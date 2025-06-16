import React, { useEffect } from 'react';
import { View } from 'react-native';
import CoachingInterface from '../components/CoachingInterface';
import { CoachingProvider } from '../store/CoachingContext';
import { captureUIError, SentryReactProfiler } from '../services/sentry';
import * as Sentry from '@sentry/react-native';

export default function CoachingScreen() {
  useEffect(() => {
    // Track screen entry
    Sentry.addBreadcrumb({
      message: 'Coaching Screen Mounted',
      category: 'navigation',
      level: 'info',
      data: {
        screen: 'coaching',
        timestamp: new Date().toISOString(),
      },
    });

    // Track component lifecycle
    SentryReactProfiler.trackComponentLifecycle('CoachingScreen', 'mount');

    return () => {
      // Track screen exit
      Sentry.addBreadcrumb({
        message: 'Coaching Screen Unmounted',
        category: 'navigation',
        level: 'info',
        data: {
          screen: 'coaching',
          timestamp: new Date().toISOString(),
        },
      });

      // Track component lifecycle
      SentryReactProfiler.trackComponentLifecycle('CoachingScreen', 'unmount');
    };
  }, []);

  const handleComponentError = (error: Error) => {
    captureUIError(error, 'CoachingScreen', 'coaching');
    Sentry.addBreadcrumb({
      message: 'Coaching Screen Error',
      category: 'error',
      level: 'error',
      data: {
        error: error.message,
        component: 'CoachingScreen',
      },
    });
  };

  try {
    return (
      <CoachingProvider>
        <View style={{ flex: 1 }}>
          <CoachingInterface />
        </View>
      </CoachingProvider>
    );
  } catch (error) {
    handleComponentError(error as Error);
    throw error; // Re-throw to let error boundaries handle it
  }
}
