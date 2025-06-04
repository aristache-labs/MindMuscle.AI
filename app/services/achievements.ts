import { logger } from '../utils/logger';
import supabase from './supabase';
import { validationService } from './validationService';

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
    try {
      const { data, error } = await supabase.from('achievements').select('*').order('created_at');

      if (error) {
        logger.error('Error fetching achievements', error, {
          context: { operation: 'getAllAchievements' },
        });
        throw error;
      }

      // Validate each achievement
      const validatedAchievements: Achievement[] = [];
      for (const achievement of data || []) {
        const validationResult = validationService.validateAchievement(achievement);
        if (validationResult.success) {
          // Cast to Achievement since validation passed and database should have all required fields
          validatedAchievements.push(validationResult.data as Achievement);
        } else {
          logger.warn('Invalid achievement data received from database', {
            context: {
              achievementId: achievement?.id,
              errors: validationResult.errors,
            },
          });
        }
      }

      logger.info('Achievements fetched successfully', {
        context: { count: validatedAchievements.length },
      });

      return validatedAchievements;
    } catch (error) {
      logger.error('Failed to fetch achievements', error as Error, {
        context: { operation: 'getAllAchievements' },
      });
      throw error;
    }
  },

  // Get user's achievements
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      // Validate user ID
      if (!userId || typeof userId !== 'string') {
        throw new Error('Valid user ID is required');
      }

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

      if (error) {
        logger.error('Error fetching user achievements', error, {
          context: { userId, operation: 'getUserAchievements' },
        });
        throw error;
      }

      // Validate each user achievement
      const validatedUserAchievements: UserAchievement[] = [];
      for (const userAchievement of data || []) {
        const validationResult = validationService.validateUserAchievement(userAchievement);
        if (validationResult.success) {
          // Cast to UserAchievement since validation passed and database should have all required fields
          validatedUserAchievements.push(validationResult.data as UserAchievement);
        } else {
          logger.warn('Invalid user achievement data received from database', {
            context: {
              userId,
              userAchievementId: userAchievement?.id,
              errors: validationResult.errors,
            },
          });
        }
      }

      logger.info('User achievements fetched successfully', {
        context: { userId, count: validatedUserAchievements.length },
      });

      return validatedUserAchievements;
    } catch (error) {
      logger.error('Failed to fetch user achievements', error as Error, {
        context: { userId, operation: 'getUserAchievements' },
      });
      throw error;
    }
  },

  // Get user's completed achievements
  async getUserCompletedAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      // Validate user ID
      if (!userId || typeof userId !== 'string') {
        throw new Error('Valid user ID is required');
      }

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

      if (error) {
        logger.error('Error fetching user completed achievements', error, {
          context: { userId, operation: 'getUserCompletedAchievements' },
        });
        throw error;
      }

      // Validate each completed achievement
      const validatedCompletedAchievements: UserAchievement[] = [];
      for (const userAchievement of data || []) {
        const validationResult = validationService.validateUserAchievement(userAchievement);
        if (validationResult.success) {
          // Cast to UserAchievement since validation passed and database should have all required fields
          validatedCompletedAchievements.push(validationResult.data as UserAchievement);
        } else {
          logger.warn('Invalid completed achievement data received from database', {
            context: {
              userId,
              userAchievementId: userAchievement?.id,
              errors: validationResult.errors,
            },
          });
        }
      }

      logger.info('User completed achievements fetched successfully', {
        context: { userId, count: validatedCompletedAchievements.length },
      });

      return validatedCompletedAchievements;
    } catch (error) {
      logger.error('Failed to fetch user completed achievements', error as Error, {
        context: { userId, operation: 'getUserCompletedAchievements' },
      });
      throw error;
    }
  },

  // Initialize achievements for a new user
  async initializeUserAchievements(userId: string): Promise<void> {
    try {
      // Validate user ID
      if (!userId || typeof userId !== 'string') {
        throw new Error('Valid user ID is required');
      }

      const achievements = await this.getAllAchievements();

      const userAchievements = achievements.map((achievement) => ({
        user_id: userId,
        achievement_id: achievement.id,
        is_completed: false,
        current_progress: 0,
      }));

      // Validate each user achievement before insertion
      for (const userAchievement of userAchievements) {
        const validationResult = validationService.validateUserAchievement(userAchievement);
        if (!validationResult.success) {
          const errorMessage = `User achievement validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;
          logger.error('User achievement validation failed', new Error(errorMessage), {
            context: { userId, userAchievement, errors: validationResult.errors },
          });
          throw new Error(errorMessage);
        }
      }

      const { error } = await supabase.from('user_achievements').insert(userAchievements);

      if (error) {
        logger.error('Error initializing user achievements', error, {
          context: { userId, achievementCount: userAchievements.length },
        });
        throw error;
      }

      logger.info('User achievements initialized successfully', {
        context: { userId, achievementCount: userAchievements.length },
      });
    } catch (error) {
      logger.error('Failed to initialize user achievements', error as Error, {
        context: { userId, operation: 'initializeUserAchievements' },
      });
      throw error;
    }
  },

  // Update achievement progress
  async updateProgress(userId: string, achievementId: string, progress: number): Promise<void> {
    try {
      // Validate input data
      const updateData = { userId, achievementId, progress };
      const validationResult = validationService.validateUpdateAchievementProgress(updateData);

      if (!validationResult.success) {
        const errorMessage = `Achievement progress update validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;
        logger.error('Achievement progress update validation failed', new Error(errorMessage), {
          context: { updateData, errors: validationResult.errors },
        });
        throw new Error(errorMessage);
      }

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

      if (error) {
        logger.error('Error updating achievement progress', error, {
          context: { userId, achievementId, progress, isCompleted },
        });
        throw error;
      }

      logger.info('Achievement progress updated successfully', {
        context: { userId, achievementId, progress, isCompleted },
      });
    } catch (error) {
      logger.error('Failed to update achievement progress', error as Error, {
        context: { userId, achievementId, progress, operation: 'updateProgress' },
      });
      throw error;
    }
  },

  // Complete an achievement directly
  async completeAchievement(userId: string, achievementId: string): Promise<void> {
    try {
      // Validate input data
      if (!userId || typeof userId !== 'string') {
        throw new Error('Valid user ID is required');
      }
      if (!achievementId || typeof achievementId !== 'string') {
        throw new Error('Valid achievement ID is required');
      }

      const { error } = await supabase
        .from('user_achievements')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('achievement_id', achievementId);

      if (error) {
        logger.error('Error completing achievement', error, {
          context: { userId, achievementId },
        });
        throw error;
      }

      logger.info('Achievement completed successfully', {
        context: { userId, achievementId },
      });
    } catch (error) {
      logger.error('Failed to complete achievement', error as Error, {
        context: { userId, achievementId, operation: 'completeAchievement' },
      });
      throw error;
    }
  },

  // Get random achievements that user hasn't completed
  async getRandomAchievements(userId: string, count: number): Promise<Achievement[]> {
    try {
      // Validate input data
      if (!userId || typeof userId !== 'string') {
        throw new Error('Valid user ID is required');
      }
      if (!count || count <= 0 || count > 50) {
        throw new Error('Count must be between 1 and 50');
      }

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
      const randomAchievements = availableAchievements.slice(0, count);

      logger.info('Random achievements fetched successfully', {
        context: { userId, requestedCount: count, returnedCount: randomAchievements.length },
      });

      return randomAchievements;
    } catch (error) {
      logger.error('Failed to get random achievements', error as Error, {
        context: { userId, count, operation: 'getRandomAchievements' },
      });
      throw error;
    }
  },
};

export default achievementService;
