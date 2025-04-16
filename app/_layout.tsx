import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { darkTheme, lightTheme } from './constants/theme';
import { ProfileProvider } from './store/ProfileContext';
import { ProgressProvider } from './store/ProgressContext';
import { GamificationProvider } from './store/GamificationContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <PaperProvider theme={colorScheme === 'dark' ? darkTheme : lightTheme}>
      <ProfileProvider>
        <ProgressProvider>
          <GamificationProvider>
            <Stack
              screenOptions={{
                headerStyle: {
                  backgroundColor: colorScheme === 'dark' ? '#1A1B1E' : '#FFFFFF',
                },
                headerTintColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}
            >
              <Stack.Screen
                name="index"
                options={{
                  title: 'MindMuscle.AI',
                }}
              />
              <Stack.Screen
                name="(auth)/login"
                options={{
                  title: 'Login',
                }}
              />
              <Stack.Screen
                name="(auth)/register"
                options={{
                  title: 'Register',
                }}
              />
              <Stack.Screen
                name="(app)/home"
                options={{
                  title: 'Home',
                }}
              />
              <Stack.Screen
                name="(app)/exercises"
                options={{
                  title: 'Exercises',
                }}
              />
              <Stack.Screen
                name="(app)/workouts"
                options={{
                  title: 'Workouts',
                }}
              />
              <Stack.Screen
                name="(app)/profile"
                options={{
                  title: 'Profile',
                }}
              />
              <Stack.Screen
                name="profile/edit"
                options={{
                  title: 'Edit Profile',
                }}
              />
              <Stack.Screen
                name="progress"
                options={{
                  title: 'Progress',
                }}
              />
              <Stack.Screen
                name="gamification"
                options={{
                  title: 'Achievements',
                }}
              />
            </Stack>
          </GamificationProvider>
        </ProgressProvider>
      </ProfileProvider>
    </PaperProvider>
  );
} 