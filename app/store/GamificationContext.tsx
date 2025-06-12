import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { logger } from '../utils/logger';
import { validationService } from '../services/validationService';
import { setUser, setContext, setTag } from '../services/sentry';
import {
  captureError,
  captureMessage as sentryMessage,
  addBreadcrumb,
} from '../services/sentry/simpleErrorHandler';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  xp: number;
  completed: boolean;
  completedAt?: string;
  progress: number;
  target: number;
  type: 'workouts' | 'exercises' | 'streak' | 'personalRecords' | 'duration';
}

interface UserStats {
  level: number;
  xp: number;
  totalXp: number;
  nextLevelXp: number;
  achievements: Achievement[];
}

interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  value: number;
  unit: string; // e.g., 'kg', 'lbs', 'reps'
  date: string;
  previousValue?: number;
}

interface Metrics {
  totalWorkouts: number;
  streak: number;
  personalRecords: PersonalRecord[];
  averageWorkoutDuration: number;
}

interface GamificationContextType {
  stats: UserStats;
  addXp: (amount: number) => Promise<void>;
  checkAchievements: () => Promise<void>;
  loading: boolean;
}

const defaultStats: UserStats = {
  level: 1,
  xp: 0,
  totalXp: 0,
  nextLevelXp: 100,
  achievements: [
    {
      id: 'first_workout',
      title: 'First Workout',
      description: 'Complete your first workout',
      icon: 'trophy',
      xp: 50,
      completed: false,
      progress: 0,
      target: 1,
      type: 'workouts',
    },
    {
      id: 'workout_streak_3',
      title: '3 Day Streak',
      description: 'Workout for 3 days in a row',
      icon: 'fire',
      xp: 100,
      completed: false,
      progress: 0,
      target: 3,
      type: 'streak',
    },
    {
      id: 'workout_streak_7',
      title: '7 Day Streak',
      description: 'Workout for 7 days in a row',
      icon: 'fire',
      xp: 250,
      completed: false,
      progress: 0,
      target: 7,
      type: 'streak',
    },
    {
      id: 'personal_record',
      title: 'Personal Record',
      description: 'Set a new personal record',
      icon: 'medal',
      xp: 75,
      completed: false,
      progress: 0,
      target: 1,
      type: 'personalRecords',
    },
    {
      id: 'workout_marathon',
      title: 'Workout Marathon',
      description: 'Complete a 60-minute workout',
      icon: 'run',
      xp: 150,
      completed: false,
      progress: 0,
      target: 60,
      type: 'duration',
    },
  ],
};

const XP_PER_LEVEL = 100;
const XP_MULTIPLIER = 1.5;

const GamificationContext = createContext<GamificationContextType>({
  stats: defaultStats,
  addXp: async () => {},
  checkAchievements: async () => {},
  loading: true,
});

