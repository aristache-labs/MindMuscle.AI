import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { ThemeProvider } from './constants/theme';
import { AuthProvider } from './store/AuthContext';
import { ProfileProvider } from './store/ProfileContext';
import { ProgressProvider } from './store/ProgressContext';
import { GamificationProvider } from './store/GamificationContext';
import { LoadingScreen } from '../components/LoadingScreen';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  const [fontsLoaded] = useFonts({
    // Add any custom fonts here if needed
  });

  if (!fontsLoaded) {
    return <LoadingScreen />;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
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
                  name="(auth)/reset-password"
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
      </AuthProvider>
    </ThemeProvider>
  );
} 