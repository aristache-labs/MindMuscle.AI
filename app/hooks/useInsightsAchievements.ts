import { useState, useEffect } from 'react';
import { useAuth } from '../store/AuthContext';
import { achievementService, Achievement, UserAchievement } from '../services/achievements';

export const useInsightsAchievements = () => {
  const { user } = useAuth();
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [completedAchievements, setCompletedAchievements] = useState<UserAchievement[]>([]);
  const [randomAchievements, setRandomAchievements] = useState<Achievement[]>([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);

  const loadAchievements = async () => {
    if (!user?.id) return;

    try {
      setAchievementsLoading(true);
      const completed = await achievementService.getUserCompletedAchievements(user.id);
      setCompletedAchievements(completed.slice(0, 3));

      const completedCount = completed.length;
      const randomCount = Math.max(0, 3 - completedCount);

      if (randomCount > 0) {
        const random = await achievementService.getRandomAchievements(user.id, randomCount);
        setRandomAchievements(random);
      } else {
        setRandomAchievements([]);
      }
    } catch (error) {
      console.error('Error loading achievements:', error);
    } finally {
      setAchievementsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadAchievements();
    }
  }, [user?.id]);

  const handleAchievementPress = (achievement: UserAchievement) => {
    setSelectedAchievement(achievement.achievement || null);
  };

  const handleRandomAchievementPress = (achievement: Achievement) => {
    setSelectedAchievement(achievement);
  };

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
