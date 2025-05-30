import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

interface Metrics {
  totalWorkouts: number;
  streak: number;
  personalRecords: any[];
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

export const GamificationProvider: React.FC<{ children: React.ReactNode; metrics: Metrics }> = ({ children, metrics }) => {
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
      const storedStats = await AsyncStorage.getItem('gamificationStats');
      if (storedStats) {
        setStats(JSON.parse(storedStats));
      }
    } catch (error) {
      console.error('Error loading gamification stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateNextLevelXp = (level: number) => {
    return Math.floor(XP_PER_LEVEL * Math.pow(XP_MULTIPLIER, level - 1));
  };

  const addXp = async (amount: number) => {
    try {
      const newTotalXp = stats.totalXp + amount;
      let newLevel = stats.level;
      let newXp = stats.xp + amount;
      let newNextLevelXp = stats.nextLevelXp;

      while (newXp >= newNextLevelXp) {
        newLevel++;
        newXp -= newNextLevelXp;
        newNextLevelXp = calculateNextLevelXp(newLevel);
      }

      const updatedStats = {
        ...stats,
        level: newLevel,
        xp: newXp,
        totalXp: newTotalXp,
        nextLevelXp: newNextLevelXp,
      };

      await AsyncStorage.setItem('gamificationStats', JSON.stringify(updatedStats));
      setStats(updatedStats);
    } catch (error) {
      console.error('Error adding XP:', error);
    }
  };

  const checkAchievements = async () => {
    try {
      const updatedAchievements = stats.achievements.map(achievement => {
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
          addXp(achievement.xp);
        }

        return {
          ...achievement,
          progress,
          completed,
          completedAt: completed && !achievement.completedAt ? new Date().toISOString() : achievement.completedAt,
        };
      });

      const updatedStats = {
        ...stats,
        achievements: updatedAchievements,
      };

      await AsyncStorage.setItem('gamificationStats', JSON.stringify(updatedStats));
      setStats(updatedStats);
    } catch (error) {
      console.error('Error checking achievements:', error);
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