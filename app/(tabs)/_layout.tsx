import { Tabs } from 'expo-router';
import { useColorScheme, View, Platform, Pressable, Text, Dimensions } from 'react-native';
import { useAuth } from '../store/AuthContext';
import { useRouter, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { logger } from '../utils/logger';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useAnimatedStyle, 
  withSpring,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBarBackground, CircleBackground } from '../components/NavigationBackgrounds';
import { HomeIcon, SearchIcon, DumbbellIcon, InsightsIcon, ProfileIcon } from '../components/NavigationIcons';
import { COLORS } from '../constants/theme';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 75;
const PADDING = 16;

// List of screens that should hide the tab bar
const HIDE_TAB_BAR_SCREENS = [
  '/plans',
  '/plan-details', 
  '/exercises-list', 
  '/exercise-details'
];

interface TabBarButtonProps {
  isFocused: boolean;
  onPress: () => void;
  icon: 'home' | 'search' | 'barbell' | 'stats-chart' | 'person';
  label: string;
}

const TabBarButton = ({ isFocused, onPress, icon, label }: TabBarButtonProps) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    opacity.value = withTiming(isFocused ? 1 : 0.7, {
      duration: 200,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
    scale.value = withSpring(isFocused ? 1.1 : 1, {
      mass: 1,
      damping: 15,
      stiffness: 200,
    });
  }, [isFocused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const renderIcon = () => {
    const color = isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)';
    const size = 24;

    switch (icon) {
      case 'home':
        return <HomeIcon size={size} color={color} focused={isFocused} />;
      case 'search':
        return <SearchIcon size={size} color={color} focused={isFocused} />;
      case 'barbell':
        return <DumbbellIcon size={size} color={color} focused={isFocused} />;
      case 'stats-chart':
        return <InsightsIcon size={size} color={color} focused={isFocused} />;
      case 'person':
        return <ProfileIcon size={size} color={color} focused={isFocused} />;
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        width: 70,
      }}
    >
      <Animated.View style={[animatedStyle, { alignItems: 'center' }]}>
        <View
          style={{
            backgroundColor: isFocused ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.08)',
            padding: 8,
            borderRadius: 12,
          }}
        >
          {renderIcon()}
        </View>
        <Text
          style={{
            fontSize: 12,
            fontWeight: isFocused ? '600' : '400',
            color: isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)',
            opacity: 1,
            marginTop: 4,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

const FloatingTabBar = ({ state, navigation, descriptors }: any) => {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  
  // Check if current path should hide the tab bar
  const shouldHideTabBar = HIDE_TAB_BAR_SCREENS.some(screen => 
    pathname.includes(screen)
  );
  
  // Don't render the tab bar if it should be hidden
  if (shouldHideTabBar) {
    return null;
  }
  
  // Define tab configurations
  const tabConfig = [
    { routeName: 'index', icon: 'home', label: 'Home' },
    { routeName: 'discover', icon: 'search', label: 'Discover' },
    { routeName: 'exercises', icon: 'barbell', label: 'Exercises', isCenterButton: true },
    { routeName: 'insights', icon: 'stats-chart', label: 'Insight' },
    { routeName: 'profile', icon: 'person', label: 'Profile' }
  ];
  
  return (
    <View
      style={{
        position: 'absolute',
        bottom: insets.bottom,
        left: 0,
        right: 0,
        height: 70,
        overflow: 'visible',
      }}
    >
      <TabBarBackground />
      
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        height: '120%',
      }}>
        <View style={{ flexDirection: 'row', width: '38%', justifyContent: 'space-between' }}>
          {tabConfig.slice(0, 2).map((tab, index) => {
            const route = state.routes.find((r: any) => r.name === tab.routeName);
            if (!route) return null;
            
            const { options } = descriptors[route.key];
            const isFocused = state.index === state.routes.indexOf(route);
            
            return (
              <TabBarButton
                key={route.key}
                isFocused={isFocused}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
                icon={tab.icon as any}
                label={tab.label}
              />
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', width: '38%', justifyContent: 'space-between' }}>
          {tabConfig.slice(3, 5).map((tab) => {
            const route = state.routes.find((r: any) => r.name === tab.routeName);
            if (!route) return null;
            
            const isFocused = state.index === state.routes.indexOf(route);
            
            return (
              <TabBarButton
                key={route.key}
                isFocused={isFocused}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
                icon={tab.icon as any}
                label={tab.label}
              />
            );
          })}
        </View>

        {tabConfig.map((tab) => {
          if (tab.isCenterButton) {
            const route = state.routes.find((r: any) => r.name === tab.routeName);
            if (!route) return null;
            
            const isFocused = state.index === state.routes.indexOf(route);
            
            return (
              <View 
                key={route.key}
                style={{
                  width: 90,
                  height: 90,
                  position: 'absolute',
                  top: -35,
                  left: '52.5%',
                  marginLeft: -45,
                  justifyContent: 'center',
                  alignItems: 'center',
                  zIndex: 1,
                }}
              >
                <CircleBackground />
                <Pressable 
                  onPress={() => {
                    const event = navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true,
                    });
                    if (!isFocused && !event.defaultPrevented) {
                      navigation.navigate(route.name);
                    }
                  }}
                  style={{ 
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <View
                    style={{
                      width: 90,
                      height: 90,
                      position: 'relative',
                    }}
                  >
                    <LinearGradient
                      colors={[COLORS.primary, COLORS.primary, COLORS.primary]}
                      style={{
                        backgroundColor: COLORS.surface,
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        borderRadius: 50,
                        padding: 1,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: isFocused ? COLORS.primary : COLORS.surface,
                          borderRadius: 50,
                          flex: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <DumbbellIcon size={36} color={isFocused ? '#FFFFFF' : COLORS.secondary} focused={isFocused} />
                        <Text style={{
                          fontSize: 12,
                          left: 1,
                          fontWeight: isFocused ? '600' : '500',
                          color: isFocused ? '#FFFFFF' : COLORS.secondary,
                          opacity: 1,
                          marginTop: 0,
                        }}>
                          {tab.label}
                        </Text>
                      </View>
                    </LinearGradient>
                  </View>
                </Pressable>
              </View>
            );
          }
          return null;
        })}
      </View>
    </View>
  );
};

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { session, loading } = useAuth();
  const [navigated, setNavigated] = useState(false);

  // Check authentication and navigate if needed
  useEffect(() => {
    if (!loading && !session && !navigated) {
      logger.info('User not authenticated in tabs layout, redirecting to login');
      
      // Add a short delay to ensure layout mounting is complete
      const timer = setTimeout(() => {
        setNavigated(true);
        router.replace('/(auth)/login');
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [loading, session, router, navigated]);

  // Show a blank View while determining auth state to avoid flash
  if (loading || (!session && !navigated)) {
    return <View style={{ flex: 1 }} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: 'none',
        },
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Workout',
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Workout',
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Stats',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
    </Tabs>
  );
} 