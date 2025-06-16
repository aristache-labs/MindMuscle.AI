import { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { achievementService, Achievement, UserAchievement } from '../services/achievements';
import { useSentryDataCollection } from './useSentryDataCollection';

export const useInsightsAchievements = () => {
  const { user } = useAuth();
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [completedAchievements, setCompletedAchievements] = useState<UserAchievement[]>([]);
  const [randomAchievements, setRandomAchievements] = useState<Achievement[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);

  const sentry = useSentryDataCollection({
    componentName: 'useInsightsAchievements',
    autoSetUser: false,
  });

  const loadAchievements = async () => {
    if (!user?.id) {
      sentry.addBreadcrumb({
        message: 'Achievement loading skipped - no user ID',
        category: 'achievements',
        level: 'debug',
      });
      return;
    }

    const startTime = Date.now();

    try {
      setAchievementsLoading(true);

      sentry.addBreadcrumb({
        message: 'Loading user achievements',
        category: 'achievements',
        level: 'info',
        data: { userId: user.id },
      });

      sentry.setContext('achievement_loading', {
        userId: user.id,
        timestamp: new Date().toISOString(),
        status: 'loading',
      });

      const completed = await achievementService.getUserCompletedAchievements(user.id);
      const completedSlice = completed.slice(0, 3);
      setCompletedAchievements(completedSlice);

      const completedCount = completed.length;
      const randomCount = Math.max(0, 3 - completedCount);

      sentry.addBreadcrumb({
        message: 'Completed achievements loaded',
        category: 'achievements',
        level: 'info',
        data: {
          totalCompleted: completedCount,
          displayedCompleted: completedSlice.length,
          randomNeeded: randomCount,
        },
      });

      if (randomCount > 0) {
        sentry.addBreadcrumb({
          message: 'Loading random achievements',
          category: 'achievements',
          level: 'debug',
          data: { randomCount },
        });

        const random = await achievementService.getRandomAchievements(user.id, randomCount);
        setRandomAchievements(random);

        sentry.addBreadcrumb({
          message: 'Random achievements loaded',
          category: 'achievements',
          level: 'info',
          data: { randomCount: random.length },
        });
      } else {
        setRandomAchievements([]);

        sentry.addBreadcrumb({
          message: 'No random achievements needed',
          category: 'achievements',
          level: 'debug',
        });
      }

      const duration = Date.now() - startTime;

      sentry.trackPerformance('achievements_loading_duration', duration, 'ms');

      sentry.setContext('achievement_loading', {
        userId: user.id,
        timestamp: new Date().toISOString(),
        status: 'completed',
        duration,
        completedCount,
        randomCount: randomCount > 0 ? randomAchievements.length : 0,
      });

      sentry.addBreadcrumb({
        message: 'Achievement loading completed successfully',
        category: 'achievements',
        level: 'info',
        data: {
          duration,
          totalCompleted: completedCount,
          displayedCompleted: completedSlice.length,
          randomLoaded: randomCount > 0 ? randomAchievements.length : 0,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      sentry.captureException(error as Error, {
        achievement_loading_failed: true,
        userId: user.id,
        duration,
      });

      sentry.setContext('achievement_loading', {
        userId: user.id,
        timestamp: new Date().toISOString(),
        status: 'failed',
        duration,
        error: (error as Error).message,
      });

      sentry.addBreadcrumb({
        message: 'Achievement loading failed',
        category: 'achievements',
        level: 'error',
        data: {
          error: (error as Error).message,
          duration,
          userId: user.id,
        },
      });

      console.error('Error loading achievements:', error);
    } finally {
      setAchievementsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      sentry.addBreadcrumb({
        message: 'User authenticated, triggering achievement load',
        category: 'achievements',
        level: 'info',
        data: { userId: user.id },
      });

      loadAchievements();
    } else {
      sentry.addBreadcrumb({
        message: 'No authenticated user, skipping achievement load',
        category: 'achievements',
        level: 'debug',
      });
    }
  }, [user?.id]);

  const handleAchievementPress = (achievement: UserAchievement) => {
    try {
      sentry.trackUserAction('achievement_pressed', {
        achievementId: achievement.achievement?.id,
        achievementTitle: (achievement.achievement as Achievement & { title?: string })?.title,
        isCompleted: true,
      });

      sentry.addBreadcrumb({
        message: 'User pressed completed achievement',
        category: 'user-interaction',
        level: 'info',
        data: {
          achievementId: achievement.achievement?.id,
          achievementTitle: (achievement.achievement as Achievement & { title?: string })?.title,
        },
      });

      setSelectedAchievement(achievement.achievement || null);
    } catch (error) {
      sentry.captureException(error as Error, {
        achievement_press_failed: true,
        achievementId: achievement.achievement?.id,
      });
    }
  };

  const handleRandomAchievementPress = (achievement: Achievement) => {
    try {
      sentry.trackUserAction('random_achievement_pressed', {
        achievementId: achievement.id,
        achievementTitle: (achievement as Achievement & { title?: string }).title,
        isCompleted: false,
      });

      sentry.addBreadcrumb({
        message: 'User pressed random achievement',
        category: 'user-interaction',
        level: 'info',
        data: {
          achievementId: achievement.id,
          achievementTitle: (achievement as Achievement & { title?: string }).title,
        },
      });

      setSelectedAchievement(achievement);
    } catch (error) {
      sentry.captureException(error as Error, {
        random_achievement_press_failed: true,
        achievementId: achievement.id,
      });
    }
  };

  // Track achievement selection changes
  useEffect(() => {
    if (selectedAchievement) {
      sentry.setContext('selected_achievement', {
        id: selectedAchievement.id,
        title: (selectedAchievement as Achievement & { title?: string }).title,
        timestamp: new Date().toISOString(),
      });

      sentry.addBreadcrumb({
        message: 'Achievement selected for viewing',
        category: 'achievements',
        level: 'info',
        data: {
          achievementId: selectedAchievement.id,
          achievementTitle: (selectedAchievement as Achievement & { title?: string }).title,
        },
      });
    }
  }, [selectedAchievement, sentry]);

  // Track loading state changes
  useEffect(() => {
    sentry.setTag('achievements_loading', achievementsLoading.toString());

    if (!achievementsLoading) {
      sentry.addBreadcrumb({
        message: 'Achievement loading state changed to complete',
        category: 'achievements',
        level: 'debug',
        data: {
          completedCount: completedAchievements.length,
          randomCount: randomAchievements.length,
        },
      });
    }
  }, [achievementsLoading, completedAchievements.length, randomAchievements.length, sentry]);

  return {
    selectedAchievement,
    setSelectedAchievement,
    completedAchievements,
    randomAchievements,
    achievementsLoading,
    handleAchievementPress,
    handleRandomAchievementPress,
  };
};
export default function disablewarn() {
  return null;
}
