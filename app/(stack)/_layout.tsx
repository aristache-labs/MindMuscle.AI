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
        name="settings"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="exercises-list"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="exercise-details"
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
    </Stack>
  );
} 