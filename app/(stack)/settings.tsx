import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, IconButton, Switch, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WorkoutDaysModal from '../components/WorkoutDaysModal';
import { COLORS, SPACING } from '../constants/theme';
import { SentryDataCollection, SentryLogger } from '../services/sentry';
import { useAuth } from '../store/AuthContext';
import { CacheStats, clearImageCache, getCacheStats } from '../utils/imagePreloader';
import { logger } from '../utils/logger';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isDarkTheme, setIsDarkTheme] = React.useState(true);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [workoutDaysModalVisible, setWorkoutDaysModalVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [workoutReminders, setWorkoutReminders] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [validationErrors] = useState<Record<string, string>>({});
  const [isLoading] = useState(false);

  // Fetch cache statistics when the component mounts
  useEffect(() => {
    try {
      // Log settings screen access
      SentryLogger.info('Settings screen accessed', {
        user_id: user?.id,
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for screen navigation
      SentryDataCollection.addBreadcrumb({
        message: 'User navigated to settings screen',
        category: 'navigation',
        level: 'info',
        data: {
          screen: 'settings',
          user_authenticated: !!user,
        },
      });

      // Set user context for this session
      if (user) {
        SentryDataCollection.setUser({
          id: user.id,
          email: user.email,
        });
      }

      updateCacheStats();
      // TODO: Re-enable when notification features are implemented
      // loadUserPreferences();
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'settings_screen_initialization',
        user_id: user?.id,
      });
      logger.error('Error initializing settings screen', error as Error, {
        context: { userId: user?.id },
      });
    }
  }, [user]);

  // TODO: Re-enable when notification features are implemented
  // Load user preferences from database
  // const loadUserPreferences = async () => {
  //   if (!user?.id) return;

  //   try {
  //     const { data, error } = await supabase
  //       .from('user_profile_details')
  //       .select(
  //         'preferred_weight_unit, preferred_height_unit, notifications_enabled, workout_reminders, dark_theme, sound_enabled',
  //       )
  //       .eq('user_id', user.id)
  //       .maybeSingle();

  //     if (error && error.code !== 'PGRST116') {
  //       logger.error('Error loading user preferences', error, {
  //         context: { userId: user.id },
  //       });
  //       return;
  //     }

  //     if (data) {
  //       setNotificationsEnabled(data.notifications_enabled ?? true);
  //       setWorkoutReminders(data.workout_reminders ?? true);
  //       setIsDarkTheme(data.dark_theme ?? true);
  //       setSoundEnabled(data.sound_enabled ?? true);
  //     }
  //   } catch (error) {
  //     logger.error('Failed to load user preferences', error as Error, {
  //       context: { userId: user.id },
  //     });
  //   }
  // };

  // TODO: Re-enable when notification features are implemented
  // Validate and save user preferences
  const saveUserPreferences = async (preferences: {
    notifications_enabled?: boolean;
    workout_reminders?: boolean;
    dark_theme?: boolean;
    sound_enabled?: boolean;
  }) => {
    try {
      // Log preference changes
      SentryLogger.info('User preferences updated', {
        user_id: user?.id,
        preferences,
        timestamp: new Date().toISOString(),
      });

      // Add breadcrumb for user action
      SentryDataCollection.addBreadcrumb({
        message: 'User updated preferences',
        category: 'user-action',
        level: 'info',
        data: {
          preferences,
          user_id: user?.id,
        },
      });

      // Temporarily disabled - no database operations for these features yet
      logger.info('User preferences save disabled - features not implemented yet', {
        context: { preferences },
      });
      return true;
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'save_user_preferences',
        user_id: user?.id,
        preferences,
      });
      logger.error('Error saving user preferences', error as Error, {
        context: { userId: user?.id, preferences },
      });
      return false;
    }
  };

  // Handle theme toggle with validation
  const handleThemeToggle = async (value: boolean) => {
    try {
      SentryLogger.info('Theme toggle triggered', {
        user_id: user?.id,
        new_theme: value ? 'dark' : 'light',
        previous_theme: isDarkTheme ? 'dark' : 'light',
      });

      setIsDarkTheme(value);
      await saveUserPreferences({ dark_theme: value });

      // Set Sentry tag for theme
      SentryDataCollection.setTag('user_theme', value ? 'dark' : 'light');
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'theme_toggle',
        user_id: user?.id,
        attempted_value: value,
      });
      logger.error('Error toggling theme', error as Error);
    }
  };

  // Handle notifications toggle with validation
  const handleNotificationsToggle = async (value: boolean) => {
    try {
      SentryLogger.info('Notifications toggle triggered', {
        user_id: user?.id,
        enabled: value,
        previous_state: notificationsEnabled,
      });

      setNotificationsEnabled(value);
      await saveUserPreferences({ notifications_enabled: value });

      // Set Sentry tag for notifications
      SentryDataCollection.setTag('notifications_enabled', value.toString());
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'notifications_toggle',
        user_id: user?.id,
        attempted_value: value,
      });
      logger.error('Error toggling notifications', error as Error);
    }
  };

  // Handle workout reminders toggle with validation
  const handleWorkoutRemindersToggle = async (value: boolean) => {
    try {
      SentryLogger.info('Workout reminders toggle triggered', {
        user_id: user?.id,
        enabled: value,
        previous_state: workoutReminders,
      });

      setWorkoutReminders(value);
      await saveUserPreferences({ workout_reminders: value });

      // Set Sentry tag for workout reminders
      SentryDataCollection.setTag('workout_reminders_enabled', value.toString());
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'workout_reminders_toggle',
        user_id: user?.id,
        attempted_value: value,
      });
      logger.error('Error toggling workout reminders', error as Error);
    }
  };

  // Handle sound toggle with validation
  const handleSoundToggle = async (value: boolean) => {
    try {
      SentryLogger.info('Sound toggle triggered', {
        user_id: user?.id,
        enabled: value,
        previous_state: soundEnabled,
      });

      setSoundEnabled(value);
      await saveUserPreferences({ sound_enabled: value });

      // Set Sentry tag for sound
      SentryDataCollection.setTag('sound_enabled', value.toString());
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'sound_toggle',
        user_id: user?.id,
        attempted_value: value,
      });
      logger.error('Error toggling sound', error as Error);
    }
  };

  // Update cache statistics
  const updateCacheStats = () => {
    try {
      const stats = getCacheStats();
      setCacheStats(stats);

      // Log cache statistics for monitoring
      SentryDataCollection.addBreadcrumb({
        message: 'Cache statistics updated',
        category: 'cache.stats',
        level: 'info',
        data: {
          total_entries: stats.totalEntries,
          estimated_size_bytes: stats.estimatedSize,
          hit_count: stats.hitCount,
          miss_count: stats.missCount,
          hit_rate:
            stats.hitCount + stats.missCount > 0
              ? Math.round((stats.hitCount / (stats.hitCount + stats.missCount)) * 100)
              : 0,
        },
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'update_cache_stats',
        user_id: user?.id,
      });
      logger.error('Error updating cache stats', error as Error);
    }
  };

  // Format bytes to human-readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Format relative time
  const formatRelativeTime = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  // Handle cache clearing with validation
  const handleClearCache = async () => {
    try {
      // Log cache clear attempt
      SentryLogger.info('User initiated cache clear', {
        user_id: user?.id,
        cache_size_before: cacheStats?.estimatedSize || 0,
        cache_entries_before: cacheStats?.totalEntries || 0,
        cache_type: 'full_clear',
      });

      Alert.alert('Clear All Cache', 'Are you sure you want to clear all cached images?', [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            SentryDataCollection.addBreadcrumb({
              message: 'User cancelled cache clear',
              category: 'user-action',
              level: 'info',
            });
          },
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setClearingCache(true);
            try {
              const result = await clearImageCache();
              setClearingCache(false);
              updateCacheStats();

              // Log successful cache clear
              SentryLogger.info('Cache cleared successfully', {
                user_id: user?.id,
                cleared_count: result.memoryClearedCount,
                cache_size_before: cacheStats?.estimatedSize || 0,
                operation_type: 'full_clear',
              });

              Alert.alert(
                'Cache Cleared',
                `Successfully cleared ${result.memoryClearedCount} cached images.`,
                [{ text: 'OK' }],
              );

              logger.info('Cache cleared successfully', {
                context: { clearedCount: result.memoryClearedCount },
              });
            } catch (error) {
              SentryDataCollection.captureException(error as Error, {
                context: 'clear_cache_operation',
                user_id: user?.id,
                operation_type: 'full_clear',
              });
              logger.error('Error clearing cache', error as Error);
              setClearingCache(false);
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ]);
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'handle_clear_cache',
        user_id: user?.id,
      });
      logger.error('Error handling cache clear', error as Error);
    }
  };

  // Handle old cache clearing with validation
  const handleClearOldCache = async () => {
    try {
      // Log old cache clear attempt
      SentryLogger.info('User initiated old cache clear', {
        user_id: user?.id,
        cache_size_before: cacheStats?.estimatedSize || 0,
        cache_entries_before: cacheStats?.totalEntries || 0,
        cache_type: 'old_items_only',
        cutoff_hours: 24,
      });

      Alert.alert('Clear Old Cache', 'Clear cached images older than 24 hours?', [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            SentryDataCollection.addBreadcrumb({
              message: 'User cancelled old cache clear',
              category: 'user-action',
              level: 'info',
            });
          },
        },
        {
          text: 'Clear Old Items',
          onPress: async () => {
            setClearingCache(true);
            try {
              // 24 hours in milliseconds = 86400000
              const result = await clearImageCache({ olderThan: 86400000 });
              setClearingCache(false);
              updateCacheStats();

              // Log successful old cache clear
              SentryLogger.info('Old cache cleared successfully', {
                user_id: user?.id,
                cleared_count: result.memoryClearedCount,
                cache_size_before: cacheStats?.estimatedSize || 0,
                operation_type: 'old_items_clear',
                cutoff_hours: 24,
              });

              Alert.alert(
                'Old Cache Cleared',
                `Successfully cleared ${result.memoryClearedCount} old cached images.`,
                [{ text: 'OK' }],
              );

              logger.info('Old cache cleared successfully', {
                context: { clearedCount: result.memoryClearedCount },
              });
            } catch (error) {
              SentryDataCollection.captureException(error as Error, {
                context: 'clear_old_cache_operation',
                user_id: user?.id,
                operation_type: 'old_items_clear',
                cutoff_hours: 24,
              });
              logger.error('Error clearing old cache', error as Error);
              setClearingCache(false);
              Alert.alert('Error', 'Failed to clear old cache');
            }
          },
        },
      ]);
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'handle_clear_old_cache',
        user_id: user?.id,
      });
      logger.error('Error handling old cache clear', error as Error);
    }
  };

  const renderMenuItem = (
    icon: string,
    title: string,
    rightElement?: React.ReactNode,
    isLast?: boolean,
    onPress?: () => void,
  ) => (
    <View>
      <Pressable
        style={styles.menuItem}
        onPress={() => {
          try {
            // Log menu item interaction
            SentryDataCollection.addBreadcrumb({
              message: `User tapped menu item: ${title}`,
              category: 'user-interaction',
              level: 'info',
              data: {
                menu_item: title,
                has_action: !!onPress,
                user_id: user?.id,
              },
            });

            if (onPress) {
              onPress();
            }
          } catch (error) {
            SentryDataCollection.captureException(error as Error, {
              context: 'menu_item_press',
              user_id: user?.id,
              menu_item: title,
            });
            logger.error('Error handling menu item press', error as Error);
          }
        }}
      >
        <View style={styles.menuItemLeft}>
          <MaterialCommunityIcons
            name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={24}
            color={COLORS.text}
            style={styles.menuIcon}
          />
          <Text variant="bodyLarge" style={styles.menuText}>
            {title}
          </Text>
        </View>
        {rightElement ||
          (onPress && title !== 'Workout Days' ? (
            <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.text} />
          ) : null)}
      </Pressable>
      {!isLast && (
        <LinearGradient
          colors={[
            'transparent',
            'rgba(108, 71, 255, 0.3)',
            'rgba(108, 71, 255, 0.3)',
            'rgba(108, 71, 255, 0.3)',
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          locations={[0, 0.1, 0.5, 0.9, 1]}
          style={styles.menuItemBorder}
        />
      )}
    </View>
  );

  const safeGoBack = () => {
    try {
      SentryDataCollection.addBreadcrumb({
        message: 'User navigated back from settings',
        category: 'navigation',
        level: 'info',
        data: {
          from_screen: 'settings',
          to_screen: 'profile',
        },
      });

      router.push('/(tabs)/profile');
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'settings_navigation_back',
        user_id: user?.id,
      });
      logger.error('Error navigating back from settings', error as Error);
    }
  };

  const handleOpenWorkoutDaysModal = () => {
    try {
      SentryDataCollection.addBreadcrumb({
        message: 'User opened workout days modal',
        category: 'user-interaction',
        level: 'info',
        data: {
          modal_type: 'workout_days',
          user_id: user?.id,
        },
      });

      setWorkoutDaysModalVisible(true);
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        context: 'open_workout_days_modal',
        user_id: user?.id,
      });
      logger.error('Error opening workout days modal', error as Error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { marginTop: insets.top }]}>
        <View style={styles.headerLeft}>
          <IconButton
            icon="arrow-left"
            size={28}
            onPress={safeGoBack}
            iconColor={COLORS.text}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Settings</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Display validation errors */}
        {Object.keys(validationErrors).length > 0 && (
          <View style={styles.errorContainer}>
            {Object.entries(validationErrors).map(([field, error]) => (
              <Text key={field} style={styles.errorText}>
                {error}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.section}>
          {renderMenuItem(
            'bell-outline',
            'Notifications',
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              color={COLORS.primary}
              disabled={isLoading}
            />,
          )}
          {renderMenuItem(
            'clock-outline',
            'Workout Reminders',
            <Switch
              value={workoutReminders}
              onValueChange={handleWorkoutRemindersToggle}
              color={COLORS.primary}
              disabled={isLoading}
            />,
          )}
          {renderMenuItem(
            'calendar-check-outline',
            'Workout Days',
            undefined,
            false,
            handleOpenWorkoutDaysModal,
          )}
          {renderMenuItem('shield-outline', 'Security')}
          {renderMenuItem('watch', 'Apple Watch')}
          {renderMenuItem('heart', 'Apple Health')}
          {renderMenuItem('ruler', 'Units of Measure')}
          {renderMenuItem(
            'volume-high',
            'Smart Weight & Reps Sounds',
            <Switch
              value={soundEnabled}
              onValueChange={handleSoundToggle}
              color={COLORS.primary}
              disabled={isLoading}
            />,
          )}
          {renderMenuItem(
            'theme-light-dark',
            'Dark Theme',
            <Switch
              value={isDarkTheme}
              onValueChange={handleThemeToggle}
              color={COLORS.primary}
              disabled={isLoading}
            />,
          )}
        </View>

        <View style={[styles.section, styles.sectionMargin]}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="cached" size={20} color={COLORS.primary} />
            <Text style={styles.sectionHeaderText}>Cache Management</Text>
          </View>

          {cacheStats && (
            <View style={styles.cacheSummary}>
              <View style={styles.cacheStatRow}>
                <Text style={styles.cacheStatLabel}>Cached Images:</Text>
                <Text style={styles.cacheStatValue}>{cacheStats.totalEntries}</Text>
              </View>
              <View style={styles.cacheStatRow}>
                <Text style={styles.cacheStatLabel}>Cache Size:</Text>
                <Text style={styles.cacheStatValue}>{formatBytes(cacheStats.estimatedSize)}</Text>
              </View>
              <View style={styles.cacheStatRow}>
                <Text style={styles.cacheStatLabel}>Newest Image:</Text>
                <Text style={styles.cacheStatValue}>
                  {formatRelativeTime(cacheStats.newestEntry)}
                </Text>
              </View>
              <View style={styles.cacheStatRow}>
                <Text style={styles.cacheStatLabel}>Oldest Image:</Text>
                <Text style={styles.cacheStatValue}>
                  {formatRelativeTime(cacheStats.oldestEntry)}
                </Text>
              </View>
              <View style={styles.cacheStatRow}>
                <Text style={styles.cacheStatLabel}>Cache Hit Rate:</Text>
                <Text style={styles.cacheStatValue}>
                  {cacheStats.hitCount + cacheStats.missCount > 0
                    ? `${Math.round((cacheStats.hitCount / (cacheStats.hitCount + cacheStats.missCount)) * 100)}%`
                    : 'N/A'}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.cacheActions}>
            <Button
              mode="contained"
              onPress={handleClearOldCache}
              style={styles.cacheButton}
              disabled={clearingCache || !cacheStats || cacheStats.totalEntries === 0}
            >
              {clearingCache ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                'Clear Old Cache'
              )}
            </Button>

            <Button
              mode="contained"
              onPress={handleClearCache}
              style={[styles.cacheButton, styles.clearAllButton]}
              buttonColor={COLORS.error}
              disabled={clearingCache || !cacheStats || cacheStats.totalEntries === 0}
            >
              {clearingCache ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                'Clear All Cache'
              )}
            </Button>
          </View>
        </View>
      </ScrollView>

      <WorkoutDaysModal
        visible={workoutDaysModalVisible}
        onClose={() => {
          try {
            SentryDataCollection.addBreadcrumb({
              message: 'User closed workout days modal',
              category: 'user-interaction',
              level: 'info',
              data: {
                modal_type: 'workout_days',
                user_id: user?.id,
              },
            });

            setWorkoutDaysModalVisible(false);
          } catch (error) {
            SentryDataCollection.captureException(error as Error, {
              context: 'close_workout_days_modal',
              user_id: user?.id,
            });
            logger.error('Error closing workout days modal', error as Error);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    height: 56,
    backgroundColor: COLORS.background,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.primary,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
  },
  backButton: {
    margin: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl * 2,
  },
  section: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#6c47ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#6c47ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  sectionMargin: {
    marginTop: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(108, 71, 255, 0.3)',
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 16,
  },
  menuText: {
    color: COLORS.text,
    fontSize: 16,
  },
  menuItemBorder: {
    height: 1,
    marginHorizontal: 8,
  },
  cacheSummary: {
    padding: 16,
  },
  cacheStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  cacheStatLabel: {
    color: COLORS.text,
    fontSize: 14,
  },
  cacheStatValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  cacheActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  cacheButton: {
    flex: 1,
    marginHorizontal: 6,
  },
  clearAllButton: { backgroundColor: COLORS.error },
  errorContainer: {
    padding: 16,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: COLORS.text,
    fontSize: 14,
  },
});