export const GamificationProvider: React.FC<{ children: React.ReactNode; metrics: Metrics }> = ({
  children,
  metrics,
}) => {
  const [stats, setStats] = useState<UserStats>(defaultStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    checkAchievements();
  }, [metrics]);

  const loadStats = async () => {
    try {
      addBreadcrumb('Loading gamification stats from storage', 'gamification');

      const storedStats = await AsyncStorage.getItem('gamificationStats');

      if (storedStats) {
        addBreadcrumb('Found stored gamification stats', 'gamification');

        // Validate the stored stats data using Zod
        const validationResult = await validationService.validateUserStats(JSON.parse(storedStats));

        if (validationResult.success) {
          const validatedStats = validationResult.data as UserStats;
          setStats(validatedStats);

          addBreadcrumb('Successfully loaded and validated gamification stats', 'gamification');

          // Set user context for Sentry
          setUser({
            id: `gamification_user_${validatedStats.level}`,
            level: validatedStats.level.toString(),
            totalXp: validatedStats.totalXp.toString(),
          });

          setTag('gamification.stats_loaded', 'success');
          setContext('gamification_stats', {
            user_level: validatedStats.level,
            total_xp: validatedStats.totalXp,
            achievements_count: validatedStats.achievements.length,
          });
        } else {
          logger.warn('Invalid gamification stats found in storage, using default stats', {
            context: { errors: validationResult.errors },
          });

          addBreadcrumb('Invalid gamification stats found, using defaults', 'gamification');

          sentryMessage('Invalid gamification stats in storage', 'warning');

          setStats(defaultStats);
          // Store the default stats to fix the corrupted data
          await AsyncStorage.setItem('gamificationStats', JSON.stringify(defaultStats));

          setTag('gamification.stats_loaded', 'validation_failed');
        }
      } else {
        addBreadcrumb('No stored gamification stats found, using defaults', 'gamification');
        setTag('gamification.stats_loaded', 'no_stored_data');
      }
    } catch (error) {
      const sentryError = error as Error;
      logger.error('Error loading gamification stats', sentryError);

      addBreadcrumb('Error loading gamification stats', 'gamification');

      captureError(sentryError);

      setStats(defaultStats);

      // Try to store default stats
      try {
        await AsyncStorage.setItem('gamificationStats', JSON.stringify(defaultStats));

        addBreadcrumb('Successfully stored default gamification stats after error', 'gamification');
      } catch (storeError) {
        const sentryStoreError = storeError as Error;
        logger.error('Error storing default gamification stats', sentryStoreError);

        captureError(sentryStoreError);
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateNextLevelXp = (level: number) => {
    return Math.floor(XP_PER_LEVEL * Math.pow(XP_MULTIPLIER, level - 1));
  };

  const addXp = async (amount: number) => {
    try {
      addBreadcrumb('Adding XP to user stats', 'gamification');

      const newTotalXp = stats.totalXp + amount;
      let newLevel = stats.level;
      let newXp = stats.xp + amount;
      let newNextLevelXp = stats.nextLevelXp;
      let levelsGained = 0;

      while (newXp >= newNextLevelXp) {
        newLevel++;
        levelsGained++;
        newXp -= newNextLevelXp;
        newNextLevelXp = calculateNextLevelXp(newLevel);
      }

      if (levelsGained > 0) {
        addBreadcrumb('User leveled up!', 'gamification');
      }

      const updatedStats = {
        ...stats,
        level: newLevel,
        xp: newXp,
        totalXp: newTotalXp,
        nextLevelXp: newNextLevelXp,
      };

      // Validate the updated stats before storing
      const validationResult = await validationService.validateUserStats(updatedStats);

      if (!validationResult.success) {
        const errorMessage = `Invalid stats data: ${validationResult.errors.map((e) => e.message).join(', ')}`;
        const validationError = new Error(errorMessage);

        logger.error('Cannot update stats with invalid data', validationError, {
          context: { updatedStats, errors: validationResult.errors },
        });

        addBreadcrumb('Stats validation failed during XP addition', 'gamification');

        captureError(validationError);
        throw validationError;
      }

      const validatedStats = validationResult.data as UserStats;
      await AsyncStorage.setItem('gamificationStats', JSON.stringify(validatedStats));
      setStats(validatedStats);

      addBreadcrumb('Successfully added XP and updated stats', 'gamification');

      // Update user context
      setUser({
        id: `gamification_user_${validatedStats.level}`,
        level: validatedStats.level.toString(),
        totalXp: validatedStats.totalXp.toString(),
      });

      setTag('gamification.xp_added', 'success');
      setContext('gamification_xp_update', {
        xp_amount: amount,
        levels_gained: levelsGained,
        new_level: validatedStats.level,
      });
    } catch (error) {
      const sentryError = error as Error;
      logger.error('Error adding XP', sentryError, {
        context: { amount, currentStats: stats },
      });

      addBreadcrumb('Error adding XP to user stats', 'gamification');

      captureError(sentryError);
    }
  };

  const checkAchievements = async () => {
    try {
      addBreadcrumb('Checking achievements progress', 'gamification');

      let newAchievementsUnlocked = 0;
      let totalXpEarned = 0;

      const updatedAchievements = stats.achievements.map((achievement) => {
        let progress = 0;
        let completed = achievement.completed;

        switch (achievement.type) {
          case 'workouts':
            progress = metrics.totalWorkouts;
            break;
          case 'streak':
            progress = metrics.streak;
            break;
          case 'personalRecords':
            progress = metrics.personalRecords.length;
            break;
          case 'duration':
            progress = metrics.averageWorkoutDuration;
            break;
        }

        if (!completed && progress >= achievement.target) {
          completed = true;
          newAchievementsUnlocked++;
          totalXpEarned += achievement.xp;

          addBreadcrumb('Achievement unlocked!', 'achievement');

          addXp(achievement.xp);
        }

        return {
          ...achievement,
          progress,
          completed,
          completedAt:
            completed && !achievement.completedAt
              ? new Date().toISOString()
              : achievement.completedAt,
        };
      });

      if (newAchievementsUnlocked > 0) {
        addBreadcrumb('Multiple achievements unlocked', 'achievement');
      }

      const updatedStats = {
        ...stats,
        achievements: updatedAchievements,
      };

      // Validate the updated stats before storing
      const validationResult = await validationService.validateUserStats(updatedStats);

      if (!validationResult.success) {
        logger.warn('Invalid achievement stats, skipping update', {
          context: { errors: validationResult.errors },
        });

        addBreadcrumb('Achievement stats validation failed', 'gamification');

        sentryMessage('Invalid achievement stats during update', 'warning');
        return;
      }

      const validatedStats = validationResult.data as UserStats;
      await AsyncStorage.setItem('gamificationStats', JSON.stringify(validatedStats));
      setStats(validatedStats);

      addBreadcrumb('Successfully updated achievement progress', 'gamification');

      setTag('gamification.achievements_updated', 'success');
      setContext('gamification_achievements', {
        new_achievements_unlocked: newAchievementsUnlocked,
        total_xp_earned: totalXpEarned,
        total_achievements: validatedStats.achievements.length,
        completed_achievements: validatedStats.achievements.filter((a: Achievement) => a.completed)
          .length,
      });
    } catch (error) {
      const sentryError = error as Error;
      logger.error('Error checking achievements', sentryError, {
        context: { metrics },
      });

      addBreadcrumb('Error checking achievements', 'gamification');

      captureError(sentryError);
    }
  };

  return (
    <GamificationContext.Provider
      value={{
        stats,
        addXp,
        checkAchievements,
        loading,
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
};

export const useGamification = () => useContext(GamificationContext);

export default GamificationProvider;
