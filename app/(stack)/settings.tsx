import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Platform, Pressable, Alert } from 'react-native';
import { Text, IconButton, Switch, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { clearImageCache, getCacheStats, CacheStats } from '../utils/imagePreloader';
import WorkoutDaysModal from '../components/WorkoutDaysModal';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isDarkTheme, setIsDarkTheme] = React.useState(true);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [workoutDaysModalVisible, setWorkoutDaysModalVisible] = useState(false);

  // Fetch cache statistics when the component mounts
  useEffect(() => {
    updateCacheStats();
  }, []);

  // Update cache statistics
  const updateCacheStats = () => {
    const stats = getCacheStats();
    setCacheStats(stats);
  };

  // Format bytes to human-readable format
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Format timestamp to relative time
  const formatRelativeTime = (timestamp: number | null): string => {
    if (timestamp === null) return 'N/A';

    const now = Date.now();
    const diff = now - timestamp;

    // Convert to minutes, hours, or days
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return `${Math.floor(diff / 86400000)} days ago`;
  };

  // Handle clearing cache
  const handleClearCache = async () => {
    Alert.alert(
      'Clear Image Cache',
      'This will clear all cached images. The app may load more slowly until images are cached again.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
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

              Alert.alert(
                'Cache Cleared',
                `Successfully cleared ${result.memoryClearedCount} cached images.`,
                [{ text: 'OK' }],
              );
            } catch (error) {
              console.error('Error clearing cache:', error);
              setClearingCache(false);
              Alert.alert('Error', 'Failed to clear cache');
            }
          },
        },
      ],
    );
  };

  // Handle clearing old cache entries
  const handleClearOldCache = async () => {
    Alert.alert('Clear Old Cache', 'This will clear cached images older than 24 hours.', [
      {
        text: 'Cancel',
        style: 'cancel',
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

            Alert.alert(
              'Old Cache Cleared',
              `Successfully cleared ${result.memoryClearedCount} old cached images.`,
              [{ text: 'OK' }],
            );
          } catch (error) {
            console.error('Error clearing old cache:', error);
            setClearingCache(false);
            Alert.alert('Error', 'Failed to clear old cache');
          }
        },
      },
    ]);
  };

  const renderMenuItem = (
    icon: string,
    title: string,
    rightElement?: React.ReactNode,
    isLast?: boolean,
    onPress?: () => void,
  ) => (
    <View>
      <Pressable style={styles.menuItem} onPress={onPress}>
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
    router.push('/(tabs)/profile');
  };

  const handleOpenWorkoutDaysModal = () => {
    setWorkoutDaysModalVisible(true);
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
        <View style={styles.section}>
          {renderMenuItem('bell-outline', 'Notifications')}
          {renderMenuItem('clock-outline', 'Workout Reminders')}
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
          {renderMenuItem('volume-high', 'Smart Weight & Reps Sounds')}
          {renderMenuItem(
            'theme-light-dark',
            'Dark Theme',
            <Switch value={isDarkTheme} onValueChange={setIsDarkTheme} color={COLORS.primary} />,
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
        onClose={() => setWorkoutDaysModalVisible(false)}
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
});
