import { Stack } from 'expo-router';
import React from 'react';
import { useColorScheme } from 'react-native';
import * as Sentry from '@sentry/react-native';

export default function AuthLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Set Sentry context for authentication flow
  React.useEffect(() => {
    Sentry.setContext('auth_flow', {
      layout: 'auth_layout',
      theme: colorScheme,
      timestamp: new Date().toISOString(),
    });

    Sentry.addBreadcrumb({
      message: 'User entered authentication flow',
      category: 'navigation',
      level: 'info',
      data: {
        theme: colorScheme,
        layout: 'auth',
      },
    });

    // Set tag for authentication-related errors
    Sentry.setTag('flow', 'authentication');

    return () => {
      // Clear auth context when leaving auth flow
      Sentry.setContext('auth_flow', null);
    };
  }, [colorScheme]);

  // Screen change handler to track auth screen navigation
  const handleScreenChange = React.useCallback(
    (screenName: string) => {
      Sentry.addBreadcrumb({
        message: `Navigated to auth screen: ${screenName}`,
        category: 'navigation',
        level: 'info',
        data: {
          screen: screenName,
          flow: 'authentication',
          theme: colorScheme,
        },
      });

      // Set current auth screen in context
      Sentry.setContext('current_auth_screen', {
        screen: screenName,
        timestamp: new Date().toISOString(),
      });
    },
    [colorScheme],
  );

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
      screenListeners={{
        state: (e) => {
          // Track screen changes for Sentry
          const currentRoute = e.data?.state?.routes?.[e.data?.state?.index];
          if (currentRoute?.name) {
            handleScreenChange(currentRoute.name);
          }
        },
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
        }}
        listeners={{
          focus: () => handleScreenChange('login'),
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          headerShown: false,
        }}
        listeners={{
          focus: () => handleScreenChange('register'),
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          headerShown: false,
        }}
        listeners={{
          focus: () => handleScreenChange('forgot-password'),
        }}
      />
      <Stack.Screen
        name="reset-password"
        options={{
          headerShown: false,
        }}
        listeners={{
          focus: () => handleScreenChange('reset-password'),
        }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{
          headerShown: false,
        }}
        listeners={{
          focus: () => handleScreenChange('edit-profile'),
        }}
      />
    </Stack>
  );
}
