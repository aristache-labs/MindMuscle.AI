import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useEffect } from 'react';
import { setTag, SentryReactProfiler } from '../services/sentry';
import { addBreadcrumb } from '../services/sentry/simpleErrorHandler';

export default function StackLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Track stack layout initialization
  useEffect(() => {
    addBreadcrumb('Stack Layout initialized', 'navigation', {
      theme: colorScheme,
      timestamp: new Date().toISOString(),
    });

    setTag('navigation_stack', 'stack_layout');
    setTag('theme_mode', isDark ? 'dark' : 'light');

    // Track component lifecycle
    SentryReactProfiler.trackComponentLifecycle('StackLayout', 'mount');

    return () => {
      SentryReactProfiler.trackComponentLifecycle('StackLayout', 'unmount');
    };
  }, [colorScheme, isDark]);

  // Track theme changes
  useEffect(() => {
    addBreadcrumb(`Theme changed to ${colorScheme}`, 'ui', {
      previous_theme: isDark ? 'light' : 'dark',
      new_theme: colorScheme,
    });

    setTag('current_theme', colorScheme || 'system');
  }, [colorScheme, isDark]);

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: isDark ? '#181a20' : '#FFFFFF',
        },
        headerTintColor: isDark ? '#FFFFFF' : '#181a20',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        contentStyle: {
          backgroundColor: isDark ? '#121212' : '#F5F5F5',
        },
      }}
    >
      <Stack.Screen
        name="settings"
        options={{
          headerShown: false,
        }}
        listeners={{
          focus: () => {
            addBreadcrumb('Navigated to Settings screen', 'navigation', {
              screen: 'settings',
              theme: colorScheme,
            });
            setTag('current_screen', 'settings');
          },
        }}
      />

      <Stack.Screen
        name="my-plan"
        options={{
          headerShown: false,
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
        listeners={{
          focus: () => {
            addBreadcrumb('Navigated to My Plan screen', 'navigation', {
              screen: 'my-plan',
              gestureEnabled: false,
              theme: colorScheme,
            });
            setTag('current_screen', 'my-plan');
          },
        }}
      />

      <Stack.Screen
        name="ai-coaching"
        options={{
          headerShown: false,
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
        listeners={{
          focus: () => {
            addBreadcrumb('Navigated to AI Coaching screen', 'navigation', {
              screen: 'ai-coaching',
              gestureEnabled: false,
              theme: colorScheme,
            });
            setTag('current_screen', 'ai-coaching');
          },
        }}
      />

      <Stack.Screen
        name="single-workout"
        options={{
          headerShown: false,
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
        listeners={{
          focus: () => {
            addBreadcrumb('Navigated to Single Workout screen', 'navigation', {
              screen: 'single-workout',
              gestureEnabled: false,
              theme: colorScheme,
            });
            setTag('current_screen', 'single-workout');
          },
        }}
      />

      <Stack.Screen
        name="custom"
        options={{
          headerShown: false,
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
        listeners={{
          focus: () => {
            addBreadcrumb('Navigated to Custom screen', 'navigation', {
              screen: 'custom',
              gestureEnabled: false,
              theme: colorScheme,
            });
            setTag('current_screen', 'custom');
          },
        }}
      />

      <Stack.Screen
        name="plans"
        options={{
          headerShown: false,
          animation: 'default',
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          animationDuration: 250,
        }}
        listeners={{
          focus: () => {
            addBreadcrumb('Navigated to Plans screen', 'navigation', {
              screen: 'plans',
              animation: 'default',
              gestureEnabled: true,
              animationDuration: 250,
              theme: colorScheme,
            });
            setTag('current_screen', 'plans');
          },
        }}
      />

      <Stack.Screen
        name="plan-details"
        options={{
          headerShown: false,
          animation: 'default',
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          animationDuration: 250,
        }}
        listeners={{
          focus: () => {
            addBreadcrumb('Navigated to Plan Details screen', 'navigation', {
              screen: 'plan-details',
              animation: 'default',
              gestureEnabled: true,
              animationDuration: 250,
              theme: colorScheme,
            });
            setTag('current_screen', 'plan-details');
          },
        }}
      />

      <Stack.Screen
        name="workout-session"
        options={{
          headerShown: false,
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
        listeners={{
          focus: () => {
            addBreadcrumb('Navigated to Workout Session screen', 'navigation', {
              screen: 'workout-session',
              gestureEnabled: true,
              theme: colorScheme,
              critical_screen: true,
            });
            setTag('current_screen', 'workout-session');
            setTag('session_type', 'workout');
          },
          blur: () => {
            addBreadcrumb('Left Workout Session screen', 'navigation', {
              screen: 'workout-session',
              action: 'blur',
            });
          },
        }}
      />
    </Stack>
  );
}
