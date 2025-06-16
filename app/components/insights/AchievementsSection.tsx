import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Surface, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { Achievement, UserAchievement } from '../../services/achievements';
import { COLORS } from '../../constants/theme';
import * as Sentry from '@sentry/react-native';
import { captureUIError, captureNavigationError, SentryReactProfiler } from '../../services/sentry';

interface AchievementsSectionProps {
  achievementsLoading: boolean;
  completedAchievements: UserAchievement[];
  randomAchievements: Achievement[];
  onAchievementPress: (achievement: UserAchievement) => void;
  onRandomAchievementPress: (achievement: Achievement) => void;
}

const AchievementsSectionComponent: React.FC<AchievementsSectionProps> = ({
  achievementsLoading,
  completedAchievements,
  randomAchievements,
  onAchievementPress,
  onRandomAchievementPress,
}) => {
  // Track component lifecycle and data state
  useEffect(() => {
    // Track component mount and data loading state
    Sentry.addBreadcrumb({
      message: 'Achievements Section Rendered',
      category: 'ui.render',
      level: 'info',
      data: {
        isLoading: achievementsLoading,
        completedCount: completedAchievements.length,
        randomCount: randomAchievements.length,
        timestamp: new Date().toISOString(),
      },
    });

    // Track component lifecycle
    SentryReactProfiler.trackComponentLifecycle('AchievementsSection', 'mount');

    return () => {
      SentryReactProfiler.trackComponentLifecycle('AchievementsSection', 'unmount');
    };
  }, []);

  // Track loading state changes
  useEffect(() => {
    if (
      !achievementsLoading &&
      (completedAchievements.length > 0 || randomAchievements.length > 0)
    ) {
      Sentry.addBreadcrumb({
        message: 'Achievements Data Loaded Successfully',
        category: 'api.success',
        level: 'info',
        data: {
          completedAchievements: completedAchievements.length,
          randomAchievements: randomAchievements.length,
          hasData: completedAchievements.length > 0 || randomAchievements.length > 0,
        },
      });
    }
  }, [achievementsLoading, completedAchievements.length, randomAchievements.length]);

  const handleNavigateToAchievements = () => {
    try {
      // Track navigation attempt
      Sentry.addBreadcrumb({
        message: 'Navigating to Achievements Page',
        category: 'user.interaction',
        level: 'info',
        data: {
          trigger: 'more_button_press',
          currentAchievements: completedAchievements.length,
          timestamp: new Date().toISOString(),
        },
      });

      router.push('/achievements');

      // Track successful navigation
      Sentry.addBreadcrumb({
        message: 'Successfully Navigated to Achievements',
        category: 'navigation',
        level: 'info',
      });
    } catch (error) {
      // Capture navigation errors
      captureNavigationError(error as Error, '/achievements', 'achievements-section-more-button');

      Sentry.addBreadcrumb({
        message: 'Failed to Navigate to Achievements',
        category: 'navigation.error',
        level: 'error',
        data: {
          error: (error as Error).message,
          route: '/achievements',
        },
      });

      console.error('Navigation error:', error);
    }
  };

  const handleAchievementPress = (userAchievement: UserAchievement) => {
    try {
      // Track user interaction with completed achievement
      Sentry.addBreadcrumb({
        message: 'Completed Achievement Pressed',
        category: 'user.interaction',
        level: 'info',
        data: {
          achievementId: userAchievement.id,
          achievementTitle: userAchievement.achievement?.title,
          completedAt: userAchievement.completed_at,
          hasIcon: !!userAchievement.achievement?.icon,
          timestamp: new Date().toISOString(),
        },
      });

      onAchievementPress(userAchievement);

      // Track successful achievement interaction
      Sentry.addBreadcrumb({
        message: 'Achievement Interaction Successful',
        category: 'user.success',
        level: 'info',
        data: {
          achievementId: userAchievement.id,
          type: 'completed',
        },
      });
    } catch (error) {
      // Capture achievement interaction errors
      captureUIError(
        error as Error,
        'AchievementsSection.handleAchievementPress',
        'insights-achievements',
      );

      Sentry.addBreadcrumb({
        message: 'Achievement Press Handler Failed',
        category: 'user.error',
        level: 'error',
        data: {
          error: (error as Error).message,
          achievementId: userAchievement.id,
          achievementTitle: userAchievement.achievement?.title,
        },
      });

      console.error('Achievement press error:', error);
    }
  };

  const handleRandomAchievementPress = (achievement: Achievement) => {
    try {
      // Track user interaction with locked achievement
      Sentry.addBreadcrumb({
        message: 'Locked Achievement Pressed',
        category: 'user.interaction',
        level: 'info',
        data: {
          achievementId: achievement.id,
          achievementTitle: achievement.title,
          achievementDescription: achievement.description,
          hasIcon: !!achievement.icon,
          timestamp: new Date().toISOString(),
        },
      });

      onRandomAchievementPress(achievement);

      // Track successful locked achievement interaction
      Sentry.addBreadcrumb({
        message: 'Locked Achievement Interaction Successful',
        category: 'user.success',
        level: 'info',
        data: {
          achievementId: achievement.id,
          type: 'locked',
        },
      });
    } catch (error) {
      // Capture random achievement interaction errors
      captureUIError(
        error as Error,
        'AchievementsSection.handleRandomAchievementPress',
        'insights-achievements',
      );

      Sentry.addBreadcrumb({
        message: 'Random Achievement Press Handler Failed',
        category: 'user.error',
        level: 'error',
        data: {
          error: (error as Error).message,
          achievementId: achievement.id,
          achievementTitle: achievement.title,
        },
      });

      console.error('Random achievement press error:', error);
    }
  };

  const formatAchievementDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      // Capture date formatting errors
      Sentry.addBreadcrumb({
        message: 'Achievement Date Formatting Error',
        category: 'ui.error',
        level: 'error',
        data: {
          originalDate: dateString,
          error: (error as Error).message,
        },
      });

      console.error('Date formatting error:', error);
      return 'Invalid date';
    }
  };

  return (
    <Surface style={styles.achievementsContainer} elevation={2}>
      <View style={styles.sectionHeader}>
        <View style={styles.headerSide} />
        <View style={styles.titleContainer}>
          <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
        </View>
        <View style={styles.headerSide}>
          <Button
            mode="text"
            textColor="#6B4EFF"
            style={styles.moreButton}
            labelStyle={styles.moreButtonLabel}
            onPress={handleNavigateToAchievements}
          >
            More
          </Button>
        </View>
      </View>
      <View style={styles.achievementsGrid}>
        {achievementsLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : completedAchievements.length > 0 || randomAchievements.length > 0 ? (
          <>
            {completedAchievements.map((userAchievement) => (
              <Pressable
                key={userAchievement.id}
                style={styles.achievementCard}
                onPress={() => handleAchievementPress(userAchievement)}
              >
                <View style={styles.achievementContent}>
                  <View style={styles.achievementIconContainer}>
                    <IconButton
                      icon={userAchievement.achievement?.icon || 'trophy'}
                      size={24}
                      iconColor="#f9e009"
                    />
                  </View>
                  <Text style={styles.achievementLabel}>{userAchievement.achievement?.title}</Text>
                  {userAchievement.completed_at && (
                    <Text style={styles.achievementDate}>
                      {formatAchievementDate(userAchievement.completed_at)}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
            {randomAchievements.map((achievement) => (
              <Pressable
                key={achievement.id}
                style={[styles.achievementCard, styles.achievementLocked]}
                onPress={() => handleRandomAchievementPress(achievement)}
              >
                <View style={styles.achievementContent}>
                  <View style={[styles.achievementIconContainer, styles.achievementIconLocked]}>
                    <IconButton icon={achievement.icon || 'trophy'} size={24} iconColor="#666" />
                  </View>
                  <Text style={[styles.achievementLabel, styles.achievementTextLocked]}>
                    {achievement.title}
                  </Text>
                  <Text style={[styles.achievementDate, styles.achievementTextLocked]}>
                    Not completed yet
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : (
          <Text style={styles.noAchievementsText}>No achievements completed yet</Text>
        )}
      </View>
    </Surface>
  );
};

// Export the component wrapped with Sentry profiler
export const AchievementsSection = SentryReactProfiler.withProfiler(
  AchievementsSectionComponent as React.ComponentType<unknown>,
  'AchievementsSection',
) as React.FC<AchievementsSectionProps>;

const styles = StyleSheet.create({
  achievementsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(108, 71, 255, 0.3)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerSide: {
    flex: 1,
  },
  titleContainer: {
    flex: 2,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  moreButton: {
    margin: 0,
    padding: 0,
  },
  moreButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  achievementCard: {
    width: '30%',
    backgroundColor: 'rgba(108, 71, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  achievementLocked: {
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  achievementContent: {
    alignItems: 'center',
  },
  achievementIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(249, 224, 9, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  achievementIconLocked: {
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  achievementLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  achievementTextLocked: {
    color: '#666',
  },
  achievementDate: {
    fontSize: 8,
    color: COLORS.text,
    opacity: 0.7,
    textAlign: 'center',
  },
  noAchievementsText: {
    fontSize: 14,
    color: COLORS.text,
    opacity: 0.7,
    textAlign: 'center',
    width: '100%',
    paddingVertical: 20,
  },
});
export default function AchievementsSectionProps() {
  return null;
}
