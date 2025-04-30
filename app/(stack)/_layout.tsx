import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function StackLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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
        name="(auth)/login"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(auth)/register"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(auth)/forgot-password"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(auth)/reset-password"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(auth)/edit-profile"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(tabs)"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="exercises-list"
        options={{
          headerShown: false,
          presentation: 'modal',
          redirect: true,
        }}
      />
    </Stack>
  );
} 