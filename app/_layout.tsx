import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Stack, Tabs } from 'expo-router';
import { useFonts } from 'expo-font';
import { ThemeProvider } from './constants/theme';
import { AuthProvider } from './store/AuthContext';
import { ProfileProvider } from './store/ProfileContext';
import { ProgressProvider } from './store/ProgressContext';
import { GamificationProvider } from './store/GamificationContext';
import { ProgressPhotosProvider } from './store/ProgressPhotosContext';
import InitialLoadingScreen from './components/InitialLoadingScreen';
import { Ionicons } from '@expo/vector-icons';
import { preloadStaticImages } from './utils/imagePreloader';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isImagesLoaded, setImagesLoaded] = useState(false);
  
  const [fontsLoaded] = useFonts({
    // Add any custom fonts here if needed
  });

  useEffect(() => {
    async function loadImages() {
      try {
        await preloadStaticImages();
        setImagesLoaded(true);
      } catch (error) {
        console.error('Failed to preload images:', error);
        // Still set as loaded to not block the app
        setImagesLoaded(true);
      }
    }
    loadImages();
  }, []);

  if (!fontsLoaded || !isImagesLoaded) {
    return <InitialLoadingScreen showProgress={false} message="Loading resources..." />;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <ProfileProvider>
          <ProgressProvider>
            <GamificationProvider>
              <ProgressPhotosProvider>
                <Stack
                  screenOptions={{
                    headerStyle: {
                      backgroundColor: colorScheme === 'dark' ? '#181a20' : '#FFFFFF',
                    },
                    headerTintColor: colorScheme === 'dark' ? '#FFFFFF' : '#181a20',
                    headerTitleStyle: {
                      fontWeight: 'bold',
                    },
                  }}
                >
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
                </Stack>
              </ProgressPhotosProvider>
            </GamificationProvider>
          </ProgressProvider>
        </ProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export function TabsLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#181a20' : '#FFFFFF',
          borderTopColor: colorScheme === 'dark' ? '#2c2c2c' : '#e0e0e0',
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
        },
        tabBarActiveTintColor: '#6c47ff',
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#666666' : '#999999',
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
} 