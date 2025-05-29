import supabase from './supabase';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  subtitle?: string;
  requirement: string;
  icon: string;
  icon_background_color?: string;
  total_progress?: number;
  created_at: string;
  updated_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  is_completed: boolean;
  completed_at?: string;
  current_progress: number;
  created_at: string;
  updated_at: string;
  achievement?: Achievement;
}

export const achievementService = {
  // Get all achievements
  async getAllAchievements(): Promise<Achievement[]> {
    const { data, error } = await supabase.from('achievements').select('*').order('created_at');

    if (error) throw error;
    return data;
  },

  // Get user's achievements
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    const { data, error } = await supabase
      .from('user_achievements')
      .select(
        `
        *,
        achievement:achievements(*)
      `,
      )
      .eq('user_id', userId)
      .order('created_at');

    if (error) throw error;
    return data;
  },

  // Get user's completed achievements
  async getUserCompletedAchievements(userId: string): Promise<UserAchievement[]> {
    const { data, error } = await supabase
      .from('user_achievements')
      .select(
        `
        *,
        achievement:achievements(*)
      `,
      )
      .eq('user_id', userId)
      .eq('is_completed', true)
      .order('completed_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Initialize achievements for a new user
  async initializeUserAchievements(userId: string): Promise<void> {
    const achievements = await this.getAllAchievements();

    const userAchievements = achievements.map((achievement) => ({
      user_id: userId,
      achievement_id: achievement.id,
      is_completed: false,
      current_progress: 0,
    }));

    const { error } = await supabase.from('user_achievements').insert(userAchievements);

    if (error) throw error;
  },

  // Update achievement progress
  async updateProgress(userId: string, achievementId: string, progress: number): Promise<void> {
    const { data: achievement } = await supabase
      .from('achievements')
      .select('total_progress')
      .eq('id', achievementId)
      .single();

    const isCompleted = achievement?.total_progress
      ? progress >= achievement.total_progress
      : false;

    const { error } = await supabase
      .from('user_achievements')
      .update({
        current_progress: progress,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('user_id', userId)
      .eq('achievement_id', achievementId);

    if (error) throw error;
  },

  // Complete an achievement directly
  async completeAchievement(userId: string, achievementId: string): Promise<void> {
    const { error } = await supabase
      .from('user_achievements')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('achievement_id', achievementId);

    if (error) throw error;
  },

  // Get random achievements that user hasn't completed
  async getRandomAchievements(userId: string, count: number): Promise<Achievement[]> {
    // First get all achievements
    const allAchievements = await this.getAllAchievements();

    // Then get user's achievements to filter out completed ones
    const userAchievements = await this.getUserAchievements(userId);
    const completedAchievementIds = new Set(
      userAchievements.filter((ua) => ua.is_completed).map((ua) => ua.achievement_id),
    );

    // Filter out completed achievements and shuffle
    const availableAchievements = allAchievements
      .filter((a) => !completedAchievementIds.has(a.id))
      .sort(() => Math.random() - 0.5);

    // Return the requested number of achievements
    return availableAchievements.slice(0, count);
  },
};

export default achievementService;
