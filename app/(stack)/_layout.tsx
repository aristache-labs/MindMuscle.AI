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
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="my-plan"
        options={{
          headerShown: false,
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      /> 

      <Stack.Screen
        name="ai-coaching"
        options={{
          headerShown: false,
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="single-workout"
        options={{
          headerShown: false,
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
        }}
      />
       <Stack.Screen
        name="custom"
        options={{
          headerShown: false,
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
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
      />
      <Stack.Screen
        name="workout-session"
        options={{
          headerShown: false,
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
        }}
      />
    </Stack>
  );
} 
