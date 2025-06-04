import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logger } from '../utils/logger';
import { CircleBackground, TabBarBackground } from '../components/NavigationBackgrounds';
import {
  DumbbellIcon,
  HomeIcon,
  InsightsIcon,
  ProfileIcon,
  SearchIcon,
} from '../components/NavigationIcons';
import { COLORS } from '../constants/theme';
import { useAuth } from '../store/AuthContext';

// List of screens that should hide the tab bar
const HIDE_TAB_BAR_SCREENS = [
  '/plans',
  '/plan-details',
  '/exercises-list',
  '/exercise-details',
  '/exercises-single-group',
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

const FloatingTabBar = ({ state, navigation, descriptors }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Check if current path should hide the tab bar
  const shouldHideTabBar = HIDE_TAB_BAR_SCREENS.some((screen) => pathname.includes(screen));

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
    { routeName: 'profile', icon: 'person', label: 'Profile' },
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

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 10,
          height: '120%',
        }}
      >
        <View style={{ flexDirection: 'row', width: '38%', justifyContent: 'space-between' }}>
          {tabConfig.slice(0, 2).map((tab, _index) => {
            const route = state.routes.find((r) => r.name === tab.routeName);
            if (!route) return null;

            const { options: _options } = descriptors[route.key];
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
                icon={tab.icon as 'home' | 'search' | 'barbell' | 'stats-chart' | 'person'}
                label={tab.label}
              />
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', width: '38%', justifyContent: 'space-between' }}>
          {tabConfig.slice(3, 5).map((tab) => {
            const route = state.routes.find((r) => r.name === tab.routeName);
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
                icon={tab.icon as 'home' | 'search' | 'barbell' | 'stats-chart' | 'person'}
                label={tab.label}
              />
            );
          })}
        </View>

        {tabConfig.map((tab) => {
          if (tab.isCenterButton) {
            const route = state.routes.find((r) => r.name === tab.routeName);
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
                        <DumbbellIcon
                          size={36}
                          color={isFocused ? '#FFFFFF' : COLORS.secondary}
                          focused={isFocused}
                        />
                        <Text
                          style={{
                            fontSize: 12,
                            left: 1,
                            fontWeight: isFocused ? '600' : '500',
                            color: isFocused ? '#FFFFFF' : COLORS.secondary,
                            opacity: 1,
                            marginTop: 0,
                          }}
                        >
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
  const { session, loading } = useAuth();
  const [navigated, setNavigated] = useState(false);
  const pathname = usePathname();

  // Check if current path should hide the tab bar
  const shouldHideTabBar = HIDE_TAB_BAR_SCREENS.some((screen) => pathname.includes(screen));

  // Check authentication and navigate if needed
  useEffect(() => {
    if (!loading && !session && !navigated) {
      logger.info('User not authenticated in tabs layout');
      setNavigated(true);
      // AuthGuard will handle the redirect automatically when session becomes null
    }
  }, [loading, session, navigated]);

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
      tabBar={(props) => (shouldHideTabBar ? null : <FloatingTabBar {...props} />)}
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
